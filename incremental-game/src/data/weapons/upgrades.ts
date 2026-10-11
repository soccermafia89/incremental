import {
  blankLevels as blankRecord,
  flattenLevels as flattenRecord,
  parseUpgradeRows,
  type UpgradeSpec,
} from '../upgradeSpec'
import { mapping, requireInt } from '../number'

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
export type WeaponUpgradeTable = {
  [Id in WeaponUpgradeId]: Id extends 'missileFireRate' | 'cannonFireRate' ? UpgradeSpec & { baseMs: number } : UpgradeSpec
}

export function parseWeaponUpgrades(raw: unknown): WeaponUpgradeTable {
  const table = parseUpgradeRows(raw, WEAPON_UPGRADE_IDS, 'weaponUpgrades')
  const row = mapping(raw, 'weaponUpgrades')
  return {
    ...table,
    cannonFireRate: { ...table.cannonFireRate, baseMs: readBaseMs(row, 'cannonFireRate') },
    missileFireRate: { ...table.missileFireRate, baseMs: readBaseMs(row, 'missileFireRate') },
  }
}

function readBaseMs(row: Record<string, unknown>, id: 'cannonFireRate' | 'missileFireRate'): number {
  const spec = mapping(row[id], `weaponUpgrades.${id}`)
  const baseMs = requireInt(spec.baseMs, `weaponUpgrades.${id}.baseMs`)
  if (baseMs < 1) throw new Error(`weaponUpgrades.${id}.baseMs must be at least 1`)
  return baseMs
}

export function blankWeaponLevels(): WeaponLevels {
  return blankRecord(WEAPON_UPGRADE_IDS)
}

export function flattenWeaponLevels(levels: WeaponLevels): WeaponSavedLevels {
  return flattenRecord(WEAPON_UPGRADE_IDS, WEAPON_FIELDS, levels) as WeaponSavedLevels
}
