/**
 * Permission utilities for role-based access control
 */

type UserRole = 'USER' | 'VIP' | 'ADMIN' | 'SUPER_ADMIN'

interface User {
  role: UserRole
  isPaid?: boolean
  paidExpireAt?: Date | string | null
  isVip?: boolean
  vipExpireAt?: Date | string | null
  isAdmin?: boolean
  adminExpireAt?: Date | string | null
}

type Feature = 
  | 'create_lottery'
  | 'join_lottery'
  | 'manage_templates'
  | 'manage_groups'
  | 'manage_forced_join'
  | 'manage_scheduled'
  | 'manage_commands'
  | 'manage_vip_plans'
  | 'manage_orders'
  | 'manage_billing'
  | 'manage_admins'
  | 'manage_users'
  | 'system_settings'
  | 'all'

/**
 * Check if a user can access a specific feature
 */
export function canAccessFeature(user: User, feature: Feature): boolean {
  // 超级管理员可以访问所有功能
  if (user.role === 'SUPER_ADMIN') return true
  
  // 管理员需要付费且未过期
  if (user.role === 'ADMIN') {
    if (!user.isAdmin || !user.adminExpireAt) return false
    if (new Date(user.adminExpireAt) < new Date()) return false
    
    // 管理员可以访问的功能
    const adminFeatures: Feature[] = [
      'create_lottery',
      'join_lottery',
      'manage_templates',
      'manage_groups',
      'manage_forced_join',
      'manage_scheduled',
      'manage_commands',
      'manage_vip_plans',
      'manage_orders',
      'manage_users'
    ]
    
    return adminFeatures.includes(feature)
  }
  
  // VIP 可以创建抽奖
  if (user.role === 'VIP') {
    if (!user.isVip || !user.vipExpireAt) return false
    if (new Date(user.vipExpireAt) < new Date()) return false
    return feature === 'create_lottery' || feature === 'join_lottery'
  }
  
  // 普通用户只能参与抽奖（需要付费）
  if (user.role === 'USER') {
    if (!user.isPaid || !user.paidExpireAt) return false
    if (new Date(user.paidExpireAt) < new Date()) return false
    return feature === 'join_lottery'
  }
  
  return false
}

/**
 * Check if user's payment/subscription is valid
 */
export function isSubscriptionValid(user: User): boolean {
  if (user.role === 'SUPER_ADMIN') return true
  
  if (user.role === 'ADMIN') {
    if (!user.isAdmin || !user.adminExpireAt) return false
    return new Date(user.adminExpireAt) >= new Date()
  }
  
  if (user.role === 'VIP') {
    if (!user.isVip || !user.vipExpireAt) return false
    return new Date(user.vipExpireAt) >= new Date()
  }
  
  if (user.role === 'USER') {
    if (!user.isPaid || !user.paidExpireAt) return false
    return new Date(user.paidExpireAt) >= new Date()
  }
  
  return false
}

/**
 * Get user's role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    SUPER_ADMIN: '超级管理员',
    ADMIN: '管理员',
    VIP: 'VIP用户',
    USER: '普通用户'
  }
  return roleNames[role] || '未知'
}
