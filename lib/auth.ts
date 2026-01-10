import { prisma } from './prisma'

/**
 * Check if a user is a super admin
 * Supports multiple super admin IDs from environment variable
 */
export function isSuperAdmin(telegramId: string): boolean {
  const superAdminIds = process.env.SUPER_ADMIN_IDS?.split(',').map(id => id.trim()) || []
  
  // Fallback to legacy SUPER_ADMIN_ID for backward compatibility
  const legacySuperAdminId = process.env.SUPER_ADMIN_ID
  if (legacySuperAdminId) {
    superAdminIds.push(legacySuperAdminId)
  }
  
  return superAdminIds.includes(telegramId)
}

/**
 * Check if a user is an admin (either super admin or regular admin)
 */
export async function isAdmin(telegramId: string): Promise<boolean> {
  // Check if user is super admin
  if (isSuperAdmin(telegramId)) {
    return true
  }
  
  // Check if user is a regular admin in database
  const admin = await prisma.admin.findUnique({
    where: { telegramId }
  })
  
  return !!admin && admin.isActive
}

/**
 * Require super admin access, throws error if not authorized
 */
export function requireSuperAdmin(telegramId: string): void {
  if (!isSuperAdmin(telegramId)) {
    throw new Error('Unauthorized: Super admin access required')
  }
}

/**
 * Require admin access (super admin or regular admin), throws error if not authorized
 */
export async function requireAdmin(telegramId: string): Promise<void> {
  const isAdminUser = await isAdmin(telegramId)
  if (!isAdminUser) {
    throw new Error('Unauthorized: Admin access required')
  }
}
