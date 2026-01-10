import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isSuperAdmin } from '@/lib/auth'

// Default settings
const DEFAULT_SETTINGS = {
  lottery_limit_enabled: 'false',
  lottery_daily_limit: '3',
  vip_unlimited: 'true',
}

// GET - 获取所有系统设置
export async function GET(request: NextRequest) {
  try {
    const settings = await prisma.systemSetting.findMany()
    
    // Convert to key-value object
    const settingsObj: Record<string, string> = { ...DEFAULT_SETTINGS }
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value
    })

    return NextResponse.json({ data: settingsObj })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

// POST - 更新系统设置
export async function POST(request: NextRequest) {
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

    // 验证用户是否为超管
    if (!isSuperAdmin(user.id.toString())) {
      return NextResponse.json({ error: 'Unauthorized: Only super admin can manage settings' }, { status: 403 })
    }

    // 更新所有设置
    for (const [key, value] of Object.entries(settings)) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}

/**
 * Helper function to get a specific setting value
 */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    })
    return setting?.value || DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] || null
  } catch (error) {
    console.error('Error getting setting:', error)
    return DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] || null
  }
}
