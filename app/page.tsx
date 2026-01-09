'use client'

import Link from 'next/link'
import { AuthGuard } from '@/components/AuthGuard'
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp'

const quickActions = [
  {
    title: '创建抽奖',
    description: '快速创建一个新的抽奖活动',
    href: '/lottery/new',
    icon: '🎉',
    color: 'bg-blue-500',
  },
  {
    title: '查看模板',
    description: '管理抽奖消息模板',
    href: '/templates',
    icon: '📝',
    color: 'bg-green-500',
  },
  {
    title: '管理用户',
    description: '查看和管理参与用户',
    href: '/users',
    icon: '👥',
    color: 'bg-purple-500',
  },
  {
    title: '抽奖管理',
    description: '查看所有抽奖活动',
    href: '/lottery',
    icon: '🎯',
    color: 'bg-orange-500',
  },
]

function HomeContent() {
  const { user } = useTelegramWebApp()

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
          欢迎，{user?.first_name} {user?.last_name || ''}！
        </h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">选择下方快捷操作或从左侧菜单开始</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-3 sm:p-4 group"
          >
            <div
              className={`w-8 h-8 sm:w-10 sm:h-10 ${action.color} rounded-lg flex items-center justify-center text-lg sm:text-xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform`}
            >
              {action.icon}
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-1">
              {action.title}
            </h3>
            <p className="text-gray-600 text-xs sm:text-sm hidden sm:block">{action.description}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">系统概览</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="text-center p-2 sm:p-3 md:p-4 bg-blue-50 rounded-lg">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600">0</div>
            <div className="text-gray-600 text-xs sm:text-sm mt-1">活跃抽奖</div>
          </div>
          <div className="text-center p-2 sm:p-3 md:p-4 bg-green-50 rounded-lg">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">0</div>
            <div className="text-gray-600 text-xs sm:text-sm mt-1">总参与人数</div>
          </div>
          <div className="text-center p-2 sm:p-3 md:p-4 bg-purple-50 rounded-lg">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600">0</div>
            <div className="text-gray-600 text-xs sm:text-sm mt-1">已加入群组</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  )
}
