import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const botToken = process.env.BOT_TOKEN
    const webappUrl = process.env.WEBAPP_URL || process.env.RAILWAY_PUBLIC_DOMAIN
    
    if (!botToken) {
      return NextResponse.json({ 
        ok: false, 
        error: 'BOT_TOKEN is not set' 
      }, { status: 500 })
    }
    
    if (!webappUrl) {
      return NextResponse.json({ 
        ok: false, 
        error: 'WEBAPP_URL is not set' 
      }, { status: 500 })
    }
    
    // 构建 webhook URL
    const webhookUrl = `${webappUrl}/api/telegram/webhook`
    
    // 调用 Telegram API 设置 webhook
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          drop_pending_updates: true
        })
      }
    )
    
    const result = await response.json()
    
    // 获取 webhook 信息验证
    const infoResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`
    )
    const webhookInfo = await infoResponse.json()
    
    return NextResponse.json({
      ok: true,
      message: 'Webhook setup completed',
      setWebhookResult: result,
      webhookInfo: webhookInfo.result,
      webhookUrl: webhookUrl
    })
    
  } catch (error) {
    console.error('Error setting up webhook:', error)
    return NextResponse.json({ 
      ok: false, 
      error: String(error) 
    }, { status: 500 })
  }
}
