// Capture-destination security guard.
//
// Threat: a crafted link like  /capture?ws=ws://attacker-ip/...  would stream
// the user's ID document + selfie to an attacker's server. End-to-end nacl
// sealing does NOT help — the attacker supplies their own public key, so we'd
// be encrypting the document directly to the thief.
//
// Defense (layer 2 of the model — see README "Security model"): the socket
// destination must be a private / internal LAN address. Private IPs do not
// route across the internet, so requiring an internal destination also proves
// same-network co-presence: a remote attacker's link simply fails to connect
// from the victim's phone.
//
// Layer 1 (origin-derived destination, never a URL param) and layer 3
// (human-compared pairing code) are enforced elsewhere / by the transport.

/** True if an IPv4 string is a private, loopback, or link-local address. */
export function ipv4IsInternal(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  const n = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN))
  if (n.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return false
  const [a, b] = n
  if (a === 10) return true // 10.0.0.0/8
  if (a === 127) return true // loopback (localhost dev)
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  return false
}

/** True if a hostname resolves to an internal address we permit as a destination. */
export function isInternalHostname(host: string): boolean {
  const h = host.replace(/^\[/, '').replace(/\]$/, '').toLowerCase()
  if (!h) return false
  if (h === 'localhost') return true
  // IPv6: loopback, unique-local (fc00::/7), link-local (fe80::/10)
  if (h === '::1') return true
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true
  // Magic-domain: "192-168-1-79.scan.lan.attestto.com" encodes the internal IP
  // in the leading label — parse and validate it.
  const magic = h.match(/^(\d{1,3})-(\d{1,3})-(\d{1,3})-(\d{1,3})\./)
  if (magic) return ipv4IsInternal(`${magic[1]}.${magic[2]}.${magic[3]}.${magic[4]}`)
  // Bare IPv4 literal.
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return ipv4IsInternal(h)
  // Any other public hostname is rejected.
  return false
}

/**
 * Validates a WebSocket URL as a permitted capture destination: it must be a
 * ws:// or wss:// URL pointing at an internal address. Returns false for public
 * hosts, non-ws protocols, and malformed input.
 */
export function isInternalWsUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'ws:' && u.protocol !== 'wss:') return false
  return isInternalHostname(u.hostname)
}
