import type { GameConfig } from '../../data/GameConfig'
import type { AsteroidField } from '../asteroid/AsteroidField'
import type { Bank } from '../base/Bank'
import type { MapLayout } from '../map/Layout'
import type { MiningUpgrades } from '../mining/Mining'
import type { OreField } from '../ore/OreField'
import type { Volley } from '../shot/Shot'
import type { EnemyUpgrades } from '../enemy/Upgrades'
import type { FighterUpgrades } from '../fighter/Upgrades'
import type { MinerUpgrades } from './Upgrades'

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
  mining: MiningUpgrades
  bank: Bank
}
