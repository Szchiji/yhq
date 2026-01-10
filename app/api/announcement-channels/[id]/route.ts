import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'

// DELETE - 删除公告群/频道
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

    // 验证用户是否为超管
    const superAdminId = process.env.SUPER_ADMIN_ID
    if (user.id.toString() !== superAdminId) {
      return NextResponse.json({ error: 'Unauthorized: Only super admin can delete announcement channels' }, { status: 403 })
    }

    // 删除公告频道记录
    await prisma.announcementChannel.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting announcement channel:', error)
    
    // Handle record not found
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Announcement channel not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to delete announcement channel' }, { status: 500 })
  }
}
