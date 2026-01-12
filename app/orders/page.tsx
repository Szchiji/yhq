'use client'

import { useState, useEffect } from 'react'
import DataTable from '@/components/DataTable'
import { apiGet, apiPut } from '@/lib/api'

type Order = {
  id: string
  orderNo: string
  userId: string
  username: string | null
  firstName: string | null
  ruleName: string
  amount: string
  currency: string
  targetRole: string
  days: number
  paymentProof: string | null
  status: string
  createdAt: string
  confirmedAt: string | null
  rejectedAt: string | null
  rejectReason: string | null
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [page, statusFilter, searchQuery])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '20')
      params.append('status', statusFilter)
      if (searchQuery) params.append('search', searchQuery)
      
      const response = await apiGet(`/api/orders?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setOrders(data.data)
        setTotal(data.total)
      } else {
        console.error('Failed to fetch orders')
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const openConfirmModal = (order: Order) => {
    setSelectedOrder(order)
    setShowConfirmModal(true)
  }

  const openRejectModal = (order: Order) => {
    setSelectedOrder(order)
    setRejectReason('')
    setShowRejectModal(true)
  }

  const handleConfirmOrder = async () => {
    if (!selectedOrder) return

    setProcessing(true)
    try {
      const response = await apiPut(`/api/orders/${selectedOrder.id}/confirm`, {})
      
      if (response.ok) {
        alert('订单已确认！')
        setShowConfirmModal(false)
        setSelectedOrder(null)
        fetchOrders()
      } else {
        const error = await response.json()
        alert(`确认失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error confirming order:', error)
      alert('确认失败，请稍后重试')
    } finally {
      setProcessing(false)
    }
  }

  const handleRejectOrder = async () => {
    if (!selectedOrder) return

    setProcessing(true)
    try {
      const response = await apiPut(`/api/orders/${selectedOrder.id}/reject`, {
        reason: rejectReason || '未收到付款或付款金额不符'
      })
      
      if (response.ok) {
        alert('订单已拒绝！')
        setShowRejectModal(false)
        setSelectedOrder(null)
        setRejectReason('')
        fetchOrders()
      } else {
        const error = await response.json()
        alert(`拒绝失败：${error.error}`)
      }
    } catch (error) {
      console.error('Error rejecting order:', error)
      alert('拒绝失败，请稍后重试')
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; className: string }> = {
      pending: { text: '待确认', className: 'bg-yellow-100 text-yellow-700' },
      confirmed: { text: '已确认', className: 'bg-green-100 text-green-700' },
      rejected: { text: '已拒绝', className: 'bg-red-100 text-red-700' }
    }
    const badge = badges[status] || badges.pending
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${badge.className}`}>
        {badge.text}
      </span>
    )
  }

  const getRoleText = (role: string) => {
    const roles: Record<string, string> = {
      user: '普通用户',
      vip: 'VIP会员',
      admin: '管理员'
    }
    return roles[role] || role
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length
  const confirmedCount = orders.filter(o => o.status === 'confirmed').length
  const rejectedCount = orders.filter(o => o.status === 'rejected').length

  const columns = [
    { 
      key: 'orderNo', 
      label: '订单号',
      render: (item: Order) => (
        <span className="text-xs font-mono">{item.orderNo}</span>
      ),
    },
    { 
      key: 'user', 
      label: '用户',
      render: (item: Order) => (
        <div className="text-xs">
          <div>{item.username ? `@${item.username}` : item.firstName || '-'}</div>
          <div className="text-gray-500 font-mono">{item.userId}</div>
        </div>
      ),
    },
    {
      key: 'plan',
      label: '套餐',
      render: (item: Order) => (
        <div className="text-xs">
          <div className="font-medium">{item.ruleName}</div>
          <div className="text-gray-500">{getRoleText(item.targetRole)}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      label: '金额',
      render: (item: Order) => (
        <span className="text-xs font-medium text-green-600">
          {item.amount} {item.currency}
        </span>
      ),
    },
    {
      key: 'status',
      label: '状态',
      render: (item: Order) => getStatusBadge(item.status),
    },
    {
      key: 'createdAt',
      label: '提交时间',
      render: (item: Order) => (
        <span className="text-xs">
          {new Date(item.createdAt).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: Order) => (
        <div className="flex gap-2">
          {item.status === 'pending' && (
            <>
              <button
                onClick={() => openConfirmModal(item)}
                className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
              >
                确认
              </button>
              <button
                onClick={() => openRejectModal(item)}
                className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                拒绝
              </button>
            </>
          )}
          {item.status === 'confirmed' && (
            <span className="text-xs text-gray-500">
              {item.confirmedAt ? new Date(item.confirmedAt).toLocaleDateString('zh-CN') : '-'}
            </span>
          )}
          {item.status === 'rejected' && (
            <span className="text-xs text-gray-500" title={item.rejectReason || ''}>
              {item.rejectReason || '已拒绝'}
            </span>
          )}
        </div>
      ),
    },
  ]

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">订单管理</h1>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Status Tabs */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setStatusFilter('all'); setPage(1) }}
              className={`px-3 py-1.5 rounded text-sm ${
                statusFilter === 'all' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => { setStatusFilter('pending'); setPage(1) }}
              className={`px-3 py-1.5 rounded text-sm ${
                statusFilter === 'pending' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              待确认 {pendingCount > 0 && `(${pendingCount})`}
            </button>
            <button
              onClick={() => { setStatusFilter('confirmed'); setPage(1) }}
              className={`px-3 py-1.5 rounded text-sm ${
                statusFilter === 'confirmed' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              已确认
            </button>
            <button
              onClick={() => { setStatusFilter('rejected'); setPage(1) }}
              className={`px-3 py-1.5 rounded text-sm ${
                statusFilter === 'rejected' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              已拒绝
            </button>
          </div>
          
          {/* Search Box */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索订单号、用户名、用户ID..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
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
            {pendingCount}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">待确认</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">
            {confirmedCount}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">已确认</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-600">
            {rejectedCount}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">已拒绝</div>
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

      {/* Confirm Order Modal */}
      {showConfirmModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
              确认订单
            </h2>
            <div className="space-y-3 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">订单号</div>
                <div className="text-sm font-mono">{selectedOrder.orderNo}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">用户</div>
                <div className="text-sm">
                  {selectedOrder.username ? `@${selectedOrder.username}` : selectedOrder.firstName || '-'}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">套餐</div>
                <div className="text-sm">{selectedOrder.ruleName} - {selectedOrder.days === -1 ? '永久' : `${selectedOrder.days}天`}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">金额</div>
                <div className="text-sm font-medium text-green-600">
                  {selectedOrder.amount} {selectedOrder.currency}
                </div>
              </div>
              {selectedOrder.paymentProof && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">付款凭证</div>
                  <div className="text-sm break-all">{selectedOrder.paymentProof}</div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setSelectedOrder(null)
                }}
                disabled={processing}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmOrder}
                disabled={processing}
                className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm disabled:opacity-50"
              >
                {processing ? '确认中...' : '确认开通'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Order Modal */}
      {showRejectModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
              拒绝订单
            </h2>
            <div className="space-y-3 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">订单号</div>
                <div className="text-sm font-mono">{selectedOrder.orderNo}</div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  拒绝原因
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] text-sm"
                  placeholder="请输入拒绝原因（可选，默认：未收到付款或付款金额不符）"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setSelectedOrder(null)
                  setRejectReason('')
                }}
                disabled={processing}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleRejectOrder}
                disabled={processing}
                className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm disabled:opacity-50"
              >
                {processing ? '拒绝中...' : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
