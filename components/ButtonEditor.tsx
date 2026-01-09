'use client'

import React, { useState } from 'react'

export type ButtonItem = {
  type: 'link' | 'builtin'
  text: string
  url?: string
  action?: string
}

export type ButtonRow = ButtonItem[]
export type ButtonLayout = ButtonRow[]

type ButtonEditorProps = {
  buttons: ButtonLayout
  onChange: (buttons: ButtonLayout) => void
}

export default function ButtonEditor({ buttons, onChange }: ButtonEditorProps) {
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [currentRow, setCurrentRow] = useState<number>(0)
  const [currentCol, setCurrentCol] = useState<number>(0)
  const [editingButton, setEditingButton] = useState<ButtonItem>({
    type: 'link',
    text: '',
    url: '',
  })
  const [isNewButton, setIsNewButton] = useState(true)

  const openAddButtonModal = (rowIndex: number, isNewRow: boolean = false) => {
    if (isNewRow) {
      setCurrentRow(buttons.length)
      setCurrentCol(0)
    } else {
      setCurrentRow(rowIndex)
      setCurrentCol(buttons[rowIndex]?.length || 0)
    }
    setIsNewButton(true)
    setEditingButton({ type: 'link', text: '', url: '' })
    setShowTypeModal(true)
  }

  const openEditButtonModal = (rowIndex: number, colIndex: number) => {
    setCurrentRow(rowIndex)
    setCurrentCol(colIndex)
    setIsNewButton(false)
    setEditingButton({ ...buttons[rowIndex][colIndex] })
    setShowEditModal(true)
  }

  const selectButtonType = (type: 'link' | 'builtin') => {
    setEditingButton({ ...editingButton, type })
    setShowTypeModal(false)
    setShowEditModal(true)
  }

  const saveButton = () => {
    if (!editingButton.text) {
      alert('请输入按钮文字')
      return
    }

    if (editingButton.type === 'link' && !editingButton.url) {
      alert('请输入按钮链接')
      return
    }

    if (editingButton.type === 'builtin' && !editingButton.action) {
      alert('请选择按钮动作')
      return
    }

    const newButtons = [...buttons]
    
    if (isNewButton) {
      // Add new button
      if (currentRow >= newButtons.length) {
        // New row
        newButtons.push([editingButton])
      } else {
        // Add to existing row
        newButtons[currentRow].push(editingButton)
      }
    } else {
      // Update existing button
      newButtons[currentRow][currentCol] = editingButton
    }

    onChange(newButtons)
    setShowEditModal(false)
  }

  const deleteButton = (rowIndex: number, colIndex: number) => {
    const newButtons = [...buttons]
    newButtons[rowIndex].splice(colIndex, 1)
    
    // Remove empty rows
    const filteredButtons = newButtons.filter(row => row.length > 0)
    
    onChange(filteredButtons)
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <h3 className="font-medium text-gray-800 text-sm sm:text-base">按钮配置</h3>
      
      {/* Button Layout Display */}
      <div className="space-y-2">
        {buttons.map((row, rowIndex) => (
          <div key={rowIndex} className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {row.map((button, colIndex) => (
                <div key={colIndex} className="relative group">
                  <button
                    type="button"
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors text-xs sm:text-sm"
                    onClick={() => openEditButtonModal(rowIndex, colIndex)}
                  >
                    {button.text}
                    {button.type === 'builtin' && (
                      <span className="ml-1 text-xs">⚡</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteButton(rowIndex, colIndex)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => openAddButtonModal(rowIndex, false)}
                className="px-3 py-1.5 sm:py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-500 transition-colors text-xs sm:text-sm"
              >
                + 本行新增按钮
              </button>
            </div>
          </div>
        ))}
        
        <button
          type="button"
          onClick={() => openAddButtonModal(buttons.length, true)}
          className="w-full px-3 py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-500 transition-colors text-xs sm:text-sm"
        >
          + 新增一行按钮
        </button>
      </div>

      {/* Type Selection Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">选择按钮类型</h2>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => selectButtonType('link')}
                className="w-full p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="font-medium text-gray-800">🔗 添加链接按钮</div>
                <div className="text-sm text-gray-600 mt-1">输入按钮文字和链接URL</div>
              </button>
              <button
                type="button"
                onClick={() => selectButtonType('builtin')}
                className="w-full p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="font-medium text-gray-800">⚡ 添加系统内置按钮</div>
                <div className="text-sm text-gray-600 mt-1">选择预设的系统按钮</div>
              </button>
            </div>
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setShowTypeModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
              {editingButton.type === 'link' ? '链接按钮' : '系统内置按钮'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  按钮文字 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingButton.text}
                  onChange={(e) => setEditingButton({ ...editingButton, text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="例如：参与抽奖、查看详情"
                />
              </div>
              
              {editingButton.type === 'link' ? (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    链接 URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingButton.url || ''}
                    onChange={(e) => setEditingButton({ ...editingButton, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="https://example.com"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    按钮动作 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editingButton.action || ''}
                    onChange={(e) => setEditingButton({ ...editingButton, action: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">请选择...</option>
                    <option value="join_lottery">参与抽奖</option>
                    <option value="view_details">查看详情</option>
                    <option value="share">分享</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveButton}
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
