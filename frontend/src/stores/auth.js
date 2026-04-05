import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || null)
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.isAdmin || false)

  /**
   * Set token directly (used by OTP login flow after bot verification).
   * Decodes the JWT payload to populate the user ref.
   */
  function setToken(jwt) {
    token.value = jwt
    localStorage.setItem('token', jwt)
    // Decode payload (no verification needed – server already verified)
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]))
      user.value = { id: payload.userId, isAdmin: payload.isAdmin }
      localStorage.setItem('user', JSON.stringify(user.value))
    } catch {
      user.value = { isAdmin: true }
      localStorage.setItem('user', JSON.stringify(user.value))
    }
  }

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

  return { token, user, isAuthenticated, isAdmin, setToken, loginWithTelegram, logout }
})
