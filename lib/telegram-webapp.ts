/**
 * Utility hook for safely accessing Telegram WebApp data in client components
 */

export function getTelegramInitData(): string {
  // Safely access window object
  if (typeof window === 'undefined') {
    return ''
  }
  
  try {
    return (window as any).Telegram?.WebApp?.initData || ''
  } catch (error) {
    console.error('Error accessing Telegram WebApp data:', error)
    return ''
  }
}
