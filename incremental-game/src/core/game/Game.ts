import type { GameConfig } from '../../data/GameConfig'
import { loadGameConfig } from '../../data/GameConfig'
import type { EnemyUpgradeId } from '../../data/enemy/upgrades'
import type { FighterUpgradeId } from '../../data/fighter/upgrades'
import type { MiningPurchase } from '../../data/mining'
import type { DesignResult } from '../designer/Design'
import type { MinerUpgradeId, UpgradeResult } from '../miner'
import { MapSim } from '../map/MapSim'
import { Rng } from './rng'
import type { Game, MapScene, MapState } from './state'

export type { Game, MapScene, MapState } from './state'

/** Glue. The map, the miners, and the clock live in their own components. */
export class GameImpl implements Game {
  private readonly map: MapSim

  private constructor(map: MapSim) {
    this.map = map
  }

  static create(config: GameConfig = loadGameConfig(), seed: number = Date.now()): GameImpl {
    return new GameImpl(MapSim.open(config, new Rng(seed)))
  }

  static restore(config: GameConfig, state: MapState): GameImpl {
    return new GameImpl(MapSim.restore(config, new Rng(state.rngState), state))
  }

  upgradeMiner(upgrade: MinerUpgradeId): UpgradeResult {
    return this.map.upgrade(upgrade)
  }

  upgradeMining(upgrade: MiningPurchase): UpgradeResult {
    return this.map.upgradeMining(upgrade)
  }

  upgradeFighterStat(upgrade: FighterUpgradeId): UpgradeResult {
    return this.map.upgradeFighterStat(upgrade)
  }

  upgradeEnemy(upgrade: EnemyUpgradeId): UpgradeResult {
    return this.map.upgradeEnemy(upgrade)
  }

  claimGift(): void {
    this.map.claimGift()
  }

  skipLevelOne(): void {
    this.map.skipLevelOne()
  }

  unlockDesigner(): UpgradeResult {
    return this.map.unlockDesigner()
  }

  placeComponent(component: string, x: number, y: number, rotation: number): DesignResult {
    return this.map.placeComponent(component, x, y, rotation)
  }

  removeComponent(id: string): DesignResult {
    return this.map.removeComponent(id)
  }

  designPreview(component: string, x: number, y: number, rotation: number): { x: number; y: number }[] | null {
    return this.map.designPreview(component, x, y, rotation)
  }

  advance(dtMs: number): void {
    this.map.advance(dtMs)
  }

  scene(): MapScene {
    return this.map.scene()
  }

  exportState(): MapState {
    return this.map.exportState()
  }
}
