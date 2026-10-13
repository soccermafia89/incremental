import type { GameConfig } from '../../data/GameConfig'
import type { AsteroidField } from '../asteroid/AsteroidField'
import type { Bank } from '../base/Bank'
import type { MapLayout } from '../map/Layout'
import type { MiningUpgrades } from '../mining/Mining'
import type { OreField } from '../ore/OreField'
import type { FiredShot, Volley } from '../shot/Shot'
import type { CorvetteUpgrades } from '../corvette/Upgrades'
import type { EnemyUpgrades } from '../enemy/Upgrades'
import type { FighterUpgrades } from '../fighter/Upgrades'
import type { WeaponUpgrades } from '../weapons/Upgrades'
import type { MinerUpgrades } from './Upgrades'
import type { Side } from './types'

/** The map pieces a miner reads and writes while it works. */
export interface MinerWorld {
  config: GameConfig
  layout: MapLayout
  asteroids: AsteroidField
  ore: OreField
  shots: Volley
  upgrades: MinerUpgrades
  fighterUpgrades: FighterUpgrades
  enemyUpgrades: EnemyUpgrades
  corvetteUpgrades: CorvetteUpgrades
  weaponUpgrades: WeaponUpgrades
  mining: MiningUpgrades
  bank: Bank
  /** Add crystals from a corvette destroyed by a ship. */
  gainCrystal(amount: number): void
  /** A ship destroyed a missile corvette. The base cannon does not count. */
  noteMissileCorvette(): void
  hit(shot: FiredShot): void
  /** Draw a line from a ship to its target for this step. */
  beam(from: { x: number; y: number }, to: { x: number; y: number }, side: Side): void
}
