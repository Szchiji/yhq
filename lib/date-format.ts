/**
 * Date formatting utilities for consistent date display across the application
 */

/**
 * Format date to Chinese locale with date and time
 * @param date - Date string or Date object
 * @returns Formatted date string (e.g., "2024/01/11 21:30")
 */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai'
  })
}

/**
 * Format date to Chinese locale with date only
 * @param date - Date string or Date object
 * @returns Formatted date string (e.g., "2024/01/11")
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai'
  })
}
