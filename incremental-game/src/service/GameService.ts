import { GameImpl, type Game } from '../core/game/Game'
import { MINER_UPGRADES, type MinerUpgradeId } from '../core/miner'
import { ENEMY_UPGRADE_IDS, type EnemyUpgradeId } from '../data/enemy/upgrades'
import { FIGHTER_UPGRADE_IDS, type FighterUpgradeId } from '../data/fighter/upgrades'
import { GOLDEN, MINING_IDS, MINING_UNLOCK, TRACTOR_BEAM, type MiningPurchase } from '../data/mining'
import type { GameSnapshot } from '../core/persistence/GameSnapshot'
import { GameDeserializer } from '../core/persistence/GameDeserializer'
import { GameSerializer } from '../core/persistence/GameSerializer'
import type { GameAction } from './actions'
import { SeatTable } from './SeatTable'

const SEAT_ID = 'player'

function isMinerUpgrade(value: unknown): value is MinerUpgradeId {
  return typeof value === 'string' && (MINER_UPGRADES as readonly string[]).includes(value)
}

function isEnemyUpgrade(value: unknown): value is EnemyUpgradeId {
  return typeof value === 'string' && (ENEMY_UPGRADE_IDS as readonly string[]).includes(value)
}

function isFighterUpgrade(value: unknown): value is FighterUpgradeId {
  return typeof value === 'string' && (FIGHTER_UPGRADE_IDS as readonly string[]).includes(value)
}

function isMiningPurchase(value: unknown): value is MiningPurchase {
  return value === TRACTOR_BEAM || value === GOLDEN || value === MINING_UNLOCK
    || (typeof value === 'string' && (MINING_IDS as readonly string[]).includes(value))
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; reason?: string }

export interface GameStateSummary {
  revision: number
}

export interface SeatedState extends GameStateSummary {
  you: string
  token: string
}

/**
 * The only mutator the UI, HTTP, and MCP use.
 * Rules will live on Game. This class owns the live instance and the seats.
 */
export class GameService {
  private game: GameImpl | null = null
  private revision = 0
  private readonly seats = new SeatTable()

  getGame(): Game | null {
    return this.game
  }

  playerIdForToken(token: string): string | undefined {
    return this.seats.playerIdFor(token)
  }

  newGame(): ServiceResult<GameStateSummary> {
    this.seats.reset()
    this.game = GameImpl.create()
    this.revision += 1
    return { ok: true, data: { revision: this.revision } }
  }

  state(): ServiceResult<GameStateSummary> {
    if (!this.game) return { ok: false, error: 'No game running', reason: 'no-game' }
    return { ok: true, data: { revision: this.revision } }
  }

  options(): ServiceResult<GameAction[]> {
    if (!this.game) return { ok: false, error: 'No game running', reason: 'no-game' }
    const state = this.game.exportState()
    const mining = state.miningUnlocked
      ? [
        ...MINING_IDS
          .filter(upgrade => state.golden || upgrade !== 'goldenSpawnRate')
          .map(upgrade => ({ type: 'upgradeMining', upgrade })),
        { type: 'upgradeMining', upgrade: GOLDEN },
        { type: 'upgradeMining', upgrade: TRACTOR_BEAM },
      ]
      : [{ type: 'upgradeMining', upgrade: MINING_UNLOCK }]
    const fighter = state.tractorBeam
      ? FIGHTER_UPGRADE_IDS.map(upgrade => ({ type: 'upgradeFighter', upgrade }))
      : []
    const enemy = state.tractorBeam
      ? ENEMY_UPGRADE_IDS.map(upgrade => ({ type: 'upgradeEnemy', upgrade }))
      : []
    return {
      ok: true,
      data: [
        ...MINER_UPGRADES.map(upgrade => ({ type: 'upgradeMiner', upgrade })),
        ...mining,
        ...fighter,
        ...enemy,
        { type: 'claimGift' },
      ],
    }
  }

  act(action: GameAction): ServiceResult<GameStateSummary> {
    if (!this.game) return { ok: false, error: 'No game running', reason: 'no-game' }
    const upgraded = this.apply(action)
    if (upgraded === 'unknown') {
      return {
        ok: false,
        error: `Unknown action: ${action.type}`,
        reason: 'unknown-action',
      }
    }
    if (upgraded === 'maxed') {
      return { ok: false, error: 'Already at max', reason: 'maxed' }
    }
    if (upgraded === 'broke') {
      return { ok: false, error: 'Not enough money', reason: 'cant-afford' }
    }
    this.revision += 1
    return { ok: true, data: { revision: this.revision } }
  }

  private apply(action: GameAction): 'ok' | 'broke' | 'maxed' | 'unknown' {
    if (!this.game) return 'unknown'
    if (action.type === 'claimGift') {
      this.game.claimGift()
      return 'ok'
    }
    if (action.type === 'upgradeMiner' && isMinerUpgrade(action.upgrade)) {
      return this.game.upgradeMiner(action.upgrade)
    }
    if (action.type === 'upgradeEnemy' && isEnemyUpgrade(action.upgrade)) {
      if (!this.game.exportState().tractorBeam) return 'unknown'
      return this.game.upgradeEnemy(action.upgrade)
    }
    if (action.type === 'upgradeFighter') {
      if (!this.game.exportState().tractorBeam) return 'unknown'
      if (!isFighterUpgrade(action.upgrade)) return 'unknown'
      return this.game.upgradeFighterStat(action.upgrade)
    }
    if (action.type === 'upgradeMining' && isMiningPurchase(action.upgrade)) {
      if (action.upgrade !== MINING_UNLOCK && !this.game.exportState().miningUnlocked) return 'unknown'
      if (action.upgrade === 'goldenSpawnRate' && !this.game.exportState().golden) return 'unknown'
      return this.game.upgradeMining(action.upgrade)
    }
    return 'unknown'
  }

  /** Move miners and spawn asteroids. `dtMs` is real time, not a turn. */
  advance(dtMs: number): void {
    if (!this.game) return
    this.game.advance(dtMs)
    this.revision += 1
  }

  save(): ServiceResult<GameSnapshot> {
    if (!this.game) return { ok: false, error: 'No game running', reason: 'no-game' }
    return { ok: true, data: GameSerializer.serialize(this.game) }
  }

  load(raw: unknown): ServiceResult<GameStateSummary> {
    try {
      this.game = GameDeserializer.deserialize(raw)
      this.seats.reset()
      this.revision += 1
      return { ok: true, data: { revision: this.revision } }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, error: message, reason: 'bad-save' }
    }
  }

  join(token?: string): ServiceResult<SeatedState> {
    if (!this.game) return { ok: false, error: 'No game running', reason: 'no-game' }
    if (token) {
      const resumed = this.seats.resume(token)
      if (!resumed) {
        return { ok: false, error: 'Unknown or expired seat token', reason: 'bad-token' }
      }
      return {
        ok: true,
        data: { you: resumed.playerId, token: resumed.token, revision: this.revision },
      }
    }
    const claimed = this.seats.claimNext([SEAT_ID])
    if ('error' in claimed) {
      return { ok: false, error: claimed.error, reason: claimed.reason }
    }
    return {
      ok: true,
      data: { you: claimed.playerId, token: claimed.token, revision: this.revision },
    }
  }
}
