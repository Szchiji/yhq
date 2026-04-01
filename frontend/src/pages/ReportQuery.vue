<template>
  <div class="container">
    <h2 style="margin-bottom: 16px;">🔍 查阅报告</h2>

    <div class="card">
      <div class="form-group">
        <label>搜索报告</label>
        <div class="search-row">
          <input
            v-model="query"
            class="form-control"
            placeholder="@用户名 或 #标签 或 关键词"
            @keyup.enter="search"
          />
          <button class="btn btn-primary search-btn" @click="search" :disabled="loading">
            {{ loading ? '...' : '搜索' }}
          </button>
        </div>
      </div>
      <p style="font-size: 12px; color: var(--tg-theme-hint-color);">
        提示：输入 @用户名 搜索用户报告，输入 #标签 搜索标签报告
      </p>
    </div>

    <div v-if="loading" class="loading">搜索中...</div>

    <div v-else-if="searched && results.length === 0" class="card" style="text-align: center;">
      <p style="color: var(--tg-theme-hint-color); padding: 20px 0;">📭 未找到相关报告</p>
    </div>

    <div v-for="report in results" :key="report._id" class="card report-card">
      <div class="report-meta">
        <span style="font-size: 12px; color: var(--tg-theme-hint-color);">No.{{ report.reportNumber }}</span>
        <span style="font-size: 12px; color: var(--tg-theme-hint-color);">{{ formatDate(report.createdAt) }}</span>
      </div>
      <h3 style="margin: 6px 0; font-size: 15px;">{{ report.title || '无标题' }}</h3>
      <p style="font-size: 13px; color: var(--tg-theme-hint-color); margin-bottom: 6px;">
        👤 @{{ report.username || '匿名' }}
      </p>
      <p v-if="report.description" class="report-desc">{{ report.description }}</p>
      <div v-if="report.tags && report.tags.length > 0" style="margin-top: 8px;">
        <span v-for="tag in report.tags" :key="tag" class="tag">#{{ tag }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../api'

const query = ref('')
const results = ref([])
const loading = ref(false)
const searched = ref(false)

async function search() {
  if (!query.value.trim()) return
  loading.value = true
  searched.value = false
  try {
    let type = 'text'
    if (query.value.trim().startsWith('@')) type = 'username'
    else if (query.value.trim().startsWith('#')) type = 'tag'

    const { data } = await api.get('/reports/search', {
      params: { q: query.value.trim(), type },
    })
    results.value = data.data || []
    searched.value = true
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.search-row { display: flex; gap: 8px; }
.search-btn { width: auto; white-space: nowrap; padding: 10px 16px; }
.loading { text-align: center; padding: 40px; color: var(--tg-theme-hint-color); }
.report-card { padding: 14px; }
.report-meta { display: flex; justify-content: space-between; margin-bottom: 4px; }
.report-desc {
  font-size: 13px; margin-top: 8px;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.tag { display: inline-block; background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 4px; margin-top: 4px; }
</style>
