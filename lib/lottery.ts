import { prisma } from './prisma'
import { sendMessage, replaceTemplateVariables, getBotUsername, getChat } from './telegram'

// 执行开奖
export async function executeDraw(lotteryId: string) {
  // 1. 获取抽奖信息和参与者
  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: {
      prizes: true,
      participants: true,
      winners: true,
    },
  })

  if (!lottery) {
    throw new Error('Lottery not found')
  }

  if (lottery.status !== 'active') {
    throw new Error('Lottery is not active')
  }

  // 2. 随机抽取中奖者
  // Create a Set of winner telegramIds for O(1) lookup
  const winnerTelegramIds = new Set(lottery.winners.map(w => w.telegramId))
  const availableParticipants = lottery.participants.filter(
    p => !winnerTelegramIds.has(p.telegramId)
  )

  const winners = []
  const prizeUpdates: Record<string, number> = {}
  
  for (const prize of lottery.prizes) {
    let winnersForPrize = 0
    for (let i = 0; i < prize.remaining && availableParticipants.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * availableParticipants.length)
      const winner = availableParticipants.splice(randomIndex, 1)[0]
      
      winners.push({
        lotteryId: lottery.id,
        telegramId: winner.telegramId,
        username: winner.username,
        firstName: winner.firstName,
        prizeId: prize.id,
        prizeName: prize.name,
      })
      winnersForPrize++
    }
    prizeUpdates[prize.id] = Math.max(0, prize.remaining - winnersForPrize)
  }

  // 3. 更新数据库
  await prisma.$transaction([
    ...winners.map(w => prisma.winner.create({ data: w })),
    prisma.lottery.update({
      where: { id: lotteryId },
      data: {
        status: 'drawn',
        drawnAt: new Date(),
      },
    }),
    ...lottery.prizes.map(p =>
      prisma.prize.update({
        where: { id: p.id },
        data: { remaining: prizeUpdates[p.id] },
      })
    ),
  ])

  // Re-fetch winners with IDs
  const createdWinners = await prisma.winner.findMany({
    where: { lotteryId },
  })

  // 4. 发送通知
  await sendNotifications(lottery, createdWinners)

  return createdWinners
}

// 发送通知
async function sendNotifications(lottery: any, winners: any[]) {
  // 中奖用户列表文本
  const winnerListText = winners
    .map(w => `${w.firstName || w.username || w.telegramId} - ${w.prizeName}`)
    .join('\n')

  // 通知中奖者
  for (const winner of winners) {
    const message = replaceTemplateVariables(lottery.winnerNotification, {
      member: winner.firstName || winner.username || winner.telegramId,
      lotteryTitle: lottery.title,
      goodsName: winner.prizeName,
      lotterySn: lottery.id.slice(0, 8),
    })

    try {
      await sendMessage(parseInt(winner.telegramId), message)
      await prisma.winner.update({
        where: { id: winner.id },
        data: { notified: true },
      })
    } catch (error) {
      console.error(`Failed to notify winner ${winner.telegramId}:`, error)
    }
  }

  // 通知创建者
  const creatorMessage = replaceTemplateVariables(lottery.creatorNotification, {
    lotteryTitle: lottery.title,
    awardUserList: winnerListText,
    joinNum: lottery.participants.length,
  })

  try {
    await sendMessage(parseInt(lottery.createdBy), creatorMessage)
  } catch (error) {
    console.error(`Failed to notify creator ${lottery.createdBy}:`, error)
  }

  // 通知群组（更新已推送的消息或发送新消息）
  const groupMessage = replaceTemplateVariables(lottery.groupNotification, {
    lotteryTitle: lottery.title,
    awardUserList: winnerListText,
    joinNum: lottery.participants.length,
  })

  const publishes = await prisma.lotteryPublish.findMany({
    where: { lotteryId: lottery.id }
  })

  for (const publish of publishes) {
    try {
      await sendMessage(publish.chatId, groupMessage)
    } catch (error) {
      console.error(`Failed to notify group ${publish.chatId}:`, error)
    }
  }
}

// 检查是否需要开奖（人满开奖）
export async function checkAndDraw(lotteryId: string) {
  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: {
      participants: true,
    },
  })

  if (!lottery || lottery.status !== 'active') {
    return false
  }

  if (lottery.drawType === 'count' && lottery.drawCount) {
    if (lottery.participants.length >= lottery.drawCount) {
      await executeDraw(lotteryId)
      return true
    }
  }

  return false
}

// 定时开奖检查（可用 cron 调用）
export async function checkScheduledDraws() {
  const now = new Date()
  
  const lotteries = await prisma.lottery.findMany({
    where: {
      status: 'active',
      drawType: 'time',
      drawTime: {
        lte: now,
      },
    },
  })

  const results = []
  for (const lottery of lotteries) {
    try {
      await executeDraw(lottery.id)
      results.push({ id: lottery.id, success: true })
    } catch (error) {
      console.error(`Failed to draw lottery ${lottery.id}:`, error)
      results.push({ id: lottery.id, success: false, error: String(error) })
    }
  }

  return results
}

