import { prisma } from './prisma'
import { getChatMember } from './telegram'

/**
 * 检查用户是否已加入所有启用的强制加入群/频道
 * @param userId 用户的 Telegram ID
 * @returns 包含验证结果和缺失频道列表
 */
export async function checkForcedJoin(userId: string): Promise<{
  passed: boolean
  missingChannels: { title: string; inviteLink: string }[]
}> {
  try {
    // 获取所有启用的强制加入频道
    const forcedChannels = await prisma.forcedJoinChannel.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: 'asc' }
    })

    const missingChannels: { title: string; inviteLink: string }[] = []

    // 检查每个频道
    for (const channel of forcedChannels) {
      try {
        const memberInfo = await getChatMember(channel.chatId, userId)
        
        // 检查用户是否是成员
        const isMember = memberInfo.ok && 
          memberInfo.result && 
          ['member', 'administrator', 'creator'].includes(memberInfo.result.status)

        // 如果不是成员且该频道是必须的
        if (!isMember && channel.isRequired) {
          missingChannels.push({
            title: channel.title,
            inviteLink: channel.inviteLink || ''
          })
        }
      } catch (error) {
        console.error(`Error checking membership for channel ${channel.chatId}:`, error)
        // 如果检查失败且是必须的频道，假设用户未加入
        if (channel.isRequired) {
          missingChannels.push({
            title: channel.title,
            inviteLink: channel.inviteLink || ''
          })
        }
      }
    }

    return {
      passed: missingChannels.length === 0,
      missingChannels
    }
  } catch (error) {
    console.error('Error in checkForcedJoin:', error)
    // 出错时返回验证失败
    return {
      passed: false,
      missingChannels: []
    }
  }
}

/**
 * 获取所有启用的强制加入频道列表
 * @returns 强制加入频道数组
 */
export async function getEnabledForcedJoinChannels() {
  return await prisma.forcedJoinChannel.findMany({
    where: { isEnabled: true },
    orderBy: { sortOrder: 'asc' }
  })
}
