'use client'

import { useEffect, useState } from 'react'
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp'
import DataTable from '@/components/DataTable'

type Address = {
  id: string
  name: string
  address: string
  network: string
  qrCodeUrl?: string
  isDefault: boolean
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export default function BillingAddressPage() {
  const { initData } = useTelegramWebApp()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [newAddress, setNewAddress] = useState({ 
    name: '', 
    address: '', 
    network: 'TRC20',
    qrCodeUrl: '',
    isDefault: false,
    isEnabled: true,
  })

  const fetchAddresses = async () => {
    try {
      const response = await fetch('/api/billing/address', {
        headers: {
          'x-telegram-init-data': initData || '',
        },
      })
      if (response.ok) {
        const result = await response.json()
        setAddresses(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching addresses:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initData) {
      fetchAddresses()
    }
  }, [initData])

  const addAddress = async () => {
    if (!newAddress.name || !newAddress.address) {
      alert('请填写名称和地址')
      return
    }

    try {
      const url = editingAddress ? `/api/billing/address/${editingAddress.id}` : '/api/billing/address'
      const method = editingAddress ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData || '',
        },
        body: JSON.stringify(newAddress),
      })

      if (response.ok) {
        await fetchAddresses()
        setNewAddress({ name: '', address: '', network: 'TRC20', qrCodeUrl: '', isDefault: false, isEnabled: true })
        setShowAddModal(false)
        setEditingAddress(null)
      } else {
        const error = await response.json()
        alert(`操作失败: ${error.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('Error saving address:', error)
      alert('保存失败')
    }
  }

  const deleteAddress = async (id: string) => {
    if (!confirm('确定要删除这个收款地址吗？')) return

    try {
      const response = await fetch(`/api/billing/address/${id}`, {
        method: 'DELETE',
        headers: {
          'x-telegram-init-data': initData || '',
        },
      })

      if (response.ok) {
        await fetchAddresses()
      } else {
        alert('删除失败')
      }
    } catch (error) {
      console.error('Error deleting address:', error)
      alert('删除失败')
    }
  }

  const openEditModal = (address: Address) => {
    setEditingAddress(address)
    setNewAddress({
      name: address.name,
      address: address.address,
      network: address.network,
      qrCodeUrl: address.qrCodeUrl || '',
      isDefault: address.isDefault,
      isEnabled: address.isEnabled,
    })
    setShowAddModal(true)
  }

  const openAddModal = () => {
    setEditingAddress(null)
    setNewAddress({ name: '', address: '', network: 'TRC20', qrCodeUrl: '', isDefault: false, isEnabled: true })
    setShowAddModal(true)
  }

  const columns = [
    { key: 'name', label: '名称' },
    { 
      key: 'address', 
      label: '收款地址',
      render: (item: Address) => (
        <span className="text-xs font-mono truncate max-w-[100px] sm:max-w-[200px] block">{item.address}</span>
      ),
    },
    { key: 'network', label: '网络' },
    {
      key: 'isDefault',
      label: '默认',
      render: (item: Address) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.isDefault ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {item.isDefault ? '是' : '否'}
        </span>
      ),
    },
    {
      key: 'isEnabled',
      label: '状态',
      render: (item: Address) => (
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
      render: (item: Address) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEditModal(item)}
            className="text-blue-500 hover:text-blue-700 text-xs sm:text-sm"
          >
            编辑
          </button>
          <button
            onClick={() => deleteAddress(item.id)}
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
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">收款地址管理</h1>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
          <p className="text-gray-600 text-sm sm:text-base">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">收款地址管理</h1>
        <button
          onClick={openAddModal}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm"
        >
          + 添加地址
        </button>
      </div>

      <DataTable columns={columns} data={addresses} emptyMessage="暂无收款地址" />

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
              {editingAddress ? '编辑收款地址' : '添加收款地址'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  名称 *
                </label>
                <input
                  type="text"
                  value={newAddress.name}
                  onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="例如：USDT 收款地址"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  收款地址 *
                </label>
                <input
                  type="text"
                  value={newAddress.address}
                  onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="钱包地址"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  网络
                </label>
                <select
                  value={newAddress.network}
                  onChange={(e) => setNewAddress({ ...newAddress, network: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="TRC20">TRC20</option>
                  <option value="ERC20">ERC20</option>
                  <option value="BEP20">BEP20</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  二维码 URL（可选）
                </label>
                <input
                  type="text"
                  value={newAddress.qrCodeUrl}
                  onChange={(e) => setNewAddress({ ...newAddress, qrCodeUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="二维码图片 URL"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={newAddress.isDefault}
                    onChange={(e) => setNewAddress({ ...newAddress, isDefault: e.target.checked })}
                    className="mr-2 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">设为默认</span>
                </label>
                <label className="flex items-center text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={newAddress.isEnabled}
                    onChange={(e) => setNewAddress({ ...newAddress, isEnabled: e.target.checked })}
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
                  setEditingAddress(null)
                }}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                取消
              </button>
              <button
                onClick={addAddress}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                {editingAddress ? '保存' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
