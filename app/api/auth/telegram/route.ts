import { NextRequest, NextResponse } from 'next/server'
import { validateTelegramWebAppData, parseTelegramUser, isAdmin, isSuperAdmin } from '@/lib/telegram'

// Telegram WebApp authentication
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { initData } = body

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing initData' },
        { status: 400 }
      )
    }

    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Validate initData signature
    const isValid = validateTelegramWebAppData(initData, botToken)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid initData signature' },
        { status: 401 }
      )
    }

    // Parse user data
    const user = parseTelegramUser(initData)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid user data' },
        { status: 400 }
      )
    }

    const telegramId = user.id.toString()

    // Check permissions
    const userIsSuperAdmin = isSuperAdmin(telegramId)
    const userIsAdmin = await isAdmin(telegramId)

    // Save or update user in database
    const { prisma } = await import('@/lib/prisma')
    await prisma.user.upsert({
      where: { telegramId },
      update: {
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        updatedAt: new Date(),
      },
      create: {
        telegramId,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    })

    return NextResponse.json({
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
      },
      isSuperAdmin: userIsSuperAdmin,
      isAdmin: userIsAdmin || userIsSuperAdmin,
    })
  } catch (error) {
    console.error('Authentication error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
