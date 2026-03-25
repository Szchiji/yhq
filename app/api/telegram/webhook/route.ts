import { NextRequest, NextResponse } from 'next/server'
import { sendMessage, isAdmin, isSuperAdmin, generateJoinConditionText, getBotUsername } from '@/lib/telegram'

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
      let data = callbackQuery.data
      const chatId = callbackQuery.message.chat.id
      const userId = callbackQuery.from.id.toString()
      const username = callbackQuery.from.username
      const firstName = callbackQuery.from.first_name
      const lastName = callbackQuery.from.last_name

      // Import here to avoid circular dependencies
      const { answerCallbackQuery } = await import('@/lib/telegram')
      const { prisma } = await import('@/lib/prisma')
      const { publishLottery } = await import('@/lib/lottery')

      // Handle button callbacks for new features
      if (data === 'show_lotteries') {
        const { handleShowLotteries } = await import('@/lib/botCommands')
        await handleShowLotteries(String(chatId), userId, callbackQuery.id)
        return NextResponse.json({ ok: true })
      }

      if (data === 'show_vip') {
        const { handleVipCommand } = await import('@/lib/vipPurchase')
        await handleVipCommand(String(chatId), userId)
        await answerCallbackQuery(callbackQuery.id)
        return NextResponse.json({ ok: true })
      }

      if (data === 'show_my') {
        const { handleMyCommand } = await import('@/lib/botCommands')
        await handleMyCommand(String(chatId), userId)
        await answerCallbackQuery(callbackQuery.id)
        return NextResponse.json({ ok: true })
      }

      if (data === 'show_help') {
        const { handleHelpCommand } = await import('@/lib/botCommands')
        await handleHelpCommand(String(chatId))
        await answerCallbackQuery(callbackQuery.id)
        return NextResponse.json({ ok: true })
      }

      if (data === 'back_to_menu') {
        const { handleStartCommand } = await import('@/lib/botCommands')
        const user = callbackQuery.from
        await handleStartCommand(String(chatId), userId, user)
        await answerCallbackQuery(callbackQuery.id)
        return NextResponse.json({ ok: true })
      }

      // Handle join_lottery_ callback (from lottery list)
      if (data.startsWith('join_lottery_')) {
        const lotteryId = data.replace('join_lottery_', '')
        // Process the same as join_ by modifying data
        data = `join_${lotteryId}`
      }

      if (data.startsWith('join_')) {
        // 参与抽奖
        const lotteryId = data.replace('join_', '').replace('lottery_', '')
        
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
            } else if (result.error === 'Blacklisted') {
              await sendMessage(chatId, result.message || '❌ 您已被加入黑名单，无法参与抽奖。如有疑问请联系管理员。')
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

      // Handle renewal rule selection (replacing VIP plan)
      if (data.startsWith('renewal_rule_')) {
        const ruleId = data.replace('renewal_rule_', '')
        
        try {
          const rule = await prisma.renewalRule.findUnique({
            where: { id: ruleId }
          })
          
          if (!rule || !rule.isEnabled) {
            await answerCallbackQuery(callbackQuery.id, '该套餐已下架')
            return NextResponse.json({ ok: true })
          }
          
          // Create order
          const orderNo = `ORDER${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`
          
          const order = await prisma.paymentOrder.create({
            data: {
              orderNo,
              telegramId: userId,
              orderType: `${rule.targetRole}_renewal`,
              ruleId: rule.id,
              amount: rule.price,
              currency: rule.currency,
              status: 'pending',
            }
          })
          
          await answerCallbackQuery(callbackQuery.id, '订单已创建')
          
          let message = `📋 续费订单详情\n\n`
          message += `订单号：${order.orderNo}\n`
          message += `套餐：${rule.name}\n`
          message += `时长：${rule.days === -1 ? '永久' : `${rule.days}天`}\n`
          message += `金额：${rule.price} ${rule.currency}\n\n`
          message += `💰 请联系管理员完成支付并激活。\n`
          message += `请提供订单号：${order.orderNo}`
          
          await sendMessage(chatId, message)
        } catch (error) {
          console.error('Error creating renewal order:', error)
          await answerCallbackQuery(callbackQuery.id, '创建订单失败')
          await sendMessage(chatId, '创建订单失败，请稍后重试')
        }
        return NextResponse.json({ ok: true })
      }

      // Handle buy_rule_ callback - select package
      if (data.startsWith('buy_rule_')) {
        const ruleId = data.replace('buy_rule_', '')
        const { handleSelectRule } = await import('@/lib/vipPurchase')
        await handleSelectRule(String(chatId), userId, ruleId, callbackQuery.id)
        return NextResponse.json({ ok: true })
      }

      // Handle paid_ callback - user clicked "I have paid"
      if (data.startsWith('paid_')) {
        const ruleId = data.replace('paid_', '')
        const { handlePaidClick } = await import('@/lib/vipPurchase')
        await handlePaidClick(String(chatId), userId, ruleId, callbackQuery.id)
        return NextResponse.json({ ok: true })
      }

      // Handle cancel_order callback
      if (data === 'cancel_order') {
        const { handleCancelOrder } = await import('@/lib/vipPurchase')
        await handleCancelOrder(String(chatId), callbackQuery.id)
        return NextResponse.json({ ok: true })
      }

      // Handle confirm_order_ callback - admin confirms order
      if (data.startsWith('confirm_order_')) {
        const orderId = data.replace('confirm_order_', '')
        const { handleConfirmOrder } = await import('@/lib/orderManagement')
        await handleConfirmOrder(String(chatId), userId, orderId, callbackQuery.id)
        return NextResponse.json({ ok: true })
      }

      // Handle reject_order_ callback - admin rejects order
      if (data.startsWith('reject_order_')) {
        const orderId = data.replace('reject_order_', '')
        const { handleRejectOrder } = await import('@/lib/orderManagement')
        await handleRejectOrder(String(chatId), userId, orderId, callbackQuery.id)
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
          // 获取该抽奖的参与条件群/频道
          const lottery = await prisma.lottery.findUnique({
            where: { id: lotteryId },
            include: {
              channels: true
            }
          })
          
          if (!lottery) {
            await answerCallbackQuery(callbackQuery.id, '抽奖不存在')
            await sendMessage(chatId, '⚠️ 抽奖不存在或已被删除')
            return NextResponse.json({ ok: true })
          }
          
          const channels = lottery.channels || []
          
          if (channels.length === 0) {
            await answerCallbackQuery(callbackQuery.id, '该抽奖无参与条件群/频道')
            await sendMessage(chatId, '⚠️ 该抽奖没有设置参与条件群/频道\n\n无法推送到参与条件群。')
            return NextResponse.json({ ok: true })
          }
          
          // 构建按钮列表
          const buttons = channels.map(channel => [{
            text: `📢 ${channel.title}`,
            callback_data: `publish_${lotteryId}_${channel.chatId}`
          }])
          
          // 添加"推送到全部"按钮
          buttons.push([{
            text: '🔔 推送到全部参与条件群',
            callback_data: `publish_all_${lotteryId}`
          }])
          
          await answerCallbackQuery(callbackQuery.id)
          await sendMessage(chatId, '请选择要推送的参与条件群/频道：', {
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
          if (!webappUrl) {
            await answerCallbackQuery(callbackQuery.id, '系统配置错误')
            await sendMessage(chatId, '❌ 系统配置错误，无法打开管理后台')
            return NextResponse.json({ ok: true })
          }
          
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
          if (!webappUrl) {
            await answerCallbackQuery(callbackQuery.id, '系统配置错误')
            await sendMessage(chatId, '❌ 系统配置错误，无法打开抽奖列表')
            return NextResponse.json({ ok: true })
          }
          
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
          
          // 使用参与条件群/频道
          const channels = lottery.channels || []
          
          if (channels.length === 0) {
            await answerCallbackQuery(callbackQuery.id, '该抽奖无参与条件群/频道')
            await sendMessage(chatId, '⚠️ 该抽奖没有设置参与条件群/频道')
            return NextResponse.json({ ok: true })
          }
          
          // 检查是否有已推送的
          if (!force && lottery.publishes.length > 0) {
            const chatNames = lottery.publishes.map(p => p.chatTitle || p.chatId).join('、')
            await sendMessage(chatId, `⚠️ 该抽奖已推送到以下群组：\n${chatNames}\n\n确定要再次推送到所有参与条件群吗？`, {
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
          
          // 推送到所有参与条件群
          let successCount = 0
          for (const channel of channels) {
            try {
              await publishLottery(lotteryId, channel.chatId, userId)
              successCount++
            } catch (e) {
              console.error(`Failed to publish to ${channel.chatId}:`, e)
            }
          }
          
          await answerCallbackQuery(callbackQuery.id, `✅ 已推送到 ${successCount} 个群组`)
          await sendMessage(chatId, `✅ 成功推送到 ${successCount}/${channels.length} 个参与条件群`)
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

      // ── 教师评价平台回调 ──────────────────────────────────────

      // 取消评价操作
      if (data === 'eval_cancel') {
        const { clearUserState } = await import('@/lib/teacherEval')
        await clearUserState(userId)
        await answerCallbackQuery(callbackQuery.id, '已取消')
        await sendMessage(chatId, '❌ 操作已取消。')
        return NextResponse.json({ ok: true })
      }

      // 截图上传完成
      if (data === 'eval_screenshots_done') {
        const { finishScreenshots } = await import('@/lib/teacherEval')
        await answerCallbackQuery(callbackQuery.id)
        await finishScreenshots(String(chatId), userId)
        return NextResponse.json({ ok: true })
      }

      // 选择预定义标签
      if (data.startsWith('eval_tag_')) {
        const tag = data.replace('eval_tag_', '')
        const { togglePredefinedTag } = await import('@/lib/teacherEval')
        await answerCallbackQuery(callbackQuery.id)
        await togglePredefinedTag(String(chatId), userId, tag)
        return NextResponse.json({ ok: true })
      }

      // 标签选择完成
      if (data === 'eval_tags_done') {
        const { finishTags } = await import('@/lib/teacherEval')
        await answerCallbackQuery(callbackQuery.id)
        await finishTags(String(chatId), userId)
        return NextResponse.json({ ok: true })
      }

      // 提交报告
      if (data === 'eval_submit_report') {
        const { submitReport } = await import('@/lib/teacherEval')
        await answerCallbackQuery(callbackQuery.id, '提交中...')
        await submitReport(String(chatId), userId)
        return NextResponse.json({ ok: true })
      }

      // 查看教师报告列表
      if (data.startsWith('eval_view_')) {
        const teacherUsername = data.replace('eval_view_', '')
        const { sendTeacherReportList } = await import('@/lib/teacherEval')
        await answerCallbackQuery(callbackQuery.id)
        await sendTeacherReportList(String(chatId), teacherUsername)
        return NextResponse.json({ ok: true })
      }

      // 查看报告详情
      if (data.startsWith('eval_report_')) {
        const reportId = data.replace('eval_report_', '')
        const { sendReportDetail } = await import('@/lib/teacherEval')
        await answerCallbackQuery(callbackQuery.id)
        await sendReportDetail(String(chatId), reportId)
        return NextResponse.json({ ok: true })
      }

      // 管理员审核：通过报告
      if (data.startsWith('eval_approve_')) {
        const reportId = data.replace('eval_approve_', '')
        const adminCheck = await isAdmin(userId) || isSuperAdmin(userId)
        if (!adminCheck) {
          await answerCallbackQuery(callbackQuery.id, '无权限')
          return NextResponse.json({ ok: true })
        }
        const { approveReport } = await import('@/lib/teacherEval')
        await answerCallbackQuery(callbackQuery.id, '处理中...')
        const result = await approveReport(userId, reportId)
        if (result) {
          await sendMessage(chatId, `✅ 报告已通过审核并发布。`)
        } else {
          await sendMessage(chatId, `⚠️ 报告不存在或已处理。`)
        }
        return NextResponse.json({ ok: true })
      }

      // 管理员审核：驳回报告（进入驳回原因输入状态）
      if (data.startsWith('eval_reject_')) {
        const reportId = data.replace('eval_reject_', '')
        const adminCheck = await isAdmin(userId) || isSuperAdmin(userId)
        if (!adminCheck) {
          await answerCallbackQuery(callbackQuery.id, '无权限')
          return NextResponse.json({ ok: true })
        }
        // Set admin's state to waiting for rejection reason
        const { setUserState } = await import('@/lib/teacherEval')
        await setUserState(userId, 'admin_reject_reason', { reportId })
        await answerCallbackQuery(callbackQuery.id)
        await sendMessage(
          chatId,
          `❌ 请输入驳回原因：`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: '❌ 取消', callback_data: 'eval_cancel' }]],
            },
          },
        )
        return NextResponse.json({ ok: true })
      }

      // ─────────────────────────────────────────────────────────

      await answerCallbackQuery(callbackQuery.id, '处理中...')

      return NextResponse.json({ ok: true })
    }

    // Handle incoming message
    if (body.message) {
      const message = body.message
      const chatId = message.chat.id
      const text = message.text || ''
      const userId = message.from?.id?.toString()
      const username = message.from?.username
      const firstName = message.from?.first_name

      // Check if user is waiting to submit payment proof
      if (userId) {
        const { userStates } = await import('@/lib/vipPurchase')
        const userState = userStates.get(userId)
        
        if (userState?.state === 'waiting_payment_proof') {
          const { handlePaymentProof } = await import('@/lib/vipPurchase')
          
          // Get payment proof from text or photo
          let proof = ''
          if (text) {
            proof = text
          } else if (message.photo && message.photo.length > 0) {
            // Get the largest photo
            const photo = message.photo[message.photo.length - 1]
            proof = `Photo: ${photo.file_id}`
          }
          
          if (proof) {
            await handlePaymentProof(
              String(chatId),
              userId,
              username,
              firstName,
              proof,
              userState.data.ruleId
            )
            userStates.delete(userId)
          } else {
            await sendMessage(chatId, '请发送文字或图片作为付款凭证')
          }
          
          return NextResponse.json({ ok: true })
        }
      }

      // ── 教师评价平台 FSM 状态处理（私聊消息）──────────────────
      if (userId && message.chat.type === 'private') {
        const {
          getUserState,
          handleQuickReason,
          handleReportField,
          handleReportScreenshot,
          handleTagInput,
          rejectReport,
          clearUserState,
        } = await import('@/lib/teacherEval')

        const evalState = await getUserState(userId)

        if (evalState) {
          // 管理员驳回原因输入
          if (evalState.state === 'admin_reject_reason' && text) {
            const data = evalState.data as any
            await rejectReport(userId, data.reportId, text)
            await clearUserState(userId)
            await sendMessage(chatId, `✅ 已驳回报告。`)
            return NextResponse.json({ ok: true })
          }

          // 快速评价理由输入
          if (evalState.state === 'quick_reason' && text) {
            const lastName = message.from?.last_name
            const name = [firstName, lastName].filter(Boolean).join(' ') || username || userId
            const handled = await handleQuickReason(
              String(chatId),
              userId,
              username,
              name,
              text,
            )
            if (handled) return NextResponse.json({ ok: true })
          }

          // 报告表单字段输入
          if (evalState.state.startsWith('report_field_') && text) {
            const handled = await handleReportField(String(chatId), userId, text)
            if (handled) return NextResponse.json({ ok: true })
          }

          // 报告截图接收
          if (evalState.state === 'report_screenshots') {
            if (message.photo && message.photo.length > 0) {
              const photo = message.photo[message.photo.length - 1]
              const handled = await handleReportScreenshot(String(chatId), userId, photo.file_id)
              if (handled) return NextResponse.json({ ok: true })
            }
            if (text === '/done') {
              const { finishScreenshots } = await import('@/lib/teacherEval')
              await finishScreenshots(String(chatId), userId)
              return NextResponse.json({ ok: true })
            }
          }

          // 标签自由输入
          if (evalState.state === 'report_tags' && text) {
            if (text === '/skip') {
              const { finishTags } = await import('@/lib/teacherEval')
              await finishTags(String(chatId), userId)
              return NextResponse.json({ ok: true })
            }
            const handled = await handleTagInput(String(chatId), userId, text)
            if (handled) return NextResponse.json({ ok: true })
          }
        }
      }

      // ── 群组中的 @mention 查询（教师统计卡片）───────────────────
      if (userId && message.chat.type !== 'private' && message.entities) {
        const { sendTeacherStatsCard } = await import('@/lib/teacherEval')
        for (const entity of message.entities) {
          if (entity.type === 'mention') {
            const mention = text.substring(entity.offset, entity.offset + entity.length)
            const teacherUsername = mention.replace(/^@/, '')
            if (teacherUsername) {
              await sendTeacherStatsCard(
                String(chatId),
                String(chatId),
                teacherUsername,
              )
              return NextResponse.json({ ok: true })
            }
          }
        }
      }

      // ── 群组中的 #标签 搜索 ─────────────────────────────────────
      if (userId && message.chat.type !== 'private' && text.includes('#')) {
        const tagMatches = text.match(/#([^\s#]+)/g)
        if (tagMatches && tagMatches.length > 0) {
          const tags = tagMatches.map((t: string) => t.replace(/^#/, ''))
          const { handleTagSearch } = await import('@/lib/teacherEval')
          await handleTagSearch(String(chatId), tags)
          return NextResponse.json({ ok: true })
        }
      }

      // ─────────────────────────────────────────────────────────────

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
          
          // ── 教师评价 start 参数: eval_username_groupId_action ──
          if (startParam?.startsWith('eval_')) {
            // Format: eval_{teacherUsername}_{groupId}_{action}
            // action = like / dislike / report
            try {
              const parts = startParam.split('_')
              // parts[0] = 'eval', parts[1] = teacherUsername, parts[2] = groupId, parts[3] = action
              if (parts.length < 4) {
                await sendMessage(chatId, '⚠️ 无效的评价链接。')
                return NextResponse.json({ ok: true })
              }
              const teacherUsername = parts[1]
              const groupId = parts[2]
              const action = parts[3] // like / dislike / report

              // Check forced subscription
              const { checkSubscription, sendSubscriptionPrompt } = await import('@/lib/teacherEval')
              const subCheck = await checkSubscription(userId || '')
              if (!subCheck.ok) {
                await sendSubscriptionPrompt(String(chatId), subCheck.missing)
                return NextResponse.json({ ok: true })
              }

              if (action === 'like' || action === 'dislike') {
                const { startQuickRate } = await import('@/lib/teacherEval')
                await startQuickRate(
                  String(chatId),
                  userId || '',
                  teacherUsername,
                  groupId,
                  action === 'like',
                )
              } else if (action === 'report') {
                const { startReportForm } = await import('@/lib/teacherEval')
                await startReportForm(String(chatId), userId || '', teacherUsername, groupId)
              }
            } catch (error) {
              console.error('Error handling eval start param:', error)
              await sendMessage(chatId, '⚠️ 处理失败，请稍后重试')
            }
            return NextResponse.json({ ok: true })
          }

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
            // 普通欢迎消息 - 使用新的欢迎界面
            const { handleStartCommand } = await import('@/lib/botCommands')
            await handleStartCommand(String(chatId), userId || '', message.from)
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

      // Handle /vip command - VIP purchase system
      if (text === '/vip' || text.startsWith('/vip ')) {
        if (!userId) {
          await sendMessage(chatId, '⛔ 无法识别用户身份')
          return NextResponse.json({ ok: true })
        }

        const { handleVipCommand } = await import('@/lib/vipPurchase')
        await handleVipCommand(String(chatId), userId)
        return NextResponse.json({ ok: true })
      }

      // Handle /help command
      if (text === '/help') {
        const { handleHelpCommand } = await import('@/lib/botCommands')
        await handleHelpCommand(String(chatId))
        return NextResponse.json({ ok: true })
      }

      // Handle /my command
      if (text === '/my') {
        if (!userId) {
          await sendMessage(chatId, '⛔ 无法识别用户身份')
          return NextResponse.json({ ok: true })
        }

        const { handleMyCommand } = await import('@/lib/botCommands')
        await handleMyCommand(String(chatId), userId)
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
