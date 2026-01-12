import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

type RouteParams = {
  params: {
    id: string
  }
}

// PATCH /api/winners/[id] - 更新中奖记录
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json()
    const { claimed } = body

    // Validate input
    if (typeof claimed !== 'boolean') {
      return NextResponse.json({ error: 'Invalid claimed status' }, { status: 400 })
    }

    const winner = await prisma.winner.update({
      where: { id: params.id },
      data: {
        claimed,
        claimedAt: claimed ? new Date() : null,
      },
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

    return NextResponse.json(winner)
  } catch (error: any) {
    console.error('Error updating winner:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Winner not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update winner' }, { status: 500 })
  }
}

// DELETE /api/winners/[id] - 删除中奖记录
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    await prisma.winner.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting winner:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Winner not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to delete winner' }, { status: 500 })
  }
}
