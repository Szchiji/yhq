import { prisma } from './prisma'
import { sendMessage } from './telegram'

export async function checkAndSendReminders() {
  const settings = await prisma.reminderSetting.findFirst()
  if (!settings?.isEnabled) return { sent: 0, skipped: 0 }

  const reminderDays = settings.reminderDays.split(',').map(Number)
  let sent = 0, skipped = 0

  for (const days of reminderDays) {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + days)
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // 检查 VIP 过期
    const expiringVips = await prisma.user.findMany({
      where: {
        isVip: true,
        vipExpireAt: { gte: startOfDay, lte: endOfDay }
      }
    })
    for (const user of expiringVips) {
      const result = await sendReminderIfNeeded(user.telegramId, 'vip', days, settings.vipTemplate)
      result ? sent++ : skipped++
    }

    // 检查管理员过期
    const expiringAdmins = await prisma.admin.findMany({
      where: {
        isActive: true,
      }
    })
    
    // Filter admins by checking User's adminExpireAt
    for (const admin of expiringAdmins) {
      const user = await prisma.user.findUnique({
        where: { telegramId: admin.telegramId }
      })
      
      if (user?.adminExpireAt && user.adminExpireAt >= startOfDay && user.adminExpireAt <= endOfDay) {
        const result = await sendReminderIfNeeded(admin.telegramId, 'admin', days, settings.adminTemplate)
        result ? sent++ : skipped++
      }
    }

    // 检查普通用户付费过期
    const expiringUsers = await prisma.user.findMany({
      where: {
        isPaid: true,
        paidExpireAt: { gte: startOfDay, lte: endOfDay }
      }
    })
    for (const user of expiringUsers) {
      const result = await sendReminderIfNeeded(user.telegramId, 'user', days, settings.userTemplate)
      result ? sent++ : skipped++
    }
  }

  return { sent, skipped }
}

async function sendReminderIfNeeded(telegramId: string, type: string, daysLeft: number, template?: string | null): Promise<boolean> {
  // 检查是否已发送过
  const existing = await prisma.reminderLog.findUnique({
    where: { telegramId_type_daysLeft: { telegramId, type, daysLeft } }
  })
  if (existing) return false

  const typeNames: Record<string, string> = { vip: 'VIP', admin: '管理员', user: '会员' }
  
  let message = template || `⚠️ ${typeNames[type]}即将过期提醒\n\n您的${typeNames[type]}权限将在 {daysLeft} 天后过期。\n\n请及时续费以继续使用服务。\n点击 /vip 查看续费方案。`
  message = message.replace(/{daysLeft}/g, String(daysLeft)).replace(/{type}/g, typeNames[type])

  await sendMessage(telegramId, message)
  await prisma.reminderLog.create({ data: { telegramId, type, daysLeft } })
  return true
}
