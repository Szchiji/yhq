'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTelegramInitData } from '@/lib/telegram-webapp'

type Prize = {
  id: number
  name: string
  total: number
}

const notificationPlaceholders = [
  '{member}', '{lotteryTitle}', '{goodsName}', '{creator}',
  '{creatorId}', '{creatorName}', '{lotterySn}', '{awardUserList}', '{joinNum}'
]

export default function NewLotteryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  
  // Form states
  const [lotteryTitle, setLotteryTitle] = useState('')
  const [mediaType, setMediaType] = useState('none')
  const [mediaUrl, setMediaUrl] = useState('')
  const [description, setDescription] = useState('')
  const [participationMethod, setParticipationMethod] = useState('private')
  const [keyword, setKeyword] = useState('')
  const [requireUsername, setRequireUsername] = useState(false)
  const [requireChannels, setRequireChannels] = useState<string[]>([])
  const [newChannel, setNewChannel] = useState('')
  const [drawType, setDrawType] = useState('count')
  const [drawTime, setDrawTime] = useState('')
  const [drawCount, setDrawCount] = useState(100)
  
  // Prizes
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [showPrizeModal, setShowPrizeModal] = useState(false)
  const [newPrize, setNewPrize] = useState({ name: '', total: 1 })
  
  // Notifications
  const [winnerNotification, setWinnerNotification] = useState('恭喜 {member}！您中奖了：{goodsName}')
  const [creatorNotification, setCreatorNotification] = useState('抽奖"{lotteryTitle}"已开奖，中奖用户已通知。')
  const [groupNotification] = useState('抽奖结果已公布！中奖名单：{awardUserList}')

  const tabs = ['基础信息', '奖品设置', '通知设置']

  const addPrize = () => {
    if (newPrize.name && newPrize.total > 0) {
      setPrizes([...prizes, { 
        id: Date.now(), 
        name: newPrize.name,
        total: newPrize.total,
      }])
      setNewPrize({ name: '', total: 1 })
      setShowPrizeModal(false)
    }
  }

  const deletePrize = (id: number) => {
    setPrizes(prizes.filter(p => p.id !== id))
  }

  const addChannel = () => {
    if (newChannel.trim() && !requireChannels.includes(newChannel.trim())) {
      setRequireChannels([...requireChannels, newChannel.trim()])
      setNewChannel('')
    }
  }

  const removeChannel = (index: number) => {
    setRequireChannels(requireChannels.filter((_, i) => i !== index))
  }

  const handleCreate = async () => {
    // Validation
    if (!lotteryTitle.trim()) {
      alert('请输入抽奖标题')
      return
    }
    
    if (prizes.length === 0) {
      alert('请至少添加一个奖品')
      return
    }
    
    if (drawType === 'time' && !drawTime) {
      alert('请设置开奖时间')
      return
    }
    
    if (drawType === 'count' && (!drawCount || drawCount < 1)) {
      alert('请设置参与人数')
      return
    }

    setLoading(true)
    try {
      const initData = getTelegramInitData()
      
      const response = await fetch('/api/lottery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          lottery: {
            title: lotteryTitle,
            description,
            mediaType,
            mediaUrl: mediaUrl || null,
            participationMethod,
            keyword: keyword || null,
            requireUsername,
            requireChannels,
            drawType,
            drawTime: drawType === 'time' ? drawTime : null,
            drawCount: drawType === 'count' ? drawCount : null,
            winnerNotification,
            creatorNotification,
            groupNotification,
            prizes: prizes.map(p => ({ name: p.name, total: p.total })),
          },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        alert('创建成功！')
        router.push(`/lottery/${data.id}`)
      } else {
        const error = await response.json()
        alert(`创建失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error creating lottery:', error)
      alert('创建失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">创建新抽奖</h1>
        <button
          onClick={() => router.back()}
          className="px-3 py-1.5 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs sm:text-sm"
        >
          返回
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-4 sm:px-6 py-2 sm:py-3 font-medium transition-colors text-xs sm:text-sm whitespace-nowrap ${
                activeTab === index
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          {/* Tab 1: 基础信息 */}
          {activeTab === 0 && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  抽奖标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={lotteryTitle}
                  onChange={(e) => setLotteryTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="请输入抽奖标题"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  图片或视频
                </label>
                <select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="none">无</option>
                  <option value="image">图片</option>
                  <option value="video">视频</option>
                </select>
              </div>

              {mediaType !== 'none' && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    媒体URL
                  </label>
                  <input
                    type="text"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="请输入图片或视频URL"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  抽奖说明
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] sm:min-h-[100px] text-sm"
                  placeholder="请输入抽奖说明"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  参与方式
                </label>
                <div className="space-y-2">
                  <label className="flex items-center text-xs sm:text-sm">
                    <input
                      type="radio"
                      value="private"
                      checked={participationMethod === 'private'}
                      onChange={(e) => setParticipationMethod(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">私聊机器人参与抽奖</span>
                  </label>
                  <label className="flex items-center text-xs sm:text-sm">
                    <input
                      type="radio"
                      value="keyword"
                      checked={participationMethod === 'keyword'}
                      onChange={(e) => setParticipationMethod(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">群内发送关键词参与抽奖</span>
                  </label>
                </div>
              </div>

              {participationMethod === 'keyword' && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    关键词
                  </label>
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="请输入触发关键词"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  参与条件
                </label>
                <label className="flex items-center text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={requireUsername}
                    onChange={(e) => setRequireUsername(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-gray-700">必须有用户名</span>
                </label>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  需要加入的频道/群组 (ID或username)
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newChannel}
                      onChange={(e) => setNewChannel(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="例如：@channelname 或 -1001234567890"
                    />
                    <button
                      onClick={addChannel}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs sm:text-sm"
                    >
                      添加
                    </button>
                  </div>
                  {requireChannels.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {requireChannels.map((channel, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded flex items-center gap-1 text-xs"
                        >
                          {channel}
                          <button
                            onClick={() => removeChannel(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  开奖方式 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-center text-xs sm:text-sm">
                    <input
                      type="radio"
                      value="count"
                      checked={drawType === 'count'}
                      onChange={(e) => setDrawType(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">人满开奖</span>
                  </label>
                  {drawType === 'count' && (
                    <input
                      type="number"
                      min="1"
                      value={drawCount}
                      onChange={(e) => setDrawCount(parseInt(e.target.value) || 1)}
                      className="ml-6 w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="参与人数"
                    />
                  )}
                  <label className="flex items-center text-xs sm:text-sm">
                    <input
                      type="radio"
                      value="time"
                      checked={drawType === 'time'}
                      onChange={(e) => setDrawType(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">定时开奖</span>
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
            </div>
          )}

          {/* Tab 2: 奖品设置 */}
          {activeTab === 1 && (
            <div className="space-y-4 sm:space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm sm:text-lg font-medium text-gray-800">奖品列表</h3>
                <button
                  onClick={() => setShowPrizeModal(true)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 text-xs sm:text-sm"
                >
                  + 添加奖品
                </button>
              </div>

              {prizes.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500 text-sm">暂无奖品，请添加至少一个奖品</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700">奖品名称</th>
                        <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700">数量</th>
                        <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {prizes.map((prize) => (
                        <tr key={prize.id}>
                          <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-800">{prize.name}</td>
                          <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-600">{prize.total}</td>
                          <td className="px-3 sm:px-4 py-2">
                            <button
                              onClick={() => deletePrize(prize.id)}
                              className="text-red-500 hover:text-red-700 text-xs sm:text-sm"
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: 通知设置 */}
          {activeTab === 2 && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  中奖私聊中奖人通知
                </label>
                <textarea
                  value={winnerNotification}
                  onChange={(e) => setWinnerNotification(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[70px] font-mono text-xs sm:text-sm"
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {notificationPlaceholders.map((p, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-mono cursor-pointer hover:bg-gray-200"
                      onClick={() => setWinnerNotification(winnerNotification + ' ' + p)}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  中奖私聊创建人通知
                </label>
                <textarea
                  value={creatorNotification}
                  onChange={(e) => setCreatorNotification(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[70px] font-mono text-xs sm:text-sm"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-3 sm:pt-4 border-t border-gray-200">
            <button
              onClick={() => router.back()}
              className="px-4 sm:px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !lotteryTitle.trim() || prizes.length === 0}
              className="px-4 sm:px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? '创建中...' : '创建抽奖'}
            </button>
          </div>
        </div>
      </div>

      {/* Prize Modal */}
      {showPrizeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">添加奖品</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  奖品名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPrize.name}
                  onChange={(e) => setNewPrize({ ...newPrize, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="请输入奖品名称"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  奖品数量 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={newPrize.total}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    setNewPrize({ ...newPrize, total: val > 0 ? val : 1 })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPrizeModal(false)}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                取消
              </button>
              <button
                onClick={addPrize}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
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
