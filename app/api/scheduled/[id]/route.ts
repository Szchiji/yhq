import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

// PUT - 更新定时消息
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { title, content, mediaType, mediaUrl, targetType, targetChatId, scheduledAt, repeatType, status } = body
    
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

    // Build update data
    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (mediaType !== undefined) updateData.mediaType = mediaType
    if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl
    if (targetType !== undefined) updateData.targetType = targetType
    if (targetChatId !== undefined) updateData.targetChatId = targetChatId
    if (scheduledAt !== undefined) updateData.scheduledAt = new Date(scheduledAt)
    if (repeatType !== undefined) updateData.repeatType = repeatType
    if (status !== undefined) updateData.status = status

    const message = await prisma.scheduledMessage.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json(message)
  } catch (error: any) {
    console.error('Error updating scheduled message:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to update scheduled message' }, { status: 500 })
  }
}

// DELETE - 删除定时消息
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    await prisma.scheduledMessage.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting scheduled message:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to delete scheduled message' }, { status: 500 })
  }
}

// POST - 取消定时消息
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { action } = body
    
    if (action !== 'cancel') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

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

    // Update status to cancelled
    const message = await prisma.scheduledMessage.update({
      where: { id: params.id },
      data: { status: 'cancelled' }
    })

    return NextResponse.json(message)
  } catch (error: any) {
    console.error('Error cancelling scheduled message:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to cancel scheduled message' }, { status: 500 })
  }
}
