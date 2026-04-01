import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || null)
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.isAdmin || false)

  async function loginWithTelegram() {
    const tg = window.Telegram?.WebApp
    if (!tg || !tg.initData) {
      throw new Error('请在 Telegram 中打开此页面')
    }

    const { data } = await api.post('/auth/telegram', { initData: tg.initData })
    if (data.success) {
      token.value = data.token
      user.value = data.user
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
    } else {
      throw new Error(data.message)
    }
    return data
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return { token, user, isAuthenticated, isAdmin, loginWithTelegram, logout }
})
