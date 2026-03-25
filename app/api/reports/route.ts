import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/api-auth'
import { approveReport, rejectReport } from '@/lib/teacherEval'

// GET /api/reports - list pending or all reports (admin)
export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'pending'
  const teacher = searchParams.get('teacher') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip = (page - 1) * limit

  const where: any = {}
  if (status !== 'all') where.status = status
  if (teacher) where.teacherUsername = { contains: teacher, mode: 'insensitive' }

  const [items, total] = await Promise.all([
    prisma.pendingReport.findMany({
      where,
      include: { screenshots: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.pendingReport.count({ where }),
  ])

  return NextResponse.json({ items, total, page, limit })
}

// POST /api/reports - admin action (approve / reject)
export async function POST(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action, reportId, reason } = body

  if (!reportId || !action) {
    return NextResponse.json({ error: 'reportId and action required' }, { status: 400 })
  }

  if (action === 'approve') {
    const result = await approveReport(adminId, reportId)
    if (!result) return NextResponse.json({ error: 'Report not found or already processed' }, { status: 404 })
    return NextResponse.json({ ok: true, published: result })
  }

  if (action === 'reject') {
    if (!reason) return NextResponse.json({ error: 'reason required for rejection' }, { status: 400 })
    const result = await rejectReport(adminId, reportId, reason)
    if (!result) return NextResponse.json({ error: 'Report not found or already processed' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
