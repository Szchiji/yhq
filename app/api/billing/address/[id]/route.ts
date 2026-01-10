import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isSuperAdmin } from '@/lib/auth'

// PUT - 更新收款地址
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, network, address, qrCodeUrl, isDefault, isEnabled } = body
    
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

    // Get current address
    const currentAddress = await prisma.paymentAddress.findUnique({
      where: { id: params.id }
    })

    if (!currentAddress) {
      return NextResponse.json({ error: 'Payment address not found' }, { status: 404 })
    }

    // If setting as default, unset other defaults
    if (isDefault && !currentAddress.isDefault) {
      await prisma.paymentAddress.updateMany({
        where: { userId: currentAddress.userId, isDefault: true },
        data: { isDefault: false }
      })
    }

    // Build update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (network !== undefined) updateData.network = network
    if (address !== undefined) updateData.address = address
    if (qrCodeUrl !== undefined) updateData.qrCodeUrl = qrCodeUrl
    if (isDefault !== undefined) updateData.isDefault = isDefault
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled

    const paymentAddress = await prisma.paymentAddress.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json(paymentAddress)
  } catch (error: any) {
    console.error('Error updating payment address:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Payment address not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to update payment address' }, { status: 500 })
  }
}

// DELETE - 删除收款地址
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

    await prisma.paymentAddress.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting payment address:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Payment address not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to delete payment address' }, { status: 500 })
  }
}
