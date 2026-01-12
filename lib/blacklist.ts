import { prisma } from './prisma'

/**
 * Check if a user is blacklisted
 */
export async function isBlacklisted(telegramId: string): Promise<boolean> {
  const record = await prisma.blacklist.findUnique({
    where: { telegramId }
  })
  return !!record
}

/**
 * Get blacklist reason for a user
 */
export async function getBlacklistReason(telegramId: string): Promise<string | null> {
  const record = await prisma.blacklist.findUnique({
    where: { telegramId }
  })
  return record?.reason || null
}
