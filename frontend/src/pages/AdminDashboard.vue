<template>
  <div class="container">
    <div v-if="loading" class="loading">
      <p>加载中...</p>
    </div>

    <!-- OTP login panel -->
    <div v-else-if="!authStore.isAuthenticated" class="card otp-card">
      <h2>🔐 管理员后台登录</h2>

      <!-- Step 1: request OTP -->
      <div v-if="otpStep === 'request'">
        <p class="hint">点击下方按钮获取 6 位验证码，然后将验证码私聊发送给机器人。</p>
        <button class="btn btn-primary" @click="requestOtp" :disabled="otpLoading">
          {{ otpLoading ? '生成中...' : '获取验证码' }}
        </button>
        <div v-if="authError" class="alert alert-error" style="margin-top: 12px;">{{ authError }}</div>
      </div>

      <!-- Step 2: show code + poll -->
      <div v-else-if="otpStep === 'pending'">
        <p class="hint">请将以下 6 位验证码私聊发送给机器人（有效期 5 分钟）：</p>
        <div class="otp-code">{{ otpCode }}</div>
        <p class="hint" style="margin-top: 12px; font-size: 12px;">
          ⚠️ 请在 Telegram 私聊机器人发送验证码，不要在群里发送。<br>
          页面将自动检测验证状态并跳转后台。
        </p>
        <div class="poll-status">
          <span class="spinner"></span> 等待验证中...
        </div>
        <div v-if="otpCountdown > 0" style="font-size: 12px; color: #888; margin-top: 8px;">
          剩余有效时间：{{ otpCountdown }}s
        </div>
        <button class="btn btn-secondary" style="margin-top: 12px;" @click="resetOtp">重新获取</button>
        <div v-if="authError" class="alert alert-error" style="margin-top: 12px;">{{ authError }}</div>
      </div>

      <!-- Step 3: expired / failed -->
      <div v-else-if="otpStep === 'expired'">
        <div class="alert alert-error">验证码已过期，请重新获取。</div>
        <button class="btn btn-primary" style="margin-top: 12px;" @click="resetOtp">重新获取</button>
      </div>
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

      <!-- Report Template Tab -->
      <div v-if="activeTab === 'template'" class="tab-content">
        <div class="card">
          <div class="section-title">📋 报告模板字段</div>
          <p style="font-size: 13px; color: var(--tg-theme-hint-color); margin-bottom: 12px;">
            自定义用户填写报告时需要填写的附加字段，字段将在报告表单中动态展示。
          </p>

          <div v-if="config.reportTemplate.fields.length === 0" style="color: var(--tg-theme-hint-color); font-size: 13px; margin-bottom: 12px;">
            暂无自定义字段，点击下方按钮添加。
          </div>

          <div v-for="(field, i) in config.reportTemplate.fields" :key="i" class="template-field-row">
            <div class="form-group" style="margin-bottom: 6px;">
              <label style="font-size: 12px;">字段名（英文，唯一标识）</label>
              <input v-model="field.name" class="form-control" placeholder="如：project_name" />
            </div>
            <div class="form-group" style="margin-bottom: 6px;">
              <label style="font-size: 12px;">显示标签</label>
              <input v-model="field.label" class="form-control" placeholder="如：项目名称" />
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 6px;">
              <div class="form-group" style="flex: 1; margin-bottom: 0;">
                <label style="font-size: 12px;">字段类型</label>
                <select v-model="field.type" class="form-control">
                  <option value="text">单行文本</option>
                  <option value="textarea">多行文本</option>
                  <option value="select">下拉选择</option>
                  <option value="media">图片/文件证据</option>
                  <option value="tags">标签</option>
                </select>
              </div>
              <div class="form-group" style="flex: 0 0 auto; margin-bottom: 0; display: flex; align-items: flex-end;">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; padding-bottom: 2px;">
                  <input type="checkbox" v-model="field.required" />
                  必填
                </label>
              </div>
            </div>
            <div v-if="field.type === 'select'" class="form-group" style="margin-bottom: 6px;">
              <label style="font-size: 12px;">选项（每行一个）</label>
              <textarea
                class="form-control"
                rows="3"
                :value="(field.options || []).join('\n')"
                @input="field.options = $event.target.value.split('\n').map(o => o.trim()).filter(Boolean)"
                placeholder="选项1&#10;选项2&#10;选项3"
              ></textarea>
            </div>
            <button class="btn btn-danger" style="width: auto; font-size: 12px;" @click="removeTemplateField(i)">🗑 删除此字段</button>
          </div>

          <button class="btn btn-primary" style="margin-top: 8px;" @click="addTemplateField">+ 添加字段</button>
        </div>

        <div v-if="saveMsg" class="alert" :class="saveMsg.type === 'success' ? 'alert-success' : 'alert-error'">
          {{ saveMsg.text }}
        </div>
        <button class="btn btn-primary" @click="saveConfig" :disabled="saving">
          {{ saving ? '保存中...' : '💾 保存模板' }}
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
          <div class="form-group">
            <label>需补充材料时发送</label>
            <textarea v-model="config.reviewFeedback.needMoreInfo" class="form-control" rows="2"></textarea>
          </div>
        </div>

        </div>

        <div class="card">
          <div class="section-title">📤 推送模板</div>
          <p style="font-size: 12px; color: var(--tg-theme-hint-color); margin-bottom: 10px;">
            审核通过后推送到频道时使用的文字模板，支持以下变量：<br>
            <code>{{reportNumber}}</code> 报告编号 &nbsp;
            <code>{{title}}</code> 标题 &nbsp;
            <code>{{description}}</code> 描述 &nbsp;
            <code>{{username}}</code> 提交人 &nbsp;
            <code>{{tags}}</code> 格式：🏷 #tag1 #tag2（含换行，无标签时为空）&nbsp;
            <code>{{url}}</code> 格式：🔗 [查看报告详情](链接)（无有效链接时为空）
          </p>
          <div class="form-group">
            <label>推送模板（Markdown 格式）</label>
            <textarea v-model="config.publishTemplate" class="form-control" rows="6" placeholder="📋 *报告推送* No.{{reportNumber}}..."></textarea>
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

        <div v-for="report in reports" :key="report.id" :class="['card report-card', `report-card--${report.status}`]">
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
              v-model="reviewNotes[report.id]"
              class="form-control"
              placeholder="审核备注（可选）"
              rows="2"
              style="margin-bottom: 8px;"
            ></textarea>
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
              <button class="btn btn-success" style="flex: 1;" @click="reviewReport(report.id, 'approved')">✅ 通过</button>
              <button class="btn btn-danger" style="flex: 1;" @click="reviewReport(report.id, 'rejected')">❌ 拒绝</button>
            </div>
            <div style="margin-bottom: 4px;">
              <textarea
                v-model="needMoreInfoNotes[report.id]"
                class="form-control"
                placeholder="补充要求说明（发给用户）"
                rows="2"
                style="margin-bottom: 6px;"
              ></textarea>
              <button class="btn btn-warning" style="width: 100%;" @click="reviewReport(report.id, 'need_more_info')">🔎 要求补充材料</button>
            </div>
          </div>
          <div v-if="report.status === 'need_more_info'" style="margin-top: 8px; padding: 8px; background: #fff8e1; border-radius: 6px; font-size: 12px;">
            <strong>⏳ 等待用户补充材料</strong>
            <div v-if="report.needMoreInfoNote" style="margin-top: 4px; color: #555;">要求：{{ report.needMoreInfoNote }}</div>
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
import { ref, onMounted, onUnmounted, reactive } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const authStore = useAuthStore()
const loading = ref(true)
const authError = ref('')
const activeTab = ref('config')
const saving = ref(false)
const saveMsg = ref(null)
const reportsLoading = ref(false)
const reports = ref([])
const statusFilter = ref('')
const reviewNotes = reactive({})
const needMoreInfoNotes = reactive({})

