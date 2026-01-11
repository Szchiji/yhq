'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPatch, apiDelete, apiPost } from '@/lib/api'

type Winner = {
  id: string
  telegramId: string
  username: string | null
  firstName: string | null
  prizeName: string
  claimed: boolean
  claimedAt: string | null
  createdAt: string
  notified: boolean
  user: {
    id: string
    username: string | null
    firstName: string | null
    telegramId: string
  } | null
  lottery: {
    id: string
    title: string
    status: string
  } | null
  prize: {
    id: string
    name: string
  } | null
}

type Lottery = {
  id: string
  title: string
}

export default function WinnersPage() {
  const [winners, setWinners] = useState<Winner[]>([])
  const [lotteries, setLotteries] = useState<Lottery[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 20

  // Filters
  const [lotteryId, setLotteryId] = useState('')
  const [telegramId, setTelegramId] = useState('')
  const [status, setStatus] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchLotteries()
  }, [])

  useEffect(() => {
    fetchWinners()
  }, [page, lotteryId, telegramId, status, startDate, endDate])

  const fetchLotteries = async () => {
    try {
      const response = await apiGet('/api/lottery')
      if (response.ok) {
        const data = await response.json()
        setLotteries(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error)
    }
  }

  const fetchWinners = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', limit.toString())
      if (lotteryId) params.append('lotteryId', lotteryId)
      if (telegramId) params.append('telegramId', telegramId)
      if (status !== 'all') params.append('status', status)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await apiGet(`/api/winners?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setWinners(data.winners)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      } else {
        console.error('Failed to fetch winners')
      }
    } catch (error) {
      console.error('Error fetching winners:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleClaimed = async (winner: Winner) => {
    const newStatus = !winner.claimed
    if (!confirm(`确定要标记为${newStatus ? '已领取' : '未领取'}吗？`)) {
      return
    }

    try {
      const response = await apiPatch(`/api/winners/${winner.id}`, { claimed: newStatus })
      if (response.ok) {
        fetchWinners()
      } else {
        const error = await response.json()
        alert(`更新失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error updating winner:', error)
      alert('更新失败，请重试')
    }
  }

  const handleResend = async (winnerId: string) => {
    if (!confirm('确定要重新发送中奖通知吗？')) {
      return
    }

    try {
      const response = await apiPost(`/api/winners/${winnerId}/resend`)
      if (response.ok) {
        const data = await response.json()
        alert(data.message || '通知已发送')
        fetchWinners()
      } else {
        const error = await response.json()
        alert(`发送失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error resending notification:', error)
      alert('发送失败，请重试')
    }
  }

  const handleDelete = async (winner: Winner) => {
    if (!confirm(`确定要删除用户「${winner.firstName || winner.username || winner.telegramId}」的中奖记录吗？此操作不可恢复。`)) {
      return
    }

    try {
      const response = await apiDelete(`/api/winners/${winner.id}`)
      if (response.ok) {
        alert('删除成功')
        fetchWinners()
      } else {
        const error = await response.json()
        alert(`删除失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting winner:', error)
      alert('删除失败，请重试')
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (lotteryId) params.append('lotteryId', lotteryId)
      if (telegramId) params.append('telegramId', telegramId)
      if (status !== 'all') params.append('status', status)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await apiGet(`/api/winners/export?${params.toString()}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `winners_${Date.now()}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert('导出失败')
      }
    } catch (error) {
      console.error('Error exporting winners:', error)
      alert('导出失败，请重试')
    }
  }

  const resetFilters = () => {
    setLotteryId('')
    setTelegramId('')
    setStatus('all')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">中奖记录</h1>
        <button
          onClick={handleExport}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-xs sm:text-sm"
        >
          📥 导出 CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Lottery Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">抽奖活动</label>
            <select
              value={lotteryId}
              onChange={(e) => {
                setLotteryId(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">全部抽奖</option>
              {lotteries.map((lottery) => (
                <option key={lottery.id} value={lottery.id}>
                  {lottery.title}
                </option>
              ))}
            </select>
          </div>

          {/* User Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">用户搜索</label>
            <input
              type="text"
              value={telegramId}
              onChange={(e) => {
                setTelegramId(e.target.value)
                setPage(1)
              }}
              placeholder="输入 Telegram ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">领奖状态</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">全部</option>
              <option value="claimed">已领取</option>
              <option value="unclaimed">未领取</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Reset Button */}
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              重置筛选
            </button>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">{total}</div>
          <div className="text-xs sm:text-sm text-gray-600">总中奖数</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">
            {winners.filter(w => w.claimed).length}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">已领取</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-600">
            {winners.filter(w => !w.claimed).length}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">未领取</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-600">
            {winners.filter(w => w.notified).length}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">已通知</div>
        </div>
      </div>

      {/* Winners List */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : winners.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">暂无中奖记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">中奖用户</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">抽奖标题</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">奖品名称</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">中奖时间</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">状态</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {winners.map((winner) => (
                  <tr key={winner.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-4">
                      <div className="text-xs sm:text-sm font-medium text-gray-800">
                        {winner.firstName || winner.username || '-'}
                      </div>
                      {winner.username && (
                        <div className="text-xs text-gray-500">@{winner.username}</div>
                      )}
                      <div className="text-xs text-gray-400 font-mono">{winner.telegramId}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-600">
                      {winner.lottery?.title || '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-600">
                      {winner.prize?.name || winner.prizeName}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-600">
                      {new Date(winner.createdAt).toLocaleString('zh-CN', { 
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-0.5 rounded text-xs inline-block ${
                          winner.claimed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {winner.claimed ? '✓ 已领取' : '⏳ 未领取'}
                        </span>
                        {winner.notified && (
                          <span className="px-2 py-0.5 rounded text-xs inline-block bg-blue-100 text-blue-700">
                            📧 已通知
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        {/* Toggle Claimed */}
                        <button
                          onClick={() => handleToggleClaimed(winner)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                          title={winner.claimed ? '标记为未领取' : '标记为已领取'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </button>

                        {/* Resend Notification */}
                        <button
                          onClick={() => handleResend(winner.id)}
                          className="p-1.5 text-green-500 hover:bg-green-50 rounded transition-colors"
                          title="补发通知"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(winner)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="删除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-white border rounded-lg disabled:opacity-50 text-sm"
          >
            上一页
          </button>
          <span className="px-3 py-1 text-sm">
            第 {page} / {totalPages} 页 (共 {total} 条)
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 bg-white border rounded-lg disabled:opacity-50 text-sm"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
