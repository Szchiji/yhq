'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiDelete, apiPatch } from '@/lib/api'

type EvalChannel = {
  id: string
  chatId: string
  title: string
  type: string
  username: string | null
  inviteLink: string | null
  isEnabled: boolean
  createdAt: string
}

export default function EvalChannelsPage() {
  const [channels, setChannels] = useState<EvalChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState({ chatId: '', title: '', type: 'report', username: '', inviteLink: '' })

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await apiGet('/api/eval-channels')
      if (res.ok) setChannels(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleAdd = async () => {
    if (!form.chatId.trim() || !form.title.trim()) {
      alert('请填写 Chat ID 和频道名称')
      return
    }
    const res = await apiPost('/api/eval-channels', {
      chatId: form.chatId.trim(),
      title: form.title.trim(),
      type: form.type,
      username: form.username.trim() || null,
      inviteLink: form.inviteLink.trim() || null,
    })
    if (res.ok) {
      setShowAddModal(false)
      setForm({ chatId: '', title: '', type: 'report', username: '', inviteLink: '' })
      fetchData()
    } else {
      const data = await res.json()
      alert(`添加失败：${data.error}`)
    }
  }

  const handleToggle = async (id: string, isEnabled: boolean) => {
    const res = await apiPatch(`/api/eval-channels?id=${id}`, { isEnabled: !isEnabled })
    if (res.ok) fetchData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此频道？')) return
    const res = await apiDelete(`/api/eval-channels?id=${id}`)
    if (res.ok) fetchData()
    else alert('删除失败')
  }

  const typeLabel = (t: string) => t === 'report' ? '📢 报告推送' : '🔒 强制订阅'

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">评价频道管理</h1>
          <p className="text-sm text-gray-500">配置报告推送频道和强制订阅频道</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600"
        >
          + 添加频道
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : channels.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          暂无配置频道，点击右上角添加
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">频道名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chat ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {channels.map((ch) => (
                  <tr key={ch.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      {ch.title}
                      {ch.username && <span className="text-xs text-gray-400 ml-1">@{ch.username}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{ch.chatId}</td>
                    <td className="px-4 py-3">{typeLabel(ch.type)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${ch.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {ch.isEnabled ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-3">
                      <button
                        onClick={() => handleToggle(ch.id, ch.isEnabled)}
                        className="text-blue-500 hover:text-blue-700 text-xs"
                      >
                        {ch.isEnabled ? '停用' : '启用'}
                      </button>
                      <button
                        onClick={() => handleDelete(ch.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">添加频道</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Chat ID *</label>
                <input
                  type="text"
                  placeholder="-100xxxxxxxxxx"
                  value={form.chatId}
                  onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                  className="border rounded px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">频道名称 *</label>
                <input
                  type="text"
                  placeholder="频道显示名称"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="border rounded px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">类型</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="border rounded px-3 py-2 text-sm w-full"
                >
                  <option value="report">报告推送频道</option>
                  <option value="subscribe">强制订阅频道</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">用户名（可选）</label>
                <input
                  type="text"
                  placeholder="不含@的用户名"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="border rounded px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">邀请链接（可选）</label>
                <input
                  type="text"
                  placeholder="https://t.me/..."
                  value={form.inviteLink}
                  onChange={(e) => setForm({ ...form, inviteLink: e.target.value })}
                  className="border rounded px-3 py-2 text-sm w-full"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAdd}
                className="flex-1 bg-blue-500 text-white py-2 rounded text-sm hover:bg-blue-600"
              >
                确认添加
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 border py-2 rounded text-sm hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
