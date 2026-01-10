'use client'

import { useState, useEffect } from 'react'
import DataTable from '@/components/DataTable'
import { apiGet, apiPost, apiDelete } from '@/lib/api'

type BotCommand = {
  id: string
  command: string
  prompt: string
  description: string | null
  sortOrder: number
  isEnabled: boolean
  createdAt: string
}

export default function CommandsPage() {
  const [commands, setCommands] = useState<BotCommand[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCommand, setEditingCommand] = useState<BotCommand | null>(null)
  const [formData, setFormData] = useState({
    command: '',
    prompt: '',
    description: '',
    sortOrder: 0,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchCommands()
  }, [])

  const fetchCommands = async () => {
    try {
      setLoading(true)
      const response = await apiGet('/api/commands')
      if (response.ok) {
        const data = await response.json()
        setCommands(data.data)
      } else {
        console.error('Failed to fetch commands')
      }
    } catch (error) {
      console.error('Error fetching commands:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, command: string) => {
    if (!confirm(`确定要删除命令「${command}」吗？`)) {
      return
    }

    try {
      const response = await apiDelete(`/api/commands/${id}`)
      if (response.ok) {
        alert('删除成功')
        fetchCommands()
      } else {
        const error = await response.json()
        alert(`删除失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting command:', error)
      alert('删除失败，请稍后重试')
    }
  }

  const toggleEnabled = async (cmd: BotCommand) => {
    try {
      const response = await apiPost('/api/commands', {
        command: {
          command: cmd.command,
          prompt: cmd.prompt,
          description: cmd.description,
          sortOrder: cmd.sortOrder,
          isEnabled: !cmd.isEnabled,
        },
      })
      
      if (response.ok) {
        fetchCommands()
      } else {
        const error = await response.json()
        alert(`操作失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error toggling command:', error)
      alert('操作失败，请稍后重试')
    }
  }

  const openAddModal = () => {
    setEditingCommand(null)
    setFormData({
      command: '',
      prompt: '',
      description: '',
      sortOrder: 0,
    })
    setShowModal(true)
  }

  const openEditModal = (cmd: BotCommand) => {
    setEditingCommand(cmd)
    setFormData({
      command: cmd.command,
      prompt: cmd.prompt,
      description: cmd.description || '',
      sortOrder: cmd.sortOrder,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.command || !formData.prompt) {
      alert('请填写命令和命令提示')
      return
    }

    setSaving(true)
    try {
      const response = await apiPost('/api/commands', {
        command: {
          command: formData.command,
          prompt: formData.prompt,
          description: formData.description || null,
          sortOrder: formData.sortOrder,
        },
      })
      
      if (response.ok) {
        alert(editingCommand ? '更新成功！' : '添加成功！')
        setShowModal(false)
        fetchCommands()
      } else {
        const error = await response.json()
        alert(`保存失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error saving command:', error)
      alert('保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { 
      key: 'command', 
      label: '命令',
      render: (item: BotCommand) => (
        <span className="text-xs sm:text-sm font-mono">{item.command}</span>
      ),
    },
    { 
      key: 'prompt', 
      label: '命令提示',
      render: (item: BotCommand) => (
        <span className="text-xs sm:text-sm">{item.prompt}</span>
      ),
    },
    { 
      key: 'description', 
      label: '功能描述',
      render: (item: BotCommand) => (
        <div className="max-w-[150px] sm:max-w-[200px] truncate text-xs sm:text-sm">
          {item.description || '-'}
        </div>
      ),
    },
    {
      key: 'sortOrder',
      label: '排序',
      render: (item: BotCommand) => (
        <span className="text-xs sm:text-sm">{item.sortOrder}</span>
      ),
    },
    {
      key: 'isEnabled',
      label: '状态',
      render: (item: BotCommand) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {item.isEnabled ? '已启用' : '已停用'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: '创建时间',
      render: (item: BotCommand) => (
        <span className="text-xs sm:text-sm">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: BotCommand) => (
        <div className="flex gap-1 sm:gap-2 flex-wrap">
          <button
            onClick={() => toggleEnabled(item)}
            className="text-blue-500 hover:text-blue-700 text-xs"
          >
            {item.isEnabled ? '停用' : '启用'}
          </button>
          <button
            onClick={() => openEditModal(item)}
            className="text-blue-500 hover:text-blue-700 text-xs"
          >
            编辑
          </button>
          <button
            onClick={() => handleDelete(item.id, item.command)}
            className="text-red-500 hover:text-red-700 text-xs"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">私聊命令管理</h1>
        <button
          onClick={openAddModal}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm"
        >
          + 新增自定义命令
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-blue-800">
          💡 管理机器人私聊命令。启用的命令会显示在用户的命令菜单中。
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-500">加载中...</div>
        </div>
      ) : (
        <DataTable columns={columns} data={commands} emptyMessage="暂无命令" />
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
              {editingCommand ? '编辑命令' : '新增命令'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  命令 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.command}
                  onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                  disabled={!!editingCommand}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100"
                  placeholder="/命令名称"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  命令提示 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="例如：开始、创建抽奖"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  功能描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] text-sm"
                  placeholder="命令的功能说明"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  排序
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="数字越小越靠前"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm disabled:opacity-50"
              >
                {saving ? '保存中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
