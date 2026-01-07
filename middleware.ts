import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// 需要保护的路由
const protectedRoutes = [
  '/',
  '/templates',
  '/announcements',
  '/groups',
  '/forced-join',
  '/lottery',
  '/users',
  '/scheduled',
  '/admins',
  '/billing',
]

// 公开路由（未登录可访问）
const publicRoutes = ['/login', '/register']

async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production'
    const encodedSecret = new TextEncoder().encode(secret)
    await jwtVerify(token, encodedSecret)
    return true
  } catch (error) {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  const { pathname } = request.nextUrl

  // Verify token if present
  const isValidToken = token ? await verifyToken(token) : false

  // 已登录用户访问登录/注册页面，重定向到首页
  if (publicRoutes.includes(pathname) && isValidToken) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 未登录用户访问受保护页面，重定向到登录页
  const isProtected = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )
  
  if (isProtected && !isValidToken) {
    // Clear invalid token if present
    const response = NextResponse.redirect(new URL('/login', request.url))
    if (token) {
      response.cookies.delete('auth_token')
    }
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
