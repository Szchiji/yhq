/**
 * In-bot report writing wizard using a DB-backed state machine.
 *
 * Flow:
 *  1. User clicks "写报告" → startReportWizard() creates draft, shows overview
 *  2. User clicks "开始填写" → promptCurrentField() prompts first field
 *  3. User sends text/media/location → saveFieldAndAdvance() saves, prompts next
 *  4. After all fields → show full preview + submit/cancel keyboard
 *  5. User clicks "提交审核" → submitDraft() creates Report, notifies admins
 */

const { Markup } = require('telegraf');
const ReportDraft = require('../../models/ReportDraft');
const Report = require('../../models/Report');
const Admin = require('../../models/Admin');
const config = require('../../config');
const { getAdminConfig } = require('../keyboards');

// Default report template fields used when admin hasn't configured a custom one
const DEFAULT_TEMPLATE_FIELDS = [
  { name: 'title',    label: '标题',    type: 'text',     required: true },
  { name: 'target',   label: '对象',    type: 'text',     required: true },
  { name: 'category', label: '分类',    type: 'select',   required: true, options: ['举报', '投诉', '建议', '其他'] },
  { name: 'description', label: '描述', type: 'textarea', required: true },
  { name: 'evidence', label: '证据（图片/文件，可跳过）', type: 'media', required: false },
  { name: 'time',     label: '时间',    type: 'text',     required: false },
  { name: 'location', label: '地点',    type: 'text',     required: false },
  { name: 'tags',     label: '标签（用空格或逗号分隔）', type: 'text', required: false },
];

/**
 * Get template fields: admin custom > default
 */
async function getTemplateFields() {
  const admin = await getAdminConfig();
  if (admin.reportTemplate && Array.isArray(admin.reportTemplate.fields) && admin.reportTemplate.fields.length > 0) {
    return admin.reportTemplate.fields;
  }
  return DEFAULT_TEMPLATE_FIELDS;
}

/**
 * Build a preview message string from draft data and template fields.
 */
function buildPreview(data, fields) {
  let text = '📋 *报告预览*\n\n';
  for (const f of fields) {
    const val = data[f.name];
    if (val !== undefined && val !== null && val !== '') {
      const display = Array.isArray(val) ? val.join(', ') : String(val);
      text += `*${f.label}：* ${display}\n`;
    } else {
      text += `*${f.label}：* _(未填写)_\n`;
    }
  }
  return text;
}

/**
 * Prompt the user for a specific field.
 */
async function promptField(ctx, field, stepIdx, totalSteps) {
  const progress = `(${stepIdx + 1}/${totalSteps})`;
  let prompt = `📝 ${progress} 请填写 *${field.label}*`;

  if (field.type === 'select' && field.options && field.options.length > 0) {
    const buttons = field.options.map((o) => [Markup.button.callback(o, `draft_select:${field.name}:${o}`)]);
    if (!field.required) {
      buttons.push([Markup.button.callback('⏭ 跳过', `draft_skip:${field.name}`)]);
    }
    await ctx.reply(prompt, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    });
    return;
  }

  if (field.type === 'media') {
    prompt += '\n\n请发送图片或文件，或点击下方跳过。';
    await ctx.reply(prompt, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('⏭ 跳过', `draft_skip:${field.name}`)],
      ]),
    });
    return;
  }

  if (!field.required) {
    await ctx.reply(prompt, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('⏭ 跳过', `draft_skip:${field.name}`)],
      ]),
    });
    return;
  }

  await ctx.reply(prompt, { parse_mode: 'Markdown' });
}

/**
 * Send a preview summary message to the user.
 */
async function sendPreview(ctx, draft) {
  const text = buildPreview(draft.data, draft.templateFields);
  try {
    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch {
    // preview is non-critical
  }
}

/**
 * Build the final submission keyboard.
 */
function buildSubmitKeyboard(fields) {
  const editButtons = fields.map((f) => Markup.button.callback(`✏️ 修改${f.label}`, `draft_edit:${f.name}`));
  const editRows = [];
  for (let i = 0; i < editButtons.length; i += 2) {
    editRows.push(editButtons.slice(i, i + 2));
  }
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ 提交审核', 'draft_submit')],
    ...editRows,
    [Markup.button.callback('🗑 放弃草稿', 'draft_cancel')],
  ]);
}

/**
 * Start the report wizard: create/reset draft and show overview.
 */
async function startReportWizard(ctx) {
  const fields = await getTemplateFields();
  await ReportDraft.upsert({
    userId: ctx.from.id,
    currentStep: 0,
    data: {},
    templateFields: fields,
    previewMessageId: null,
  });

  const fieldList = fields.map((f, i) => `${i + 1}. ${f.label}${f.required ? '' : '（可选）'}`).join('\n');
  await ctx.reply(
    `📝 *填写报告*\n\n报告包含以下字段，请逐一填写：\n\n${fieldList}\n\n点击"开始填写"按照引导逐步完成。`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('▶️ 开始填写', 'draft_start')],
        [Markup.button.callback('❌ 取消', 'draft_cancel')],
      ]),
    }
  );
}

/**
 * Notify all admins of a new report submission.
 */
async function notifyAdmins(telegram, report, adminIds, templateFields) {
  const adminConfig = await Admin.findOne({ where: { adminId: config.ADMIN_ID } });
  const fields = templateFields || await getTemplateFields();
  const inlineKeyboard = [
    [
      { text: '✅ 通过', callback_data: `approve_${report.id}` },
      { text: '❌ 拒绝', callback_data: `reject_${report.id}` },
      { text: '🔎 补充材料', callback_data: `need_info_${report.id}` },
    ],
  ];

  const preview = buildPreview(report.content || {}, fields);
  const msg =
    `📬 *新报告待审核*\n\n` +
    `报告编号：No.${report.reportNumber}\n\n` +
    preview;

  const targets = (adminIds && adminIds.length > 0) ? adminIds : [config.ADMIN_ID];
  for (const adminId of targets) {
    await telegram.sendMessage(String(adminId), msg, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard },
    }).catch((e) => console.error(`Failed to notify admin ${adminId}:`, e.message));
  }

  // Notify user: pending
  const pendingMsg = adminConfig?.reviewFeedback?.pending || '⏳ 你的报告已提交，等待管理员审核。';
  await telegram.sendMessage(String(report.userId), pendingMsg).catch(() => {});
}

module.exports = {
  getTemplateFields,
  buildPreview,
  promptField,
  sendPreview,
  buildSubmitKeyboard,
  startReportWizard,
  notifyAdmins,
  DEFAULT_TEMPLATE_FIELDS,
};

