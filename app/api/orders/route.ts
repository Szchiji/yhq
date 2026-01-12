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
      prisma.paymentOrder.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.paymentOrder.count({ where }),
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
    if (!order.telegramId || !order.ruleId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 获取续费规则信息
    const rule = await prisma.renewalRule.findUnique({
      where: { id: order.ruleId },
    })

    if (!rule || !rule.isEnabled) {
      return NextResponse.json({ error: 'Renewal rule not found or disabled' }, { status: 404 })
    }

    // 生成订单号
    const orderNo = `ORDER${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // 创建订单
    const newOrder = await prisma.paymentOrder.create({
      data: {
        orderNo,
        telegramId: order.telegramId,
        orderType: `${rule.targetRole}_renewal`,
        ruleId: order.ruleId,
        amount: rule.price,
        currency: rule.currency,
        status: 'pending',
      },
    })

    return NextResponse.json(newOrder, { status: 201 })
  } catch (error: any) {
    console.error('Error creating order:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