// OTP login state
const otpStep = ref('request')   // 'request' | 'pending' | 'expired'
const otpCode = ref('')
const otpId = ref('')
const otpLoading = ref(false)
const otpCountdown = ref(0)
let pollTimer = null
let countdownTimer = null

async function requestOtp() {
  otpLoading.value = true
  authError.value = ''
  try {
    const { data } = await api.post('/auth/otp/request')
    if (!data.success) throw new Error(data.message)
    otpId.value = data.otpId
    otpCode.value = data.code
    otpStep.value = 'pending'
    otpCountdown.value = data.expiresIn || 300
    startPolling()
    startCountdown()
  } catch (e) {
    authError.value = e.response?.data?.message || e.message || '获取验证码失败'
  } finally {
    otpLoading.value = false
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const { data } = await api.get('/auth/otp/status', { params: { otpId: otpId.value } })
      if (data.status === 'verified' && data.token) {
        stopPolling()
        stopCountdown()
        authStore.setToken(data.token)
        await loadConfig()
        await loadReports()
      } else if (data.status === 'expired' || data.status === 'used') {
        stopPolling()
        stopCountdown()
        otpStep.value = 'expired'
      }
    } catch (e) {
      // ignore poll errors (network hiccup, server restart), keep trying
      if (import.meta.env.DEV) console.debug('[OTP poll error]', e?.message)
    }
  }, 2000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

