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
            付款说明
          </label>
          <textarea
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] sm:min-h-[100px] text-sm disabled:bg-gray-100"
            placeholder="请输入付款说明，例如付款流程、注意事项等"
            disabled={!enableBilling}
          />
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
