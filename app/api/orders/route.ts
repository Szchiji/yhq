import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

// GET - 获取所有订单
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('perPage') || '20')
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
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.vipOrder.count({ where }),
    ])

    return NextResponse.json({
      data: orders,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

// POST - 创建订单
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { order } = body
    
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

    // 验证必需字段
    if (!order.telegramId || !order.planId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 获取套餐信息
    const plan = await prisma.vipPlan.findUnique({
      where: { id: order.planId },
    })

    if (!plan || !plan.isEnabled) {
      return NextResponse.json({ error: 'VIP plan not found or disabled' }, { status: 404 })
    }

    // 生成订单号
    const orderNo = `VIP${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // 创建订单
    const newOrder = await prisma.vipOrder.create({
      data: {
        orderNo,
        telegramId: order.telegramId,
        planId: order.planId,
        amount: plan.price,
        currency: plan.currency,
        status: 'pending',
        createdBy: user.id.toString(),
      },
      include: {
        plan: true,
      },
    })

    return NextResponse.json(newOrder, { status: 201 })
  } catch (error: any) {
    console.error('Error creating order:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
