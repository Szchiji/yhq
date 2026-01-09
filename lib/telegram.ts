import crypto from 'crypto'

// Telegram User type
export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

// Validate Telegram WebApp initData
export function validateTelegramWebAppData(initData: string, botToken: string): boolean {
  const urlParams = new URLSearchParams(initData)
  const hash = urlParams.get('hash')
  urlParams.delete('hash')
  
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()
  
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')
  
  return calculatedHash === hash
}

// Parse user data from initData
export function parseTelegramUser(initData: string): TelegramUser | null {
  const urlParams = new URLSearchParams(initData)
  const userStr = urlParams.get('user')
  if (!userStr) return null
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

// Send message via Telegram Bot API
export async function sendMessage(chatId: number, text: string, options?: any) {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) {
    throw new Error('BOT_TOKEN is not set')
  }
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...options,
    }),
  })
  return response.json()
}

// Check if user is admin
export async function isAdmin(telegramId: string): Promise<boolean> {
  const superAdminId = process.env.SUPER_ADMIN_ID
  if (telegramId === superAdminId) return true
  
  // Query database for admin list
  const { prisma } = await import('./prisma')
  const admin = await prisma.admin.findUnique({
    where: { telegramId }
  })
  return !!admin && admin.isActive
}

// Check if user is super admin
export function isSuperAdmin(telegramId: string): boolean {
  return telegramId === process.env.SUPER_ADMIN_ID
}
