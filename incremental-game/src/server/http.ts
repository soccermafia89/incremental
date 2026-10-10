import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { GameService, type ServiceResult } from '../service/GameService'
import { dispatch, OPERATIONS, OPERATIONS_BY_PATH } from '../service/api'
import type { Operation } from '../service/api'
import { SEAT_TOKEN_HEADER } from '../service/httpApi'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': `Content-Type, ${SEAT_TOKEN_HEADER}`,
}

function send(response: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  response.writeHead(status, {
    ...CORS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  })
  response.end(json)
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', chunk => chunks.push(chunk as Buffer))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function parseBody(raw: string): Record<string, unknown> {
  if (raw.trim() === '') return {}
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('JSON body must be an object')
  }
  return parsed as Record<string, unknown>
}

function helpBody(port: number): unknown {
  return {
    name: 'Incremental game server',
    hint: `POST /join (or /new-game on an empty server) returns a token. Send it as ${SEAT_TOKEN_HEADER} on every later request.`,
    curl: {
      newGame: `curl -s -X POST http://localhost:${port}/new-game -H 'Content-Type: application/json' -d '{}'`,
      join: `curl -s -X POST http://localhost:${port}/join -H 'Content-Type: application/json' -d '{}'`,
      state: `curl -s http://localhost:${port}/state -H '${SEAT_TOKEN_HEADER}: TOKEN'`,
      options: `curl -s http://localhost:${port}/options -H '${SEAT_TOKEN_HEADER}: TOKEN'`,
      save: `curl -s http://localhost:${port}/save -H '${SEAT_TOKEN_HEADER}: TOKEN'`,
    },
    operations: OPERATIONS.map(operation => ({
      method: operation.method,
      path: operation.path,
      mcp: operation.mcpName,
      description: operation.description,
    })),
  }
}

function readToken(request: IncomingMessage): string | undefined {
  const raw = request.headers[SEAT_TOKEN_HEADER.toLowerCase()]
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined
}

function unauthorized(error: string, reason: 'no-token' | 'bad-token'): ServiceResult<never> {
  return { ok: false, error, reason }
}

function statusFor(result: ServiceResult<unknown>): number {
  if (!result.ok && (result.reason === 'no-token' || result.reason === 'bad-token')) return 401
  return 409
}

function authorize(
  service: GameService,
  operation: Operation,
  token: string | undefined,
): ServiceResult<{ playerId?: string }> {
  if (operation.id === 'join') return { ok: true, data: {} }

  const hasGame = service.getGame() !== null
  if ((operation.id === 'newGame' || operation.id === 'load') && !hasGame) {
    return { ok: true, data: {} }
  }

  if (!token) {
    return unauthorized(`Missing ${SEAT_TOKEN_HEADER}`, 'no-token')
  }
  const playerId = service.playerIdForToken(token)
  if (!playerId) {
    return unauthorized('Unknown or expired seat token', 'bad-token')
  }
  return { ok: true, data: { playerId } }
}

export async function handleHttpRequest(
  service: GameService,
  request: IncomingMessage,
  response: ServerResponse,
  port: number,
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  const method = request.method ?? 'GET'

  if (method === 'OPTIONS') {
    response.writeHead(204, CORS)
    response.end()
    return
  }

  if (method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    send(response, 200, url.pathname === '/health' ? { ok: true } : helpBody(port))
    return
  }

  const operation: Operation | undefined = OPERATIONS_BY_PATH[url.pathname]
  if (!operation) {
    send(response, 404, { ok: false, error: `Unknown path: ${url.pathname}` })
    return
  }
  if (method !== operation.method) {
    send(response, 405, { ok: false, error: `${url.pathname} is ${operation.method} only` })
    return
  }

  let input: Record<string, unknown> = {}
  try {
    if (method === 'POST') {
      input = parseBody(await readBody(request))
    } else {
      for (const [key, value] of url.searchParams.entries()) {
        input[key] = value
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    send(response, 400, { ok: false, error: message })
    return
  }

  const seat = authorize(service, operation, readToken(request))
  if (!seat.ok) {
    send(response, statusFor(seat), seat)
    return
  }

  let result = dispatch(service, operation.id, input)
  if (result.ok && (operation.id === 'newGame' || operation.id === 'load')) {
    result = service.join()
  }
  send(response, result.ok ? 200 : statusFor(result), result)
}

export function startHttpServer(service: GameService, port: number): Server {
  const server = createServer((request, response) => {
    handleHttpRequest(service, request, response, port).catch(error => {
      const message = error instanceof Error ? error.message : String(error)
      send(response, 500, { ok: false, error: message })
    })
  })
  return server
}
