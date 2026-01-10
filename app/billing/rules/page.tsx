'use client'

import { useEffect, useState } from 'react'
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp'
import DataTable from '@/components/DataTable'

type Rule = {
  id: string
  name: string
  targetRole: string
  days: number
  price: string
  currency: string
  description?: string
  isEnabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export default function BillingRulesPage() {
  const { initData } = useTelegramWebApp()
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [newRule, setNewRule] = useState({ 
    name: '', 
    targetRole: 'user',
    days: 30,
    price: '',
    currency: 'USDT',
    description: '',
    isEnabled: true,
    sortOrder: 0,
  })

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/billing/rules', {
        headers: {
          'x-telegram-init-data': initData || '',
        },
      })
      if (response.ok) {
        const result = await response.json()
        setRules(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching rules:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initData) {
      fetchRules()
    }
  }, [initData])

  const addRule = async () => {
    if (!newRule.name || !newRule.price) {
      alert('请填写规则名称和价格')
      return
    }

    try {
      const url = editingRule ? `/api/billing/rules/${editingRule.id}` : '/api/billing/rules'
      const method = editingRule ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData || '',
        },
        body: JSON.stringify(newRule),
      })

      if (response.ok) {
        await fetchRules()
        setNewRule({ 
          name: '', 
          targetRole: 'user',
          days: 30,
          price: '',
          currency: 'USDT',
          description: '',
          isEnabled: true,
          sortOrder: 0,
        })
        setShowAddModal(false)
        setEditingRule(null)
      } else {
        const error = await response.json()
        alert(`操作失败: ${error.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('Error saving rule:', error)
      alert('保存失败')
    }
  }

  const deleteRule = async (id: string) => {
    if (!confirm('确定要删除这个续费规则吗？')) return

    try {
      const response = await fetch(`/api/billing/rules/${id}`, {
        method: 'DELETE',
        headers: {
          'x-telegram-init-data': initData || '',
        },
      })

      if (response.ok) {
        await fetchRules()
      } else {
        alert('删除失败')
      }
    } catch (error) {
      console.error('Error deleting rule:', error)
      alert('删除失败')
    }
  }

  const openEditModal = (rule: Rule) => {
    setEditingRule(rule)
    setNewRule({
      name: rule.name,
      targetRole: rule.targetRole,
      days: rule.days,
      price: rule.price,
      currency: rule.currency,
      description: rule.description || '',
      isEnabled: rule.isEnabled,
      sortOrder: rule.sortOrder,
    })
    setShowAddModal(true)
  }

  const openAddModal = () => {
    setEditingRule(null)
    setNewRule({ 
      name: '', 
      targetRole: 'user',
      days: 30,
      price: '',
      currency: 'USDT',
      description: '',
      isEnabled: true,
      sortOrder: 0,
    })
    setShowAddModal(true)
  }

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      user: '普通用户',
      vip: 'VIP用户',
      admin: '管理员',
    }
    return roleMap[role] || role
  }

  const columns = [
    { key: 'name', label: '规则名称' },
    {
      key: 'targetRole',
      label: '目标角色',
      render: (item: Rule) => (
        <span className="text-xs sm:text-sm">{getRoleLabel(item.targetRole)}</span>
      ),
    },
    { 
      key: 'days', 
      label: '时长（天）',
      render: (item: Rule) => (
        <span className="text-xs sm:text-sm">{item.days === -1 ? '永久' : item.days}</span>
      ),
    },
    { 
      key: 'price', 
      label: '价格',
      render: (item: Rule) => (
        <span className="text-xs sm:text-sm">{item.price} {item.currency}</span>
      ),
    },
    {
      key: 'isEnabled',
      label: '状态',
      render: (item: Rule) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {item.isEnabled ? '启用' : '禁用'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: Rule) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEditModal(item)}
            className="text-blue-500 hover:text-blue-700 text-xs sm:text-sm"
          >
            编辑
          </button>
          <button
            onClick={() => deleteRule(item.id)}
            className="text-red-500 hover:text-red-700 text-xs sm:text-sm"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">续费规则管理</h1>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
          <p className="text-gray-600 text-sm sm:text-base">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">续费规则管理</h1>
        <button
          onClick={openAddModal}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm"
        >
          + 添加规则
        </button>
      </div>

      <DataTable columns={columns} data={rules} emptyMessage="暂无续费规则" />

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
              {editingRule ? '编辑续费规则' : '添加续费规则'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  规则名称 *
                </label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="例如：月度会员"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  目标角色 *
                </label>
                <select
                  value={newRule.targetRole}
                  onChange={(e) => setNewRule({ ...newRule, targetRole: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="user">普通用户</option>
                  <option value="vip">VIP用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  时长（天）*（-1表示永久）
                </label>
                <input
                  type="number"
                  value={newRule.days}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    setNewRule({ ...newRule, days: isNaN(val) ? 1 : val })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    价格 *
                  </label>
                  <input
                    type="text"
                    value={newRule.price}
                    onChange={(e) => setNewRule({ ...newRule, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    货币
                  </label>
                  <select
                    value={newRule.currency}
                    onChange={(e) => setNewRule({ ...newRule, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="USDT">USDT</option>
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="TRX">TRX</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  描述（可选）
                </label>
                <textarea
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="规则描述"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={newRule.isEnabled}
                    onChange={(e) => setNewRule({ ...newRule, isEnabled: e.target.checked })}
                    className="mr-2 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">启用</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setEditingRule(null)
                }}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                取消
              </button>
              <button
                onClick={addRule}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                {editingRule ? '保存' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
