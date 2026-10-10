import type { Game } from '../core/game/Game'
import type { GameSnapshot } from '../core/persistence/GameSnapshot'
import type { GameAction } from './actions'
import type { GameClient } from './GameClient'
import { GameService, type GameStateSummary, type SeatedState, type ServiceResult } from './GameService'
import { httpDispatch, normalizeServerUrl } from './httpApi'
import { SeatMemory } from './SeatMemory'

const POLL_MS = 2000

function isSeated(data: unknown): data is SeatedState {
  if (typeof data !== 'object' || data === null) return false
  const seated = data as { you?: unknown; token?: unknown }
  return typeof seated.you === 'string' && typeof seated.token === 'string'
}

/**
 * Remote UI client. Each action is sent immediately. The local copy is
 * replaced from /save whenever the server revision moves.
 */
export class HttpGameClient implements GameClient {
  readonly kind = 'remote' as const
  readonly baseUrl: string
  private token: string | null = null
  private playerId: string | null = null
  private readonly local = new GameService()
  private revision = -1
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private readonly seats: SeatMemory

  constructor(baseUrl: string) {
    this.baseUrl = normalizeServerUrl(baseUrl)
    this.seats = new SeatMemory(this.baseUrl)
    const stored = this.seats.read()
    if (stored) {
      this.token = stored.token
      this.playerId = stored.playerId
    }
  }

  get seatPlayerId(): string | undefined {
    return this.playerId ?? undefined
  }

  getGame(): Game | null {
    return this.local.getGame()
  }

  /**
   * Resume a stored token, claim the seat, or start a game if the server
   * has none.
   */
  async connect(): Promise<void> {
    let seated = await this.join(this.token ?? undefined)
    if (!seated.ok && seated.reason === 'no-game') {
      const created = await this.newGame()
      if (created.ok) return
      seated = await this.join()
    }
    if (!seated.ok) throw new Error(seated.error)
    this.rememberSeat(seated.data)
    await this.pullSnapshot()
  }

  async newGame(): Promise<ServiceResult<GameStateSummary>> {
    const result = await this.call('newGame')
    if (!result.ok) return result as ServiceResult<GameStateSummary>
    this.rememberSeat(result.data)
    await this.pullSnapshot()
    return result as ServiceResult<GameStateSummary>
  }

  async act(action: GameAction): Promise<ServiceResult<GameStateSummary>> {
    const result = await this.call('act', action as unknown as Record<string, unknown>)
    if (result.ok) await this.pullSnapshot()
    return result as ServiceResult<GameStateSummary>
  }

  async save(): Promise<ServiceResult<GameSnapshot>> {
    return await this.call('save') as ServiceResult<GameSnapshot>
  }

  advance(dtMs: number): void {
    void dtMs
  }

  async load(snapshot: unknown): Promise<ServiceResult<GameStateSummary>> {
    const body = snapshot && typeof snapshot === 'object' ? snapshot as Record<string, unknown> : {}
    const result = await this.call('load', body)
    if (result.ok) {
      this.rememberSeat(result.data)
      await this.pullSnapshot()
    }
    return result as ServiceResult<GameStateSummary>
  }

  /** Watch /state and refresh the local graph when the server revision moves. */
  startPolling(onChange: () => void): void {
    this.stopPolling()
    this.pollTimer = setInterval(() => {
      void this.poll(onChange)
    }, POLL_MS)
  }

  stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private async join(token?: string): Promise<ServiceResult<SeatedState>> {
    const input = token ? { token } : {}
    return await httpDispatch(this.baseUrl, 'join', input) as ServiceResult<SeatedState>
  }

  private async call(
    id: 'newGame' | 'state' | 'act' | 'save' | 'load',
    input: Record<string, unknown> = {},
  ): Promise<ServiceResult<unknown>> {
    return await httpDispatch(this.baseUrl, id, input, this.token ?? undefined)
  }

  private async poll(onChange: () => void): Promise<void> {
    try {
      const state = await this.call('state')
      if (!state.ok) {
        if (state.reason === 'bad-token' || state.reason === 'no-token') {
          const seated = await this.join()
          if (!seated.ok) return
          this.rememberSeat(seated.data)
          await this.pullSnapshot()
          onChange()
        }
        return
      }
      const data = state.data as GameStateSummary
      if (data.revision === this.revision) return
      await this.pullSnapshot()
      onChange()
    } catch {
      // Server blip — try again on the next interval.
    }
  }

  private async pullSnapshot(): Promise<void> {
    const saved = await this.call('save')
    if (!saved.ok) throw new Error(saved.error)
    const loaded = this.local.load(saved.data)
    if (!loaded.ok) throw new Error(loaded.error)
    const state = await this.call('state')
    if (state.ok) {
      this.revision = (state.data as GameStateSummary).revision
    }
  }

  private rememberSeat(data: unknown): void {
    if (!isSeated(data)) return
    this.token = data.token
    this.playerId = data.you
    this.seats.write({ token: data.token, playerId: data.you })
  }
}
