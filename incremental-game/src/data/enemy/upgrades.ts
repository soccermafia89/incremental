import {
  blankLevels as blankRecord,
  flattenLevels as flattenRecord,
  parseUpgradeRows,
  type UpgradeSpec,
} from '../upgradeSpec'

export const ENEMY_UPGRADE_IDS = ['spawnRate', 'capacity', 'health', 'damage', 'attackRate'] as const
export type EnemyUpgradeId = (typeof ENEMY_UPGRADE_IDS)[number]

export const ENEMY_FIELDS = {
  spawnRate: 'enemySpawnRateLevel',
  capacity: 'enemyCapacityLevel',
  health: 'enemyHealthLevel',
  damage: 'enemyDamageLevel',
  attackRate: 'enemyAttackRateLevel',
} as const

export type EnemyLevels = Record<EnemyUpgradeId, number>
export type EnemySavedLevels = { [Id in EnemyUpgradeId as (typeof ENEMY_FIELDS)[Id]]: number }
export type EnemyUpgradeTable = Record<EnemyUpgradeId, UpgradeSpec>

export function parseEnemyUpgrades(raw: unknown): EnemyUpgradeTable {
  return parseUpgradeRows(raw, ENEMY_UPGRADE_IDS, 'enemyUpgrades')
}

export function blankEnemyLevels(): EnemyLevels {
  return blankRecord(ENEMY_UPGRADE_IDS)
}

export function flattenEnemyLevels(levels: EnemyLevels): EnemySavedLevels {
  return flattenRecord(ENEMY_UPGRADE_IDS, ENEMY_FIELDS, levels) as EnemySavedLevels
}
