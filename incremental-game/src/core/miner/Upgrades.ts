import type { GameConfig } from '../../data/GameConfig'
import { upgradePrice, upgradeValue } from '../../data/upgradeSpec'
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

  maxed(upgrade: MinerUpgradeId, config: GameConfig, playerCount: number, pendingMiners: number): boolean {
    return this.towardMax(upgrade, config, playerCount, pendingMiners) >= config.upgrades[upgrade].max
  }

  /** Returns true when the upgrade adds another player miner. */
  upgrade(upgrade: MinerUpgradeId): boolean {
    this.purchased[upgrade] += 1
    return upgrade === 'count'
  }

  stats(config: GameConfig, playerCount: number, pendingMiners: number): MinerStats {
    const values = {} as MinerStats['values']
    const costs = {} as MinerStats['costs']
    for (const id of UPGRADE_IDS) {
      values[id] = id === 'count' ? playerCount : this.value(id, config)
      const cap = this.towardMax(id, config, playerCount, pendingMiners)
      costs[id] = cap >= config.upgrades[id].max ? null : this.price(id, config)
    }
    return { values, costs }
  }

  speedOf(ship: ShipState, config: GameConfig): number {
    if (ship.side !== 'player') {
      const answered = this.value('speed', config) >= config.rival.speedAt ? config.rival.speedBy : 1
      return config.ships.speed * answered
    }
    const rating = this.value('speed', config)
    return config.ships.speed * (rating / config.upgrades.speed.start)
  }

  intervalOf(ship: ShipState, config: GameConfig, rivalBoosted: boolean): number {
    if (ship.side !== 'player') {
      const interval = config.ships.shotIntervalMs
      return rivalBoosted ? Math.round(interval / config.golden.rivalFire) : interval
    }
    const rate = this.value('fireRate', config)
    return Math.round(config.ships.shotIntervalMs * config.upgrades.fireRate.start / rate)
  }

  capacityOf(ship: ShipState, config: GameConfig, rivalBoosted: boolean): number {
    if (ship.role === 'fighter') return 0
    if (ship.side !== 'player') {
      const base = rivalBoosted ? config.golden.rivalCarry : config.upgrades.carry.start
      const answered = this.value('carry', config) >= config.rival.carryAt ? config.rival.carryBy : 1
      return base * answered
    }
    return this.value('carry', config)
  }

  damageOf(ship: ShipState, config: GameConfig, rivalBoosted: boolean): number {
    if (ship.side !== 'player') return rivalBoosted ? config.golden.rivalDamage : config.upgrades.damage.start
    return this.value('damage', config)
  }

  travel(ship: ShipState, dtMs: number, config: GameConfig): number {
    return this.speedOf(ship, config) * (dtMs / 1000)
  }

  /** Ships on the field, plus miners already paid for and still in the launch queue. */
  private towardMax(upgrade: MinerUpgradeId, config: GameConfig, playerCount: number, pendingMiners: number): number {
    return upgrade === 'count' ? playerCount + pendingMiners : this.value(upgrade, config)
  }
}
