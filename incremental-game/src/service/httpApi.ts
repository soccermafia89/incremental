import { OPERATIONS_BY_ID, type Operation } from './api'
import type { ServiceResult } from './GameService'

export const SEAT_TOKEN_HEADER = 'X-Incremental-Token'

/** Strip a trailing slash so `http://127.0.0.1:8472/` and without match. */
export function normalizeServerUrl(raw: string): string {
  return raw.replace(/\/+$/, '')
}

/**
 * Read `?server=http://127.0.0.1:8472` from a query string.
 * Invalid or non-http(s) values are ignored so a typo falls back to local.
 */
export function parseServerUrl(search: string): string | null {
  const query = search.startsWith('?') ? search.slice(1) : search
  const raw = new URLSearchParams(query).get('server')
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return normalizeServerUrl(url.origin)
  } catch {
    return null
  }
}

export async function httpDispatch(
  baseUrl: string,
  id: Operation['id'],
  input: Record<string, unknown> = {},
  token?: string,
): Promise<ServiceResult<unknown>> {
  const operation = OPERATIONS_BY_ID[id]
  const url = new URL(operation.path, `${normalizeServerUrl(baseUrl)}/`)
  const headers: Record<string, string> = {}
  if (token) headers[SEAT_TOKEN_HEADER] = token
  const init: RequestInit = { method: operation.method, headers }
  if (operation.method === 'GET') {
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }
  } else {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(input)
  }
  const response = await fetch(url, init)
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null || !('ok' in body)) {
    return { ok: false, error: `Unexpected response from ${url.pathname}` }
  }
  return body as ServiceResult<unknown>
}
