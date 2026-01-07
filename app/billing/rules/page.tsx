'use client'

import { useState } from 'react'
import DataTable from '@/components/DataTable'

type Rule = {
  id: number
  name: string
  duration: number
  price: string
  status: string
}

export default function BillingRulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newRule, setNewRule] = useState({ 
    name: '', 
    duration: 30,
    price: '',
  })

  const columns = [
    { key: 'name', label: '规则名称' },
    { key: 'duration', label: '时长（天）' },
    { key: 'price', label: '价格' },
    {
      key: 'status',
      label: '状态',
      render: (item: Rule) => (
        <span className={`px-2 py-1 rounded text-sm ${
          item.status === '启用' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {item.status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: Rule) => (
        <div className="flex gap-2">
          <button className="text-blue-500 hover:text-blue-700">编辑</button>
          <button
            onClick={() => setRules(rules.filter((r) => r.id !== item.id))}
            className="text-red-500 hover:text-red-700"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  const addRule = () => {
    if (newRule.name && newRule.price) {
      setRules([
        ...rules,
        {
          id: Date.now(),
          ...newRule,
          status: '启用',
        },
      ])
      setNewRule({ name: '', duration: 30, price: '' })
      setShowAddModal(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">续费规则管理</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          + 添加规则
        </button>
      </div>

      <DataTable columns={columns} data={rules} emptyMessage="暂无续费规则" />

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">添加续费规则</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  规则名称
                </label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例如：月度会员"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  时长（天）
                </label>
                <input
                  type="number"
                  value={newRule.duration}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    setNewRule({ ...newRule, duration: val > 0 ? val : 1 })
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  价格
                </label>
                <input
                  type="text"
                  value={newRule.price}
                  onChange={(e) => setNewRule({ ...newRule, price: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例如：10 USDT"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={addRule}
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
