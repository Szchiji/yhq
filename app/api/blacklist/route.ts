import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/api-auth'

// GET /api/blacklist - 获取黑名单列表
export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''

    const where = search ? {
      OR: [
        { telegramId: { contains: search, mode: 'insensitive' as const } },
        { username: { contains: search, mode: 'insensitive' as const } },
        { reason: { contains: search, mode: 'insensitive' as const, not: null } }
      ]
    } : {}

    const [items, total] = await Promise.all([
      prisma.blacklist.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.blacklist.count({ where })
    ])

    return NextResponse.json({ items, total, page, limit })
  } catch (error) {
    console.error('Error fetching blacklist:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blacklist' },
      { status: 500 }
    )
  }
}

// POST /api/blacklist - 添加黑名单
export async function POST(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { telegramId, reason } = body

    if (!telegramId) {
      return NextResponse.json(
        { error: 'Telegram ID is required' },
        { status: 400 }
      )
    }

    // 检查是否已在黑名单
    const existing = await prisma.blacklist.findUnique({
      where: { telegramId }
    })
    if (existing) {
      return NextResponse.json(
        { error: '该用户已在黑名单中' },
        { status: 400 }
      )
    }

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { telegramId }
    })

    const blacklist = await prisma.blacklist.create({
      data: {
        telegramId,
        username: user?.username,
        reason,
        createdBy: adminId
      }
    })

    return NextResponse.json(blacklist)
  } catch (error) {
    console.error('Error adding to blacklist:', error)
    return NextResponse.json(
      { error: 'Failed to add to blacklist' },
      { status: 500 }
    )
  }
}
