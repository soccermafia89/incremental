import { read } from '../number'

/** The enemy corvette: what the unlock costs, and what a ship kill pays. */
export interface CorvetteConfig {
  cost: number
  bounty: number
  crystal: number
  spawnMs: number
  shotMs: number
  speedScale: number
  /** Cannon reach as a multiple of `ships.weaponRange`. */
  rangeScale: number
  /** Direct hit of a corvette missile. Splash is half of this. */
  missileDamage: number
}

export function parseCorvette(raw: unknown): CorvetteConfig {
  return read<CorvetteConfig>(raw, 'corvette', {
    cost: { integer: true, min: 1 },
    bounty: { integer: true, min: 0 },
    crystal: { integer: true, min: 0 },
    spawnMs: { integer: true, min: 1 },
    shotMs: { integer: true, min: 1 },
    speedScale: { min: 0.01 },
    rangeScale: { min: 0.01 },
    missileDamage: { integer: true, min: 1 },
  })
}
