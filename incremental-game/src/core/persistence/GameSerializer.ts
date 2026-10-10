import { flattenEnemyLevels } from '../../data/enemy/upgrades'
import { flattenFighterLevels } from '../../data/fighter/upgrades'
import { flattenMiningLevels } from '../../data/mining'
import { flattenLevels } from '../../data/upgrades'
import type { Game } from '../game/Game'
import { SAVE_FORMAT_VERSION, type GameSnapshot } from './GameSnapshot'

export class GameSerializer {
  static serialize(game: Game, savedAt: string = new Date().toISOString()): GameSnapshot {
    const { minerLevels, miningLevels, fighterLevels, enemyLevels, ...live } = game.exportState()
    return {
      version: SAVE_FORMAT_VERSION,
      savedAt,
      ...live,
      ...flattenLevels(minerLevels),
      ...flattenMiningLevels(miningLevels),
      ...flattenFighterLevels(fighterLevels),
      ...flattenEnemyLevels(enemyLevels),
    }
  }
}
