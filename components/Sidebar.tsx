'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const menuItems = [
  { name: 'Lottery Message Template', href: '/templates' },
  { name: 'Announcement/Channel Settings', href: '/announcements' },
  { name: 'Joined Groups', href: '/groups' },
  { name: 'Forced Join', href: '/forced-join' },
  { name: 'Lottery Management', href: '/settings' },
  { name: 'User Management', href: '/users' },
  { name: 'Scheduled Sending', href: '/scheduled' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white shadow-lg">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">Lottery Bot</h1>
      </div>
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.name}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
