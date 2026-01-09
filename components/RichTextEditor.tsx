'use client'

import React, { useRef } from 'react'
import { PLACEHOLDERS } from '@/lib/placeholders'

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  placeholders?: string[]
  minHeight?: string
  className?: string
}

const toolbarButtons = [
  { icon: 'B', label: '粗体', format: '**' },
  { icon: 'I', label: '斜体', format: '*' },
  { icon: 'U', label: '下划线', format: '__' },
  { icon: 'S', label: '删除线', format: '~~' },
  { icon: '<>', label: '代码', format: '`' },
  { icon: '❝', label: '引用', format: '> ' },
  { icon: '•', label: '列表', format: '- ' },
  { icon: '🔗', label: '链接', format: '[](url)' },
]

export default function RichTextEditor({
  value,
  onChange,
  placeholder = '请输入内容...',
  placeholders = [],
  minHeight = '200px',
  className = '',
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertFormat = (format: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    
    let newText = ''
    if (format === '> ' || format === '- ') {
      newText = value.substring(0, start) + format + selectedText + value.substring(end)
    } else if (format === '[](url)') {
      newText = value.substring(0, start) + '[' + selectedText + '](url)' + value.substring(end)
    } else {
      newText = value.substring(0, start) + format + selectedText + format + value.substring(end)
    }
    
    onChange(newText)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + format.length, start + format.length + selectedText.length)
    }, 0)
  }

  const insertPlaceholder = (placeholder: string) => {
    onChange(value + ' ' + placeholder)
  }

  // Get placeholder info from PLACEHOLDERS
  const getPlaceholderInfo = (key: string) => {
    const placeholder = Object.values(PLACEHOLDERS).find(p => p.key === key)
    return placeholder ? `${key} - ${placeholder.name}` : key
  }

  return (
    <div className={`space-y-3 sm:space-y-4 ${className}`}>
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="bg-gray-50 border-b border-gray-300 p-1.5 sm:p-2 flex gap-1 sm:gap-2 flex-wrap">
          {toolbarButtons.map((btn, idx) => (
            <button
              key={idx}
              onClick={() => insertFormat(btn.format)}
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors text-xs sm:text-sm"
              title={btn.label}
              type="button"
            >
              {btn.icon}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-3 sm:p-4 font-mono text-xs sm:text-sm focus:outline-none"
          style={{ minHeight }}
          placeholder={placeholder}
        />
      </div>

      {/* Placeholders Info */}
      {placeholders.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
          <h3 className="font-medium text-blue-900 mb-2 text-xs sm:text-sm">可用占位符：</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {placeholders.map((placeholder, idx) => (
              <button
                key={idx}
                type="button"
                className="text-left px-2 sm:px-3 py-1.5 sm:py-2 bg-white border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                onClick={() => insertPlaceholder(placeholder)}
              >
                <div className="font-mono text-xs text-blue-700">{placeholder}</div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {Object.values(PLACEHOLDERS).find(p => p.key === placeholder)?.name || ''}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
