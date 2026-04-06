<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-bg flex flex-col">
    <!-- Header -->
    <header class="flex items-center gap-3 px-4 py-4 border-b border-white/10">
      <button @click="router.push('/')" class="text-gray-400 hover:text-white">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-white font-semibold text-lg">Mis credenciales</h1>
    </header>

    <!-- Empty state -->
    <div class="flex-1 flex flex-col items-center justify-center px-6">
      <div class="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <svg class="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <p class="text-gray-400 text-lg font-medium">Sin credenciales</p>
      <p class="text-gray-600 text-sm mt-1 text-center">
        Las credenciales verificadas apareceran aqui.
      </p>
    </div>
  </div>
</template>
