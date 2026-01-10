import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin, isSuperAdmin } from '@/lib/auth'

// Permanent subscription expiry date
const PERMANENT_EXPIRY = new Date('2099-12-31T23:59:59Z')

// PUT - 确认付款
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { action } = body
    
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

    // Get the order
    const order = await prisma.paymentOrder.findUnique({
      where: { id: params.id }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (action === 'confirm') {
      // Confirm payment - only super admin can do this
      if (!isSuperAdmin(user.id.toString())) {
        return NextResponse.json({ error: 'Unauthorized: Super admin access required' }, { status: 403 })
      }

      // Update order status
      const updatedOrder = await prisma.paymentOrder.update({
        where: { id: params.id },
        data: {
          status: 'paid',
          paidAt: new Date()
        }
      })

      // Update user's role and expiry based on order type
      const targetUser = await prisma.user.findUnique({
        where: { telegramId: order.telegramId }
      })

      if (targetUser) {
        let updateData: any = {}
        
        // Get the renewal rule if exists
        let expiryDate = new Date()
        if (order.ruleId) {
          const rule = await prisma.renewalRule.findUnique({
            where: { id: order.ruleId }
          })
          if (rule) {
            if (rule.days === -1) {
              // Permanent subscription
              expiryDate = new Date(PERMANENT_EXPIRY)
            } else {
              expiryDate.setDate(expiryDate.getDate() + rule.days)
            }
          }
        }

        if (order.orderType === 'user_renewal') {
          updateData = {
            isPaid: true,
            paidExpireAt: expiryDate,
            canJoinLottery: true
          }
        } else if (order.orderType === 'vip_purchase') {
          updateData = {
            role: 'VIP',
            isVip: true,
            vipExpireAt: expiryDate,
            canCreateLottery: true,
            canJoinLottery: true
          }
        } else if (order.orderType === 'admin_purchase') {
          updateData = {
            role: 'ADMIN',
            isAdmin: true,
            adminExpireAt: expiryDate,
            canCreateLottery: true,
            canJoinLottery: true
          }
        }

        await prisma.user.update({
          where: { id: targetUser.id },
          data: updateData
        })
      }

      return NextResponse.json(updatedOrder)
    } else if (action === 'cancel') {
      // Cancel order
      const updatedOrder = await prisma.paymentOrder.update({
        where: { id: params.id },
        data: {
          status: 'cancelled'
        }
      })

      return NextResponse.json(updatedOrder)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error processing payment order:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to process payment order' }, { status: 500 })
  }
}
