import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

// GET - 获取付费订单列表
export async function GET(request: NextRequest) {
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

    // Get payment orders
    const orders = await prisma.paymentOrder.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ data: orders })
  } catch (error) {
    console.error('Error fetching payment orders:', error)
    return NextResponse.json({ error: 'Failed to fetch payment orders' }, { status: 500 })
  }
}

// POST - 创建付费订单
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telegramId, orderType, ruleId, amount, currency, expireAt, remark } = body
    
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
    if (!telegramId || !orderType || !amount || !currency) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate order number
    const orderNo = `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`

    // Create payment order
    const order = await prisma.paymentOrder.create({
      data: {
        orderNo,
        telegramId,
        orderType,
        ruleId: ruleId || null,
        amount,
        currency,
        status: 'pending',
        expireAt: expireAt ? new Date(expireAt) : null,
        remark: remark || null,
      }
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error: any) {
    console.error('Error creating payment order:', error)
    return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 })
  }
}
