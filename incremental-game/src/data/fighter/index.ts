import { read } from '../number'

/** The player fighter: what it costs, how many production units it takes, and the pay for a destroyed rival. */
export interface FighterConfig {
  cost: number
  units: number
  bounty: number
}

export function parseFighter(raw: unknown): FighterConfig {
  return read<FighterConfig>(raw, 'fighter', {
    cost: { integer: true, min: 0 },
    units: { integer: true, min: 1 },
    bounty: { integer: true, min: 0 },
  })
}
