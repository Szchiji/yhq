import { NextRequest, NextResponse } from 'next/server'
import { getBotInfo, getChatMember, getChat } from '@/lib/telegram'

// POST - 检查机器人是否在群组/频道中且有权限
export async function POST(request: NextRequest) {
  try {
    const { chatId } = await request.json()

    if (!chatId) {
      return NextResponse.json({ 
        ok: false, 
        error: '缺少 chatId 参数' 
      }, { status: 400 })
    }

    // 1. 获取机器人自己的信息
    const botInfo = await getBotInfo()

    if (!botInfo.ok) {
      return NextResponse.json({ 
        ok: false, 
        error: '无法获取机器人信息' 
      }, { status: 500 })
    }

    // 2. 检查机器人是否在群组中
    const member = await getChatMember(chatId, botInfo.result.id)

    if (!member.ok) {
      return NextResponse.json({ 
        ok: false, 
        error: '机器人未加入该群组/频道，请先将机器人添加到群组并设为管理员' 
      })
    }

    // 3. 检查是否有发送消息权限
    const status = member.result.status
    if (!['administrator', 'creator'].includes(status)) {
      return NextResponse.json({ 
        ok: false, 
        error: '机器人需要管理员权限才能发送抽奖消息' 
      })
    }

    // 4. 获取群组信息
    const chatInfo = await getChat(chatId)

    if (!chatInfo.ok) {
      return NextResponse.json({ 
        ok: false, 
        error: '无法获取群组信息' 
      })
    }

    return NextResponse.json({ 
      ok: true, 
      chat: {
        id: String(chatInfo.result.id),
        title: chatInfo.result.title,
        type: chatInfo.result.type,
        username: chatInfo.result.username
      }
    })
  } catch (error) {
    console.error('Error checking channel:', error)
    return NextResponse.json({ 
      ok: false, 
      error: '检查失败，请稍后重试' 
    }, { status: 500 })
  }
}
