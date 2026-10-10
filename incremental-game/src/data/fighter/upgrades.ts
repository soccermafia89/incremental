import {
  blankLevels as blankRecord,
  flattenLevels as flattenRecord,
  parseUpgradeRows,
  type UpgradeSpec,
} from '../upgradeSpec'

export const FIGHTER_UPGRADE_IDS = ['speed', 'attackRate', 'health', 'damage', 'count', 'production'] as const
export type FighterUpgradeId = (typeof FIGHTER_UPGRADE_IDS)[number]

/** Save-file names for each fighter upgrade level. */
export const FIGHTER_FIELDS = {
  speed: 'fighterSpeedLevel',
  attackRate: 'fighterAttackRateLevel',
  health: 'fighterHealthLevel',
  damage: 'fighterDamageLevel',
  count: 'fighterCountLevel',
  production: 'fighterProductionLevel',
} as const

export type FighterLevels = Record<FighterUpgradeId, number>
export type FighterSavedLevels = { [Id in FighterUpgradeId as (typeof FIGHTER_FIELDS)[Id]]: number }
export type FighterUpgradeTable = Record<FighterUpgradeId, UpgradeSpec>

export function parseFighterUpgrades(raw: unknown): FighterUpgradeTable {
  return parseUpgradeRows(raw, FIGHTER_UPGRADE_IDS, 'fighterUpgrades')
}

export function blankFighterLevels(): FighterLevels {
  return blankRecord(FIGHTER_UPGRADE_IDS)
}

export function flattenFighterLevels(levels: FighterLevels): FighterSavedLevels {
  return flattenRecord(FIGHTER_UPGRADE_IDS, FIGHTER_FIELDS, levels) as FighterSavedLevels
}
