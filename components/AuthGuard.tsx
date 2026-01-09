'use client'

import { useTelegramWebApp } from '@/hooks/useTelegramWebApp'

export function AuthGuard({ children, requireSuperAdmin = false }: {
  children: React.ReactNode
  requireSuperAdmin?: boolean
}) {
  const { isReady, isAdmin, isSuperAdmin } = useTelegramWebApp()

  if (!isReady) {
    return <div className="flex items-center justify-center h-[50vh] sm:h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">验证身份中...</p>
      </div>
    </div>
  }

  if (!isAdmin && !isSuperAdmin) {
    return <div className="flex items-center justify-center h-[50vh] sm:h-screen">
      <div className="text-center text-red-500">
        <p className="text-lg sm:text-xl">⛔ 无权访问</p>
        <p className="mt-2 text-sm sm:text-base">您不是管理员</p>
      </div>
    </div>
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <div className="flex items-center justify-center h-[50vh] sm:h-screen">
      <div className="text-center text-red-500">
        <p className="text-lg sm:text-xl">⛔ 无权访问</p>
        <p className="mt-2 text-sm sm:text-base">需要超级管理员权限</p>
      </div>
    </div>
  }

  return <>{children}</>
}
