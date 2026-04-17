<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

interface StoredCredential {
  id: string
  type: string | string[]
  issuer: string | { id: string; name?: string }
  issuanceDate: string
  expirationDate?: string
  credentialSubject?: Record<string, unknown>
  trustLevel?: string
}

const credentials = ref<StoredCredential[]>([])
const selected = ref<StoredCredential | null>(null)

onMounted(() => {
  loadCredentials()
})

function loadCredentials() {
  const stored: StoredCredential[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith('attestto-credential-')) continue
    try {
      stored.push(JSON.parse(localStorage.getItem(key)!) as StoredCredential)
    } catch { /* skip invalid */ }
  }
  stored.sort((a, b) => new Date(b.issuanceDate).getTime() - new Date(a.issuanceDate).getTime())
  credentials.value = stored
}

function credentialLabel(c: StoredCredential): string {
  const types = Array.isArray(c.type) ? c.type : [c.type]
  const specific = types.find(t => t !== 'VerifiableCredential') || types[0]
  const labels: Record<string, string> = {
    CedulaIdentidadCR: 'Cedula de identidad',
    DrivingLicenseCR: 'Licencia de conducir',
    PassportCR: 'Pasaporte',
    IdentityVC: 'Identidad verificada',
    DocumentSignatureVC: 'Firma de documento',
    DrivingTheoryExamCR: 'Examen teorico',
    DrivingCompetencyCR: 'Competencia de conduccion',
  }
  return labels[specific] || specific
}

function issuerName(c: StoredCredential): string {
  if (typeof c.issuer === 'string') return truncateDid(c.issuer)
  return c.issuer.name || truncateDid(c.issuer.id)
}

function truncateDid(did: string): string {
  if (did.length <= 30) return did
  return did.slice(0, 16) + '...' + did.slice(-8)
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function isExpired(c: StoredCredential): boolean {
  if (!c.expirationDate) return false
  return new Date(c.expirationDate) < new Date()
}

const trustColor: Record<string, string> = {
  'A+': 'bg-emerald-500', A: 'bg-emerald-500', B: 'bg-blue-500', C: 'bg-yellow-500', D: 'bg-gray-500',
}
</script>

<template>
  <div class="min-h-screen bg-bg flex flex-col">
    <header class="flex items-center gap-3 px-4 py-4 border-b border-white/10">
      <button @click="router.push('/')" class="text-gray-400 hover:text-white">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-white font-semibold text-lg">Mis credenciales</h1>
    </header>

    <!-- Credential list -->
    <div v-if="credentials.length" class="flex-1 px-4 py-4 space-y-3">
      <button
        v-for="cred in credentials"
        :key="cred.id"
        @click="selected = cred"
        class="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:bg-white/10 transition-colors"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-white font-medium">{{ credentialLabel(cred) }}</p>
            <p class="text-gray-500 text-xs mt-0.5">{{ issuerName(cred) }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span
              v-if="cred.trustLevel"
              :class="[trustColor[cred.trustLevel] || 'bg-gray-500', 'text-white text-xs font-bold px-2 py-0.5 rounded']"
            >
              {{ cred.trustLevel }}
            </span>
            <span v-if="isExpired(cred)" class="text-red-400 text-xs">Vencida</span>
          </div>
        </div>
        <p class="text-gray-600 text-xs mt-2">{{ formatDate(cred.issuanceDate) }}</p>
      </button>
    </div>

    <!-- Empty state -->
    <div v-else class="flex-1 flex flex-col items-center justify-center px-6">
      <div class="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <svg class="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <p class="text-gray-400 text-lg font-medium">Sin credenciales</p>
      <p class="text-gray-600 text-sm mt-1 text-center">
        Verifica tu identidad desde la app o recibe credenciales escaneando un QR.
      </p>
    </div>

    <!-- Detail drawer -->
    <div v-if="selected" class="fixed inset-0 bg-black/80 z-50 flex flex-col justify-end" @click.self="selected = null">
      <div class="bg-[#1a1a2e] rounded-t-2xl max-h-[80vh] overflow-y-auto p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-white font-semibold text-lg">{{ credentialLabel(selected) }}</h2>
          <button @click="selected = null" class="text-gray-400 hover:text-white">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-3 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">Emisor</span>
            <span class="text-gray-300">{{ issuerName(selected) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">Emitido</span>
            <span class="text-gray-300">{{ formatDate(selected.issuanceDate) }}</span>
          </div>
          <div v-if="selected.expirationDate" class="flex justify-between">
            <span class="text-gray-500">Vence</span>
            <span :class="isExpired(selected) ? 'text-red-400' : 'text-gray-300'">{{ formatDate(selected.expirationDate) }}</span>
          </div>
          <div v-if="selected.trustLevel" class="flex justify-between">
            <span class="text-gray-500">Nivel de confianza</span>
            <span :class="[trustColor[selected.trustLevel] || 'bg-gray-500', 'text-white text-xs font-bold px-2 py-0.5 rounded']">{{ selected.trustLevel }}</span>
          </div>

          <!-- Subject fields -->
          <div v-if="selected.credentialSubject" class="pt-3 border-t border-white/10">
            <p class="text-gray-500 mb-2">Datos</p>
            <div v-for="(val, key) in selected.credentialSubject" :key="String(key)" class="flex justify-between py-1">
              <span class="text-gray-500 capitalize">{{ String(key).replace(/([A-Z])/g, ' $1').trim() }}</span>
              <span class="text-gray-300 text-right max-w-[60%] truncate">{{ val }}</span>
            </div>
          </div>
        </div>

        <!-- Present button -->
        <button
          @click="router.push({ path: '/present', query: { id: selected.id } }); selected = null"
          class="w-full mt-6 bg-primary hover:bg-primary/80 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Presentar credencial
        </button>
      </div>
    </div>
  </div>
</template>
