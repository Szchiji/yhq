const { getAdminConfig, buildMainKeyboard, buildStartInlineKeyboard, buildSubscribeKeyboard } = require('../keyboards');
const { checkSubscription, isAdmin, getRequiredChats } = require('../middleware');
const config = require('../../config');

/**
 * /start command handler
 */
async function handleStart(ctx, bot) {
  const isSubscribed = await checkSubscription(ctx, bot);
  const admin = await getAdminConfig();

  if (!isSubscribed) {
    const requiredChats = await getRequiredChats();
    if (requiredChats.length > 0) {
      return ctx.reply(
        '⚠️ 请先订阅我们的频道才能使用此机器人！\n\n订阅后点击"我已加入，重新检测"按钮继续。',
        buildSubscribeKeyboard(requiredChats)
      );
    }
  }

  const mainKeyboard = await buildMainKeyboard();
  const inlineKeyboard = await buildStartInlineKeyboard();
  const startText = admin.startContent.text || '欢迎使用报告管理机器人！';

  const hasInlineButtons = admin.startContent.buttons && admin.startContent.buttons.length > 0;
  const replyMarkup = hasInlineButtons ? inlineKeyboard : mainKeyboard;

  try {
    if (admin.startContent.mediaType === 'photo' && admin.startContent.mediaUrl) {
      await ctx.replyWithPhoto(admin.startContent.mediaUrl, {
        caption: startText,
        reply_markup: replyMarkup.reply_markup,
      });
    } else if (admin.startContent.mediaType === 'video' && admin.startContent.mediaUrl) {
      await ctx.replyWithVideo(admin.startContent.mediaUrl, {
        caption: startText,
        reply_markup: replyMarkup.reply_markup,
      });
    } else {
      await ctx.reply(startText, replyMarkup);
    }
  } catch {
    await ctx.reply(startText, mainKeyboard);
  }

  // Always send main keyboard after inline buttons
  if (hasInlineButtons) {
    await ctx.reply('请选择操作：', mainKeyboard);
  }
}

/**
 * Check subscription callback
 */
async function handleCheckSubscription(ctx, bot) {
  const isSubscribed = await checkSubscription(ctx, bot);
  if (isSubscribed) {
    await ctx.answerCbQuery('✅ 验证成功！');
    await ctx.deleteMessage().catch(() => {});
    return handleStart(ctx, bot);
  } else {
    await ctx.answerCbQuery('❌ 尚未订阅，请先订阅所有频道！', { show_alert: true });
  }
}

/**
 * Admin panel entry
 */
async function handleAdminPanel(ctx) {
  if (!isAdmin(ctx.from.id)) {
    return ctx.reply('❌ 你没有管理员权限。');
  }
  const frontendUrl = config.FRONTEND_URL || config.API_URL;
  const adminUrl = config.joinUrl(frontendUrl, 'admin');

  if (!config.isValidPublicUrl(adminUrl)) {
    return ctx.reply('🔧 *管理员后台*\n\n后台地址未配置，请联系系统管理员设置 FRONTEND_URL 环境变量。', { parse_mode: 'Markdown' });
  }

  const { Markup } = require('telegraf');
  await ctx.reply(
    '🔧 *管理员后台*\n\n点击下方按钮进入管理配置界面：',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('⚙️ 进入管理后台', adminUrl)],
      ]),
    }
  );
}

module.exports = { handleStart, handleCheckSubscription, handleAdminPanel };
