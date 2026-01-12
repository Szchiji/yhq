import { prisma } from './prisma'
import { sendMessage, answerCallbackQuery, isSuperAdmin } from './telegram'

/**
 * 计算过期时间
 */
function calculateExpireAt(days: number): Date | null {
  if (days === -1) {
    // 永久：设置为2099年
    return new Date('2099-12-31T23:59:59Z')
  }
  const expireAt = new Date()
  expireAt.setDate(expireAt.getDate() + days)
  return expireAt
}

/**
 * 通知超级管理员新订单（使用 WebApp 按钮打开后台管理页面）
 */
export async function notifyAdminNewOrder(
  order: any,
  username: string | undefined,
  firstName: string | undefined
) {
  try {
    const superAdminId = process.env.SUPER_ADMIN_ID
    if (!superAdminId) {
      console.error('SUPER_ADMIN_ID not set')
      return
    }

    const webappUrl = process.env.WEBAPP_URL
    if (!webappUrl) {
      console.error('WEBAPP_URL not set')
      return
    }

    const roleNames: Record<string, string> = { 
      user: '普通用户', 
      vip: 'VIP会员', 
      admin: '管理员' 
    }

    const displayName = username ? `@${username}` : firstName || order.userId
    
    let message = `🔔 <b>新订单提醒</b>\n\n`
    message += `用户：${displayName} (${order.userId})\n`
    message += `套餐：${order.ruleName}\n`
    message += `金额：${order.amount} ${order.currency}\n`
    message += `权限：${roleNames[order.targetRole] || order.targetRole}\n`
    message += `付款凭证：${order.paymentProof || '无'}\n\n`
    message += `请前往后台「订单管理」页面处理。`

    await sendMessage(superAdminId, message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📋 打开订单管理', web_app: { url: `${webappUrl}/orders` } }
          ]
        ]
      }
    })
  } catch (error) {
    console.error('Error notifying admin:', error)
  }
}

/**
 * 处理管理员确认订单
 */
export async function handleConfirmOrder(
  chatId: string,
  adminId: string,
  orderId: string,
  callbackQueryId: string
) {
  try {
    // 验证是否是超级管理员
    if (!isSuperAdmin(adminId)) {
      await answerCallbackQuery(callbackQueryId, '⛔ 只有超级管理员可以确认订单')
      return
    }

    // 获取订单
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      await answerCallbackQuery(callbackQueryId, '订单不存在')
      await sendMessage(chatId, '⚠️ 订单不存在或已被删除')
      return
    }

    if (order.status !== 'pending') {
      await answerCallbackQuery(callbackQueryId, '订单已处理')
      await sendMessage(chatId, '⚠️ 该订单已被处理')
      return
    }

    // 根据目标角色开通权限
    const expireAt = calculateExpireAt(order.days)

    switch (order.targetRole) {
      case 'user':
        // 普通用户付费
        await prisma.user.update({
          where: { telegramId: order.userId },
          data: {
            isPaid: true,
            paidExpireAt: expireAt
          }
        })
        break

      case 'vip':
        // VIP
        await prisma.user.update({
          where: { telegramId: order.userId },
          data: {
            isVip: true,
            vipExpireAt: expireAt
          }
        })
        break

      case 'admin':
        // 管理员
        const user = await prisma.user.findUnique({
          where: { telegramId: order.userId }
        })
        
        if (user) {
          await prisma.admin.upsert({
            where: { telegramId: user.telegramId },
            create: {
              telegramId: user.telegramId,
              username: user.username || null,
              firstName: user.firstName || null,
              lastName: user.lastName || null,
              isActive: true,
              createdBy: adminId
            },
            update: {
              isActive: true
            }
          })
          
          // 更新用户的管理员状态
          await prisma.user.update({
            where: { telegramId: order.userId },
            data: {
              isAdmin: true,
              adminExpireAt: expireAt
            }
          })
        }
        break

      default:
        await answerCallbackQuery(callbackQueryId, '未知的角色类型')
        return
    }

    // 更新订单状态
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmedBy: adminId
      }
    })

    // 通知用户
    await notifyUserOrderConfirmed(order)

    // 回复管理员
    await answerCallbackQuery(callbackQueryId, '✅ 订单已确认')
    await sendMessage(chatId, `✅ 订单 ${order.orderNo} 已确认，用户权限已开通`)
  } catch (error) {
    console.error('Error in handleConfirmOrder:', error)
    await answerCallbackQuery(callbackQueryId, '确认失败')
    await sendMessage(chatId, '❌ 确认订单失败，请稍后重试')
  }
}

/**
 * 处理管理员拒绝订单
 */
export async function handleRejectOrder(
  chatId: string,
  adminId: string,
  orderId: string,
  callbackQueryId: string
) {
  try {
    // 验证是否是超级管理员
    if (!isSuperAdmin(adminId)) {
      await answerCallbackQuery(callbackQueryId, '⛔ 只有超级管理员可以拒绝订单')
      return
    }

    // 获取订单
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      await answerCallbackQuery(callbackQueryId, '订单不存在')
      await sendMessage(chatId, '⚠️ 订单不存在或已被删除')
      return
    }

    if (order.status !== 'pending') {
      await answerCallbackQuery(callbackQueryId, '订单已处理')
      await sendMessage(chatId, '⚠️ 该订单已被处理')
      return
    }

    // 更新订单状态
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectReason: '未收到付款或付款金额不符'
      }
    })

    // 通知用户
    await notifyUserOrderRejected(order, '未收到付款或付款金额不符')

    // 回复管理员
    await answerCallbackQuery(callbackQueryId, '✅ 订单已拒绝')
    await sendMessage(chatId, `✅ 订单 ${order.orderNo} 已拒绝，用户已收到通知`)
  } catch (error) {
    console.error('Error in handleRejectOrder:', error)
    await answerCallbackQuery(callbackQueryId, '拒绝失败')
    await sendMessage(chatId, '❌ 拒绝订单失败，请稍后重试')
  }
}

/**
 * 通知用户订单确认
 */
export async function notifyUserOrderConfirmed(order: any) {
  try {
    const roleNames: Record<string, string> = { 
      user: '普通用户', 
      vip: 'VIP会员', 
      admin: '管理员' 
    }

    const expireAt = calculateExpireAt(order.days)
    const expireText = order.days === -1 
      ? '永久' 
      : expireAt?.toLocaleDateString('zh-CN') || '未知'

    let message = `🎉 <b>恭喜！您的订单已确认</b>\n\n`
    message += `订单号：<code>${order.orderNo}</code>\n`
    message += `套餐：${order.ruleName}\n`
    message += `权限：${roleNames[order.targetRole] || order.targetRole}\n`
    message += `有效期至：${expireText}\n\n`
    message += `感谢您的支持！`

    await sendMessage(order.userId, message, { parse_mode: 'HTML' })
  } catch (error) {
    console.error('Error notifying user of confirmation:', error)
  }
}

/**
 * 通知用户订单被拒绝
 */
export async function notifyUserOrderRejected(order: any, reason?: string) {
  try {
    let message = `❌ <b>订单未通过</b>\n\n`
    message += `订单号：<code>${order.orderNo}</code>\n`
    message += `原因：${reason || '未收到付款或付款金额不符'}\n\n`
    message += `如有疑问请联系管理员。`

    await sendMessage(order.userId, message, { parse_mode: 'HTML' })
  } catch (error) {
    console.error('Error notifying user of rejection:', error)
  }
}
