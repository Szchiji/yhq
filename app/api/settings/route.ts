import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateTelegramWebAppData, parseTelegramUser } from '@/lib/telegram'
import { isSuperAdmin } from '@/lib/auth'

// GET /api/settings - Get all system settings
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
    // Check if user is super admin
    if (!isSuperAdmin(String(user.id))) {
      return NextResponse.json({ error: 'Unauthorized - Super admin only' }, { status: 403 })
    }

    const settings = await prisma.systemSetting.findMany()
    
    // Convert to key-value object
    const settingsObj: Record<string, string> = {}
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value
    })

    return NextResponse.json({ data: settingsObj })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

// PUT /api/settings - Update system settings
export async function PUT(request: NextRequest) {
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
    // Check if user is super admin
    if (!isSuperAdmin(String(user.id))) {
      return NextResponse.json({ error: 'Unauthorized - Super admin only' }, { status: 403 })
    }

    const body = await request.json()
    
    // Update each setting
    const updates = Object.entries(body).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      })
    )

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
