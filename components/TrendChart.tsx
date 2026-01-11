'use client'

type DailyData = {
  date: Date | string
  count: number
}

type TrendChartProps = {
  dailyUsers: DailyData[]
  dailyParticipants: DailyData[]
  dailyLotteries: DailyData[]
  timeRange: number
  onTimeRangeChange: (range: number) => void
}

const MIN_BAR_HEIGHT = '4px'

export default function TrendChart({
  dailyUsers,
  dailyParticipants,
  dailyLotteries,
  timeRange,
  onTimeRangeChange
}: TrendChartProps) {
  // Filter data based on time range
  const filterDataByRange = (data: DailyData[]) => {
    return data.slice(-timeRange)
  }

  const filteredUsers = filterDataByRange(dailyUsers)
  const filteredParticipants = filterDataByRange(dailyParticipants)
  const filteredLotteries = filterDataByRange(dailyLotteries)

  // Calculate max value for scaling
  const maxUsers = Math.max(...filteredUsers.map(d => d.count), 1)
  const maxParticipants = Math.max(...filteredParticipants.map(d => d.count), 1)
  const maxLotteries = Math.max(...filteredLotteries.map(d => d.count), 1)

  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-2 sm:mb-0">活跃趋势</h2>
        <div className="flex gap-2">
          <button
            onClick={() => onTimeRangeChange(7)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              timeRange === 7
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            7天
          </button>
          <button
            onClick={() => onTimeRangeChange(30)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              timeRange === 30
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            30天
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Daily Users */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">每日新增用户</span>
            <span className="text-sm text-blue-500 font-medium">
              总计: {filteredUsers.reduce((sum, d) => sum + d.count, 0)}
            </span>
          </div>
          <div className="flex items-end gap-1 h-16">
            {filteredUsers.map((item, index) => {
              const height = maxUsers > 0 ? (item.count / maxUsers) * 100 : 0
              return (
                <div
                  key={index}
                  className="flex-1 bg-blue-200 hover:bg-blue-300 rounded-t transition-all cursor-pointer group relative"
                  style={{ height: `${height}%`, minHeight: item.count > 0 ? MIN_BAR_HEIGHT : '0px' }}
                  title={`${formatDate(item.date)}: ${item.count}`}
                >
                  <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {formatDate(item.date)}: {item.count}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Daily Participants */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">每日参与人次</span>
            <span className="text-sm text-green-500 font-medium">
              总计: {filteredParticipants.reduce((sum, d) => sum + d.count, 0)}
            </span>
          </div>
          <div className="flex items-end gap-1 h-16">
            {filteredParticipants.map((item, index) => {
              const height = maxParticipants > 0 ? (item.count / maxParticipants) * 100 : 0
              return (
                <div
                  key={index}
                  className="flex-1 bg-green-200 hover:bg-green-300 rounded-t transition-all cursor-pointer group relative"
                  style={{ height: `${height}%`, minHeight: item.count > 0 ? MIN_BAR_HEIGHT : '0px' }}
                  title={`${formatDate(item.date)}: ${item.count}`}
                >
                  <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {formatDate(item.date)}: {item.count}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Daily Lotteries */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">每日创建抽奖</span>
            <span className="text-sm text-purple-500 font-medium">
              总计: {filteredLotteries.reduce((sum, d) => sum + d.count, 0)}
            </span>
          </div>
          <div className="flex items-end gap-1 h-16">
            {filteredLotteries.map((item, index) => {
              const height = maxLotteries > 0 ? (item.count / maxLotteries) * 100 : 0
              return (
                <div
                  key={index}
                  className="flex-1 bg-purple-200 hover:bg-purple-300 rounded-t transition-all cursor-pointer group relative"
                  style={{ height: `${height}%`, minHeight: item.count > 0 ? MIN_BAR_HEIGHT : '0px' }}
                  title={`${formatDate(item.date)}: ${item.count}`}
                >
                  <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {formatDate(item.date)}: {item.count}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
