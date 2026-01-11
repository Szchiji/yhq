import { NextRequest, NextResponse } from 'next/server'
import { validateTelegramWebAppData, parseTelegramUser } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = {
  params: {
    id: string
  }
}

// Verify request is from an admin
async function verifyAdmin(request: NextRequest) {
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

// DELETE /api/blacklist/[id] - 移出黑名单
export async function DELETE(request: NextRequest, { params }: Params) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    await prisma.blacklist.delete({
      where: { id: params.id }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing from blacklist:', error)
    return NextResponse.json(
      { error: 'Failed to remove from blacklist' },
      { status: 500 }
    )
  }
}
