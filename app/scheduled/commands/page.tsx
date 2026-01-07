'use client'

import { useState } from 'react'
import DataTable from '@/components/DataTable'

type Command = {
  id: number
  command: string
  description: string
  response: string
  enabled: boolean
}

export default function ScheduledCommandsPage() {
  const [commands, setCommands] = useState<Command[]>([
    {
      id: 1,
      command: '/help',
      description: '帮助命令',
      response: '这是帮助信息...',
      enabled: true,
    },
  ])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCommand, setNewCommand] = useState({ 
    command: '', 
    description: '',
    response: '',
  })

  const columns = [
    { key: 'command', label: '命令' },
    { key: 'description', label: '说明' },
    { 
      key: 'response', 
      label: '响应内容',
      render: (item: Command) => (
        <div className="max-w-xs truncate">{item.response}</div>
      ),
    },
    {
      key: 'enabled',
      label: '状态',
      render: (item: Command) => (
        <span className={`px-2 py-1 rounded text-sm ${
          item.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {item.enabled ? '启用' : '禁用'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: Command) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setCommands(commands.map(c => 
                c.id === item.id ? { ...c, enabled: !c.enabled } : c
              ))
            }}
            className="text-blue-500 hover:text-blue-700"
          >
            {item.enabled ? '禁用' : '启用'}
          </button>
          <button className="text-blue-500 hover:text-blue-700">编辑</button>
          <button
            onClick={() => setCommands(commands.filter((c) => c.id !== item.id))}
            className="text-red-500 hover:text-red-700"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  const addCommand = () => {
    if (newCommand.command && newCommand.response) {
      setCommands([
        ...commands,
        {
          id: Date.now(),
          ...newCommand,
          enabled: true,
        },
      ])
      setNewCommand({ command: '', description: '', response: '' })
      setShowAddModal(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">私聊命令管理</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          + 添加命令
        </button>
      </div>

      <DataTable columns={columns} data={commands} emptyMessage="暂无命令" />

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">添加命令</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  命令
                </label>
                <input
                  type="text"
                  value={newCommand.command}
                  onChange={(e) => setNewCommand({ ...newCommand, command: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="/命令名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  说明
                </label>
                <input
                  type="text"
                  value={newCommand.description}
                  onChange={(e) => setNewCommand({ ...newCommand, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="命令说明"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  响应内容
                </label>
                <textarea
                  value={newCommand.response}
                  onChange={(e) => setNewCommand({ ...newCommand, response: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                  placeholder="用户执行命令后的响应内容"
                />
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
                onClick={addCommand}
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
