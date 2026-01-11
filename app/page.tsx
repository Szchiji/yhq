'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/AuthGuard'
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp'
import StatsCard from '@/components/StatsCard'
import TrendChart from '@/components/TrendChart'
import RecentLotteries from '@/components/RecentLotteries'
import RecentWinners from '@/components/RecentWinners'
import type { DashboardStats } from '@/types'

function HomeContent() {
  const { user, initData } = useTelegramWebApp()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(7)

  useEffect(() => {
    if (initData) {
      fetchStats()
    }
  }, [initData])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/stats', {
        headers: {
          'x-telegram-init-data': initData,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        console.error('Failed to fetch stats:', await response.text())
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载统计数据中...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>无法加载统计数据</p>
        <button
          onClick={fetchStats}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
          欢迎，{user?.first_name} {user?.last_name || ''}！
        </h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">数据统计仪表盘</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard
          title="总抽奖数"
          value={stats.totalLotteries}
          icon="🎯"
          color="blue"
        />
        <StatsCard
          title="总参与人次"
          value={stats.totalParticipants}
          icon="👥"
          color="green"
        />
        <StatsCard
          title="总用户数"
          value={stats.totalUsers}
          icon="👤"
          color="purple"
        />
        <StatsCard
          title="今日新增用户"
          value={stats.todayUsers}
          icon="📈"
          color="orange"
        />
      </div>

      {/* Trend Chart */}
      <TrendChart
        dailyUsers={stats.dailyStats.dailyUsers}
        dailyParticipants={stats.dailyStats.dailyParticipants}
        dailyLotteries={stats.dailyStats.dailyLotteries}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <RecentLotteries lotteries={stats.recentLotteries} />
        <RecentWinners winners={stats.recentWinners} />
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
