import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isSuperAdmin } from '@/lib/auth'

// GET - 获取收费设置
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

    // Get billing settings
    const settings = await prisma.billingSetting.findMany()

    // Convert to key-value object
    const settingsObj: Record<string, string> = {}
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value
    })

    return NextResponse.json({ data: settingsObj })
  } catch (error) {
    console.error('Error fetching billing settings:', error)
    return NextResponse.json({ error: 'Failed to fetch billing settings' }, { status: 500 })
  }
}

// PUT - 更新收费设置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { settings } = body
    
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

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Invalid settings data' }, { status: 400 })
    }

    // Update each setting
    const updatePromises = Object.entries(settings).map(([key, value]) => {
      return prisma.billingSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      })
    })

    await Promise.all(updatePromises)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating billing settings:', error)
    return NextResponse.json({ error: 'Failed to update billing settings' }, { status: 500 })
  }
}
