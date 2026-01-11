import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

// GET /api/winners - 获取中奖记录列表
export async function GET(request: NextRequest) {
  try {
    // Get initData from header
    const initData = request.headers.get('x-telegram-init-data')
    
    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 })
    }

    // 验证 Telegram WebApp 数据
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

    // 验证用户是否为管理员
    if (!(await isAdmin(user.id.toString()))) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const lotteryId = searchParams.get('lotteryId')
    const userId = searchParams.get('userId')
    const telegramId = searchParams.get('telegramId')
    const status = searchParams.get('status') // claimed/unclaimed
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}
    
    if (lotteryId) where.lotteryId = lotteryId
    if (userId) where.userId = userId
    if (telegramId) where.telegramId = { contains: telegramId }
    if (status === 'claimed') where.claimed = true
    if (status === 'unclaimed') where.claimed = false
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    const [winners, total] = await Promise.all([
      prisma.winner.findMany({
        where,
        include: {
          user: true,
          lottery: {
            select: {
              id: true,
              title: true,
              status: true,
            }
          },
          prize: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.winner.count({ where })
    ])

    return NextResponse.json({ 
      winners, 
      total, 
      page, 
      limit,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Error fetching winners:', error)
    return NextResponse.json({ error: 'Failed to fetch winners' }, { status: 500 })
  }
}
