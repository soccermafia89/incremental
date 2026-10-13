import { read } from '../number'

/** Un-upgraded ship movement and weapons. */
export interface ShipConfig {
  speed: number
  shotIntervalMs: number
  weaponRange: number
  /** How far a friendly miner shoots and stops. Other ships use `weaponRange`. */
  minerRange: number
  shotSpeed: number
  /** Production units spent to launch one miner. */
  units: number
  /** Body radius in pixels. Ships closer than twice this are pushed apart. */
  radius: number
  /** Hit points a ship starts with. */
  health: number
}

export function parseShips(raw: unknown): ShipConfig {
  return read<ShipConfig>(raw, 'ships', {
    speed: { min: 0 },
    shotIntervalMs: { integer: true, min: 1 },
    weaponRange: { above: 0 },
    minerRange: { above: 0 },
    shotSpeed: { min: 0 },
    units: { integer: true, min: 1 },
    radius: { min: 0 },
    health: { integer: true, min: 1 },
  })
}
