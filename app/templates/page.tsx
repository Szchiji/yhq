'use client'

import { useState } from 'react'

const tabs = [
  'Edit Success Template',
  'User Participation Hint',
  'User Success Template',
  'User Failure Template',
  'Creator Notification',
]

const toolbarButtons = [
  { icon: 'B', label: 'Bold' },
  { icon: 'I', label: 'Italic' },
  { icon: 'U', label: 'Underline' },
  { icon: '🔗', label: 'Link' },
  { icon: '📋', label: 'List' },
  { icon: '🖼️', label: 'Image' },
]

const placeholders = [
  '{lotteryTitle}',
  '{joinCondition}',
  '{endTime}',
  '{prizeList}',
  '{winnerCount}',
]

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [editorContent, setEditorContent] = useState(`Lottery Summary

Prize Title: {lotteryTitle}

Participation Conditions: {joinCondition}

Lottery End Time: {endTime}

Prize List:
{prizeList}

Number of Winners: {winnerCount}

Good luck to all participants!`)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Lottery Message Template</h1>

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
          <div className="space-y-4">
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              {/* Toolbar */}
              <div className="bg-gray-50 border-b border-gray-300 p-2 flex gap-2">
                {toolbarButtons.map((btn, idx) => (
                  <button
                    key={idx}
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                    title={btn.label}
                  >
                    {btn.icon}
                  </button>
                ))}
              </div>

              {/* Content Area */}
              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                className="w-full p-4 min-h-[300px] font-mono text-sm focus:outline-none"
                placeholder="Enter your message template here..."
              />
            </div>

            {/* Placeholders Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Available Placeholders:</h3>
              <div className="flex flex-wrap gap-2">
                {placeholders.map((placeholder, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md font-mono text-sm cursor-pointer hover:bg-blue-200 transition-colors"
                    onClick={() => {
                      setEditorContent(editorContent + ' ' + placeholder)
                    }}
                  >
                    {placeholder}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Button Preview */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-800">Button Preview:</h3>
            <div className="flex gap-4">
              <button className="px-8 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
                Participate in Lottery
              </button>
            </div>
            
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                + Add New Button
              </button>
              <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                + Add New Row
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button className="px-8 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
