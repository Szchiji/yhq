import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  const { pathname } = request.nextUrl

  // 已登录用户访问登录/注册页面，重定向到首页
  if (publicRoutes.includes(pathname) && token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 未登录用户访问受保护页面，重定向到登录页
  const isProtected = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )
  
  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
