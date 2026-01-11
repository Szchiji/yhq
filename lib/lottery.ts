import { prisma } from './prisma'
import { sendMessage, getBotUsername, getChat, getTemplate, generateJoinConditionText } from './telegram'
import { replaceAllPlaceholders } from './placeholders'

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
  // 获取模板
  const winnerPrivateTemplate = await getTemplate('winner_private', lottery.createdBy)
  const creatorPrivateTemplate = await getTemplate('creator_private', lottery.createdBy)
  const winnerPublicTemplate = await getTemplate('winner_public', lottery.createdBy)
  
  // 中奖用户列表文本
  const awardUserList = winners
    .map(w => `${w.firstName || w.username || w.telegramId} - ${w.prizeName}`)
    .join('\n')

  // 通知中奖者
  for (const winner of winners) {
    const message = replaceAllPlaceholders(winnerPrivateTemplate, {
      lotterySn: lottery.id.slice(0, 8),
      lotteryTitle: lottery.title,
      member: winner.firstName || winner.username || winner.telegramId,
      goodsName: winner.prizeName,
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
  const creatorMessage = replaceAllPlaceholders(creatorPrivateTemplate, {
    lotterySn: lottery.id.slice(0, 8),
    lotteryTitle: lottery.title,
    awardUserList,
    joinNum: lottery.participants?.length || 0,
  })

  try {
    await sendMessage(parseInt(lottery.createdBy), creatorMessage)
  } catch (error) {
    console.error(`Failed to notify creator ${lottery.createdBy}:`, error)
  }

  // 通知群组（更新已推送的消息或发送新消息）
  const groupMessage = replaceAllPlaceholders(winnerPublicTemplate, {
    lotterySn: lottery.id.slice(0, 8),
    lotteryTitle: lottery.title,
    awardUserList,
    joinNum: lottery.participants?.length || 0,
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

// 抽奖数据类型（用于构建消息）
type LotteryWithRelations = {
  id: string
  title: string
  description?: string | null
  drawType: string
  drawTime?: Date | null
  drawCount?: number | null
  createdBy: string
  creatorUsername?: string
  channels?: Array<{ 
    chatId: string
    title: string 
  }>
  prizes?: Array<{ 
    name: string
    total: number 
  }>
  _count?: {
    participants?: number
  }
}

// 构建推送消息
export async function buildPublishMessage(lottery: LotteryWithRelations, botUsername: string): Promise<string> {
  // 从数据库获取用户自定义模板
  const template = await getTemplate('edit_success', lottery.createdBy)
  
  // 构建参与条件文本 - 使用可点击链接
  const joinCondition = lottery.channels && lottery.channels.length > 0
    ? generateJoinConditionText(lottery.channels)
    : '无需加入频道/群组'
  
  // 构建奖品列表
  const goodsList = lottery.prizes && lottery.prizes.length > 0
    ? lottery.prizes.map((p) => `💰 ${p.name} × ${p.total}`).join('\n')
    : '暂无奖品'
  
  // 构建开奖条件
  const drawTime = lottery.drawTime 
    ? new Date(lottery.drawTime).toLocaleString('zh-CN')
    : ''
  const openCondition = lottery.drawType === 'time' 
    ? `${drawTime} 自动开奖` 
    : `满 ${lottery.drawCount} 人开奖`
  
  const lotteryLink = `https://t.me/${botUsername}?start=lottery_${lottery.id}`
  
  return replaceAllPlaceholders(template, {
    lotterySn: lottery.id.slice(0, 8),
    lotteryTitle: lottery.title,
    lotteryDesc: lottery.description || '',
    creator: lottery.creatorUsername ? `@${lottery.creatorUsername}` : '',
    joinCondition,
    goodsList,
    openCondition,
    drawTime,
    joinNum: lottery._count?.participants || 0,
    lotteryLink,
  })
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
  const message = await buildPublishMessage(lottery, botUsername)

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
    description?: string | null
    drawType: string
    drawTime: Date | null
    drawCount: number | null
    requireChannels: string[]
    channels?: Array<{ chatId: string; title: string; username?: string | null; inviteLink?: string | null }>
    prizes: Array<{ name: string; total: number }>
  }, 
  creatorId: string
) {
  // 使用与推送相同的模板
  const botUsername = await getBotUsername()
  const message = await buildPublishMessage({
    id: lottery.id,
    title: lottery.title,
    description: lottery.description,
    drawType: lottery.drawType,
    drawTime: lottery.drawTime,
    drawCount: lottery.drawCount,
    createdBy: creatorId,
    channels: lottery.channels,
    prizes: lottery.prizes,
    _count: {
      participants: 0
    }
  }, botUsername)

  try {
    await sendMessage(parseInt(creatorId), message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📢 推送到参与条件群', callback_data: `push_lottery_${lottery.id}` },
            { text: '👁 查看抽奖', callback_data: `view_lottery_${lottery.id}` }
          ],
          [
            { text: '⚙️ 管理抽奖', callback_data: `manage_lottery_${lottery.id}` },
            { text: '📋 抽奖列表', callback_data: 'lottery_list' }
          ]
        ]
      }
    })
  } catch (error) {
    console.error('Failed to send create success message:', error)
  }
}

// 自动推送到所有公告群/频道
export async function autoPushToAnnouncementChannels(lotteryId: string, createdBy: string) {
  try {
    // Get all announcement channels
    const channels = await prisma.announcementChannel.findMany({
      orderBy: { createdAt: 'desc' }
    })
    
    if (channels.length === 0) {
      console.log('No announcement channels configured')
      return []
    }

    // Push to each channel
    const results = []
    for (const channel of channels) {
      try {
        await publishLottery(lotteryId, channel.chatId, createdBy)
        results.push({ 
          chatId: channel.chatId, 
          title: channel.title,
          success: true 
        })
      } catch (error) {
        console.error(`Failed to push to channel ${channel.chatId}:`, error)
        results.push({ 
          chatId: channel.chatId, 
          title: channel.title,
          success: false, 
          error: String(error) 
        })
      }
    }

    // Log summary
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    console.log(`Auto-push complete: ${successCount} succeeded, ${failCount} failed`)

    return results
  } catch (error) {
    console.error('Error auto-pushing to announcement channels:', error)
    return []
  }
}
