import type { GameConfig } from '../../data/GameConfig'
import { WEAPON_UPGRADE_IDS, blankWeaponLevels, type WeaponLevels, type WeaponUpgradeId } from '../../data/weapons/upgrades'
import { upgradeCrystal, upgradeMaxed, upgradePrice, upgradeValue } from '../../data/upgradeSpec'

export interface WeaponStats {
  values: WeaponLevels
  costs: Record<WeaponUpgradeId, number | null>
  /** True when the next purchase of that upgrade spends crystals. */
  crystals: Record<WeaponUpgradeId, boolean>
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

  paysCrystals(upgrade: WeaponUpgradeId, config: GameConfig): boolean {
    return upgradeCrystal(config.weaponUpgrades[upgrade], this.purchased[upgrade])
  }

  price(upgrade: WeaponUpgradeId, config: GameConfig): number {
    return upgradePrice(config.weaponUpgrades[upgrade], this.purchased[upgrade])
  }

  maxed(upgrade: WeaponUpgradeId, config: GameConfig): boolean {
    return upgradeMaxed(config.weaponUpgrades[upgrade], this.purchased[upgrade])
  }

  upgrade(upgrade: WeaponUpgradeId): void {
    this.purchased[upgrade] += 1
  }

  stats(config: GameConfig): WeaponStats {
    const values = {} as WeaponStats['values']
    const costs = {} as WeaponStats['costs']
    const crystals = {} as WeaponStats['crystals']
    for (const id of WEAPON_UPGRADE_IDS) {
      values[id] = this.value(id, config)
      costs[id] = this.maxed(id, config) ? null : this.price(id, config)
      crystals[id] = this.paysCrystals(id, config)
    }
    return { values, costs, crystals }
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

function ratedInterval(spec: { baseMs?: number; levels: { value: number }[] }, rate: number, guns: number): number {
  const baseMs = spec.baseMs ?? 1
  const start = spec.levels[0]?.value ?? 1
  if (guns <= 0 || rate <= 0) return baseMs
  return Math.max(1, Math.round(baseMs * start / rate / guns))
}
