import type { CorvetteLevels } from '../../data/corvette/upgrades'
import type { CorvetteStats } from '../corvette/Upgrades'
import type { DefenseLevels, DefenseUpgradeId } from '../../data/defense/upgrades'
import type { DefenseStats } from '../defense/Upgrades'
import type { CorvetteUpgradeId } from '../../data/corvette/upgrades'
import type { EnemyLevels, EnemyUpgradeId } from '../../data/enemy/upgrades'
import type { FighterLevels, FighterUpgradeId } from '../../data/fighter/upgrades'
import type { MiningLevels, MiningPurchase } from '../../data/mining'
import type { EnemyStats } from '../enemy/Upgrades'
import type { FighterStats } from '../fighter/Upgrades'
import type { UpgradeLevels } from '../../data/upgrades'
import type { WeaponLevels, WeaponUpgradeId } from '../../data/weapons/upgrades'
import type { WeaponStats } from '../weapons/Upgrades'
import type { AsteroidState } from '../asteroid/AsteroidField'
import type { DesignGhost, DesignResult, DesignerCell, DesignerScene, NamedDesign, PlacedPart } from '../designer'
import type { MiningStats } from '../mining/Mining'
import type { HullCell, MinerStats, MinerUpgradeId, ShipRole, ShipState, Side, UpgradeResult } from '../miner'
import type { OreState } from '../ore/OreField'
import type { ShotState } from '../shot/Shot'

export interface MapState {
  money: number
  /** Crystals. A ship that destroys a corvette gains one. A base cannon kill does not. */
  crystals: number
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
  corvetteLevels: CorvetteLevels
  /** True once the enemy corvette unlock is bought. */
  corvette: boolean
  /** Time already waited toward the next corvette. The clock runs only while under the cap. */
  corvetteElapsedMs: number
  defenseLevels: DefenseLevels
  /** Time already waited toward the next defense platform. The clock runs only while none is standing. */
  defenseElapsedMs: number
  weaponLevels: WeaponLevels
  tractorBeam: boolean
  golden: boolean
  /** The Mining tab stays once this is bought. */
  miningUnlocked: boolean
  /** Asteroids and our miners are gone. Income is one lump on a timer. */
  automine: boolean
  /** Time already waited toward the next automine payout. */
  automineElapsedMs: number
  /** Money above the converter line becomes one crystal. The Mining tab then hides. */
  moneyConverter: boolean
  /** A ship destroyed a corvette that was carrying a missile. A base cannon kill does not set this. */
  missileCorvetteKilled: boolean
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
  /** The design the rest of the game uses. Null until Save design. It is the latest named ship. */
  savedDesign: PlacedPart[] | null
  /** Saved layouts, named ship1, ship2, and so on. The last one is `savedDesign`. */
  designs: NamedDesign[]
  /** Production bays. The first is always open. Each bay keeps its own ships. */
  bays: ProductionBay[]
  /** Player miners bought and not yet on the field. */
  pendingMiners: number
  /** Production already spent on the miner at the front of that queue, in unit-milliseconds. */
  minerWork: number
  /** One miner finished and waiting for a free slot. The build bar stays full until it launches. */
  minerReady: number
  /** Fighters finished and waiting for a free slot. Each entry is `fighter` or a saved ship name. */
  fighterQueue: string[]
  /** Defense platforms finished and waiting for the one deployed platform to be destroyed. */
  platformReady: number
  /** How many rival miners the opposing base is allowed to have. */
  rivalCap: number
  /** Time already waited toward the next replacement of a destroyed rival miner. */
  rivalElapsedMs: number
  /** True once the player fleet has crossed the size that grows the rival cap. */
  fleetAnswered: boolean
  /** What the next sidebar gift pays. The first claim jumps to `giftNext`, then each claim doubles. */
  gift: number
  /** What the next sidebar crystal button pays. Doubles after each claim. */
  crystalGift: number
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
  crystals: number
  /** A ship has destroyed a missile corvette. The weapons page can then unlock missiles. */
  missileCorvetteKilled: boolean
  asteroids: AsteroidState[]
  ores: { id: string; x: number; y: number; kind: AsteroidState['kind'] }[]
  shots: { id: string; x: number; y: number; side: Side; splash: boolean; mining: boolean; heavy: boolean; angle: number }[]
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
  /** Fill from 0 to 1 on the miner bar. Null before any miner is kept, and after automine. */
  nextMiner: { progress: number; cells: { x: number; y: number; color: string }[] } | null
  /** Fighter stats. Count is how many fighters are kept, starting at none. */
  fighter: FighterStats
  /** Fill from 0 to 1 on the first bay. Null before the first fighter. Cells are the saved design, or the miner hull for the default fighter. */
  nextFighter: { progress: number; cells: { x: number; y: number; color: string }[] } | null
  /** Unlocked extra bays. `index` is the bay's place in the list. The bar stays while the bay is idle. */
  nextBays: { index: number; progress: number; cells: { x: number; y: number; color: string }[] }[]
  /** Opposing-fleet purchases. Spawn rate is how fast destroyed ships return. */
  enemy: EnemyStats
  /** Enemy corvette unlock and the upgrades that follow it. */
  corvette: CorvetteStats
  /** Defense platform capacity and the stats that follow it. */
  defense: DefenseStats
  /** Laser range and energy reduction, and missile fire rate and damage. */
  weapon: WeaponStats
  /** What the next sidebar gift pays. The first claim jumps to `giftNext`, then each claim doubles. */
  gift: number
  /** What the next sidebar crystal button pays. */
  crystalGift: number
  /** The ship being built in the designer. The core is always present. */
  designer: DesignerScene
  /** Designs the fighter bar can build, and which one is selected. */
  fleet: FleetScene
}

