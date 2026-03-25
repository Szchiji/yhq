'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'

type Screenshot = {
  id: string
  fileId: string
  sortOrder: number
}

type PendingReport = {
  id: string
  teacherUsername: string
  authorId: string
  authorUsername: string | null
  authorName: string | null
  formData: Record<string, string>
  tags: string[]
  status: string
  rejectionReason: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  screenshots: Screenshot[]
}

export default function ReportsPage() {
  const [items, setItems] = useState<PendingReport[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [searchTeacher, setSearchTeacher] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedReport, setSelectedReport] = useState<PendingReport | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const limit = 20

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: String(limit), status: statusFilter })
      if (searchTeacher) params.set('teacher', searchTeacher)
      const res = await apiGet(`/api/reports?${params}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items)
        setTotal(data.total)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, searchTeacher])

  useEffect(() => { fetchData() }, [fetchData])

  const handleApprove = async (reportId: string) => {
    if (!confirm('确认通过此报告？')) return
    setActionLoading(true)
    try {
      const res = await apiPost('/api/reports', { action: 'approve', reportId })
      if (res.ok) {
        alert('报告已通过并发布！')
        setSelectedReport(null)
        fetchData()
      } else {
        const data = await res.json()
        alert(`操作失败：${data.error}`)
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (reportId: string) => {
    if (!rejectReason.trim()) {
      alert('请填写驳回原因')
      return
    }
    setActionLoading(true)
    try {
      const res = await apiPost('/api/reports', { action: 'reject', reportId, reason: rejectReason })
      if (res.ok) {
        alert('报告已驳回！')
        setSelectedReport(null)
        setRejectReason('')
        fetchData()
      } else {
        const data = await res.json()
        alert(`操作失败：${data.error}`)
      }
    } finally {
      setActionLoading(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  const statusLabel = (s: string) => {
    if (s === 'pending') return <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">待审核</span>
    if (s === 'approved') return <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">已通过</span>
    if (s === 'rejected') return <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">已驳回</span>
    return s
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">报告审核</h1>
        <p className="text-sm text-gray-500">审核用户提交的详细教师报告</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已驳回</option>
          <option value="all">全部</option>
        </select>
        <input
          type="text"
          placeholder="搜索教师用户名..."
          value={searchTeacher}
          onChange={(e) => { setSearchTeacher(e.target.value); setPage(1) }}
          className="border rounded px-3 py-2 text-sm flex-1 max-w-xs"
        />
        <span className="text-sm text-gray-500 self-center">共 {total} 条</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暂无报告</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">教师</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">提交人</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">标签</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">截图</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">@{item.teacherUsername}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {item.authorName || item.authorUsername || item.authorId}
                    </td>
                    <td className="px-4 py-3">
                      {item.tags.length > 0
                        ? item.tags.map((t) => (
                            <span key={t} className="inline-block mr-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                              #{t}
                            </span>
                          ))
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.screenshots.length} 张</td>
                    <td className="px-4 py-3">{statusLabel(item.status)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelectedReport(item); setRejectReason('') }}
                        className="text-blue-500 hover:text-blue-700 text-xs"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-50">上一页</button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-50">下一页</button>
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold">报告详情 - @{selectedReport.teacherUsername}</h2>
              <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {/* Form Data */}
            <div className="space-y-2 mb-4">
              {Object.entries(selectedReport.formData).map(([key, val]) => (
                <div key={key} className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500 mb-0.5">{key}</div>
                  <div className="text-sm">{val}</div>
                </div>
              ))}
            </div>

            {/* Tags */}
            {selectedReport.tags.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-1">标签</div>
                <div className="flex flex-wrap gap-1">
                  {selectedReport.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">#{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Screenshots notice */}
            {selectedReport.screenshots.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                📸 预约截图：{selectedReport.screenshots.length} 张已存储。截图用于验证报告真实性，如需查看请通过 Telegram Bot 文件 API 获取（file_id 已保存在系统中）。
              </div>
            )}

            {/* Status */}
            <div className="mb-4 text-sm">
              <span className="text-gray-500">状态：</span>{statusLabel(selectedReport.status)}
              {selectedReport.rejectionReason && (
                <div className="mt-1 text-red-600 text-xs">驳回原因：{selectedReport.rejectionReason}</div>
              )}
            </div>

            {/* Actions */}
            {selectedReport.status === 'pending' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(selectedReport.id)}
                    disabled={actionLoading}
                    className="flex-1 bg-green-500 text-white py-2 rounded text-sm font-medium hover:bg-green-600 disabled:opacity-50"
                  >
                    ✅ 通过并发布
                  </button>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="驳回原因（必填）"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => handleReject(selectedReport.id)}
                    disabled={actionLoading || !rejectReason.trim()}
                    className="w-full bg-red-500 text-white py-2 rounded text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                  >
                    ❌ 驳回
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
