/**
 * 教师评价平台 - 核心逻辑
 *
 * 系统A：快速评价（@用户名 → 👍/👎 → 理由）
 * 系统B：详细报告（@用户名 → 📝写报告 → 表单 → 截图 → 标签 → 审核 → 推送）
 */

import { prisma } from './prisma'
import { sendMessage } from './telegram'

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const MIN_REASON_LENGTH = 12   // 快速评价最短理由字数
const MAX_SCREENSHOTS = 3      // 最多预约截图张数

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 格式化用户显示名 */
function formatUserName(firstName?: string | null, lastName?: string | null, username?: string | null): string {
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  if (fullName) return fullName
  if (username) return `@${username}`
  return '未知用户'
}

/** 获取报告模板（若无则用默认值） */
async function getReportTemplate() {
  const tmpl = await prisma.reportTemplate.findFirst()
  if (tmpl) return tmpl
  return {
    fields: [
      { key: 'contact', label: '联系方式', order: 1, required: true, type: 'text' },
      { key: 'service', label: '服务内容', order: 2, required: true, type: 'text' },
      { key: 'rating', label: '评分 (1-10)', order: 3, required: true, type: 'text' },
      { key: 'comment', label: '详细评价', order: 4, required: true, type: 'text' },
    ] as TemplateField[],
    header: '📋 <b>详细报告</b>',
    footer: '感谢您的评价！',
  }
}

export interface TemplateField {
  key: string
  label: string
  order: number
  required: boolean
  type: string // text / textarea
}

// ─────────────────────────────────────────────
// 统计卡片
// ─────────────────────────────────────────────

/** 构建教师统计卡片消息并发送 */
export async function sendTeacherStatsCard(
  chatId: string,
  groupId: string,
  teacherUsername: string,
) {
  const username = teacherUsername.replace(/^@/, '')

  const [positiveCount, negativeCount, reports] = await Promise.all([
    prisma.quickEvaluation.count({
      where: { teacherUsername: username, isPositive: true },
    }),
    prisma.quickEvaluation.count({
      where: { teacherUsername: username, isPositive: false },
    }),
    prisma.publishedReport.count({ where: { teacherUsername: username } }),
  ])

  const total = positiveCount + negativeCount
  const posRate = total > 0 ? Math.round((positiveCount / total) * 100) : 0
  const negRate = total > 0 ? 100 - posRate : 0

  const botUsername = process.env.BOT_USERNAME || ''
  // start param: eval_teacherUsername_groupId
  const startParam = `eval_${username}_${groupId}`

  const text =
    `👤 <b>@${username}</b>\n\n` +
    `👍 推荐：${positiveCount} 人（${posRate}%）\n` +
    `👎 不推荐：${negativeCount} 人（${negRate}%）\n` +
    `📝 详细报告：${reports} 份\n` +
    `📊 总评价：${total} 次`

  await sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '👍 推荐',
            url: `https://t.me/${botUsername}?start=${startParam}_like`,
          },
          {
            text: '👎 不推荐',
            url: `https://t.me/${botUsername}?start=${startParam}_dislike`,
          },
        ],
        [
          {
            text: '📝 写报告',
            url: `https://t.me/${botUsername}?start=${startParam}_report`,
          },
          {
            text: '🔍 查看报告',
            callback_data: `eval_view_${username}`,
          },
        ],
      ],
    },
  })
}

// ─────────────────────────────────────────────
// FSM 状态管理
// ─────────────────────────────────────────────

export async function getUserState(userId: string) {
  return prisma.userEvalState.findUnique({ where: { userId } })
}

export async function setUserState(userId: string, state: string, data: any) {
  return prisma.userEvalState.upsert({
    where: { userId },
    create: { userId, state, data },
    update: { state, data, updatedAt: new Date() },
  })
}

export async function clearUserState(userId: string) {
  try {
    await prisma.userEvalState.delete({ where: { userId } })
  } catch {
    // ignore if not exists
  }
}

// ─────────────────────────────────────────────
// 系统A：快速评价入口
// ─────────────────────────────────────────────

