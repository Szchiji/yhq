'use client'

import { useState } from 'react'
import DataTable from '@/components/DataTable'

type User = {
  id: number
  telegramId: string
  username: string | null
  firstName: string
  lastName: string | null
  participatedCount: number
  wonCount: number
  status: string
  joinedAt: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const columns = [
    {
      key: 'name',
      label: '用户',
      render: (user: User) => (
        <div>
          <div className="text-xs sm:text-sm font-medium">{user.firstName} {user.lastName || ''}</div>
          {user.username && <div className="text-xs text-gray-500">@{user.username}</div>}
        </div>
      ),
    },
    { 
      key: 'telegramId', 
      label: 'Telegram ID',
      render: (user: User) => (
        <span className="text-xs font-mono">{user.telegramId}</span>
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
      key: 'status',
      label: '状态',
      render: (user: User) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          user.status === '正常' ? 'bg-green-100 text-green-700' : 
          user.status === '黑名单' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {user.status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (user: User) => (
        <div className="flex gap-2">
          <button className="text-blue-500 hover:text-blue-700 text-xs">详情</button>
          {user.status === '正常' ? (
            <button
              onClick={() => updateUserStatus(user.id, '黑名单')}
              className="text-red-500 hover:text-red-700 text-xs"
            >
              拉黑
            </button>
          ) : (
            <button
              onClick={() => updateUserStatus(user.id, '正常')}
              className="text-green-500 hover:text-green-700 text-xs"
            >
              解禁
            </button>
          )}
        </div>
      ),
    },
  ]

  const updateUserStatus = (userId: number, newStatus: string) => {
    setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u))
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.telegramId.includes(searchTerm)
    
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">抽奖用户管理</h1>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="搜索用户名、Telegram ID..."
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">全部状态</option>
            <option value="正常">正常</option>
            <option value="黑名单">黑名单</option>
          </select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">{users.length}</div>
          <div className="text-xs sm:text-sm text-gray-600">总用户数</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">
            {users.filter(u => u.status === '正常').length}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">正常用户</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-600">
            {users.filter(u => u.status === '黑名单').length}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">黑名单</div>
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={filteredUsers} 
        emptyMessage="暂无用户数据" 
      />
    </div>
  )
}
