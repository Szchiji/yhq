'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp'

type MenuItem = {
  name: string
  href?: string
  children?: MenuItem[]
}

// Menu items configuration - filtered based on user role
const getSuperAdminMenuItems = (): MenuItem[] => [
  { name: '首页', href: '/' },
  { name: '抽奖列表', href: '/lottery' },
  { name: '消息模板', href: '/templates' },
  { name: '公告群/频道', href: '/announcements' },
  { name: '已加入的群/频道', href: '/groups' },
  { name: '强制加入群/频道', href: '/forced-join' },
  { name: '用户管理', href: '/users' },
  { name: '定时发送', href: '/scheduled' },
  { name: '私聊命令管理', href: '/commands' },
  { name: 'VIP套餐管理', href: '/vip-plans' },
  { name: '订单管理', href: '/orders' },
  { 
    name: '收费管理', 
    children: [
      { name: '收款地址管理', href: '/billing/address' },
      { name: '续费规则管理', href: '/billing/rules' },
      { name: '收费设置', href: '/billing/settings' },
    ]
  },
  { name: '管理员管理', href: '/admins' },
  { name: '系统设置', href: '/settings' },
]

const getAdminMenuItems = (): MenuItem[] => [
  { name: '首页', href: '/' },
  { name: '抽奖列表', href: '/lottery' },
  { name: '消息模板', href: '/templates' },
  { name: '已加入的群/频道', href: '/groups' },
  { name: '强制加入群/频道', href: '/forced-join' },
  { name: '用户管理', href: '/users' },
  { name: '定时发送', href: '/scheduled' },
  { name: '私聊命令管理', href: '/commands' },
  { name: 'VIP套餐管理', href: '/vip-plans' },
  { name: '订单管理', href: '/orders' },
]

type SidebarProps = {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])
  const { user, isSuperAdmin } = useTelegramWebApp()

  // Get menu items based on user role
  const menuItems = isSuperAdmin ? getSuperAdminMenuItems() : getAdminMenuItems()

  const toggleMenu = (menuName: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuName)
        ? prev.filter((name) => name !== menuName)
        : [...prev, menuName]
    )
  }

  const handleLinkClick = () => {
    // Close sidebar on mobile when a link is clicked
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      onClose()
    }
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
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-xs sm:text-sm ${
              hasActiveChild
                ? 'bg-blue-600 text-white'
                : 'text-gray-200 hover:bg-blue-700'
            }`}
          >
            <span>{item.name}</span>
            <svg
              className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isExpanded && (
            <div className="ml-3 mt-1 space-y-1">
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
          onClick={handleLinkClick}
          className={`block px-3 py-2 rounded-lg transition-colors text-xs sm:text-sm ${
            level > 0 ? 'text-xs' : ''
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
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen w-56 sm:w-60 bg-gradient-to-b from-blue-900 to-blue-800 shadow-lg overflow-y-auto flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        <div className="p-3 sm:p-4 border-b border-blue-700 flex items-center justify-between">
          <h1 className="text-sm sm:text-lg font-bold text-white">抽奖机器人</h1>
          <button
            onClick={onClose}
            className="md:hidden p-1 text-white hover:bg-blue-700 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="p-2 sm:p-3 space-y-1 flex-1">
          {menuItems.map((item) => renderMenuItem(item))}
        </nav>
        
        {/* User Info */}
        {user && (
          <div className="p-2 sm:p-3 border-t border-blue-700">
            <div className="bg-blue-700 rounded-lg p-2 sm:p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium text-xs sm:text-sm truncate max-w-[100px]">
                  {user.first_name} {user.last_name || ''}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  isSuperAdmin
                    ? 'bg-yellow-500 text-yellow-900' 
                    : 'bg-blue-500 text-white'
                }`}>
                  {isSuperAdmin ? '超管' : '管理'}
                </span>
              </div>
              {user.username && (
                <p className="text-blue-200 text-xs truncate">@{user.username}</p>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
