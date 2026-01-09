'use client'

import { useState } from 'react'
import DataTable from '@/components/DataTable'

type Announcement = {
  id: number
  name: string
  chatId: string
  type: 'group' | 'channel'
  status: string
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newAnnouncement, setNewAnnouncement] = useState({
    name: '',
    chatId: '',
    type: 'channel' as 'group' | 'channel',
  })

  const columns = [
    { key: 'name', label: '名称' },
    { key: 'chatId', label: 'Chat ID' },
    {
      key: 'type',
      label: '类型',
      render: (item: Announcement) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.type === 'channel' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
        }`}>
          {item.type === 'channel' ? '频道' : '群组'}
        </span>
      ),
    },
    {
      key: 'status',
      label: '状态',
      render: (item: Announcement) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.status === '启用' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {item.status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: Announcement) => (
        <div className="flex gap-2">
          <button className="text-blue-500 hover:text-blue-700 text-xs sm:text-sm">编辑</button>
          <button
            onClick={() => setAnnouncements(announcements.filter((a) => a.id !== item.id))}
            className="text-red-500 hover:text-red-700 text-xs sm:text-sm"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  const addAnnouncement = () => {
    if (newAnnouncement.name && newAnnouncement.chatId) {
      setAnnouncements([
        ...announcements,
        {
          id: Date.now(),
          ...newAnnouncement,
          status: '启用',
        },
      ])
      setNewAnnouncement({ name: '', chatId: '', type: 'channel' })
      setShowAddModal(false)
    }
  }

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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-blue-800">
          在这里设置用于发布抽奖公告的群组或频道。机器人会在抽奖开始和结束时自动发送通知。
        </p>
      </div>

      <DataTable columns={columns} data={announcements} emptyMessage="暂无公告群/频道" />

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">添加公告群/频道</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  名称
                </label>
                <input
                  type="text"
                  value={newAnnouncement.name}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="例如：抽奖公告频道"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Chat ID
                </label>
                <input
                  type="text"
                  value={newAnnouncement.chatId}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, chatId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="例如：-100123456789"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  类型
                </label>
                <select
                  value={newAnnouncement.type}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, type: e.target.value as 'group' | 'channel' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="channel">频道</option>
                  <option value="group">群组</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                取消
              </button>
              <button
                onClick={addAnnouncement}
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
