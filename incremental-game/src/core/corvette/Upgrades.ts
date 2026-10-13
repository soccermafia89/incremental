import type { GameConfig } from '../../data/GameConfig'
import type { CorvetteLevels, CorvetteUpgradeId } from '../../data/corvette/upgrades'
import { CORVETTE_UPGRADE_IDS, blankCorvetteLevels } from '../../data/corvette/upgrades'
import { upgradeCrystal, upgradeMaxed, upgradePrice, upgradeValue } from '../../data/upgradeSpec'

export interface CorvetteStats {
  owned: boolean
  /** Unlock price, or null once the ship is owned. */
  cost: number | null
  values: CorvetteLevels
  costs: Record<CorvetteUpgradeId, number | null>
  crystals: Record<CorvetteUpgradeId, boolean>
}

/** Purchases for the enemy corvette. The unlock itself lives on the map. */
export class CorvetteUpgrades {
  private readonly purchased: CorvetteLevels

  private constructor(purchased: CorvetteLevels) {
    this.purchased = purchased
  }

  static create(): CorvetteUpgrades {
    return new CorvetteUpgrades(blankCorvetteLevels())
  }

  static restore(purchased: CorvetteLevels): CorvetteUpgrades {
    return new CorvetteUpgrades({ ...purchased })
  }

  levels(): CorvetteLevels {
    return { ...this.purchased }
  }

  value(upgrade: CorvetteUpgradeId, config: GameConfig): number {
    return upgradeValue(config.corvetteUpgrades[upgrade], this.purchased[upgrade])
  }

  price(upgrade: CorvetteUpgradeId, config: GameConfig): number {
    return upgradePrice(config.corvetteUpgrades[upgrade], this.purchased[upgrade])
  }

  paysCrystals(upgrade: CorvetteUpgradeId, config: GameConfig): boolean {
    return upgradeCrystal(config.corvetteUpgrades[upgrade], this.purchased[upgrade])
  }

  maxed(upgrade: CorvetteUpgradeId, config: GameConfig): boolean {
    return upgradeMaxed(config.corvetteUpgrades[upgrade], this.purchased[upgrade])
  }

  upgrade(upgrade: CorvetteUpgradeId): void {
    this.purchased[upgrade] += 1
  }

  /** The missile purchase is owned. Corvettes then carry that weapon, and crystals double. */
  hasMissiles(): boolean {
    return this.purchased.missiles > 0
  }

  /** The unlock allows one. Each capacity purchase adds another. */
  cap(owned: boolean, config: GameConfig): number {
    if (!owned) return 0
    return 1 + this.value('capacity', config)
  }

  health(config: GameConfig): number {
    return this.value('health', config)
  }

  damage(config: GameConfig): number {
    return this.value('damage', config)
  }

  /** Rate 1 waits shotMs. Higher rates shorten that wait. */
  interval(config: GameConfig): number {
    const rate = this.value('attackRate', config)
    const start = upgradeValue(config.corvetteUpgrades.attackRate, 0)
    return Math.max(1, Math.round(config.corvette.shotMs * start / rate))
  }

  /** Rate 1 moves at speedScale of ship speed. */
  travel(dtMs: number, config: GameConfig): number {
    const rate = this.value('speed', config)
    const start = upgradeValue(config.corvetteUpgrades.speed, 0)
    const speed = config.ships.speed * config.corvette.speedScale * (rate / start)
    return speed * (dtMs / 1000)
  }

  /** Rate 1 waits spawnMs. Each doubled rate cuts that wait in half. */
  spawnInterval(config: GameConfig): number {
    const rate = this.value('spawnRate', config)
    const start = upgradeValue(config.corvetteUpgrades.spawnRate, 0)
    return Math.max(1, Math.round(config.corvette.spawnMs * start / rate))
  }

  stats(config: GameConfig, owned: boolean): CorvetteStats {
    const values = {} as CorvetteStats['values']
    const costs = {} as CorvetteStats['costs']
    const crystals = {} as CorvetteStats['crystals']
    for (const id of CORVETTE_UPGRADE_IDS) {
      values[id] = id === 'capacity' ? this.cap(owned, config) : this.value(id, config)
      costs[id] = !owned || this.maxed(id, config) ? null : this.price(id, config)
      crystals[id] = this.paysCrystals(id, config)
    }
    return {
      owned,
      cost: owned ? null : config.corvette.cost,
      values,
      costs,
      crystals,
    }
  }
}
