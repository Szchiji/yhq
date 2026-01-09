'use client'

import { useState } from 'react'
import DataTable from '@/components/DataTable'

type Group = {
  id: number
  name: string
  chatId: string
  type: 'group' | 'supergroup' | 'channel'
  memberCount: number
  joinedAt: string
  status: string
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newGroup, setNewGroup] = useState({
    name: '',
    chatId: '',
    type: 'supergroup' as 'group' | 'supergroup' | 'channel',
  })

  const columns = [
    { key: 'name', label: '名称' },
    { 
      key: 'chatId', 
      label: 'Chat ID',
      render: (item: Group) => (
        <span className="text-xs font-mono">{item.chatId}</span>
      ),
    },
    {
      key: 'type',
      label: '类型',
      render: (item: Group) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.type === 'channel' ? 'bg-blue-100 text-blue-700' : 
          item.type === 'supergroup' ? 'bg-purple-100 text-purple-700' :
          'bg-green-100 text-green-700'
        }`}>
          {item.type === 'channel' ? '频道' : item.type === 'supergroup' ? '超级群' : '群组'}
        </span>
      ),
    },
    { 
      key: 'memberCount', 
      label: '成员数',
      render: (item: Group) => (
        <span className="text-xs sm:text-sm">{item.memberCount}</span>
      ),
    },
    {
      key: 'status',
      label: '状态',
      render: (item: Group) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.status === '正常' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {item.status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: Group) => (
        <div className="flex gap-2">
          <button
            onClick={() => setGroups(groups.filter((g) => g.id !== item.id))}
            className="text-red-500 hover:text-red-700 text-xs sm:text-sm"
          >
            移除
          </button>
        </div>
      ),
    },
  ]

  const addGroup = () => {
    if (newGroup.name && newGroup.chatId) {
      setGroups([
        ...groups,
        {
          id: Date.now(),
          ...newGroup,
          memberCount: 0,
          joinedAt: new Date().toISOString(),
          status: '正常',
        },
      ])
      setNewGroup({ name: '', chatId: '', type: 'supergroup' })
      setShowAddModal(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">已加入的群/频道</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm"
        >
          + 添加
        </button>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-green-800">
          这里显示机器人已加入的所有群组和频道。您可以手动添加或移除群组/频道。
        </p>
      </div>

      <DataTable columns={columns} data={groups} emptyMessage="暂无已加入的群/频道" />

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">添加群/频道</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  名称
                </label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="群组/频道名称"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Chat ID
                </label>
                <input
                  type="text"
                  value={newGroup.chatId}
                  onChange={(e) => setNewGroup({ ...newGroup, chatId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="例如：-100123456789"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  类型
                </label>
                <select
                  value={newGroup.type}
                  onChange={(e) => setNewGroup({ ...newGroup, type: e.target.value as 'group' | 'supergroup' | 'channel' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="supergroup">超级群</option>
                  <option value="group">群组</option>
                  <option value="channel">频道</option>
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
                onClick={addGroup}
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
