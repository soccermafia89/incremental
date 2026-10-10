import type { ShipState } from './types'
import type { MinerWorld } from './world'

/** Where this ship parks on the weapon-range circle, on its own side of the rock. */
export function fireSlot(
  ship: ShipState,
  asteroid: { x: number; y: number; id: string },
  ships: ShipState[],
  world: MinerWorld,
): { x: number; y: number } {
  const hold = Math.max(0, world.config.ships.weaponRange - 0.5)
  const home = world.layout.home(ship.side)
  const facing = Math.atan2(home.y - asteroid.y, home.x - asteroid.x)
  const mates = sameRock(ship, asteroid.id, ships)
  return onCircle(asteroid, hold, spread(facing, mates.index, mates.count, world.config.ships.radius, hold))
}

/** Where this ship stops on the base rim. Ships of one side do not share a point. */
export function homeSlot(ship: ShipState, ships: ShipState[], world: MinerWorld): { x: number; y: number } {
  const home = world.layout.home(ship.side)
  const rim = world.config.map.baseRadius
  const mates = ships
    .filter(other => other.side === ship.side && other.mode === 'back')
    .sort(byId)
  const index = Math.max(0, mates.findIndex(other => other.id === ship.id))
  const field = world.layout.scene().field
  const facing = Math.atan2((field.y0 + field.y1) / 2 - home.y, (field.x0 + field.x1) / 2 - home.x)
  return onCircle(home, rim, spread(facing, index, Math.max(1, mates.length), world.config.ships.radius, rim))
}

/** Where attackers park around a ship, spaced so they do not share one point. */
export function attackSlot(
  ship: ShipState,
  target: { x: number; y: number; id: string },
  ships: ShipState[],
  world: MinerWorld,
): { x: number; y: number } {
  const hold = Math.max(0, world.config.ships.weaponRange - 0.5)
  const home = world.layout.home(ship.side)
  const facing = Math.atan2(home.y - target.y, home.x - target.x)
  const mates = ships
    .filter(other =>
      other.targetId === target.id
      && other.side === ship.side
      && (other.mode === 'hunt' || other.mode === 'attack'))
    .sort(byId)
  const index = Math.max(0, mates.findIndex(other => other.id === ship.id))
  return onCircle(target, hold, spread(facing, index, Math.max(1, mates.length), world.config.ships.radius, hold))
}

function sameRock(ship: ShipState, asteroidId: string, ships: ShipState[]): { index: number; count: number } {
  const mates = ships
    .filter(other =>
      other.targetId === asteroidId
      && other.side === ship.side
      && (other.mode === 'engage' || other.mode === 'shoot'))
    .sort(byId)
  return { index: Math.max(0, mates.findIndex(other => other.id === ship.id)), count: Math.max(1, mates.length) }
}

function spread(facing: number, index: number, count: number, radius: number, hold: number): number {
  if (count <= 1 || hold <= 0) return facing
  const step = hold > radius ? 2 * Math.asin(Math.min(1, radius / hold)) : (2 * Math.PI) / count
  const arc = (count - 1) * step
  if (hold > radius && arc <= Math.PI) return facing - arc / 2 + index * step
  return facing + (index * 2 * Math.PI) / count
}

function onCircle(center: { x: number; y: number }, hold: number, angle: number): { x: number; y: number } {
  return { x: center.x + Math.cos(angle) * hold, y: center.y + Math.sin(angle) * hold }
}

function byId(a: ShipState, b: ShipState): number {
  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  return 0
}
