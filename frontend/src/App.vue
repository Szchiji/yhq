<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  // Initialize Telegram Web App
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready()
    window.Telegram.WebApp.expand()
  }
})
</script>

<style>
:root {
  --tg-theme-bg-color: #ffffff;
  --tg-theme-text-color: #000000;
  --tg-theme-button-color: #2481cc;
  --tg-theme-button-text-color: #ffffff;
  --tg-theme-hint-color: #999999;
  --tg-theme-link-color: #2481cc;
  --tg-theme-secondary-bg-color: #f1f1f1;
}

body {
  background-color: var(--tg-theme-bg-color);
  color: var(--tg-theme-text-color);
  min-height: 100vh;
}

.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
}

.card {
  background: var(--tg-theme-secondary-bg-color);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.btn {
  display: inline-block;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  transition: opacity 0.2s;
}

.btn:hover { opacity: 0.85; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary {
  background: var(--tg-theme-button-color);
  color: var(--tg-theme-button-text-color);
  width: 100%;
}

.btn-danger {
  background: #e53935;
  color: white;
}

.btn-success {
  background: #43a047;
  color: white;
}

.btn-warning {
  background: #fb8c00;
  color: white;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: var(--tg-theme-hint-color);
  margin-bottom: 6px;
  font-weight: 500;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background: var(--tg-theme-bg-color);
  color: var(--tg-theme-text-color);
  outline: none;
}

.form-control:focus {
  border-color: var(--tg-theme-button-color);
}

textarea.form-control {
  resize: vertical;
  min-height: 80px;
}

h1, h2, h3 {
  color: var(--tg-theme-text-color);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.badge-pending { background: #fff3e0; color: #e65100; }
.badge-approved { background: #e8f5e9; color: #2e7d32; }
.badge-rejected { background: #ffebee; color: #c62828; }
.badge-need_more_info { background: #fff8e1; color: #f57f17; }

.alert {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.alert-success { background: #e8f5e9; color: #2e7d32; }
.alert-error { background: #ffebee; color: #c62828; }
.alert-info { background: #e3f2fd; color: #1565c0; }
</style>