/** `fighter` is the stock hull. A saved ship is its name, `ship1`, `ship2`, and so on. */
export type ProductionDesign = string

/** One production bay. Bay 0's ship cap is the fighter count. An extra bay stores its own. */
export interface ProductionBay {
  design: ProductionDesign
  pending: number
  /** Production already spent on the ship on this bar, in unit-milliseconds. */
  work: number
  /** Money purchases that multiply this bay's build rate. */
  production: number
  /** Capacity purchases on an extra bay. Bay 0 leaves this at 0 and uses the fighter count. */
  capacity: number
}

export interface FleetChoice {
  id: ProductionDesign
  label: string
  /** Production units to build one. */
  units: number
  /** Occupied cells. The default fighter uses the miner hull. */
  cells: DesignerCell[]
}

export interface FleetBayScene {
  /** Place in the bay list. The first bar is 0 and is not in this list. */
  index: number
  owned: boolean
  /** Crystal price while locked. Null once the bay is open. */
  crystal: number | null
  selected: ProductionDesign
  /** Units per second once the bay is open. Null while it is locked. */
  rate: number | null
  /** Production levels bought on this bay. Null while it is locked. */
  production: number | null
  /** Money for the next production level. Null while locked or at max. */
  productionCost: number | null
  /** Ships this bay keeps. Null while the bay is locked. */
  capacity: number | null
  /** Money for the next capacity level. Null while locked or at max. */
  capacityCost: number | null
}

export interface FleetScene {
  selected: ProductionDesign
  choices: FleetChoice[]
  /** Units per second on the first bay. */
  rate: number
  /** Production levels bought on the first bay. */
  production: number
  /** Money for the next production level on the first bay. Null at max. */
  productionCost: number | null
  /** Ships the first bay keeps. That is the fighter count. */
  capacity: number
  /** Price of the next fighter on the first bay. Null at max. */
  capacityCost: number | null
  /** The next fighter on the first bay is paid in crystals. */
  capacityCrystals: boolean
  /** Owned extra bays, then the next locked bay while another cost remains. */
  bays: FleetBayScene[]
}

export interface Game {
  scene(): MapScene
  exportState(): MapState
  advance(dtMs: number): void
  upgradeMiner(upgrade: MinerUpgradeId): UpgradeResult
  upgradeMining(upgrade: MiningPurchase): UpgradeResult
  upgradeFighterStat(upgrade: FighterUpgradeId): UpgradeResult
  upgradeEnemy(upgrade: EnemyUpgradeId): UpgradeResult
  unlockCorvette(): UpgradeResult
  upgradeCorvette(upgrade: CorvetteUpgradeId): UpgradeResult
  /** Buys one defense-platform upgrade. Refused until rivals are attacking, and stats until capacity is owned. */
  upgradeDefense(upgrade: DefenseUpgradeId): UpgradeResult | 'unknown'
  /** Buys one laser or missile upgrade. Refused until that weapon is owned. */
  upgradeWeapon(upgrade: WeaponUpgradeId): UpgradeResult | 'unknown'
  claimGift(): void
  claimCrystalGift(): void
  upgradesToShipDesign(): void
  skipLevelOne(): void
  unlockDesigner(): UpgradeResult
  /** Buys a laser or a missile for the designer. Refused before the designer is owned. */
  unlockWeapon(id: string): UpgradeResult | 'unknown'
  /** Buys a medium or large engine for the designer. Refused before the designer is owned. */
  unlockEngine(id: string): UpgradeResult | 'unknown'
  placeComponent(component: string, x: number, y: number, rotation: number): DesignResult
  /** Copies the current grid into the design the rest of the game uses, and names it ship1, ship2, ... */
  saveDesign(): DesignResult
  /** Puts a named save back on the designer grid. The ship the fleet builds stays the latest save. */
  loadDesign(name: string): DesignResult
  /** Replaces one named ship with the current grid. */
  rewriteDesign(name: string): DesignResult
  /** Removes one named ship and renames the rest. A bay building a removed ship returns to the fighter. */
  deleteDesign(name: string): DesignResult
  /** Replaces the designer grid from a design file. */
  importDesign(file: unknown): DesignResult
  /** Takes every part off the designer grid. */
  resetDesign(): DesignResult
  /** Picks which ship a fleet bay builds. `bay` is the list index and defaults to the first bar. */
  chooseProduction(design: string, bay?: number): DesignResult
  /** Opens the next production bay for its crystal cost. Refused before the designer is owned. */
  unlockBay(): UpgradeResult | 'unknown'
  /** Buys one production level for a bay. Each level multiplies that bay's rate. */
  upgradeBay(bay: number): UpgradeResult | 'unknown'
  /** Raises how many ships one bay keeps. Bay 0 buys the fighter count. */
  upgradeBayCapacity(bay: number): UpgradeResult | 'unknown'
  removeComponent(id: string): DesignResult
  designPreview(component: string, x: number, y: number, rotation: number): DesignGhost | null
}
