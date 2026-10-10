import type { EnemyLevels, EnemyUpgradeId } from '../../data/enemy/upgrades'
import type { FighterLevels, FighterUpgradeId } from '../../data/fighter/upgrades'
import type { MiningLevels, MiningPurchase } from '../../data/mining'
import type { EnemyStats } from '../enemy/Upgrades'
import type { FighterStats } from '../fighter/Upgrades'
import type { UpgradeLevels } from '../../data/upgrades'
import type { AsteroidState } from '../asteroid/AsteroidField'
import type { MiningStats } from '../mining/Mining'
import type { MinerStats, MinerUpgradeId, ShipRole, ShipState, Side, UpgradeResult } from '../miner'
import type { OreState } from '../ore/OreField'
import type { ShotState } from '../shot/Shot'

export interface MapState {
  money: number
  spawnAccumulatorMs: number
  rngState: number
  goldenSpawnAccumulatorMs: number
  nextAsteroidId: number
  nextShipId: number
  nextOreId: number
  nextShotId: number
  asteroids: AsteroidState[]
  ores: OreState[]
  shots: ShotState[]
  ships: ShipState[]
  minerLevels: UpgradeLevels
  miningLevels: MiningLevels
  fighterLevels: FighterLevels
  enemyLevels: EnemyLevels
  tractorBeam: boolean
  golden: boolean
  /** The Mining tab stays once this is bought. */
  miningUnlocked: boolean
  /** Player miners bought and not yet on the field. */
  pendingMiners: number
  /** Production already spent on the miner at the front of that queue, in unit-milliseconds. */
  minerWork: number
  /** Fighters paid for and not yet on the field. One builds at a time. */
  pendingFighters: number
  /** Production already spent on the fighter at the front of that queue, in unit-milliseconds. */
  fighterWork: number
  /** How many rival miners the opposing base is allowed to have. */
  rivalCap: number
  /** Time already waited toward the next replacement of a destroyed rival miner. */
  rivalElapsedMs: number
  /** True once the player fleet has crossed the size that grows the rival cap. */
  fleetAnswered: boolean
  /** What the next sidebar gift pays. Doubles after each claim. */
  gift: number
}

export interface MapScene {
  width: number
  height: number
  base: { x: number; y: number; radius: number }
  rival: { x: number; y: number; radius: number }
  field: { x0: number; y0: number; x1: number; y1: number }
  money: number
  asteroids: AsteroidState[]
  ores: { id: string; x: number; y: number; kind: AsteroidState['kind'] }[]
  shots: { id: string; x: number; y: number; side: Side }[]
  ships: { id: string; x: number; y: number; carrying: boolean; heading: number; side: Side; role: ShipRole; health: number; maxHealth: number }[]
  maxAsteroids: number
  /** Milliseconds until the next asteroid. */
  spawnInMs: number
  /** Drawn size of a normal asteroid, in board pixels. */
  asteroidSize: number
  /** Drawn size of a golden asteroid, in board pixels. */
  goldenSize: number
  miner: MinerStats
  mining: MiningStats
  /** Fill from 0 to 1 while the next bought miner is waiting to launch. */
  nextMiner: { progress: number } | null
  /** Fighter stats. Count is how many fighters are kept, starting at none. */
  fighter: FighterStats
  /** Fill from 0 to 1 while that fighter is building. */
  nextFighter: { progress: number } | null
  /** Opposing-fleet purchases. Spawn rate is how fast destroyed ships return. */
  enemy: EnemyStats
  /** What the next sidebar gift pays. */
  gift: number
}

export interface Game {
  scene(): MapScene
  exportState(): MapState
  advance(dtMs: number): void
  upgradeMiner(upgrade: MinerUpgradeId): UpgradeResult
  upgradeMining(upgrade: MiningPurchase): UpgradeResult
  upgradeFighterStat(upgrade: FighterUpgradeId): UpgradeResult
  upgradeEnemy(upgrade: EnemyUpgradeId): UpgradeResult
  claimGift(): void
}
