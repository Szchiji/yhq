type Winner = {
  id: string
  username: string | null
  firstName: string | null
  prizeName: string
  wonAt: Date | string
  lottery: {
    title: string
  }
}

type RecentWinnersProps = {
  winners: Winner[]
}

export default function RecentWinners({ winners }: RecentWinnersProps) {
  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getUserName = (winner: Winner) => {
    if (winner.username) return `@${winner.username}`
    if (winner.firstName) return winner.firstName
    return '匿名用户'
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-4">最新中奖记录</h2>
      
      {winners.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p>暂无中奖记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {winners.map((winner) => (
            <div
              key={winner.id}
              className="p-3 rounded-lg border border-gray-200 hover:border-yellow-300 hover:bg-yellow-50 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🎉</span>
                    <span className="font-medium text-gray-800">{getUserName(winner)}</span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-0.5">
                    <p className="truncate">
                      <span className="text-gray-500">抽奖：</span>
                      {winner.lottery.title}
                    </p>
                    <p>
                      <span className="text-gray-500">奖品：</span>
                      <span className="font-medium text-orange-600">{winner.prizeName}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      🕒 {formatDate(winner.wonAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
