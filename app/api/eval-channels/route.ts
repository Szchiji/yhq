import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/api-auth'

// GET /api/eval-channels - list evaluation channels
export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const channels = await prisma.evalChannel.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(channels)
}

// POST /api/eval-channels - add a channel
export async function POST(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { chatId, title, type, username, inviteLink } = body

  if (!chatId || !title) {
    return NextResponse.json({ error: 'chatId and title are required' }, { status: 400 })
  }

  const channel = await prisma.evalChannel.upsert({
    where: { chatId },
    create: { chatId, title, type: type || 'report', username, inviteLink, updatedAt: new Date() },
    update: { title, type: type || 'report', username, inviteLink, isEnabled: true, updatedAt: new Date() },
  })

  return NextResponse.json(channel)
}

// PATCH /api/eval-channels?id=xxx - toggle enabled
export async function PATCH(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await request.json()
  const updated = await prisma.evalChannel.update({
    where: { id },
    data: { ...body, updatedAt: new Date() },
  })
  return NextResponse.json(updated)
}

// DELETE /api/eval-channels?id=xxx - delete a channel
export async function DELETE(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.evalChannel.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
