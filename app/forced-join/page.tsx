'use client'

import { useState, useEffect } from 'react'
import DataTable from '@/components/DataTable'

type ForcedJoinGroup = {
  id: string
  chatId: string
  title: string
  type: string
  username?: string | null
  inviteLink?: string | null
  isRequired: boolean
  isEnabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export default function ForcedJoinPage() {
  const [groups, setGroups] = useState<ForcedJoinGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newChatId, setNewChatId] = useState('')
  const [isRequired, setIsRequired] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchGroups = async () => {
    try {
      setLoading(true)
      const initData = (window as any).Telegram?.WebApp?.initData
      if (!initData) {
        throw new Error('Telegram WebApp not initialized')
      }

      const response = await fetch('/api/forced-join', {
        headers: {
          'x-telegram-init-data': initData
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch forced join channels')
      }

      const result = await response.json()
      setGroups(result.data || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching forced join channels:', err)
      setError('Failed to load forced join channels')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [])

  const columns = [
    { key: 'title', label: '名称' },
    { 
      key: 'chatId', 
      label: 'Chat ID',
      render: (item: ForcedJoinGroup) => (
        <span className="text-xs font-mono">{item.chatId}</span>
      ),
    },
    {
      key: 'type',
      label: '类型',
      render: (item: ForcedJoinGroup) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.type === 'channel' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
        }`}>
          {item.type === 'channel' ? '频道' : item.type === 'supergroup' ? '超级群' : '群组'}
        </span>
      ),
    },
    {
      key: 'isRequired',
      label: '强制',
      render: (item: ForcedJoinGroup) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.isRequired ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {item.isRequired ? '必须' : '可选'}
        </span>
      ),
    },
    {
      key: 'isEnabled',
      label: '状态',
      render: (item: ForcedJoinGroup) => (
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={item.isEnabled}
            onChange={() => handleToggle(item.id, item.isEnabled)}
            className="mr-2"
          />
          <span className={`px-2 py-0.5 rounded text-xs ${
            item.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {item.isEnabled ? '启用' : '停用'}
          </span>
        </label>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: ForcedJoinGroup) => (
        <div className="flex gap-2">
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

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    try {
      const initData = (window as any).Telegram?.WebApp?.initData
      if (!initData) {
        throw new Error('Telegram WebApp not initialized')
      }

      const response = await fetch(`/api/forced-join/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData
        },
        body: JSON.stringify({ isEnabled: !currentEnabled })
      })

      if (!response.ok) {
        throw new Error('Failed to toggle channel')
      }

      await fetchGroups()
    } catch (err) {
      console.error('Error toggling channel:', err)
      alert('切换状态失败，请重试')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个强制加入群/频道吗？')) {
      return
    }

    try {
      const initData = (window as any).Telegram?.WebApp?.initData
      if (!initData) {
        throw new Error('Telegram WebApp not initialized')
      }

      const response = await fetch(`/api/forced-join/${id}`, {
        method: 'DELETE',
        headers: {
          'x-telegram-init-data': initData
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete channel')
      }

      await fetchGroups()
    } catch (err) {
      console.error('Error deleting channel:', err)
      alert('删除失败，请重试')
    }
  }

  const addGroup = async () => {
    if (!newChatId.trim()) {
      alert('请输入 Chat ID')
      return
    }

    try {
      setSubmitting(true)
      const initData = (window as any).Telegram?.WebApp?.initData
      if (!initData) {
        throw new Error('Telegram WebApp not initialized')
      }

      const response = await fetch('/api/forced-join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData
        },
        body: JSON.stringify({ 
          chatId: newChatId.trim(),
          isRequired,
          isEnabled: true
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add channel')
      }

      setNewChatId('')
      setIsRequired(true)
      setShowAddModal(false)
      await fetchGroups()
    } catch (err: any) {
      console.error('Error adding channel:', err)
      alert(err.message || '添加失败，请检查 Chat ID 是否正确，并确保机器人已加入该群/频道')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">强制加入群/频道</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm"
        >
          + 添加
        </button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-yellow-800">
          设置用户参与抽奖前必须加入的群组或频道。机器人会验证用户是否已加入指定群组/频道。
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-sm text-gray-600">加载中...</p>
        </div>
      ) : (
        <DataTable columns={columns} data={groups} emptyMessage="暂无强制加入群/频道" />
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">添加强制加入群/频道</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Chat ID
                </label>
                <input
                  type="text"
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="例如：-100123456789 或 @username"
                  disabled={submitting}
                />
                <p className="mt-1 text-xs text-gray-500">
                  系统将自动获取群组名称、类型、邀请链接等信息
                </p>
              </div>
              <div>
                <label className="flex items-center text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="mr-2"
                    disabled={submitting}
                  />
                  <span className="text-gray-700">必须加入才能参与抽奖</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                disabled={submitting}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={addGroup}
                disabled={submitting}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm disabled:opacity-50"
              >
                {submitting ? '添加中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