/** 用户点击推荐/不推荐按钮后，跳转到私聊输入理由 */
export async function startQuickRate(
  chatId: string,
  userId: string,
  teacherUsername: string,
  groupId: string,
  isPositive: boolean,
) {
  const username = teacherUsername.replace(/^@/, '')

  // 检查是否已评价过
  const existing = await prisma.quickEvaluation.findFirst({
    where: { teacherUsername: username, raterId: userId },
  })
  if (existing) {
    await sendMessage(chatId, `⚠️ 您已经评价过 <b>@${username}</b> 了，每人只能评价一次。`, {
      parse_mode: 'HTML',
    })
    return
  }

  await setUserState(userId, 'quick_reason', {
    teacherUsername: username,
    groupId,
    isPositive,
  })

  const emoji = isPositive ? '👍' : '👎'
  await sendMessage(
    chatId,
    `${emoji} 您正在评价 <b>@${username}</b>\n\n` +
      `请输入您的评价理由（至少12个字）：`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '❌ 取消', callback_data: 'eval_cancel' }]] },
    },
  )
}

/** 接收快速评价理由并保存 */
export async function handleQuickReason(
  chatId: string,
  userId: string,
  raterUsername: string | undefined,
  raterName: string,
  reason: string,
) {
  const state = await getUserState(userId)
  if (!state || state.state !== 'quick_reason') return false

  const data = state.data as any

  if (reason.length < MIN_REASON_LENGTH) {
    await sendMessage(chatId, `⚠️ 理由太短了，请至少输入${MIN_REASON_LENGTH}个字。`)
    return true
  }

  await prisma.quickEvaluation.create({
    data: {
      teacherUsername: data.teacherUsername,
      raterId: userId,
      raterUsername: raterUsername || null,
      raterName,
      isPositive: data.isPositive,
      reason,
      groupId: data.groupId || null,
    },
  })

  await clearUserState(userId)

  const emoji = data.isPositive ? '👍' : '👎'
  await sendMessage(
    chatId,
    `✅ 评价已提交！\n\n${emoji} 您${data.isPositive ? '推荐' : '不推荐'} <b>@${data.teacherUsername}</b>`,
    { parse_mode: 'HTML' },
  )
  return true
}

// ─────────────────────────────────────────────
// 系统B：详细报告
// ─────────────────────────────────────────────

/** 开始填写报告表单 */
export async function startReportForm(
  chatId: string,
  userId: string,
  teacherUsername: string,
  groupId: string,
) {
  const username = teacherUsername.replace(/^@/, '')
  const tmpl = await getReportTemplate()
  const fields = (tmpl.fields as TemplateField[]).sort((a, b) => a.order - b.order)

  await setUserState(userId, `report_field_0`, {
    teacherUsername: username,
    groupId,
    fieldIndex: 0,
    formData: {},
    tags: [],
    screenshots: [],
  })

  await sendMessage(
    chatId,
    `📝 <b>填写详细报告 - @${username}</b>\n\n` +
      `共需填写 ${fields.length} 个字段，完成后上传预约截图。\n\n` +
      `第 1/${fields.length} 题：\n<b>${fields[0].label}</b>${fields[0].required ? ' *必填' : ''}`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '❌ 取消', callback_data: 'eval_cancel' }]] },
    },
  )
}

