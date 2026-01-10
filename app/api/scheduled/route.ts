import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

// GET - 获取定时消息列表
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

    // Get scheduled messages for this user
    const messages = await prisma.scheduledMessage.findMany({
      where: { userId: dbUser.id },
      orderBy: { scheduledAt: 'desc' }
    })

    return NextResponse.json({ data: messages })
  } catch (error) {
    console.error('Error fetching scheduled messages:', error)
    return NextResponse.json({ error: 'Failed to fetch scheduled messages' }, { status: 500 })
  }
}

// POST - 创建定时消息
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content, mediaType, mediaUrl, targetType, targetChatId, scheduledAt, repeatType } = body
    
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
    if (!title || !content || !targetType || !scheduledAt) {
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

    // Create scheduled message
    const message = await prisma.scheduledMessage.create({
      data: {
        userId: dbUser.id,
        title,
        content,
        mediaType: mediaType || 'none',
        mediaUrl: mediaUrl || null,
        targetType,
        targetChatId: targetChatId || null,
        scheduledAt: new Date(scheduledAt),
        repeatType: repeatType || 'once',
        status: 'pending'
      }
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error: any) {
    console.error('Error creating scheduled message:', error)
    return NextResponse.json({ error: 'Failed to create scheduled message' }, { status: 500 })
  }
}
