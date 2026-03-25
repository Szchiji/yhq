import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/api-auth'

// GET /api/eval-tags - list predefined tags and config
export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [tags, config] = await Promise.all([
    prisma.predefinedTag.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.tagFieldConfig.findFirst(),
  ])

  return NextResponse.json({ tags, config })
}

// POST /api/eval-tags - create tag or update config
export async function POST(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  if (body.type === 'config') {
    // Update tag field config
    const { isEnabled, isRequired, mode, maxTags, fieldLabel } = body
    const existing = await prisma.tagFieldConfig.findFirst()
    if (existing) {
      const updated = await prisma.tagFieldConfig.update({
        where: { id: existing.id },
        data: {
          ...(isEnabled !== undefined && { isEnabled }),
          ...(isRequired !== undefined && { isRequired }),
          ...(mode && { mode }),
          ...(maxTags !== undefined && { maxTags }),
          ...(fieldLabel && { fieldLabel }),
          updatedAt: new Date(),
        },
      })
      return NextResponse.json(updated)
    } else {
      const created = await prisma.tagFieldConfig.create({
        data: { isEnabled, isRequired, mode, maxTags, fieldLabel, updatedAt: new Date() },
      })
      return NextResponse.json(created)
    }
  }

  // Create predefined tag
  const { tag } = body
  if (!tag) return NextResponse.json({ error: 'tag required' }, { status: 400 })

  const existing = await prisma.predefinedTag.findUnique({ where: { tag } })
  if (existing) return NextResponse.json({ error: 'Tag already exists' }, { status: 409 })

  const maxOrder = await prisma.predefinedTag.aggregate({ _max: { sortOrder: true } })
  const created = await prisma.predefinedTag.create({
    data: { tag, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  })
  return NextResponse.json(created)
}

// DELETE /api/eval-tags?id=xxx - delete a predefined tag
export async function DELETE(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.predefinedTag.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
