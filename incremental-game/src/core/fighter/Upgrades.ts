import type { GameConfig } from '../../data/GameConfig'
import type { FighterLevels, FighterUpgradeId } from '../../data/fighter/upgrades'
import { FIGHTER_UPGRADE_IDS, blankFighterLevels } from '../../data/fighter/upgrades'
import { upgradePrice, upgradeValue } from '../../data/upgradeSpec'

export interface FighterStats {
  values: FighterLevels
  costs: Record<FighterUpgradeId, number | null>
}

/** Purchases that change only our fighter. */
export class FighterUpgrades {
  private readonly purchased: FighterLevels

  private constructor(purchased: FighterLevels) {
    this.purchased = purchased
  }

  static create(): FighterUpgrades {
    return new FighterUpgrades(blankFighterLevels())
  }

  static restore(purchased: FighterLevels): FighterUpgrades {
    return new FighterUpgrades({ ...purchased })
  }

  levels(): FighterLevels {
    return { ...this.purchased }
  }

  value(upgrade: FighterUpgradeId, config: GameConfig): number {
    if (upgrade === 'production') return this.productionRate(config)
    return upgradeValue(config.fighterUpgrades[upgrade], this.purchased[upgrade])
  }

  /** Units per second. Each purchase makes the build take 70% as long as the one before it. */
  private productionRate(config: GameConfig): number {
    const start = config.fighterUpgrades.production.start
    return start * (10 / 7) ** this.purchased.production
  }

  price(upgrade: FighterUpgradeId, config: GameConfig): number {
    if (upgrade === 'count') return this.countPrice(config)
    return upgradePrice(config.fighterUpgrades[upgrade], this.purchased[upgrade])
  }

  /** The first fighter is free. The next costs `cost`, then the price doubles. */
  private countPrice(config: GameConfig): number {
    const level = this.purchased.count
    if (level === 0) return 0
    return config.fighterUpgrades.count.cost * 2 ** (level - 1)
  }

  maxed(upgrade: FighterUpgradeId, config: GameConfig): boolean {
    const spec = config.fighterUpgrades[upgrade]
    if (upgrade === 'production') return this.purchased.production >= (spec.max - spec.start) / spec.step
    return this.value(upgrade, config) >= spec.max
  }

  upgrade(upgrade: FighterUpgradeId): void {
    this.purchased[upgrade] += 1
  }

  stats(config: GameConfig): FighterStats {
    const values = {} as FighterStats['values']
    const costs = {} as FighterStats['costs']
    for (const id of FIGHTER_UPGRADE_IDS) {
      values[id] = this.value(id, config)
      costs[id] = this.maxed(id, config) ? null : this.price(id, config)
    }
    return { values, costs }
  }

  /** Rating 10, the start, is the yaml ship speed. */
  speed(config: GameConfig): number {
    const rating = this.value('speed', config)
    return config.ships.speed * (rating / config.fighterUpgrades.speed.start)
  }

  travel(dtMs: number, config: GameConfig): number {
    return this.speed(config) * (dtMs / 1000)
  }

  interval(config: GameConfig): number {
    const rate = this.value('attackRate', config)
    const start = config.fighterUpgrades.attackRate.start
    return Math.round(config.ships.shotIntervalMs * start / rate)
  }

  damage(config: GameConfig): number {
    return this.value('damage', config)
  }

  health(config: GameConfig): number {
    return this.value('health', config)
  }
}
