'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'

type Tag = {
  id: string
  tag: string
  sortOrder: number
  isEnabled: boolean
  createdAt: string
}

type TagConfig = {
  id: string
  isEnabled: boolean
  isRequired: boolean
  mode: string
  maxTags: number
  fieldLabel: string
}

export default function EvalTagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [config, setConfig] = useState<TagConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [newTag, setNewTag] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [localConfig, setLocalConfig] = useState<Partial<TagConfig>>({})

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await apiGet('/api/eval-tags')
      if (res.ok) {
        const data = await res.json()
        setTags(data.tags)
        setConfig(data.config)
        setLocalConfig(data.config || {
          isEnabled: true,
          isRequired: false,
          mode: 'predefined',
          maxTags: 5,
          fieldLabel: '标签',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleAddTag = async () => {
    if (!newTag.trim()) return
    const res = await apiPost('/api/eval-tags', { tag: newTag.trim() })
    if (res.ok) {
      setNewTag('')
      fetchData()
    } else {
      const data = await res.json()
      alert(`添加失败：${data.error}`)
    }
  }

  const handleDeleteTag = async (id: string) => {
    if (!confirm('确认删除此标签？')) return
    const res = await apiDelete(`/api/eval-tags?id=${id}`)
    if (res.ok) fetchData()
    else alert('删除失败')
  }

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    try {
      const res = await apiPost('/api/eval-tags', { type: 'config', ...localConfig })
      if (res.ok) {
        alert('配置已保存！')
        fetchData()
      } else {
        alert('保存失败')
      }
    } finally {
      setSavingConfig(false)
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">标签管理</h1>
        <p className="text-sm text-gray-500">管理报告表单中的标签字段配置和预定义标签</p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : (
        <div className="space-y-6">
          {/* Config Section */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="font-semibold text-gray-800 mb-4">标签字段配置</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isEnabled"
                  checked={localConfig.isEnabled ?? true}
                  onChange={(e) => setLocalConfig({ ...localConfig, isEnabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="isEnabled" className="text-sm text-gray-700">启用标签字段</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isRequired"
                  checked={localConfig.isRequired ?? false}
                  onChange={(e) => setLocalConfig({ ...localConfig, isRequired: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="isRequired" className="text-sm text-gray-700">必填</label>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">标签模式</label>
                <select
                  value={localConfig.mode || 'predefined'}
                  onChange={(e) => setLocalConfig({ ...localConfig, mode: e.target.value })}
                  className="border rounded px-3 py-2 text-sm w-full"
                >
                  <option value="predefined">预定义标签</option>
                  <option value="free">自由输入</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">最多标签数 (0-5)</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={localConfig.maxTags ?? 5}
                  onChange={(e) => setLocalConfig({ ...localConfig, maxTags: parseInt(e.target.value) || 5 })}
                  className="border rounded px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">字段显示名称</label>
                <input
                  type="text"
                  value={localConfig.fieldLabel || '标签'}
                  onChange={(e) => setLocalConfig({ ...localConfig, fieldLabel: e.target.value })}
                  className="border rounded px-3 py-2 text-sm w-full"
                />
              </div>
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="mt-4 bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 disabled:opacity-50"
            >
              {savingConfig ? '保存中...' : '保存配置'}
            </button>
          </div>

          {/* Predefined Tags */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="font-semibold text-gray-800 mb-4">预定义标签列表</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="新标签名称"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                className="border rounded px-3 py-2 text-sm flex-1 max-w-xs"
              />
              <button
                onClick={handleAddTag}
                className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600"
              >
                添加
              </button>
            </div>
            {tags.length === 0 ? (
              <p className="text-sm text-gray-500">暂无预定义标签</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
                    <span className="text-sm text-blue-700">#{tag.tag}</span>
                    <button
                      onClick={() => handleDeleteTag(tag.id)}
                      className="text-blue-400 hover:text-red-500 text-xs ml-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
