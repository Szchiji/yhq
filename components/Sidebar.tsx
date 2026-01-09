'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp'

type MenuItem = {
  name: string
  href?: string
  children?: MenuItem[]
}

const menuItems: MenuItem[] = [
  { name: '抽奖消息模板', href: '/templates' },
  { name: '公告群/频道设置', href: '/announcements' },
  { name: '已加入的群/频道', href: '/groups' },
  { name: '强制加入群/频道', href: '/forced-join' },
  { name: '抽奖管理', href: '/lottery' },
  { name: '抽奖用户管理', href: '/users' },
  {
    name: '定时发送',
    children: [
      { name: '私聊定时发送', href: '/scheduled/private' },
      { name: '私聊命令管理', href: '/scheduled/commands' },
    ],
  },
  { name: '管理员设置', href: '/admins' },
  {
    name: '收费管理',
    children: [
      { name: '收款地址管理', href: '/billing/address' },
      { name: '续费规则管理', href: '/billing/rules' },
      { name: '收费设置', href: '/billing/settings' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['定时发送', '收费管理'])
  const { user, isSuperAdmin, isAdmin } = useTelegramWebApp()

  const toggleMenu = (menuName: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuName)
        ? prev.filter((name) => name !== menuName)
        : [...prev, menuName]
    )
  }

  const renderMenuItem = (item: MenuItem, level = 0) => {
    if (item.children) {
      const isExpanded = expandedMenus.includes(item.name)
      const hasActiveChild = item.children.some(
        (child) => child.href && (pathname === child.href || pathname?.startsWith(child.href + '/'))
      )

      return (
        <div key={item.name}>
          <button
            onClick={() => toggleMenu(item.name)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
              hasActiveChild
                ? 'bg-blue-600 text-white'
                : 'text-gray-200 hover:bg-blue-700'
            }`}
          >
            <span>{item.name}</span>
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1">
              {item.children.map((child) => renderMenuItem(child, level + 1))}
            </div>
          )}
        </div>
      )
    }

    if (item.href) {
      const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
      return (
        <Link
          key={item.href}
          href={item.href}
          className={`block px-4 py-3 rounded-lg transition-colors ${
            level > 0 ? 'text-sm' : ''
          } ${
            isActive
              ? 'bg-blue-500 text-white'
              : 'text-gray-200 hover:bg-blue-700'
          }`}
        >
          {item.name}
        </Link>
      )
    }

    return null
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-blue-900 to-blue-800 shadow-lg overflow-y-auto flex flex-col">
      <div className="p-6 border-b border-blue-700">
        <h1 className="text-xl font-bold text-white">抽奖机器人</h1>
      </div>
      <nav className="p-4 space-y-2 flex-1">
        {menuItems.map((item) => renderMenuItem(item))}
      </nav>
      
      {/* User Info */}
      {user && (
        <div className="p-4 border-t border-blue-700">
          <div className="bg-blue-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium">
                {user.first_name} {user.last_name || ''}
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                isSuperAdmin
                  ? 'bg-yellow-500 text-yellow-900' 
                  : 'bg-blue-500 text-white'
              }`}>
                {isSuperAdmin ? '超级管理员' : '管理员'}
              </span>
            </div>
            {user.username && (
              <p className="text-blue-200 text-sm">@{user.username}</p>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
