'use client'

import { useState, useEffect } from 'react'
import { AuthGuard } from '@/components/AuthGuard'
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp'
import DataTable from '@/components/DataTable'

type Admin = {
  id: string
  telegramId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  createdAt: string
  isActive: boolean
}

function AdminsContent() {
  const { initData } = useTelegramWebApp()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newAdmin, setNewAdmin] = useState({
    telegramId: '',
    username: '',
    firstName: '',
    lastName: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchAdmins()
  }, [initData])

  const fetchAdmins = async () => {
    if (!initData) return

    try {
      const response = await fetch('/api/admins', {
        headers: {
          Authorization: `Bearer ${initData}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setAdmins(data.admins || [])
      }
    } catch (err) {
      console.error('Failed to fetch admins:', err)
    } finally {
      setLoading(false)
    }
  }

  const addAdmin = async () => {
    if (!newAdmin.telegramId) {
      setError('Telegram ID 是必填项')
      return
    }

    if (!initData) {
      setError('认证信息无效')
      return
    }

    try {
      const response = await fetch('/api/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${initData}`,
        },
        body: JSON.stringify(newAdmin),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '添加管理员失败')
        return
      }

      setSuccess('管理员添加成功')
      setNewAdmin({ telegramId: '', username: '', firstName: '', lastName: '' })
      setShowAddModal(false)
      fetchAdmins()
    } catch (err) {
      setError('添加管理员失败，请重试')
    }
  }

  const deleteAdmin = async (adminId: string) => {
    if (!confirm('确定要删除这个管理员吗？')) return

    if (!initData) {
      setError('认证信息无效')
      return
    }

    try {
      const response = await fetch(`/api/admins?id=${adminId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${initData}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || '删除管理员失败')
        return
      }

      setSuccess('管理员删除成功')
      fetchAdmins()
    } catch (err) {
      setError('删除管理员失败，请重试')
    }
  }

  const columns = [
    {
      key: 'name',
      label: '姓名',
      render: (admin: Admin) => (
        <span>
          {admin.firstName} {admin.lastName || ''}
        </span>
      ),
    },
    {
      key: 'username',
      label: '用户名',
      render: (admin: Admin) => (
        <span>{admin.username ? `@${admin.username}` : '-'}</span>
      ),
    },
    { key: 'telegramId', label: 'Telegram ID' },
    {
      key: 'createdAt',
      label: '添加时间',
      render: (admin: Admin) => new Date(admin.createdAt).toLocaleDateString('zh-CN'),
    },
    {
      key: 'actions',
      label: '操作',
      render: (admin: Admin) => (
        <button
          onClick={() => deleteAdmin(admin.id)}
          className="text-red-500 hover:text-red-700 transition-colors"
        >
          删除
        </button>
      ),
    },
  ]

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('')
        setSuccess('')
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">管理员设置</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm"
        >
          + 添加管理员
        </button>
      </div>

      <DataTable columns={columns} data={admins} emptyMessage="暂无管理员" />

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">添加管理员</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Telegram ID *
                </label>
                <input
                  type="text"
                  value={newAdmin.telegramId}
                  onChange={(e) => setNewAdmin({ ...newAdmin, telegramId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="用户的 Telegram ID"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  用户名（可选）
                </label>
                <input
                  type="text"
                  value={newAdmin.username}
                  onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="@username"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  名字（可选）
                </label>
                <input
                  type="text"
                  value={newAdmin.firstName}
                  onChange={(e) => setNewAdmin({ ...newAdmin, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="First Name"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  姓氏（可选）
                </label>
                <input
                  type="text"
                  value={newAdmin.lastName}
                  onChange={(e) => setNewAdmin({ ...newAdmin, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Last Name"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setError('')
                }}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                取消
              </button>
              <button
                onClick={addAdmin}
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

export default function AdminsPage() {
  return (
    <AuthGuard requireSuperAdmin={true}>
      <AdminsContent />
    </AuthGuard>
  )
}
