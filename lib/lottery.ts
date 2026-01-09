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

// 推送抽奖消息
export async function publishLottery(lotteryId: string, chatId: string, publishedBy: string) {
  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: { prizes: true, participants: true }
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
  const goodsList = lottery.prizes.map(p => `${p.name} x${p.total}`).join(', ')
  const joinCondition = lottery.requireUsername 
    ? '需要设置用户名' 
    : (lottery.requireChannels && lottery.requireChannels.length > 0 
        ? '需要加入指定频道/群组' 
        : '无限制')
  const openCondition = lottery.drawType === 'time' 
    ? `${lottery.drawTime?.toLocaleString('zh-CN')} 定时开奖` 
    : `满 ${lottery.drawCount} 人开奖`

  const message = replaceTemplateVariables(lottery.publishTemplate || 
    '🎉 {lotteryTitle}\n\n{lotteryDesc}\n\n🎁 奖品：{goodsList}\n👥 参与条件：{joinCondition}\n⏰ 开奖条件：{openCondition}\n\n当前参与：{joinNum} 人', {
    lotteryTitle: lottery.title,
    lotteryDesc: lottery.description || '',
    goodsList,
    joinCondition,
    openCondition,
    joinNum: lottery.participants.length.toString()
  })

  // 发送消息
  const botUsername = await getBotUsername()
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
export async function sendCreateSuccessMessage(lottery: any, creatorId: string) {
  const goodsList = lottery.prizes.map((p: any) => `${p.name} x${p.total}`).join(', ')
  const openCondition = lottery.drawType === 'time' 
    ? `定时开奖: ${new Date(lottery.drawTime).toLocaleString('zh-CN')}` 
    : `满 ${lottery.drawCount} 人开奖`

  const message = `✅ 抽奖创建成功！

📋 标题：${lottery.title}
🎁 奖品：${goodsList}
👥 开奖：${openCondition}
📅 创建：${new Date().toLocaleString('zh-CN')}

请选择推送到哪个群组/频道：`

  // 构建推送按钮
  const buttons = []
  if (lottery.requireChannels && lottery.requireChannels.length > 0) {
    for (let i = 0; i < lottery.requireChannels.length; i++) {
      const chatId = lottery.requireChannels[i]
      buttons.push([{
        text: `📢 推送到: 群组${i + 1}`,
        callback_data: `publish_${lottery.id}_${chatId}`
      }])
    }

    // 添加推送全部按钮
    if (lottery.requireChannels.length > 1) {
      buttons.push([{
        text: '📢 推送到全部',
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
