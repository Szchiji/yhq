import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData, getChat, exportChatInviteLink } from '@/lib/telegram'
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

    // Get all groups (system-wide)
    const groups = await prisma.joinedGroup.findMany({
      orderBy: { joinedAt: 'desc' }
    })

    return NextResponse.json({ data: groups })
  } catch (error) {
    console.error('Error fetching groups:', error)
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
  }
}

// POST - 添加群/频道（通过 Chat ID 自动获取信息）
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

    // 验证用户是否为管理员
    if (!(await isAdmin(user.id.toString()))) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 })
    }

    // 验证必需字段
    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 })
    }

    // 通过 Telegram API 获取群信息
    const chatInfo = await getChat(chatId)
    if (!chatInfo.ok) {
      return NextResponse.json({ 
        error: 'Invalid chat ID or bot not authorized to access this chat' 
      }, { status: 400 })
    }

    const chat = chatInfo.result
    const title = chat.title || chat.first_name || 'Unknown'
    const type = chat.type || 'unknown'
    const username = chat.username || null
    const memberCount = chat.members_count || 0

    // 尝试获取邀请链接
    let inviteLink = null
    if (username) {
      inviteLink = `https://t.me/${username}`
    } else {
      try {
        const linkResult = await exportChatInviteLink(chatId)
        if (linkResult.ok && linkResult.result) {
          inviteLink = linkResult.result
        }
      } catch (error) {
        console.warn('Failed to export invite link:', error)
      }
    }

    // Create or update group (system-wide)
    const group = await prisma.joinedGroup.upsert({
      where: {
        chatId: chatId
      },
      update: {
        title,
        type,
        username,
        memberCount,
        inviteLink,
        status: 'active'
      },
      create: {
        chatId,
        title,
        type,
        username,
        memberCount,
        inviteLink,
        status: 'active'
      }
    })

    return NextResponse.json(group, { status: 201 })
  } catch (error: any) {
    console.error('Error adding group:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to add group' 
    }, { status: 500 })
  }
}
