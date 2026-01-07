import Link from 'next/link'

const quickActions = [
  {
    title: '创建抽奖',
    description: '快速创建一个新的抽奖活动',
    href: '/lottery/new',
    icon: '🎉',
    color: 'bg-blue-500',
  },
  {
    title: '查看模板',
    description: '管理抽奖消息模板',
    href: '/templates',
    icon: '📝',
    color: 'bg-green-500',
  },
  {
    title: '管理用户',
    description: '查看和管理参与用户',
    href: '/users',
    icon: '👥',
    color: 'bg-purple-500',
  },
  {
    title: '抽奖管理',
    description: '查看所有抽奖活动',
    href: '/lottery',
    icon: '🎯',
    color: 'bg-orange-500',
  },
]

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">欢迎使用抽奖机器人管理后台</h1>
        <p className="mt-2 text-gray-600">选择下方快捷操作或从左侧菜单开始</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 group"
          >
            <div
              className={`w-12 h-12 ${action.color} rounded-lg flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}
            >
              {action.icon}
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {action.title}
            </h3>
            <p className="text-gray-600 text-sm">{action.description}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">系统概览</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">0</div>
            <div className="text-gray-600 mt-2">活跃抽奖</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">0</div>
            <div className="text-gray-600 mt-2">总参与人数</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-3xl font-bold text-purple-600">0</div>
            <div className="text-gray-600 mt-2">已加入群组</div>
          </div>
        </div>
      </div>
    </div>
  )
}
