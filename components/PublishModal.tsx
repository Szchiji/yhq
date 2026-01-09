'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost } from '@/lib/api'

type Channel = {
  id: string
  chatId: string
  title: string
  type: string
}

type PublishModalProps = {
  lotteryId: string
  onClose: () => void
  onSuccess?: () => void
}

export default function PublishModal({ lotteryId, onClose, onSuccess }: PublishModalProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    fetchChannels()
  }, [])

  const fetchChannels = async () => {
    try {
      setLoading(true)
      const response = await apiGet('/api/announcement-channels')
      if (response.ok) {
        const data = await response.json()
        setChannels(data.data)
      } else {
        console.error('Failed to fetch channels')
      }
    } catch (error) {
      console.error('Error fetching channels:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleChannel = (channelId: string) => {
    const newSelected = new Set(selectedChannels)
    if (newSelected.has(channelId)) {
      newSelected.delete(channelId)
    } else {
      newSelected.add(channelId)
    }
    setSelectedChannels(newSelected)
  }

  const toggleAll = () => {
    if (selectedChannels.size === channels.length) {
      setSelectedChannels(new Set())
    } else {
      setSelectedChannels(new Set(channels.map(c => c.id)))
    }
  }

  const handlePublish = async () => {
    if (selectedChannels.size === 0) {
      alert('请至少选择一个推送目标')
      return
    }

    setPublishing(true)
    try {
      const selectedChannelObjects = channels.filter(c => selectedChannels.has(c.id))
      
      // Publish to each selected channel
      const promises = selectedChannelObjects.map(channel =>
        apiPost(`/api/lottery/${lotteryId}/publish`, {
          chatId: channel.chatId,
        })
      )

      const results = await Promise.allSettled(promises)
      
      const successCount = results.filter(r => r.status === 'fulfilled').length
      const failCount = results.filter(r => r.status === 'rejected').length

      if (failCount === 0) {
        alert(`推送成功！已推送到 ${successCount} 个群组/频道`)
      } else {
        alert(`部分推送成功：成功 ${successCount} 个，失败 ${failCount} 个`)
      }
      
      if (onSuccess) {
        onSuccess()
      }
      onClose()
    } catch (error) {
      console.error('Error publishing:', error)
      alert('推送失败，请稍后重试')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">选择推送目标</h2>
        
        {loading ? (
          <div className="py-8 text-center text-gray-500">加载中...</div>
        ) : channels.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-500 mb-2">暂无公告群/频道</p>
            <p className="text-xs text-gray-400">请先在"公告群/频道"页面添加推送目标</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {channels.map((channel) => (
                <label
                  key={channel.id}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedChannels.has(channel.id)}
                    onChange={() => toggleChannel(channel.id)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{channel.title}</div>
                    <div className="text-xs text-gray-500">
                      {channel.type === 'channel' ? '频道' : channel.type === 'supergroup' ? '超级群组' : '群组'}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={toggleAll}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                {selectedChannels.size === channels.length ? '取消全选' : '全选'}
              </button>
            </div>
          </>
        )}

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={publishing}
            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || channels.length === 0 || selectedChannels.size === 0}
            className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm disabled:opacity-50"
          >
            {publishing ? '推送中...' : `确认推送 (${selectedChannels.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
