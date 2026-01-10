import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateTelegramWebAppData, parseTelegramUser } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

// GET /api/orders - List all orders
export async function GET(request: NextRequest) {
  const initData = request.headers.get('x-init-data')
  
  if (!initData) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const botToken = process.env.BOT_TOKEN
  if (!botToken || !validateTelegramWebAppData(initData, botToken)) {
    return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 })
  }

  const user = parseTelegramUser(initData)
  if (!user) {
    return NextResponse.json({ error: 'Invalid user data' }, { status: 401 })
  }

  try {
    // Check if user is admin
    if (!(await isAdmin(String(user.id)))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const status = searchParams.get('status')

    const where: any = {}
    if (status) {
      where.status = status
    }

    const [orders, total] = await Promise.all([
      prisma.vipOrder.findMany({
        where,
        include: {
          plan: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vipOrder.count({ where })
    ])

    return NextResponse.json({
      data: orders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

// POST /api/orders - Create a new order (admin manually creates VIP for user)
export async function POST(request: NextRequest) {
  const initData = request.headers.get('x-init-data')
  
  if (!initData) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const botToken = process.env.BOT_TOKEN
  if (!botToken || !validateTelegramWebAppData(initData, botToken)) {
    return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 })
  }

  const user = parseTelegramUser(initData)
  if (!user) {
    return NextResponse.json({ error: 'Invalid user data' }, { status: 401 })
  }

  try {
    // Check if user is admin
    if (!(await isAdmin(String(user.id)))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { telegramId, planId, remark } = body

    if (!telegramId || !planId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get plan details
    const plan = await prisma.vipPlan.findUnique({
      where: { id: planId }
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Generate order number
    const orderNo = `VIP${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Calculate expiration date
    let expireAt: Date | null = null
    if (plan.days > 0) {
      expireAt = new Date()
      expireAt.setDate(expireAt.getDate() + plan.days)
    }

    // Create order
    const order = await prisma.vipOrder.create({
      data: {
        orderNo,
        telegramId,
        planId,
        amount: plan.price,
        currency: plan.currency,
        status: 'paid',
        paidAt: new Date(),
        expireAt,
        remark: remark || null,
        createdBy: String(user.id),
      }
    })

    // Update user VIP status
    const targetUser = await prisma.user.findUnique({
      where: { telegramId }
    })

    if (targetUser) {
      await prisma.user.update({
        where: { telegramId },
        data: {
          isVip: true,
          vipExpireAt: expireAt,
          vipPlanId: planId,
        }
      })
    } else {
      // Create user if not exists
      await prisma.user.create({
        data: {
          telegramId,
          isVip: true,
          vipExpireAt: expireAt,
          vipPlanId: planId,
        }
      })
    }

    return NextResponse.json({ data: order })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
