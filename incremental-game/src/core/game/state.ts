import type { EnemyLevels, EnemyUpgradeId } from '../../data/enemy/upgrades'
import type { FighterLevels, FighterUpgradeId } from '../../data/fighter/upgrades'
import type { MiningLevels, MiningPurchase } from '../../data/mining'
import type { EnemyStats } from '../enemy/Upgrades'
import type { FighterStats } from '../fighter/Upgrades'
import type { UpgradeLevels } from '../../data/upgrades'
import type { WeaponLevels, WeaponUpgradeId } from '../../data/weapons/upgrades'
import type { WeaponStats } from '../weapons/Upgrades'
import type { AsteroidState } from '../asteroid/AsteroidField'
import type { DesignGhost, DesignResult, DesignerCell, DesignerScene, PlacedPart } from '../designer'
import type { MiningStats } from '../mining/Mining'
import type { HullCell, MinerStats, MinerUpgradeId, ShipRole, ShipState, Side, UpgradeResult } from '../miner'
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
  weaponLevels: WeaponLevels
  tractorBeam: boolean
  golden: boolean
  /** The Mining tab stays once this is bought. */
  miningUnlocked: boolean
  /** Asteroids and our miners are gone. Income is a flat rate. */
  automine: boolean
  /** The Ship Designer sidebar stays once this is bought. */
  shipDesigner: boolean
  /** The laser part stays in the designer catalog once this is bought. */
  laser: boolean
  /** The missile part stays in the designer catalog once this is bought. */
  missile: boolean
  /** The medium engine stays in the designer catalog once this is bought. */
  mediumEngine: boolean
  /** The large engine stays in the designer catalog once this is bought. */
  largeEngine: boolean
  /** Parts bolted to the core, in the order they were placed. */
  parts: PlacedPart[]
  nextPartId: number
  /** The design the rest of the game uses. Null until Save design. */
  savedDesign: PlacedPart[] | null
  /** Which saved ship the fighter bar builds. `fighter` is the stock hull. */
  productionDesign: ProductionDesign
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
  /** The player base is shooting. Stasis until an enemy enters the short range. */
  baseCombat: boolean
  /** The rival base is shooting. */
  rivalCombat: boolean
}

export interface MapScene {
  width: number
  height: number
  base: { x: number; y: number; radius: number }
  rival: { x: number; y: number; radius: number }
  baseCombat: boolean
  rivalCombat: boolean
  field: { x0: number; y0: number; x1: number; y1: number }
  money: number
  asteroids: AsteroidState[]
  ores: { id: string; x: number; y: number; kind: AsteroidState['kind'] }[]
  shots: { id: string; x: number; y: number; side: Side; splash: boolean; mining: boolean; angle: number }[]
  /** Beams still on screen. A cannon bolt lasts one step. A ship laser stays 200 ms. Not saved. */
  lasers: { id: number; x0: number; y0: number; x1: number; y1: number; side: Side; source: 'cannon' | 'laser' }[]
  /** Lit map cells of a missile blast. `bright` falls from 1 to 0. Not saved. */
  blasts: { id: number; side: Side; size: number; bright: number; cells: { x: number; y: number }[] }[]
  ships: { id: string; x: number; y: number; carrying: boolean; heading: number; side: Side; role: ShipRole; health: number; maxHealth: number; hull: HullCell[] | null }[]
  maxAsteroids: number
  /** Milliseconds until the next asteroid. */
  spawnInMs: number
  /** Drawn size of a normal asteroid, in board pixels. */
  asteroidSize: number
  /** Drawn size of a golden asteroid, in board pixels. */
  goldenSize: number
  miner: MinerStats
  mining: MiningStats
  /** Fill from 0 to 1 while the next bought miner is waiting to launch. Cells are its prebuilt hull. */
  nextMiner: { progress: number; cells: { x: number; y: number; color: string }[] } | null
  /** Fighter stats. Count is how many fighters are kept, starting at none. */
  fighter: FighterStats
  /** Fill from 0 to 1 while that fighter is building. Cells are the saved design, or the miner hull for the default fighter. */
  nextFighter: { progress: number; cells: { x: number; y: number; color: string }[] } | null
  /** Opposing-fleet purchases. Spawn rate is how fast destroyed ships return. */
  enemy: EnemyStats
  /** Laser range and energy reduction, and missile fire rate and damage. */
  weapon: WeaponStats
  /** What the next sidebar gift pays. */
  gift: number
  /** The ship being built in the designer. The core is always present. */
  designer: DesignerScene
  /** Designs the fighter bar can build, and which one is selected. */
  fleet: FleetScene
}

/** `fighter` is the stock hull. `saved` is the ship copied out of the designer. */
export type ProductionDesign = 'fighter' | 'saved'

export interface FleetChoice {
  id: ProductionDesign
  label: string
  /** Production units to build one. */
  units: number
  /** Occupied cells. The default fighter uses the miner hull. */
  cells: DesignerCell[]
}

export interface FleetScene {
  selected: ProductionDesign
  choices: FleetChoice[]
}

export interface Game {
  scene(): MapScene
  exportState(): MapState
  advance(dtMs: number): void
  upgradeMiner(upgrade: MinerUpgradeId): UpgradeResult
  upgradeMining(upgrade: MiningPurchase): UpgradeResult
  upgradeFighterStat(upgrade: FighterUpgradeId): UpgradeResult
  upgradeEnemy(upgrade: EnemyUpgradeId): UpgradeResult
  /** Buys one laser or missile upgrade. Refused until that weapon is owned. */
  upgradeWeapon(upgrade: WeaponUpgradeId): UpgradeResult | 'unknown'
  claimGift(): void
  upgradesToShipDesign(): void
  skipLevelOne(): void
  unlockDesigner(): UpgradeResult
  /** Buys a laser or a missile for the designer. Refused before the designer is owned. */
  unlockWeapon(id: string): UpgradeResult | 'unknown'
  /** Buys a medium or large engine for the designer. Refused before the designer is owned. */
  unlockEngine(id: string): UpgradeResult | 'unknown'
  placeComponent(component: string, x: number, y: number, rotation: number): DesignResult
  /** Copies the current grid into the design the rest of the game uses. */
  saveDesign(): DesignResult
  /** Replaces the designer grid from a design file. */
  importDesign(file: unknown): DesignResult
  /** Takes every part off the designer grid. */
  resetDesign(): DesignResult
  /** Picks which ship the fighter bar builds. */
  chooseProduction(design: string): DesignResult
  removeComponent(id: string): DesignResult
  designPreview(component: string, x: number, y: number, rotation: number): DesignGhost | null
}
