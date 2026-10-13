import { flattenCorvetteLevels } from '../../data/corvette/upgrades'
import { flattenDefenseLevels } from '../../data/defense/upgrades'
import { flattenEnemyLevels } from '../../data/enemy/upgrades'
import { flattenFighterLevels } from '../../data/fighter/upgrades'
import { flattenMiningLevels } from '../../data/mining'
import { flattenLevels } from '../../data/upgrades'
import { flattenWeaponLevels } from '../../data/weapons/upgrades'
import type { Game } from '../game/Game'
import { SAVE_FORMAT_VERSION, type GameSnapshot } from './GameSnapshot'

export class GameSerializer {
  static serialize(game: Game, savedAt: string = new Date().toISOString()): GameSnapshot {
    const { minerLevels, miningLevels, fighterLevels, enemyLevels, corvetteLevels, weaponLevels, defenseLevels, ...live } = game.exportState()
    return {
      version: SAVE_FORMAT_VERSION,
      savedAt,
      ...live,
      ...flattenLevels(minerLevels),
      ...flattenMiningLevels(miningLevels),
      ...flattenFighterLevels(fighterLevels),
      ...flattenEnemyLevels(enemyLevels),
      ...flattenCorvetteLevels(corvetteLevels),
      ...flattenDefenseLevels(defenseLevels),
      ...flattenWeaponLevels(weaponLevels),
    }
  }
}
