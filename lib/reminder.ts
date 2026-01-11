import { prisma } from './prisma'
import { sendMessage } from './telegram'

export async function checkAndSendReminders() {
  // 获取提醒设置
  const settings = await prisma.reminderSetting.findFirst()
  if (!settings?.isEnabled) return

  const reminderDays = settings.reminderDays.split(',').map(Number) // [7, 3, 1]

  for (const days of reminderDays) {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + days)
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))

    // 检查 VIP 过期
    const expiringVips = await prisma.user.findMany({
      where: {
        isVip: true,
        vipExpireAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    })

    for (const user of expiringVips) {
      await sendReminderIfNeeded(user.telegramId, 'vip', days, settings.vipTemplate)
    }

    // 检查管理员过期
    const expiringAdmins = await prisma.user.findMany({
      where: {
        isAdmin: true,
        adminExpireAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    })

    for (const admin of expiringAdmins) {
      await sendReminderIfNeeded(admin.telegramId, 'admin', days, settings.adminTemplate)
    }

    // 检查普通用户付费过期
    const expiringUsers = await prisma.user.findMany({
      where: {
        isPaid: true,
        paidExpireAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    })

    for (const user of expiringUsers) {
      await sendReminderIfNeeded(user.telegramId, 'user', days, settings.userTemplate)
    }
  }
}

async function sendReminderIfNeeded(
  telegramId: string,
  type: string,
  daysLeft: number,
  template?: string | null
) {
  // 检查是否已发送过
  const existing = await prisma.reminderLog.findUnique({
    where: {
      telegramId_type_daysLeft: { telegramId, type, daysLeft }
    }
  })

  if (existing) return // 已发送过，跳过

  // 生成消息
  const typeNames: Record<string, string> = {
    vip: 'VIP',
    admin: '管理员',
    user: '会员'
  }

  const message = template || `
⚠️ ${typeNames[type]}即将过期提醒

您的${typeNames[type]}权限将在 ${daysLeft} 天后过期。

请及时续费以继续使用服务。
点击 /vip 查看续费方案。
  `.trim()

  // 发送消息
  try {
    await sendMessage(telegramId, message)

    // 记录已发送
    await prisma.reminderLog.create({
      data: { telegramId, type, daysLeft }
    })
  } catch (error) {
    console.error(`Failed to send reminder to ${telegramId}:`, error)
  }
}
