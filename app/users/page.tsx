'use client'

import { useState, useEffect } from 'react'
import DataTable from '@/components/DataTable'
import { apiGet, apiPatch } from '@/lib/api'

type User = {
  id: string
  telegramId: string
  username: string | null
  firstName: string
  lastName: string | null
  isVip: boolean
  vipExpireAt: string | null
  canCreateLottery: boolean
  canJoinLottery: boolean
  participatedCount: number
  wonCount: number
  createdAt: string
  lastActiveAt: string | null
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showVipModal, setShowVipModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [vipExpireDate, setVipExpireDate] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [page, searchTerm])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      params.append('page', page.toString())
      params.append('perPage', '10')
      
      const response = await apiGet(`/api/users?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.data)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      } else {
        console.error('Failed to fetch users')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateUser = async (userId: string, updates: any) => {
    try {
      const response = await apiPatch('/api/users', { userId, updates })
      if (response.ok) {
        fetchUsers()
        return true
      } else {
        const error = await response.json()
        alert(`更新失败：${error.error}`)
        return false
      }
    } catch (error) {
      console.error('Error updating user:', error)
      alert('更新失败，请稍后重试')
      return false
    }
  }

  const togglePermission = async (user: User, field: 'canCreateLottery' | 'canJoinLottery') => {
    const newValue = !user[field]
    const fieldName = field === 'canCreateLottery' ? '创建抽奖' : '参与抽奖'
    
    if (!confirm(`确定要${newValue ? '启用' : '禁用'}用户「${user.firstName}」的${fieldName}权限吗？`)) {
      return
    }
    
    await updateUser(user.id, { [field]: newValue })
  }

  const openVipModal = (user: User) => {
    setSelectedUser(user)
    setVipExpireDate(user.vipExpireAt ? new Date(user.vipExpireAt).toISOString().split('T')[0] : '')
    setShowVipModal(true)
  }

  const handleSetVip = async () => {
    if (!selectedUser) return
    
    const isVip = !!vipExpireDate
    const updates = {
      isVip,
      vipExpireAt: vipExpireDate || null,
    }
    
    const success = await updateUser(selectedUser.id, updates)
    if (success) {
      setShowVipModal(false)
      setSelectedUser(null)
      setVipExpireDate('')
    }
  }

  const columns = [
    {
      key: 'user',
      label: '用户',
      render: (user: User) => (
        <div>
          <div className="text-xs sm:text-sm font-medium">{user.firstName} {user.lastName || ''}</div>
          {user.username && <div className="text-xs text-gray-500">@{user.username}</div>}
          <div className="text-xs text-gray-400 font-mono">{user.telegramId}</div>
        </div>
      ),
    },
    { 
      key: 'createdAt', 
      label: '首次使用',
      render: (user: User) => (
        <div className="text-xs text-gray-600">
          {new Date(user.createdAt).toLocaleDateString('zh-CN')}
        </div>
      ),
    },
    { 
      key: 'lastActiveAt', 
      label: '最后活跃',
      render: (user: User) => (
        <div className="text-xs text-gray-600">
          {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString('zh-CN') : '-'}
        </div>
      ),
    },
    { 
      key: 'participatedCount', 
      label: '参与次数',
      render: (user: User) => (
        <span className="text-xs sm:text-sm">{user.participatedCount}</span>
      ),
    },
    { 
      key: 'wonCount', 
      label: '中奖次数',
      render: (user: User) => (
        <span className="text-xs sm:text-sm text-green-600 font-medium">{user.wonCount}</span>
      ),
    },
    {
      key: 'vip',
      label: 'VIP',
      render: (user: User) => (
        <div>
          {user.isVip ? (
            <div>
              <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">VIP</span>
              {user.vipExpireAt && (
                <div className="text-xs text-gray-500 mt-1">
                  至 {new Date(user.vipExpireAt).toLocaleDateString('zh-CN')}
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'permissions',
      label: '权限',
      render: (user: User) => (
        <div className="flex flex-col gap-1">
          <span className={`px-2 py-0.5 rounded text-xs ${
            user.canCreateLottery ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            创建：{user.canCreateLottery ? '允许' : '禁止'}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs ${
            user.canJoinLottery ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            参与：{user.canJoinLottery ? '允许' : '禁止'}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (user: User) => (
        <div className="flex flex-col gap-1">
          <button
            onClick={() => togglePermission(user, 'canCreateLottery')}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            {user.canCreateLottery ? '禁止创建' : '允许创建'}
          </button>
          <button
            onClick={() => togglePermission(user, 'canJoinLottery')}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            {user.canJoinLottery ? '禁止参与' : '允许参与'}
          </button>
          <button
            onClick={() => openVipModal(user)}
            className="text-xs text-yellow-600 hover:text-yellow-700"
          >
            设置VIP
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">用户管理</h1>

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
          placeholder="搜索用户ID、用户名、昵称..."
        />
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">{total}</div>
          <div className="text-xs sm:text-sm text-gray-600">总用户数</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-600">
            {users.filter(u => u.isVip).length}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">VIP用户</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">
            {users.filter(u => u.canCreateLottery).length}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">可创建</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-600">
            {users.filter(u => !u.canJoinLottery).length}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">被禁止参与</div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-500">加载中...</div>
        </div>
      ) : (
        <>
          <DataTable 
            columns={columns} 
            data={users} 
            emptyMessage="暂无用户数据" 
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

      {/* VIP Modal */}
      {showVipModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
              设置 VIP - {selectedUser.firstName}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  VIP 到期时间
                </label>
                <input
                  type="date"
                  value={vipExpireDate}
                  onChange={(e) => setVipExpireDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  留空表示取消 VIP
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowVipModal(false)
                  setSelectedUser(null)
                  setVipExpireDate('')
                }}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                取消
              </button>
              <button
                onClick={handleSetVip}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
