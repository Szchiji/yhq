import { hash, compare } from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { JWT_SECRET, JWT_EXPIRES_IN, COOKIE_NAME } from './constants'
import { prisma } from './prisma'

function getSecret(): string {
  if (!JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production environment')
    }
    console.warn('⚠️  Using fallback JWT secret for development only')
    return 'dev-secret-key-change-in-production'
  }
  return JWT_SECRET
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return await hash(password, 10)
}

// Verify password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await compare(password, hashedPassword)
}

// Sign JWT token
export async function signToken(payload: { userId: string; username: string; role: string }): Promise<string> {
  const secret = getSecret()
  const encodedSecret = new TextEncoder().encode(secret)
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(encodedSecret)
  return token
}

// Verify JWT token
export async function verifyToken(token: string): Promise<{ userId: string; username: string; role: string } | null> {
  try {
    const secret = getSecret()
    const encodedSecret = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, encodedSecret)
    return {
      userId: payload.userId as string,
      username: payload.username as string,
      role: payload.role as string,
    }
  } catch (error) {
    return null
  }
}

// Get current session from cookie
export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return null
  }

  // Fetch user from database
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      telegramId: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      isActive: true,
    },
  })

  return user
}
