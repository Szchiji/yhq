'use client'

import { useState } from 'react'
import DataTable from '@/components/DataTable'

type Admin = {
  id: number
  username: string
  userId: string
  role: string
  addedAt: string
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([
    {
      id: 1,
      username: '@admin1',
      userId: '123456789',
      role: '超级管理员',
      addedAt: '2024-01-01',
    },
  ])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newAdmin, setNewAdmin] = useState({ username: '', userId: '', role: '管理员' })

  const columns = [
    { key: 'username', label: '用户名' },
    { key: 'userId', label: '用户ID' },
    { key: 'role', label: '角色' },
    { key: 'addedAt', label: '添加时间' },
    {
      key: 'actions',
      label: '操作',
      render: (admin: Admin) => (
        <button
          onClick={() => setAdmins(admins.filter((a) => a.id !== admin.id))}
          className="text-red-500 hover:text-red-700 transition-colors"
        >
          删除
        </button>
      ),
    },
  ]

  const addAdmin = () => {
    if (newAdmin.username && newAdmin.userId) {
      setAdmins([
        ...admins,
        {
          id: Date.now(),
          ...newAdmin,
          addedAt: new Date().toISOString().split('T')[0],
        },
      ])
      setNewAdmin({ username: '', userId: '', role: '管理员' })
      setShowAddModal(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">管理员设置</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          + 添加管理员
        </button>
      </div>

      <DataTable columns={columns} data={admins} emptyMessage="暂无管理员" />

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">添加管理员</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  用户名
                </label>
                <input
                  type="text"
                  value={newAdmin.username}
                  onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="@username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  用户ID
                </label>
                <input
                  type="text"
                  value={newAdmin.userId}
                  onChange={(e) => setNewAdmin({ ...newAdmin, userId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Telegram 用户ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  角色
                </label>
                <select
                  value={newAdmin.role}
                  onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="管理员">管理员</option>
                  <option value="超级管理员">超级管理员</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={addAdmin}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
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
