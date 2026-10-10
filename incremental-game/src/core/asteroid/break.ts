import type { GameConfig } from '../../data/GameConfig'
import type { Bank } from '../base/Bank'
import type { MiningUpgrades } from '../mining/Mining'
import type { Miners } from '../miner/Miners'
import type { OreField } from '../ore/OreField'
import type { ShotState } from '../shot/Shot'
import type { AsteroidField } from './AsteroidField'

/** A shot that destroys an asteroid leaves its loot, and miners on that rock go for it. */
export function breakAsteroid(
  shot: ShotState,
  asteroids: AsteroidField,
  ore: OreField,
  miners: Miners,
  mining: MiningUpgrades,
  bank: Bank,
  config: GameConfig,
  roll: () => number,
): void {
  const destroyed = asteroids.hit(shot)
  if (!destroyed) return
  const count = mining.loot(config)
  const each = destroyed.kind === 'golden' ? config.ore.value * config.golden.value : config.ore.value
  if (mining.hasTractor()) {
    bank.deposit(each * count)
    return
  }
  const nuggets: string[] = []
  for (let i = 0; i < count; i += 1) {
    nuggets.push(ore.spawn(destroyed.x, destroyed.y, config, roll, destroyed.kind).id)
  }
  miners.claim(destroyed.id, nuggets)
}
