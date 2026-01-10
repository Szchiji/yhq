import { prisma } from './prisma'

// Check if user is super admin (from environment variable)
export function isSuperAdmin(telegramId: string): boolean {
  const superAdminIds = process.env.SUPER_ADMIN_IDS?.split(',').map(id => id.trim()) || []
  
  // Fallback to legacy SUPER_ADMIN_ID for backward compatibility
  const legacySuperAdminId = process.env.SUPER_ADMIN_ID
  if (legacySuperAdminId && telegramId === legacySuperAdminId) {
    return true
  }
  
  return superAdminIds.includes(telegramId)
}

// Check if user is admin (super admin or regular admin)
export async function isAdmin(telegramId: string): Promise<boolean> {
  if (isSuperAdmin(telegramId)) return true
  
  const admin = await prisma.admin.findUnique({
    where: { telegramId }
  })
  return !!admin && admin.isActive
}

// Verify user has required permission level
export async function requireSuperAdmin(telegramId: string): Promise<boolean> {
  if (!isSuperAdmin(telegramId)) {
    throw new Error('仅超级管理员可访问此功能')
  }
  return true
}

export async function requireAdmin(telegramId: string): Promise<boolean> {
  if (!(await isAdmin(telegramId))) {
    throw new Error('仅管理员可访问此功能')
  }
  return true
}
