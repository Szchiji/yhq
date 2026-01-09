'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }, [pathname])
  
  // Set initial sidebar state based on screen size
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true)
      }
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  // Don't show sidebar on login/register pages
  const isAuthPage = pathname === '/login' || pathname === '/register'

  if (isAuthPage) {
    return children
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Mobile header with menu button */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-blue-900 md:hidden z-30 flex items-center px-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 text-white hover:bg-blue-800 rounded"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="ml-3 text-white font-semibold text-sm">抽奖机器人</h1>
      </div>
      
      <main className="flex-1 p-3 sm:p-4 md:p-6 pt-14 md:pt-6 md:ml-60">
        {children}
      </main>
    </div>
  )
}
