import {
  blankLevels as blankRecord,
  flattenLevels as flattenRecord,
  parseUpgradeRows,
  type UpgradeSpec,
} from '../upgradeSpec'

export const CORVETTE_UPGRADE_IDS = ['health', 'damage', 'attackRate', 'speed', 'spawnRate', 'capacity', 'missiles'] as const
export type CorvetteUpgradeId = (typeof CORVETTE_UPGRADE_IDS)[number]

export const CORVETTE_FIELDS = {
  health: 'corvetteHealthLevel',
  damage: 'corvetteDamageLevel',
  attackRate: 'corvetteAttackRateLevel',
  speed: 'corvetteSpeedLevel',
  spawnRate: 'corvetteSpawnRateLevel',
  capacity: 'corvetteCapacityLevel',
  missiles: 'corvetteMissilesLevel',
} as const

export type CorvetteLevels = Record<CorvetteUpgradeId, number>
export type CorvetteSavedLevels = { [Id in CorvetteUpgradeId as (typeof CORVETTE_FIELDS)[Id]]: number }
export type CorvetteUpgradeTable = Record<CorvetteUpgradeId, UpgradeSpec>

export function parseCorvetteUpgrades(raw: unknown): CorvetteUpgradeTable {
  return parseUpgradeRows(raw, CORVETTE_UPGRADE_IDS, 'corvetteUpgrades')
}

export function blankCorvetteLevels(): CorvetteLevels {
  return blankRecord(CORVETTE_UPGRADE_IDS)
}

export function flattenCorvetteLevels(levels: CorvetteLevels): CorvetteSavedLevels {
  return flattenRecord(CORVETTE_UPGRADE_IDS, CORVETTE_FIELDS, levels) as CorvetteSavedLevels
}
