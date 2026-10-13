import {
  blankLevels as blankRecord,
  flattenLevels as flattenRecord,
  parseUpgradeRows,
  type UpgradeSpec,
} from '../upgradeSpec'

export const WEAPON_UPGRADE_IDS = ['cannonFireRate', 'cannonDamage', 'laserRange', 'laserEnergy', 'missileFireRate', 'missileDamage'] as const
export type WeaponUpgradeId = (typeof WEAPON_UPGRADE_IDS)[number]

/** Save-file names for each weapon upgrade level. */
export const WEAPON_FIELDS = {
  cannonFireRate: 'cannonFireRateLevel',
  cannonDamage: 'cannonDamageLevel',
  laserRange: 'laserRangeLevel',
  laserEnergy: 'laserEnergyLevel',
  missileFireRate: 'missileFireRateLevel',
  missileDamage: 'missileDamageLevel',
} as const

export type WeaponLevels = Record<WeaponUpgradeId, number>
export type WeaponSavedLevels = { [Id in WeaponUpgradeId as (typeof WEAPON_FIELDS)[Id]]: number }
export type WeaponUpgradeTable = Record<WeaponUpgradeId, UpgradeSpec>

export function parseWeaponUpgrades(raw: unknown): WeaponUpgradeTable {
  return parseUpgradeRows(raw, WEAPON_UPGRADE_IDS, 'weaponUpgrades')
}

export function blankWeaponLevels(): WeaponLevels {
  return blankRecord(WEAPON_UPGRADE_IDS)
}

export function flattenWeaponLevels(levels: WeaponLevels): WeaponSavedLevels {
  return flattenRecord(WEAPON_UPGRADE_IDS, WEAPON_FIELDS, levels) as WeaponSavedLevels
}
