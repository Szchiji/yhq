'use client'

import { useState, useEffect } from 'react'
import DataTable from '@/components/DataTable'
import { apiGet, apiPost, apiDelete } from '@/lib/api'

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
  _count?: {
    orders: number
  }
}

export default function VipPlansPage() {
  const [plans, setPlans] = useState<VipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<VipPlan | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    days: 30,
    price: '',
    currency: 'USDT',
    description: '',
    sortOrder: 0,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const response = await apiGet('/api/vip-plans')
      if (response.ok) {
        const data = await response.json()
        setPlans(data.data)
      } else {
        console.error('Failed to fetch plans')
      }
    } catch (error) {
      console.error('Error fetching plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除套餐「${name}」吗？`)) {
      return
    }

    try {
      const response = await apiDelete(`/api/vip-plans/${id}`)
      if (response.ok) {
        alert('删除成功')
        fetchPlans()
      } else {
        const error = await response.json()
        alert(`删除失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting plan:', error)
      alert('删除失败，请稍后重试')
    }
  }

  const toggleEnabled = async (plan: VipPlan) => {
    try {
      const response = await apiPost('/api/vip-plans', {
        plan: {
          id: plan.id,
          name: plan.name,
          days: plan.days,
          price: plan.price,
          currency: plan.currency,
          description: plan.description,
          sortOrder: plan.sortOrder,
          isEnabled: !plan.isEnabled,
        },
      })
      
      if (response.ok) {
        fetchPlans()
      } else {
        const error = await response.json()
        alert(`操作失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error toggling plan:', error)
      alert('操作失败，请稍后重试')
    }
  }

  const openAddModal = () => {
    setEditingPlan(null)
    setFormData({
      name: '',
      days: 30,
      price: '',
      currency: 'USDT',
      description: '',
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
      sortOrder: plan.sortOrder,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      alert('请填写套餐名称和价格')
      return
    }

    setSaving(true)
    try {
      const response = await apiPost('/api/vip-plans', {
        plan: {
          ...(editingPlan ? { id: editingPlan.id } : {}),
          name: formData.name,
          days: formData.days,
          price: formData.price,
          currency: formData.currency,
          description: formData.description || null,
          sortOrder: formData.sortOrder,
        },
      })
      
      if (response.ok) {
        alert(editingPlan ? '更新成功！' : '添加成功！')
        setShowModal(false)
        fetchPlans()
      } else {
        const error = await response.json()
        alert(`保存失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error saving plan:', error)
      alert('保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { 
      key: 'name', 
      label: '套餐名称',
      render: (item: VipPlan) => (
        <span className="text-xs sm:text-sm font-medium">{item.name}</span>
      ),
    },
    { 
      key: 'days', 
      label: '有效天数',
      render: (item: VipPlan) => (
        <span className="text-xs sm:text-sm">
          {item.days === -1 ? '永久' : `${item.days} 天`}
        </span>
      ),
    },
    {
      key: 'price',
      label: '价格',
      render: (item: VipPlan) => (
        <span className="text-xs sm:text-sm font-medium text-green-600">
          {item.price} {item.currency}
        </span>
      ),
    },
    {
      key: 'description',
      label: '说明',
      render: (item: VipPlan) => (
        <div className="max-w-[150px] sm:max-w-[200px] truncate text-xs sm:text-sm">
          {item.description || '-'}
        </div>
      ),
    },
    {
      key: 'sortOrder',
      label: '排序',
      render: (item: VipPlan) => (
        <span className="text-xs sm:text-sm">{item.sortOrder}</span>
      ),
    },
    {
      key: 'isEnabled',
      label: '状态',
      render: (item: VipPlan) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {item.isEnabled ? '已启用' : '已停用'}
        </span>
      ),
    },
    {
      key: 'orders',
      label: '订单数',
      render: (item: VipPlan) => (
        <span className="text-xs sm:text-sm">{item._count?.orders || 0}</span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: VipPlan) => (
        <div className="flex gap-1 sm:gap-2 flex-wrap">
          <button
            onClick={() => toggleEnabled(item)}
            className="text-blue-500 hover:text-blue-700 text-xs"
          >
            {item.isEnabled ? '停用' : '启用'}
          </button>
          <button
            onClick={() => openEditModal(item)}
            className="text-blue-500 hover:text-blue-700 text-xs"
          >
            编辑
          </button>
          <button
            onClick={() => handleDelete(item.id, item.name)}
            className="text-red-500 hover:text-red-700 text-xs"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">VIP套餐管理</h1>
        <button
          onClick={openAddModal}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm"
        >
          + 新增套餐
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-blue-800">
          💡 管理VIP会员套餐，设置不同的价格和时长。
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-500">加载中...</div>
        </div>
      ) : (
        <DataTable columns={columns} data={plans} emptyMessage="暂无VIP套餐" />
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
              {editingPlan ? '编辑套餐' : '新增套餐'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  套餐名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="例如：月卡、年卡"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  有效天数 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.days}
                  onChange={(e) => setFormData({ ...formData, days: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="输入 -1 表示永久"
                />
                <p className="text-xs text-gray-500 mt-1">输入 -1 表示永久VIP</p>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  价格 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  货币
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="USDT">USDT</option>
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  说明
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] text-sm"
                  placeholder="套餐说明"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  排序
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="数字越小越靠前"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm disabled:opacity-50"
              >
                {saving ? '保存中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
