import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData, getChat, exportChatInviteLink } from '@/lib/telegram'
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

    // Get all forced join channels (system-wide)
    const channels = await prisma.forcedJoinChannel.findMany({
      orderBy: { sortOrder: 'asc' }
    })

    return NextResponse.json({ data: channels })
  } catch (error) {
    console.error('Error fetching forced join channels:', error)
    return NextResponse.json({ error: 'Failed to fetch forced join channels' }, { status: 500 })
  }
}

// POST - 添加强制加入群/频道（通过 Chat ID 自动获取信息）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chatId, isRequired, isEnabled } = body
    
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

    // 通过 Telegram API 获取群/频道信息
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

    // Get current max sortOrder
    const maxSortOrder = await prisma.forcedJoinChannel.aggregate({
      _max: { sortOrder: true }
    })
    const nextSortOrder = (maxSortOrder._max.sortOrder || 0) + 1

    // Create or update forced join channel (system-wide)
    const channel = await prisma.forcedJoinChannel.upsert({
      where: {
        chatId: chatId
      },
      update: {
        title,
        type,
        username,
        inviteLink,
        isRequired: isRequired !== undefined ? isRequired : true,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
      },
      create: {
        chatId,
        title,
        type,
        username,
        inviteLink,
        isRequired: isRequired !== undefined ? isRequired : true,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        sortOrder: nextSortOrder
      }
    })

    return NextResponse.json(channel, { status: 201 })
  } catch (error: any) {
    console.error('Error adding forced join channel:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to add forced join channel' 
    }, { status: 500 })
  }
}