/** 处理报告表单字段输入 */
export async function handleReportField(
  chatId: string,
  userId: string,
  text: string,
): Promise<boolean> {
  const state = await getUserState(userId)
  if (!state || !state.state.startsWith('report_field_')) return false

  const data = state.data as any
  const tmpl = await getReportTemplate()
  const fields = (tmpl.fields as TemplateField[]).sort((a, b) => a.order - b.order)
  const fieldIndex = data.fieldIndex as number
  const field = fields[fieldIndex]

  if (!field) return false

  // Save current field
  data.formData[field.key] = text
  const nextIndex = fieldIndex + 1

  if (nextIndex < fields.length) {
    // Next field
    data.fieldIndex = nextIndex
    await setUserState(userId, `report_field_${nextIndex}`, data)
    const nextField = fields[nextIndex]
    await sendMessage(
      chatId,
      `✅ 已记录\n\n第 ${nextIndex + 1}/${fields.length} 题：\n<b>${nextField.label}</b>${nextField.required ? ' *必填' : ''}`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '❌ 取消', callback_data: 'eval_cancel' }]] },
      },
    )
  } else {
    // All fields done, ask for screenshots
    data.fieldIndex = nextIndex
    await setUserState(userId, 'report_screenshots', data)
    await sendMessage(
      chatId,
      `✅ 表单填写完成！\n\n📸 <b>请上传预约截图（1-${MAX_SCREENSHOTS}张，必填）</b>\n\n` +
        `截图需包含订单号或日期信息，用于验证真实性。\n` +
        `上传完成后，发送 <code>/done</code> 继续。`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ 截图已上传完成', callback_data: 'eval_screenshots_done' }],
            [{ text: '❌ 取消', callback_data: 'eval_cancel' }],
          ],
        },
      },
    )
  }
  return true
}

/** 接收截图 */
export async function handleReportScreenshot(
  chatId: string,
  userId: string,
  fileId: string,
): Promise<boolean> {
  const state = await getUserState(userId)
  if (!state || state.state !== 'report_screenshots') return false

  const data = state.data as any
  if (!data.screenshots) data.screenshots = []
  if (data.screenshots.length >= MAX_SCREENSHOTS) {
    await sendMessage(chatId, `⚠️ 最多上传${MAX_SCREENSHOTS}张截图，请发送 <code>/done</code> 或点击按钮继续。`, {
      parse_mode: 'HTML',
    })
    return true
  }

  data.screenshots.push(fileId)
  await setUserState(userId, 'report_screenshots', data)

  const count = data.screenshots.length
  await sendMessage(
    chatId,
    `✅ 截图 ${count}/${MAX_SCREENSHOTS} 已收到。${count < MAX_SCREENSHOTS ? '\n可继续发送截图或点击"上传完成"继续。' : '\n已达上限，请点击"上传完成"继续。'}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: `✅ 截图已上传完成 (${count}张)`, callback_data: 'eval_screenshots_done' }],
          [{ text: '❌ 取消', callback_data: 'eval_cancel' }],
        ],
      },
    },
  )
  return true
}

/** 截图上传完成，进入标签阶段 */
export async function finishScreenshots(chatId: string, userId: string): Promise<boolean> {
  const state = await getUserState(userId)
  if (!state || state.state !== 'report_screenshots') return false

  const data = state.data as any
  if (!data.screenshots || data.screenshots.length === 0) {
    await sendMessage(chatId, '⚠️ 请至少上传1张预约截图。')
    return true
  }

  // Check tag config
  const tagConfig = await prisma.tagFieldConfig.findFirst()

  if (tagConfig && tagConfig.isEnabled) {
    await setUserState(userId, 'report_tags', data)

    if (tagConfig.mode === 'predefined') {
      const tags = await prisma.predefinedTag.findMany({
        where: { isEnabled: true },
        orderBy: { sortOrder: 'asc' },
        take: 20,
      })

      if (tags.length > 0) {
        const keyboard = []
        // Group tags 3 per row
        for (let i = 0; i < tags.length; i += 3) {
          keyboard.push(
            tags.slice(i, i + 3).map((t) => ({
              text: `#${t.tag}`,
              callback_data: `eval_tag_${t.tag}`,
            })),
          )
        }
        keyboard.push([{ text: `✅ 完成标签选择`, callback_data: 'eval_tags_done' }])
        keyboard.push([{ text: '❌ 取消', callback_data: 'eval_cancel' }])

        await sendMessage(
          chatId,
          `🏷️ <b>选择标签</b>${tagConfig.isRequired ? ' *必填' : '（可选）'}\n\n` +
            `已选：${data.tags?.join(' ') || '（无）'}\n` +
            `最多选 ${tagConfig.maxTags} 个`,
          {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard },
          },
        )
        return true
      }
    }

    // Free input mode
    await sendMessage(
      chatId,
      `🏷️ <b>输入标签</b>${tagConfig.isRequired ? ' *必填' : '（可选）'}\n\n` +
        `格式：用空格分隔多个标签，如 <code>龙岗 竹竹</code>\n` +
        `最多 ${tagConfig.maxTags} 个标签\n\n` +
        `或发送 <code>/skip</code> 跳过标签。`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏭️ 跳过标签', callback_data: 'eval_tags_done' }],
            [{ text: '❌ 取消', callback_data: 'eval_cancel' }],
          ],
        },
      },
    )
  } else {
    // No tag config or disabled, go to preview
    await setUserState(userId, 'report_preview', data)
    await sendReportPreview(chatId, userId, data)
  }
  return true
}

