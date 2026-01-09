'use client'

import { useState, useEffect } from 'react'
import DataTable from '@/components/DataTable'
import { apiGet, apiPost, apiDelete } from '@/lib/api'

type AnnouncementChannel = {
  id: string
  chatId: string
  title: string
  type: string
  username: string | null
  createdAt: string
}

export default function AnnouncementsPage() {
  const [channels, setChannels] = useState<AnnouncementChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newChannel, setNewChannel] = useState({
    chatId: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchChannels()
  }, [])

  const fetchChannels = async () => {
    try {
      setLoading(true)
      const response = await apiGet('/api/announcement-channels')
      if (response.ok) {
        const data = await response.json()
        setChannels(data.data)
      } else {
        console.error('Failed to fetch channels')
      }
    } catch (error) {
      console.error('Error fetching channels:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`确定要删除「${title}」吗？`)) {
      return
    }

    try {
      const response = await apiDelete(`/api/announcement-channels/${id}`)
      if (response.ok) {
        alert('删除成功')
        fetchChannels()
      } else {
        const error = await response.json()
        alert(`删除失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting channel:', error)
      alert('删除失败，请稍后重试')
    }
  }

  const addChannel = async () => {
    if (!newChannel.chatId) {
      alert('请输入 Chat ID')
      return
    }

    setSaving(true)
    try {
      const response = await apiPost('/api/announcement-channels', newChannel)
      
      if (response.ok) {
        alert('添加成功！')
        setNewChannel({ chatId: '' })
        setShowAddModal(false)
        fetchChannels()
      } else {
        const error = await response.json()
        alert(`添加失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error adding channel:', error)
      alert('添加失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { 
      key: 'title', 
      label: '名称',
      render: (item: AnnouncementChannel) => (
        <div>
          <div className="text-xs sm:text-sm font-medium">{item.title}</div>
          {item.username && <div className="text-xs text-gray-500">@{item.username}</div>}
        </div>
      ),
    },
    { 
      key: 'chatId', 
      label: 'Chat ID',
      render: (item: AnnouncementChannel) => (
        <span className="text-xs font-mono">{item.chatId}</span>
      ),
    },
    {
      key: 'type',
      label: '类型',
      render: (item: AnnouncementChannel) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.type === 'channel' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
        }`}>
          {item.type === 'channel' ? '频道' : item.type === 'supergroup' ? '超级群组' : '群组'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: '添加时间',
      render: (item: AnnouncementChannel) => (
        <span className="text-xs sm:text-sm">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: AnnouncementChannel) => (
        <button
          onClick={() => handleDelete(item.id, item.title)}
          className="text-red-500 hover:text-red-700 text-xs sm:text-sm"
        >
          删除
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">公告群/频道设置</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm"
        >
          + 添加
        </button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-yellow-800">
          💡 在这里设置用于发布抽奖公告的群组或频道。抽奖创建成功后会自动推送到这些群组/频道。
        </p>
        <p className="text-xs sm:text-sm text-yellow-800 mt-2 font-medium">
          ⚠️ 重要：机器人必须是群组/频道的管理员才能添加成功。
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-500">加载中...</div>
        </div>
      ) : (
        <DataTable columns={columns} data={channels} emptyMessage="暂无公告群/频道" />
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">添加公告群/频道</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Chat ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newChannel.chatId}
                  onChange={(e) => setNewChannel({ ...newChannel, chatId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="例如：-1001234567890"
                />
                <p className="text-xs text-gray-500 mt-1">
                  请输入群组或频道的 Chat ID（通常以 -100 开头）
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                disabled={saving}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={addChannel}
                disabled={saving}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm disabled:opacity-50"
              >
                {saving ? '添加中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
