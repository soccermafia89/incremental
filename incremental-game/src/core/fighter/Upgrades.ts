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
    return upgradeValue(config.fighterUpgrades[upgrade], this.purchased[upgrade])
  }

  price(upgrade: FighterUpgradeId, config: GameConfig): number {
    return upgradePrice(config.fighterUpgrades[upgrade], this.purchased[upgrade])
  }

  maxed(upgrade: FighterUpgradeId, config: GameConfig): boolean {
    return this.value(upgrade, config) >= config.fighterUpgrades[upgrade].max
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
