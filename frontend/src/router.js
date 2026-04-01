import { createRouter, createWebHistory } from 'vue-router'
import AdminDashboard from './pages/AdminDashboard.vue'
import ReportForm from './pages/ReportForm.vue'
import ReportQuery from './pages/ReportQuery.vue'

const routes = [
  { path: '/admin', component: AdminDashboard },
  { path: '/report', component: ReportForm },
  { path: '/query', component: ReportQuery },
  { path: '/', redirect: '/query' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
