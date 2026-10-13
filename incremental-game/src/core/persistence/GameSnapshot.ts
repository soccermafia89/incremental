import type { CorvetteSavedLevels } from '../../data/corvette/upgrades'
import type { DefenseSavedLevels } from '../../data/defense/upgrades'
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
export const SAVE_FORMAT_VERSION = 55

/**
 * Plain-data mirror of the live game, safe to JSON.stringify.
 * Upgrade levels are stored as the flat miner*Level fields.
 */
export interface GameSnapshot extends Omit<MapState, 'minerLevels' | 'miningLevels' | 'fighterLevels' | 'enemyLevels' | 'corvetteLevels' | 'weaponLevels' | 'defenseLevels'>, SavedLevels, MiningSavedLevels, FighterSavedLevels, EnemySavedLevels, CorvetteSavedLevels, WeaponSavedLevels, DefenseSavedLevels {
  version: number
  /** ISO timestamp of when the snapshot was taken. */
  savedAt: string
}
