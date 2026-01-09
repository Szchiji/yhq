import { NextRequest, NextResponse } from 'next/server'
import { sendMessage, isAdmin, isSuperAdmin } from '@/lib/telegram'

// Get WebApp URL with fallback
function getWebAppUrl(): string {
  return process.env.WEBAPP_URL || process.env.VERCEL_URL || ''
}

// Telegram Bot webhook handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Handle incoming message
    if (body.message) {
      const message = body.message
      const chatId = message.chat.id
      const text = message.text || ''
      const userId = message.from?.id?.toString()

      // Handle /bot command - requires admin or super admin
      if (text.startsWith('/bot')) {
        if (!userId) {
          await sendMessage(chatId, '⛔ 无法识别用户身份')
          return NextResponse.json({ ok: true })
        }

        const userIsAdmin = await isAdmin(userId)
        const userIsSuperAdmin = isSuperAdmin(userId)

        if (!userIsAdmin && !userIsSuperAdmin) {
          await sendMessage(chatId, '⛔ 只有管理员可以使用此命令')
          return NextResponse.json({ ok: true })
        }

        const webappUrl = getWebAppUrl()
        await sendMessage(chatId, '👋 欢迎使用抽奖机器人管理后台', {
          reply_markup: {
            inline_keyboard: [[
              { text: '🎯 打开后台管理', web_app: { url: webappUrl } }
            ]]
          }
        })
        return NextResponse.json({ ok: true })
      }

      // Handle /new command - create lottery
      if (text.startsWith('/new')) {
        if (!userId) {
          await sendMessage(chatId, '⛔ 无法识别用户身份')
          return NextResponse.json({ ok: true })
        }

        const userIsAdmin = await isAdmin(userId)
        const userIsSuperAdmin = isSuperAdmin(userId)

        if (!userIsAdmin && !userIsSuperAdmin) {
          await sendMessage(chatId, '⛔ 只有管理员可以使用此命令')
          return NextResponse.json({ ok: true })
        }

        const webappUrl = getWebAppUrl()
        await sendMessage(chatId, '🎉 创建新的抽奖活动', {
          reply_markup: {
            inline_keyboard: [[
              { text: '➕ 创建抽奖', web_app: { url: `${webappUrl}/lottery/new` } }
            ]]
          }
        })
        return NextResponse.json({ ok: true })
      }

      // Handle /newinvite command - create invite lottery
      if (text.startsWith('/newinvite')) {
        if (!userId) {
          await sendMessage(chatId, '⛔ 无法识别用户身份')
          return NextResponse.json({ ok: true })
        }

        const userIsAdmin = await isAdmin(userId)
        const userIsSuperAdmin = isSuperAdmin(userId)

        if (!userIsAdmin && !userIsSuperAdmin) {
          await sendMessage(chatId, '⛔ 只有管理员可以使用此命令')
          return NextResponse.json({ ok: true })
        }

        const webappUrl = getWebAppUrl()
        await sendMessage(chatId, '👥 创建邀请抽奖链接', {
          reply_markup: {
            inline_keyboard: [[
              { text: '🔗 创建邀请抽奖', url: `${webappUrl}/lottery/new?type=invite` }
            ]]
          }
        })
        return NextResponse.json({ ok: true })
      }

      // Handle /mylottery command - view my lotteries
      if (text.startsWith('/mylottery')) {
        if (!userId) {
          await sendMessage(chatId, '⛔ 无法识别用户身份')
          return NextResponse.json({ ok: true })
        }

        const userIsAdmin = await isAdmin(userId)
        const userIsSuperAdmin = isSuperAdmin(userId)

        if (!userIsAdmin && !userIsSuperAdmin) {
          await sendMessage(chatId, '⛔ 只有管理员可以使用此命令')
          return NextResponse.json({ ok: true })
        }

        const webappUrl = getWebAppUrl()
        await sendMessage(chatId, '📋 查看我的抽奖列表', {
          reply_markup: {
            inline_keyboard: [[
              { text: '📝 我的抽奖', url: `${webappUrl}/lottery` }
            ]]
          }
        })
        return NextResponse.json({ ok: true })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
