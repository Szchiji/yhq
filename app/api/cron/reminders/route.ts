import { NextRequest, NextResponse } from 'next/server'
import { checkAndSendReminders } from '@/lib/reminder'

// GET - 供 Railway cron 或外部调用
// 检查所有即将过期的用户并发送提醒
export async function GET(request: NextRequest) {
  try {
    // 验证 cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await checkAndSendReminders()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Reminders checked and sent',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in cron reminders:', error)
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
