'use client'

import { useState } from 'react'
import DataTable from '@/components/DataTable'

type ScheduledMessage = {
  id: number
  title: string
  content: string
  sendTime: string
  status: string
}

export default function ScheduledPrivatePage() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newMessage, setNewMessage] = useState({ 
    title: '', 
    content: '',
    sendTime: '',
  })

  const columns = [
    { key: 'title', label: '标题' },
    { 
      key: 'content', 
      label: '内容',
      render: (item: ScheduledMessage) => (
        <div className="max-w-[100px] sm:max-w-[150px] truncate text-xs sm:text-sm">{item.content}</div>
      ),
    },
    { 
      key: 'sendTime', 
      label: '发送时间',
      render: (item: ScheduledMessage) => (
        <span className="text-xs sm:text-sm">{item.sendTime}</span>
      ),
    },
    {
      key: 'status',
      label: '状态',
      render: (item: ScheduledMessage) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.status === '待发送' ? 'bg-yellow-100 text-yellow-700' : 
          item.status === '已发送' ? 'bg-green-100 text-green-700' : 
          'bg-gray-100 text-gray-700'
        }`}>
          {item.status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: ScheduledMessage) => (
        <div className="flex gap-2">
          <button className="text-blue-500 hover:text-blue-700 text-xs sm:text-sm">编辑</button>
          <button
            onClick={() => setMessages(messages.filter((m) => m.id !== item.id))}
            className="text-red-500 hover:text-red-700 text-xs sm:text-sm"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  const addMessage = () => {
    if (newMessage.title && newMessage.content && newMessage.sendTime) {
      setMessages([
        ...messages,
        {
          id: Date.now(),
          ...newMessage,
          status: '待发送',
        },
      ])
      setNewMessage({ title: '', content: '', sendTime: '' })
      setShowAddModal(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">私聊定时发送</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm"
        >
          + 添加定时消息
        </button>
      </div>

      <DataTable columns={columns} data={messages} emptyMessage="暂无定时消息" />

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">添加定时消息</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  标题
                </label>
                <input
                  type="text"
                  value={newMessage.title}
                  onChange={(e) => setNewMessage({ ...newMessage, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="消息标题"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  内容
                </label>
                <textarea
                  value={newMessage.content}
                  onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] text-sm"
                  placeholder="消息内容"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  发送时间
                </label>
                <input
                  type="datetime-local"
                  value={newMessage.sendTime}
                  onChange={(e) => setNewMessage({ ...newMessage, sendTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
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
                onClick={addMessage}
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
