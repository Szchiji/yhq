import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'

// GET - 获取抽奖列表（支持分页和筛选）
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const createdBy = searchParams.get('createdBy')

    const where: any = {}
    if (status) {
      where.status = status
    }
    if (createdBy) {
      where.createdBy = createdBy
    }

    const [lotteries, total] = await Promise.all([
      prisma.lottery.findMany({
        where,
        include: {
          prizes: true,
          _count: {
            select: {
              participants: true,
              winners: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lottery.count({ where }),
    ])

    return NextResponse.json({
      data: lotteries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching lotteries:', error)
    return NextResponse.json({ error: 'Failed to fetch lotteries' }, { status: 500 })
  }
}

// POST - 创建新抽奖
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { initData, lottery } = body

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

    // 验证必需字段
    if (!lottery.title || !lottery.drawType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 验证开奖设置
    if (lottery.drawType === 'time' && !lottery.drawTime) {
      return NextResponse.json({ error: 'drawTime is required for time-based lottery' }, { status: 400 })
    }
    if (lottery.drawType === 'count' && !lottery.drawCount) {
      return NextResponse.json({ error: 'drawCount is required for count-based lottery' }, { status: 400 })
    }

    // 创建抽奖
    const createdLottery = await prisma.lottery.create({
      data: {
        title: lottery.title,
        description: lottery.description,
        mediaType: lottery.mediaType || 'none',
        mediaUrl: lottery.mediaUrl,
        participationMethod: lottery.participationMethod || 'private',
        keyword: lottery.keyword,
        requireUsername: lottery.requireUsername || false,
        requireChannels: lottery.requireChannels || [],
        drawType: lottery.drawType,
        drawTime: lottery.drawTime ? new Date(lottery.drawTime) : null,
        drawCount: lottery.drawCount,
        winnerNotification: lottery.winnerNotification || '恭喜 {member}！您中奖了：{goodsName}',
        creatorNotification: lottery.creatorNotification || '抽奖"{lotteryTitle}"已开奖，中奖用户已通知。',
        groupNotification: lottery.groupNotification || '抽奖结果已公布！中奖名单：{awardUserList}',
        createdBy: user.id.toString(),
        prizes: {
          create: (lottery.prizes || []).map((prize: any) => ({
            name: prize.name,
            total: prize.total,
            remaining: prize.total,
          })),
        },
      },
      include: {
        prizes: true,
      },
    })

    return NextResponse.json(createdLottery, { status: 201 })
  } catch (error) {
    console.error('Error creating lottery:', error)
    return NextResponse.json({ error: 'Failed to create lottery' }, { status: 500 })
  }
}
