/**
 * Centralized API utility functions for making authenticated requests to the backend.
 * Automatically includes Telegram initData in request headers for authentication.
 */

// 获取 Telegram initData
function getInitData(): string {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData
  }
  return ''
}

// 通用 API 请求函数
export async function apiRequest(url: string, options: RequestInit = {}) {
  const initData = getInitData()
  
  const headers = {
    'Content-Type': 'application/json',
    ...(initData ? { 'x-telegram-init-data': initData } : {}),
    ...options.headers,
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  })
  
  return response
}

// GET 请求
export async function apiGet(url: string) {
  return apiRequest(url, { method: 'GET' })
}

// POST 请求
export async function apiPost(url: string, data?: any) {
  return apiRequest(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  })
}

// PUT 请求
export async function apiPut(url: string, data?: any) {
  return apiRequest(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  })
}

// DELETE 请求
export async function apiDelete(url: string) {
  return apiRequest(url, { method: 'DELETE' })
}
