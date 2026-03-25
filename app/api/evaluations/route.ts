import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/api-auth'

// GET /api/evaluations - list quick evaluations (admin)
export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const teacher = searchParams.get('teacher') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip = (page - 1) * limit

  const where = teacher ? { teacherUsername: { contains: teacher, mode: 'insensitive' as const } } : {}

  const [items, total] = await Promise.all([
    prisma.quickEvaluation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.quickEvaluation.count({ where }),
  ])

  return NextResponse.json({ items, total, page, limit })
}

// DELETE /api/evaluations?id=xxx - delete a quick evaluation (admin)
export async function DELETE(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.quickEvaluation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
