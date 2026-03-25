import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/api-auth'

// GET /api/reports/published - list published reports
export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const teacher = searchParams.get('teacher') || ''
  const tag = searchParams.get('tag') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip = (page - 1) * limit

  const where: any = {}
  if (teacher) where.teacherUsername = { contains: teacher, mode: 'insensitive' }
  if (tag) where.tags = { has: tag }

  const [items, total] = await Promise.all([
    prisma.publishedReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.publishedReport.count({ where }),
  ])

  return NextResponse.json({ items, total, page, limit })
}

// DELETE /api/reports/published?id=xxx - delete a published report
export async function DELETE(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.publishedReport.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
