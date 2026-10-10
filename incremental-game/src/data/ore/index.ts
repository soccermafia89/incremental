import { read } from '../number'

/** What a delivered nugget pays, and how fast a broken-off nugget drifts. */
export interface OreConfig {
  value: number
  speed: number
}

export function parseOre(raw: unknown): OreConfig {
  return read<OreConfig>(raw, 'ore', {
    value: { integer: true, min: 1 },
    speed: { min: 0 },
  })
}
