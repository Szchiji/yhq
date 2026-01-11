import { NextRequest, NextResponse } from 'next/server'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkAndSendReminders } from '@/lib/reminder'

// GET - 获取提醒设置
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

    // 验证用户是否为超管
    if (!isSuperAdmin(user.id.toString())) {
      return NextResponse.json({ error: 'Unauthorized: Only super admin can access reminder settings' }, { status: 403 })
    }

    // 获取或创建默认设置
    let settings = await prisma.reminderSetting.findFirst()
    
    if (!settings) {
      settings = await prisma.reminderSetting.create({
        data: {
          isEnabled: true,
          reminderDays: '7,3,1',
          vipTemplate: null,
          adminTemplate: null,
          userTemplate: null
        }
      })
    }

    return NextResponse.json({ data: settings })
  } catch (error) {
    console.error('Error fetching reminder settings:', error)
    return NextResponse.json({ error: 'Failed to fetch reminder settings' }, { status: 500 })
  }
}

// PUT - 更新提醒设置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { isEnabled, reminderDays, vipTemplate, adminTemplate, userTemplate } = body
    
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
      return NextResponse.json({ error: 'Unauthorized: Only super admin can manage reminder settings' }, { status: 403 })
    }

    // 获取或创建设置
    let settings = await prisma.reminderSetting.findFirst()
    
    if (settings) {
      // 更新现有设置
      settings = await prisma.reminderSetting.update({
        where: { id: settings.id },
        data: {
          isEnabled: isEnabled ?? settings.isEnabled,
          reminderDays: reminderDays ?? settings.reminderDays,
          vipTemplate: vipTemplate !== undefined ? vipTemplate : settings.vipTemplate,
          adminTemplate: adminTemplate !== undefined ? adminTemplate : settings.adminTemplate,
          userTemplate: userTemplate !== undefined ? userTemplate : settings.userTemplate
        }
      })
    } else {
      // 创建新设置
      settings = await prisma.reminderSetting.create({
        data: {
          isEnabled: isEnabled ?? true,
          reminderDays: reminderDays ?? '7,3,1',
          vipTemplate: vipTemplate ?? null,
          adminTemplate: adminTemplate ?? null,
          userTemplate: userTemplate ?? null
        }
      })
    }

    return NextResponse.json({ success: true, data: settings })
  } catch (error: any) {
    console.error('Error updating reminder settings:', error)
    return NextResponse.json({ error: 'Failed to update reminder settings' }, { status: 500 })
  }
}

// POST /trigger - 手动触发提醒检查
export async function POST(request: NextRequest) {
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

    // 验证用户是否为超管
    if (!isSuperAdmin(user.id.toString())) {
      return NextResponse.json({ error: 'Unauthorized: Only super admin can trigger reminders' }, { status: 403 })
    }

    // 触发提醒检查
    await checkAndSendReminders()

    return NextResponse.json({ 
      success: true, 
      message: 'Reminders triggered successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Error triggering reminders:', error)
    return NextResponse.json({ error: 'Failed to trigger reminders' }, { status: 500 })
  }
}
