'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPut } from '@/lib/api'

type Lottery = {
  id: string
  title: string
  description: string | null
  status: string
  drawType: string
  drawTime: Date | null
  drawCount: number | null
  prizes: Array<{
    id: string
    name: string
    total: number
  }>
}

export default function EditLotteryPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lottery, setLottery] = useState<Lottery | null>(null)
  
  // Form states
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [drawType, setDrawType] = useState('count')
  const [drawTime, setDrawTime] = useState('')
  const [drawCount, setDrawCount] = useState(100)

  useEffect(() => {
    fetchLottery()
  }, [params.id])

  const fetchLottery = async () => {
    try {
      setLoading(true)
      const response = await apiGet(`/api/lottery/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setLottery(data.data)
        
        // Populate form
        setTitle(data.data.title)
        setDescription(data.data.description || '')
        setDrawType(data.data.drawType)
        setDrawTime(data.data.drawTime ? new Date(data.data.drawTime).toISOString().slice(0, 16) : '')
        setDrawCount(data.data.drawCount || 100)
      } else {
        alert('加载抽奖失败')
        router.push('/lottery')
      }
    } catch (error) {
      console.error('Error fetching lottery:', error)
      alert('加载抽奖失败')
      router.push('/lottery')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!title) {
      alert('请输入抽奖标题')
      return
    }

    if (drawType === 'time' && !drawTime) {
      alert('请选择开奖时间')
      return
    }

    if (drawType === 'count' && (!drawCount || drawCount <= 0)) {
      alert('请输入有效的开奖人数')
      return
    }

    setSaving(true)
    try {
      // Prepare the full lottery object for update
      const updatedLottery = {
        ...lottery,
        title,
        description,
        drawType,
        drawTime: drawType === 'time' ? new Date(drawTime).toISOString() : null,
        drawCount: drawType === 'count' ? drawCount : null,
      }

      const response = await apiPut(`/api/lottery/${params.id}`, { lottery: updatedLottery })
      
      if (response.ok) {
        alert('更新成功！')
        router.push(`/lottery/${params.id}`)
      } else {
        const error = await response.json()
        alert(`更新失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error updating lottery:', error)
      alert('更新失败，请稍后重试')
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

  if (!lottery) {
    return null
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">编辑抽奖</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Title */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            抽奖标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="请输入抽奖标题"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            抽奖说明
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] text-sm"
            placeholder="请输入抽奖说明"
          />
        </div>

        {/* Draw Type */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            开奖方式 <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="count"
                checked={drawType === 'count'}
                onChange={(e) => setDrawType(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-sm">人满开奖</span>
            </label>
            {drawType === 'count' && (
              <input
                type="number"
                value={drawCount}
                onChange={(e) => setDrawCount(parseInt(e.target.value) || 0)}
                className="ml-6 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-32"
                placeholder="人数"
              />
            )}
            
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="time"
                checked={drawType === 'time'}
                onChange={(e) => setDrawType(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-sm">定时开奖</span>
            </label>
            {drawType === 'time' && (
              <input
                type="datetime-local"
                value={drawTime}
                onChange={(e) => setDrawTime(e.target.value)}
                className="ml-6 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            )}
          </div>
        </div>

        {/* Prizes (Read-only for now) */}
        {lottery.prizes && lottery.prizes.length > 0 && (
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              奖品列表
            </label>
            <div className="space-y-2">
              {lottery.prizes.map((prize: any) => (
                <div key={prize.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{prize.name}</span>
                    <span className="text-xs text-gray-600">总数：{prize.total}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              注意：奖品设置不可编辑。如需修改，请创建新的抽奖。
            </p>
          </div>
        )}

        {/* Status */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">状态：</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                lottery.status === 'active' ? 'bg-green-100 text-green-800' :
                lottery.status === 'drawn' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {lottery.status === 'active' ? '进行中' :
                 lottery.status === 'drawn' ? '已开奖' : '已取消'}
              </span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={() => router.back()}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || lottery.status !== 'active'}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm"
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
        </div>
        
        {lottery.status !== 'active' && (
          <p className="text-xs text-red-500 text-center">
            只有进行中的抽奖可以编辑
          </p>
        )}
      </div>
    </div>
  )
}
