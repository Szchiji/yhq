import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

// GET - 获取所有VIP套餐
export async function GET(request: NextRequest) {
  try {
    const plans = await prisma.vipPlan.findMany({
      orderBy: {
        sortOrder: 'asc',
      },
      include: {
        _count: {
          select: { orders: true }
        }
      }
    })

    return NextResponse.json({ data: plans })
  } catch (error) {
    console.error('Error fetching VIP plans:', error)
    return NextResponse.json({ error: 'Failed to fetch VIP plans' }, { status: 500 })
  }
}

// POST - 创建/更新VIP套餐
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan } = body
    
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

    // 验证必需字段
    if (!plan.name || plan.days === undefined || !plan.price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let savedPlan
    if (plan.id) {
      // 更新现有套餐
      savedPlan = await prisma.vipPlan.update({
        where: { id: plan.id },
        data: {
          name: plan.name,
          days: plan.days,
          price: plan.price,
          currency: plan.currency || 'USDT',
          description: plan.description || null,
          isEnabled: plan.isEnabled !== undefined ? plan.isEnabled : true,
          sortOrder: plan.sortOrder !== undefined ? plan.sortOrder : 0,
        },
      })
    } else {
      // 创建新套餐
      savedPlan = await prisma.vipPlan.create({
        data: {
          name: plan.name,
          days: plan.days,
          price: plan.price,
          currency: plan.currency || 'USDT',
          description: plan.description || null,
          isEnabled: plan.isEnabled !== undefined ? plan.isEnabled : true,
          sortOrder: plan.sortOrder || 0,
          createdBy: user.id.toString(),
        },
      })
    }

    return NextResponse.json(savedPlan, { status: plan.id ? 200 : 201 })
  } catch (error: any) {
    console.error('Error saving VIP plan:', error)
    return NextResponse.json({ error: 'Failed to save VIP plan' }, { status: 500 })
  }
}
