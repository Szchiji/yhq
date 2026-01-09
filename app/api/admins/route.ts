import { NextRequest, NextResponse } from 'next/server'
import { validateTelegramWebAppData, parseTelegramUser, isSuperAdmin } from '@/lib/telegram'
import { prisma } from '@/lib/prisma'

// Verify request is from super admin
async function verifySuperAdmin(request: NextRequest) {
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
  if (!isSuperAdmin(telegramId)) return null

  return telegramId
}

// GET: List all admins (super admin only)
export async function GET(request: NextRequest) {
  const superAdminId = await verifySuperAdmin(request)
  if (!superAdminId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ admins })
  } catch (error) {
    console.error('Error fetching admins:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admins' },
      { status: 500 }
    )
  }
}

// POST: Add a new admin (super admin only)
export async function POST(request: NextRequest) {
  const superAdminId = await verifySuperAdmin(request)
  if (!superAdminId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { telegramId, username, firstName, lastName } = body

    if (!telegramId) {
      return NextResponse.json(
        { error: 'Telegram ID is required' },
        { status: 400 }
      )
    }

    // Check if admin already exists
    const existing = await prisma.admin.findUnique({
      where: { telegramId },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Admin already exists' },
        { status: 400 }
      )
    }

    // Create new admin
    const admin = await prisma.admin.create({
      data: {
        telegramId,
        username,
        firstName,
        lastName,
        createdBy: superAdminId,
      },
    })

    return NextResponse.json({ admin }, { status: 201 })
  } catch (error) {
    console.error('Error creating admin:', error)
    return NextResponse.json(
      { error: 'Failed to create admin' },
      { status: 500 }
    )
  }
}

// DELETE: Remove an admin (super admin only)
export async function DELETE(request: NextRequest) {
  const superAdminId = await verifySuperAdmin(request)
  if (!superAdminId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get('id')

    if (!adminId) {
      return NextResponse.json(
        { error: 'Admin ID is required' },
        { status: 400 }
      )
    }

    await prisma.admin.delete({
      where: { id: adminId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting admin:', error)
    return NextResponse.json(
      { error: 'Failed to delete admin' },
      { status: 500 }
    )
  }
}
