import React from 'react'

type Tab = {
  id: string
  label: string
}

type TabPanelProps = {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  children: React.ReactNode
}

export default function TabPanel({
  tabs,
  activeTab,
  onTabChange,
  children,
}: TabPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-6 py-3 font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}
