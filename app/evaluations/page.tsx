'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiDelete } from '@/lib/api'

type QuickEvaluation = {
  id: string
  teacherUsername: string
  raterId: string
  raterUsername: string | null
  raterName: string | null
  isPositive: boolean
  reason: string
  groupId: string | null
  createdAt: string
}

export default function EvaluationsPage() {
  const [items, setItems] = useState<QuickEvaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTeacher, setSearchTeacher] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (searchTeacher) params.set('teacher', searchTeacher)
      const res = await apiGet(`/api/evaluations?${params}`)
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
  }, [page, searchTeacher])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此评价？')) return
    const res = await apiDelete(`/api/evaluations?id=${id}`)
    if (res.ok) fetchData()
    else alert('删除失败')
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">快速评价管理</h1>
        <p className="text-sm text-gray-500">管理用户对教师的快速评价记录（👍/👎）</p>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
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
          <div className="p-8 text-center text-gray-500">暂无评价记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">教师</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">评价人</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">理由</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">@{item.teacherUsername}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {item.raterName || item.raterUsername || item.raterId}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.isPositive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {item.isPositive ? '👍 推荐' : '👎 不推荐'}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-700">{item.reason}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        删除
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
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            上一页
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
