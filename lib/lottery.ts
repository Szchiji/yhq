import { prisma } from './prisma'
import { sendMessage, replaceTemplateVariables } from './telegram'

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
