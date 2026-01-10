'use client'

import { useEffect, useState } from 'react'
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp'
import DataTable from '@/components/DataTable'

type ScheduledMessage = {
  id: string
  title: string
  content: string
  mediaType: string
  mediaUrl?: string
  targetType: string
  targetChatId?: string
  scheduledAt: string
  repeatType: string
  status: string
  sentAt?: string
  error?: string
  createdAt: string
  updatedAt: string
}

export default function ScheduledPage() {
  const { initData } = useTelegramWebApp()
  const [messages, setMessages] = useState<ScheduledMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    mediaType: 'none',
    mediaUrl: '',
    targetType: 'private',
    targetChatId: '',
    scheduledAt: '',
    repeatType: 'once',
  })

  const fetchMessages = async () => {
    try {
      const response = await fetch('/api/scheduled', {
        headers: {
          'x-telegram-init-data': initData || '',
        },
      })
      if (response.ok) {
        const result = await response.json()
        setMessages(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initData) {
      fetchMessages()
    }
  }, [initData])

  const handleSubmit = async () => {
    try {
      const url = editingMessage ? `/api/scheduled/${editingMessage.id}` : '/api/scheduled'
      const method = editingMessage ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData || '',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchMessages()
        setShowAddModal(false)
        setEditingMessage(null)
        setFormData({
          title: '',
          content: '',
          mediaType: 'none',
          mediaUrl: '',
          targetType: 'private',
          targetChatId: '',
          scheduledAt: '',
          repeatType: 'once',
        })
      } else {
        const error = await response.json()
        alert(`操作失败: ${error.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('Error saving message:', error)
      alert('保存失败')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条定时消息吗？')) return

    try {
      const response = await fetch(`/api/scheduled/${id}`, {
        method: 'DELETE',
        headers: {
          'x-telegram-init-data': initData || '',
        },
      })

      if (response.ok) {
        await fetchMessages()
      } else {
        alert('删除失败')
      }
    } catch (error) {
      console.error('Error deleting message:', error)
      alert('删除失败')
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('确定要取消这条定时消息吗？')) return

    try {
      const response = await fetch(`/api/scheduled/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData || '',
        },
        body: JSON.stringify({ action: 'cancel' }),
      })

      if (response.ok) {
        await fetchMessages()
      } else {
        alert('取消失败')
      }
    } catch (error) {
      console.error('Error cancelling message:', error)
      alert('取消失败')
    }
  }

  const openAddModal = () => {
    setEditingMessage(null)
    setFormData({
      title: '',
      content: '',
      mediaType: 'none',
      mediaUrl: '',
      targetType: 'private',
      targetChatId: '',
      scheduledAt: '',
      repeatType: 'once',
    })
    setShowAddModal(true)
  }

  const openEditModal = (message: ScheduledMessage) => {
    setEditingMessage(message)
    setFormData({
      title: message.title,
      content: message.content,
      mediaType: message.mediaType,
      mediaUrl: message.mediaUrl || '',
      targetType: message.targetType,
      targetChatId: message.targetChatId || '',
      scheduledAt: message.scheduledAt.substring(0, 16),
      repeatType: message.repeatType,
    })
    setShowAddModal(true)
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-700', text: '待发送' },
      sent: { color: 'bg-green-100 text-green-700', text: '已发送' },
      failed: { color: 'bg-red-100 text-red-700', text: '失败' },
      cancelled: { color: 'bg-gray-100 text-gray-700', text: '已取消' },
    }
    const { color, text } = statusMap[status] || statusMap.pending
    return <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{text}</span>
  }

  const columns = [
    { key: 'title', label: '标题' },
    {
      key: 'content',
      label: '内容',
      render: (item: ScheduledMessage) => (
        <span className="text-xs truncate max-w-[150px] block">{item.content}</span>
      ),
    },
    {
      key: 'scheduledAt',
      label: '发送时间',
      render: (item: ScheduledMessage) => (
        <span className="text-xs">{new Date(item.scheduledAt).toLocaleString('zh-CN')}</span>
      ),
    },
    {
      key: 'repeatType',
      label: '重复',
      render: (item: ScheduledMessage) => {
        const repeatMap: Record<string, string> = {
          once: '一次',
          daily: '每日',
          weekly: '每周',
          monthly: '每月',
        }
        return <span className="text-xs">{repeatMap[item.repeatType] || item.repeatType}</span>
      },
    },
    {
      key: 'status',
      label: '状态',
      render: (item: ScheduledMessage) => getStatusBadge(item.status),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: ScheduledMessage) => (
        <div className="flex gap-2">
          {item.status === 'pending' && (
            <>
              <button
                onClick={() => openEditModal(item)}
                className="text-blue-500 hover:text-blue-700 text-xs sm:text-sm"
              >
                编辑
              </button>
              <button
                onClick={() => handleCancel(item.id)}
                className="text-orange-500 hover:text-orange-700 text-xs sm:text-sm"
              >
                取消
              </button>
            </>
          )}
          <button
            onClick={() => handleDelete(item.id)}
            className="text-red-500 hover:text-red-700 text-xs sm:text-sm"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">定时发送</h1>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
          <p className="text-gray-600 text-sm sm:text-base">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">定时发送</h1>
        <button
          onClick={openAddModal}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm"
        >
          + 创建定时消息
        </button>
      </div>

      <DataTable columns={columns} data={messages} emptyMessage="暂无定时消息" />

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-2xl my-8">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
              {editingMessage ? '编辑定时消息' : '创建定时消息'}
            </h2>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  标题 *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="消息标题"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  内容 *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] text-sm"
                  placeholder="消息内容"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    媒体类型
                  </label>
                  <select
                    value={formData.mediaType}
                    onChange={(e) => setFormData({ ...formData, mediaType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="none">无媒体</option>
                    <option value="image">图片</option>
                    <option value="video">视频</option>
                  </select>
                </div>
                {formData.mediaType !== 'none' && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      媒体 URL
                    </label>
                    <input
                      type="text"
                      value={formData.mediaUrl}
                      onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="媒体文件 URL"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    目标类型 *
                  </label>
                  <select
                    value={formData.targetType}
                    onChange={(e) => setFormData({ ...formData, targetType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="private">私聊</option>
                    <option value="group">群组</option>
                    <option value="channel">频道</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    目标 Chat ID
                  </label>
                  <input
                    type="text"
                    value={formData.targetChatId}
                    onChange={(e) => setFormData({ ...formData, targetChatId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="目标聊天 ID（可选）"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    发送时间 *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    重复类型
                  </label>
                  <select
                    value={formData.repeatType}
                    onChange={(e) => setFormData({ ...formData, repeatType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="once">一次</option>
                    <option value="daily">每日</option>
                    <option value="weekly">每周</option>
                    <option value="monthly">每月</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setEditingMessage(null)
                }}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                {editingMessage ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