/** 处理标签输入（自由输入模式） */
export async function handleTagInput(chatId: string, userId: string, text: string): Promise<boolean> {
  const state = await getUserState(userId)
  if (!state || state.state !== 'report_tags') return false

  const data = state.data as any
  const tagConfig = await prisma.tagFieldConfig.findFirst()
  const maxTags = tagConfig?.maxTags || 5

  // Parse tags
  const newTags = text
    .split(/[\s,，]+/)
    .map((t) => t.replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, maxTags)

  data.tags = newTags
  await setUserState(userId, 'report_preview', data)
  await sendReportPreview(chatId, userId, data)
  return true
}

/** 添加/切换预定义标签 */
export async function togglePredefinedTag(chatId: string, userId: string, tag: string): Promise<boolean> {
  const state = await getUserState(userId)
  if (!state || state.state !== 'report_tags') return false

  const data = state.data as any
  const tagConfig = await prisma.tagFieldConfig.findFirst()
  const maxTags = tagConfig?.maxTags || 5

  if (!data.tags) data.tags = []
  const idx = data.tags.indexOf(tag)
  if (idx >= 0) {
    data.tags.splice(idx, 1) // remove
  } else if (data.tags.length < maxTags) {
    data.tags.push(tag)
  } else {
    await sendMessage(chatId, `⚠️ 最多选 ${maxTags} 个标签。`)
    return true
  }

  await setUserState(userId, 'report_tags', data)

  // Re-render tag selection
  const tags = await prisma.predefinedTag.findMany({
    where: { isEnabled: true },
    orderBy: { sortOrder: 'asc' },
    take: 20,
  })

  const keyboard = []
  for (let i = 0; i < tags.length; i += 3) {
    keyboard.push(
      tags.slice(i, i + 3).map((t) => ({
        text: data.tags.includes(t.tag) ? `✅ #${t.tag}` : `#${t.tag}`,
        callback_data: `eval_tag_${t.tag}`,
      })),
    )
  }
  keyboard.push([{ text: `✅ 完成标签选择 (${data.tags.length}个)`, callback_data: 'eval_tags_done' }])
  keyboard.push([{ text: '❌ 取消', callback_data: 'eval_cancel' }])

  await sendMessage(
    chatId,
    `🏷️ <b>选择标签</b>\n\n已选：${data.tags.map((t: string) => `#${t}`).join(' ') || '（无）'}`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard },
    },
  )
  return true
}

/** 标签选择完成，进入预览 */
export async function finishTags(chatId: string, userId: string): Promise<boolean> {
  const state = await getUserState(userId)
  if (!state || state.state !== 'report_tags') return false

  const data = state.data as any
  const tagConfig = await prisma.tagFieldConfig.findFirst()

  if (tagConfig?.isRequired && (!data.tags || data.tags.length === 0)) {
    await sendMessage(chatId, '⚠️ 标签为必填项，请至少选择一个标签。')
    return true
  }

  await setUserState(userId, 'report_preview', data)
  await sendReportPreview(chatId, userId, data)
  return true
}

