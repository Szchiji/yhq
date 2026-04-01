<template>
  <div class="container">
    <div v-if="loading" class="loading">
      <p>加载中...</p>
    </div>

    <div v-else-if="!authStore.isAuthenticated" class="card">
      <h2>🔐 管理员后台</h2>
      <p style="margin: 12px 0; color: var(--tg-theme-hint-color);">请通过 Telegram 验证登录</p>
      <button class="btn btn-primary" @click="login" :disabled="authLoading">
        {{ authLoading ? '验证中...' : '登录' }}
      </button>
      <div v-if="authError" class="alert alert-error" style="margin-top: 12px;">{{ authError }}</div>
    </div>

    <div v-else-if="!authStore.isAdmin" class="card">
      <p class="alert alert-error">❌ 你没有管理员权限</p>
    </div>

    <div v-else>
      <!-- Tab navigation -->
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Basic Config Tab -->
      <div v-if="activeTab === 'config'" class="tab-content">
        <div class="card">
          <div class="section-title">📢 频道配置</div>
          <div class="form-group">
            <label>强制订阅频道 ID（如 @channelname 或 -100xxx）</label>
            <input v-model="config.channelId" class="form-control" placeholder="@your_channel" />
          </div>
          <div class="form-group">
            <label>报告推送频道 ID</label>
            <input v-model="config.pushChannelId" class="form-control" placeholder="@your_push_channel" />
          </div>
        </div>

        <div class="card">
          <div class="section-title">🎬 /start 内容</div>
          <div class="form-group">
            <label>欢迎文字</label>
            <textarea v-model="config.startContent.text" class="form-control" rows="4" placeholder="欢迎使用报告管理机器人..."></textarea>
          </div>
          <div class="form-group">
            <label>媒体类型</label>
            <select v-model="config.startContent.mediaType" class="form-control">
              <option value="none">无</option>
              <option value="photo">图片</option>
              <option value="video">视频</option>
            </select>
          </div>
          <div v-if="config.startContent.mediaType !== 'none'" class="form-group">
            <label>媒体 URL</label>
            <input v-model="config.startContent.mediaUrl" class="form-control" placeholder="https://..." />
          </div>
        </div>

        <div class="card">
          <div class="section-title">🔘 自定义按钮（/start 内联按钮）</div>
          <div v-for="(btn, i) in config.startContent.buttons" :key="i" class="button-row">
            <input v-model="btn.text" class="form-control" placeholder="按钮文字" style="margin-bottom: 6px;" />
            <input v-model="btn.url" class="form-control" placeholder="跳转链接（URL）" style="margin-bottom: 6px;" />
            <button class="btn btn-danger" style="width: auto; font-size: 12px;" @click="removeStartButton(i)">删除</button>
          </div>
          <button class="btn btn-primary" style="margin-top: 8px;" @click="addStartButton">+ 添加按钮</button>
        </div>

        <div class="card">
          <div class="section-title">⌨️ 底部键盘菜单按钮</div>
          <div v-for="(kb, i) in config.keyboards" :key="i" class="button-row">
            <input v-model="kb.text" class="form-control" placeholder="按钮文字" style="margin-bottom: 6px;" />
            <select v-model="kb.action" class="form-control" style="margin-bottom: 6px;">
              <option value="write_report">写报告</option>
              <option value="query_report">查阅报告</option>
              <option value="contact_admin">联系管理员</option>
              <option value="help">操作帮助</option>
              <option value="custom">自定义</option>
            </select>
            <button class="btn btn-danger" style="width: auto; font-size: 12px;" @click="removeKeyboard(i)">删除</button>
          </div>
          <button class="btn btn-primary" style="margin-top: 8px;" @click="addKeyboard">+ 添加按钮</button>
        </div>

        <div class="card">
          <div class="section-title">💬 审核反馈文案</div>
          <div class="form-group">
            <label>通过时发送</label>
            <textarea v-model="config.reviewFeedback.approved" class="form-control" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>拒绝时发送</label>
            <textarea v-model="config.reviewFeedback.rejected" class="form-control" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>待审核时发送</label>
            <textarea v-model="config.reviewFeedback.pending" class="form-control" rows="2"></textarea>
          </div>
        </div>

        <div v-if="saveMsg" class="alert" :class="saveMsg.type === 'success' ? 'alert-success' : 'alert-error'">
          {{ saveMsg.text }}
        </div>
        <button class="btn btn-primary" @click="saveConfig" :disabled="saving">
          {{ saving ? '保存中...' : '💾 保存配置' }}
        </button>
      </div>

      <!-- Reports Tab -->
      <div v-if="activeTab === 'reports'" class="tab-content">
        <div class="filter-row">
          <button
            v-for="s in statuses"
            :key="s.value"
            class="filter-btn"
            :class="{ active: statusFilter === s.value }"
            @click="statusFilter = s.value; loadReports()"
          >{{ s.label }}</button>
        </div>

        <div v-if="reportsLoading" class="loading">加载中...</div>
        <div v-else-if="reports.length === 0" class="card">
          <p style="color: var(--tg-theme-hint-color); text-align: center;">暂无报告</p>
        </div>

        <div v-for="report in reports" :key="report._id" class="card report-card">
          <div class="report-header">
            <span class="badge" :class="`badge-${report.status}`">
              {{ statusLabel(report.status) }}
            </span>
            <span style="font-size: 12px; color: var(--tg-theme-hint-color);">No.{{ report.reportNumber }}</span>
          </div>
          <h3 style="margin: 8px 0 4px; font-size: 15px;">{{ report.title || '无标题' }}</h3>
          <p style="font-size: 13px; color: var(--tg-theme-hint-color);">
            👤 @{{ report.username || '匿名' }} · {{ formatDate(report.createdAt) }}
          </p>
          <p v-if="report.description" style="font-size: 13px; margin: 8px 0;">{{ report.description }}</p>
          <div v-if="report.tags && report.tags.length > 0" style="margin: 6px 0;">
            <span v-for="tag in report.tags" :key="tag" class="tag">#{{ tag }}</span>
          </div>
          <div v-if="report.status === 'pending'" class="review-actions">
            <textarea
              v-model="reviewNotes[report._id]"
              class="form-control"
              placeholder="审核备注（可选）"
              rows="2"
              style="margin-bottom: 8px;"
            ></textarea>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-success" style="flex: 1;" @click="reviewReport(report._id, 'approved')">✅ 通过</button>
              <button class="btn btn-danger" style="flex: 1;" @click="reviewReport(report._id, 'rejected')">❌ 拒绝</button>
            </div>
          </div>
          <div v-if="report.reviewNote" style="margin-top: 8px; font-size: 12px; color: var(--tg-theme-hint-color);">
            审核备注：{{ report.reviewNote }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const authStore = useAuthStore()
const loading = ref(true)
const authLoading = ref(false)
const authError = ref('')
const activeTab = ref('config')
const saving = ref(false)
const saveMsg = ref(null)
const reportsLoading = ref(false)
const reports = ref([])
const statusFilter = ref('')
const reviewNotes = reactive({})

const tabs = [
  { key: 'config', label: '⚙️ 配置' },
  { key: 'reports', label: '📋 报告审核' },
]

const statuses = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
]

