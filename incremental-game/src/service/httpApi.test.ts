import { describe, expect, it } from 'vitest'
import { normalizeServerUrl, parseServerUrl } from './httpApi'

describe('parseServerUrl', () => {
  it('reads an http origin and drops a trailing slash', () => {
    expect(parseServerUrl('?server=http://127.0.0.1:8472/')).toBe('http://127.0.0.1:8472')
    expect(normalizeServerUrl('http://127.0.0.1:8472/')).toBe('http://127.0.0.1:8472')
  })

  it('ignores a missing or non-http value', () => {
    expect(parseServerUrl('')).toBeNull()
    expect(parseServerUrl('?server=ftp://127.0.0.1')).toBeNull()
    expect(parseServerUrl('?server=not a url')).toBeNull()
  })
})
