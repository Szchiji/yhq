import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'
import { notifyUserOrderRejected } from '@/lib/orderManagement'

/**
 * PUT - 拒绝订单
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { reason } = body
    
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

    const adminId = user.id.toString()

    // 验证用户是否为管理员或超级管理员
    const isAdminUser = await isAdmin(adminId)
    if (!isAdminUser) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 })
    }

    // 获取订单
    const order = await prisma.order.findUnique({
      where: { id }
    })

    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    if (order.status !== 'pending') {
      return NextResponse.json({ error: '订单已处理' }, { status: 400 })
    }

    // 更新订单状态
    await prisma.order.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectReason: reason || '未收到付款或付款金额不符'
      }
    })

    // 通知用户
    await notifyUserOrderRejected(order, reason)

    return NextResponse.json({ success: true, message: '订单已拒绝' })
  } catch (error: any) {
    console.error('Error rejecting order:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }
    
    return NextResponse.json({ error: '拒绝订单失败' }, { status: 500 })
  }
}
