import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

// GET - 获取强制加入群/频道列表
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

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { telegramId: user.id.toString() }
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get forced join channels for this user
    const channels = await prisma.forcedJoinChannel.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ data: channels })
  } catch (error) {
    console.error('Error fetching forced join channels:', error)
    return NextResponse.json({ error: 'Failed to fetch forced join channels' }, { status: 500 })
  }
}

// POST - 添加强制加入群/频道
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chatId, title, type, username, inviteLink, isRequired, isEnabled } = body
    
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

    // 验证必需字段
    if (!chatId || !title || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get or create user
    let dbUser = await prisma.user.findUnique({
      where: { telegramId: user.id.toString() }
    })

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          telegramId: user.id.toString(),
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
        }
      })
    }

    // Create or update forced join channel
    const channel = await prisma.forcedJoinChannel.upsert({
      where: {
        userId_chatId: {
          userId: dbUser.id,
          chatId: chatId
        }
      },
      update: {
        title,
        type,
        username: username || null,
        inviteLink: inviteLink || null,
        isRequired: isRequired !== undefined ? isRequired : true,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
      },
      create: {
        userId: dbUser.id,
        chatId,
        title,
        type,
        username: username || null,
        inviteLink: inviteLink || null,
        isRequired: isRequired !== undefined ? isRequired : true,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
      }
    })

    return NextResponse.json(channel, { status: 201 })
  } catch (error: any) {
    console.error('Error adding forced join channel:', error)
    return NextResponse.json({ error: 'Failed to add forced join channel' }, { status: 500 })
  }
}
