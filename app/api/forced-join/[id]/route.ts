import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

// PUT - 更新强制加入群/频道
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { title, type, username, inviteLink, isRequired, isEnabled, sortOrder } = body
    
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
    if (type !== undefined) updateData.type = type
    if (username !== undefined) updateData.username = username
    if (inviteLink !== undefined) updateData.inviteLink = inviteLink
    if (isRequired !== undefined) updateData.isRequired = isRequired
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder

    const channel = await prisma.forcedJoinChannel.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json(channel)
  } catch (error: any) {
    console.error('Error updating forced join channel:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to update forced join channel' }, { status: 500 })
  }
}

// DELETE - 删除强制加入群/频道
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

    await prisma.forcedJoinChannel.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting forced join channel:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to delete forced join channel' }, { status: 500 })
  }
}
