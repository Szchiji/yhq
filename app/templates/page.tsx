'use client'

import { useState } from 'react'
import RichTextEditor from '@/components/RichTextEditor'

const tabs = [
  '编辑成功模板',
  '用户参与提示模板',
  '用户参加成功模板',
  '中奖私聊用户模板',
  '中奖私聊创建人模板',
  '中奖公开通知模板',
]

const placeholders = [
  '{lotterySn}',
  '{lotteryTitle}',
  '{lotteryDesc}',
  '{joinCondition}',
  '{openCondition}',
  '{goodsList}',
  '{lotteryLink}',
]

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [editorContent, setEditorContent] = useState(`抽奖信息

奖品标题：{lotteryTitle}

参与条件：{joinCondition}

开奖条件：{openCondition}

奖品列表：
{goodsList}

抽奖链接：{lotteryLink}

祝所有参与者好运！`)

  const [buttons, setButtons] = useState([
    { text: '参与抽奖', url: '' },
  ])

  const addButton = () => {
    setButtons([...buttons, { text: '', url: '' }])
  }

  const addRow = () => {
    // Add multiple buttons as a new row
    setButtons([...buttons, { text: '', url: '' }])
  }

  const updateButton = (index: number, field: 'text' | 'url', value: string) => {
    const newButtons = [...buttons]
    newButtons[index][field] = value
    setButtons(newButtons)
  }

  const deleteButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">抽奖消息模板</h1>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-6 py-3 font-medium whitespace-nowrap transition-colors ${
                activeTab === index
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6">
          {/* Rich Text Editor */}
          <RichTextEditor
            value={editorContent}
            onChange={setEditorContent}
            placeholder="请输入消息模板..."
            placeholders={placeholders}
          />

          {/* Button Configuration */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-800">附加按钮配置</h3>
            
            {buttons.map((button, index) => (
              <div key={index} className="flex gap-3 items-center">
                <input
                  type="text"
                  value={button.text}
                  onChange={(e) => updateButton(index, 'text', e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="按钮文字"
                />
                <input
                  type="text"
                  value={button.url}
                  onChange={(e) => updateButton(index, 'url', e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="按钮链接"
                />
                <button
                  onClick={() => deleteButton(index)}
                  className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  删除
                </button>
              </div>
            ))}
            
            <div className="flex gap-3">
              <button 
                onClick={addButton}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                + 添加新按钮
              </button>
              <button 
                onClick={addRow}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                + 添加新行
              </button>
            </div>
          </div>

          {/* Button Preview */}
          {buttons.some(b => b.text) && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-800">按钮预览：</h3>
              <div className="flex flex-wrap gap-3">
                {buttons.filter(b => b.text).map((button, index) => (
                  <button
                    key={index}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                  >
                    {button.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button className="px-8 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
              提交
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
