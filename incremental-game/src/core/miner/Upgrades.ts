import type { GameConfig } from '../../data/GameConfig'
import { upgradeMaxed, upgradePrice, upgradeValue } from '../../data/upgradeSpec'
import { UPGRADE_IDS, blankLevels, type UpgradeLevels } from '../../data/upgrades'
import type { MinerStats, MinerUpgradeId, ShipState } from './types'

export class MinerUpgrades {
  private readonly purchased: UpgradeLevels

  private constructor(purchased: UpgradeLevels) {
    this.purchased = purchased
  }

  static create(): MinerUpgrades {
    return new MinerUpgrades(blankLevels())
  }

  static restore(purchased: UpgradeLevels): MinerUpgrades {
    return new MinerUpgrades({ ...purchased })
  }

  levels(): UpgradeLevels {
    return { ...this.purchased }
  }

  value(upgrade: MinerUpgradeId, config: GameConfig): number {
    return upgradeValue(config.upgrades[upgrade], this.purchased[upgrade])
  }

  price(upgrade: MinerUpgradeId, config: GameConfig): number {
    return upgradePrice(config.upgrades[upgrade], this.purchased[upgrade])
  }

  maxed(upgrade: MinerUpgradeId, config: GameConfig): boolean {
    return upgradeMaxed(config.upgrades[upgrade], this.purchased[upgrade])
  }

  upgrade(upgrade: MinerUpgradeId): void {
    this.purchased[upgrade] += 1
  }

  stats(config: GameConfig): MinerStats {
    const values = {} as MinerStats['values']
    const costs = {} as MinerStats['costs']
    for (const id of UPGRADE_IDS) {
      values[id] = this.value(id, config)
      costs[id] = this.maxed(id, config) ? null : this.price(id, config)
    }
    return { values, costs }
  }

  speedOf(ship: ShipState, config: GameConfig): number {
    if (ship.side !== 'player') {
      const answered = this.value('speed', config) >= config.rival.speedAt ? config.rival.speedBy : 1
      return config.ships.speed * answered
    }
    const rating = this.value('speed', config)
    return config.ships.speed * (rating / upgradeValue(config.upgrades.speed, 0))
  }

  intervalOf(ship: ShipState, config: GameConfig, rivalBoosted: boolean): number {
    if (ship.side !== 'player') {
      const interval = config.ships.shotIntervalMs
      return rivalBoosted ? Math.round(interval / config.golden.rivalFire) : interval
    }
    const rate = this.value('fireRate', config)
    return Math.round(config.ships.shotIntervalMs * upgradeValue(config.upgrades.fireRate, 0) / rate)
  }

  capacityOf(ship: ShipState, config: GameConfig, rivalBoosted: boolean): number {
    if (ship.role === 'fighter') return 0
    if (ship.side !== 'player') {
      const base = rivalBoosted ? config.golden.rivalCarry : upgradeValue(config.upgrades.carry, 0)
      const answered = this.value('carry', config) >= config.rival.carryAt ? config.rival.carryBy : 1
      return base * answered
    }
    return this.value('carry', config)
  }

  damageOf(ship: ShipState, config: GameConfig, rivalBoosted: boolean): number {
    if (ship.side !== 'player') return rivalBoosted ? config.golden.rivalDamage : upgradeValue(config.upgrades.damage, 0)
    return this.value('damage', config)
  }

  travel(ship: ShipState, dtMs: number, config: GameConfig): number {
    return this.speedOf(ship, config) * (dtMs / 1000)
  }
}
