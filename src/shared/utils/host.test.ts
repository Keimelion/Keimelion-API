import { describe, it, expect } from 'vitest'
import { extractDomainCandidates } from './host.js'

describe('extractDomainCandidates', () => {
  it('walks parent domains from the most specific to the registrable one', () => {
    expect(extractDomainCandidates('https://www.amazon.fr/dp/123')).toEqual(['www.amazon.fr', 'amazon.fr'])
    expect(extractDomainCandidates('https://m.amazon.fr/dp/123')).toEqual(['m.amazon.fr', 'amazon.fr'])
  })

  it('returns the bare host when it has exactly two labels', () => {
    expect(extractDomainCandidates('https://amazon.fr')).toEqual(['amazon.fr'])
  })

  it('never yields the spoofed domain for a look-alike host', () => {
    expect(extractDomainCandidates('https://amazon.fr.evil.com/x')).toEqual([
      'amazon.fr.evil.com',
      'fr.evil.com',
      'evil.com',
    ])
    expect(extractDomainCandidates('https://notamazon.fr/x')).toEqual(['notamazon.fr'])
  })

  it('lowercases the host and strips a trailing dot', () => {
    expect(extractDomainCandidates('https://WWW.Amazon.FR./x')).toEqual(['www.amazon.fr', 'amazon.fr'])
  })

  it('ignores port, credentials, path, query and fragment', () => {
    expect(extractDomainCandidates('https://user:pass@shop.amazon.fr:8443/a?b=c#d')).toEqual([
      'shop.amazon.fr',
      'amazon.fr',
    ])
  })

  it('returns no candidate for a single-label host or an unparsable URL', () => {
    expect(extractDomainCandidates('https://localhost/x')).toEqual([])
    expect(extractDomainCandidates('not a url')).toEqual([])
  })
})
