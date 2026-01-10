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
      const { publishLottery } = await import('@/lib/lottery')

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
            
            // Use template for success message
            const { getTemplate } = await import('@/lib/telegram')
            const { replaceAllPlaceholders } = await import('@/lib/placeholders')
            
            const lottery = await prisma.lottery.findUnique({
              where: { id: lotteryId },
              include: { 
                _count: { select: { participants: true } } 
              }
            })
            
            if (lottery) {
              const template = await getTemplate('user_join_success', lottery.createdBy)
              const message = replaceAllPlaceholders(template, {
                lotterySn: lottery.id.slice(0, 8),
                lotteryTitle: lottery.title,
                member: firstName || username || userId,
                joinNum: lottery._count.participants,
              })
              await sendMessage(chatId, message)
            } else {
              await sendMessage(chatId, result.message || '✅ 您已成功参与抽奖！')
            }
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
        return NextResponse.json({ ok: true })
      }

      // 推送到单个群组
      if (data.startsWith('publish_') && !data.startsWith('publish_all_')) {
        const parts = data.split('_')
        const lotteryId = parts[1]
        const targetChatId = parts[2]
        const force = data.includes('_force')
        
        try {
          // 检查是否已推送过
          if (!force) {
            const existingPublish = await prisma.lotteryPublish.findFirst({
              where: { lotteryId, chatId: targetChatId },
              orderBy: { publishedAt: 'desc' }
            })
            
            if (existingPublish) {
              // 显示确认提示
              const publishDate = existingPublish.publishedAt.toLocaleString('zh-CN')
              await sendMessage(chatId, `⚠️ 该抽奖已于 ${publishDate} 推送到「${existingPublish.chatTitle}」\n\n确定要再次推送吗？`, {
                reply_markup: {
                  inline_keyboard: [[
                    { text: '✅ 确认推送', callback_data: `publish_${lotteryId}_${targetChatId}_force` },
                    { text: '❌ 取消', callback_data: 'cancel' }
                  ]]
                }
              })
              await answerCallbackQuery(callbackQuery.id)
              return NextResponse.json({ ok: true })
            }
          }
          
          // 执行推送
          await publishLottery(lotteryId, targetChatId, userId)
          await answerCallbackQuery(callbackQuery.id, '✅ 已推送')
          await sendMessage(chatId, '✅ 抽奖已成功推送到群组')
        } catch (error) {
          console.error('Error publishing lottery:', error)
          await answerCallbackQuery(callbackQuery.id, '推送失败')
          await sendMessage(chatId, '❌ 推送失败，请稍后重试')
        }
        return NextResponse.json({ ok: true })
      }
      
      // 推送到全部
      if (data.startsWith('publish_all_')) {
        const lotteryId = data.replace('publish_all_', '').replace('_force', '')
        const force = data.includes('_force')
        
        try {
          const lottery = await prisma.lottery.findUnique({
            where: { id: lotteryId },
            include: { 
              publishes: true,
              channels: true
            }
          })
          
          if (!lottery) {
            await answerCallbackQuery(callbackQuery.id, '抽奖不存在')
            return NextResponse.json({ ok: true })
          }
          
          // 检查是否有已推送的
          if (!force && lottery.publishes.length > 0) {
            const chatNames = lottery.publishes.map(p => p.chatTitle || p.chatId).join('、')
            await sendMessage(chatId, `⚠️ 该抽奖已推送到以下群组：\n${chatNames}\n\n确定要再次推送到所有群组吗？`, {
              reply_markup: {
                inline_keyboard: [[
                  { text: '✅ 全部重新推送', callback_data: `publish_all_${lotteryId}_force` },
                  { text: '❌ 取消', callback_data: 'cancel' }
                ]]
              }
            })
            await answerCallbackQuery(callbackQuery.id)
            return NextResponse.json({ ok: true })
          }
          
          // 推送到所有群组
          let successCount = 0
          const channels = lottery.channels || []
          for (const channel of channels) {
            try {
              await publishLottery(lotteryId, channel.chatId, userId)
              successCount++
            } catch (e) {
              console.error(`Failed to publish to ${channel.chatId}:`, e)
            }
          }
          
          await answerCallbackQuery(callbackQuery.id, `✅ 已推送到 ${successCount} 个群组`)
          await sendMessage(chatId, `✅ 成功推送到 ${successCount}/${channels.length} 个群组`)
        } catch (error) {
          console.error('Error in publish all:', error)
          await answerCallbackQuery(callbackQuery.id, '推送失败')
          await sendMessage(chatId, '❌ 推送失败，请稍后重试')
        }
        return NextResponse.json({ ok: true })
      }
      
      // 取消操作
      if (data === 'cancel') {
        await answerCallbackQuery(callbackQuery.id, '已取消')
        await sendMessage(chatId, '操作已取消')
        return NextResponse.json({ ok: true })
      }

      await answerCallbackQuery(callbackQuery.id, '处理中...')

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
            const { getTemplate } = await import('@/lib/telegram')
            const { replaceAllPlaceholders } = await import('@/lib/placeholders')
            const { getBotUsername } = await import('@/lib/telegram')
            
            const lottery = await prisma.lottery.findUnique({
              where: { id: lotteryId },
              include: { 
                prizes: true,
                channels: true,
                _count: { select: { participants: true } }
              },
            })

            if (!lottery) {
              await sendMessage(chatId, '⚠️ 抽奖不存在或已结束')
              return NextResponse.json({ ok: true })
            }

            if (lottery.status !== 'active') {
              await sendMessage(chatId, '⚠️ 抽奖已结束')
              return NextResponse.json({ ok: true })
            }

            // 使用模板构建消息
            const template = await getTemplate('user_join_prompt', lottery.createdBy)
            const botUsername = await getBotUsername()
            
            const goodsList = lottery.prizes && lottery.prizes.length > 0
              ? lottery.prizes.map((p: any) => `💰 ${p.name} × ${p.total}`).join('\n')
              : '暂无奖品'
            
            const drawTime = lottery.drawTime 
              ? new Date(lottery.drawTime).toLocaleString('zh-CN')
              : ''
            const openCondition = lottery.drawType === 'time' 
              ? `${drawTime} 自动开奖` 
              : `满 ${lottery.drawCount} 人开奖`
            
            const lotteryLink = `https://t.me/${botUsername}?start=lottery_${lottery.id}`
            
            const message = replaceAllPlaceholders(template, {
              lotterySn: lottery.id.slice(0, 8),
              lotteryTitle: lottery.title,
              lotteryDesc: lottery.description || '',
              goodsList,
              openCondition,
              joinNum: lottery._count.participants,
              lotteryLink,
            })

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

      // Handle /vip command - view VIP status and plans
      if (text.startsWith('/vip')) {
        if (!userId) {
          await sendMessage(chatId, '⛔ 无法识别用户身份')
          return NextResponse.json({ ok: true })
        }

        try {
          // Get user VIP status
          const user = await prisma.user.findUnique({
            where: { telegramId: userId }
          })

          const isVip = user?.isVip || false
          const vipExpireAt = user?.vipExpireAt
          
          // Get VIP plans
          const plans = await prisma.vipPlan.findMany({
            where: { isEnabled: true },
            orderBy: { sortOrder: 'asc' }
          })

          // Build message
          let message = '💎 VIP会员中心\n\n'
          
          if (isVip) {
            if (vipExpireAt) {
              const daysLeft = Math.ceil((new Date(vipExpireAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              message += `当前状态：✅ VIP会员\n到期时间：${new Date(vipExpireAt).toLocaleDateString('zh-CN')}\n剩余天数：${daysLeft}天\n\n`
            } else {
              message += '当前状态：✅ 永久VIP会员\n\n'
            }
          } else {
            message += '当前状态：普通用户\n\n'
            
            // Check daily limit
            const settings = await prisma.systemSetting.findMany({
              where: { key: { in: ['lottery_limit_enabled', 'lottery_daily_limit'] } }
            })
            const limitEnabled = settings.find(s => s.key === 'lottery_limit_enabled')?.value === 'true'
            const dailyLimit = parseInt(settings.find(s => s.key === 'lottery_daily_limit')?.value || '3')
            
            if (limitEnabled) {
              const dailyJoinCount = user?.dailyJoinCount || 0
              const remaining = Math.max(0, dailyLimit - dailyJoinCount)
              message += `今日剩余参与次数：${remaining}/${dailyLimit}\n\n`
            }
          }

          message += '✨ VIP权益：\n'
          message += '• 无限创建抽奖\n'
          message += '• 无限参与抽奖\n'
          message += '• 推送到群/频道\n\n'

          // Build inline keyboard with plans
          const keyboard: any[][] = []
          
          for (const plan of plans) {
            const daysText = plan.days === -1 ? '永久' : `${plan.days}天`
            keyboard.push([{
              text: `🛒 ${plan.name} - ${plan.price} ${plan.currency} (${daysText})`,
              url: `${getWebAppUrl()}/billing/plans`  // Link to VIP management page
            }])
          }

          await sendMessage(chatId, message, {
            reply_markup: {
              inline_keyboard: keyboard
            }
          })
        } catch (error) {
          console.error('Error in /vip command:', error)
          await sendMessage(chatId, '获取VIP信息失败，请稍后重试')
        }
        return NextResponse.json({ ok: true })
      }

      // Handle /help command
      if (text === '/help') {
        await sendMessage(chatId, '📖 使用帮助\n\n/bot - 打开管理后台\n/new - 创建新抽奖\n/mylottery - 查看我的抽奖\n\n如需帮助，请联系管理员。')
        return NextResponse.json({ ok: true })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
