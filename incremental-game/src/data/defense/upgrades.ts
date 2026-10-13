import {
  blankLevels as blankRecord,
  flattenLevels as flattenRecord,
  parseUpgradeRows,
  type UpgradeSpec,
} from '../upgradeSpec'

export const DEFENSE_UPGRADE_IDS = ['capacity', 'health', 'attackRate', 'damage'] as const
export type DefenseUpgradeId = (typeof DEFENSE_UPGRADE_IDS)[number]

export const DEFENSE_FIELDS = {
  capacity: 'defenseCapacityLevel',
  health: 'defenseHealthLevel',
  attackRate: 'defenseAttackRateLevel',
  damage: 'defenseDamageLevel',
} as const

export type DefenseLevels = Record<DefenseUpgradeId, number>
export type DefenseSavedLevels = { [Id in DefenseUpgradeId as (typeof DEFENSE_FIELDS)[Id]]: number }
export type DefenseUpgradeTable = Record<DefenseUpgradeId, UpgradeSpec>

export function parseDefenseUpgrades(raw: unknown): DefenseUpgradeTable {
  return parseUpgradeRows(raw, DEFENSE_UPGRADE_IDS, 'defenseUpgrades')
}

export function blankDefenseLevels(): DefenseLevels {
  return blankRecord(DEFENSE_UPGRADE_IDS)
}

export function flattenDefenseLevels(levels: DefenseLevels): DefenseSavedLevels {
  return flattenRecord(DEFENSE_UPGRADE_IDS, DEFENSE_FIELDS, levels) as DefenseSavedLevels
}
