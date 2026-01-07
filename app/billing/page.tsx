'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BillingPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to address page by default
    router.replace('/billing/address')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-gray-600">重定向中...</div>
    </div>
  )
}
