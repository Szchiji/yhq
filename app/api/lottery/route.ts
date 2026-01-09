import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { sendCreateSuccessMessage, autoPushToAnnouncementChannels } from '@/lib/lottery'

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
          channels: true,
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
    const { lottery } = body
    
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
        publishTemplate: lottery.publishTemplate || '🎉 {lotteryTitle}\n\n{lotteryDesc}\n\n🎁 奖品：{goodsList}\n👥 参与条件：{joinCondition}\n⏰ 开奖条件：{openCondition}\n\n当前参与：{joinNum} 人',
        createdBy: user.id.toString(),
        prizes: {
          create: (lottery.prizes || []).map((prize: any) => ({
            name: prize.name,
            total: prize.total,
            remaining: prize.total,
          })),
        },
        channels: {
          create: (lottery.channels || []).map((channel: any) => ({
            chatId: channel.chatId,
            title: channel.title,
            type: channel.type,
            username: channel.username,
          })),
        },
      },
      include: {
        prizes: true,
        channels: true,
      },
    })

    // 发送创建成功消息到创建者的 Telegram
    try {
      await sendCreateSuccessMessage(createdLottery, user.id.toString())
    } catch (error) {
      console.error('Failed to send create success message:', error)
      // Don't fail the request if notification fails
    }

    // 自动推送到所有公告群/频道
    let pushResults: Array<{ chatId: string; title: string; success: boolean; error?: string }> = []
    try {
      pushResults = await autoPushToAnnouncementChannels(createdLottery.id, user.id.toString())
    } catch (error) {
      console.error('Failed to auto-push to announcement channels:', error)
      // Don't fail the request if auto-push fails
    }

    return NextResponse.json({
      lottery: createdLottery,
      pushResults,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating lottery:', error)
    return NextResponse.json({ error: 'Failed to create lottery' }, { status: 500 })
  }
}
