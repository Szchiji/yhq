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
    
    // Handle callback_query (button clicks)
    if (body.callback_query) {
      const callbackQuery = body.callback_query
      const data = callbackQuery.data
      const chatId = callbackQuery.message.chat.id
      const userId = callbackQuery.from.id.toString()
      const username = callbackQuery.from.username
      const firstName = callbackQuery.from.first_name
      const lastName = callbackQuery.from.last_name

      // Import here to avoid circular dependencies
      const { answerCallbackQuery } = await import('@/lib/telegram')
      const { prisma } = await import('@/lib/prisma')

      if (data.startsWith('join_')) {
        // 参与抽奖
        const lotteryId = data.replace('join_', '')
        
        try {
          // Call join API
          const joinResponse = await fetch(`${process.env.WEBAPP_URL || ''}/api/lottery/${lotteryId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegramId: userId,
              username,
              firstName,
              lastName,
            }),
          })

          const result = await joinResponse.json()
          
          if (joinResponse.ok) {
            await answerCallbackQuery(callbackQuery.id, '参与成功！')
            await sendMessage(chatId, result.message || '✅ 您已成功参与抽奖！')
          } else {
            await answerCallbackQuery(callbackQuery.id, result.message || '参与失败')
            if (result.error === 'Already participated') {
              await sendMessage(chatId, '您已经参与过这个抽奖了')
            } else if (result.error === 'Username required') {
              await sendMessage(chatId, result.message || '参与此抽奖需要设置 Telegram 用户名')
            } else if (result.error === 'Channel membership required') {
              await sendMessage(chatId, result.message || '参与此抽奖需要加入指定的频道/群组')
            } else {
              await sendMessage(chatId, '参与抽奖失败，请稍后重试')
            }
          }
        } catch (error) {
          console.error('Error in join callback:', error)
          await answerCallbackQuery(callbackQuery.id, '处理失败')
          await sendMessage(chatId, '处理失败，请稍后重试')
        }
      } else {
        await answerCallbackQuery(callbackQuery.id, '处理中...')
      }

      return NextResponse.json({ ok: true })
    }

    // Handle incoming message
    if (body.message) {
      const message = body.message
      const chatId = message.chat.id
      const text = message.text || ''
      const userId = message.from?.id?.toString()

      // Handle /start command
      if (text === '/start' || text.startsWith('/start ')) {
        const startParam = text.split(' ')[1]
        
        if (startParam?.startsWith('lottery_')) {
          // 参与抽奖逻辑
          const lotteryId = startParam.replace('lottery_', '')
          
          try {
            const { prisma } = await import('@/lib/prisma')
            const lottery = await prisma.lottery.findUnique({
              where: { id: lotteryId },
              include: { prizes: true },
            })

            if (!lottery) {
              await sendMessage(chatId, '⚠️ 抽奖不存在或已结束')
              return NextResponse.json({ ok: true })
            }

            if (lottery.status !== 'active') {
              await sendMessage(chatId, '⚠️ 抽奖已结束')
              return NextResponse.json({ ok: true })
            }

            // 显示抽奖信息
            let message = `🎉 ${lottery.title}\n\n`
            if (lottery.description) {
              message += `${lottery.description}\n\n`
            }
            if (lottery.prizes && lottery.prizes.length > 0) {
              message += '🎁 奖品列表：\n'
              lottery.prizes.forEach((prize: any) => {
                message += `  • ${prize.name} (${prize.remaining}/${prize.total})\n`
              })
              message += '\n'
            }
            message += '点击下方按钮参与抽奖！'

            await sendMessage(chatId, message, {
              reply_markup: {
                inline_keyboard: [[
                  { text: '🎯 参与抽奖', callback_data: `join_${lotteryId}` }
                ]]
              }
            })
          } catch (error) {
            console.error('Error handling lottery start:', error)
            await sendMessage(chatId, '⚠️ 处理失败，请稍后重试')
          }
        } else if (startParam?.startsWith('invite_')) {
          // 处理邀请链接
          const parts = startParam.replace('invite_', '').split('_')
          const lotteryId = parts[0]
          const inviterId = parts[1]
          
          try {
            const { prisma } = await import('@/lib/prisma')
            const lottery = await prisma.lottery.findUnique({
              where: { id: lotteryId },
              include: { prizes: true },
            })

            if (!lottery || lottery.status !== 'active') {
              await sendMessage(chatId, '⚠️ 抽奖不存在或已结束')
              return NextResponse.json({ ok: true })
            }

            // 显示抽奖信息并记录邀请关系
            let message = `🎉 ${lottery.title}\n\n`
            if (lottery.description) {
              message += `${lottery.description}\n\n`
            }
            message += `👥 您通过邀请链接参与抽奖\n\n`
            message += '点击下方按钮参与抽奖！'

            // Store inviter info in callback data
            await sendMessage(chatId, message, {
              reply_markup: {
                inline_keyboard: [[
                  { text: '🎯 参与抽奖', callback_data: `join_${lotteryId}` }
                ]]
              }
            })
          } catch (error) {
            console.error('Error handling invite start:', error)
            await sendMessage(chatId, '⚠️ 处理失败，请稍后重试')
          }
        } else {
          // 普通欢迎消息
          await sendMessage(chatId, '👋 欢迎使用抽奖机器人！\n\n使用以下命令：\n/new - 创建抽奖\n/mylottery - 我的抽奖')
        }
        return NextResponse.json({ ok: true })
      }

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
