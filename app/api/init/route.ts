import { NextResponse } from 'next/server'
import { initDatabase, checkDatabaseStatus } from '@/lib/init'
import { isSuperAdmin } from '@/lib/auth'

/**
 * GET /api/init - Check database initialization status
 * Public endpoint to check if database is properly initialized
 */
export async function GET() {
  try {
    const status = await checkDatabaseStatus()
    return NextResponse.json({
      ok: true,
      ...status,
    })
  } catch (error) {
    console.error('Error checking database status:', error)
    return NextResponse.json({
      ok: false,
      error: String(error),
    }, { status: 500 })
  }
}

/**
 * POST /api/init - Initialize database
 * Requires super admin authentication
 */
export async function POST(request: Request) {
  try {
    // Get authorization header or query parameter
    const authHeader = request.headers.get('authorization')
    const url = new URL(request.url)
    const telegramId = url.searchParams.get('telegramId') || authHeader?.replace('Bearer ', '')
    
    // Check if user is super admin
    if (!telegramId || !isSuperAdmin(telegramId)) {
      return NextResponse.json({
        ok: false,
        error: 'Unauthorized - Super admin access required',
      }, { status: 403 })
    }
    
    // Initialize database
    const result = await initDatabase()
    
    return NextResponse.json({
      ok: result.success,
      ...result,
    })
  } catch (error) {
    console.error('Error initializing database:', error)
    return NextResponse.json({
      ok: false,
      error: String(error),
    }, { status: 500 })
  }
}
