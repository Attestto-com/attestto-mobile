// Lazy loader + thin wrapper around jscanify (OpenCV.js) for in-page document
// auto-detection. OpenCV.js is 8.6MB, so it is injected via <script> only when a
// capture session actually starts, never bundled and never precached.
//
// Both libs are self-hosted under /vendor (see public/vendor) so the capture
// flow stays local-first and works without a CDN round-trip.

type Corner = { x: number; y: number }
export type Quad = {
  topLeftCorner?: Corner
  topRightCorner?: Corner
  bottomLeftCorner?: Corner
  bottomRightCorner?: Corner
}

interface JscanifyInstance {
  findPaperContour(mat: any): any
  getCornerPoints(contour: any): Quad
}

declare global {
  interface Window {
    cv?: any
    jscanify?: new () => JscanifyInstance
    __docScannerLoad?: Promise<JscanifyInstance | null>
  }
}

const BASE = import.meta.env.BASE_URL || '/'

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-vendor="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === '1') return resolve()
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error(`failed to load ${src}`)))
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.dataset.vendor = src
    s.addEventListener('load', () => { s.dataset.loaded = '1'; resolve() })
    s.addEventListener('error', () => reject(new Error(`failed to load ${src}`)))
    document.head.appendChild(s)
  })
}

// OpenCV.js signals readiness in one of two ways depending on the build:
// either `cv` is a thenable that resolves to the real module, or `cv` is the
// module and compilation completes when `onRuntimeInitialized` fires.
function waitForOpenCVReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    const cv = window.cv
    if (!cv) return reject(new Error('cv global missing after load'))
    const ready = () => resolve()
    const fail = setTimeout(() => reject(new Error('OpenCV init timeout')), 30000)
    const done = () => { clearTimeout(fail); ready() }
    if (typeof cv.then === 'function') {
      cv.then((real: any) => { window.cv = real; done() }).catch(reject)
    } else if (cv.Mat) {
      done()
    } else {
      cv.onRuntimeInitialized = done
    }
  })
}

/** Loads OpenCV.js + jscanify once. Resolves null if the environment can't run it. */
export function loadDocScanner(): Promise<JscanifyInstance | null> {
  if (window.__docScannerLoad) return window.__docScannerLoad
  window.__docScannerLoad = (async () => {
    try {
      await injectScript(`${BASE}vendor/opencv.js`)
      await waitForOpenCVReady()
      await injectScript(`${BASE}vendor/jscanify.js`)
      if (!window.jscanify) throw new Error('jscanify global missing')
      return new window.jscanify()
    } catch (err) {
      console.warn('[docScanner] unavailable, falling back to manual capture:', err)
      return null
    }
  })()
  return window.__docScannerLoad
}

/**
 * Detects a document quad in a source canvas. Returns the four corner points in
 * the source canvas' pixel space, or null if no confident quad is found.
 * Runs entirely on the passed-in downscaled canvas for performance.
 */
export function detectQuad(scanner: JscanifyInstance, srcCanvas: HTMLCanvasElement): Quad | null {
  const cv = window.cv
  if (!cv) return null
  let mat: any = null
  let contour: any = null
  try {
    mat = cv.imread(srcCanvas)
    contour = scanner.findPaperContour(mat)
    if (!contour) return null
    const area = cv.contourArea(contour)
    const frac = area / (srcCanvas.width * srcCanvas.height)
    // Reject tiny noise contours and the near-full-frame contour that Canny
    // sometimes returns for the whole image border.
    if (frac < 0.15 || frac > 0.98) return null
    const q = scanner.getCornerPoints(contour)
    if (!q.topLeftCorner || !q.topRightCorner || !q.bottomLeftCorner || !q.bottomRightCorner) return null
    return q
  } catch {
    return null
  } finally {
    if (contour && typeof contour.delete === 'function') contour.delete()
    if (mat && typeof mat.delete === 'function') mat.delete()
  }
}

/** Perimeter-based size + a rough aspect check to confirm the quad looks like an ID card. */
export function quadIsCardLike(q: Quad): boolean {
  const { topLeftCorner: tl, topRightCorner: tr, bottomLeftCorner: bl, bottomRightCorner: br } = q
  if (!tl || !tr || !bl || !br) return false
  const top = Math.hypot(tr.x - tl.x, tr.y - tl.y)
  const bottom = Math.hypot(br.x - bl.x, br.y - bl.y)
  const left = Math.hypot(bl.x - tl.x, bl.y - tl.y)
  const right = Math.hypot(br.x - tr.x, br.y - tr.y)
  const w = (top + bottom) / 2
  const h = (left + right) / 2
  if (w < 1 || h < 1) return false
  const ratio = w / h
  // ID-1 cards are ~1.585:1. Accept a generous band so tilt/perspective passes,
  // but reject portrait/near-square shapes (usually false positives).
  return ratio > 1.15 && ratio < 2.2
}
