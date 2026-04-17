import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Test credential loading, labeling, and VP building logic extracted from the pages.

describe('credential label mapping', () => {
  function credentialLabel(type: string | string[]): string {
    const types = Array.isArray(type) ? type : [type]
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

  it('maps CedulaIdentidadCR to Spanish label', () => {
    expect(credentialLabel('CedulaIdentidadCR')).toBe('Cedula de identidad')
  })

  it('maps array type excluding VerifiableCredential', () => {
    expect(credentialLabel(['VerifiableCredential', 'DrivingLicenseCR'])).toBe('Licencia de conducir')
  })

  it('falls back to raw type for unknown types', () => {
    expect(credentialLabel('CustomCredential')).toBe('CustomCredential')
  })

  it('handles single-element array', () => {
    expect(credentialLabel(['PassportCR'])).toBe('Pasaporte')
  })

  it('handles VerifiableCredential-only array', () => {
    expect(credentialLabel(['VerifiableCredential'])).toBe('VerifiableCredential')
  })
})

describe('DID truncation', () => {
  function truncateDid(did: string): string {
    if (did.length <= 30) return did
    return did.slice(0, 16) + '...' + did.slice(-8)
  }

  it('returns short DIDs unchanged', () => {
    expect(truncateDid('did:key:z6MkShort')).toBe('did:key:z6MkShort')
  })

  it('truncates long DIDs with ellipsis', () => {
    const long = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
    const result = truncateDid(long)
    expect(result).toContain('...')
    expect(result.length).toBeLessThan(long.length)
    expect(result.startsWith('did:key:z6MkhaXg')).toBe(true)
    expect(result.endsWith('ta2doK')).toBe(true)
  })
})

describe('expiry detection', () => {
  function isExpired(expirationDate?: string): boolean {
    if (!expirationDate) return false
    return new Date(expirationDate) < new Date()
  }

  it('returns false when no expiry', () => {
    expect(isExpired(undefined)).toBe(false)
  })

  it('returns false for future date', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    expect(isExpired(future.toISOString())).toBe(false)
  })

  it('returns true for past date', () => {
    const past = new Date()
    past.setFullYear(past.getFullYear() - 1)
    expect(isExpired(past.toISOString())).toBe(true)
  })
})

describe('VP building (unsigned)', () => {
  it('builds a valid VP wrapper', () => {
    const credential = {
      '@context': ['https://www.w3.org/2018/credentials/v2'],
      type: ['VerifiableCredential', 'CedulaIdentidadCR'],
      issuer: 'did:key:z6MkIssuer',
      issuanceDate: '2026-04-17T00:00:00Z',
      credentialSubject: { id: 'did:key:z6MkHolder', cedula: '123456789' },
    }

    const nonce = 'test-nonce-123'
    const vp = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      holder: credential.credentialSubject.id,
      verifiableCredential: [credential],
      nonce,
    }

    expect(vp['@context']).toContain('https://www.w3.org/2018/credentials/v1')
    expect(vp.type).toContain('VerifiablePresentation')
    expect(vp.holder).toBe('did:key:z6MkHolder')
    expect(vp.verifiableCredential).toHaveLength(1)
    expect(vp.nonce).toBe(nonce)
  })

  it('falls back to anonymous holder when credentialSubject.id missing', () => {
    const credential = {
      type: ['VerifiableCredential', 'CedulaIdentidadCR'],
      issuer: 'did:key:z6MkIssuer',
      issuanceDate: '2026-04-17T00:00:00Z',
      credentialSubject: { cedula: '123456789' },
    }

    const holder = (credential as any).credentialSubject?.id || 'did:key:anonymous'
    expect(holder).toBe('did:key:anonymous')
  })
})

describe('credential loading from storage map', () => {
  // Simulate localStorage as a plain Map (Node doesn't have real localStorage)
  function loadFromEntries(entries: [string, string][]): any[] {
    const stored: any[] = []
    for (const [key, value] of entries) {
      if (!key.startsWith('attestto-credential-')) continue
      try {
        stored.push(JSON.parse(value))
      } catch { /* skip invalid */ }
    }
    stored.sort((a, b) => new Date(b.issuanceDate).getTime() - new Date(a.issuanceDate).getTime())
    return stored
  }

  it('loads credentials with attestto-credential- prefix', () => {
    const entries: [string, string][] = [
      ['attestto-credential-1', JSON.stringify({ id: 'cred-1', type: 'CedulaIdentidadCR', issuer: 'did:key:z6MkTest', issuanceDate: '2026-04-17T00:00:00Z' })],
      ['other-key', 'not a credential'],
    ]
    const result = loadFromEntries(entries)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('cred-1')
  })

  it('skips invalid JSON', () => {
    const entries: [string, string][] = [
      ['attestto-credential-bad', 'not json{'],
    ]
    expect(loadFromEntries(entries)).toHaveLength(0)
  })

  it('sorts by issuanceDate descending', () => {
    const entries: [string, string][] = [
      ['attestto-credential-old', JSON.stringify({ id: 'old', type: 'A', issuer: 'x', issuanceDate: '2026-01-01T00:00:00Z' })],
      ['attestto-credential-new', JSON.stringify({ id: 'new', type: 'B', issuer: 'x', issuanceDate: '2026-04-17T00:00:00Z' })],
    ]
    const result = loadFromEntries(entries)
    expect(result[0].id).toBe('new')
    expect(result[1].id).toBe('old')
  })
})
