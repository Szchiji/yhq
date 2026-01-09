'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Lottery = {
  id: string
  title: string
  status: string
  drawType: string
  createdAt: string
  _count: {
    participants: number
    winners: number
  }
}

export default function LotteryPage() {
  const router = useRouter()
  const [lotteries, setLotteries] = useState<Lottery[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchLotteries()
  }, [statusFilter])

  const fetchLotteries = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      
      const response = await fetch(`/api/lottery?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setLotteries(data.data)
      } else {
        console.error('Failed to fetch lotteries')
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error)
    } finally {
      setLoading(false)
    }
  }

  const statusMap: Record<string, { text: string; color: string }> = {
    active: { text: '进行中', color: 'bg-green-100 text-green-800' },
    drawn: { text: '已开奖', color: 'bg-blue-100 text-blue-800' },
    cancelled: { text: '已取消', color: 'bg-gray-100 text-gray-800' },
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">抽奖列表</h1>
        <button
          onClick={() => router.push('/lottery/new')}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm"
        >
          + 创建抽奖
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
              statusFilter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
              statusFilter === 'active'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            进行中
          </button>
          <button
            onClick={() => setStatusFilter('drawn')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
              statusFilter === 'drawn'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            已开奖
          </button>
        </div>
      </div>

      {/* Lottery List */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : lotteries.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">暂无抽奖</p>
            <button
              onClick={() => router.push('/lottery/new')}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
            >
              创建第一个抽奖
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">标题</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">状态</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">开奖方式</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">参与人数</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">创建时间</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lotteries.map((lottery) => (
                  <tr key={lottery.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-4">
                      <div className="text-xs sm:text-sm font-medium text-gray-800">{lottery.title}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${statusMap[lottery.status].color}`}>
                        {statusMap[lottery.status].text}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-600">
                      {lottery.drawType === 'time' ? '定时开奖' : '人满开奖'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-600">
                      {lottery._count.participants}
                      {lottery._count.winners > 0 && (
                        <span className="text-green-600 ml-1">({lottery._count.winners} 中奖)</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-600">
                      {new Date(lottery.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <button
                        onClick={() => router.push(`/lottery/${lottery.id}`)}
                        className="text-blue-500 hover:text-blue-700 text-xs sm:text-sm"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
