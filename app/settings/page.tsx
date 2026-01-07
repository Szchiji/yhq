'use client'

import { useState } from 'react'

type Prize = {
  id: number
  name: string
  quantity: number
}

const notificationPlaceholders = [
  '{winnerName}',
  '{prizeName}',
  '{lotteryTitle}',
  '{drawTime}',
  '{contactInfo}',
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [showPrizeModal, setShowPrizeModal] = useState(false)
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [newPrize, setNewPrize] = useState({ name: '', quantity: 1 })
  const [groups, setGroups] = useState<string[]>([])
  const [newGroup, setNewGroup] = useState('')

  // Form states
  const [lotteryTitle, setLotteryTitle] = useState('')
  const [mediaType, setMediaType] = useState('image')
  const [description, setDescription] = useState('')
  const [participationMethod, setParticipationMethod] = useState('private')
  const [requireUsername, setRequireUsername] = useState(false)
  const [drawMethod, setDrawMethod] = useState('full')

  const [winnerNotification, setWinnerNotification] = useState('Congratulations {winnerName}! You have won {prizeName}!')
  const [creatorNotification, setCreatorNotification] = useState('Lottery "{lotteryTitle}" has been drawn. Winners have been notified.')
  const [groupNotification, setGroupNotification] = useState('Lottery results are now available!')

  const tabs = ['Basic Info', 'Prize Settings', 'Notification Settings']

  const addPrize = () => {
    if (newPrize.name && newPrize.quantity > 0) {
      setPrizes([...prizes, { id: Date.now(), ...newPrize }])
      setNewPrize({ name: '', quantity: 1 })
      setShowPrizeModal(false)
    }
  }

  const addGroup = () => {
    if (newGroup.trim()) {
      setGroups([...groups, newGroup.trim()])
      setNewGroup('')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Lottery Management</h1>

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
          {/* Tab 1: Basic Info */}
          {activeTab === 0 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lottery Title
                </label>
                <input
                  type="text"
                  value={lotteryTitle}
                  onChange={(e) => setLotteryTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter lottery title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image/Video
                </label>
                <select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="none">None</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lottery Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                  placeholder="Enter lottery description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Participation Method
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
                    <span className="text-gray-700">Private Message</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="keyword"
                      checked={participationMethod === 'keyword'}
                      onChange={(e) => setParticipationMethod(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">Group Keyword</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Conditions
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={requireUsername}
                    onChange={(e) => setRequireUsername(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-gray-700">Must have username</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Groups
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGroup}
                      onChange={(e) => setNewGroup(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter group name or ID"
                    />
                    <button
                      onClick={addGroup}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Add
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
                            onClick={() => setGroups(groups.filter((_, i) => i !== idx))}
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
                  Draw Method
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
                    <span className="text-gray-700">Draw when all prizes claimed</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="timed"
                      checked={drawMethod === 'timed'}
                      onChange={(e) => setDrawMethod(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">Draw at scheduled time</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button className="px-8 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
                  Save Basic Info
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Prize Settings */}
          {activeTab === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-4">Prize List</h3>
                {prizes.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No prizes added yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {prizes.map((prize, idx) => (
                      <div
                        key={prize.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <span className="font-medium text-gray-800">{prize.name}</span>
                          <span className="ml-4 text-gray-600">Quantity: {prize.quantity}</span>
                        </div>
                        <button
                          onClick={() => setPrizes(prizes.filter(p => p.id !== prize.id))}
                          className="px-4 py-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowPrizeModal(true)}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
              >
                + Add Prize
              </button>

              <div className="flex justify-end pt-4">
                <button className="px-8 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
                  Save Prize Settings
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Notification Settings */}
          {activeTab === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Winner Notification
                </label>
                <textarea
                  value={winnerNotification}
                  onChange={(e) => setWinnerNotification(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] font-mono text-sm"
                  placeholder="Message to send to winners"
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
                  Creator Notification
                </label>
                <textarea
                  value={creatorNotification}
                  onChange={(e) => setCreatorNotification(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] font-mono text-sm"
                  placeholder="Message to send to lottery creator"
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
                  Group Notification
                </label>
                <textarea
                  value={groupNotification}
                  onChange={(e) => setGroupNotification(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] font-mono text-sm"
                  placeholder="Message to send to group"
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

              <div className="flex justify-end pt-4">
                <button className="px-8 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
                  Save Notification Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prize Modal */}
      {showPrizeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Add Prize</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prize Name
                </label>
                <input
                  type="text"
                  value={newPrize.name}
                  onChange={(e) => setNewPrize({ ...newPrize, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter prize name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prize Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={newPrize.quantity}
                  onChange={(e) => setNewPrize({ ...newPrize, quantity: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPrizeModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addPrize}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
