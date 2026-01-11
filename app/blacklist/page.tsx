'use client'

import { useState, useEffect } from 'react'
import DataTable from '@/components/DataTable'
import { apiGet, apiPost, apiDelete } from '@/lib/api'

type BlacklistItem = {
  id: string
  telegramId: string
  username: string | null
  reason: string | null
  createdBy: string
  createdAt: string
}

export default function BlacklistPage() {
  const [items, setItems] = useState<BlacklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTelegramId, setNewTelegramId] = useState('')
  const [newReason, setNewReason] = useState('')

  useEffect(() => {
    fetchBlacklist()
  }, [page, searchTerm])

  const fetchBlacklist = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      params.append('page', page.toString())
      params.append('limit', '20')
      
      const response = await apiGet(`/api/blacklist?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setItems(data.items)
        const totalPagesCalc = Math.ceil(data.total / data.limit)
        setTotalPages(totalPagesCalc)
        setTotal(data.total)
      } else {
        console.error('Failed to fetch blacklist')
      }
    } catch (error) {
      console.error('Error fetching blacklist:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToBlacklist = async () => {
    if (!newTelegramId.trim()) {
      alert('请输入 Telegram ID')
      return
    }

    try {
      const response = await apiPost('/api/blacklist', {
        telegramId: newTelegramId.trim(),
        reason: newReason.trim() || null,
      })

      if (response.ok) {
        alert('添加成功')
        setShowAddModal(false)
        setNewTelegramId('')
        setNewReason('')
        fetchBlacklist()
      } else {
        const error = await response.json()
        alert(`添加失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error adding to blacklist:', error)
      alert('添加失败，请稍后重试')
    }
  }

  const handleRemoveFromBlacklist = async (item: BlacklistItem) => {
    if (!confirm(`确定要移出黑名单吗？\n用户：${item.username || item.telegramId}`)) {
      return
    }

    try {
      const response = await apiDelete(`/api/blacklist/${item.id}`)
      if (response.ok) {
        alert('移出成功')
        fetchBlacklist()
      } else {
        const error = await response.json()
        alert(`移出失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error removing from blacklist:', error)
      alert('移出失败，请稍后重试')
    }
  }

  const columns = [
    {
      key: 'user',
      label: '用户信息',
      render: (item: BlacklistItem) => (
        <div>
          {item.username && <div className="text-xs sm:text-sm font-medium">@{item.username}</div>}
          <div className="text-xs text-gray-400 font-mono">{item.telegramId}</div>
        </div>
      ),
    },
    {
      key: 'reason',
      label: '原因',
      render: (item: BlacklistItem) => (
        <div className="text-xs sm:text-sm text-gray-600">
          {item.reason || '-'}
        </div>
      ),
    },
    { 
      key: 'createdAt', 
      label: '加入时间',
      render: (item: BlacklistItem) => (
        <div className="text-xs text-gray-600">
          {new Date(item.createdAt).toLocaleString('zh-CN')}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: BlacklistItem) => (
        <button
          onClick={() => handleRemoveFromBlacklist(item)}
          className="text-xs text-red-500 hover:text-red-700"
        >
          移出黑名单
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">黑名单管理</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
        >
          添加黑名单
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setPage(1)
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="搜索 Telegram ID、用户名、原因..."
        />
      </div>

      {/* Statistics */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
        <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-600">{total}</div>
        <div className="text-xs sm:text-sm text-gray-600">黑名单用户数</div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-500">加载中...</div>
        </div>
      ) : (
        <>
          <DataTable 
            columns={columns} 
            data={items} 
            emptyMessage="暂无黑名单用户" 
          />
          
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
                第 {page} / {totalPages} 页
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
        </>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
              添加黑名单
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Telegram ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTelegramId}
                  onChange={(e) => setNewTelegramId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="输入用户的 Telegram ID"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  原因（选填）
                </label>
                <textarea
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="输入加入黑名单的原因"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewTelegramId('')
                  setNewReason('')
                }}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                取消
              </button>
              <button
                onClick={handleAddToBlacklist}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
