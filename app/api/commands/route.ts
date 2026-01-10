import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTelegramUser, validateTelegramWebAppData, syncCommandsToTelegram } from '@/lib/telegram'
import { isSuperAdmin, isAdmin } from '@/lib/auth'

// Default commands to initialize
const DEFAULT_COMMANDS = [
  {
    command: '/start',
    prompt: '开始',
    description: '开始使用机器人',
    sortOrder: 10,
    isEnabled: true,
  },
  {
    command: '/new',
    prompt: '网页创建抽奖',
    description: '此命令可以创建抽奖',
    sortOrder: 20,
    isEnabled: true,
  },
  {
    command: '/create',
    prompt: '机器人创建抽奖',
    description: '通过对话方式完成抽奖创建',
    sortOrder: 20,
    isEnabled: true,
  },
  {
    command: '/newinvite',
    prompt: '创建邀请类型抽奖',
    description: '创建邀请类型抽奖',
    sortOrder: 30,
    isEnabled: true,
  },
  {
    command: '/mylottery',
    prompt: '我发起的抽奖',
    description: '查看我发起的抽奖活动',
    sortOrder: 40,
    isEnabled: true,
  },
  {
    command: '/vip',
    prompt: 'VIP会员',
    description: '查看VIP状态和续费',
    sortOrder: 50,
    isEnabled: true,
  },
]

// GET - 获取所有命令
export async function GET(request: NextRequest) {
  try {
    const commands = await prisma.botCommand.findMany({
      orderBy: {
        sortOrder: 'asc',
      },
    })

    // If no commands exist, initialize with defaults
    if (commands.length === 0) {
      const createdCommands = await prisma.$transaction(
        DEFAULT_COMMANDS.map(cmd => 
          prisma.botCommand.create({ data: cmd })
        )
      )
      return NextResponse.json({ data: createdCommands })
    }

    return NextResponse.json({ data: commands })
  } catch (error) {
    console.error('Error fetching commands:', error)
    return NextResponse.json({ error: 'Failed to fetch commands' }, { status: 500 })
  }
}

// POST - 创建/更新命令
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { command } = body
    
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

    // 检查是否是管理员或超级管理员
    const userId = user.id.toString()
    const userIsAdmin = await isAdmin(userId)
    const userIsSuperAdmin = isSuperAdmin(userId)

    if (!userIsAdmin && !userIsSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 })
    }

    // 验证必需字段
    if (!command.command || !command.prompt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 查找是否已存在该命令
    const existingCommand = await prisma.botCommand.findUnique({
      where: {
        command: command.command,
      },
    })

    let savedCommand
    if (existingCommand) {
      // 更新现有命令
      savedCommand = await prisma.botCommand.update({
        where: { id: existingCommand.id },
        data: {
          prompt: command.prompt,
          description: command.description || null,
          sortOrder: command.sortOrder !== undefined ? command.sortOrder : existingCommand.sortOrder,
          isEnabled: command.isEnabled !== undefined ? command.isEnabled : existingCommand.isEnabled,
        },
      })
    } else {
      // 创建新命令
      savedCommand = await prisma.botCommand.create({
        data: {
          command: command.command,
          prompt: command.prompt,
          description: command.description || null,
          sortOrder: command.sortOrder || 0,
          isEnabled: command.isEnabled !== undefined ? command.isEnabled : true,
        },
      })
    }

    // Sync commands to Telegram
    await syncCommandsToTelegram()

    return NextResponse.json(savedCommand, { status: existingCommand ? 200 : 201 })
  } catch (error: any) {
    console.error('Error saving command:', error)
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Command already exists' }, { status: 409 })
    }
    
    return NextResponse.json({ error: 'Failed to save command' }, { status: 500 })
  }
}
