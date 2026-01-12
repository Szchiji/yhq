import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendMessage } from '@/lib/telegram'

export async function GET(request: NextRequest) {
  // 验证 CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    
    // 查找所有到期且待发送的消息
    const pendingMessages = await prisma.scheduledMessage.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: now }
      },
      include: {
        user: true
      }
    })

    const results = []

    for (const message of pendingMessages) {
      try {
        // 确定发送目标
        const targetChatId = message.targetChatId || message.user.telegramId

        // 发送消息
        // Note: Media sending is simplified - for production use,
        // consider implementing proper photo/video sending via Bot API
        await sendMessage(targetChatId, message.content)

        // 更新状态为已发送
        await prisma.scheduledMessage.update({
          where: { id: message.id },
          data: {
            status: 'sent',
            sentAt: new Date()
          }
        })

        // 处理重复类型
        if (message.repeatType !== 'once') {
          // 计算下一次发送时间
          let nextScheduledAt = new Date(message.scheduledAt)
          
          switch (message.repeatType) {
            case 'daily':
              nextScheduledAt.setDate(nextScheduledAt.getDate() + 1)
              break
            case 'weekly':
              nextScheduledAt.setDate(nextScheduledAt.getDate() + 7)
              break
            case 'monthly':
              nextScheduledAt.setMonth(nextScheduledAt.getMonth() + 1)
              break
          }

          // 创建下一条定时消息
          await prisma.scheduledMessage.create({
            data: {
              userId: message.userId,
              title: message.title,
              content: message.content,
              mediaType: message.mediaType,
              mediaUrl: message.mediaUrl,
              targetType: message.targetType,
              targetChatId: message.targetChatId,
              scheduledAt: nextScheduledAt,
              repeatType: message.repeatType,
              status: 'pending'
            }
          })
        }

        results.push({ id: message.id, success: true })
      } catch (error) {
        console.error(`Failed to send message ${message.id}:`, error)
        
        // 更新状态为失败
        await prisma.scheduledMessage.update({
          where: { id: message.id },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })

        results.push({ id: message.id, success: false, error: String(error) })
      }
    }

    return NextResponse.json({
      ok: true,
      processedCount: results.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      results,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in cron scheduled:', error)
    return NextResponse.json({ 
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