// 默认推送模板
const DEFAULT_PUBLISH_TEMPLATE = `🎁 抽奖标题：{lotteryTitle}

📦 抽奖说明：
{lotteryDesc}

🎫 参与条件：
{channelList}

🎁 奖品内容：
{prizeList}

📅 开奖时间：{drawTime} {drawType}
👉 参与抽奖链接：{joinLink}`

// 构建推送消息
export function buildPublishMessage(lottery: any, botUsername: string): string {
  const channelList = lottery.channels && lottery.channels.length > 0
    ? lottery.channels.map((c: any) => `🎫 加入-${c.title}`).join('\n')
    : '无需加入频道/群组'
  
  const prizeList = lottery.prizes && lottery.prizes.length > 0
    ? lottery.prizes.map((p: any) => `💰 ${p.name} × ${p.total}`).join('\n')
    : '暂无奖品'
  
  const drawTime = lottery.drawTime 
    ? new Date(lottery.drawTime).toLocaleString('zh-CN')
    : ''
  
  const drawType = lottery.drawType === 'time' 
    ? '自动开奖' 
    : `满${lottery.drawCount}人开奖`
  
  const joinLink = `https://t.me/${botUsername}?start=lottery_${lottery.id}`
  
  let message = lottery.publishTemplate || DEFAULT_PUBLISH_TEMPLATE
  
  message = message
    .replace(/{lotteryTitle}/g, lottery.title || '')
    .replace(/{lotteryDesc}/g, lottery.description || '')
    .replace(/{creator}/g, lottery.creatorUsername ? `@${lottery.creatorUsername}` : '')
    .replace(/{channelList}/g, channelList)
    .replace(/{prizeList}/g, prizeList)
    .replace(/{drawTime}/g, drawTime)
    .replace(/{drawType}/g, drawType)
    .replace(/{joinCount}/g, String(lottery._count?.participants || 0))
    .replace(/{joinLink}/g, joinLink)
    .replace(/{botUsername}/g, botUsername)
  
  return message
}

// 推送抽奖消息
export async function publishLottery(lotteryId: string, chatId: string, publishedBy: string) {
  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: { 
      prizes: true, 
      participants: true,
      channels: true,
      _count: {
        select: {
          participants: true
        }
      }
    }
  })

  if (!lottery) {
    throw new Error('抽奖不存在')
  }

  // 获取群组信息
  let chatTitle = chatId
  try {
    const chatInfo = await getChat(chatId)
    chatTitle = chatInfo.ok ? (chatInfo.result.title || chatId) : chatId
  } catch (error) {
    console.error('Error fetching chat info:', error)
  }

  // 构建消息内容
  const botUsername = await getBotUsername()
  const message = buildPublishMessage(lottery, botUsername)

  // 发送消息
  const result = await sendMessage(chatId, message, {
    reply_markup: {
      inline_keyboard: [[
        { text: '🎯 立即参与', url: `https://t.me/${botUsername}?start=lottery_${lotteryId}` }
      ]]
    }
  })

  // 记录推送历史
  await prisma.lotteryPublish.create({
    data: {
      lotteryId,
      chatId,
      chatTitle,
      messageId: result.ok ? String(result.result.message_id) : null,
      publishedBy
    }
  })

  return result
}

// 发送创建成功消息
export async function sendCreateSuccessMessage(
  lottery: { 
    id: string
    title: string
    drawType: string
    drawTime: Date | null
    drawCount: number | null
    requireChannels: string[]
    channels?: Array<{ chatId: string; title: string; username?: string | null }>
    prizes: Array<{ name: string; total: number }>
  }, 
  creatorId: string
) {
  const goodsList = lottery.prizes.map(p => `${p.name} x${p.total}`).join(', ')
  const openCondition = lottery.drawType === 'time' 
    ? `定时开奖: ${lottery.drawTime ? new Date(lottery.drawTime).toLocaleString('zh-CN') : ''}` 
    : `满 ${lottery.drawCount} 人开奖`

  const message = `✅ 抽奖创建成功！

📋 标题：${lottery.title}
🎁 奖品：${goodsList}
👥 开奖：${openCondition}
📅 创建：${new Date().toLocaleString('zh-CN')}

请选择推送到哪个群组/频道：`

  // 构建推送按钮
  const buttons = []
  if (lottery.channels && lottery.channels.length > 0) {
    for (const channel of lottery.channels) {
      buttons.push([{
        text: `📢 发布到频道：${channel.title}`,
        callback_data: `publish_${lottery.id}_${channel.chatId}`
      }])
    }

    // 添加推送全部按钮
    if (lottery.channels.length > 1) {
      buttons.push([{
        text: '📢 发布到全部频道',
        callback_data: `publish_all_${lottery.id}`
      }])
    }
  }

  try {
    await sendMessage(parseInt(creatorId), message, {
      reply_markup: {
        inline_keyboard: buttons
      }
    })
  } catch (error) {
    console.error('Failed to send create success message:', error)
  }
}
