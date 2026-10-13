import { mapping, read } from '../number'
import {
  blankLevels as blankRecord,
  flattenLevels as flattenRecord,
  parseUpgradeRows,
  type UpgradeSpec,
} from '../upgradeSpec'

export const MINING_IDS = ['size', 'spawnRate', 'goldenSpawnRate'] as const
export type MiningId = (typeof MINING_IDS)[number]
export const TRACTOR_BEAM = 'tractorBeam' as const
export const GOLDEN = 'golden' as const
export const MINING_UNLOCK = 'unlock' as const
export const AUTOMINE = 'automine' as const
export const MONEY_CONVERTER = 'moneyConverter' as const
export type MiningPurchase = MiningId | typeof TRACTOR_BEAM | typeof GOLDEN | typeof MINING_UNLOCK | typeof AUTOMINE | typeof MONEY_CONVERTER

export const MINING_FIELDS = {
  size: 'miningSizeLevel',
  spawnRate: 'miningSpawnRateLevel',
  goldenSpawnRate: 'miningGoldenSpawnRateLevel',
} as const

export type MiningLevels = Record<MiningId, number>
export type MiningSavedLevels = { [Id in MiningId as (typeof MINING_FIELDS)[Id]]: number }
export type MiningTable = Record<MiningId, UpgradeSpec> & {
  golden: { cost: number }
  tractorBeam: { cost: number }
  unlock: { cost: number }
  automine: { cost: number; payout: number; everyMs: number }
  moneyConverter: { cost: number; above: number }
}

const costField = { cost: { integer: true, min: 1 } }

export function parseMining(raw: unknown): MiningTable {
  const table = parseUpgradeRows(raw, MINING_IDS, 'mining')
  const row = mapping(raw, 'mining')
  return {
    ...table,
    golden: read<{ cost: number }>(row.golden, 'mining.golden', costField),
    tractorBeam: read<{ cost: number }>(row.tractorBeam, 'mining.tractorBeam', costField),
    unlock: read<{ cost: number }>(row.unlock, 'mining.unlock', costField),
    automine: read<{ cost: number; payout: number; everyMs: number }>(row.automine, 'mining.automine', {
      cost: { integer: true, min: 1 },
      payout: { integer: true, min: 1 },
      everyMs: { integer: true, min: 1 },
    }),
    moneyConverter: read<{ cost: number; above: number }>(row.moneyConverter, 'mining.moneyConverter', {
      cost: { integer: true, min: 1 },
      above: { integer: true, min: 0 },
    }),
  }
}

export function blankMiningLevels(): MiningLevels {
  return blankRecord(MINING_IDS)
}

export function flattenMiningLevels(levels: MiningLevels): MiningSavedLevels {
  return flattenRecord(MINING_IDS, MINING_FIELDS, levels) as MiningSavedLevels
}
