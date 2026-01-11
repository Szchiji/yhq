import Link from 'next/link'

type Lottery = {
  id: string
  title: string
  status: string
  createdAt: Date | string
  _count: {
    participants: number
  }
}

type RecentLotteriesProps = {
  lotteries: Lottery[]
}

const statusLabels: Record<string, { text: string; color: string }> = {
  active: { text: '进行中', color: 'bg-green-100 text-green-800' },
  drawn: { text: '已开奖', color: 'bg-blue-100 text-blue-800' },
  cancelled: { text: '已取消', color: 'bg-gray-100 text-gray-800' },
}

export default function RecentLotteries({ lotteries }: RecentLotteriesProps) {
  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-4">最新抽奖</h2>
      
      {lotteries.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p>暂无抽奖活动</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lotteries.map((lottery) => {
            const statusInfo = statusLabels[lottery.status] || { text: lottery.status, color: 'bg-gray-100 text-gray-800' }
            
            return (
              <Link
                key={lottery.id}
                href={`/lottery/${lottery.id}`}
                className="block p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800 truncate">{lottery.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.text}
                      </span>
                      <span>👥 {lottery._count.participants} 人参与</span>
                      <span className="text-xs">🕒 {formatDate(lottery.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      
      <Link
        href="/lottery"
        className="block mt-4 text-center text-blue-500 hover:text-blue-600 text-sm font-medium"
      >
        查看全部 →
      </Link>
    </div>
  )
}
