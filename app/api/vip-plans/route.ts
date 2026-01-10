import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateTelegramWebAppData, parseTelegramUser } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

// GET /api/vip-plans - List all VIP plans
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

    const plans = await prisma.vipPlan.findMany({
      orderBy: { sortOrder: 'asc' }
    })

    return NextResponse.json({ data: plans })
  } catch (error) {
    console.error('Error fetching VIP plans:', error)
    return NextResponse.json({ error: 'Failed to fetch VIP plans' }, { status: 500 })
  }
}

// POST /api/vip-plans - Create a new VIP plan
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
    const { name, days, price, currency, description, isEnabled, sortOrder } = body

    if (!name || days === undefined || !price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const plan = await prisma.vipPlan.create({
      data: {
        name,
        days: parseInt(days),
        price,
        currency: currency || 'USDT',
        description: description || null,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        sortOrder: sortOrder || 0,
        createdBy: String(user.id),
      }
    })

    return NextResponse.json({ data: plan })
  } catch (error) {
    console.error('Error creating VIP plan:', error)
    return NextResponse.json({ error: 'Failed to create VIP plan' }, { status: 500 })
  }
}
