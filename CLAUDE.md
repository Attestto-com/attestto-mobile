# attestto-mobile — Operating Rules

> Mobile identity verification PWA for the Attestto platform (mobile.attestto.com).

## Stack

- Vue 3 + TypeScript
- Build: Vite + vite-plugin-pwa
- Styling: Tailwind CSS 3
- Routing: vue-router 4
- Deployment: GitHub Pages (auto-deploy on push to main)
- No test framework configured yet

## Commands

- `pnpm install` -- install deps
- `pnpm build` -- type-check and build for production
- `pnpm preview` -- preview production build locally
- `pnpm deploy` -- build and deploy to GitHub Pages

## Architecture

- PWA that acts as the camera companion for the desktop Electron app
- 3-step capture flow: front of document, back of document, selfie with liveness (blink detection)
- Connects to desktop via WebSocket over local WiFi -- images never leave the local network
- Desktop shows QR code with WebSocket URL, phone scans and connects
- Installable as PWA (add to home screen)

## Rules

- This is a private package -- not published to npm
- Privacy is paramount: no images leave the local network, no cloud, no PII transmitted
- Camera and WebSocket are core -- test on real devices, not just desktop browsers
- Do not add CORTEX-specific rules here -- this repo has its own conventions
- Do not run `pnpm dev` -- user owns the dev server
