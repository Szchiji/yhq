import { NextRequest, NextResponse } from 'next/server'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { executeDraw } from '@/lib/lottery'
import { prisma } from '@/lib/prisma'

type Params = {
  params: {
    id: string
  }
}

// POST - 手动开奖
export async function POST(request: NextRequest, { params }: Params) {
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
    const lottery = await prisma.lottery.findUnique({
      where: { id: params.id },
    })

    if (!lottery) {
      return NextResponse.json({ error: 'Lottery not found' }, { status: 404 })
    }

    if (lottery.createdBy !== user.id.toString()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (lottery.status !== 'active') {
      return NextResponse.json({ error: 'Lottery is not active' }, { status: 400 })
    }

    // 执行开奖
    const winners = await executeDraw(params.id)

    return NextResponse.json({ 
      success: true,
      winners,
      message: '开奖成功！'
    })
  } catch (error) {
    console.error('Error drawing lottery:', error)
    return NextResponse.json({ 
      error: 'Failed to draw lottery',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
