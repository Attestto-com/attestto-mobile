# mobile.attestto.com

Mobile identity verification PWA for the Attestto platform.

## What it does

Your phone becomes the camera for identity verification. The desktop app shows a QR code, you scan it, and this PWA guides you through capturing your document and selfie — all over your local WiFi network.

```
Desktop (Electron)              Phone (this PWA)
┌──────────────────┐            ┌──────────────────────┐
│ Shows QR code    │◄── WiFi ──►│ 1. Front of document │
│ Receives images  │            │ 2. Back of document  │
│ Runs OCR         │            │ 3. Selfie + liveness │
│ Validates Padrón │            │    (blink detection)  │
│ Stores credential│            │ 4. Done → install PWA│
└──────────────────┘            └──────────────────────┘
```

**Privacy**: Images never leave your local network. The phone sends them directly to the desktop over WebSocket — no server, no cloud, no PII transmitted.

## Features

- **3-step capture flow**: Front → Back → Selfie with passive liveness (blink detection)
- **Live camera viewfinder**: Card frame overlay, face oval, guidance banners
- **File input fallback**: If camera access is blocked, tap to take photo
- **Installable PWA**: Add to home screen for native app experience
- **HTTPS via GitHub Pages**: getUserMedia works without cert warnings

## Tech stack

- Vue 3 + TypeScript
- Vite + vite-plugin-pwa
- Tailwind CSS
- WebSocket (connects to desktop capture server)
- GitHub Pages (deployment)

## Development

```bash
pnpm install
pnpm dev
```

## How it connects to the desktop

1. Desktop app starts a local WebSocket server on your WiFi
2. Desktop generates a QR code: `https://mobile.attestto.com/capture?ws=ws://192.168.1.X:PORT/ws/SESSION`
3. Phone scans QR → opens this PWA with the WebSocket URL in the query string
4. PWA connects to the desktop via WebSocket
5. Captured images are sent as base64 JPEG over WebSocket
6. Desktop acknowledges each step → PWA advances to next

## Deployment

Deployed automatically to GitHub Pages on push to `main` via `.github/workflows/deploy.yml`.

Custom domain: `mobile.attestto.com` (CNAME → Attestto-com.github.io)

## Part of

[Attestto](https://attestto.com) — Decentralized identity and verifiable credentials for LATAM.

## License

Apache-2.0
