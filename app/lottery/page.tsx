'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiDelete, apiPost } from '@/lib/api'
import PublishModal from '@/components/PublishModal'

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
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [publishingLotteryId, setPublishingLotteryId] = useState<string | null>(null)

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
      
      const response = await apiGet(`/api/lottery?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setLotteries(data.data)
      } else {
        const error = await response.json()
        console.error('Failed to fetch lotteries:', error)
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error)
    } finally {
      setLoading(false)
    }
  }

  // 删除确认
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`确定要删除抽奖「${title}」吗？此操作不可恢复。`)) {
      return
    }
    
    try {
      const response = await apiDelete(`/api/lottery/${id}`)
      
      if (response.ok) {
        alert('删除成功')
        fetchLotteries() // 刷新列表
      } else {
        const data = await response.json()
        alert(`删除失败: ${data.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('删除失败，请重试')
    }
  }

  // 手动开奖
  const handleDraw = async (id: string) => {
    if (!confirm('确定要立即开奖吗？开奖后无法撤销。')) {
      return
    }
    
    try {
      const response = await apiPost(`/api/lottery/${id}/draw`)
      
      if (response.ok) {
        const data = await response.json()
        alert(`开奖成功！共 ${data.winners?.length || 0} 人中奖`)
        fetchLotteries() // 刷新列表
      } else {
        const data = await response.json()
        alert(`开奖失败: ${data.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('Draw error:', error)
      alert('开奖失败，请重试')
    }
  }

  // 推送抽奖
  const handlePublish = (id: string) => {
    setPublishingLotteryId(id)
    setShowPublishModal(true)
  }

  const closePublishModal = () => {
    setShowPublishModal(false)
    setPublishingLotteryId(null)
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
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        {/* 查看详情 */}
                        <button
                          onClick={() => router.push(`/lottery/${lottery.id}`)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                          title="查看详情"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        
                        {/* 编辑 - 仅进行中的抽奖 */}
                        {lottery.status === 'active' && (
                          <button
                            onClick={() => router.push(`/lottery/${lottery.id}/edit`)}
                            className="p-1.5 text-yellow-500 hover:bg-yellow-50 rounded transition-colors"
                            title="编辑"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        
                        {/* 推送 - 仅进行中的抽奖 */}
                        {lottery.status === 'active' && (
                          <button
                            onClick={() => handlePublish(lottery.id)}
                            className="p-1.5 text-green-500 hover:bg-green-50 rounded transition-colors"
                            title="推送"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                            </svg>
                          </button>
                        )}
                        
                        {/* 手动开奖 - 仅进行中的抽奖 */}
                        {lottery.status === 'active' && (
                          <button
                            onClick={() => handleDraw(lottery.id)}
                            className="p-1.5 text-purple-500 hover:bg-purple-50 rounded transition-colors"
                            title="手动开奖"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                        
                        {/* 删除 */}
                        <button
                          onClick={() => handleDelete(lottery.id, lottery.title)}
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

      {/* Publish Modal */}
      {showPublishModal && publishingLotteryId && (
        <PublishModal
          lotteryId={publishingLotteryId}
          onClose={closePublishModal}
          onSuccess={() => {
            // Optionally refresh the list
            fetchLotteries()
          }}
        />
      )}
    </div>
  )
}
