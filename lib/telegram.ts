import crypto from 'crypto'
import { prisma } from './prisma'

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
export async function sendMessage(chatId: number | string, text: string, options?: any) {
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
  const admin = await prisma.admin.findUnique({
    where: { telegramId }
  })
  return !!admin && admin.isActive
}

// Check if user is super admin
export function isSuperAdmin(telegramId: string): boolean {
  return telegramId === process.env.SUPER_ADMIN_ID
}

// 回应 callback_query
export async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert?: boolean) {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) {
    throw new Error('BOT_TOKEN is not set')
  }
  const response = await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    }),
  })
  return response.json()
}

// 检查用户是否在频道/群组中
export async function checkChatMember(chatId: string, userId: string): Promise<boolean> {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) {
    throw new Error('BOT_TOKEN is not set')
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        user_id: userId,
      }),
    })
    const result = await response.json()
    if (result.ok) {
      const status = result.result.status
      return ['member', 'administrator', 'creator'].includes(status)
    }
    return false
  } catch (error) {
    console.error('Error checking chat member:', error)
    return false
  }
}

// 发送抽奖消息到群组/频道
export async function sendLotteryMessage(chatId: string | number, lottery: any) {
  let message = `🎉 ${lottery.title}\n\n`
  
  if (lottery.description) {
    message += `${lottery.description}\n\n`
  }
  
  if (lottery.prizes && lottery.prizes.length > 0) {
    message += '🎁 奖品列表：\n'
    lottery.prizes.forEach((prize: any) => {
      message += `  • ${prize.name} (${prize.remaining}/${prize.total})\n`
    })
    message += '\n'
  }
  
  if (lottery.requireUsername) {
    message += '⚠️ 参与需要设置用户名\n'
  }
  
  if (lottery.requireChannels && lottery.requireChannels.length > 0) {
    message += '⚠️ 参与需要加入指定频道/群组\n'
  }
  
  const botUsername = process.env.BOT_USERNAME || 'lottery_bot'
  const participateUrl = `https://t.me/${botUsername}?start=lottery_${lottery.id}`
  
  const chatIdNumber = typeof chatId === 'string' ? parseInt(chatId) : chatId
  return sendMessage(chatIdNumber, message, {
    reply_markup: {
      inline_keyboard: [[
        { text: '🎯 参与抽奖', url: participateUrl }
      ]]
    }
  })
}

// 获取机器人信息
export async function getBotInfo() {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) {
    throw new Error('BOT_TOKEN is not set')
  }
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
  return response.json()
}

// 获取机器人用户名
export async function getBotUsername(): Promise<string> {
  const botInfo = await getBotInfo()
  return botInfo.result?.username || process.env.BOT_USERNAME || 'lottery_bot'
}

// 获取群组/频道信息
export async function getChat(chatId: string) {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) {
    throw new Error('BOT_TOKEN is not set')
  }
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId })
  })
  return response.json()
}

// 获取群成员信息
export async function getChatMember(chatId: string, userId: string | number) {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) {
    throw new Error('BOT_TOKEN is not set')
  }
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, user_id: userId })
  })
  return response.json()
}

// 编辑消息
export async function editMessageText(chatId: string | number, messageId: number, text: string, options?: any) {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) {
    throw new Error('BOT_TOKEN is not set')
  }
  const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      ...options
    })
  })
  return response.json()
}

// 替换模板变量
export function replaceTemplateVariables(template: string, data: {
  member?: string
  lotteryTitle?: string
  lotteryDesc?: string
  goodsName?: string
  goodsList?: string
  creator?: string
  creatorId?: string
  creatorName?: string
  lotterySn?: string
  awardUserList?: string
  joinNum?: number
  joinCondition?: string
  openCondition?: string
}): string {
  let result = template
  // Pre-compile patterns for better performance
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      result = result.split(`{${key}}`).join(String(value))
    }
  }
  return result
}
