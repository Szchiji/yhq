'use client'

import { useState, useEffect } from 'react'
import DataTable from '@/components/DataTable'
import { apiGet, apiPatch } from '@/lib/api'

type VipOrder = {
  id: string
  orderNo: string
  telegramId: string
  plan: {
    name: string
    days: number
    price: string
    currency: string
  }
  amount: string
  currency: string
  status: string
  paidAt: string | null
  expireAt: string | null
  remark: string | null
  createdAt: string
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<VipOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<VipOrder | null>(null)
  const [remark, setRemark] = useState('')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [page, statusFilter])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('perPage', '20')
      if (statusFilter) params.append('status', statusFilter)
      
      const response = await apiGet(`/api/orders?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setOrders(data.data)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      } else {
        console.error('Failed to fetch orders')
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const openConfirmModal = (order: VipOrder) => {
    setSelectedOrder(order)
    setRemark('')
    setShowConfirmModal(true)
  }

  const handleConfirmPayment = async () => {
    if (!selectedOrder) return

    setConfirming(true)
    try {
      const response = await apiPatch(`/api/orders/${selectedOrder.id}`, {
        action: 'confirm_payment',
        remark,
      })
      
      if (response.ok) {
        alert('确认支付成功！')
        setShowConfirmModal(false)
        setSelectedOrder(null)
        setRemark('')
        fetchOrders()
      } else {
        const error = await response.json()
        alert(`确认失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error confirming payment:', error)
      alert('确认失败，请稍后重试')
    } finally {
      setConfirming(false)
    }
  }

  const columns = [
    { 
      key: 'orderNo', 
      label: '订单号',
      render: (item: VipOrder) => (
        <span className="text-xs font-mono">{item.orderNo}</span>
      ),
    },
    { 
      key: 'user', 
      label: '用户ID',
      render: (item: VipOrder) => (
        <span className="text-xs font-mono">{item.telegramId}</span>
      ),
    },
    {
      key: 'plan',
      label: '套餐',
      render: (item: VipOrder) => (
        <div className="text-xs sm:text-sm">
          <div className="font-medium">{item.plan.name}</div>
          <div className="text-gray-500">
            {item.plan.days === -1 ? '永久' : `${item.plan.days}天`}
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      label: '金额',
      render: (item: VipOrder) => (
        <span className="text-xs sm:text-sm font-medium text-green-600">
          {item.amount} {item.currency}
        </span>
      ),
    },
    {
      key: 'status',
      label: '状态',
      render: (item: VipOrder) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.status === 'paid' ? 'bg-green-100 text-green-700' :
          item.status === 'cancelled' ? 'bg-red-100 text-red-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          {item.status === 'paid' ? '已支付' :
           item.status === 'cancelled' ? '已取消' :
           '待支付'}
        </span>
      ),
    },
    {
      key: 'paidAt',
      label: '支付时间',
      render: (item: VipOrder) => (
        <span className="text-xs sm:text-sm">
          {item.paidAt ? new Date(item.paidAt).toLocaleString('zh-CN') : '-'}
        </span>
      ),
    },
    {
      key: 'expireAt',
      label: '到期时间',
      render: (item: VipOrder) => (
        <span className="text-xs sm:text-sm">
          {item.expireAt ? 
            (new Date(item.expireAt).getFullYear() === 2099 ? '永久' : 
             new Date(item.expireAt).toLocaleDateString('zh-CN')) : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: VipOrder) => (
        <div className="flex flex-col gap-1">
          {item.status === 'pending' && (
            <button
              onClick={() => openConfirmModal(item)}
              className="text-xs text-green-600 hover:text-green-700"
            >
              确认支付
            </button>
          )}
          {item.remark && (
            <span className="text-xs text-gray-500" title={item.remark}>
              有备注
            </span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">订单管理</h1>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="flex gap-2 items-center">
          <label className="text-xs sm:text-sm font-medium text-gray-700">状态:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">全部</option>
            <option value="pending">待支付</option>
            <option value="paid">已支付</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">{total}</div>
          <div className="text-xs sm:text-sm text-gray-600">总订单</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-600">
            {orders.filter(o => o.status === 'pending').length}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">待支付</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">
            {orders.filter(o => o.status === 'paid').length}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">已支付</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-600">
            {orders.filter(o => o.status === 'cancelled').length}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">已取消</div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-500">加载中...</div>
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={orders} emptyMessage="暂无订单" />
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-white border rounded-lg disabled:opacity-50 text-sm"
              >
                上一页
              </button>
              <span className="px-3 py-1 text-sm">
                第 {page} / {totalPages} 页
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-white border rounded-lg disabled:opacity-50 text-sm"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* Confirm Payment Modal */}
      {showConfirmModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
              确认支付
            </h2>
            <div className="space-y-3 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">订单号</div>
                <div className="text-sm font-mono">{selectedOrder.orderNo}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">用户ID</div>
                <div className="text-sm font-mono">{selectedOrder.telegramId}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">套餐</div>
                <div className="text-sm">{selectedOrder.plan.name} - {selectedOrder.plan.days === -1 ? '永久' : `${selectedOrder.plan.days}天`}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">金额</div>
                <div className="text-sm font-medium text-green-600">
                  {selectedOrder.amount} {selectedOrder.currency}
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  备注（可选）
                </label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] text-sm"
                  placeholder="添加备注信息..."
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setSelectedOrder(null)
                  setRemark('')
                }}
                disabled={confirming}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={confirming}
                className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm disabled:opacity-50"
              >
                {confirming ? '确认中...' : '确认支付'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
