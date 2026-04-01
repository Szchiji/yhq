<template>
  <div class="container">
    <div v-if="!authStore.isAuthenticated" class="card">
      <h2>📝 填写报告</h2>
      <p style="margin: 12px 0; color: var(--tg-theme-hint-color);">请通过 Telegram 验证</p>
      <button class="btn btn-primary" @click="login" :disabled="authLoading">
        {{ authLoading ? '验证中...' : '登录' }}
      </button>
      <div v-if="authError" class="alert alert-error" style="margin-top: 12px;">{{ authError }}</div>
    </div>

    <div v-else>
      <!-- Success state -->
      <div v-if="submitted" class="card" style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
        <h2>报告已提交！</h2>
        <p style="margin-top: 8px; color: var(--tg-theme-hint-color);">等待管理员审核，审核结果将通过机器人通知你。</p>
        <button class="btn btn-primary" style="margin-top: 24px;" @click="resetForm">提交新报告</button>
      </div>

      <div v-else>
        <h2 style="margin-bottom: 16px;">📝 填写报告</h2>

        <div class="card">
          <div class="form-group">
            <label>报告标题 <span style="color: red;">*</span></label>
            <input v-model="form.title" class="form-control" placeholder="请输入报告标题" />
          </div>

          <div class="form-group">
            <label>报告内容 <span style="color: red;">*</span></label>
            <textarea
              v-model="form.description"
              class="form-control"
              rows="6"
              placeholder="请详细描述报告内容..."
            ></textarea>
          </div>

          <div class="form-group">
            <label>标签（用逗号分隔，如：项目,周报）</label>
            <input v-model="tagsInput" class="form-control" placeholder="项目,周报,2024" />
          </div>
        </div>

        <!-- Dynamic fields from template -->
        <div v-if="templateFields.length > 0" class="card">
          <div class="section-title">📋 报告详情</div>
          <div v-for="field in templateFields" :key="field.name" class="form-group">
            <label>
              {{ field.label || field.name }}
              <span v-if="field.required" style="color: red;">*</span>
            </label>
            <select v-if="field.type === 'select'" v-model="form.content[field.name]" class="form-control">
              <option value="">请选择</option>
              <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <textarea
              v-else-if="field.type === 'textarea'"
              v-model="form.content[field.name]"
              class="form-control"
              rows="3"
              :placeholder="`请填写 ${field.label || field.name}`"
            ></textarea>
            <input
              v-else
              v-model="form.content[field.name]"
              class="form-control"
              :placeholder="`请填写 ${field.label || field.name}`"
            />
          </div>
        </div>

        <div v-if="error" class="alert alert-error">{{ error }}</div>

        <button class="btn btn-primary" @click="submitReport" :disabled="submitting">
          {{ submitting ? '提交中...' : '📤 提交报告' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const authStore = useAuthStore()
const authLoading = ref(false)
const authError = ref('')
const submitting = ref(false)
const submitted = ref(false)
const error = ref('')
const templateFields = ref([])
const tagsInput = ref('')

const form = reactive({
  title: '',
  description: '',
  content: {},
})

async function login() {
  authLoading.value = true
  authError.value = ''
  try {
    await authStore.loginWithTelegram()
    await loadTemplate()
  } catch (e) {
    authError.value = e.message || '登录失败'
  } finally {
    authLoading.value = false
  }
}

async function loadTemplate() {
  try {
    const { data } = await api.get('/admin/config')
    if (data.success && data.data.reportTemplate?.fields) {
      templateFields.value = data.data.reportTemplate.fields
    }
  } catch {}
}

async function submitReport() {
  if (!form.title.trim()) {
    error.value = '请填写报告标题'
    return
  }
  if (!form.description.trim()) {
    error.value = '请填写报告内容'
    return
  }

  // Validate required template fields
  for (const field of templateFields.value) {
    if (field.required && !form.content[field.name]) {
      error.value = `请填写：${field.label || field.name}`
      return
    }
  }

  error.value = ''
  submitting.value = true

  try {
    const tg = window.Telegram?.WebApp
    const tgUser = tg?.initDataUnsafe?.user

    const tags = tagsInput.value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    await api.post('/reports', {
      userId: authStore.user?.id || tgUser?.id,
      username: authStore.user?.username || tgUser?.username || '',
      firstName: authStore.user?.firstName || tgUser?.first_name || '',
      title: form.title,
      description: form.description,
      content: form.content,
      tags,
    })

    submitted.value = true
    // Close Mini App after 2s
    setTimeout(() => {
      tg?.close()
    }, 2000)
  } catch (e) {
    error.value = '提交失败：' + (e.response?.data?.message || e.message)
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  form.title = ''
  form.description = ''
  form.content = {}
  tagsInput.value = ''
  submitted.value = false
  error.value = ''
}

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await loadTemplate()
  }
})
</script>
