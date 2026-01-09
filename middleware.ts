import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // WebApp pages don't need server-side authentication
  // Authentication is handled by the Telegram WebApp SDK on the client
  // API routes validate initData in their handlers
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
