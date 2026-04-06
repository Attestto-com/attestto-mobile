<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const hasSession = ref(false)

onMounted(() => {
  const wsUrl = (route.query.ws as string) || null
  if (wsUrl) {
    hasSession.value = true
    initCapture(wsUrl)
  }
})

onBeforeUnmount(() => {
  // Cleanup cameras
  const streams = (window as any).__captureStreams
  if (streams) {
    Object.values(streams).forEach((s: any) => s?.getTracks().forEach((t: any) => t.stop()))
  }
})

function initCapture(wsUrl: string) {
  // All capture logic runs in vanilla JS on the mounted DOM
  // This keeps the port 1:1 with capture-server.ts embedded HTML
  const w = window as any
  w.__captureStreams = {}

  const $ = (id: string) => document.getElementById(id)
  const streams: Record<string, MediaStream> = w.__captureStreams
  const captures: Record<string, string> = {}
  let ws: WebSocket | null = null
  // @ts-ignore — currentStep is read inside ws.onmessage handler
  let currentStep = ''
  let previewStep = ''
  let livenessStart = 0, blinkCount = 0, faceOk = false
  let lastEyeB: number | null = null, blinkCD = false, dLoop: number | null = null

  function setStatus(t: string, c?: string) {
    const el = $('status')
    if (el) { el.textContent = t; el.className = 'status-bar' + (c ? ' status-bar--' + c : '') }
  }

  function show(name: string) {
    ['s-connecting','s-front','s-back','s-selfie','s-preview','s-done'].forEach(id => $(id)?.classList.add('hidden'))
    $('s-' + name)?.classList.remove('hidden')
    if (name !== 'preview') updateTabs(name)
  }

  function updateTabs(step: string) {
    const steps = ['front','back','selfie']
    const idx = steps.indexOf(step)
    steps.forEach((s, i) => {
      const tab = $('tab-' + s)
      if (!tab) return
      tab.className = 'tab'
      if (i < idx) tab.classList.add('tab--completed')
      else if (i === idx) tab.classList.add('tab--active')
    })
    const pct = step === 'done' ? 100 : Math.round((idx / 3) * 100)
    const pbar = $('pbar')
    if (pbar) pbar.style.width = pct + '%'
  }

  async function openCamera(side: string) {
    const facing = side === 'selfie' ? 'user' : 'environment'
    const res = side === 'selfie'
      ? { width: { ideal: 720 }, height: { ideal: 1280 } }
      : { width: { ideal: 1920 }, height: { ideal: 1080 } }
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no mediaDevices')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, ...res } as any, audio: false })
      streams[side] = stream
      const vid = $('vid-' + side) as HTMLVideoElement
      vid.srcObject = stream
      await vid.play()
      const btn = $('btn-' + side) as HTMLButtonElement
      if (btn) btn.disabled = false
      if (side === 'selfie') {
        livenessStart = Date.now()
        blinkCount = 0; faceOk = false; lastEyeB = null
        startLiveness()
      } else {
        const g = $('g-' + side)
        if (g) { g.textContent = 'Documento detectado'; g.className = 'guidance guidance--stable' }
        const hint = $('hint-' + side)
        if (hint) hint.style.display = ''
      }
    } catch {
      showFileInput(side)
    }
  }

  function showFileInput(side: string) {
    const facing = side === 'selfie' ? 'user' : 'environment'
    const vid = $('vid-' + side)
    const viewfinder = vid?.parentElement
    if (!viewfinder) return
    viewfinder.classList.add('viewfinder--file')
    if (vid) vid.style.display = 'none'
    const btnRow = $('btn-' + side)?.parentElement
    if (btnRow) btnRow.style.display = 'none'
    const g = $('g-' + side)
    if (g) {
      g.textContent = side === 'selfie' ? 'Toca para tomar selfie' : 'Toca para tomar foto'
      g.className = 'guidance guidance--stable'
    }
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = facing
    input.id = 'file-' + side
    input.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer;z-index:10;'
    viewfinder.appendChild(input)
    const label = document.createElement('div')
    label.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:5;pointer-events:none;'
    label.innerHTML = '<div style="font-size:2.5rem;margin-bottom:8px;">📷</div><div style="font-size:0.85rem;font-weight:600;color:white;">' +
      (side === 'selfie' ? 'Tomar selfie' : 'Fotografiar documento') + '</div>'
    label.id = 'file-label-' + side
    viewfinder.appendChild(label)
    input.onchange = (e: any) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev: any) => {
        const img = new Image()
        img.onload = () => {
          const maxW = 1920
          const scale = img.width > maxW ? maxW / img.width : 1
          const c = document.createElement('canvas')
          c.width = img.width * scale
          c.height = img.height * scale
          c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
          captures[side] = c.toDataURL('image/jpeg', 0.85)
          if (side === 'selfie') { faceOk = true; blinkCount = 1; livenessStart = livenessStart || Date.now() }
          showPreview(side)
        }
        img.src = ev.target.result
      }
      reader.readAsDataURL(file)
    }
  }

  function closeCamera(side: string) {
    if (dLoop) { cancelAnimationFrame(dLoop); dLoop = null }
    if (streams[side]) { streams[side].getTracks().forEach(t => t.stop()); delete streams[side] }
  }

  function captureDoc(side: string) {
    const vid = $('vid-' + side) as HTMLVideoElement
    const c = document.createElement('canvas')
    c.width = vid.videoWidth; c.height = vid.videoHeight
    c.getContext('2d')!.drawImage(vid, 0, 0)
    captures[side] = c.toDataURL('image/jpeg', 0.85)
    closeCamera(side)
    showPreview(side)
  }

  function captureSelfie() {
    const vid = $('vid-selfie') as HTMLVideoElement
    const c = document.createElement('canvas')
    c.width = vid.videoWidth; c.height = vid.videoHeight
    const ctx = c.getContext('2d')!
    ctx.translate(c.width, 0); ctx.scale(-1, 1)
    ctx.drawImage(vid, 0, 0)
    captures.selfie = c.toDataURL('image/jpeg', 0.85)
    closeCamera('selfie')
    showPreview('selfie')
  }

  function startLiveness() {
    const vid = $('vid-selfie') as HTMLVideoElement
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')!
    function loop() {
      if (!streams.selfie) return
      if (vid.readyState < 2) { dLoop = requestAnimationFrame(loop); return }
      const w2 = vid.videoWidth, h = vid.videoHeight
      c.width = w2; c.height = h
      ctx.drawImage(vid, 0, 0, w2, h)
      const oL = w2*0.2|0, oR = w2*0.8|0, oT = h*0.1|0, oB = h*0.75|0, oW = oR-oL, oH = oB-oT
      const d = ctx.getImageData(oL, oT, oW, oH).data
      let skin = 0, tot = 0
      for (let i = 0; i < d.length; i += 16) { tot++; const r = d[i], g2 = d[i+1], b = d[i+2]; if (r > 60 && g2 > 40 && b > 20 && r > g2 && r > b) skin++ }
      const hasFace = skin / tot > 0.12
      const eT = oT + oH*0.28|0, eB2 = oT + oH*0.42|0, eL = oL + oW*0.15|0, eR2 = oL + oW*0.85|0
      const ed = ctx.getImageData(eL, eT, eR2-eL, eB2-eT).data
      let eyeB = 0, eC = 0
      for (let i = 0; i < ed.length; i += 12) { eyeB += (ed[i] + ed[i+1] + ed[i+2]) / 3; eC++ }
      const eb = eC > 0 ? eyeB / eC : 0
      if (lastEyeB !== null && hasFace && !blinkCD) {
        if ((lastEyeB - eb) / lastEyeB > 0.15) {
          blinkCount++; blinkCD = true
          showBlinkToast()
          setTimeout(() => { blinkCD = false }, 500)
        }
      }
      lastEyeB = eb; faceOk = hasFace
      const oval = $('foval'), g3 = $('g-selfie'), btn = $('btn-selfie') as HTMLButtonElement, ind = $('face-ind')
      if (!hasFace) {
        if (oval) oval.className = 'face-oval'
        if (g3) { g3.textContent = 'Posiciona tu rostro en el ovalo'; g3.className = 'guidance guidance--searching' }
        if (ind) { ind.className = 'face-indicator face-indicator--no'; ind.innerHTML = '&#x2716;' }
        if (btn) btn.disabled = true
      } else if (blinkCount === 0) {
        if (oval) oval.className = 'face-oval face-oval--detected'
        if (g3) { g3.textContent = 'Rostro detectado — parpadea'; g3.className = 'guidance guidance--detected' }
        if (ind) { ind.className = 'face-indicator face-indicator--ok'; ind.innerHTML = '&#x2714;' }
        if (btn) btn.disabled = true
      } else {
        if (oval) oval.className = 'face-oval face-oval--detected'
        if (g3) { g3.textContent = 'Listo — captura tu selfie'; g3.className = 'guidance guidance--stable' }
        if (ind) { ind.className = 'face-indicator face-indicator--ok'; ind.innerHTML = '&#x2714;' }
        if (btn) btn.disabled = false
      }
      dLoop = requestAnimationFrame(loop)
    }
    dLoop = requestAnimationFrame(loop)
  }

  function showBlinkToast() {
    const old = document.querySelector('.blink-toast')
    if (old) old.remove()
    const toast = document.createElement('div')
    toast.className = 'blink-toast'
    toast.textContent = 'Parpadeo detectado (' + blinkCount + ')'
    document.querySelector('.viewfinder--portrait')?.appendChild(toast)
    setTimeout(() => toast.remove(), 1200)
  }

  function showPreview(side: string) {
    previewStep = side
    const titles: Record<string, string> = { front: 'Frente capturado', back: 'Reverso capturado', selfie: 'Selfie capturado' }
    const pt = $('preview-title')
    if (pt) pt.textContent = titles[side] || 'Vista previa'
    const pi = $('preview-img') as HTMLImageElement
    if (pi) pi.src = captures[side]
    show('preview')
  }

  function confirmCapture() {
    const side = previewStep
    const payload: any = { type: side + '-captured', image: captures[side] }
    if (side === 'selfie') {
      payload.liveness = { faceDetected: faceOk, blinkCount, durationMs: Date.now() - livenessStart }
    }
    setStatus('Enviando...', 'ok')
    ws?.send(JSON.stringify(payload))
  }

  function retakeCapture() {
    delete captures[previewStep]
    const oldInput = $('file-' + previewStep)
    if (oldInput) oldInput.remove()
    const oldLabel = $('file-label-' + previewStep)
    if (oldLabel) oldLabel.remove()
    show(previewStep)
    openCamera(previewStep)
  }

  // Expose to onclick handlers in template
  w.__capture = { captureDoc, captureSelfie, confirmCapture, retakeCapture }

  // Connect WebSocket
  ws = new WebSocket(wsUrl)
  ws.onopen = () => setStatus('Conectado', 'ok')
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    if (msg.type === 'connected') { currentStep = 'front'; show('front'); openCamera('front') }
    else if (msg.type === 'front-received') { currentStep = 'back'; show('back'); openCamera('back') }
    else if (msg.type === 'back-received') { currentStep = 'selfie'; show('selfie'); openCamera('selfie') }
    else if (msg.type === 'complete') {
      Object.keys(streams).forEach(closeCamera)
      show('done')
      updateTabs('done')
      const pbar = $('pbar')
      if (pbar) pbar.style.width = '100%'
    }
  }
  ws.onclose = () => setStatus('Desconectado', 'err')
  ws.onerror = () => setStatus('Error de conexion', 'err')
}
</script>

