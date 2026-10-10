import type { GameService, ServiceResult } from './GameService'
import type { GameAction } from './actions'

/**
 * One description of the game API. HTTP routes and MCP tools are generated
 * from this list so they cannot describe different games.
 */
export interface Operation {
  id: 'newGame' | 'state' | 'options' | 'act' | 'save' | 'load' | 'join'
  mcpName: string
  method: 'GET' | 'POST'
  path: string
  description: string
  inputSchema: Record<string, unknown>
}

export const OPERATIONS: Operation[] = [
  {
    id: 'newGame',
    mcpName: 'incremental_new_game',
    method: 'POST',
    path: '/new-game',
    description: 'Start a new game and sit the caller. HTTP requires a seat token if a game is already running.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    id: 'join',
    mcpName: 'incremental_join',
    method: 'POST',
    path: '/join',
    description: 'Claim the open seat, or resume one with { token }.',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Seat token from an earlier join or new-game' },
      },
    },
  },
  {
    id: 'state',
    mcpName: 'incremental_state',
    method: 'GET',
    path: '/state',
    description: 'Whether a game is running, and its revision.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    id: 'options',
    mcpName: 'incremental_options',
    method: 'GET',
    path: '/options',
    description: 'Every legal action right now. Copy one into incremental_act.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    id: 'act',
    mcpName: 'incremental_act',
    method: 'POST',
    path: '/act',
    description: 'Apply one action from incremental_options. Returns a refusal if illegal.',
    inputSchema: {
      type: 'object',
      required: ['type'],
      properties: {
        type: { type: 'string' },
      },
    },
  },
  {
    id: 'save',
    mcpName: 'incremental_save',
    method: 'GET',
    path: '/save',
    description: 'The current game as a snapshot. Tokens are not included.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    id: 'load',
    mcpName: 'incremental_load',
    method: 'POST',
    path: '/load',
    description: 'Replace the running game with a snapshot. Clears seats, then sits the caller.',
    inputSchema: {
      type: 'object',
      properties: {
        version: { type: 'integer' },
        savedAt: { type: 'string' },
      },
    },
  },
]

export const OPERATIONS_BY_ID = Object.fromEntries(
  OPERATIONS.map(operation => [operation.id, operation]),
) as Record<Operation['id'], Operation>

export const OPERATIONS_BY_MCP = Object.fromEntries(
  OPERATIONS.map(operation => [operation.mcpName, operation]),
) as Record<string, Operation>

export const OPERATIONS_BY_PATH = Object.fromEntries(
  OPERATIONS.map(operation => [operation.path, operation]),
) as Record<string, Operation>

/**
 * Run one operation against the service. Both adapters call this.
 */
export function dispatch(
  service: GameService,
  id: Operation['id'],
  input: Record<string, unknown> = {},
): ServiceResult<unknown> {
  switch (id) {
    case 'newGame':
      return service.newGame()
    case 'state':
      return service.state()
    case 'options':
      return service.options()
    case 'act':
      return service.act(input as unknown as GameAction)
    case 'save':
      return service.save()
    case 'load':
      return service.load(input.snapshot ?? input)
    case 'join':
      return service.join(typeof input.token === 'string' ? input.token : undefined)
  }
}
