import { NextRequest, NextResponse } from 'next/server'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkAndSendReminders } from '@/lib/reminder'

// GET - 获取提醒设置
export async function GET(request: NextRequest) {
  try {
    const setting = await prisma.reminderSetting.findFirst()
    
    if (!setting) {
      // 返回默认设置
      return NextResponse.json({
        data: {
          isEnabled: true,
          reminderDays: '7,3,1',
          vipTemplate: null,
          adminTemplate: null,
          userTemplate: null,
        }
      })
    }
    
    return NextResponse.json({ data: setting })
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

    // 更新或创建设置
    const existingSetting = await prisma.reminderSetting.findFirst()
    
    if (existingSetting) {
      await prisma.reminderSetting.update({
        where: { id: existingSetting.id },
        data: {
          isEnabled,
          reminderDays,
          vipTemplate: vipTemplate || null,
          adminTemplate: adminTemplate || null,
          userTemplate: userTemplate || null,
        }
      })
    } else {
      await prisma.reminderSetting.create({
        data: {
          isEnabled,
          reminderDays,
          vipTemplate: vipTemplate || null,
          adminTemplate: adminTemplate || null,
          userTemplate: userTemplate || null,
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating reminder settings:', error)
    return NextResponse.json({ error: 'Failed to update reminder settings' }, { status: 500 })
  }
}

// POST - 手动触发提醒检查（测试用）
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

    // 执行提醒检查
    const result = await checkAndSendReminders()

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('Error triggering reminders:', error)
    return NextResponse.json({ error: 'Failed to trigger reminders' }, { status: 500 })
  }
}
