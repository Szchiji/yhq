import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isSuperAdmin } from '@/lib/auth'

// GET - 获取收款地址列表
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

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { telegramId: user.id.toString() }
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get payment addresses for this user
    const addresses = await prisma.paymentAddress.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ data: addresses })
  } catch (error) {
    console.error('Error fetching payment addresses:', error)
    return NextResponse.json({ error: 'Failed to fetch payment addresses' }, { status: 500 })
  }
}

// POST - 添加收款地址
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, network, address, qrCodeUrl, isDefault, isEnabled } = body
    
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
    if (!name || !network || !address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get or create user
    let dbUser = await prisma.user.findUnique({
      where: { telegramId: user.id.toString() }
    })

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          telegramId: user.id.toString(),
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
        }
      })
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.paymentAddress.updateMany({
        where: { userId: dbUser.id, isDefault: true },
        data: { isDefault: false }
      })
    }

    // Create payment address
    const paymentAddress = await prisma.paymentAddress.create({
      data: {
        userId: dbUser.id,
        name,
        network,
        address,
        qrCodeUrl: qrCodeUrl || null,
        isDefault: isDefault || false,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
      }
    })

    return NextResponse.json(paymentAddress, { status: 201 })
  } catch (error: any) {
    console.error('Error adding payment address:', error)
    return NextResponse.json({ error: 'Failed to add payment address' }, { status: 500 })
  }
}
