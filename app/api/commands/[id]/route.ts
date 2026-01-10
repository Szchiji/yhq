import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isSuperAdmin, isAdmin } from '@/lib/auth'

// DELETE - 删除命令
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
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

    // 检查是否是管理员或超级管理员
    const userId = user.id.toString()
    const userIsAdmin = await isAdmin(userId)
    const userIsSuperAdmin = isSuperAdmin(userId)

    if (!userIsAdmin && !userIsSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 })
    }

    // 删除命令记录
    await prisma.botCommand.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting command:', error)
    
    // Handle record not found
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Command not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to delete command' }, { status: 500 })
  }
}
