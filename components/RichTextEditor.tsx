'use client'

import React, { useState } from 'react'

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
  minHeight = '300px',
  className = '',
}: RichTextEditorProps) {
  const [selectionStart, setSelectionStart] = useState(0)

  const insertFormat = (format: string) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
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

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="bg-gray-50 border-b border-gray-300 p-2 flex gap-2 flex-wrap">
          {toolbarButtons.map((btn, idx) => (
            <button
              key={idx}
              onClick={() => insertFormat(btn.format)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors text-sm"
              title={btn.label}
              type="button"
            >
              {btn.icon}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onSelect={(e) => setSelectionStart((e.target as HTMLTextAreaElement).selectionStart)}
          className="w-full p-4 font-mono text-sm focus:outline-none"
          style={{ minHeight }}
          placeholder={placeholder}
        />
      </div>

      {/* Placeholders Info */}
      {placeholders.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">可用变量：</h3>
          <div className="flex flex-wrap gap-2">
            {placeholders.map((placeholder, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md font-mono text-sm cursor-pointer hover:bg-blue-200 transition-colors"
                onClick={() => insertPlaceholder(placeholder)}
              >
                {placeholder}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
