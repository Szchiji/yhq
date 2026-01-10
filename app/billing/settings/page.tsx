'use client'

import { useEffect, useState } from 'react'
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp'

export default function BillingSettingsPage() {
  const { initData } = useTelegramWebApp()
  const [loading, setLoading] = useState(true)
  const [enableBilling, setEnableBilling] = useState(false)
  const [defaultPrice, setDefaultPrice] = useState('')
  const [currency, setCurrency] = useState('USDT')
  const [paymentInstructions, setPaymentInstructions] = useState('')
  const [expiryReminderDays, setExpiryReminderDays] = useState('7')
  const [showSuccess, setShowSuccess] = useState(false)

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/billing/settings', {
        headers: {
          'x-telegram-init-data': initData || '',
        },
      })
      if (response.ok) {
        const result = await response.json()
        const settings = result.data || {}
        
        setEnableBilling(settings.enable_billing === 'true')
        setDefaultPrice(settings.default_price || '')
        setCurrency(settings.currency || 'USDT')
        setPaymentInstructions(settings.payment_instructions || '')
        setExpiryReminderDays(settings.expiry_reminder_days || '7')
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initData) {
      fetchSettings()
    }
  }, [initData])

  const handleSave = async () => {
    try {
      const response = await fetch('/api/billing/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData || '',
        },
        body: JSON.stringify({
          settings: {
            enable_billing: String(enableBilling),
            default_price: defaultPrice,
            currency: currency,
            payment_instructions: paymentInstructions,
            expiry_reminder_days: expiryReminderDays,
          }
        }),
      })

      if (response.ok) {
        setShowSuccess(true)
        setTimeout(() => setShowSuccess(false), 3000)
      } else {
        const error = await response.json()
        alert(`保存失败: ${error.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('保存失败')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">收费设置</h1>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
          <p className="text-gray-600 text-sm sm:text-base">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">收费设置</h1>

      {showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 text-green-800 text-sm">
          设置已保存
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <div>
          <label className="flex items-center text-xs sm:text-sm">
            <input
              type="checkbox"
              checked={enableBilling}
              onChange={(e) => setEnableBilling(e.target.checked)}
              className="mr-2 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-gray-700 font-medium">启用收费功能</span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-5">
            开启后，用户需要付费才能使用机器人功能
          </p>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            默认价格
          </label>
          <input
            type="text"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100"
            placeholder="例如：10"
            disabled={!enableBilling}
          />
          <p className="text-xs text-gray-500 mt-1">
            未配置续费规则时使用的默认价格
          </p>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            货币单位
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100"
            disabled={!enableBilling}
          >
            <option value="USDT">USDT</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
            <option value="TRX">TRX</option>
          </select>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            过期提醒天数
          </label>
          <input
            type="number"
            value={expiryReminderDays}
            onChange={(e) => setExpiryReminderDays(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100"
            placeholder="7"
            disabled={!enableBilling}
          />
          <p className="text-xs text-gray-500 mt-1">
            在用户过期前多少天提醒续费
          </p>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            付款说明
          </label>
          <textarea
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] sm:min-h-[100px] text-sm disabled:bg-gray-100"
            placeholder="请输入付款说明，例如付款流程、注意事项等"
            disabled={!enableBilling}
          />
          <p className="text-xs text-gray-500 mt-1">
            用户付款时显示的说明文字
          </p>
        </div>

        <div className="flex justify-end pt-3 sm:pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            className="px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors text-sm"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  )
}
