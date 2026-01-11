type StatsCardProps = {
  title: string
  value: number
  icon: string
  trend?: number
  color: 'blue' | 'green' | 'purple' | 'orange'
}

const colorClasses = {
  blue: 'bg-blue-50 border-blue-100 text-blue-600',
  green: 'bg-green-50 border-green-100 text-green-600',
  purple: 'bg-purple-50 border-purple-100 text-purple-600',
  orange: 'bg-orange-50 border-orange-100 text-orange-600',
}

export default function StatsCard({ title, value, icon, trend, color }: StatsCardProps) {
  const colorClass = colorClasses[color]
  
  return (
    <div className={`${colorClass} rounded-lg p-4 border`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        {trend !== undefined && (
          <span className={trend >= 0 ? 'text-green-500 text-sm font-medium' : 'text-red-500 text-sm font-medium'}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold mt-2 ${color === 'blue' ? 'text-blue-600' : color === 'green' ? 'text-green-600' : color === 'purple' ? 'text-purple-600' : 'text-orange-600'}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-gray-600 text-sm mt-1">{title}</p>
    </div>
  )
}