function startCountdown() {
  stopCountdown()
  countdownTimer = setInterval(() => {
    otpCountdown.value -= 1
    if (otpCountdown.value <= 0) {
      stopCountdown()
      stopPolling()
      otpStep.value = 'expired'
    }
  }, 1000)
}

function stopCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
}

function resetOtp() {
  stopPolling()
  stopCountdown()
  otpStep.value = 'request'
  otpCode.value = ''
  otpId.value = ''
  otpCountdown.value = 0
  authError.value = ''
}

const tabs = [
  { key: 'config', label: '⚙️ 配置' },
  { key: 'template', label: '📋 报告模板' },
  { key: 'reports', label: '📝 报告审核' },
]

const statuses = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'need_more_info', label: '待补充' },
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
  reportTemplate: {
    fields: [],
  },
  reviewFeedback: {
    approved: '',
    rejected: '',
    pending: '',
    needMoreInfo: '',
  },
  publishTemplate: '',
})

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
  if (activeTab.value === 'template') {
    const emptyName = config.reportTemplate.fields.find((f) => !f.name.trim())
    if (emptyName) {
      saveMsg.value = { type: 'error', text: '❌ 所有字段必须填写字段名（英文标识）' }
      setTimeout(() => { saveMsg.value = null }, 3000)
      return
    }
    const names = config.reportTemplate.fields.map((f) => f.name.trim())
    const hasDuplicate = names.length !== new Set(names).size
    if (hasDuplicate) {
      saveMsg.value = { type: 'error', text: '❌ 字段名不能重复' }
      setTimeout(() => { saveMsg.value = null }, 3000)
      return
    }
  }
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
    const body = { status, reviewNote: reviewNotes[id] || '' }
    if (status === 'need_more_info') {
      body.needMoreInfoNote = needMoreInfoNotes[id] || ''
    }
    await api.put(`/admin/reports/${id}/review`, body)
    await loadReports()
  } catch (e) {
    alert('操作失败：' + (e.response?.data?.message || e.message))
  }
}

function addStartButton() {
  config.startContent.buttons.push({ text: '', url: '', action: '' })
}
function removeStartButton(i) { config.startContent.buttons.splice(i, 1) }
function addKeyboard() { config.keyboards.push({ text: '', action: 'write_report' }) }
function removeKeyboard(i) { config.keyboards.splice(i, 1) }
function addTemplateField() {
  config.reportTemplate.fields.push({ name: '', label: '', type: 'text', required: false, options: [] })
}
function removeTemplateField(i) { config.reportTemplate.fields.splice(i, 1) }

