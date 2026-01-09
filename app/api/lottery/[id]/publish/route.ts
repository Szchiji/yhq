import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { publishLottery } from '@/lib/lottery'

type Params = {
  params: {
    id: string
  }
}

// POST - 推送抽奖到群组/频道
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const body = await request.json()
    const { initData, chatId, force } = body

    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId' }, { status: 400 })
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

    // 检查抽奖是否存在
    const lottery = await prisma.lottery.findUnique({
      where: { id: params.id },
    })

    if (!lottery) {
      return NextResponse.json({ error: 'Lottery not found' }, { status: 404 })
    }

    if (lottery.createdBy !== user.id.toString()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 1. 检查是否已推送过
    const existingPublish = await prisma.lotteryPublish.findFirst({
      where: {
        lotteryId: params.id,
        chatId
      },
      orderBy: {
        publishedAt: 'desc'
      }
    })

    // 2. 如果已推送且 force !== true，返回警告
    if (existingPublish && !force) {
      return NextResponse.json({
        ok: false,
        warning: 'already_published',
        existingPublish: {
          publishedAt: existingPublish.publishedAt,
          chatTitle: existingPublish.chatTitle
        },
        message: `该抽奖已于 ${existingPublish.publishedAt.toLocaleString('zh-CN')} 推送到「${existingPublish.chatTitle}」`
      })
    }

    // 3. 执行推送
    const result = await publishLottery(params.id, chatId, user.id.toString())

    if (!result.ok) {
      return NextResponse.json({
        error: 'Failed to publish lottery',
        message: result.description || '推送失败'
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: '推送成功'
    })
  } catch (error) {
    console.error('Error publishing lottery:', error)
    return NextResponse.json({
      error: 'Failed to publish lottery',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
