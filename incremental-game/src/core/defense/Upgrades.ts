import type { GameConfig } from '../../data/GameConfig'
import type { DefenseLevels, DefenseUpgradeId } from '../../data/defense/upgrades'
import { DEFENSE_UPGRADE_IDS, blankDefenseLevels } from '../../data/defense/upgrades'
import { upgradeCrystal, upgradeMaxed, upgradePrice, upgradeValue } from '../../data/upgradeSpec'

export interface DefenseStats {
  values: DefenseLevels
  costs: Record<DefenseUpgradeId, number | null>
  crystals: Record<DefenseUpgradeId, boolean>
  /** Seconds to build the one platform. */
  buildSeconds: number
  /** Seconds between cannon shots at the current attack rate. */
  shotSeconds: number
  range: number
  /** 0 to 1 while the platform is under construction. Null when one is standing or none is allowed. */
  building: number | null
}

/** Purchases for the stationary defense platform. */
export class DefenseUpgrades {
  private readonly purchased: DefenseLevels

  private constructor(purchased: DefenseLevels) {
    this.purchased = purchased
  }

  static create(): DefenseUpgrades {
    return new DefenseUpgrades(blankDefenseLevels())
  }

  static restore(purchased: DefenseLevels): DefenseUpgrades {
    return new DefenseUpgrades({ ...purchased })
  }

  levels(): DefenseLevels {
    return { ...this.purchased }
  }

  value(upgrade: DefenseUpgradeId, config: GameConfig): number {
    return upgradeValue(config.defenseUpgrades[upgrade], this.purchased[upgrade])
  }

  /** True once the single capacity purchase has been bought. */
  owned(config: GameConfig): boolean {
    return this.value('capacity', config) >= 1
  }

  price(upgrade: DefenseUpgradeId, config: GameConfig): number {
    return upgradePrice(config.defenseUpgrades[upgrade], this.purchased[upgrade])
  }

  paysCrystals(upgrade: DefenseUpgradeId, config: GameConfig): boolean {
    return upgradeCrystal(config.defenseUpgrades[upgrade], this.purchased[upgrade])
  }

  maxed(upgrade: DefenseUpgradeId, config: GameConfig): boolean {
    return upgradeMaxed(config.defenseUpgrades[upgrade], this.purchased[upgrade])
  }

  range(config: GameConfig): number {
    return Math.round(config.cannon.range * config.defense.rangeScale)
  }

  interval(config: GameConfig): number {
    const start = upgradeValue(config.defenseUpgrades.attackRate, 0)
    return Math.round(config.defense.shotMs * start / this.value('attackRate', config))
  }

  buy(upgrade: DefenseUpgradeId): void {
    this.purchased[upgrade] += 1
  }

  stats(config: GameConfig, building: number | null): DefenseStats {
    const values = {} as DefenseLevels
    const costs = {} as Record<DefenseUpgradeId, number | null>
    const crystals = {} as Record<DefenseUpgradeId, boolean>
    for (const id of DEFENSE_UPGRADE_IDS) {
      values[id] = this.value(id, config)
      const locked = id !== 'capacity' && !this.owned(config)
      costs[id] = this.maxed(id, config) || locked ? null : this.price(id, config)
      crystals[id] = this.paysCrystals(id, config)
    }
    return {
      values,
      costs,
      crystals,
      buildSeconds: config.defense.buildMs / 1000,
      shotSeconds: this.interval(config) / 1000,
      range: this.range(config),
      building,
    }
  }
}

/** Where a new platform appears, just off the player base. */
export function platformAnchor(config: GameConfig): { x: number; y: number } {
  return {
    x: config.map.baseX + config.map.baseRadius + 48,
    y: config.map.baseY - 56,
  }
}

/** How far short of a third of the map the platform holds, in pixels. */
const PLATFORM_STOP_INSET = 40

/** The platform drifts right to just short of a third of the map, then stays. */
export function platformStop(config: GameConfig): number {
  return config.map.width / 3 - PLATFORM_STOP_INSET
}
