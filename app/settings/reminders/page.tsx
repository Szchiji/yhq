'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiPut } from '@/lib/api'

type ReminderSettings = {
  isEnabled: boolean
  reminderDays: string
  vipTemplate: string | null
  adminTemplate: string | null
  userTemplate: string | null
}

const DEFAULT_VIP_TEMPLATE = '⚠️ VIP即将过期提醒\n\n您的VIP权限将在 {daysLeft} 天后过期。\n\n请及时续费以继续使用服务。\n点击 /vip 查看续费方案。'
const DEFAULT_ADMIN_TEMPLATE = '⚠️ 管理员即将过期提醒\n\n您的管理员权限将在 {daysLeft} 天后过期。\n\n请及时续费以继续使用服务。\n点击 /vip 查看续费方案。'
const DEFAULT_USER_TEMPLATE = '⚠️ 会员即将过期提醒\n\n您的会员权限将在 {daysLeft} 天后过期。\n\n请及时续费以继续使用服务。\n点击 /vip 查看续费方案。'

const AVAILABLE_DAYS = [7, 5, 3, 2, 1]

export default function ReminderSettingsPage() {
  const [settings, setSettings] = useState<ReminderSettings>({
    isEnabled: true,
    reminderDays: '7,3,1',
    vipTemplate: null,
    adminTemplate: null,
    userTemplate: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await apiGet('/api/settings/reminders')
      if (response.ok) {
        const data = await response.json()
        setSettings(data.data)
      } else {
        console.error('Failed to fetch reminder settings')
      }
    } catch (error) {
      console.error('Error fetching reminder settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await apiPut('/api/settings/reminders', settings)
      
      if (response.ok) {
        alert('保存成功！')
      } else {
        const error = await response.json()
        alert(`保存失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error saving reminder settings:', error)
      alert('保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const response = await apiPost('/api/settings/reminders', {})
      
      if (response.ok) {
        const result = await response.json()
        alert(`测试完成！\n已发送: ${result.sent} 条\n已跳过: ${result.skipped} 条`)
      } else {
        const error = await response.json()
        alert(`测试失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error testing reminders:', error)
      alert('测试失败，请稍后重试')
    } finally {
      setTesting(false)
    }
  }

  const toggleDay = (day: number) => {
    const days = settings.reminderDays.split(',').filter(d => d).map(Number)
    const newDays = days.includes(day)
      ? days.filter(d => d !== day)
      : [...days, day].sort((a, b) => b - a)
    setSettings({
      ...settings,
      reminderDays: newDays.join(',')
    })
  }

  const selectedDays = settings.reminderDays.split(',').filter(d => d).map(Number)

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">过期提醒设置</h1>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-yellow-800">
          ⚠️ 注意：此页面仅超级管理员可访问。系统将自动检查即将过期的用户并发送提醒。
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-6">
        {/* 启用开关 */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">提醒开关</h2>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isEnabled"
              checked={settings.isEnabled}
              onChange={(e) => setSettings({
                ...settings,
                isEnabled: e.target.checked
              })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isEnabled" className="text-sm font-medium text-gray-700">
              启用过期提醒
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-2 ml-7">
            关闭后，系统将不会发送任何过期提醒
          </p>
        </div>

        {/* 提醒天数 */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">提醒天数</h2>
          
          <div className="space-y-2">
            <p className="text-xs sm:text-sm text-gray-600 mb-3">
              选择在过期前多少天发送提醒（可多选）：
            </p>
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_DAYS.map(day => (
                <label
                  key={day}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedDays.includes(day)}
                    onChange={() => toggleDay(day)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{day} 天</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 模板设置 */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-gray-800">提醒模板</h2>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
            <p className="text-xs sm:text-sm text-blue-800 font-medium mb-2">
              📝 支持的变量：
            </p>
            <ul className="text-xs text-blue-700 space-y-1 ml-4">
              <li>• <code>{'{daysLeft}'}</code> - 剩余天数</li>
              <li>• <code>{'{type}'}</code> - 权限类型（VIP/管理员/会员）</li>
            </ul>
          </div>

          {/* VIP 模板 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              VIP 过期提醒模板
            </label>
            <textarea
              value={settings.vipTemplate || DEFAULT_VIP_TEMPLATE}
              onChange={(e) => setSettings({
                ...settings,
                vipTemplate: e.target.value
              })}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
              placeholder={DEFAULT_VIP_TEMPLATE}
            />
          </div>

          {/* 管理员模板 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              管理员过期提醒模板
            </label>
            <textarea
              value={settings.adminTemplate || DEFAULT_ADMIN_TEMPLATE}
              onChange={(e) => setSettings({
                ...settings,
                adminTemplate: e.target.value
              })}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
              placeholder={DEFAULT_ADMIN_TEMPLATE}
            />
          </div>

          {/* 普通用户模板 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              普通用户过期提醒模板
            </label>
            <textarea
              value={settings.userTemplate || DEFAULT_USER_TEMPLATE}
              onChange={(e) => setSettings({
                ...settings,
                userTemplate: e.target.value
              })}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
              placeholder={DEFAULT_USER_TEMPLATE}
            />
          </div>
        </div>

        {/* 功能说明 */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-md font-bold text-gray-800 mb-3">功能说明</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-700">
            <p>• <strong>自动检查：</strong>系统会在定时任务中自动检查即将过期的用户</p>
            <p>• <strong>防重复：</strong>同一用户同一过期类型的相同提醒天数只会发送一次</p>
            <p>• <strong>检查范围：</strong>VIP用户、管理员、付费普通用户</p>
            <p>• <strong>定时任务：</strong>需要在 Railway 或外部服务配置定时任务，每天调用 <code>/api/cron/reminders</code></p>
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4">
          <button
            onClick={handleTest}
            disabled={testing || !settings.isEnabled}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? '测试中...' : '手动触发测试'}
          </button>
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
