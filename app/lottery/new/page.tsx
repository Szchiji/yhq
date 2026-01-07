'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewLotteryPage() {
  const router = useRouter()
  const [lotteryTitle, setLotteryTitle] = useState('')
  const [mediaType, setMediaType] = useState('none')
  const [description, setDescription] = useState('')

  const handleCreate = () => {
    // TODO: Implement lottery creation logic
    console.log('Creating lottery:', { lotteryTitle, mediaType, description })
    // Redirect to lottery settings page after creation
    router.push('/lottery')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">创建新抽奖</h1>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          返回
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            抽奖标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={lotteryTitle}
            onChange={(e) => setLotteryTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="请输入抽奖标题"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            图片或视频
          </label>
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="none">无</option>
            <option value="image">图片</option>
            <option value="video">视频</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            抽奖说明
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
            placeholder="请输入抽奖说明"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!lotteryTitle.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            创建抽奖
          </button>
        </div>
      </div>
    </div>
  )
}