/** 发送报告预览 */
export async function sendReportPreview(chatId: string, userId: string, data: any) {
  const tmpl = await getReportTemplate()
  const fields = (tmpl.fields as TemplateField[]).sort((a, b) => a.order - b.order)

  let preview = `${tmpl.header ? tmpl.header + '\n\n' : ''}` +
    `📋 <b>报告预览 - @${data.teacherUsername}</b>\n\n`

  for (const field of fields) {
    const val = data.formData?.[field.key]
    if (val) {
      preview += `<b>${field.label}：</b>${val}\n`
    }
  }

  if (data.tags && data.tags.length > 0) {
    preview += `\n🏷️ 标签：${data.tags.map((t: string) => `#${t}`).join(' ')}\n`
  }

  preview += `\n📸 截图：${data.screenshots?.length || 0} 张`
  if (tmpl.footer) preview += `\n\n${tmpl.footer}`

  await sendMessage(chatId, preview, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ 提交审核', callback_data: 'eval_submit_report' },
          { text: '❌ 取消', callback_data: 'eval_cancel' },
        ],
      ],
    },
  })
}

/** 提交报告 */
export async function submitReport(chatId: string, userId: string): Promise<boolean> {
  const state = await getUserState(userId)
  if (!state || state.state !== 'report_preview') return false

  const data = state.data as any

  const pendingReport = await prisma.pendingReport.create({
    data: {
      teacherUsername: data.teacherUsername,
      authorId: userId,
      authorUsername: null,
      authorName: null,
      groupId: data.groupId || null,
      formData: data.formData || {},
      tags: data.tags || [],
      status: 'pending',
    },
  })

  // Save screenshots
  if (data.screenshots && data.screenshots.length > 0) {
    await prisma.reportScreenshot.createMany({
      data: data.screenshots.map((fileId: string, i: number) => ({
        reportId: pendingReport.id,
        fileId,
        sortOrder: i,
      })),
    })
  }

  await clearUserState(userId)
  await sendMessage(
    chatId,
    `✅ <b>报告已提交审核！</b>\n\n您的报告将在管理员审核通过后发布。\n审核结果将通过机器人通知您。`,
    { parse_mode: 'HTML' },
  )

  // Notify admins
  await notifyAdminsNewReport(pendingReport.id, data.teacherUsername, userId)
  return true
}

/** 通知管理员有新报告 */
async function notifyAdminsNewReport(reportId: string, teacherUsername: string, authorId: string) {
  try {
    const admins = await prisma.admin.findMany({ where: { isActive: true } })
    const superAdminIds = (process.env.SUPER_ADMIN_IDS || '').split(',').filter(Boolean)
    const allAdminIds = [
      ...admins.map((a) => a.telegramId),
      ...superAdminIds,
    ].filter((v, i, arr) => arr.indexOf(v) === i)

    for (const adminId of allAdminIds) {
      try {
        await sendMessage(
          adminId,
          `📋 <b>新报告待审核</b>\n\n教师：@${teacherUsername}\n提交人：${authorId}\n报告ID：${reportId}\n\n请前往后台审核。`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ 通过', callback_data: `eval_approve_${reportId}` },
                  { text: '❌ 驳回', callback_data: `eval_reject_${reportId}` },
                ],
              ],
            },
          },
        )
      } catch {
        // ignore failed admin notification
      }
    }
  } catch (e) {
    console.error('notifyAdminsNewReport error:', e)
  }
}

// ─────────────────────────────────────────────
// 审核功能
// ─────────────────────────────────────────────

/** 管理员批准报告 */
export async function approveReport(adminId: string, reportId: string) {
  const report = await prisma.pendingReport.findUnique({
    where: { id: reportId },
    include: { screenshots: true },
  })
  if (!report || report.status !== 'pending') return null

  await prisma.pendingReport.update({
    where: { id: reportId },
    data: { status: 'approved', reviewedBy: adminId, reviewedAt: new Date() },
  })

  // Create published report
  const published = await prisma.publishedReport.create({
    data: {
      teacherUsername: report.teacherUsername,
      authorId: report.authorId,
      authorUsername: report.authorUsername,
      authorName: report.authorName,
      formData: report.formData as any,
      tags: report.tags,
      pendingReportId: report.id,
    },
  })

  // Push to report channels
  await pushReportToChannels(published)

  // Notify author
  try {
    await sendMessage(
      report.authorId,
      `✅ <b>您的报告已通过审核！</b>\n\n关于教师 @${report.teacherUsername} 的报告已发布。`,
      { parse_mode: 'HTML' },
    )
  } catch {
    // ignore
  }

  return published
}

