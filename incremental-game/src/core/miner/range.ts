import type { GunId } from '../../data/designer'
import { inWeaponRange } from '../motion/move'
import type { ShipState } from './types'
import type { MinerWorld } from './world'

/** How far this ship can shoot. A designed ship uses its farthest powered gun. */
export function weaponReach(ship: ShipState, world: MinerWorld): number {
  if (ship.craft && ship.craft.weapons.length > 0) {
    return ship.craft.weapons.reduce((max, gun) => Math.max(max, gunRange(gun, world)), 0)
  }
  if (ship.role === 'corvette') {
    const gun = corvetteGunRange(world)
    if (ship.missiles) return Math.max(gun, world.config.designer.components.missile.range)
    return gun
  }
  return stockRange(ship, world)
}

/** Where this ship stops. A designed ship closes until its shortest powered gun can fire. A corvette keeps closing for another 15% of its cannon range after it can already fire. */
export function weaponStop(ship: ShipState, world: MinerWorld): number {
  if (ship.role === 'corvette') return Math.round(corvetteGunRange(world) * 0.85)
  if (!ship.craft || ship.craft.weapons.length === 0) return stockRange(ship, world)
  return ship.craft.weapons.reduce((min, gun) => Math.min(min, gunRange(gun, world)), Infinity)
}

/** Friendly miners use their own reach. Everyone else uses the stock gun. */
function stockRange(ship: ShipState, world: MinerWorld): number {
  if (ship.side === 'player' && ship.role === 'miner') return world.config.ships.minerRange
  return world.config.ships.weaponRange
}

/** Half again a fighter gun. `ships.weaponRange` times `corvette.rangeScale`. */
export function corvetteGunRange(world: MinerWorld): number {
  return Math.round(world.config.ships.weaponRange * world.config.corvette.rangeScale)
}

/** Powered guns on a designed ship that reach this target, in placement order. */
export function gunsBearing(ship: ShipState, target: { x: number; y: number }, world: MinerWorld): { kind: GunId; range: number; splash: boolean }[] {
  if (!ship.craft) return []
  return ship.craft.weapons
    .map(gun => ({ ...gun, range: gunRange(gun, world) }))
    .filter(gun => inWeaponRange(ship, target, gun.range))
}

/** A laser uses the range upgrade. Other guns keep the range they launched with. */
function gunRange(gun: { kind: GunId; range: number }, world: MinerWorld): number {
  if (gun.kind === 'laser') return world.weaponUpgrades.laserRange(world.config)
  return gun.range
}

