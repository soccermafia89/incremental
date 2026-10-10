import type { Game } from '../core/game/Game'
import type { GameSnapshot } from '../core/persistence/GameSnapshot'
import type { GameAction } from './actions'
import { GameService, type GameStateSummary, type ServiceResult } from './GameService'

/**
 * What the React app talks to. Local wraps an in-process GameService.
 * Remote posts to the HTTP server and keeps a deserialized copy for rendering.
 */
export interface GameClient {
  readonly kind: 'local' | 'remote'
  /** Assigned HTTP seat. Local play has none. */
  readonly seatPlayerId?: string
  getGame(): Game | null
  newGame(): Promise<ServiceResult<GameStateSummary>>
  act(action: GameAction): Promise<ServiceResult<GameStateSummary>>
  save(): Promise<ServiceResult<GameSnapshot>>
  load(snapshot: unknown): Promise<ServiceResult<GameStateSummary>>
  advance(dtMs: number): void
}

export class LocalGameClient implements GameClient {
  readonly kind = 'local' as const
  readonly seatPlayerId?: string
  private readonly service: GameService

  constructor(service: GameService = new GameService()) {
    this.service = service
  }

  getGame(): Game | null {
    return this.service.getGame()
  }

  newGame(): Promise<ServiceResult<GameStateSummary>> {
    return Promise.resolve(this.service.newGame())
  }

  act(action: GameAction): Promise<ServiceResult<GameStateSummary>> {
    return Promise.resolve(this.service.act(action))
  }

  save(): Promise<ServiceResult<GameSnapshot>> {
    return Promise.resolve(this.service.save())
  }

  load(snapshot: unknown): Promise<ServiceResult<GameStateSummary>> {
    return Promise.resolve(this.service.load(snapshot))
  }

  advance(dtMs: number): void {
    this.service.advance(dtMs)
  }
}
