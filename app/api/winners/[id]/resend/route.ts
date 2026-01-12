import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData, sendMessage } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

type RouteParams = {
  params: {
    id: string
  }
}

// POST /api/winners/[id]/resend - 重新发送中奖通知
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const winner = await prisma.winner.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        lottery: {
          select: {
            id: true,
            title: true,
          }
        },
        prize: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    if (!winner) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 })
    }

    // 发送中奖通知
    const message = `🎉 恭喜中奖！

抽奖：${winner.lottery?.title || '未知抽奖'}
奖品：${winner.prize?.name || winner.prizeName}

请联系管理员领取奖品。`

    try {
      await sendMessage(winner.telegramId, message)
      
      // Update notified status
      await prisma.winner.update({
        where: { id: params.id },
        data: { notified: true }
      })

      return NextResponse.json({ success: true, message: '通知已发送' })
    } catch (sendError) {
      console.error('Error sending message:', sendError)
      return NextResponse.json({ 
        error: '发送消息失败，请检查用户是否已屏蔽机器人' 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error resending winner notification:', error)
    return NextResponse.json({ error: 'Failed to resend notification' }, { status: 500 })
  }
}
