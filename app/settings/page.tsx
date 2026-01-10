'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost } from '@/lib/api'

type Settings = {
  lottery_limit_enabled: string
  lottery_daily_limit: string
  vip_unlimited: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    lottery_limit_enabled: 'false',
    lottery_daily_limit: '3',
    vip_unlimited: 'true',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await apiGet('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data.data)
      } else {
        console.error('Failed to fetch settings')
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await apiPost('/api/settings', { settings })
      
      if (response.ok) {
        alert('保存成功！')
      } else {
        const error = await response.json()
        alert(`保存失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">系统设置</h1>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-yellow-800">
          ⚠️ 注意：此页面仅超级管理员可访问。修改系统设置会影响所有用户。
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-6">
        {/* 抽奖限制 */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">抽奖参与限制</h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="lottery_limit_enabled"
                checked={settings.lottery_limit_enabled === 'true'}
                onChange={(e) => setSettings({
                  ...settings,
                  lottery_limit_enabled: e.target.checked ? 'true' : 'false'
                })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="lottery_limit_enabled" className="text-sm font-medium text-gray-700">
                启用每日参与次数限制
              </label>
            </div>

            {settings.lottery_limit_enabled === 'true' && (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  每日参与次数限制
                </label>
                <input
                  type="number"
                  value={settings.lottery_daily_limit}
                  onChange={(e) => setSettings({
                    ...settings,
                    lottery_daily_limit: e.target.value
                  })}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  普通用户每天可以参与抽奖的次数
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="vip_unlimited"
                checked={settings.vip_unlimited === 'true'}
                onChange={(e) => setSettings({
                  ...settings,
                  vip_unlimited: e.target.checked ? 'true' : 'false'
                })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="vip_unlimited" className="text-sm font-medium text-gray-700">
                VIP用户无限制
              </label>
            </div>
            <p className="text-xs text-gray-500 ml-7">
              如果启用，VIP用户将不受每日参与次数限制
            </p>
          </div>
        </div>

        {/* 功能说明 */}
        <div>
          <h3 className="text-md font-bold text-gray-800 mb-3">功能说明</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-700">
            <p>• <strong>抽奖限制：</strong>控制用户每天可以参与抽奖的次数，防止刷量</p>
            <p>• <strong>VIP特权：</strong>VIP用户可以无限次参与抽奖（如果启用）</p>
            <p>• <strong>计数重置：</strong>每天0点自动重置参与次数</p>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  )
}