const config = reactive({
  channelId: '',
  pushChannelId: '',
  startContent: {
    text: '',
    mediaType: 'none',
    mediaUrl: '',
    buttons: [],
  },
  keyboards: [],
  reviewFeedback: {
    approved: '',
    rejected: '',
    pending: '',
  },
})

async function login() {
  authLoading.value = true
  authError.value = ''
  try {
    await authStore.loginWithTelegram()
    await loadConfig()
  } catch (e) {
    authError.value = e.message || '登录失败'
  } finally {
    authLoading.value = false
  }
}

async function loadConfig() {
  const { data } = await api.get('/admin/config')
  if (data.success) {
    Object.assign(config, data.data)
  }
}

async function loadReports() {
  reportsLoading.value = true
  try {
    const params = statusFilter.value ? { status: statusFilter.value } : {}
    const { data } = await api.get('/admin/reports', { params })
    if (data.success) reports.value = data.data
  } finally {
    reportsLoading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  saveMsg.value = null
  try {
    const { data } = await api.put('/admin/config', config)
    if (data.success) {
      saveMsg.value = { type: 'success', text: '✅ 配置已保存！' }
    }
  } catch (e) {
    saveMsg.value = { type: 'error', text: '❌ 保存失败：' + (e.response?.data?.message || e.message) }
  } finally {
    saving.value = false
    setTimeout(() => { saveMsg.value = null }, 3000)
  }
}

async function reviewReport(id, status) {
  try {
    await api.put(`/admin/reports/${id}/review`, {
      status,
      reviewNote: reviewNotes[id] || '',
    })
    await loadReports()
  } catch (e) {
    alert('操作失败：' + (e.response?.data?.message || e.message))
  }
}

function addStartButton() {
  config.startContent.buttons.push({ text: '', url: '', action: '' })
}

function removeStartButton(i) {
  config.startContent.buttons.splice(i, 1)
}

function addKeyboard() {
  config.keyboards.push({ text: '', action: 'write_report' })
}

function removeKeyboard(i) {
  config.keyboards.splice(i, 1)
}

function statusLabel(s) {
  return { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[s] || s
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('zh-CN')
}

onMounted(async () => {
  try {
    if (authStore.isAuthenticated && authStore.isAdmin) {
      await loadConfig()
      await loadReports()
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.loading { text-align: center; padding: 40px; color: var(--tg-theme-hint-color); }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tab-btn {
  flex: 1; padding: 10px; border: none; border-radius: 8px;
  background: var(--tg-theme-secondary-bg-color); color: var(--tg-theme-text-color);
  cursor: pointer; font-size: 13px;
}
.tab-btn.active { background: var(--tg-theme-button-color); color: var(--tg-theme-button-text-color); }
.tab-content { padding-bottom: 40px; }
.button-row { margin-bottom: 12px; padding: 12px; background: var(--tg-theme-bg-color); border-radius: 8px; }
.filter-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
.filter-btn {
  padding: 6px 12px; border: 1px solid #ddd; border-radius: 16px;
  background: transparent; cursor: pointer; font-size: 13px;
}
.filter-btn.active { background: var(--tg-theme-button-color); color: white; border-color: transparent; }
.report-card { padding: 14px; }
.report-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.review-actions { margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee; }
.tag { display: inline-block; background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 4px; }
</style>