<template>
  <!-- No session: show explainer -->
  <div v-if="!hasSession" class="capture-page" style="justify-content: center; align-items: center; padding: 2rem;">
    <img src="/logo-icon.jpg" alt="Attestto" style="width:64px;height:64px;border-radius:12px;margin-bottom:24px;" />
    <h1 style="font-size:2rem;font-weight:700;margin-bottom:8px;">
      <span style="color:white;">attest</span><span style="color:#00D994;">to</span>
    </h1>
    <p style="color:#a0a0a0;font-size:0.95rem;margin-bottom:32px;text-align:center;">
      Verificacion de identidad
    </p>

    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;max-width:360px;width:100%;text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:12px;">📱 ↔ 💻</div>
      <h2 style="color:white;font-size:1.1rem;font-weight:600;margin-bottom:8px;">Conecta con tu escritorio</h2>
      <p style="color:#a0a0a0;font-size:0.85rem;line-height:1.5;margin-bottom:16px;">
        Para verificar tu identidad, abre la app de escritorio Attestto y escanea el codigo QR que aparece en pantalla.
      </p>
      <div style="display:flex;flex-direction:column;gap:12px;text-align:left;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="color:#6366f1;font-weight:700;font-size:0.85rem;">1</span>
          </div>
          <span style="color:#d1d5db;font-size:0.85rem;">Abre Attestto en tu computadora</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="color:#6366f1;font-weight:700;font-size:0.85rem;">2</span>
          </div>
          <span style="color:#d1d5db;font-size:0.85rem;">Selecciona "Verificar identidad"</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="color:#6366f1;font-weight:700;font-size:0.85rem;">3</span>
          </div>
          <span style="color:#d1d5db;font-size:0.85rem;">Escanea el QR con este telefono</span>
        </div>
      </div>
    </div>

    <div style="margin-top:24px;padding:16px;border:1px solid rgba(34,197,94,0.2);border-radius:12px;background:rgba(34,197,94,0.05);max-width:360px;width:100%;text-align:center;">
      <p style="color:#a0a0a0;font-size:0.75rem;">
        🔒 Tus fotos se envian directo a tu computadora por WiFi local. Nada sale de tu red.
      </p>
    </div>

    <router-link to="/" style="margin-top:24px;color:#6366f1;font-size:0.85rem;text-decoration:none;">
      ← Volver al inicio
    </router-link>
  </div>

  <!-- Active session: capture UI -->
  <div v-else class="capture-page">
    <!-- Brand header -->
    <div class="brand">
      <span class="brand-name"><span class="brand-attest">attest</span><span class="brand-to">to</span></span>
    </div>

    <!-- Tab navigation -->
    <div class="tabs" id="tabs">
      <button class="tab tab--active" id="tab-front">
        <span class="tab-icon">&#x1F4C4;</span>Frente
      </button>
      <button class="tab" id="tab-back">
        <span class="tab-icon">&#x1F504;</span>Reverso
      </button>
      <button class="tab" id="tab-selfie">
        <span class="tab-icon">&#x1F464;</span>Selfie
      </button>
    </div>

    <!-- Progress bar -->
    <div class="progress-bar"><div class="progress-fill" id="pbar" style="width:0%"></div></div>

    <div class="content">
      <!-- Connecting -->
      <div id="s-connecting">
        <div class="spinner"></div>
        <p class="step-sub">Conectando con el escritorio...</p>
        <p v-if="!$route.query.ws" class="step-sub" style="margin-top:16px;color:#ef4444;">
          Escanea el codigo QR desde la app de escritorio para iniciar.
        </p>
      </div>

      <!-- Step 1: Front -->
      <div id="s-front" class="hidden">
        <div class="step-title">Frente del documento</div>
        <div class="step-sub">Centra tu cedula dentro del marco</div>
        <div class="viewfinder viewfinder--landscape">
          <video id="vid-front" autoplay playsinline muted></video>
          <div class="card-frame">
            <div class="corner corner--tl"></div><div class="corner corner--tr"></div>
            <div class="corner corner--bl"></div><div class="corner corner--br"></div>
          </div>
          <div class="guidance guidance--searching" id="g-front">Iniciando camara...</div>
          <div class="quality-badge hidden" id="q-front"></div>
          <div class="tap-hint" id="hint-front">Toca el boton para capturar</div>
        </div>
        <div class="capture-btn-row">
          <button class="capture-btn" id="btn-front" onclick="window.__capture.captureDoc('front')" disabled><div class="inner"></div></button>
        </div>
      </div>

      <!-- Step 2: Back -->
      <div id="s-back" class="hidden">
        <div class="step-title">Reverso del documento</div>
        <div class="step-sub">Asegurate que el MRZ se vea claro</div>
        <div class="viewfinder viewfinder--landscape">
          <video id="vid-back" autoplay playsinline muted></video>
          <div class="card-frame">
            <div class="corner corner--tl"></div><div class="corner corner--tr"></div>
            <div class="corner corner--bl"></div><div class="corner corner--br"></div>
          </div>
          <div class="guidance guidance--searching" id="g-back">Iniciando camara...</div>
          <div class="quality-badge hidden" id="q-back"></div>
          <div class="tap-hint" id="hint-back">Toca el boton para capturar</div>
        </div>
        <div class="capture-btn-row">
          <button class="capture-btn" id="btn-back" onclick="window.__capture.captureDoc('back')" disabled><div class="inner"></div></button>
        </div>
      </div>

      <!-- Step 3: Selfie -->
      <div id="s-selfie" class="hidden">
        <div class="step-title">Selfie con prueba de vida</div>
        <div class="step-sub">Posiciona tu rostro y parpadea</div>
        <div class="viewfinder viewfinder--portrait">
          <video id="vid-selfie" autoplay playsinline muted class="mirror"></video>
          <div class="face-oval" id="foval"></div>
          <div class="face-indicator face-indicator--no" id="face-ind">&#x2716;</div>
          <div class="guidance guidance--searching" id="g-selfie">Iniciando camara...</div>
        </div>
        <div class="capture-btn-row">
          <button class="capture-btn capture-btn--selfie" id="btn-selfie" onclick="window.__capture.captureSelfie()" disabled><div class="inner"></div></button>
        </div>
      </div>

      <!-- Preview -->
      <div id="s-preview" class="hidden">
        <div class="preview-wrap">
          <div class="step-title" id="preview-title">Vista previa</div>
          <img id="preview-img" class="preview-img" />
          <div class="btn-row">
            <button class="btn-primary" id="btn-confirm" onclick="window.__capture.confirmCapture()">Confirmar</button>
            <button class="btn-secondary" onclick="window.__capture.retakeCapture()">Repetir</button>
          </div>
        </div>
      </div>

      <!-- Done -->
      <div id="s-done" class="hidden">
        <div class="done-screen">
          <div class="done-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <div class="done-title">Verificacion completada</div>
          <p class="done-sub">Las capturas se enviaron a tu escritorio.</p>
          <div class="pwa-box">
            <h3>Attestto Wallet</h3>
            <p>Tu billetera de identidad digital.</p>
            <router-link to="/" class="pwa-link">Ir a Attestto</router-link>
          </div>
        </div>
      </div>
    </div>

    <div class="status-bar" id="status">Desconectado</div>
  </div>
