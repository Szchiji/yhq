import type { Metadata } from 'next'
import './globals.css'
import LayoutClient from './layout-client'
import Script from 'next/script'

export const metadata: Metadata = {
  title: '抽奖机器人管理后台',
  description: 'Telegram 抽奖机器人管理系统',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <head>
        <Script 
          src="https://telegram.org/js/telegram-web-app.js" 
          strategy="beforeInteractive"
        />
      </head>
      <body className="font-sans">
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  )
}
