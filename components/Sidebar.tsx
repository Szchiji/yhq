'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

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

type User = {
  id: string
  username: string
  email: string | null
  role: string
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['定时发送', '收费管理'])
  const [user, setUser] = useState<User | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  useEffect(() => {
    // Fetch current user
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user)
        }
      })
      .catch(() => {
        // Handle error silently
      })
  }, [])

  const toggleMenu = (menuName: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuName)
        ? prev.filter((name) => name !== menuName)
        : [...prev, menuName]
    )
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    setLogoutError('')
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      setLoggingOut(false)
      setLogoutError('退出登录失败，请重试')
      // Auto-clear error after 3 seconds
      setTimeout(() => setLogoutError(''), 3000)
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
      
      {/* User Info and Logout */}
      {user && (
        <div className="p-4 border-t border-blue-700">
          <div className="bg-blue-700 rounded-lg p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium">{user.username}</span>
              <span className={`text-xs px-2 py-1 rounded ${
                user.role === 'SUPERADMIN' 
                  ? 'bg-yellow-500 text-yellow-900' 
                  : 'bg-blue-500 text-white'
              }`}>
                {user.role === 'SUPERADMIN' ? '超级管理员' : '管理员'}
              </span>
            </div>
            {user.email && (
              <p className="text-blue-200 text-sm truncate">{user.email}</p>
            )}
          </div>
          {logoutError && (
            <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
              {logoutError}
            </div>
          )}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors disabled:bg-red-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {loggingOut ? '退出中...' : '退出登录'}
          </button>
        </div>
      )}
    </aside>
  )
}
