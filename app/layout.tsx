import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Lottery Bot Management',
  description: 'Dashboard for managing lottery bot',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <div className="flex min-h-screen bg-gray-100">
          <Sidebar />
          <main className="flex-1 p-6 ml-64">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
