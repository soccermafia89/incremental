import { read } from '../number'

/** How asteroids appear and how much damage they take. */
export interface AsteroidConfig {
  spawnMs: number
  max: number
  health: number
  /** Health is multiplied by this each time asteroid size is upgraded. */
  healthScale: number
  /** Pixel size of a rock when the size upgrade is at its start. */
  size: number
  /** Pixels added to the drawn rock each time asteroid size is upgraded. */
  sizeStep: number
}

const atLeastOne = { integer: true, min: 1 }

export function parseAsteroids(raw: unknown): AsteroidConfig {
  return read<AsteroidConfig>(raw, 'asteroids', {
    spawnMs: atLeastOne,
    max: atLeastOne,
    health: atLeastOne,
    healthScale: atLeastOne,
    size: atLeastOne,
    sizeStep: { integer: true, min: 0 },
  })
}
