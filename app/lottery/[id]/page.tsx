'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost } from '@/lib/api'

type Prize = {
  id: string
  name: string
  total: number
  remaining: number
}

type Channel = {
  id: string
  chatId: string
  title: string
  type: string
  username?: string | null
}

type Lottery = {
  id: string
  title: string
  description?: string
  status: string
  drawType: string
  drawTime?: string
  drawCount?: number
  createdAt: string
  drawnAt?: string
  prizes: Prize[]
  channels?: Channel[]
  _count: {
    participants: number
    winners: number
  }
}

type Participant = {
  id: string
  telegramId: string
  username?: string
  firstName?: string
  lastName?: string
  joinedAt: string
  inviteCount: number
}

export default function LotteryDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [lottery, setLottery] = useState<Lottery | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'participants'>('info')
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    fetchLottery()
    fetchParticipants()
  }, [params.id])

  const fetchLottery = async () => {
    try {
      const response = await apiGet(`/api/lottery/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setLottery(data)
      } else {
        console.error('Failed to fetch lottery')
      }
    } catch (error) {
      console.error('Error fetching lottery:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchParticipants = async () => {
    try {
      const response = await apiGet(`/api/lottery/${params.id}/participants?limit=100`)
      if (response.ok) {
        const data = await response.json()
        setParticipants(data.data)
      }
    } catch (error) {
      console.error('Error fetching participants:', error)
    }
  }

  const handleDraw = async () => {
    if (!confirm('确认要开奖吗？此操作不可撤销。')) {
      return
    }

    setDrawing(true)
    try {
      const response = await apiPost(`/api/lottery/${params.id}/draw`)

      if (response.ok) {
        const result = await response.json()
        alert(`开奖成功！共有 ${result.winners.length} 位中奖者`)
        fetchLottery()
      } else {
        const error = await response.json()
        alert(`开奖失败：${error.message || error.error}`)
      }
    } catch (error) {
      console.error('Error drawing lottery:', error)
      alert('开奖失败，请稍后重试')
    } finally {
      setDrawing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!lottery) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <div className="text-gray-500 mb-4">抽奖不存在</div>
        <button
          onClick={() => router.push('/lottery')}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          返回列表
        </button>
      </div>
    )
  }

  const statusMap: Record<string, { text: string; color: string }> = {
    active: { text: '进行中', color: 'bg-green-100 text-green-800' },
    drawn: { text: '已开奖', color: 'bg-blue-100 text-blue-800' },
    cancelled: { text: '已取消', color: 'bg-gray-100 text-gray-800' },
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">抽奖详情</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/lottery')}
            className="px-3 py-1.5 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs sm:text-sm"
          >
            返回列表
          </button>
          {lottery.status === 'active' && (
            <button
              onClick={handleDraw}
              disabled={drawing}
              className="px-3 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-xs sm:text-sm"
            >
              {drawing ? '开奖中...' : '手动开奖'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 sm:px-6 py-2 sm:py-3 font-medium transition-colors text-xs sm:text-sm ${
              activeTab === 'info'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            基本信息
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={`px-4 sm:px-6 py-2 sm:py-3 font-medium transition-colors text-xs sm:text-sm ${
              activeTab === 'participants'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            参与者 ({lottery._count.participants})
          </button>
        </div>

        <div className="p-3 sm:p-4 md:p-6">
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">{lottery.title}</h2>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-2 py-1 rounded text-xs ${statusMap[lottery.status].color}`}>
                    {statusMap[lottery.status].text}
                  </span>
                  <span className="text-xs sm:text-sm text-gray-500">
                    创建于 {new Date(lottery.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
                {lottery.description && (
                  <p className="text-sm sm:text-base text-gray-600 whitespace-pre-wrap">{lottery.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                  <div className="text-xs sm:text-sm text-gray-500 mb-1">开奖方式</div>
                  <div className="text-sm sm:text-base font-medium text-gray-800">
                    {lottery.drawType === 'time' ? '定时开奖' : '人满开奖'}
                  </div>
                  {lottery.drawType === 'time' && lottery.drawTime && (
                    <div className="text-xs text-gray-600 mt-1">
                      {new Date(lottery.drawTime).toLocaleString('zh-CN')}
                    </div>
                  )}
                  {lottery.drawType === 'count' && lottery.drawCount && (
                    <div className="text-xs text-gray-600 mt-1">
                      需要 {lottery.drawCount} 人参与
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                  <div className="text-xs sm:text-sm text-gray-500 mb-1">参与统计</div>
                  <div className="text-sm sm:text-base font-medium text-gray-800">
                    {lottery._count.participants} 人参与
                  </div>
                  {lottery._count.winners > 0 && (
                    <div className="text-xs text-gray-600 mt-1">
                      {lottery._count.winners} 人中奖
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-medium text-gray-800 mb-3">奖品列表</h3>
                {lottery.prizes.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-sm">暂无奖品</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700">奖品名称</th>
                          <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700">总数</th>
                          <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700">剩余</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {lottery.prizes.map((prize) => (
                          <tr key={prize.id}>
                            <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-800">{prize.name}</td>
                            <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-600">{prize.total}</td>
                            <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-600">{prize.remaining}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {lottery.channels && lottery.channels.length > 0 && (
                <div>
                  <h3 className="text-sm sm:text-base font-medium text-gray-800 mb-3">参与条件 - 需加入的群组/频道</h3>
                  <div className="space-y-2">
                    {lottery.channels.map((channel) => (
                      <div
                        key={channel.id}
                        className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
                      >
                        <span className="text-xs sm:text-sm text-gray-800">
                          {channel.title}
                          {channel.username && (
                            <span className="text-gray-400 ml-1">@{channel.username}</span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500">
                          {channel.type === 'channel' ? '频道' : '群组'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Participants Tab */}
          {activeTab === 'participants' && (
            <div className="space-y-4">
              {participants.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500 text-sm">暂无参与者</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700">用户</th>
                        <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700">用户名</th>
                        <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700">邀请人数</th>
                        <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700">参与时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {participants.map((participant) => (
                        <tr key={participant.id}>
                          <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-800">
                            {participant.firstName || participant.lastName
                              ? `${participant.firstName || ''} ${participant.lastName || ''}`.trim()
                              : participant.telegramId}
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-600">
                            {participant.username ? `@${participant.username}` : '-'}
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-600">
                            {participant.inviteCount}
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-600">
                            {new Date(participant.joinedAt).toLocaleString('zh-CN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
