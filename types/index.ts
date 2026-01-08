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
