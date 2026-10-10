import { mapping, requireNumber } from '../number'
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

/** One enemy upgrade. `bounty` is the payout factor added by each purchase. 1 changes nothing. */
export interface EnemyUpgradeSpec extends UpgradeSpec {
  bounty: number
}

export type EnemyUpgradeTable = Record<EnemyUpgradeId, EnemyUpgradeSpec>

export function parseEnemyUpgrades(raw: unknown): EnemyUpgradeTable {
  const specs = parseUpgradeRows(raw, ENEMY_UPGRADE_IDS, 'enemyUpgrades')
  const row = mapping(raw, 'enemyUpgrades')
  const table = {} as EnemyUpgradeTable
  for (const id of ENEMY_UPGRADE_IDS) {
    const label = `enemyUpgrades.${id}.bounty`
    const bounty = requireNumber(mapping(row[id], `enemyUpgrades.${id}`).bounty, label)
    if (bounty < 1) throw new Error(`${label} must be at least 1`)
    table[id] = { ...specs[id], bounty }
  }
  return table
}

export function blankEnemyLevels(): EnemyLevels {
  return blankRecord(ENEMY_UPGRADE_IDS)
}

export function flattenEnemyLevels(levels: EnemyLevels): EnemySavedLevels {
  return flattenRecord(ENEMY_UPGRADE_IDS, ENEMY_FIELDS, levels) as EnemySavedLevels
}
