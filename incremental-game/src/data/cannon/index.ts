import { read } from '../number'

/** The gun on each base. It shoots the nearest enemy ship inside `range`. */
export interface CannonConfig {
  range: number
  rate: number
  damage: number
  shotSpeed: number
}

export function parseCannon(raw: unknown): CannonConfig {
  return read<CannonConfig>(raw, 'cannon', {
    range: { integer: true, min: 1 },
    rate: { integer: true, min: 1 },
    damage: { integer: true, min: 1 },
    shotSpeed: { integer: true, min: 1 },
  })
}