</template>

<style>
/* All styles from capture-server.ts embedded HTML */
.capture-page {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e; color: white;
  min-height: 100vh; min-height: 100dvh;
  display: flex; flex-direction: column;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}
.brand { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; }
.brand-name { font-size: 1.125rem; font-weight: 700; letter-spacing: -0.025em; }
.brand-attest { color: white; }
.brand-to { color: #00D994; }
.tabs { display: flex; gap: 8px; padding: 12px 16px 0; flex-shrink: 0; }
.tab { flex: 1; padding: 10px 6px; border: 2px solid #4a4a6a; border-radius: 12px; background: transparent; color: #a0a0a0; font-size: 0.7rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 4px; -webkit-tap-highlight-color: transparent; }
.tab-icon { font-size: 1.1rem; }
.tab--active { border-color: #6366f1; color: white; background: rgba(99,102,241,0.1); }
.tab--completed { border-color: #22c55e; color: #22c55e; }
.progress-bar { height: 4px; background: #4a4a6a; margin: 12px 16px 0; border-radius: 2px; overflow: hidden; flex-shrink: 0; }
.progress-fill { height: 100%; background: #6366f1; transition: width 0.4s ease; border-radius: 2px; }
.content { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 12px 12px 0; overflow: hidden; }
.step-title { font-size: 0.95rem; font-weight: 700; color: white; margin-bottom: 2px; text-align: center; }
.step-sub { font-size: 0.75rem; color: #a0a0a0; text-align: center; margin-bottom: 8px; }
.viewfinder { position: relative; width: 100%; max-width: 400px; border-radius: 20px; overflow: hidden; background: #000; margin: 0 auto; }
.viewfinder--landscape { aspect-ratio: 4/3; }
.viewfinder--portrait { aspect-ratio: 3/4; }
.viewfinder video { width: 100%; height: 100%; object-fit: cover; }
.viewfinder video.mirror { transform: scaleX(-1); }
.card-frame { position: absolute; top: 12%; left: 5%; right: 5%; bottom: 12%; border: 2px solid rgba(255,255,255,0.15); border-radius: 12px; pointer-events: none; }
.card-frame .corner { position: absolute; width: 20px; height: 20px; border-color: #22c55e; border-style: solid; }
.corner--tl { top: -2px; left: -2px; border-width: 4px 0 0 4px; border-radius: 8px 0 0 0; }
.corner--tr { top: -2px; right: -2px; border-width: 4px 4px 0 0; border-radius: 0 8px 0 0; }
.corner--bl { bottom: -2px; left: -2px; border-width: 0 0 4px 4px; border-radius: 0 0 0 8px; }
.corner--br { bottom: -2px; right: -2px; border-width: 0 4px 4px 0; border-radius: 0 0 8px 0; }
.guidance { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); padding: 6px 16px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; color: white; white-space: nowrap; z-index: 3; pointer-events: none; transition: background-color 0.3s; }
.guidance--searching { background: rgba(245,158,11,0.85); animation: guidance-pulse 2s ease-in-out infinite; }
.guidance--detecting { background: rgba(59,130,246,0.85); }
.guidance--detected { background: rgba(59,130,246,0.95); box-shadow: 0 0 12px rgba(59,130,246,0.4); }
.guidance--stable { background: rgba(34,197,94,0.9); box-shadow: 0 0 16px rgba(34,197,94,0.5); }
@keyframes guidance-pulse { 0%,100%{opacity:0.85}50%{opacity:1} }
.quality-badge { position: absolute; bottom: 12px; right: 12px; padding: 4px 10px; border-radius: 12px; font-size: 0.65rem; font-weight: 700; color: white; pointer-events: none; z-index: 3; text-transform: uppercase; letter-spacing: 0.05em; }
.face-oval { position: absolute; top: 8%; left: 18%; right: 18%; bottom: 18%; border: 3px solid rgba(255,255,255,0.3); border-radius: 50%; pointer-events: none; transition: border-color 0.3s, box-shadow 0.3s; }
.face-oval--detected { border-color: rgba(34,197,94,0.7); box-shadow: 0 0 20px rgba(34,197,94,0.3); }
.face-indicator { position: absolute; top: 16px; right: 16px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; z-index: 3; pointer-events: none; }
.face-indicator--ok { background: rgba(34,197,94,0.85); color: white; }
.face-indicator--no { background: rgba(239,68,68,0.85); color: white; }
.blink-toast { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); padding: 6px 16px; background: rgba(34,197,94,0.85); color: white; font-size: 0.75rem; font-weight: 600; border-radius: 20px; pointer-events: none; z-index: 3; white-space: nowrap; animation: blink-toast-fade 1.2s ease-out forwards; }
@keyframes blink-toast-fade { 0%{opacity:1}70%{opacity:1}100%{opacity:0} }
.tap-hint { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); padding: 6px 16px; background: rgba(0,0,0,0.6); color: rgba(255,255,255,0.9); font-size: 0.75rem; border-radius: 20px; pointer-events: none; white-space: nowrap; }
.capture-btn-row { display: flex; justify-content: center; padding: 10px 0; flex-shrink: 0; }
.capture-btn { width: 68px; height: 68px; border-radius: 50%; border: 4px solid white; background: transparent; cursor: pointer; position: relative; transition: transform 0.15s; -webkit-tap-highlight-color: transparent; }
.capture-btn:active { transform: scale(0.88); }
.capture-btn:disabled { opacity: 0.25; pointer-events: none; }
.capture-btn .inner { width: 52px; height: 52px; border-radius: 50%; background: white; position: absolute; top: 4px; left: 4px; transition: background 0.2s; }
.capture-btn--selfie .inner { background: #6366f1; }
.preview-wrap { text-align: center; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 12px; }
.preview-img { max-width: 340px; width: 100%; border-radius: 20px; border: 2px solid #6366f1; margin-top: 8px; }
.btn-row { display: flex; gap: 10px; margin-top: 16px; width: 100%; max-width: 340px; }
.btn-primary { flex: 1; background: #6366f1; color: white; border: none; padding: 16px; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; }
.btn-primary:hover { background: #4f46e5; }
.btn-secondary { background: #374151; color: white; border: none; padding: 16px 20px; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; }
.status-bar { padding: 6px; font-size: 0.65rem; color: #4a4a6a; text-align: center; flex-shrink: 0; }
.status-bar--ok { color: #22c55e; }
.status-bar--err { color: #ef4444; }
.done-screen { text-align: center; padding: 3rem 1.5rem; }
.done-icon { width: 80px; height: 80px; margin: 0 auto 20px; background: rgba(34,197,94,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.done-icon svg { width: 48px; height: 48px; color: #22c55e; }
.done-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; }
.done-sub { font-size: 0.85rem; color: #a0a0a0; margin-bottom: 24px; }
.pwa-box { padding: 20px; border: 1px solid rgba(99,102,241,0.3); border-radius: 16px; background: rgba(99,102,241,0.05); }
.pwa-box h3 { color: #6366f1; font-size: 1rem; font-weight: 700; }
.pwa-box p { font-size: 0.8rem; color: #a0a0a0; margin-top: 6px; }
.pwa-link { display: block; text-align: center; text-decoration: none; background: #22c55e; color: white; padding: 14px; border-radius: 12px; font-weight: 600; font-size: 1rem; margin-top: 12px; }
.spinner { width: 40px; height: 40px; border: 4px solid #4a4a6a; border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite; margin: 3rem auto 16px; }
@keyframes spin { to { transform: rotate(360deg); } }
.viewfinder--file { display: flex; align-items: center; justify-content: center; background: rgba(99,102,241,0.05); border: 2px dashed #4a4a6a; }
.hidden { display: none !important; }
</style>
