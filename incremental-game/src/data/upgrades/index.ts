import {
  blankLevels as blankRecord,
  flattenLevels as flattenRecord,
  parseUpgradeRows,
  type UpgradeSpec,
} from '../upgradeSpec'

export type { UpgradeSpec } from '../upgradeSpec'

export const UPGRADE_IDS = ['speed', 'damage', 'fireRate', 'carry', 'count', 'production'] as const
export type UpgradeId = (typeof UPGRADE_IDS)[number]

/** Save-file names for each miner upgrade level. The live game keeps one record. */
export const LEVEL_FIELDS = {
  speed: 'minerSpeedLevel',
  damage: 'minerDamageLevel',
  fireRate: 'minerFireRateLevel',
  carry: 'minerCarryLevel',
  count: 'minerCountLevel',
  production: 'minerProductionLevel',
} as const

export type UpgradeLevels = Record<UpgradeId, number>
export type SavedLevels = { [Id in UpgradeId as (typeof LEVEL_FIELDS)[Id]]: number }
export type UpgradeTable = Record<UpgradeId, UpgradeSpec>

export function parseUpgradeTable(raw: unknown): UpgradeTable {
  return parseUpgradeRows(raw, UPGRADE_IDS, 'upgrades')
}

export function blankLevels(): UpgradeLevels {
  return blankRecord(UPGRADE_IDS)
}

export function flattenLevels(levels: UpgradeLevels): SavedLevels {
  return flattenRecord(UPGRADE_IDS, LEVEL_FIELDS, levels) as SavedLevels
}
