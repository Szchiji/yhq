'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost } from '@/lib/api'

type ReminderSettings = {
  id?: string
  isEnabled: boolean
  reminderDays: string
  vipTemplate: string | null
  adminTemplate: string | null
  userTemplate: string | null
}

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
  const [triggering, setTriggering] = useState(false)

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
      const response = await fetch('/api/settings/reminders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': (window as any).Telegram?.WebApp?.initData || '',
        },
        body: JSON.stringify(settings),
      })
      
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

  const handleTrigger = async () => {
    if (!confirm('确定要手动触发提醒检查吗？这将立即检查所有即将过期的用户并发送提醒消息。')) {
      return
    }

    setTriggering(true)
    try {
      const response = await apiPost('/api/settings/reminders', {})
      
      if (response.ok) {
        alert('提醒检查已触发！')
      } else {
        const error = await response.json()
        alert(`触发失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error triggering reminders:', error)
      alert('触发失败，请稍后重试')
    } finally {
      setTriggering(false)
    }
  }

  const handleDaysChange = (day: string, checked: boolean) => {
    const days = settings.reminderDays.split(',').filter(d => d)
    if (checked) {
      if (!days.includes(day)) {
        days.push(day)
      }
    } else {
      const index = days.indexOf(day)
      if (index > -1) {
        days.splice(index, 1)
      }
    }
    days.sort((a, b) => Number(b) - Number(a)) // 降序排列
    setSettings({ ...settings, reminderDays: days.join(',') })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  const selectedDays = settings.reminderDays.split(',').filter(d => d)

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">过期提醒设置</h1>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-yellow-800">
          ⚠️ 注意：此页面仅超级管理员可访问。过期提醒将自动发送给即将过期的用户。
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-6">
        {/* 启用/禁用开关 */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">基本设置</h2>
          
          <div className="space-y-4">
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
                启用过期提醒功能
              </label>
            </div>
            <p className="text-xs text-gray-500 ml-7">
              启用后，系统将自动检查即将过期的用户并发送提醒消息
            </p>
          </div>
        </div>

        {/* 提醒天数设置 */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">提醒天数</h2>
          <p className="text-xs sm:text-sm text-gray-600 mb-4">
            选择在过期前多少天发送提醒（可多选）
          </p>
          
          <div className="space-y-2">
            {['7', '5', '3', '2', '1'].map((day) => (
              <div key={day} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`day-${day}`}
                  checked={selectedDays.includes(day)}
                  onChange={(e) => handleDaysChange(day, e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor={`day-${day}`} className="text-sm text-gray-700">
                  提前 {day} 天提醒
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* VIP 过期提醒模板 */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-2">VIP 过期提醒模板</h2>
          <p className="text-xs text-gray-500 mb-3">
            留空使用默认模板。支持的变量：{'{daysLeft}'} - 剩余天数
          </p>
          <textarea
            value={settings.vipTemplate || ''}
            onChange={(e) => setSettings({ ...settings, vipTemplate: e.target.value || null })}
            placeholder="留空使用默认模板"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* 管理员过期提醒模板 */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-2">管理员过期提醒模板</h2>
          <p className="text-xs text-gray-500 mb-3">
            留空使用默认模板。支持的变量：{'{daysLeft}'} - 剩余天数
          </p>
          <textarea
            value={settings.adminTemplate || ''}
            onChange={(e) => setSettings({ ...settings, adminTemplate: e.target.value || null })}
            placeholder="留空使用默认模板"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* 普通用户过期提醒模板 */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-2">会员过期提醒模板</h2>
          <p className="text-xs text-gray-500 mb-3">
            留空使用默认模板。支持的变量：{'{daysLeft}'} - 剩余天数
          </p>
          <textarea
            value={settings.userTemplate || ''}
            onChange={(e) => setSettings({ ...settings, userTemplate: e.target.value || null })}
            placeholder="留空使用默认模板"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* 功能说明 */}
        <div>
          <h3 className="text-md font-bold text-gray-800 mb-3">功能说明</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-700">
            <p>• <strong>自动检查：</strong>系统通过定时任务自动检查即将过期的用户</p>
            <p>• <strong>防重复：</strong>同一用户同一过期类型，每个提醒天数只发送一次</p>
            <p>• <strong>提醒类型：</strong>VIP权限、管理员权限、会员权限</p>
            <p>• <strong>默认模板：</strong>如果未设置自定义模板，将使用系统默认提醒消息</p>
            <p>• <strong>手动触发：</strong>可以使用下方按钮立即触发提醒检查（用于测试）</p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4">
          <button
            onClick={handleTrigger}
            disabled={triggering || !settings.isEnabled}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {triggering ? '触发中...' : '手动触发提醒检查'}
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
