import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'
import { notifyUserOrderConfirmed } from '@/lib/orderManagement'

/**
 * 计算过期时间
 */
function calculateExpireAt(days: number): Date | null {
  if (days === -1) {
    // 永久：设置为2099年
    return new Date('2099-12-31T23:59:59Z')
  }
  const expireAt = new Date()
  expireAt.setDate(expireAt.getDate() + days)
  return expireAt
}

/**
 * 创建或更新管理员记录
 */
async function createOrUpdateAdmin(
  telegramId: string,
  username: string | null,
  firstName: string | null,
  lastName: string | null,
  adminId: string
) {
  await prisma.admin.upsert({
    where: { telegramId },
    create: {
      telegramId,
      username: username || null,
      firstName: firstName || null,
      lastName: lastName || null,
      isActive: true,
      createdBy: adminId
    },
    update: {
      isActive: true
    }
  })
}

/**
 * PUT - 确认订单
 */
export async function PUT(
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

    // 根据目标角色开通权限
    const expireAt = calculateExpireAt(order.days)

    switch (order.targetRole) {
      case 'user':
        // 普通用户付费
        await prisma.user.upsert({
          where: { telegramId: order.userId },
          create: {
            telegramId: order.userId,
            username: order.username,
            firstName: order.firstName,
            isPaid: true,
            paidExpireAt: expireAt
          },
          update: {
            isPaid: true,
            paidExpireAt: expireAt
          }
        })
        break

      case 'vip':
        // VIP
        await prisma.user.upsert({
          where: { telegramId: order.userId },
          create: {
            telegramId: order.userId,
            username: order.username,
            firstName: order.firstName,
            isVip: true,
            vipExpireAt: expireAt
          },
          update: {
            isVip: true,
            vipExpireAt: expireAt
          }
        })
        break

      case 'admin':
        // 管理员
        const existingUser = await prisma.user.findUnique({
          where: { telegramId: order.userId }
        })
        
        if (existingUser) {
          await createOrUpdateAdmin(
            order.userId,
            existingUser.username,
            existingUser.firstName,
            existingUser.lastName,
            adminId
          )
          
          // 更新用户的管理员状态
          await prisma.user.update({
            where: { telegramId: order.userId },
            data: {
              isAdmin: true,
              adminExpireAt: expireAt
            }
          })
        } else {
          // 创建新用户
          await prisma.user.create({
            data: {
              telegramId: order.userId,
              username: order.username,
              firstName: order.firstName,
              isAdmin: true,
              adminExpireAt: expireAt
            }
          })
          
          // 创建管理员记录
          await createOrUpdateAdmin(
            order.userId,
            order.username,
            order.firstName,
            null,
            adminId
          )
        }
        break

      default:
        return NextResponse.json({ error: '未知的角色类型' }, { status: 400 })
    }

    // 更新订单状态
    await prisma.order.update({
      where: { id },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmedBy: adminId
      }
    })

    // 通知用户
    await notifyUserOrderConfirmed(order)

    return NextResponse.json({ success: true, message: '订单已确认' })
  } catch (error: any) {
    console.error('Error confirming order:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }
    
    return NextResponse.json({ error: '确认订单失败' }, { status: 500 })
  }
}
