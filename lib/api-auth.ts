import { NextRequest } from 'next/server'
import { validateTelegramWebAppData, parseTelegramUser } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

/**
 * Verify request is from an admin (super admin or regular admin)
 * Returns the admin's Telegram ID if authorized, null otherwise
 */
export async function verifyAdmin(request: NextRequest): Promise<string | null> {
  const initData = request.headers.get('x-telegram-init-data')
  if (!initData) {
    return null
  }

  const botToken = process.env.BOT_TOKEN
  if (!botToken) return null

  const isValid = validateTelegramWebAppData(initData, botToken)
  if (!isValid) return null

  const user = parseTelegramUser(initData)
  if (!user) return null

  const telegramId = user.id.toString()
  const isAdminUser = await isAdmin(telegramId)
  if (!isAdminUser) return null

  return telegramId
}
