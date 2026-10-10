import { read } from '../number'

/**
 * Golden rocks are extra. `health` and `value` multiply the normal asteroid
 * health and the normal nugget value. `size` is the pixel size at mining-size start.
 * `spawnMs` is the gap at golden spawn rate 1.
 * Buying the upgrade multiplies the rival fleet by `rivalShips`, multiplies
 * their fire rate by `rivalFire`, and sets their damage and cargo to
 * `rivalDamage` and `rivalCarry`.
 */
export interface GoldenConfig {
  health: number
  value: number
  size: number
  spawnMs: number
  max: number
  rivalShips: number
  rivalFire: number
  rivalDamage: number
  rivalCarry: number
}

const atLeastOne = { integer: true, min: 1 }

export function parseGolden(raw: unknown): GoldenConfig {
  return read<GoldenConfig>(raw, 'golden', {
    health: atLeastOne,
    value: atLeastOne,
    size: atLeastOne,
    spawnMs: atLeastOne,
    max: atLeastOne,
    rivalShips: atLeastOne,
    rivalFire: atLeastOne,
    rivalDamage: atLeastOne,
    rivalCarry: atLeastOne,
  })
}
