import { NextRequest, NextResponse } from 'next/server'
import { validateTelegramWebAppData, parseTelegramUser, syncCommandsToTelegram } from '@/lib/telegram'
import { isSuperAdmin } from '@/lib/auth'

// POST /api/commands/sync - Sync commands to Telegram
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
    // Check if user is super admin
    if (!isSuperAdmin(String(user.id))) {
      return NextResponse.json({ error: 'Unauthorized - Super admin only' }, { status: 403 })
    }

    // Sync commands to Telegram
    const result = await syncCommandsToTelegram()

    return NextResponse.json({ 
      success: true, 
      message: 'Commands synced to Telegram successfully',
      result 
    })
  } catch (error) {
    console.error('Error syncing commands:', error)
    return NextResponse.json({ error: 'Failed to sync commands' }, { status: 500 })
  }
}
