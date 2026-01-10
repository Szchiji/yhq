'use client'

import { useState, useEffect } from 'react'
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'

type VipPlan = {
  id: string
  name: string
  days: number
  price: string
  currency: string
  description: string | null
  isEnabled: boolean
  sortOrder: number
  createdAt: string
}

export default function VipPlansPage() {
  const { user, initData, isSuperAdmin, isAdmin } = useTelegramWebApp()
  const [plans, setPlans] = useState<VipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<VipPlan | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    days: 30,
    price: '9.9',
    currency: 'USDT',
    description: '',
    isEnabled: true,
    sortOrder: 0,
  })

  useEffect(() => {
    if (initData) {
      fetchPlans()
    }
  }, [initData])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const response = await apiGet('/api/vip-plans', initData)
      if (response.ok) {
        const data = await response.json()
        setPlans(data.data)
      }
    } catch (error) {
      console.error('Error fetching plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingPlan(null)
    setFormData({
      name: '',
      days: 30,
      price: '9.9',
      currency: 'USDT',
      description: '',
      isEnabled: true,
      sortOrder: 0,
    })
    setShowModal(true)
  }

  const openEditModal = (plan: VipPlan) => {
    setEditingPlan(plan)
    setFormData({
      name: plan.name,
      days: plan.days,
      price: plan.price,
      currency: plan.currency,
      description: plan.description || '',
      isEnabled: plan.isEnabled,
      sortOrder: plan.sortOrder,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingPlan) {
        const response = await apiPut(`/api/vip-plans/${editingPlan.id}`, formData, initData)
        if (response.ok) {
          alert('更新成功')
          fetchPlans()
          setShowModal(false)
        } else {
          const error = await response.json()
          alert(error.error || '更新失败')
        }
      } else {
        const response = await apiPost('/api/vip-plans', formData, initData)
        if (response.ok) {
          alert('创建成功')
          fetchPlans()
          setShowModal(false)
        } else {
          const error = await response.json()
          alert(error.error || '创建失败')
        }
      }
    } catch (error) {
      console.error('Error saving plan:', error)
      alert('操作失败，请稍后重试')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此套餐？')) return
    
    try {
      const response = await apiDelete(`/api/vip-plans/${id}`, initData)
      if (response.ok) {
        alert('删除成功')
        fetchPlans()
      } else {
        const error = await response.json()
        alert(error.error || '删除失败')
      }
    } catch (error) {
      console.error('Error deleting plan:', error)
      alert('删除失败')
    }
  }

  const toggleEnabled = async (plan: VipPlan) => {
    try {
      const response = await apiPut(`/api/vip-plans/${plan.id}`, {
        isEnabled: !plan.isEnabled
      }, initData)
      if (response.ok) {
        fetchPlans()
      }
    } catch (error) {
      console.error('Error toggling plan:', error)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">请在 Telegram WebApp 中打开</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">无权限访问</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">VIP套餐管理</h1>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
        >
          + 新增套餐
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    套餐名称
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    时长
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    价格
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    排序
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{plan.name}</div>
                      {plan.description && (
                        <div className="text-xs text-gray-500">{plan.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {plan.days === -1 ? '永久' : `${plan.days}天`}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {plan.price} {plan.currency}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleEnabled(plan)}
                        className={`px-2 py-1 text-xs rounded ${
                          plan.isEnabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {plan.isEnabled ? '启用' : '禁用'}
                      </button>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {plan.sortOrder}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openEditModal(plan)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {editingPlan ? '编辑套餐' : '新增套餐'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  套餐名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  时长（天） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.days}
                  onChange={(e) => setFormData({ ...formData, days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">输入 -1 表示永久</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  价格 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  货币
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USDT">USDT</option>
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  排序
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isEnabled}
                  onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600"
                />
                <label className="ml-2 text-sm text-gray-700">启用</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  确认
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
