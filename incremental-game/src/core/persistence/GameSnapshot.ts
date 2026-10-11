import type { EnemySavedLevels } from '../../data/enemy/upgrades'
import type { FighterSavedLevels } from '../../data/fighter/upgrades'
import type { MiningSavedLevels } from '../../data/mining'
import type { SavedLevels } from '../../data/upgrades'
import type { WeaponSavedLevels } from '../../data/weapons/upgrades'
import type { MapState } from '../game/state'

/**
 * Version of the save format. Bump whenever the snapshot shape changes so old
 * saves are rejected rather than loaded into a mismatched model.
 */
export const SAVE_FORMAT_VERSION = 40

/**
 * Plain-data mirror of the live game, safe to JSON.stringify.
 * Upgrade levels are stored as the flat miner*Level fields.
 */
export interface GameSnapshot extends Omit<MapState, 'minerLevels' | 'miningLevels' | 'fighterLevels' | 'enemyLevels' | 'weaponLevels'>, SavedLevels, MiningSavedLevels, FighterSavedLevels, EnemySavedLevels, WeaponSavedLevels {
  version: number
  /** ISO timestamp of when the snapshot was taken. */
  savedAt: string
}
