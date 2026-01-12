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
    const order = await prisma.paymentOrder.findUnique({
      where: { id },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (action === 'confirm_payment') {
      // 确认支付
      const now = new Date()
      
      // 获取续费规则信息
      let rule = null
      if (order.ruleId) {
        rule = await prisma.renewalRule.findUnique({
          where: { id: order.ruleId }
        })
        
        if (!rule) {
          return NextResponse.json({ 
            error: 'Renewal rule not found' 
          }, { status: 404 })
        }
      } else {
        return NextResponse.json({ 
          error: 'Order has no associated renewal rule' 
        }, { status: 400 })
      }

      // 更新订单状态
      const updatedOrder = await prisma.paymentOrder.update({
        where: { id },
        data: {
          status: 'paid',
          paidAt: now,
          remark: remark || null,
        },
      })

      // 根据订单类型更新用户状态
      let expireAt: Date | null = null

      if (rule.days === -1) {
        // 永久
        expireAt = new Date('2099-12-31')
      } else {
        // 计算到期时间
        expireAt = new Date(now.getTime() + rule.days * 24 * 60 * 60 * 1000)
      }

      const existingUser = await prisma.user.findUnique({
        where: { telegramId: order.telegramId },
      })

      if (existingUser) {
        // 根据 targetRole 更新不同的字段
        const updateData: any = {}
        
        if (rule.targetRole === 'vip') {
          let newExpireAt = expireAt
          if (existingUser.isVip && existingUser.vipExpireAt && rule.days !== -1) {
            const currentExpire = new Date(existingUser.vipExpireAt)
            if (currentExpire > now) {
              newExpireAt = new Date(currentExpire.getTime() + rule.days * 24 * 60 * 60 * 1000)
            }
          }
          updateData.isVip = true
          updateData.vipExpireAt = newExpireAt
        } else if (rule.targetRole === 'admin') {
          let newExpireAt = expireAt
          if (existingUser.isAdmin && existingUser.adminExpireAt && rule.days !== -1) {
            const currentExpire = new Date(existingUser.adminExpireAt)
            if (currentExpire > now) {
              newExpireAt = new Date(currentExpire.getTime() + rule.days * 24 * 60 * 60 * 1000)
            }
          }
          updateData.isAdmin = true
          updateData.adminExpireAt = newExpireAt
        } else if (rule.targetRole === 'user') {
          let newExpireAt = expireAt
          if (existingUser.isPaid && existingUser.paidExpireAt && rule.days !== -1) {
            const currentExpire = new Date(existingUser.paidExpireAt)
            if (currentExpire > now) {
              newExpireAt = new Date(currentExpire.getTime() + rule.days * 24 * 60 * 60 * 1000)
            }
          }
          updateData.isPaid = true
          updateData.paidExpireAt = newExpireAt
        }

        await prisma.user.update({
          where: { telegramId: order.telegramId },
          data: updateData,
        })
      } else {
        // 创建新用户
        const createData: any = {
          telegramId: order.telegramId,
        }

        if (rule.targetRole === 'vip') {
          createData.isVip = true
          createData.vipExpireAt = expireAt
        } else if (rule.targetRole === 'admin') {
          createData.isAdmin = true
          createData.adminExpireAt = expireAt
        } else if (rule.targetRole === 'user') {
          createData.isPaid = true
          createData.paidExpireAt = expireAt
        }

        await prisma.user.create({
          data: createData,
        })
      }

      return NextResponse.json(updatedOrder)
    } else if (action === 'cancel') {
      // 取消订单
      const updatedOrder = await prisma.paymentOrder.update({
        where: { id },
        data: {
          status: 'cancelled',
          remark: remark || null,
        },
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
