import { prisma } from './prisma'
import { sendMessage, answerCallbackQuery } from './telegram'

/**
 * 处理 /start 命令 - 欢迎消息
 */
export async function handleStartCommand(
  chatId: string,
  userId: string,
  telegramUser: any
) {
  try {
    // 记录/更新用户到数据库
    const now = new Date()
    if (telegramUser) {
      await prisma.user.upsert({
        where: { telegramId: String(telegramUser.id) },
        create: {
          telegramId: String(telegramUser.id),
          username: telegramUser.username || null,
          firstName: telegramUser.first_name || null,
          lastName: telegramUser.last_name || null,
          lastActiveAt: now,
        },
        update: {
          username: telegramUser.username || null,
          firstName: telegramUser.first_name || null,
          lastName: telegramUser.last_name || null,
          lastActiveAt: now,
        },
      })
    }

    const message = `🎰 <b>欢迎使用抽奖机器人！</b>

✨ <b>主要功能：</b>
• 🎁 参与抽奖 - 免费参与各种抽奖活动
• 🏆 中奖查询 - 查看您的中奖记录
• 💎 VIP特权 - 更多抽奖机会和专属福利

📌 <b>常用命令：</b>
/start - 开始使用
/vip - 购买VIP/管理员套餐
/my - 我的信息
/help - 帮助说明

👇 点击下方按钮开始：`

    await sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🎁 参与抽奖', callback_data: 'show_lotteries' },
            { text: '💎 购买套餐', callback_data: 'show_vip' },
          ],
          [
            { text: '📋 我的记录', callback_data: 'show_my' },
            { text: '❓ 帮助', callback_data: 'show_help' },
          ],
        ],
      },
    })
  } catch (error) {
    console.error('Error in handleStartCommand:', error)
    await sendMessage(chatId, '👋 欢迎使用抽奖机器人！')
  }
}

/**
 * 处理 /help 命令 - 帮助说明
 */
export async function handleHelpCommand(chatId: string) {
  const message = `📖 <b>使用帮助</b>

<b>🎁 如何参与抽奖？</b>
1. 在群里看到抽奖消息
2. 点击「参与抽奖」按钮
3. 满足参与条件即可参与
4. 开奖后自动通知中奖

<b>💎 VIP会员特权：</b>
• 无限参与抽奖次数
• 专属VIP抽奖活动
• 优先客服支持

<b>👑 管理员权限：</b>
• 创建和管理抽奖
• 查看数据统计
• 管理用户和订单

<b>💰 如何购买？</b>
发送 /vip 查看套餐和购买

<b>📌 常用命令：</b>
/start - 开始使用
/vip - 购买套餐
/my - 我的信息
/help - 帮助说明

如有问题请联系管理员`

  await sendMessage(chatId, message, {
    parse_mode: 'HTML',
  })
}

/**
 * 处理 /my 命令 - 我的信息
 */
