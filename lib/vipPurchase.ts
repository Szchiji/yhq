import { prisma } from './prisma'
import { sendMessage, answerCallbackQuery } from './telegram'
import { notifyAdminNewOrder } from './orderManagement'

// 用户状态管理（用于等待付款凭证输入）
export const userStates = new Map<string, { state: string; data: any }>()

/**
 * 处理 /vip 命令 - 显示套餐列表
 */
export async function handleVipCommand(chatId: string, userId: string) {
  try {
    // 获取所有启用的续费规则
    const rules = await prisma.renewalRule.findMany({
      where: { isEnabled: true },
      orderBy: [{ targetRole: 'asc' }, { sortOrder: 'asc' }]
    })

    if (rules.length === 0) {
      await sendMessage(chatId, '暂无可用的套餐，请稍后再试。')
      return
    }

    // 按角色分组
    const userRules = rules.filter(r => r.targetRole === 'user')
    const vipRules = rules.filter(r => r.targetRole === 'vip')
    const adminRules = rules.filter(r => r.targetRole === 'admin')

    // 生成消息
    let message = '💎 <b>套餐购买</b>\n\n'
    
    if (userRules.length > 0) {
      message += '👤 <b>普通用户套餐：</b>\n'
      userRules.forEach(r => {
        message += `  • ${r.name} - ${r.price} ${r.currency}（${r.days === -1 ? '永久' : r.days + '天'}）\n`
      })
      message += '\n'
    }

    if (vipRules.length > 0) {
      message += '⭐ <b>VIP套餐：</b>\n'
      vipRules.forEach(r => {
        message += `  • ${r.name} - ${r.price} ${r.currency}（${r.days === -1 ? '永久' : r.days + '天'}）\n`
      })
      message += '\n'
    }

    if (adminRules.length > 0) {
      message += '👑 <b>管理员套餐：</b>\n'
      adminRules.forEach(r => {
        message += `  • ${r.name} - ${r.price} ${r.currency}（${r.days === -1 ? '永久' : r.days + '天'}）\n`
      })
      message += '\n'
    }

    message += '点击下方按钮选择套餐：'

    // 生成按钮
    const keyboard = []
    for (const r of rules) {
      keyboard.push([{
        text: `${r.name} ${r.price}${r.currency}`,
        callback_data: `buy_rule_${r.id}`
      }])
    }

    await sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    })
  } catch (error) {
    console.error('Error in handleVipCommand:', error)
    await sendMessage(chatId, '获取套餐列表失败，请稍后重试。')
  }
}

/**
 * 处理套餐选择 - 显示付款信息
 */
export async function handleSelectRule(
  chatId: string, 
  userId: string, 
  ruleId: string, 
  callbackQueryId: string
) {
  try {
    const rule = await prisma.renewalRule.findUnique({ where: { id: ruleId } })
    
    if (!rule || !rule.isEnabled) {
      await answerCallbackQuery(callbackQueryId, '套餐不存在或已下架')
      await sendMessage(chatId, '⚠️ 该套餐不存在或已下架')
      return
    }

    // 获取对应货币的收款地址
    const address = await prisma.paymentAddress.findFirst({
      where: { currency: rule.currency, isEnabled: true }
    })

    const roleNames: Record<string, string> = { 
      user: '普通用户', 
      vip: 'VIP会员', 
      admin: '管理员' 
    }

    let message = `💰 <b>订单信息</b>\n\n`
    message += `套餐：${rule.name}\n`
    message += `价格：${rule.price} ${rule.currency}\n`
    message += `权限：${roleNames[rule.targetRole] || rule.targetRole}\n`
    message += `有效期：${rule.days === -1 ? '永久' : rule.days + '天'}\n\n`

    if (address) {
      message += `📮 <b>请转账到以下地址：</b>\n`
      message += `网络：${address.network || rule.currency}\n`
      message += `地址：<code>${address.address}</code>\n\n`
    } else {
      message += `⚠️ <b>暂无收款地址，请联系管理员</b>\n\n`
    }

    message += `⚠️ 转账完成后，请点击「我已付款」按钮提交订单`

    await sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ 我已付款', callback_data: `paid_${ruleId}` },
            { text: '❌ 取消', callback_data: 'cancel_order' }
          ]
        ]
      }
    })

    await answerCallbackQuery(callbackQueryId)
  } catch (error) {
    console.error('Error in handleSelectRule:', error)
    await answerCallbackQuery(callbackQueryId, '获取订单信息失败')
    await sendMessage(chatId, '获取订单信息失败，请稍后重试。')
  }
}

