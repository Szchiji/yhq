'use client'

import { useState, useEffect } from 'react'
import RichTextEditor from '@/components/RichTextEditor'
import ButtonEditor, { ButtonLayout } from '@/components/ButtonEditor'
import { apiGet, apiPost } from '@/lib/api'
import { TEMPLATE_PLACEHOLDERS, getDefaultTemplate } from '@/lib/placeholders'

const templateTypes = [
  { key: 'edit_success', name: '编辑成功模板' },
  { key: 'user_join_prompt', name: '用户参与提示模板' },
  { key: 'user_join_success', name: '用户参加成功模板' },
  { key: 'winner_private', name: '中奖私聊用户模板' },
  { key: 'creator_private', name: '中奖私聊创建人模板' },
  { key: 'winner_public', name: '中奖公开通知模板' },
]

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [templates, setTemplates] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editorContent, setEditorContent] = useState('')
  const [buttons, setButtons] = useState<ButtonLayout>([])

  useEffect(() => {
    fetchTemplates()
  }, [])

  useEffect(() => {
    // Load template data when tab changes
    const currentType = templateTypes[activeTab].key
    const template = templates[currentType]
    if (template) {
      setEditorContent(template.content)
      setButtons(template.buttons || [])
    } else {
      // Set default content
      setEditorContent(getDefaultContent(currentType))
      setButtons([])
    }
  }, [activeTab, templates])

  const fetchTemplates = async () => {
    try {
      const response = await apiGet('/api/templates')
      if (response.ok) {
        const data = await response.json()
        const templatesMap: Record<string, any> = {}
        data.data.forEach((t: any) => {
          templatesMap[t.type] = t
        })
        setTemplates(templatesMap)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDefaultContent = (type: string) => {
    return getDefaultTemplate(type)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const currentType = templateTypes[activeTab].key
      const response = await apiPost('/api/templates', {
        template: {
          type: currentType,
          content: editorContent,
          buttons: buttons.length > 0 ? buttons : null,
        },
      })

      if (response.ok) {
        alert('保存成功！')
        fetchTemplates()
      } else {
        const error = await response.json()
        alert(`保存失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error saving template:', error)
      alert('保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">抽奖消息模板</h1>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {templateTypes.map((template, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-3 sm:px-4 py-2 sm:py-3 font-medium whitespace-nowrap transition-colors text-xs sm:text-sm ${
                activeTab === index
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {template.name}
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          {/* Rich Text Editor */}
          <RichTextEditor
            value={editorContent}
            onChange={setEditorContent}
            placeholder="请输入消息模板..."
            placeholders={TEMPLATE_PLACEHOLDERS[templateTypes[activeTab].key as keyof typeof TEMPLATE_PLACEHOLDERS] || []}
          />

          {/* Button Configuration */}
          <ButtonEditor buttons={buttons} onChange={setButtons} />

          {/* Submit Button */}
          <div className="flex justify-end pt-3 sm:pt-4 border-t border-gray-200">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
