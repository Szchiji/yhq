'use client'

import { useEffect, useState } from 'react'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

interface WebAppData {
  user: TelegramUser | null
  initData: string
  isReady: boolean
  isSuperAdmin: boolean
  isAdmin: boolean
}

export function useTelegramWebApp() {
  const [data, setData] = useState<WebAppData>({
    user: null,
    initData: '',
    isReady: false,
    isSuperAdmin: false,
    isAdmin: false,
  })

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    if (tg) {
      tg.ready()
      tg.expand()
      
      const initData = tg.initData
      const user = tg.initDataUnsafe?.user
      
      // Verify and get permissions
      if (initData) {
        fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        })
          .then(res => {
            if (!res.ok) {
              throw new Error(`Authentication failed with status ${res.status}`)
            }
            return res.json()
          })
          .then(result => {
            if (result.error) {
              console.error('Authentication error:', result.error)
              setData({
                user: null,
                initData: '',
                isReady: true,
                isSuperAdmin: false,
                isAdmin: false,
              })
            } else {
              setData({
                user,
                initData,
                isReady: true,
                isSuperAdmin: result.isSuperAdmin,
                isAdmin: result.isAdmin,
              })
            }
          })
          .catch(err => {
            console.error('Network error during authentication:', err)
            setData({
              user: null,
              initData: '',
              isReady: true,
              isSuperAdmin: false,
              isAdmin: false,
            })
          })
      } else {
        // No initData means not in Telegram WebApp
        setData({
          user: null,
          initData: '',
          isReady: true,
          isSuperAdmin: false,
          isAdmin: false,
        })
      }
    } else {
      // Telegram WebApp SDK not loaded
      setData({
        user: null,
        initData: '',
        isReady: true,
        isSuperAdmin: false,
        isAdmin: false,
      })
    }
  }, [])

  return data
}
