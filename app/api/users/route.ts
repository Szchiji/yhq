import { NextRequest, NextResponse } from 'next/server'
import { prisma, Prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'

// GET - 获取用户列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('perPage') || '10')
    
    const skip = (page - 1) * perPage

    // Build where clause for search
    const where: Prisma.UserWhereInput = search ? {
      OR: [
        { telegramId: { contains: search } },
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ],
    } : {}

    // Get users with counts
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: perPage,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.user.count({ where }),
    ])

    // Get participation and win counts for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const [createdCount, participatedCount, wonCount] = await Promise.all([
          prisma.lottery.count({
            where: { createdBy: user.telegramId },
          }),
          prisma.participant.count({
            where: { telegramId: user.telegramId },
          }),
          prisma.winner.count({
            where: { telegramId: user.telegramId },
          }),
        ])

        return {
          ...user,
          createdCount,
          participatedCount,
          wonCount,
        }
      })
    )

    return NextResponse.json({
      data: usersWithStats,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// PATCH - 更新用户
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, updates } = body
    
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
    const superAdminId = process.env.SUPER_ADMIN_ID
    if (user.id.toString() !== superAdminId) {
      return NextResponse.json({ error: 'Unauthorized: Only super admin can manage users' }, { status: 403 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    // Build update data - only allow specific fields
    const updateData: any = {}
    if (updates.isVip !== undefined) updateData.isVip = updates.isVip
    if (updates.vipExpireAt !== undefined) updateData.vipExpireAt = updates.vipExpireAt ? new Date(updates.vipExpireAt) : null
    if (updates.canCreateLottery !== undefined) updateData.canCreateLottery = updates.canCreateLottery
    if (updates.canJoinLottery !== undefined) updateData.canJoinLottery = updates.canJoinLottery

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    return NextResponse.json(updatedUser)
  } catch (error: any) {
    console.error('Error updating user:', error)
    
    // Handle record not found
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
