import type { User as PrismaUser } from '@prisma/client'

// Export User type without sensitive fields
export type User = Omit<PrismaUser, 'password'>

// For client-side display
export type UserProfile = {
  id: string
  username: string
  email: string | null
  role: string
}

// Dashboard statistics types
export type DailyData = {
  date: Date | string
  count: number
}

export type LotterySummary = {
  id: string
  title: string
  status: string
  createdAt: Date | string
  _count: {
    participants: number
  }
}

export type WinnerRecord = {
  id: string
  username: string | null
  firstName: string | null
  prizeName: string
  wonAt: Date | string
  lottery: {
    title: string
  }
}

export type DashboardStats = {
  totalLotteries: number
  totalParticipants: number
  totalUsers: number
  todayUsers: number
  recentLotteries: LotterySummary[]
  recentWinners: WinnerRecord[]
  dailyStats: {
    dailyUsers: DailyData[]
    dailyParticipants: DailyData[]
    dailyLotteries: DailyData[]
  }
}
