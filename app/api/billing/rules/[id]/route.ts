import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isSuperAdmin } from '@/lib/auth'

// PUT - 更新续费规则
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, targetRole, days, price, currency, description, isEnabled, sortOrder } = body
    
    // Get initData from header
    const initData = request.headers.get('x-telegram-init-data')
    
    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 })
    }

    // 验证 Telegram WebApp 数据
    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 })
    }

    if (!validateTelegramWebAppData(initData, botToken)) {
      return NextResponse.json({ error: 'Invalid Telegram data' }, { status: 401 })
    }

    const user = parseTelegramUser(initData)
    if (!user) {
      return NextResponse.json({ error: 'Invalid user data' }, { status: 401 })
    }

    // 验证用户是否为超级管理员
    if (!isSuperAdmin(user.id.toString())) {
      return NextResponse.json({ error: 'Unauthorized: Super admin access required' }, { status: 403 })
    }

    // Build update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (targetRole !== undefined) updateData.targetRole = targetRole
    if (days !== undefined) updateData.days = days
    if (price !== undefined) updateData.price = price
    if (currency !== undefined) updateData.currency = currency
    if (description !== undefined) updateData.description = description
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder

    const rule = await prisma.renewalRule.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json(rule)
  } catch (error: any) {
    console.error('Error updating renewal rule:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Renewal rule not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to update renewal rule' }, { status: 500 })
  }
}

// DELETE - 删除续费规则
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get initData from header
    const initData = request.headers.get('x-telegram-init-data')
    
    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 })
    }

    // 验证 Telegram WebApp 数据
    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 })
    }

    if (!validateTelegramWebAppData(initData, botToken)) {
      return NextResponse.json({ error: 'Invalid Telegram data' }, { status: 401 })
    }

    const user = parseTelegramUser(initData)
    if (!user) {
      return NextResponse.json({ error: 'Invalid user data' }, { status: 401 })
    }

    // 验证用户是否为超级管理员
    if (!isSuperAdmin(user.id.toString())) {
      return NextResponse.json({ error: 'Unauthorized: Super admin access required' }, { status: 403 })
    }

    await prisma.renewalRule.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting renewal rule:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Renewal rule not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to delete renewal rule' }, { status: 500 })
  }
}
