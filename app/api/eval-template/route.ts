import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/api-auth'

// GET /api/eval-template - get report template
export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tmpl = await prisma.reportTemplate.findFirst()
  if (!tmpl) {
    return NextResponse.json({
      fields: [
        { key: 'contact', label: '联系方式', order: 1, required: true, type: 'text' },
        { key: 'service', label: '服务内容', order: 2, required: true, type: 'text' },
        { key: 'rating', label: '评分 (1-10)', order: 3, required: true, type: 'text' },
        { key: 'comment', label: '详细评价', order: 4, required: true, type: 'text' },
      ],
      header: '📋 <b>详细报告</b>',
      footer: '感谢您的评价！',
    })
  }
  return NextResponse.json(tmpl)
}

// PUT /api/eval-template - update report template
export async function PUT(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { fields, header, footer } = body

  if (!fields || !Array.isArray(fields)) {
    return NextResponse.json({ error: 'fields array required' }, { status: 400 })
  }

  const existing = await prisma.reportTemplate.findFirst()
  if (existing) {
    const updated = await prisma.reportTemplate.update({
      where: { id: existing.id },
      data: { fields, header: header || '', footer: footer || '', updatedAt: new Date() },
    })
    return NextResponse.json(updated)
  }

  const created = await prisma.reportTemplate.create({
    data: { fields, header: header || '', footer: footer || '', updatedAt: new Date() },
  })
  return NextResponse.json(created)
}
