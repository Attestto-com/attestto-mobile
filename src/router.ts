import { createRouter, createWebHistory } from 'vue-router'
import Home from './pages/Home.vue'
import Capture from './pages/Capture.vue'
import Credentials from './pages/Credentials.vue'
import Present from './pages/Present.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/capture', component: Capture },
  { path: '/credentials', component: Credentials },
  { path: '/present', component: Present },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Handle GitHub Pages SPA redirect
const redirect = new URLSearchParams(window.location.search).get('redirect')
if (redirect) {
  history.replaceState(null, '', redirect)
  router.replace(redirect)
}
