import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateTelegramWebAppData, parseTelegramUser } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'

// PUT /api/vip-plans/[id] - Update a VIP plan
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const initData = request.headers.get('x-init-data')
  
  if (!initData) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const botToken = process.env.BOT_TOKEN
  if (!botToken || !validateTelegramWebAppData(initData, botToken)) {
    return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 })
  }

  const user = parseTelegramUser(initData)
  if (!user) {
    return NextResponse.json({ error: 'Invalid user data' }, { status: 401 })
  }

  try {
    // Check if user is admin
    if (!(await isAdmin(String(user.id)))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const updateData: any = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.days !== undefined) updateData.days = parseInt(body.days)
    if (body.price !== undefined) updateData.price = body.price
    if (body.currency !== undefined) updateData.currency = body.currency
    if (body.description !== undefined) updateData.description = body.description || null
    if (body.isEnabled !== undefined) updateData.isEnabled = body.isEnabled
    if (body.sortOrder !== undefined) updateData.sortOrder = parseInt(body.sortOrder)

    const plan = await prisma.vipPlan.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json({ data: plan })
  } catch (error) {
    console.error('Error updating VIP plan:', error)
    return NextResponse.json({ error: 'Failed to update VIP plan' }, { status: 500 })
  }
}

// DELETE /api/vip-plans/[id] - Delete a VIP plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const initData = request.headers.get('x-init-data')
  
  if (!initData) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const botToken = process.env.BOT_TOKEN
  if (!botToken || !validateTelegramWebAppData(initData, botToken)) {
    return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 })
  }

  const user = parseTelegramUser(initData)
  if (!user) {
    return NextResponse.json({ error: 'Invalid user data' }, { status: 401 })
  }

  try {
    // Check if user is admin
    if (!(await isAdmin(String(user.id)))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.vipPlan.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting VIP plan:', error)
    return NextResponse.json({ error: 'Failed to delete VIP plan' }, { status: 500 })
  }
}
