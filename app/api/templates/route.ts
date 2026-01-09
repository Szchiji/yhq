import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData } from '@/lib/telegram'

// GET - 获取所有模板
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const createdBy = searchParams.get('createdBy')

    const where: any = {}
    if (type) {
      where.type = type
    }
    if (createdBy) {
      where.createdBy = createdBy
    }

    const templates = await prisma.template.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ data: templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// POST - 创建/更新模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { template } = body
    
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

    // 验证必需字段
    if (!template.type || !template.content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 查找是否已存在该类型的模板
    const existingTemplate = await prisma.template.findFirst({
      where: {
        type: template.type,
        createdBy: user.id.toString(),
      },
    })

    let savedTemplate
    if (existingTemplate) {
      // 更新现有模板
      savedTemplate = await prisma.template.update({
        where: { id: existingTemplate.id },
        data: {
          content: template.content,
          buttons: template.buttons || null,
        },
      })
    } else {
      // 创建新模板
      savedTemplate = await prisma.template.create({
        data: {
          type: template.type,
          content: template.content,
          buttons: template.buttons || null,
          createdBy: user.id.toString(),
        },
      })
    }

    return NextResponse.json(savedTemplate, { status: existingTemplate ? 200 : 201 })
  } catch (error) {
    console.error('Error saving template:', error)
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 })
  }
}