export async function handleMyCommand(chatId: string, userId: string) {
  try {
    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { telegramId: userId },
      include: {
        _count: {
          select: {
            winners: true,
          },
        },
      },
    })

    // 获取参与次数
    const participantCount = await prisma.participant.count({
      where: { telegramId: userId },
    })

    // 获取管理员信息
    const admin = await prisma.admin.findFirst({
      where: { telegramId: userId, isActive: true },
    })

    // 获取最近中奖记录
    const recentWins = await prisma.winner.findMany({
      where: { telegramId: userId },
      include: { lottery: true, prize: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    })

    // 构建消息
    let message = `👤 <b>我的信息</b>\n\n`

    message += `<b>基本信息</b>\n`
    message += `用户名：${user?.username ? '@' + user.username : '未设置'}\n`
    message += `用户ID：${userId}\n`
    message += `注册时间：${
      user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString('zh-CN')
        : '-'
    }\n\n`

    message += `<b>💎 会员状态</b>\n`
    message += `VIP状态：${user?.isVip ? '✅ 已开通' : '❌ 未开通'}\n`
    if (user?.isVip && user?.vipExpireAt) {
      message += `到期时间：${new Date(user.vipExpireAt).toLocaleDateString(
        'zh-CN'
      )}\n`
    }
    message += '\n'

    message += `<b>👑 管理员状态</b>\n`
    message += `管理员：${admin ? '✅ 是' : '❌ 否'}\n`
    if (admin) {
      message += `到期时间：永久\n`
    }
    message += '\n'

    message += `<b>📊 参与统计</b>\n`
    const winnerCount = user?._count?.winners || 0
    const winRate =
      participantCount > 0
        ? ((winnerCount / participantCount) * 100).toFixed(1)
        : '0'
    message += `参与抽奖：${participantCount} 次\n`
    message += `中奖次数：${winnerCount} 次\n`
    message += `中奖率：${winRate}%\n\n`

    message += `<b>🏆 最近中奖</b>\n`
    if (recentWins.length > 0) {
      recentWins.forEach((win) => {
        const prizeName = win.prize?.name || '奖品'
        const lotteryTitle = win.lottery?.title || '抽奖'
        const date = new Date(win.createdAt).toLocaleDateString('zh-CN')
        message += `• ${prizeName} - ${lotteryTitle} (${date})\n`
      })
    } else {
      message += `暂无中奖记录，继续参与抽奖吧！\n`
    }

    await sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🎁 参与抽奖', callback_data: 'show_lotteries' },
            { text: '💎 购买/续费', callback_data: 'show_vip' },
          ],
          [{ text: '🔙 返回主菜单', callback_data: 'back_to_menu' }],
        ],
      },
    })
  } catch (error) {
    console.error('Error in handleMyCommand:', error)
    await sendMessage(chatId, '获取用户信息失败，请稍后重试。')
  }
}

/**
 * 处理显示进行中的抽奖
 */
export async function handleShowLotteries(
  chatId: string,
  userId: string,
  callbackQueryId: string
) {
  try {
    // 获取进行中的抽奖
    const lotteries = await prisma.lottery.findMany({
      where: {
        status: 'active',
      },
      include: {
        prizes: true,
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    if (lotteries.length === 0) {
      await sendMessage(
        chatId,
        `🎁 <b>进行中的抽奖</b>\n\n暂无进行中的抽奖活动，请关注群消息！`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 返回主菜单', callback_data: 'back_to_menu' }],
            ],
          },
        }
      )
      await answerCallbackQuery(callbackQueryId)
      return
    }

    let message = `🎁 <b>进行中的抽奖</b>\n\n`

    const keyboard = []
    lotteries.forEach((lottery, index) => {
      const prizeNames =
        lottery.prizes.map((p) => p.name).join('、') || '神秘奖品'
      const participantCount = lottery._count?.participants || 0
      const drawCondition = lottery.drawCount || '不限'
      
      // Format end time based on draw type
      let endTimeStr = ''
      if (lottery.drawType === 'time' && lottery.drawTime) {
        endTimeStr = new Date(lottery.drawTime).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      } else if (lottery.drawType === 'count') {
        endTimeStr = `满${lottery.drawCount}人`
      }

      message += `${index + 1}️⃣ <b>${lottery.title}</b>\n`
      message += `   奖品：${prizeNames}\n`
      message += `   参与：${participantCount}/${drawCondition}\n`
      if (endTimeStr) {
        message += `   截止：${endTimeStr}\n`
      }
      message += '\n'

      keyboard.push([
        {
          text: `参与「${lottery.title}」`,
          callback_data: `join_lottery_${lottery.id}`,
        },
      ])
    })

    keyboard.push([
      { text: '🔙 返回主菜单', callback_data: 'back_to_menu' },
    ])

    await sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard },
    })

    await answerCallbackQuery(callbackQueryId)
  } catch (error) {
    console.error('Error in handleShowLotteries:', error)
    await answerCallbackQuery(callbackQueryId, '获取抽奖列表失败')
    await sendMessage(chatId, '获取抽奖列表失败，请稍后重试。')
  }
}
