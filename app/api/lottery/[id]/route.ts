import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'

type Params = {
  params: {
    id: string
  }
}

// GET - 获取抽奖详情
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const lottery = await prisma.lottery.findUnique({
      where: { id: params.id },
      include: {
        prizes: true,
        channels: true,
        publishes: {
          orderBy: {
            publishedAt: 'desc'
          }
        },
        _count: {
          select: {
            participants: true,
            winners: true,
          },
        },
      },
    })

    if (!lottery) {
      return NextResponse.json({ error: 'Lottery not found' }, { status: 404 })
    }

    return NextResponse.json(lottery)
  } catch (error) {
    console.error('Error fetching lottery:', error)
    return NextResponse.json({ error: 'Failed to fetch lottery' }, { status: 500 })
  }
}

// PUT - 更新抽奖
export async function PUT(request: NextRequest, { params }: Params) {
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

    // 检查抽奖是否存在且用户是创建者
    const existingLottery = await prisma.lottery.findUnique({
      where: { id: params.id },
    })

    if (!existingLottery) {
      return NextResponse.json({ error: 'Lottery not found' }, { status: 404 })
    }

    if (existingLottery.createdBy !== user.id.toString()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (existingLottery.status !== 'active') {
      return NextResponse.json({ error: 'Cannot update non-active lottery' }, { status: 400 })
    }

    // 更新抽奖
    const updatedLottery = await prisma.lottery.update({
      where: { id: params.id },
      data: {
        title: lottery.title,
        description: lottery.description,
        mediaType: lottery.mediaType,
        mediaUrl: lottery.mediaUrl,
        participationMethod: lottery.participationMethod,
        keyword: lottery.keyword,
        requireUsername: lottery.requireUsername,
        requireChannels: lottery.requireChannels,
        drawType: lottery.drawType,
        drawTime: lottery.drawTime ? new Date(lottery.drawTime) : null,
        drawCount: lottery.drawCount,
        winnerNotification: lottery.winnerNotification,
        creatorNotification: lottery.creatorNotification,
        groupNotification: lottery.groupNotification,
        publishTemplate: lottery.publishTemplate,
      },
      include: {
        prizes: true,
      },
    })

    return NextResponse.json(updatedLottery)
  } catch (error) {
    console.error('Error updating lottery:', error)
    return NextResponse.json({ error: 'Failed to update lottery' }, { status: 500 })
  }
}

// DELETE - 删除抽奖
export async function DELETE(request: NextRequest, { params }: Params) {
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

    // 检查抽奖是否存在且用户是创建者
    const existingLottery = await prisma.lottery.findUnique({
      where: { id: params.id },
    })

    if (!existingLottery) {
      return NextResponse.json({ error: 'Lottery not found' }, { status: 404 })
    }

    if (existingLottery.createdBy !== user.id.toString()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 删除抽奖（级联删除相关数据）
    await prisma.lottery.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting lottery:', error)
    return NextResponse.json({ error: 'Failed to delete lottery' }, { status: 500 })
  }
}