/** 管理员驳回报告 */
export async function rejectReport(adminId: string, reportId: string, reason: string) {
  const report = await prisma.pendingReport.findUnique({ where: { id: reportId } })
  if (!report || report.status !== 'pending') return null

  await prisma.pendingReport.update({
    where: { id: reportId },
    data: {
      status: 'rejected',
      reviewedBy: adminId,
      reviewedAt: new Date(),
      rejectionReason: reason,
    },
  })

  // Notify author
  try {
    await sendMessage(
      report.authorId,
      `❌ <b>您的报告未通过审核</b>\n\n关于教师 @${report.teacherUsername} 的报告被驳回。\n原因：${reason}`,
      { parse_mode: 'HTML' },
    )
  } catch {
    // ignore
  }

  return true
}

/** 推送报告到各报告频道 */
async function pushReportToChannels(report: {
  id: string
  teacherUsername: string
  authorId: string
  authorUsername: string | null
  formData: any
  tags: string[]
}) {
  try {
    const channels = await prisma.evalChannel.findMany({
      where: { type: 'report', isEnabled: true },
    })

    const tmpl = await getReportTemplate()
    const fields = (tmpl.fields as TemplateField[]).sort((a, b) => a.order - b.order)

    let text = `${tmpl.header ? tmpl.header + '\n\n' : ''}` +
      `📋 <b>评价报告 - @${report.teacherUsername}</b>\n\n`

    for (const field of fields) {
      const val = (report.formData as any)?.[field.key]
      if (val) text += `<b>${field.label}：</b>${val}\n`
    }

    if (report.tags && report.tags.length > 0) {
      text += `\n🏷️ ${report.tags.map((t) => `#${t}`).join(' ')}\n`
    }

    text += `\n👤 评价人：${report.authorUsername ? '@' + report.authorUsername : report.authorId}`
    if (tmpl.footer) text += `\n\n${tmpl.footer}`

    const messageIds: Record<string, string> = {}

    for (const channel of channels) {
      try {
        const res = await sendMessage(channel.chatId, text, { parse_mode: 'HTML' })
        if (res?.result?.message_id) {
          messageIds[channel.chatId] = String(res.result.message_id)
        }
      } catch {
        // ignore failed channel push
      }
    }

    // Update published report with channel message IDs
    if (Object.keys(messageIds).length > 0) {
      await prisma.publishedReport.update({
        where: { id: report.id },
        data: { channelMessageIds: messageIds },
      })
    }
  } catch (e) {
    console.error('pushReportToChannels error:', e)
  }
}

// ─────────────────────────────────────────────
// 标签搜索
// ─────────────────────────────────────────────

