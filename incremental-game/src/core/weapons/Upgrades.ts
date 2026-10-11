import type { GameConfig } from '../../data/GameConfig'
import { WEAPON_UPGRADE_IDS, blankWeaponLevels, type WeaponLevels, type WeaponUpgradeId } from '../../data/weapons/upgrades'
import { upgradePrice, upgradeValue } from '../../data/upgradeSpec'

export interface WeaponStats {
  values: WeaponLevels
  costs: Record<WeaponUpgradeId, number | null>
}

/** Purchases that change the designed laser and missile. */
export class WeaponUpgrades {
  private readonly purchased: WeaponLevels

  private constructor(purchased: WeaponLevels) {
    this.purchased = purchased
  }

  static create(): WeaponUpgrades {
    return new WeaponUpgrades(blankWeaponLevels())
  }

  static restore(purchased: WeaponLevels): WeaponUpgrades {
    return new WeaponUpgrades({ ...purchased })
  }

  levels(): WeaponLevels {
    return { ...this.purchased }
  }

  value(upgrade: WeaponUpgradeId, config: GameConfig): number {
    return upgradeValue(config.weaponUpgrades[upgrade], this.purchased[upgrade])
  }

  price(upgrade: WeaponUpgradeId, config: GameConfig): number {
    return upgradePrice(config.weaponUpgrades[upgrade], this.purchased[upgrade])
  }

  maxed(upgrade: WeaponUpgradeId, config: GameConfig): boolean {
    return this.value(upgrade, config) >= config.weaponUpgrades[upgrade].max
  }

  upgrade(upgrade: WeaponUpgradeId): void {
    this.purchased[upgrade] += 1
  }

  stats(config: GameConfig): WeaponStats {
    const values = {} as WeaponStats['values']
    const costs = {} as WeaponStats['costs']
    for (const id of WEAPON_UPGRADE_IDS) {
      values[id] = this.value(id, config)
      costs[id] = this.maxed(id, config) ? null : this.price(id, config)
    }
    return { values, costs }
  }

  /** How far a laser reaches. The part's range before any purchase. */
  laserRange(config: GameConfig): number {
    return this.value('laserRange', config)
  }

  /** Energy a laser draws. The part starts negative; each purchase moves it toward zero. */
  laserEnergy(config: GameConfig): number {
    return config.designer.components.laser.energy + this.value('laserEnergy', config)
  }

  cannonRate(config: GameConfig): number {
    return this.value('cannonFireRate', config)
  }

  cannonDamage(config: GameConfig): number {
    return this.value('cannonDamage', config)
  }

  /** Milliseconds between shots of one cannon, split across every cannon that can reach. */
  cannonInterval(config: GameConfig, guns: number): number {
    return ratedInterval(config.weaponUpgrades.cannonFireRate, this.cannonRate(config), guns)
  }

  missileRate(config: GameConfig): number {
    return this.value('missileFireRate', config)
  }

  missileDamage(config: GameConfig): number {
    return this.value('missileDamage', config)
  }

  /** Milliseconds between shots of one missile, split across every missile that can reach. */
  missileInterval(config: GameConfig, guns: number): number {
    return ratedInterval(config.weaponUpgrades.missileFireRate, this.missileRate(config), guns)
  }
}

function ratedInterval(spec: { baseMs: number; start: number }, rate: number, guns: number): number {
  if (guns <= 0 || rate <= 0) return spec.baseMs
  return Math.max(1, Math.round(spec.baseMs * spec.start / rate / guns))
}
