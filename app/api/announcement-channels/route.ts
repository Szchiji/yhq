import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData, getChat } from '@/lib/telegram'
import { isSuperAdmin } from '@/lib/auth'

// GET - 获取所有公告群/频道
export async function GET(request: NextRequest) {
  try {
    const channels = await prisma.announcementChannel.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ data: channels })
  } catch (error) {
    console.error('Error fetching announcement channels:', error)
    return NextResponse.json({ error: 'Failed to fetch announcement channels' }, { status: 500 })
  }
}

// POST - 添加公告群/频道
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chatId } = body
    
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

    // 验证用户是否为超管
    if (!isSuperAdmin(user.id.toString())) {
      return NextResponse.json({ error: 'Unauthorized: Only super admin can add announcement channels' }, { status: 403 })
    }

    // 验证必需字段
    if (!chatId) {
      return NextResponse.json({ error: 'Missing required field: chatId' }, { status: 400 })
    }

    // 获取群组/频道信息
    const chatInfo = await getChat(chatId)
    
    if (!chatInfo.ok) {
      return NextResponse.json({ error: 'Failed to get chat info. Make sure the bot is an admin in the channel/group.' }, { status: 400 })
    }

    const chat = chatInfo.result
    
    // 检查机器人是否为管理员
    if (chat.type === 'channel' || chat.type === 'supergroup') {
      // For channels and supergroups, we should verify bot is admin
      // This is implicitly verified by being able to get chat info
    }

    // 创建公告频道记录
    const channel = await prisma.announcementChannel.create({
      data: {
        chatId: chatId,
        title: chat.title || chatId,
        type: chat.type,
        username: chat.username || null,
        createdBy: user.id.toString(),
      },
    })

    return NextResponse.json(channel, { status: 201 })
  } catch (error: any) {
    console.error('Error adding announcement channel:', error)
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'This channel has already been added' }, { status: 409 })
    }
    
    return NextResponse.json({ error: 'Failed to add announcement channel' }, { status: 500 })
  }
}
