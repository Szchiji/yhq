import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'
import { isAdmin } from '@/lib/auth'
import { formatDateTime } from '@/lib/date-format'

// GET /api/winners/export - 导出中奖记录为 CSV
export async function GET(request: NextRequest) {
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

    // 验证用户是否为管理员
    if (!(await isAdmin(user.id.toString()))) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 })
    }

    // Get query parameters (same filters as list)
    const { searchParams } = new URL(request.url)
    const lotteryId = searchParams.get('lotteryId')
    const userId = searchParams.get('userId')
    const telegramId = searchParams.get('telegramId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {}
    
    if (lotteryId) where.lotteryId = lotteryId
    if (userId) where.userId = userId
    if (telegramId) where.telegramId = { contains: telegramId }
    if (status === 'claimed') where.claimed = true
    if (status === 'unclaimed') where.claimed = false
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    const winners = await prisma.winner.findMany({
      where,
      include: {
        user: true,
        lottery: {
          select: {
            title: true,
          }
        },
        prize: {
          select: {
            name: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // 生成 CSV
    const csvHeader = ['用户名', 'Telegram ID', '抽奖标题', '奖品名称', '中奖时间', '领奖状态'].join(',')
    const csvRows = winners.map(w => {
      const username = w.username || w.user?.username || ''
      const telegramId = w.telegramId
      const lotteryTitle = w.lottery?.title || ''
      const prizeName = w.prize?.name || w.prizeName || ''
      const wonAt = formatDateTime(w.createdAt)
      const claimedStatus = w.claimed ? '已领取' : '未领取'
      
      // Escape CSV fields that contain commas or quotes
      const escapeField = (field: string) => {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`
        }
        return field
      }
      
      return [
        escapeField(username),
        escapeField(telegramId),
        escapeField(lotteryTitle),
        escapeField(prizeName),
        escapeField(wonAt),
        escapeField(claimedStatus)
      ].join(',')
    })
    
    const csv = [csvHeader, ...csvRows].join('\n')
    
    // Add BOM for proper UTF-8 encoding in Excel
    const bom = '\uFEFF'
    const csvWithBom = bom + csv

    return new Response(csvWithBom, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=winners_${Date.now()}.csv`
      }
    })
  } catch (error) {
    console.error('Error exporting winners:', error)
    return NextResponse.json({ error: 'Failed to export winners' }, { status: 500 })
  }
}
