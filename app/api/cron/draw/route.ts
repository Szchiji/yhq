import { NextRequest, NextResponse } from 'next/server'
import { checkScheduledDraws } from '@/lib/lottery'

// GET - 供 Railway cron 或外部调用
// 检查所有到期的抽奖并执行开奖
export async function GET(request: NextRequest) {
  // 验证 CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await checkScheduledDraws()
    
    return NextResponse.json({ 
      ok: true,
      results,
      processedCount: results.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in cron draw:', error)
    return NextResponse.json({ 
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
