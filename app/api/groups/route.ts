import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

// GET - 获取已加入的群/频道列表
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

    // Get groups for this user
    const groups = await prisma.userGroup.findMany({
      where: { userId: dbUser.id },
      orderBy: { joinedAt: 'desc' }
    })

    return NextResponse.json({ data: groups })
  } catch (error) {
    console.error('Error fetching groups:', error)
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
  }
}

// POST - 添加群/频道
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chatId, title, type, username, memberCount } = body
    
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

    // Create or update group
    const group = await prisma.userGroup.upsert({
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
        memberCount: memberCount || 0,
        status: 'active'
      },
      create: {
        userId: dbUser.id,
        chatId,
        title,
        type,
        username: username || null,
        memberCount: memberCount || 0,
        status: 'active'
      }
    })

    return NextResponse.json(group, { status: 201 })
  } catch (error: any) {
    console.error('Error adding group:', error)
    return NextResponse.json({ error: 'Failed to add group' }, { status: 500 })
  }
}
