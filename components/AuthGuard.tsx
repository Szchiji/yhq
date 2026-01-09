'use client'

import { useTelegramWebApp } from '@/hooks/useTelegramWebApp'

export function AuthGuard({ children, requireSuperAdmin = false }: {
  children: React.ReactNode
  requireSuperAdmin?: boolean
}) {
  const { isReady, isAdmin, isSuperAdmin } = useTelegramWebApp()

  if (!isReady) {
    return <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">验证身份中...</p>
      </div>
    </div>
  }

  if (!isAdmin && !isSuperAdmin) {
    return <div className="flex items-center justify-center h-screen">
      <div className="text-center text-red-500">
        <p className="text-xl">⛔ 无权访问</p>
        <p className="mt-2">您不是管理员</p>
      </div>
    </div>
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <div className="flex items-center justify-center h-screen">
      <div className="text-center text-red-500">
        <p className="text-xl">⛔ 无权访问</p>
        <p className="mt-2">需要超级管理员权限</p>
      </div>
    </div>
  }

  return <>{children}</>
}
