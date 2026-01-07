'use client'

import { useState } from 'react'

export default function BillingSettingsPage() {
  const [enableBilling, setEnableBilling] = useState(false)
  const [defaultPrice, setDefaultPrice] = useState('')
  const [currency, setCurrency] = useState('USDT')
  const [paymentInstructions, setPaymentInstructions] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  const handleSave = () => {
    console.log('Saving billing settings:', {
      enableBilling,
      defaultPrice,
      currency,
      paymentInstructions,
    })
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">收费设置</h1>

      {showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          设置已保存
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={enableBilling}
              onChange={(e) => setEnableBilling(e.target.checked)}
              className="mr-2 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-gray-700 font-medium">启用收费功能</span>
          </label>
          <p className="text-sm text-gray-500 mt-1 ml-6">
            开启后，用户需要付费才能使用机器人功能
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            默认价格
          </label>
          <input
            type="text"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例如：10"
            disabled={!enableBilling}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            货币单位
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!enableBilling}
          >
            <option value="USDT">USDT</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
            <option value="TRX">TRX</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            付款说明
          </label>
          <textarea
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
            placeholder="请输入付款说明，例如付款流程、注意事项等"
            disabled={!enableBilling}
          />
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            className="px-8 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  )
}
