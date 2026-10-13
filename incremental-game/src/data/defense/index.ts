import { read } from '../number'

/** How a defense platform is built and how far it shoots. */
export interface DefenseConfig {
  buildMs: number
  /** Reach as a multiple of the base cannon range. */
  rangeScale: number
  /** Milliseconds between shots at attack rate 1. */
  shotMs: number
  /** Pixels per second on the drift from the base to just short of a third of the map. */
  speed: number
}

export function parseDefense(raw: unknown): DefenseConfig {
  return read<DefenseConfig>(raw, 'defense', {
    buildMs: { integer: true, min: 1 },
    rangeScale: { min: 0.01 },
    shotMs: { integer: true, min: 1 },
    speed: { min: 0.01 },
  })
}
