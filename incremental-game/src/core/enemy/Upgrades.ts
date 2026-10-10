import type { GameConfig } from '../../data/GameConfig'
import type { EnemyLevels, EnemyUpgradeId } from '../../data/enemy/upgrades'
import { ENEMY_UPGRADE_IDS, blankEnemyLevels } from '../../data/enemy/upgrades'
import { upgradePrice, upgradeValue } from '../../data/upgradeSpec'

export interface EnemyStats {
  values: EnemyLevels
  costs: Record<EnemyUpgradeId, number | null>
  /** Product of each upgrade's bounty factor raised to how many times it was bought. */
  bounty: number
}

/** Purchases that change the opposing fleet. */
export class EnemyUpgrades {
  private readonly purchased: EnemyLevels

  private constructor(purchased: EnemyLevels) {
    this.purchased = purchased
  }

  static create(): EnemyUpgrades {
    return new EnemyUpgrades(blankEnemyLevels())
  }

  static restore(purchased: EnemyLevels): EnemyUpgrades {
    return new EnemyUpgrades({ ...purchased })
  }

  levels(): EnemyLevels {
    return { ...this.purchased }
  }

  value(upgrade: EnemyUpgradeId, config: GameConfig): number {
    return upgradeValue(config.enemyUpgrades[upgrade], this.purchased[upgrade])
  }

  price(upgrade: EnemyUpgradeId, config: GameConfig): number {
    return upgradePrice(config.enemyUpgrades[upgrade], this.purchased[upgrade])
  }

  maxed(upgrade: EnemyUpgradeId, config: GameConfig): boolean {
    if (upgrade === 'capacity') return this.capacityMaxed(config)
    return this.value(upgrade, config) >= config.enemyUpgrades[upgrade].max
  }

  /** Level 0 is unpurchased. Later levels are start, then start + step, up to max. */
  private capacityMaxed(config: GameConfig): boolean {
    const level = this.purchased.capacity
    if (level === 0) return false
    const spec = config.enemyUpgrades.capacity
    return spec.start + (level - 1) * spec.step >= spec.max
  }

  upgrade(upgrade: EnemyUpgradeId): void {
    this.purchased[upgrade] += 1
  }

  /** Spawn rate's factor is 1, so only the other purchases change the payout. */
  bountyMultiplier(config: GameConfig): number {
    let factor = 1
    for (const id of ENEMY_UPGRADE_IDS) {
      factor *= config.enemyUpgrades[id].bounty ** this.purchased[id]
    }
    return factor
  }

  stats(config: GameConfig): EnemyStats {
    const values = {} as EnemyStats['values']
    const costs = {} as EnemyStats['costs']
    for (const id of ENEMY_UPGRADE_IDS) {
      values[id] = this.value(id, config)
      costs[id] = this.maxed(id, config) ? null : this.price(id, config)
    }
    return { values, costs, bounty: this.bountyMultiplier(config) }
  }

  health(config: GameConfig): number {
    return this.value('health', config)
  }

  /** Golden scales the upgraded damage by the same ratio it used on the old base damage. */
  shotDamage(config: GameConfig, golden: boolean): number {
    const base = this.value('damage', config)
    if (!golden) return base
    return Math.round(base * config.golden.rivalDamage / config.enemyUpgrades.damage.start)
  }

  /** Rate 1 waits a full shot interval. Golden divides that wait again. */
  shotInterval(config: GameConfig, golden: boolean): number {
    const rate = this.value('attackRate', config)
    const start = config.enemyUpgrades.attackRate.start
    const interval = Math.round(config.ships.shotIntervalMs * start / rate)
    return golden ? Math.round(interval / config.golden.rivalFire) : interval
  }

  /** Rate 1 waits the full replenish interval. Higher rates shorten it. */
  replenishInterval(config: GameConfig): number {
    const rate = this.value('spawnRate', config)
    const start = config.enemyUpgrades.spawnRate.start
    return Math.round(config.rival.replenishMs * start / rate)
  }
}