/** 处理 #标签 搜索请求 */
export async function handleTagSearch(chatId: string, tags: string[]) {
  if (tags.length === 0) return

  // Find reports matching ALL tags (case-insensitive)
  const reports = await prisma.publishedReport.findMany({
    where: {
      AND: tags.map((tag) => ({
        tags: { has: tag },
      })),
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const tagDisplay = tags.map((t) => `#${t}`).join(' ')

  if (reports.length === 0) {
    await sendMessage(
      chatId,
      `🔍 搜索 ${tagDisplay}\n\n暂无匹配的报告。`,
      { parse_mode: 'HTML' },
    )
    return
  }

  const tmpl = await getReportTemplate()
  const fields = (tmpl.fields as TemplateField[]).sort((a, b) => a.order - b.order)
  const firstField = fields[0]

  let text = `🔍 搜索 <b>${tagDisplay}</b>\n\n找到 ${reports.length} 份报告：\n\n`

  const keyboard: Array<Array<{ text: string; callback_data: string }>> = []

  for (let i = 0; i < reports.length; i++) {
    const r = reports[i]
    const firstVal = firstField ? (r.formData as any)?.[firstField.key] : ''
    const preview = firstVal ? `${firstVal.slice(0, 30)}` : `@${r.teacherUsername}`
    text += `${i + 1}. @${r.teacherUsername} - ${preview}\n`
    keyboard.push([
      {
        text: `${i + 1}. @${r.teacherUsername}`,
        callback_data: `eval_report_${r.id}`,
      },
    ])
  }

  await sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  })
}

/** 查看完整报告详情 */
export async function sendReportDetail(chatId: string, reportId: string) {
  const report = await prisma.publishedReport.findUnique({ where: { id: reportId } })
  if (!report) {
    await sendMessage(chatId, '⚠️ 报告不存在。')
    return
  }

  const tmpl = await getReportTemplate()
  const fields = (tmpl.fields as TemplateField[]).sort((a, b) => a.order - b.order)

  let text = `${tmpl.header ? tmpl.header + '\n\n' : ''}` +
    `📋 <b>@${report.teacherUsername}</b>\n\n`

  for (const field of fields) {
    const val = (report.formData as any)?.[field.key]
    if (val) text += `<b>${field.label}：</b>${val}\n`
  }

  if (report.tags && report.tags.length > 0) {
    text += `\n🏷️ ${report.tags.map((t) => `#${t}`).join(' ')}\n`
  }

  text += `\n👤 评价人：${report.authorUsername ? '@' + report.authorUsername : report.authorId}`
  text += `\n📅 发布时间：${report.createdAt.toLocaleDateString('zh-CN')}`
  if (tmpl.footer) text += `\n\n${tmpl.footer}`

  await sendMessage(chatId, text, { parse_mode: 'HTML' })
}

/** 查看教师所有已发布报告列表 */
export async function sendTeacherReportList(chatId: string, teacherUsername: string) {
  const username = teacherUsername.replace(/^@/, '')
  const reports = await prisma.publishedReport.findMany({
    where: { teacherUsername: username },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  if (reports.length === 0) {
    await sendMessage(chatId, `📋 @${username} 暂无已发布的详细报告。`)
    return
  }

  const keyboard = reports.map((r, i) => [
    {
      text: `第${i + 1}份报告 - ${r.createdAt.toLocaleDateString('zh-CN')}`,
      callback_data: `eval_report_${r.id}`,
    },
  ])

  await sendMessage(
    chatId,
    `📋 <b>@${username}</b> 的报告列表（共 ${reports.length} 份）：`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard },
    },
  )
}

// ─────────────────────────────────────────────
// 强制订阅验证
// ─────────────────────────────────────────────

/** 检查用户是否已订阅所有强制订阅频道 */
export async function checkSubscription(userId: string): Promise<{
  ok: boolean
  missing: Array<{ chatId: string; title: string; inviteLink?: string | null; username?: string | null }>
}> {
  const channels = await prisma.evalChannel.findMany({
    where: { type: 'subscribe', isEnabled: true },
  })

  if (channels.length === 0) return { ok: true, missing: [] }

  const botToken = process.env.BOT_TOKEN!
  const missing: typeof channels = []

  for (const ch of channels) {
    try {
      const params = new URLSearchParams({ chat_id: ch.chatId, user_id: userId })
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/getChatMember?${params}`,
      )
      const data = await res.json()
      const status = data?.result?.status
      if (!['member', 'administrator', 'creator'].includes(status)) {
        missing.push(ch)
      }
    } catch {
      // If can't check, assume OK
    }
  }

  return { ok: missing.length === 0, missing }
}

/** 发送订阅提示 */
export async function sendSubscriptionPrompt(
  chatId: string,
  missing: Array<{ chatId: string; title: string; inviteLink?: string | null; username?: string | null }>,
) {
  let text = `⚠️ <b>请先加入以下频道/群组：</b>\n\n`
  const keyboard: Array<Array<{ text: string; url: string }>> = []

  for (const ch of missing) {
    text += `• ${ch.title}\n`
    const url = ch.inviteLink || (ch.username ? `https://t.me/${ch.username}` : '')
    if (url) {
      keyboard.push([{ text: `➡️ 加入 ${ch.title}`, url }])
    }
  }

  text += `\n加入后请重新操作。`

  await sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  })
}
