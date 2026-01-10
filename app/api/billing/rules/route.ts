import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isSuperAdmin } from '@/lib/auth'

// GET - 获取续费规则列表
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

    // 验证用户是否为超级管理员
    if (!isSuperAdmin(user.id.toString())) {
      return NextResponse.json({ error: 'Unauthorized: Super admin access required' }, { status: 403 })
    }

    // Get renewal rules
    const rules = await prisma.renewalRule.findMany({
      orderBy: { sortOrder: 'asc' }
    })

    return NextResponse.json({ data: rules })
  } catch (error) {
    console.error('Error fetching renewal rules:', error)
    return NextResponse.json({ error: 'Failed to fetch renewal rules' }, { status: 500 })
  }
}

// POST - 添加续费规则
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, targetRole, days, price, currency, description, isEnabled, sortOrder } = body
    
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

    // 验证用户是否为超级管理员
    if (!isSuperAdmin(user.id.toString())) {
      return NextResponse.json({ error: 'Unauthorized: Super admin access required' }, { status: 403 })
    }

    // 验证必需字段
    if (!name || !targetRole || days === undefined || !price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create renewal rule
    const rule = await prisma.renewalRule.create({
      data: {
        name,
        targetRole,
        days,
        price,
        currency: currency || 'USDT',
        description: description || null,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        sortOrder: sortOrder || 0,
      }
    })

    return NextResponse.json(rule, { status: 201 })
  } catch (error: any) {
    console.error('Error adding renewal rule:', error)
    return NextResponse.json({ error: 'Failed to add renewal rule' }, { status: 500 })
  }
}
