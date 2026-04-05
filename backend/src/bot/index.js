const { Telegraf, session } = require('telegraf');
const config = require('../config');
const { subscriptionMiddleware, isAdmin } = require('./middleware');
const { handleStart, handleCheckSubscription, handleAdminPanel } = require('./handlers/start');
const {
  handleQueryReport,
  handleContactAdmin,
  handleHelp,
  handleSearchMessage,
} = require('./handlers/report');
const {
  getTemplateFields,
  buildPreview,
  promptField,
  sendPreview,
  buildSubmitKeyboard,
  startReportWizard,
  notifyAdmins,
} = require('./handlers/reportWizard');
const { getAdminConfig, buildMainKeyboard, buildChannelMessageUrl } = require('./keyboards');
const ReportDraft = require('../models/ReportDraft');
const Report = require('../models/Report');
const Admin = require('../models/Admin');

function createBot() {
  const bot = new Telegraf(config.BOT_TOKEN);

  // Session middleware (for admin "need more info" pending state)
  bot.use(session());

  // Apply subscription middleware (skip for /start and subscription check)
  bot.use(async (ctx, next) => {
    if (ctx.from && isAdmin(ctx.from.id)) return next();
    if (ctx.message && ctx.message.text === '/start') return next();
    if (ctx.callbackQuery && ctx.callbackQuery.data === 'check_subscription') return next();
    return subscriptionMiddleware(bot)(ctx, next);
  });

  // Commands
  bot.command('start', (ctx) => handleStart(ctx, bot));
  bot.command('admin', (ctx) => handleAdminPanel(ctx));

  // Callback: subscription check
  bot.action('check_subscription', (ctx) => handleCheckSubscription(ctx, bot));
  bot.action('noop', (ctx) => ctx.answerCbQuery());

  // ── Draft wizard callback actions ──────────────────────────────────────────

  // Start filling the draft (triggered by "开始填写" button)
  bot.action('draft_start', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => {});
    const draft = await ReportDraft.findByPk(ctx.from.id);
    if (!draft || !draft.templateFields || draft.templateFields.length === 0) {
      await ctx.reply('❌ 草稿不存在，请重新发送"写报告"。');
      return;
    }
    const fields = draft.templateFields;
    await promptField(ctx, fields[0], 0, fields.length);
  });

  // Skip optional field
  bot.action(/^draft_skip:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('⏭ 已跳过');
    await ctx.deleteMessage().catch(() => {});
    const draft = await ReportDraft.findByPk(ctx.from.id);
    if (!draft) return;
    const fields = draft.templateFields;
    const nextStep = draft.currentStep + 1;
    await draft.update({ currentStep: nextStep });

    if (nextStep >= fields.length) {
      await sendPreview(ctx, draft);
      await ctx.reply('所有字段已填写完毕，请确认报告内容后提交。', buildSubmitKeyboard(fields));
      return;
    }
    await promptField(ctx, fields[nextStep], nextStep, fields.length);
  });

  // Select single-choice option for a field
  bot.action(/^draft_select:([^:]+):(.+)$/, async (ctx) => {
    const fieldName = ctx.match[1];
    const value = ctx.match[2];
    await ctx.answerCbQuery('✅ 已选择：' + value);
    await ctx.deleteMessage().catch(() => {});
    const draft = await ReportDraft.findByPk(ctx.from.id);
    if (!draft) return;
    const newData = Object.assign({}, draft.data, { [fieldName]: value });
    const fields = draft.templateFields;
    const nextStep = draft.currentStep + 1;
    await draft.update({ data: newData, currentStep: nextStep });

    await sendPreview(ctx, draft);
    if (nextStep >= fields.length) {
      await ctx.reply('所有字段已填写完毕，请确认报告内容后提交。', buildSubmitKeyboard(fields));
      return;
    }
    await promptField(ctx, fields[nextStep], nextStep, fields.length);
  });

  // Edit a specific field
  bot.action(/^draft_edit:(.+)$/, async (ctx) => {
    const fieldName = ctx.match[1];
    await ctx.answerCbQuery();
    const draft = await ReportDraft.findByPk(ctx.from.id);
    if (!draft) return;
    const fields = draft.templateFields;
    const fieldIdx = fields.findIndex((f) => f.name === fieldName);
    if (fieldIdx === -1) return;
    await draft.update({ currentStep: fieldIdx });
    await promptField(ctx, fields[fieldIdx], fieldIdx, fields.length);
  });

  // Submit draft as report
  bot.action('draft_submit', async (ctx) => {
    await ctx.answerCbQuery('⏳ 正在提交…');
    const draft = await ReportDraft.findByPk(ctx.from.id);
    if (!draft) {
      return ctx.reply('❌ 草稿不存在，请重新发送"写报告"。');
    }
    const data = draft.data || {};
    const fields = draft.templateFields || (await getTemplateFields());

    // Validate required fields
    const missing = fields.filter((f) => f.required && !data[f.name]);
    if (missing.length > 0) {
      const labels = missing.map((f) => f.label).join('、');
      return ctx.reply('❌ 以下必填字段未填写：' + labels + '\n\n请先完成填写。');
    }

    try {
      const report = await Report.create({
        userId: ctx.from.id,
        username: ctx.from.username || '',
        firstName: ctx.from.first_name || '',
        title: String(data.title || '').slice(0, 200),
        description: String(data.description || '').slice(0, 4000),
        content: data,
        tags: data.tags
          ? String(data.tags).split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean)
          : [],
      });

      await draft.destroy();

      // Notify all admins
      await notifyAdmins(ctx.telegram, report, config.ADMIN_IDS, fields);

      const keyboard = await buildMainKeyboard();
      await ctx.reply(
        '✅ 报告 No.' + report.reportNumber + ' 已提交审核！\n\n我们会尽快处理，请耐心等待。',
        keyboard
      );
    } catch (e) {
      console.error('Failed to submit report:', e.message);
      await ctx.reply('❌ 提交失败，请稍后再试。');
    }
  });

  // Cancel / discard draft
  bot.action('draft_cancel', async (ctx) => {
    await ctx.answerCbQuery('🗑 已放弃草稿');
    await ctx.deleteMessage().catch(() => {});
    await ReportDraft.destroy({ where: { userId: ctx.from.id } }).catch(() => {});
    const keyboard = await buildMainKeyboard();
    await ctx.reply('草稿已放弃。', keyboard);
  });

  // ── Report review callback actions (admin) ─────────────────────────────────

  bot.action(/^approve_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ 无权限');
    const reportId = ctx.match[1];
    const report = await Report.findByPk(reportId);
    if (!report) return ctx.answerCbQuery('报告不存在');

    const adminConfig = await Admin.findOne({ where: { adminId: config.ADMIN_ID } });
    const fields = await getTemplateFields();

    const publishChats = config.PUBLISH_CHATS.length > 0
      ? config.PUBLISH_CHATS
      : (adminConfig && adminConfig.pushChannelId ? [adminConfig.pushChannelId] : []);

    const frontendUrl = config.FRONTEND_URL || config.API_URL;
    const reportUrl = config.joinUrl(frontendUrl, 'report/' + report.id);

    const pushText =
      '📋 *报告推送* No.' + report.reportNumber + '\n\n' +
      buildPreview(report.content || {}, fields) +
      (config.isValidPublicUrl(reportUrl) ? '\n🔗 [查看报告详情](' + reportUrl + ')' : '');

    const channelMessages = [];
    for (const chatId of publishChats) {
      try {
        const msg = await ctx.telegram.sendMessage(chatId, pushText, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        });
        const url = buildChannelMessageUrl(chatId, msg.message_id);
        channelMessages.push({ chatId, messageId: msg.message_id, url });
      } catch (e) {
        console.error('Failed to push to channel ' + chatId + ':', e.message);
      }
    }

    await report.update({
      status: 'approved',
      reviewedAt: new Date(),
      reviewedBy: ctx.from.id,
      channelMessages,
      channelMessageId: channelMessages[0] ? channelMessages[0].messageId : null,
    });

    const approvedMsg = (adminConfig && adminConfig.reviewFeedback && adminConfig.reviewFeedback.approved)
      || '✅ 你的报告已通过审核，已推送到频道。';
    const linkText = channelMessages.length > 0 && channelMessages[0].url
      ? '\n\n🔗 ' + channelMessages[0].url : '';
    await ctx.telegram.sendMessage(String(report.userId), approvedMsg + linkText).catch(() => {});

    await ctx.answerCbQuery('✅ 已通过审核');
    const originalText = ctx.callbackQuery.message.text || '';
    await ctx.editMessageText(originalText + '\n\n✅ 已审核通过', { parse_mode: 'Markdown' }).catch(() => {});
  });

  bot.action(/^reject_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ 无权限');
    const reportId = ctx.match[1];
    const report = await Report.findByPk(reportId);
    if (!report) return ctx.answerCbQuery('报告不存在');

    await report.update({ status: 'rejected', reviewedAt: new Date(), reviewedBy: ctx.from.id });

    const adminConfig = await Admin.findOne({ where: { adminId: config.ADMIN_ID } });
    const rejectedMsg = (adminConfig && adminConfig.reviewFeedback && adminConfig.reviewFeedback.rejected)
      || '❌ 你的报告未通过审核，请修改后重新提交。';
    await ctx.telegram.sendMessage(String(report.userId), rejectedMsg).catch(() => {});

    await ctx.answerCbQuery('❌ 已拒绝');
    const originalText = ctx.callbackQuery.message.text || '';
    await ctx.editMessageText(originalText + '\n\n❌ 已拒绝', { parse_mode: 'Markdown' }).catch(() => {});
  });

  // "Need more info" — mark report and ask admin to type supplementary note
  bot.action(/^need_info_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ 无权限');
    const reportId = ctx.match[1];
    const report = await Report.findByPk(reportId);
    if (!report) return ctx.answerCbQuery('报告不存在');

    await report.update({ status: 'need_more_info', reviewedAt: new Date(), reviewedBy: ctx.from.id });

    await ctx.answerCbQuery('🔎 请输入补充要求（将发给用户）');
    ctx.session = ctx.session || {};
    ctx.session.pendingNeedMoreInfo = { reportId: report.id, userId: String(report.userId) };
    await ctx.reply(
      '🔎 报告 No.' + report.reportNumber + ' 已标记为"需要补充材料"。\n\n请输入发给用户的补充要求，或发送 /skip 跳过。'
    );

    const originalText = ctx.callbackQuery.message.text || '';
    await ctx.editMessageText(originalText + '\n\n🔎 需要补充材料', { parse_mode: 'Markdown' }).catch(() => {});
  });

  // ── Text message router ────────────────────────────────────────────────────

  bot.on('text', async (ctx) => {
    ctx.session = ctx.session || {};

    // Admin typing supplementary note after clicking "need more info"
    if (ctx.session.pendingNeedMoreInfo && isAdmin(ctx.from.id)) {
      const { reportId, userId } = ctx.session.pendingNeedMoreInfo;
      const note = ctx.message.text.trim();
      delete ctx.session.pendingNeedMoreInfo;

      if (note !== '/skip') {
        const report = await Report.findByPk(reportId);
        if (report) {
          await report.update({ needMoreInfoNote: note.slice(0, 1000) });
          const adminConfig = await Admin.findOne({ where: { adminId: config.ADMIN_ID } });
          const baseMsg = (adminConfig && adminConfig.reviewFeedback && adminConfig.reviewFeedback.needMoreInfo)
            || '🔎 管理员需要更多信息才能完成审核，请补充材料后重新提交。';
          await ctx.telegram.sendMessage(userId, baseMsg + '\n\n📋 补充要求：' + note).catch(() => {});
          return ctx.reply('✅ 已发送补充要求给用户。');
        }
      }
      return ctx.reply('✅ 已跳过补充说明。');
    }

    const text = ctx.message.text.trim();

    // Check if user has an active draft in progress
    const activeDraft = await ReportDraft.findByPk(ctx.from.id);
    if (activeDraft && activeDraft.currentStep < activeDraft.templateFields.length) {
      const fields = activeDraft.templateFields;
      const step = activeDraft.currentStep;
      const field = fields[step];

      if (field.type !== 'select' && field.type !== 'media') {
        const newData = Object.assign({}, activeDraft.data, { [field.name]: text.slice(0, 2000) });
        const nextStep = step + 1;
        await activeDraft.update({ data: newData, currentStep: nextStep });
        await sendPreview(ctx, activeDraft);

        if (nextStep >= fields.length) {
          await ctx.reply('所有字段已填写完毕，请确认报告内容后提交。', buildSubmitKeyboard(fields));
          return;
        }
        await promptField(ctx, fields[nextStep], nextStep, fields.length);
        return;
      }
    }

    // Handle search queries
    if (text.startsWith('@') || text.startsWith('#') || text.startsWith('关键词:') || text.startsWith('关键词：')) {
      return handleSearchMessage(ctx);
    }

    // Match keyboard button actions
    const admin = await getAdminConfig();
    const keyboard = admin.keyboards.find((k) => k.text === text);

    if (keyboard) {
      switch (keyboard.action) {
        case 'write_report':
          return startReportWizard(ctx);
        case 'query_report':
          return handleQueryReport(ctx);
        case 'contact_admin':
          return handleContactAdmin(ctx);
        case 'help':
          return handleHelp(ctx);
        default:
          return ctx.reply('你点击了：' + text);
      }
    }

    // Keyword search fallback for longer texts
    if (text.length > 1 && !text.startsWith('/')) {
      return handleSearchMessage(ctx);
    }
  });

  // Handle photo/document/location messages for active draft
  bot.on(['photo', 'document', 'location'], async (ctx) => {
    const activeDraft = await ReportDraft.findByPk(ctx.from.id);
    if (!activeDraft || activeDraft.currentStep >= activeDraft.templateFields.length) return;

    const fields = activeDraft.templateFields;
    const step = activeDraft.currentStep;
    const field = fields[step];

    if (field.type !== 'media' && field.type !== 'text') return;

    const newData = Object.assign({}, activeDraft.data);
    if (ctx.message.photo) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      newData[field.name] = '[photo:' + photo.file_id + ']';
    } else if (ctx.message.document) {
      newData[field.name] = '[file:' + ctx.message.document.file_id + ':' + (ctx.message.document.file_name || '') + ']';
    } else if (ctx.message.location) {
      newData[field.name] = ctx.message.location.latitude + ',' + ctx.message.location.longitude;
    } else {
      return;
    }

    const nextStep = step + 1;
    await activeDraft.update({ data: newData, currentStep: nextStep });
    await sendPreview(ctx, activeDraft);

    if (nextStep >= fields.length) {
      await ctx.reply('所有字段已填写完毕，请确认报告内容后提交。', buildSubmitKeyboard(fields));
      return;
    }
    await promptField(ctx, fields[nextStep], nextStep, fields.length);
  });

  // Error handler
  bot.catch((err, ctx) => {
    console.error('Bot error for update ' + ctx.updateType + ':', err.message);
  });

  return bot;
}

module.exports = createBot;
