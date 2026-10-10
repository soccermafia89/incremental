import { read } from '../number'

/**
 * Rival answers to the player's fleet.
 * `shipsAt` is ships on the field. `speedAt` and `carryAt` are the numbers
 * on those upgrades. Reaching one multiplies the rival's matching stat by `by`.
 * Each answer stacks with the golden-asteroid rival buff.
 */
export interface RivalConfig {
  shipsAt: number
  shipsBy: number
  speedAt: number
  speedBy: number
  carryAt: number
  carryBy: number
  /** Milliseconds between replacements of a destroyed rival miner. */
  replenishMs: number
}

const atLeastOne = { integer: true, min: 1 }

export function parseRival(raw: unknown): RivalConfig {
  return read<RivalConfig>(raw, 'rival', {
    shipsAt: atLeastOne,
    shipsBy: atLeastOne,
    speedAt: atLeastOne,
    speedBy: { min: 1 },
    carryAt: atLeastOne,
    carryBy: atLeastOne,
    replenishMs: atLeastOne,
  })
}