/**
 * 处理「我已付款」点击 - 提示输入付款凭证
 */
export async function handlePaidClick(
  chatId: string,
  userId: string,
  ruleId: string,
  callbackQueryId: string
) {
  try {
    const rule = await prisma.renewalRule.findUnique({ where: { id: ruleId } })
    
    if (!rule || !rule.isEnabled) {
      await answerCallbackQuery(callbackQueryId, '套餐不存在或已下架')
      await sendMessage(chatId, '⚠️ 该套餐不存在或已下架')
      return
    }

    // 设置用户状态：等待输入付款凭证
    userStates.set(userId, { 
      state: 'waiting_payment_proof', 
      data: { ruleId: rule.id } 
    })

    const message = `请输入您的付款信息：\n\n` +
      `1️⃣ 发送交易哈希（TxHash）\n` +
      `2️⃣ 或发送付款截图\n\n` +
      `我们会在确认收款后为您开通服务。`

    await sendMessage(chatId, message)
    await answerCallbackQuery(callbackQueryId, '请发送付款凭证')
  } catch (error) {
    console.error('Error in handlePaidClick:', error)
    await answerCallbackQuery(callbackQueryId, '操作失败')
    await sendMessage(chatId, '操作失败，请稍后重试。')
  }
}

/**
 * 处理付款凭证提交 - 创建订单并通知管理员
 */
export async function handlePaymentProof(
  chatId: string,
  userId: string,
  username: string | undefined,
  firstName: string | undefined,
  proof: string,
  ruleId: string
) {
  try {
    const rule = await prisma.renewalRule.findUnique({ where: { id: ruleId } })
    
    if (!rule || !rule.isEnabled) {
      await sendMessage(chatId, '⚠️ 该套餐不存在或已下架')
      return
    }

    // 生成订单号 - 使用时间戳+随机字符串确保唯一性
    const orderNo = `ORD${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // 创建订单
    const order = await prisma.order.create({
      data: {
        orderNo,
        userId,
        username: username || null,
        firstName: firstName || null,
        ruleId: rule.id,
        ruleName: rule.name,
        amount: rule.price.toString(),
        currency: rule.currency,
        targetRole: rule.targetRole,
        days: rule.days,
        paymentProof: proof,
        status: 'pending'
      }
    })

    // 回复用户
    let message = `✅ <b>订单提交成功！</b>\n\n`
    message += `订单号：<code>${order.orderNo}</code>\n`
    message += `套餐：${rule.name}\n`
    message += `金额：${rule.price} ${rule.currency}\n\n`
    message += `我们会尽快确认您的付款，请耐心等待。\n`
    message += `确认后会自动为您开通服务。`

    await sendMessage(chatId, message, { parse_mode: 'HTML' })

    // 通知管理员
    await notifyAdminNewOrder(order, username, firstName)
  } catch (error) {
    console.error('Error in handlePaymentProof:', error)
    await sendMessage(chatId, '创建订单失败，请稍后重试。')
  }
}

/**
 * 处理取消订单
 */
export async function handleCancelOrder(chatId: string, callbackQueryId: string) {
  try {
    await answerCallbackQuery(callbackQueryId, '已取消')
    await sendMessage(chatId, '操作已取消')
  } catch (error) {
    console.error('Error in handleCancelOrder:', error)
    await answerCallbackQuery(callbackQueryId, '操作失败')
  }
}
