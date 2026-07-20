import { describe, it, expect } from 'vitest'
import { isInternalWsUrl, isInternalHostname, ipv4IsInternal } from '@/lib/captureSecurity'

describe('ipv4IsInternal', () => {
  it('accepts RFC1918, loopback and link-local ranges', () => {
    expect(ipv4IsInternal('10.0.0.5')).toBe(true)
    expect(ipv4IsInternal('192.168.1.79')).toBe(true)
    expect(ipv4IsInternal('172.16.0.1')).toBe(true)
    expect(ipv4IsInternal('172.31.255.254')).toBe(true)
    expect(ipv4IsInternal('127.0.0.1')).toBe(true)
    expect(ipv4IsInternal('169.254.10.10')).toBe(true)
  })

  it('rejects public and out-of-range addresses', () => {
    expect(ipv4IsInternal('8.8.8.8')).toBe(false)
    expect(ipv4IsInternal('1.2.3.4')).toBe(false)
    expect(ipv4IsInternal('172.15.0.1')).toBe(false) // just below /12
    expect(ipv4IsInternal('172.32.0.1')).toBe(false) // just above /12
    expect(ipv4IsInternal('192.169.0.1')).toBe(false)
    expect(ipv4IsInternal('192.168.1.999')).toBe(false) // invalid octet
    expect(ipv4IsInternal('notanip')).toBe(false)
  })
})

describe('isInternalHostname', () => {
  it('accepts localhost and IPv6 internal ranges', () => {
    expect(isInternalHostname('localhost')).toBe(true)
    expect(isInternalHostname('::1')).toBe(true)
    expect(isInternalHostname('fd00:abcd::1')).toBe(true) // ULA
    expect(isInternalHostname('fe80::1')).toBe(true) // link-local
  })

  it('accepts magic-domain names that encode an internal IP', () => {
    expect(isInternalHostname('192-168-1-79.scan.lan.attestto.com')).toBe(true)
    expect(isInternalHostname('10-0-0-5.scan.lan.attestto.com')).toBe(true)
  })

  it('rejects magic-domain names that encode a public IP', () => {
    expect(isInternalHostname('8-8-8-8.scan.lan.attestto.com')).toBe(false)
    expect(isInternalHostname('1-2-3-4.evil.com')).toBe(false)
  })

  it('rejects public hostnames', () => {
    expect(isInternalHostname('attacker.com')).toBe(false)
    expect(isInternalHostname('mobile.attestto.com')).toBe(false)
  })
})

describe('isInternalWsUrl', () => {
  it('accepts internal ws/wss destinations', () => {
    expect(isInternalWsUrl('ws://192.168.1.79:8080/ws/abc')).toBe(true)
    expect(isInternalWsUrl('wss://10.0.0.5/ws/xyz')).toBe(true)
    expect(isInternalWsUrl('wss://192-168-1-79.scan.lan.attestto.com/ws/s1')).toBe(true)
    expect(isInternalWsUrl('ws://localhost:5173/ws/dev')).toBe(true)
  })

  it('rejects public destinations (the exfiltration attack)', () => {
    expect(isInternalWsUrl('ws://8.8.8.8/ws/steal')).toBe(false)
    expect(isInternalWsUrl('wss://attacker.com/ws/steal')).toBe(false)
    expect(isInternalWsUrl('ws://1.2.3.4:9000/ws/x')).toBe(false)
  })

  it('rejects non-ws protocols and malformed input', () => {
    expect(isInternalWsUrl('https://192.168.1.79/ws/x')).toBe(false)
    expect(isInternalWsUrl('http://10.0.0.1/')).toBe(false)
    expect(isInternalWsUrl('not a url')).toBe(false)
    expect(isInternalWsUrl('')).toBe(false)
  })
})
