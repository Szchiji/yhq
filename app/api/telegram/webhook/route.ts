import { NextRequest, NextResponse } from 'next/server'
import { sendMessage, isAdmin, isSuperAdmin } from '@/lib/telegram'

// Get WebApp URL with fallback
function getWebAppUrl(): string {
  return process.env.WEBAPP_URL || process.env.VERCEL_URL || ''
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    ok: true, 
    message: 'Webhook is active',
    timestamp: new Date().toISOString()
  })
}

// Telegram Bot webhook handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Webhook received:', JSON.stringify(body).slice(0, 500))
    
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

      // Handle VIP plan selection
      if (data.startsWith('vip_plan_')) {
        const planId = data.replace('vip_plan_', '')
        
        try {
          const plan = await prisma.vipPlan.findUnique({
            where: { id: planId }
          })
          
          if (!plan || !plan.isEnabled) {
            await answerCallbackQuery(callbackQuery.id, '该套餐已下架')
            return NextResponse.json({ ok: true })
          }
          
          // Create order
          const orderNo = `VIP${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`
          
          const order = await prisma.vipOrder.create({
            data: {
              orderNo,
              telegramId: userId,
              planId: plan.id,
              amount: plan.price,
              currency: plan.currency,
              status: 'pending',
              createdBy: userId,
            }
          })
          
          await answerCallbackQuery(callbackQuery.id, '订单已创建')
          
          let message = `📋 VIP订单详情\n\n`
          message += `订单号：${order.orderNo}\n`
          message += `套餐：${plan.name}\n`
          message += `时长：${plan.days === -1 ? '永久' : `${plan.days}天`}\n`
          message += `金额：${plan.price} ${plan.currency}\n\n`
          message += `💰 请联系管理员完成支付并激活VIP。\n`
          message += `请提供订单号：${order.orderNo}`
          
          await sendMessage(chatId, message)
        } catch (error) {
          console.error('Error creating VIP order:', error)
          await answerCallbackQuery(callbackQuery.id, '创建订单失败')
          await sendMessage(chatId, '创建订单失败，请稍后重试')
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

      // 推送抽奖 - 显示可推送的群组/频道列表
      if (data.startsWith('push_lottery_')) {
        const lotteryId = data.replace('push_lottery_', '')
        
        try {
          // 获取所有公告群/频道
          const channels = await prisma.announcementChannel.findMany({
            orderBy: { createdAt: 'desc' }
          })
          
          if (channels.length === 0) {
            await answerCallbackQuery(callbackQuery.id, '暂无可推送的群组/频道')
            await sendMessage(chatId, '⚠️ 暂无配置的公告群/频道\n\n请先在管理后台添加公告群/频道。')
            return NextResponse.json({ ok: true })
          }
          
          // 构建按钮列表
          const buttons = channels.map(channel => [{
            text: `📢 ${channel.title}`,
            callback_data: `publish_${lotteryId}_${channel.chatId}`
          }])
          
          // 添加"推送到全部"按钮
          buttons.push([{
            text: '🔔 推送到全部群组',
            callback_data: `publish_all_${lotteryId}`
          }])
          
          await answerCallbackQuery(callbackQuery.id)
          await sendMessage(chatId, '请选择要推送的群组/频道：', {
            reply_markup: {
              inline_keyboard: buttons
            }
          })
        } catch (error) {
          console.error('Error in push_lottery callback:', error)
          await answerCallbackQuery(callbackQuery.id, '获取列表失败')
          await sendMessage(chatId, '❌ 获取群组列表失败，请稍后重试')
        }
        return NextResponse.json({ ok: true })
      }
      
      // 查看抽奖详情
      if (data.startsWith('view_lottery_')) {
        const lotteryId = data.replace('view_lottery_', '')
        
        try {
          const lottery = await prisma.lottery.findUnique({
            where: { id: lotteryId },
            include: {
              prizes: true,
              channels: true,
              _count: {
                select: {
                  participants: true,
                  winners: true
                }
              }
            }
          })
          
          if (!lottery) {
            await answerCallbackQuery(callbackQuery.id, '抽奖不存在')
            await sendMessage(chatId, '⚠️ 抽奖不存在或已被删除')
            return NextResponse.json({ ok: true })
          }
          
          // 构建详情消息
          const { generateJoinConditionText } = await import('@/lib/telegram')
          const { getBotUsername } = await import('@/lib/telegram')
          
          const botUsername = await getBotUsername()
          const joinCondition = lottery.channels && lottery.channels.length > 0
            ? generateJoinConditionText(lottery.channels)
            : '无需加入频道/群组'
          
          const goodsList = lottery.prizes && lottery.prizes.length > 0
            ? lottery.prizes.map(p => `💰 ${p.name} × ${p.total}`).join('\n')
            : '暂无奖品'
          
          const drawTime = lottery.drawTime 
            ? new Date(lottery.drawTime).toLocaleString('zh-CN')
            : ''
          const openCondition = lottery.drawType === 'time' 
            ? `${drawTime} 自动开奖` 
            : `满 ${lottery.drawCount} 人开奖`
          
          const statusEmoji = lottery.status === 'active' ? '🟢' : lottery.status === 'drawn' ? '🏆' : '⚪'
          const statusText = lottery.status === 'active' ? '进行中' : lottery.status === 'drawn' ? '已开奖' : '已结束'
          
          let detailMessage = `📋 抽奖详情\n\n`
          detailMessage += `${statusEmoji} 状态：${statusText}\n`
          detailMessage += `🎁 标题：${lottery.title}\n\n`
          
          if (lottery.description) {
            detailMessage += `📝 说明：${lottery.description}\n\n`
          }
          
          detailMessage += `🎁 奖品：\n${goodsList}\n\n`
          detailMessage += `🎫 参与条件：\n${joinCondition}\n\n`
          detailMessage += `⏰ 开奖条件：${openCondition}\n`
          detailMessage += `👥 参与人数：${lottery._count.participants}\n`
          
          if (lottery.status === 'drawn') {
            detailMessage += `🏆 中奖人数：${lottery._count.winners}\n`
          }
          
          detailMessage += `\n📅 创建时间：${lottery.createdAt.toLocaleString('zh-CN')}`
          
          await answerCallbackQuery(callbackQuery.id)
          await sendMessage(chatId, detailMessage, {
            reply_markup: {
              inline_keyboard: [[
                { text: '🔗 参与链接', url: `https://t.me/${botUsername}?start=lottery_${lottery.id}` }
              ]]
            }
          })
        } catch (error) {
          console.error('Error viewing lottery:', error)
          await answerCallbackQuery(callbackQuery.id, '获取详情失败')
          await sendMessage(chatId, '❌ 获取抽奖详情失败，请稍后重试')
        }
        return NextResponse.json({ ok: true })
      }
      
      // 管理抽奖
      if (data.startsWith('manage_lottery_')) {
        const lotteryId = data.replace('manage_lottery_', '')
        
        try {
          const webappUrl = getWebAppUrl()
          await answerCallbackQuery(callbackQuery.id)
          await sendMessage(chatId, '点击下方按钮打开管理后台：', {
            reply_markup: {
              inline_keyboard: [[
                { text: '⚙️ 打开管理后台', url: `${webappUrl}/lottery/${lotteryId}` }
              ]]
            }
          })
        } catch (error) {
          console.error('Error in manage_lottery callback:', error)
          await answerCallbackQuery(callbackQuery.id, '操作失败')
        }
        return NextResponse.json({ ok: true })
      }
      
      // 抽奖列表
      if (data === 'lottery_list') {
        try {
          const webappUrl = getWebAppUrl()
          await answerCallbackQuery(callbackQuery.id)
          await sendMessage(chatId, '点击下方按钮查看抽奖列表：', {
            reply_markup: {
              inline_keyboard: [[
                { text: '📋 我的抽奖', url: `${webappUrl}/lottery` }
              ]]
            }
          })
        } catch (error) {
          console.error('Error in lottery_list callback:', error)
          await answerCallbackQuery(callbackQuery.id, '操作失败')
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

      // Handle /start command - 简化版本，确保基本功能
      if (text === '/start' || text.startsWith('/start ')) {
        try {
          // 自动记录用户到数据库
          const user = message.from
          const now = new Date()
          
          if (user) {
            const { prisma } = await import('@/lib/prisma')
            await prisma.user.upsert({
              where: { telegramId: String(user.id) },
              create: {
                telegramId: String(user.id),
                username: user.username || null,
                firstName: user.first_name || null,
                lastName: user.last_name || null,
                lastActiveAt: now,
              },
              update: {
                username: user.username || null,
                firstName: user.first_name || null,
                lastName: user.last_name || null,
                lastActiveAt: now,
              }
            })
          }
          
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
            // 普通欢迎消息 - 简单版本，不依赖数据库
            await sendMessage(chatId, '👋 欢迎使用抽奖机器人！\n\n使用以下命令：\n/new - 创建抽奖\n/mylottery - 我的抽奖\n/vip - VIP会员')
          }
        } catch (error) {
          console.error('Error handling /start:', error)
          // 确保至少发送一个欢迎消息
          try {
            await sendMessage(chatId, '👋 欢迎使用抽奖机器人！')
          } catch (fallbackError) {
            console.error('Failed to send fallback message:', fallbackError)
          }
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

      // Handle /vip command - VIP membership
      if (text.startsWith('/vip')) {
        if (!userId) {
          await sendMessage(chatId, '⛔ 无法识别用户身份')
          return NextResponse.json({ ok: true })
        }

        const { prisma } = await import('@/lib/prisma')
        const { getSetting } = await import('@/lib/settings')
        
        // Get user info
        const user = await prisma.user.findUnique({
          where: { telegramId: userId }
        })
        
        const isVip = user?.isVip || false
        const vipExpireAt = user?.vipExpireAt
        
        // Get system settings
        const limitEnabled = (await getSetting('lottery_limit_enabled')) === 'true'
        const dailyLimit = parseInt((await getSetting('lottery_daily_limit')) || '3')
        const dailyJoinCount = user?.dailyJoinCount || 0
        
        // Build message
        let message = '💎 VIP会员中心\n\n'
        
        if (isVip) {
          message += '当前状态：✨ VIP会员\n'
          if (vipExpireAt) {
            const expireDate = new Date(vipExpireAt)
            if (expireDate.getFullYear() === 2099) {
              message += 'VIP到期：永久\n'
            } else {
              message += `VIP到期：${expireDate.toLocaleDateString('zh-CN')}\n`
            }
          }
        } else {
          message += '当前状态：普通用户\n'
        }
        
        if (limitEnabled && !isVip) {
          message += `\n今日剩余参与次数：${Math.max(0, dailyLimit - dailyJoinCount)}/${dailyLimit}\n`
        }
        
        message += '\n✨ VIP权益：\n'
        message += '• 无限创建抽奖\n'
        message += '• 无限参与抽奖\n'
        message += '• 推送到群/频道\n'
        
        // Get enabled VIP plans
        const plans = await prisma.vipPlan.findMany({
          where: { isEnabled: true },
          orderBy: { sortOrder: 'asc' }
        })
        
        if (plans.length > 0) {
          const buttons = plans.map(plan => [{
            text: `🛒 ${plan.name} ${plan.price} ${plan.currency}`,
            callback_data: `vip_plan_${plan.id}`
          }])
          
          await sendMessage(chatId, message, {
            reply_markup: {
              inline_keyboard: buttons
            }
          })
        } else {
          await sendMessage(chatId, message + '\n\n暂无可用的VIP套餐')
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
    // Return 200 to avoid Telegram retrying
    return NextResponse.json({ ok: false, error: String(error) })
  }
}
