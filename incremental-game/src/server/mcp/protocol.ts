import { OPERATIONS, OPERATIONS_BY_MCP } from '../../service/api'
import type { Operation } from '../../service/api'
import type { ServiceResult } from '../../service/GameService'

const PROTOCOL_VERSION = '2024-11-05'

interface JsonRpcRequest {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: unknown
}

export type ParsedMcp =
  | { kind: 'none' }
  | { kind: 'reply'; text: string }
  | {
      kind: 'call'
      id: string | number | null | undefined
      operation: Operation
      args: Record<string, unknown>
    }

export function reply(id: string | number | null | undefined, result: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id: id ?? null, result })
}

export function fail(id: string | number | null | undefined, code: number, message: string): string {
  return JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function toolReply(
  id: string | number | null | undefined,
  result: ServiceResult<unknown>,
): string {
  return reply(id, {
    isError: !result.ok,
    content: [{ type: 'text', text: JSON.stringify(result) }],
  })
}

/** Turn one JSON-RPC line into a reply, a tool call, or nothing. */
export function parseMcpMessage(raw: string): ParsedMcp {
  const trimmed = raw.trim()
  if (trimmed === '') return { kind: 'none' }

  let message: JsonRpcRequest
  try {
    message = JSON.parse(trimmed) as JsonRpcRequest
  } catch {
    return { kind: 'reply', text: fail(null, -32700, 'Parse error') }
  }

  const id = message.id
  const method = message.method ?? ''

  if (method === 'initialize') {
    return {
      kind: 'reply',
      text: reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'incremental', version: '0.0.0' },
      }),
    }
  }

  if (method === 'notifications/initialized' || method.startsWith('notifications/')) {
    return { kind: 'none' }
  }

  if (method === 'ping') {
    return { kind: 'reply', text: reply(id, {}) }
  }

  if (method === 'tools/list') {
    return {
      kind: 'reply',
      text: reply(id, {
        tools: OPERATIONS.map(operation => ({
          name: operation.mcpName,
          description: operation.description,
          inputSchema: operation.inputSchema,
        })),
      }),
    }
  }

  if (method === 'tools/call') {
    const params = asRecord(message.params)
    const name = String(params.name ?? '')
    const operation = OPERATIONS_BY_MCP[name]
    if (!operation) {
      return {
        kind: 'reply',
        text: reply(id, {
          isError: true,
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        }),
      }
    }
    return { kind: 'call', id, operation, args: asRecord(params.arguments) }
  }

  return { kind: 'reply', text: fail(id, -32601, `Method not found: ${method}`) }
}
