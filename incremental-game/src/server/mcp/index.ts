import { GameService } from '../../service/GameService'
import { dispatch } from '../../service/api'
import type { Operation } from '../../service/api'
import type { SeatedState, ServiceResult } from '../../service/GameService'
import { httpDispatch } from '../../service/httpApi'
import { parseMcpMessage, toolReply } from './protocol'
import { startStdioLoop } from './stdio'

/** One token per HTTP origin for this MCP process. */
const mcpTokens = new Map<string, string>()

/** Handle one MCP JSON-RPC message. Stdio framing is newline-delimited JSON. */
export function handleMcpMessage(service: GameService, raw: string): string | null {
  const parsed = parseMcpMessage(raw)
  if (parsed.kind === 'none') return null
  if (parsed.kind === 'reply') return parsed.text
  return toolReply(parsed.id, dispatch(service, parsed.operation.id, parsed.args))
}

function tokenFrom(result: ServiceResult<unknown>): string | undefined {
  if (!result.ok || typeof result.data !== 'object' || result.data === null) return undefined
  const token = (result.data as SeatedState).token
  return typeof token === 'string' ? token : undefined
}

async function tokenForHttpCall(
  baseUrl: string,
  operationId: Operation['id'],
): Promise<string | undefined | ServiceResult<never>> {
  const cached = mcpTokens.get(baseUrl)
  if (cached) return cached
  if (operationId === 'join' || operationId === 'newGame' || operationId === 'load') {
    return undefined
  }
  const joined = await httpDispatch(baseUrl, 'join')
  const joinedToken = tokenFrom(joined)
  if (joinedToken) {
    mcpTokens.set(baseUrl, joinedToken)
    return joinedToken
  }
  if (!joined.ok && joined.reason === 'no-game') {
    const created = await httpDispatch(baseUrl, 'newGame')
    const createdToken = tokenFrom(created)
    if (createdToken) {
      mcpTokens.set(baseUrl, createdToken)
      return createdToken
    }
    return created as ServiceResult<never>
  }
  return joined as ServiceResult<never>
}

/** Same MCP surface, but tools/call hits an HTTP GameService. */
export async function handleMcpMessageHttp(baseUrl: string, raw: string): Promise<string | null> {
  const parsed = parseMcpMessage(raw)
  if (parsed.kind === 'none') return null
  if (parsed.kind === 'reply') return parsed.text
  const token = await tokenForHttpCall(baseUrl, parsed.operation.id)
  if (token !== undefined && typeof token !== 'string') {
    return toolReply(parsed.id, token)
  }
  const result = await httpDispatch(baseUrl, parsed.operation.id, parsed.args, token)
  const next = tokenFrom(result)
  if (next) mcpTokens.set(baseUrl, next)
  return toolReply(parsed.id, result)
}

export function startMcpStdio(service: GameService): void {
  startStdioLoop(line => handleMcpMessage(service, line))
}

export function startMcpHttpProxy(baseUrl: string): void {
  startStdioLoop(line => handleMcpMessageHttp(baseUrl, line))
}
