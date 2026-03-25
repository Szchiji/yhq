'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPut } from '@/lib/api'

type TemplateField = {
  key: string
  label: string
  order: number
  required: boolean
  type: string
}

type Template = {
  fields: TemplateField[]
  header: string
  footer: string
}

export default function EvalTemplatePage() {
  const [template, setTemplate] = useState<Template>({
    fields: [],
    header: '',
    footer: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await apiGet('/api/eval-template')
      if (res.ok) setTemplate(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await apiPut('/api/eval-template', template)
      if (res.ok) {
        alert('模板已保存！')
      } else {
        alert('保存失败')
      }
    } finally {
      setSaving(false)
    }
  }

  const updateField = (index: number, updates: Partial<TemplateField>) => {
    const newFields = [...template.fields]
    newFields[index] = { ...newFields[index], ...updates }
    setTemplate({ ...template, fields: newFields })
  }

  const addField = () => {
    const maxOrder = template.fields.reduce((m, f) => Math.max(m, f.order), 0)
    setTemplate({
      ...template,
      fields: [
        ...template.fields,
        { key: `field_${Date.now()}`, label: '新字段', order: maxOrder + 1, required: false, type: 'text' },
      ],
    })
  }

  const removeField = (index: number) => {
    const newFields = template.fields.filter((_, i) => i !== index)
    setTemplate({ ...template, fields: newFields })
  }

  const moveField = (index: number, dir: 'up' | 'down') => {
    const newFields = [...template.fields]
    const swap = dir === 'up' ? index - 1 : index + 1
    if (swap < 0 || swap >= newFields.length) return
    ;[newFields[index], newFields[swap]] = [newFields[swap], newFields[index]]
    newFields.forEach((f, i) => (f.order = i + 1))
    setTemplate({ ...template, fields: newFields })
  }

  const sortedFields = [...template.fields].sort((a, b) => a.order - b.order)

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">报告模板管理</h1>
          <p className="text-sm text-gray-500">配置详细报告的表单字段、头部和尾部文字</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存模板'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : (
        <div className="space-y-6">
          {/* Header / Footer */}
          <div className="bg-white rounded-lg shadow p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">报告头部</label>
              <textarea
                value={template.header}
                onChange={(e) => setTemplate({ ...template, header: e.target.value })}
                rows={2}
                className="border rounded px-3 py-2 text-sm w-full resize-none"
                placeholder="📋 <b>详细报告</b>"
              />
              <p className="text-xs text-gray-400 mt-1">支持 HTML 格式（bold: &lt;b&gt;, italic: &lt;i&gt;）</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">报告尾部</label>
              <textarea
                value={template.footer}
                onChange={(e) => setTemplate({ ...template, footer: e.target.value })}
                rows={2}
                className="border rounded px-3 py-2 text-sm w-full resize-none"
                placeholder="感谢您的评价！"
              />
            </div>
          </div>

          {/* Fields */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-800">表单字段</h2>
              <button
                onClick={addField}
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                + 添加字段
              </button>
            </div>

            {sortedFields.length === 0 ? (
              <p className="text-sm text-gray-500">暂无字段，点击"添加字段"创建</p>
            ) : (
              <div className="space-y-3">
                {sortedFields.map((field, idx) => (
                  <div key={field.key} className="border rounded p-3 space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <label className="block text-xs text-gray-500 mb-1">字段标识（key）</label>
                        <input
                          type="text"
                          value={field.key}
                          onChange={(e) => updateField(idx, { key: e.target.value })}
                          className="border rounded px-2 py-1 text-xs w-full"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-xs text-gray-500 mb-1">显示名称</label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(idx, { label: e.target.value })}
                          className="border rounded px-2 py-1 text-xs w-full"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateField(idx, { required: e.target.checked })}
                        />
                        必填
                      </label>
                      <div className="flex gap-1 ml-auto">
                        <button onClick={() => moveField(idx, 'up')} disabled={idx === 0} className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1">↑</button>
                        <button onClick={() => moveField(idx, 'down')} disabled={idx === sortedFields.length - 1} className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1">↓</button>
                        <button onClick={() => removeField(idx)} className="text-xs text-red-400 hover:text-red-600 px-1">删除</button>
                      </div>
                    </div>
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
