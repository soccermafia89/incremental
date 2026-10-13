import type { GameConfig } from '../../data/GameConfig'
import type { EnemyLevels, EnemyUpgradeId } from '../../data/enemy/upgrades'
import { ENEMY_UPGRADE_IDS, blankEnemyLevels } from '../../data/enemy/upgrades'
import { upgradeMaxed, upgradePrice, upgradeValue } from '../../data/upgradeSpec'

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
    return upgradeMaxed(config.enemyUpgrades[upgrade], this.purchased[upgrade])
  }

  upgrade(upgrade: EnemyUpgradeId): void {
    this.purchased[upgrade] += 1
  }

  /** Spawn rate's factor is 1, so only the other purchases change the payout. */
  bountyMultiplier(config: GameConfig): number {
    let factor = 1
    for (const id of ENEMY_UPGRADE_IDS) {
      factor *= (config.enemyUpgrades[id].bounty ?? 1) ** this.purchased[id]
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

  /**
   * The upgrade value is the base. Golden and the tractor beam each multiply that whole
   * number, and the shot uses the product.
   */
  shotDamage(config: GameConfig, golden: boolean, attacking: boolean): number {
    const base = this.value('damage', config)
    const goldenBy = golden ? config.golden.rivalDamage / upgradeValue(config.enemyUpgrades.damage, 0) : 1
    const attackBy = attacking ? 2 : 1
    return Math.round(base * goldenBy * attackBy)
  }

  /** Rate 1 waits four shot intervals. Golden divides that wait again. */
  shotInterval(config: GameConfig, golden: boolean): number {
    const rate = this.value('attackRate', config)
    const start = upgradeValue(config.enemyUpgrades.attackRate, 0)
    const interval = Math.round(config.ships.shotIntervalMs * 4 * start / rate)
    return golden ? Math.round(interval / config.golden.rivalFire) : interval
  }

  /** Rate 1 waits the full replenish interval. Each doubled rate cuts that wait in half. */
  replenishInterval(config: GameConfig): number {
    const rate = this.value('spawnRate', config)
    const start = upgradeValue(config.enemyUpgrades.spawnRate, 0)
    return Math.round(config.rival.replenishMs * start / rate)
  }
}
