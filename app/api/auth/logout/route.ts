import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME } from '@/lib/constants'

export async function POST() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(COOKIE_NAME)

    return NextResponse.json({ message: '退出成功' })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: '退出失败，请稍后重试' },
      { status: 500 }
    )
  }
}
