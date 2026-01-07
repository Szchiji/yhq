'use client'

import { useState } from 'react'
import DataTable from '@/components/DataTable'

type Address = {
  id: number
  name: string
  address: string
  network: string
  status: string
}

export default function BillingAddressPage() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newAddress, setNewAddress] = useState({ 
    name: '', 
    address: '', 
    network: 'TRC20',
  })

  const columns = [
    { key: 'name', label: '名称' },
    { key: 'address', label: '收款地址' },
    { key: 'network', label: '网络' },
    {
      key: 'status',
      label: '状态',
      render: (item: Address) => (
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
      render: (item: Address) => (
        <div className="flex gap-2">
          <button className="text-blue-500 hover:text-blue-700">编辑</button>
          <button
            onClick={() => setAddresses(addresses.filter((a) => a.id !== item.id))}
            className="text-red-500 hover:text-red-700"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  const addAddress = () => {
    if (newAddress.name && newAddress.address) {
      setAddresses([
        ...addresses,
        {
          id: Date.now(),
          ...newAddress,
          status: '启用',
        },
      ])
      setNewAddress({ name: '', address: '', network: 'TRC20' })
      setShowAddModal(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">收款地址管理</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          + 添加地址
        </button>
      </div>

      <DataTable columns={columns} data={addresses} emptyMessage="暂无收款地址" />

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">添加收款地址</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  名称
                </label>
                <input
                  type="text"
                  value={newAddress.name}
                  onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例如：USDT 收款地址"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  收款地址
                </label>
                <input
                  type="text"
                  value={newAddress.address}
                  onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="钱包地址"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  网络
                </label>
                <select
                  value={newAddress.network}
                  onChange={(e) => setNewAddress({ ...newAddress, network: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TRC20">TRC20</option>
                  <option value="ERC20">ERC20</option>
                  <option value="BEP20">BEP20</option>
                </select>
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
                onClick={addAddress}
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
