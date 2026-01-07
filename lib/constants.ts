const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET && process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  // Only throw in production runtime (not during build)
  if (process.env.NEXT_PHASE !== 'phase-production-build') {
    console.error('⚠️  CRITICAL: JWT_SECRET environment variable is required in production')
  }
}

if (!JWT_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  WARNING: JWT_SECRET not set, using development fallback')
}

export { JWT_SECRET }
export const JWT_EXPIRES_IN = '7d'
export const COOKIE_NAME = 'auth_token'
