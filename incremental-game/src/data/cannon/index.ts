import { read } from '../number'

/** The gun on each base. `wake` starts combat. `range` is how far it shoots once awake. */
export interface CannonConfig {
  wake: number
  range: number
  rate: number
  damage: number
  shotSpeed: number
}

export function parseCannon(raw: unknown): CannonConfig {
  const cannon = read<CannonConfig>(raw, 'cannon', {
    wake: { integer: true, min: 1 },
    range: { integer: true, min: 1 },
    rate: { integer: true, min: 1 },
    damage: { integer: true, min: 1 },
    shotSpeed: { integer: true, min: 1 },
  })
  if (cannon.wake >= cannon.range) throw new Error('cannon.wake must be shorter than cannon.range')
  return cannon
}
