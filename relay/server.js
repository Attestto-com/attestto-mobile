// Attestto presentation relay — a blind, stateless WebSocket byte-pipe.
//
// Two peers (desktop holder + phone verifier) connect to the SAME session id
// and the relay forwards every message from one to the other, verbatim. It
// never inspects or stores payloads: everything is nacl-sealed end-to-end to
// the ephemeral public key carried in the QR the phone scanned, so the relay
// only ever sees ciphertext and cannot read or MITM the exchange. Its only
// job is rendezvous + forwarding when the two can't reach each other on the LAN.
//
// Protocol:
//   Connect:  wss://<relay>/r/<sessionId>
//   - First socket on a session id is accepted and waits.
//   - Second socket is paired; each side then receives {"type":"peer-joined"}.
//   - A third socket on the same id is rejected (close 4003, "session full").
//   - Any message from one peer is forwarded verbatim to the other.
//   - When a peer disconnects, the other gets {"type":"peer-gone"}.
//   - Sessions are pure in-memory and vanish when both sockets close.
//
// Health: GET / returns 200 "ok" (for Fly/uptime checks).

import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT) || 8787
const SESSION_ID_RE = /^\/r\/([a-zA-Z0-9_-]{4,64})$/

/** sessionId -> Set<WebSocket> (max 2) */
const sessions = new Map()

const httpServer = createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ noServer: true })

httpServer.on('upgrade', (req, socket, head) => {
  const match = SESSION_ID_RE.exec((req.url || '').split('?')[0])
  if (!match) {
    socket.destroy()
    return
  }
  const sessionId = match[1]
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.sessionId = sessionId
    wss.emit('connection', ws)
  })
})

wss.on('connection', (ws) => {
  const { sessionId } = ws
  let peers = sessions.get(sessionId)
  if (!peers) {
    peers = new Set()
    sessions.set(sessionId, peers)
  }

  if (peers.size >= 2) {
    ws.close(4003, 'session full')
    return
  }

  peers.add(ws)

  // If both peers are now present, tell each the other has joined.
  if (peers.size === 2) {
    for (const p of peers) safeSend(p, JSON.stringify({ type: 'peer-joined' }))
  }

  ws.on('message', (data, isBinary) => {
    // Forward verbatim to the OTHER peer(s) only. The relay never parses it.
    for (const p of peers) {
      if (p !== ws && p.readyState === p.OPEN) p.send(data, { binary: isBinary })
    }
  })

  ws.on('close', () => {
    peers.delete(ws)
    for (const p of peers) safeSend(p, JSON.stringify({ type: 'peer-gone' }))
    if (peers.size === 0) sessions.delete(sessionId)
  })

  ws.on('error', () => { /* close handler does cleanup */ })
})

function safeSend(ws, str) {
  try {
    if (ws.readyState === ws.OPEN) ws.send(str)
  } catch { /* ignore */ }
}

httpServer.listen(PORT, () => {
  console.log(`[relay] listening on :${PORT}`)
})
