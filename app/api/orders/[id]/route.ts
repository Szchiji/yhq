import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

// PATCH - 确认支付/更新订单
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { action, remark } = body
    
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

    // 获取订单
    const order = await prisma.vipOrder.findUnique({
      where: { id },
      include: { plan: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (action === 'confirm_payment') {
      // 确认支付
      const now = new Date()
      let expireAt: Date | null = null

      if (order.plan.days === -1) {
        // 永久VIP
        expireAt = new Date('2099-12-31')
      } else {
        // 计算到期时间
        expireAt = new Date(now.getTime() + order.plan.days * 24 * 60 * 60 * 1000)
      }

      // 更新订单状态
      const updatedOrder = await prisma.vipOrder.update({
        where: { id },
        data: {
          status: 'paid',
          paidAt: now,
          expireAt,
          remark: remark || null,
        },
        include: { plan: true },
      })

      // 更新用户VIP状态
      const existingUser = await prisma.user.findUnique({
        where: { telegramId: order.telegramId },
      })

      if (existingUser) {
        // 如果用户已经是VIP，延长时间
        let newExpireAt = expireAt
        if (existingUser.isVip && existingUser.vipExpireAt && order.plan.days !== -1) {
          const currentExpire = new Date(existingUser.vipExpireAt)
          if (currentExpire > now) {
            // 在当前到期时间基础上延长
            newExpireAt = new Date(currentExpire.getTime() + order.plan.days * 24 * 60 * 60 * 1000)
          }
        }

        await prisma.user.update({
          where: { telegramId: order.telegramId },
          data: {
            isVip: true,
            vipExpireAt: newExpireAt,
          },
        })
      } else {
        // 创建新用户
        await prisma.user.create({
          data: {
            telegramId: order.telegramId,
            isVip: true,
            vipExpireAt: expireAt,
          },
        })
      }

      return NextResponse.json(updatedOrder)
    } else if (action === 'cancel') {
      // 取消订单
      const updatedOrder = await prisma.vipOrder.update({
        where: { id },
        data: {
          status: 'cancelled',
          remark: remark || null,
        },
        include: { plan: true },
      })

      return NextResponse.json(updatedOrder)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error updating order:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
