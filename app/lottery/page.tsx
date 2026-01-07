'use client'

import { useState } from 'react'

type Prize = {
  id: number
  name: string
  total: number
  remaining: number
}

const notificationPlaceholders = [
  '{member}',
  '{lotteryTitle}',
  '{goodsName}',
  '{creator}',
  '{creatorId}',
  '{creatorName}',
  '{lotterySn}',
  '{awardUserList}',
  '{joinNum}',
]

export default function LotteryPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [showPrizeModal, setShowPrizeModal] = useState(false)
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [newPrize, setNewPrize] = useState({ name: '', total: 1 })
  const [groups, setGroups] = useState<string[]>([])
  const [newGroup, setNewGroup] = useState('')

  // Form states
  const [lotteryTitle, setLotteryTitle] = useState('')
  const [mediaType, setMediaType] = useState('none')
  const [description, setDescription] = useState('')
  const [participationMethod, setParticipationMethod] = useState('private')
  const [requireUsername, setRequireUsername] = useState(false)
  const [drawMethod, setDrawMethod] = useState('full')

  const [winnerNotification, setWinnerNotification] = useState('恭喜 {member}！您中奖了：{goodsName}')
  const [creatorNotification, setCreatorNotification] = useState('抽奖"{lotteryTitle}"已开奖，中奖用户已通知。')
  const [groupNotification, setGroupNotification] = useState('抽奖结果已公布！中奖名单：{awardUserList}')

  const tabs = ['基础信息', '奖品设置', '通知设置']

  const addPrize = () => {
    if (newPrize.name && newPrize.total > 0) {
      setPrizes([...prizes, { 
        id: Date.now(), 
        name: newPrize.name,
        total: newPrize.total,
        remaining: newPrize.total
      }])
      setNewPrize({ name: '', total: 1 })
      setShowPrizeModal(false)
    }
  }

  const deletePrize = (id: number) => {
    setPrizes(prizes.filter(p => p.id !== id))
  }

  const addGroup = () => {
    if (newGroup.trim()) {
      setGroups([...groups, newGroup.trim()])
      setNewGroup('')
    }
  }

  const removeGroup = (index: number) => {
    setGroups(groups.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">抽奖设置</h1>
        <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
          已参与用户
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === index
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Tab 1: 基础信息 */}
          {activeTab === 0 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  抽奖标题
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
                  抽奖文字说明
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                  placeholder="请输入抽奖说明"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  参与方式
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="private"
                      checked={participationMethod === 'private'}
                      onChange={(e) => setParticipationMethod(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">私聊机器人参与抽奖</span>
                  </label>
                  <label className="flex items-center">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  参与条件
                </label>
                <label className="flex items-center">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  需要加入的群或频道
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGroup}
                      onChange={(e) => setNewGroup(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="输入群组名称或ID"
                    />
                    <button
                      onClick={addGroup}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      添加
                    </button>
                  </div>
                  {groups.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {groups.map((group, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md flex items-center gap-2"
                        >
                          {group}
                          <button
                            onClick={() => removeGroup(idx)}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  开奖方式
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="full"
                      checked={drawMethod === 'full'}
                      onChange={(e) => setDrawMethod(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">满人开奖</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="timed"
                      checked={drawMethod === 'timed'}
                      onChange={(e) => setDrawMethod(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">定时开奖</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: 奖品设置 */}
          {activeTab === 1 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-800">奖品列表</h3>
                <button
                  onClick={() => setShowPrizeModal(true)}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                >
                  + 添加奖品
                </button>
              </div>

              {prizes.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">暂无奖品</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">奖品名称</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">奖品总数</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">剩余数量</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {prizes.map((prize) => (
                        <tr key={prize.id}>
                          <td className="px-6 py-4 text-gray-800">{prize.name}</td>
                          <td className="px-6 py-4 text-gray-600">{prize.total}</td>
                          <td className="px-6 py-4 text-gray-600">{prize.remaining}</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => deletePrize(prize.id)}
                              className="text-red-500 hover:text-red-700 transition-colors"
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
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  中奖私聊中奖人通知
                </label>
                <textarea
                  value={winnerNotification}
                  onChange={(e) => setWinnerNotification(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] font-mono text-sm"
                  placeholder="发送给中奖者的通知消息"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {notificationPlaceholders.map((placeholder, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono cursor-pointer hover:bg-gray-200"
                      onClick={() => setWinnerNotification(winnerNotification + ' ' + placeholder)}
                    >
                      {placeholder}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  中奖私聊创建人通知
                </label>
                <textarea
                  value={creatorNotification}
                  onChange={(e) => setCreatorNotification(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] font-mono text-sm"
                  placeholder="发送给抽奖创建者的通知消息"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {notificationPlaceholders.map((placeholder, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono cursor-pointer hover:bg-gray-200"
                      onClick={() => setCreatorNotification(creatorNotification + ' ' + placeholder)}
                    >
                      {placeholder}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  中奖发送到群/频道通知
                </label>
                <textarea
                  value={groupNotification}
                  onChange={(e) => setGroupNotification(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] font-mono text-sm"
                  placeholder="发送到群组/频道的中奖通知"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {notificationPlaceholders.map((placeholder, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono cursor-pointer hover:bg-gray-200"
                      onClick={() => setGroupNotification(groupNotification + ' ' + placeholder)}
                    >
                      {placeholder}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">变量说明：</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li><code className="bg-blue-100 px-1 rounded">{'{member}'}</code> - 中奖用户</li>
                  <li><code className="bg-blue-100 px-1 rounded">{'{lotteryTitle}'}</code> - 抽奖标题</li>
                  <li><code className="bg-blue-100 px-1 rounded">{'{goodsName}'}</code> - 奖品名称</li>
                  <li><code className="bg-blue-100 px-1 rounded">{'{creator}'}</code> - 创建者</li>
                  <li><code className="bg-blue-100 px-1 rounded">{'{creatorId}'}</code> - 创建者ID</li>
                  <li><code className="bg-blue-100 px-1 rounded">{'{creatorName}'}</code> - 创建者名称</li>
                  <li><code className="bg-blue-100 px-1 rounded">{'{lotterySn}'}</code> - 抽奖编号</li>
                  <li><code className="bg-blue-100 px-1 rounded">{'{awardUserList}'}</code> - 中奖用户列表</li>
                  <li><code className="bg-blue-100 px-1 rounded">{'{joinNum}'}</code> - 参与人数</li>
                </ul>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200 mt-6">
            <button className="px-8 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
              提交
            </button>
          </div>
        </div>
      </div>

      {/* Prize Modal */}
      {showPrizeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">添加奖品</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  奖品名称
                </label>
                <input
                  type="text"
                  value={newPrize.name}
                  onChange={(e) => setNewPrize({ ...newPrize, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入奖品名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  奖品数量
                </label>
                <input
                  type="number"
                  min="1"
                  value={newPrize.total}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    setNewPrize({ ...newPrize, total: val > 0 ? val : 1 })
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPrizeModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={addPrize}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
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
