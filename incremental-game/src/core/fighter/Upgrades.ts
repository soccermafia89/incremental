import type { GameConfig } from '../../data/GameConfig'
import type { FighterLevels, FighterUpgradeId } from '../../data/fighter/upgrades'
import { FIGHTER_UPGRADE_IDS, blankFighterLevels } from '../../data/fighter/upgrades'
import { upgradeCrystal, upgradeMaxed, upgradePrice, upgradeValue } from '../../data/upgradeSpec'

/** Seconds to build one fighter before the production multiplier. The table scales that rate. */
const BASE_BUILD_SECONDS = 25

export interface FighterStats {
  values: FighterLevels
  costs: Record<FighterUpgradeId, number | null>
  /** The next fighter-count purchase is paid in crystals. */
  countCrystals: boolean
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

  /** Units per second. The table's value multiplies the base rate. */
  private productionRate(config: GameConfig): number {
    const rating = upgradeValue(config.fighterUpgrades.production, this.purchased.production)
    return config.fighter.units / BASE_BUILD_SECONDS * rating
  }

  price(upgrade: FighterUpgradeId, config: GameConfig): number {
    return upgradePrice(config.fighterUpgrades[upgrade], this.purchased[upgrade])
  }

  /** True when the next count purchase is one of the crystal rows. */
  countPaysCrystals(config: GameConfig): boolean {
    return upgradeCrystal(config.fighterUpgrades.count, this.purchased.count) && !this.maxed('count', config)
  }

  maxed(upgrade: FighterUpgradeId, config: GameConfig): boolean {
    return upgradeMaxed(config.fighterUpgrades[upgrade], this.purchased[upgrade])
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
    return { values, costs, countCrystals: this.countPaysCrystals(config) }
  }

  /** The first speed row is full ship speed. */
  speed(config: GameConfig): number {
    const rating = this.value('speed', config)
    return config.ships.speed * (rating / upgradeValue(config.fighterUpgrades.speed, 0))
  }

  travel(dtMs: number, config: GameConfig): number {
    return this.speed(config) * (dtMs / 1000)
  }

  interval(config: GameConfig): number {
    const rate = this.value('attackRate', config)
    const start = upgradeValue(config.fighterUpgrades.attackRate, 0)
    return Math.round(config.ships.shotIntervalMs * start / rate)
  }

  damage(config: GameConfig): number {
    return this.value('damage', config)
  }

  health(config: GameConfig): number {
    return this.value('health', config)
  }
}
