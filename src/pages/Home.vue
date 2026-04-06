<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Detect mobile vs desktop
const isMobile = computed(() => {
  if (typeof window === 'undefined') return true
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || window.innerWidth < 768
})

// PWA install prompt
const deferredPrompt = ref<any>(null)
const canInstall = ref(false)

function handleBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  deferredPrompt.value = e
  canInstall.value = true
}

async function installPWA() {
  if (!deferredPrompt.value) return
  deferredPrompt.value.prompt()
  const result = await deferredPrompt.value.userChoice
  if (result.outcome === 'accepted') {
    canInstall.value = false
  }
  deferredPrompt.value = null
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
})
</script>

<template>
  <!-- Desktop: landing page -->
  <div v-if="!isMobile" class="flex flex-col items-center justify-center min-h-screen px-6 py-16">
    <div class="max-w-2xl text-center">
      <!-- Logo -->
      <img src="/logo-icon.jpg" alt="Attestto" class="w-20 h-20 rounded-2xl mx-auto mb-6" />
      <!-- Brand -->
      <h1 class="text-6xl font-bold mb-4">
        <span class="text-white">attest</span><span class="text-accent">to</span>
      </h1>
      <p class="text-gray-400 text-xl mb-12">
        Identidad digital verificable
      </p>

      <!-- How it works -->
      <div class="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8 text-left">
        <h2 class="text-white font-semibold text-lg mb-6 text-center">Como funciona</h2>
        <div class="space-y-6">
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span class="text-primary font-bold">1</span>
            </div>
            <div>
              <h3 class="text-white font-semibold">Descarga la app de escritorio</h3>
              <p class="text-gray-500 text-sm mt-1">La app de escritorio es tu estacion de verificacion. Gestiona tu boveda de credenciales y procesamiento de documentos.</p>
            </div>
          </div>
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span class="text-primary font-bold">2</span>
            </div>
            <div>
              <h3 class="text-white font-semibold">Escanea el codigo QR con tu telefono</h3>
              <p class="text-gray-500 text-sm mt-1">La app de escritorio genera un QR. Escanealo con tu telefono para abrir esta pagina con la camara lista.</p>
            </div>
          </div>
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span class="text-primary font-bold">3</span>
            </div>
            <div>
              <h3 class="text-white font-semibold">Captura tu documento y selfie</h3>
              <p class="text-gray-500 text-sm mt-1">Frente, reverso y selfie con prueba de vida. Todo se envia directo a tu escritorio por WiFi local — nada sale de tu red.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Privacy note -->
      <div class="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 mb-8">
        <div class="flex items-center gap-3 mb-2">
          <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 class="text-emerald-400 font-semibold">Privacidad por diseno</h3>
        </div>
        <p class="text-gray-400 text-sm">
          Tus imagenes y datos nunca salen de tu red local. La conexion es directa entre tu telefono y tu computadora — sin servidores, sin nube, sin terceros.
        </p>
      </div>

      <!-- CTA -->
      <a
        href="https://attestto.com"
        class="inline-block bg-primary hover:bg-primary/80 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
      >
        Conoce mas en attestto.com
      </a>
    </div>

    <p class="mt-auto pt-12 text-gray-600 text-xs">
      mobile.attestto.com
    </p>
  </div>

  <!-- Mobile: app UI -->
  <div v-else class="flex flex-col items-center justify-center min-h-screen px-6 py-12">
    <!-- Logo + Brand -->
    <img src="/logo-icon.jpg" alt="Attestto" class="w-16 h-16 rounded-xl mb-4" />
    <div class="mb-4">
      <h1 class="text-5xl font-bold">
        <span class="text-white">attest</span><span class="text-accent">to</span>
      </h1>
    </div>

    <p class="text-gray-400 text-lg mb-10 text-center">
      Tu billetera de identidad digital
    </p>

    <!-- Install PWA button -->
    <button
      v-if="canInstall"
      @click="installPWA"
      class="w-full max-w-xs bg-primary hover:bg-primary/80 text-white font-semibold py-3 px-6 rounded-xl mb-8 transition-colors"
    >
      Instalar Attestto
    </button>

    <!-- Action cards -->
    <div class="w-full max-w-sm space-y-4">
      <button
        @click="router.push('/capture')"
        class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-left hover:bg-white/10 transition-colors"
      >
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 class="text-white font-semibold text-lg">Verificar identidad</h3>
            <p class="text-gray-500 text-sm">Captura y verifica tu identidad</p>
          </div>
        </div>
      </button>

      <!-- Credentials: hidden until we have VC display built
      <button
        @click="router.push('/credentials')"
        class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-left hover:bg-white/10 transition-colors"
      >
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
            <svg class="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
            </svg>
          </div>
          <div>
            <h3 class="text-white font-semibold text-lg">Mis credenciales</h3>
            <p class="text-gray-500 text-sm">Ver credenciales almacenadas</p>
          </div>
        </div>
      </button>
      -->

    <!-- Footer -->
    <p class="mt-auto pt-12 text-gray-600 text-xs">
      mobile.attestto.com
    </p>
  </div>
</template>
