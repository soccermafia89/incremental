import type { GameConfig } from '../../data/GameConfig'
import { loadGameConfig } from '../../data/GameConfig'
import type { EnemyUpgradeId } from '../../data/enemy/upgrades'
import type { WeaponUpgradeId } from '../../data/weapons/upgrades'
import type { FighterUpgradeId } from '../../data/fighter/upgrades'
import type { MiningPurchase } from '../../data/mining'
import { readDesignFile, type DesignGhost, type DesignResult } from '../designer'
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

  upgradeWeapon(upgrade: WeaponUpgradeId): UpgradeResult | 'unknown' {
    return this.map.upgradeWeapon(upgrade)
  }

  claimGift(): void {
    this.map.claimGift()
  }

  upgradesToShipDesign(): void {
    this.map.upgradesToShipDesign()
  }

  skipLevelOne(): void {
    this.map.skipLevelOne()
  }

  unlockDesigner(): UpgradeResult {
    return this.map.unlockDesigner()
  }

  unlockWeapon(id: string): UpgradeResult | 'unknown' {
    return this.map.unlockWeapon(id)
  }

  unlockEngine(id: string): UpgradeResult | 'unknown' {
    return this.map.unlockEngine(id)
  }

  placeComponent(component: string, x: number, y: number, rotation: number): DesignResult {
    return this.map.placeComponent(component, x, y, rotation)
  }

  saveDesign(): DesignResult {
    return this.map.saveDesign()
  }

  resetDesign(): DesignResult {
    return this.map.resetDesign()
  }

  importDesign(file: unknown): DesignResult {
    let parts
    try {
      parts = readDesignFile(file)
    } catch {
      return 'layout'
    }
    return this.map.importDesign(parts)
  }

  chooseProduction(design: string): DesignResult {
    return this.map.chooseProduction(design)
  }

  removeComponent(id: string): DesignResult {
    return this.map.removeComponent(id)
  }

  designPreview(component: string, x: number, y: number, rotation: number): DesignGhost | null {
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
