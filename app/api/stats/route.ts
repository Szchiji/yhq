import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateTelegramWebAppData, parseTelegramUser, isAdmin, isSuperAdmin } from '@/lib/telegram'

// Helper function to get daily statistics
async function getDailyStats(days: number) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  // Execute all queries in parallel for better performance
  const [dailyUsers, dailyParticipants, dailyLotteries] = await Promise.all([
    // Get daily new users
    prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE("createdAt") as date, COUNT(*) as count
      FROM "User"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY date
    `,
    // Get daily participants
    prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE("joinedAt") as date, COUNT(*) as count
      FROM "Participant"
      WHERE "joinedAt" >= ${startDate}
      GROUP BY DATE("joinedAt")
      ORDER BY date
    `,
    // Get daily created lotteries
    prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE("createdAt") as date, COUNT(*) as count
      FROM "Lottery"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY date
    `
  ])

  return {
    dailyUsers: dailyUsers.map(item => ({ date: item.date, count: Number(item.count) })),
    dailyParticipants: dailyParticipants.map(item => ({ date: item.date, count: Number(item.count) })),
    dailyLotteries: dailyLotteries.map(item => ({ date: item.date, count: Number(item.count) })),
  }
}

// GET /api/stats - Get statistics data
export async function GET(request: NextRequest) {
  try {
    // Get initData from header
    const initData = request.headers.get('x-telegram-init-data')
    
    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 })
    }

    // Validate Telegram WebApp data
    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 })
    }

    if (!validateTelegramWebAppData(initData, botToken)) {
      return NextResponse.json({ error: 'Invalid Telegram data' }, { status: 401 })
    }

    const user = parseTelegramUser(initData)
    if (!user) {
      return NextResponse.json({ error: 'Invalid user data' }, { status: 401 })
    }

    // Check if user is admin
    const telegramId = user.id.toString()
    const userIsSuperAdmin = isSuperAdmin(telegramId)
    const userIsAdmin = await isAdmin(telegramId)

    if (!userIsAdmin && !userIsSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get statistics data
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      totalLotteries,
      totalParticipants,
      totalUsers,
      todayUsers,
      recentLotteries,
      recentWinners,
      dailyStats
    ] = await Promise.all([
      prisma.lottery.count(),
      prisma.participant.count(),
      prisma.user.count(),
      prisma.user.count({
        where: {
          createdAt: {
            gte: todayStart
          }
        }
      }),
      prisma.lottery.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              participants: true
            }
          }
        }
      }),
      prisma.winner.findMany({
        take: 5,
        orderBy: { wonAt: 'desc' },
        include: {
          lottery: {
            select: {
              title: true
            }
          }
        }
      }),
      getDailyStats(30)
    ])

    return NextResponse.json({
      totalLotteries,
      totalParticipants,
      totalUsers,
      todayUsers,
      recentLotteries,
      recentWinners,
      dailyStats
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
