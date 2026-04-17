<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import QRCode from 'qrcode'

const router = useRouter()
const route = useRoute()

const credential = ref<Record<string, unknown> | null>(null)
const qrDataUrl = ref('')
const vpJson = ref('')
const error = ref('')
const mode = ref<'qr' | 'json'>('qr')
const canShare = computed(() => typeof globalThis.navigator !== 'undefined' && 'share' in globalThis.navigator)

onMounted(async () => {
  const credId = route.query.id as string
  if (!credId) {
    error.value = 'No se especifico credencial'
    return
  }

  // Find credential in localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith('attestto-credential-')) continue
    try {
      const cred = JSON.parse(localStorage.getItem(key)!)
      if (cred.id === credId) {
        credential.value = cred
        break
      }
    } catch { /* skip */ }
  }

  if (!credential.value) {
    error.value = 'Credencial no encontrada'
    return
  }

  await generatePresentation()
})

async function generatePresentation() {
  if (!credential.value) return

  try {
    const nonce = globalThis.crypto.randomUUID()
    // Build unsigned VP wrapper — the credential itself is already signed
    const vp = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      holder: (credential.value as Record<string, any>).credentialSubject?.id || 'did:key:anonymous',
      verifiableCredential: [credential.value],
      nonce,
    }

    vpJson.value = JSON.stringify(vp, null, 2)

    // Generate QR from the VP JSON
    const qrPayload = JSON.stringify(vp)
    if (qrPayload.length > 2000) {
      // VP too large for QR — show JSON only
      mode.value = 'json'
      error.value = 'Credencial muy grande para QR — comparte el JSON'
    } else {
      qrDataUrl.value = await QRCode.toDataURL(qrPayload, {
        width: 300,
        margin: 2,
        color: { dark: '#ffffff', light: '#0a0a1a' },
      })
    }
  } catch (err) {
    error.value = `Error generando presentacion: ${err instanceof Error ? err.message : String(err)}`
  }
}

function credentialLabel(): string {
  if (!credential.value) return ''
  const types = Array.isArray(credential.value.type) ? credential.value.type : [credential.value.type]
  const specific = (types as string[]).find(t => t !== 'VerifiableCredential') || types[0]
  return String(specific)
}

async function shareVP() {
  if (!vpJson.value) return
  if (navigator.share) {
    await navigator.share({ title: 'Attestto VP', text: vpJson.value })
  } else {
    await navigator.clipboard.writeText(vpJson.value)
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg flex flex-col">
    <header class="flex items-center gap-3 px-4 py-4 border-b border-white/10">
      <button @click="router.back()" class="text-gray-400 hover:text-white">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-white font-semibold text-lg">Presentar credencial</h1>
    </header>

    <div class="flex-1 flex flex-col items-center justify-center px-6 py-8">
      <!-- Error -->
      <div v-if="error && !qrDataUrl" class="text-center">
        <p class="text-red-400 mb-4">{{ error }}</p>
        <button @click="router.push('/credentials')" class="text-primary hover:underline">
          Volver a credenciales
        </button>
      </div>

      <!-- QR mode -->
      <template v-else-if="qrDataUrl">
        <p class="text-gray-400 text-sm mb-4">{{ credentialLabel() }}</p>
        <img :src="qrDataUrl" alt="VP QR" class="w-72 h-72 rounded-xl mb-4" />
        <p class="text-gray-600 text-xs mb-6 text-center">
          El verificador escanea este QR para recibir tu presentacion verificable.
        </p>

        <!-- Toggle -->
        <div class="flex gap-2 mb-4">
          <button
            @click="mode = 'qr'"
            :class="['px-4 py-2 rounded-lg text-sm font-medium transition-colors', mode === 'qr' ? 'bg-primary text-white' : 'bg-white/5 text-gray-400']"
          >QR</button>
          <button
            @click="mode = 'json'"
            :class="['px-4 py-2 rounded-lg text-sm font-medium transition-colors', mode === 'json' ? 'bg-primary text-white' : 'bg-white/5 text-gray-400']"
          >JSON</button>
        </div>

        <div v-if="mode === 'json'" class="w-full max-w-sm">
          <pre class="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-gray-300 overflow-x-auto max-h-60">{{ vpJson }}</pre>
          <button
            @click="shareVP"
            class="w-full mt-3 bg-white/10 hover:bg-white/15 text-white py-2 rounded-xl text-sm transition-colors"
          >
            {{ canShare ? 'Compartir' : 'Copiar JSON' }}
          </button>
        </div>
      </template>

      <!-- JSON-only mode (VP too large for QR) -->
      <template v-else-if="vpJson">
        <p class="text-gray-400 text-sm mb-4">{{ credentialLabel() }}</p>
        <p class="text-yellow-400 text-xs mb-4">{{ error }}</p>
        <pre class="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-gray-300 overflow-x-auto max-h-80">{{ vpJson }}</pre>
        <button
          @click="shareVP"
          class="w-full mt-4 bg-primary hover:bg-primary/80 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Compartir presentacion
        </button>
      </template>

      <!-- Loading -->
      <template v-else>
        <div class="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p class="text-gray-500 text-sm mt-4">Generando presentacion...</p>
      </template>
    </div>
  </div>
</template>
