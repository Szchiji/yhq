import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/evaluations/stats?teacher=username - public stats for a teacher
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const teacher = searchParams.get('teacher')
  if (!teacher) return NextResponse.json({ error: 'teacher required' }, { status: 400 })

  const username = teacher.replace(/^@/, '')

  const [positiveCount, negativeCount, reportCount] = await Promise.all([
    prisma.quickEvaluation.count({ where: { teacherUsername: username, isPositive: true } }),
    prisma.quickEvaluation.count({ where: { teacherUsername: username, isPositive: false } }),
    prisma.publishedReport.count({ where: { teacherUsername: username } }),
  ])

  const total = positiveCount + negativeCount
  const posRate = total > 0 ? Math.round((positiveCount / total) * 100) : 0

  return NextResponse.json({
    teacherUsername: username,
    positiveCount,
    negativeCount,
    total,
    posRate,
    reportCount,
  })
}
