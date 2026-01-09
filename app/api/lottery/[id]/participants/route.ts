import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = {
  params: {
    id: string
  }
}

// GET - 获取参与者列表
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const [participants, total] = await Promise.all([
      prisma.participant.findMany({
        where: { lotteryId: params.id },
        orderBy: {
          joinedAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.participant.count({
        where: { lotteryId: params.id },
      }),
    ])

    return NextResponse.json({
      data: participants,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching participants:', error)
    return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 })
  }
}
