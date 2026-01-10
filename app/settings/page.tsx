'use client'

import { useState, useEffect } from 'react'
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp'
import { apiGet, apiPut } from '@/lib/api'

export default function SettingsPage() {
  const { user, initData, isSuperAdmin } = useTelegramWebApp()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    lottery_limit_enabled: 'false',
    lottery_daily_limit: '3',
    vip_unlimited: 'true',
  })

  useEffect(() => {
    if (initData) {
      fetchSettings()
    }
  }, [initData])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await apiGet('/api/settings', initData)
      if (response.ok) {
        const data = await response.json()
        setSettings({
          lottery_limit_enabled: data.data.lottery_limit_enabled || 'false',
          lottery_daily_limit: data.data.lottery_daily_limit || '3',
          vip_unlimited: data.data.vip_unlimited || 'true',
        })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      const response = await apiPut('/api/settings', settings, initData)
      if (response.ok) {
        alert('设置保存成功')
      } else {
        const error = await response.json()
        alert(error.error || '保存失败')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">请在 Telegram WebApp 中打开</p>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">仅超级管理员可访问</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">系统设置</h1>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* 启用参与限制 */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">抽奖参与限制</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-700">启用参与限制</label>
                  <p className="text-sm text-gray-500 mt-1">
                    开启后，普通用户每日参与抽奖次数将受到限制
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, lottery_limit_enabled: 'false' })}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      settings.lottery_limit_enabled === 'false'
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    关
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, lottery_limit_enabled: 'true' })}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      settings.lottery_limit_enabled === 'true'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    开
                  </button>
                </div>
              </div>

              {settings.lottery_limit_enabled === 'true' && (
                <div>
                  <label className="block font-medium text-gray-700 mb-2">
                    每日参与次数
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.lottery_daily_limit}
                    onChange={(e) => setSettings({ ...settings, lottery_daily_limit: e.target.value })}
                    className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    普通用户每天最多可参与的抽奖次数
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* VIP权限 */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">VIP权限</h2>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-700">VIP用户无限制</label>
                <p className="text-sm text-gray-500 mt-1">
                  开启后，VIP用户不受参与次数限制
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, vip_unlimited: 'false' })}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    settings.vip_unlimited === 'false'
                      ? 'bg-gray-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  关
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, vip_unlimited: 'true' })}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    settings.vip_unlimited === 'true'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  开
                </button>
              </div>
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