function statusLabel(s) {
  return { pending: '待审核', approved: '已通过', rejected: '已拒绝', need_more_info: '待补充' }[s] || s
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

onUnmounted(() => {
  stopPolling()
  stopCountdown()
})
</script>

<style scoped>
.loading { text-align: center; padding: 40px; color: var(--tg-theme-hint-color); }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.tab-btn {
  flex: 1; min-width: 80px; padding: 10px 8px; border: none; border-radius: 8px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5); color: var(--tg-theme-text-color, #222);
  cursor: pointer; font-size: 13px; transition: background 0.15s;
}
.tab-btn.active { background: var(--tg-theme-button-color, #1a73e8); color: var(--tg-theme-button-text-color, #fff); }
.tab-btn:hover:not(.active) { opacity: 0.8; }
.tab-content { padding-bottom: 40px; }
.button-row { margin-bottom: 12px; padding: 12px; background: var(--tg-theme-bg-color, #fff); border-radius: 8px; border: 1px solid rgba(0,0,0,0.06); }
.filter-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
.filter-btn {
  padding: 6px 12px; border: 1px solid #ddd; border-radius: 16px;
  background: transparent; cursor: pointer; font-size: 13px; transition: all 0.15s;
}
.filter-btn.active { background: var(--tg-theme-button-color, #1a73e8); color: white; border-color: transparent; }
.filter-btn:hover:not(.active) { background: #f0f0f0; }
.report-card { padding: 14px; margin-bottom: 12px; border-left: 3px solid #ddd; transition: border-color 0.15s; }
.report-card--pending { border-left-color: #ff9800; }
.report-card--approved { border-left-color: #4caf50; }
.report-card--rejected { border-left-color: #f44336; }
.report-card--need_more_info { border-left-color: #ff9800; }
.report-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.review-actions { margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee; }
.tag { display: inline-block; background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 4px; margin-bottom: 4px; }
.template-field-row { margin-bottom: 16px; padding: 12px; background: var(--tg-theme-bg-color, #fff); border-radius: 8px; border: 1px solid rgba(0,0,0,0.08); }
.otp-card { max-width: 420px; margin: 40px auto; text-align: center; }
.otp-card h2 { margin-bottom: 16px; }
.hint { color: #666; font-size: 13px; margin: 12px 0; line-height: 1.6; }
.otp-code {
  font-size: 36px; font-weight: bold; letter-spacing: 10px;
  background: #f5f5f5; border-radius: 12px; padding: 16px 24px;
  margin: 16px auto; color: #1a73e8; font-family: monospace;
  display: inline-block;
}
.poll-status { display: flex; align-items: center; justify-content: center; gap: 8px; color: #888; font-size: 13px; margin-top: 12px; }
.spinner {
  width: 16px; height: 16px; border: 2px solid #ddd;
  border-top-color: #1a73e8; border-radius: 50%;
  animation: spin 0.8s linear infinite; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
.btn-secondary {
  background: #f0f0f0; color: #333; border: none; border-radius: 8px;
  padding: 10px 16px; cursor: pointer; font-size: 14px;
}
.btn-success {
  background: #4caf50; color: #fff; border: none; border-radius: 8px;
  padding: 10px 16px; cursor: pointer; font-size: 14px; font-weight: 500;
}
.btn-warning {
  background: #ff9800; color: #fff; border: none; border-radius: 8px;
  padding: 10px 16px; cursor: pointer; font-size: 14px; font-weight: 500;
}
.btn-success:hover { opacity: 0.85; }
.btn-warning:hover { opacity: 0.85; }
code {
  background: #f5f5f5; padding: 1px 5px; border-radius: 4px;
  font-size: 11px; font-family: monospace; color: #c41a16;
}
@media (max-width: 480px) {
  .tab-btn { padding: 8px 4px; font-size: 12px; }
  .otp-code { font-size: 28px; letter-spacing: 6px; }
}
</style>
