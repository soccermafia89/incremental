import { inWeaponRange } from '../motion/move'
import { cellKey } from '../motion/separate'
import type { ShipMode, ShipState } from './types'
import type { MinerWorld } from './world'

/** Rival miners hunt once the tractor beam is on. The fighter always hunts rivals. */
export function fights(ship: ShipState, world: MinerWorld): boolean {
  return ship.role === 'fighter' || (ship.side === 'rival' && world.mining.hasTractor())
}

/**
 * Every second, each miner must be doing one real job: hauling, chasing ore that
 * still exists, or flying to / shooting an asteroid that still exists. Otherwise
 * it is sent to the nearest asteroid. With nothing left to mine or collect, it waits where it is.
 * A ship at war keeps its current target, or picks the nearest enemy.
 */
export function ensureDuty(ship: ShipState, ships: ShipState[], world: MinerWorld): void {
  if (fights(ship, world)) {
    holdTarget(ship, ships, world)
    return
  }
  if (ship.cargo >= world.upgrades.capacityOf(ship, world.config, world.mining.hasGolden())) {
    order(ship, 'back', null)
    return
  }
  if (ship.mode === 'collect' && !world.mining.hasTractor() && world.ore.find(ship.targetId)) return
  const asteroid = (ship.mode === 'engage' || ship.mode === 'shoot')
    ? world.asteroids.find(ship.targetId)
    : undefined
  if (asteroid) {
    ship.mode = inWeaponRange(ship, asteroid, world.config.ships.weaponRange) ? 'shoot' : 'engage'
    return
  }
  assignJob(ship, world)
  const next = world.asteroids.find(ship.targetId)
  if (next && inWeaponRange(ship, next, world.config.ships.weaponRange)) ship.mode = 'shoot'
}

/** Loose ore first, then the nearest asteroid. A full hold is already heading home. */
export function assignJob(ship: ShipState, world: MinerWorld): void {
  const ore = world.mining.hasTractor() ? undefined : world.ore.nearest(ship)
  if (ore) {
    order(ship, 'collect', ore.id)
    return
  }
  engageNearest(ship, world)
}

/** Fly at the nearest enemy and shoot once it is in weapon range. */
export function huntNearest(ship: ShipState, ships: ShipState[], world: MinerWorld): void {
  const enemy = nearestEnemy(ship, ships)
  if (!enemy) {
    order(ship, 'wait', null)
    return
  }
  const range = world.config.ships.weaponRange
  order(ship, inWeaponRange(ship, enemy, range) ? 'attack' : 'hunt', enemy.id)
}

function holdTarget(ship: ShipState, ships: ShipState[], world: MinerWorld): void {
  const target = ships.find(other => other.id === ship.targetId && other.side !== ship.side)
  if (target && (ship.mode === 'hunt' || ship.mode === 'attack')) {
    ship.mode = inWeaponRange(ship, target, world.config.ships.weaponRange) ? 'attack' : 'hunt'
    return
  }
  huntNearest(ship, ships, world)
}

function nearestEnemy(ship: ShipState, ships: ShipState[]): ShipState | undefined {
  const want = ship.side === 'player' ? 'rival' : 'player'
  let best: ShipState | undefined
  let bestDist = Infinity
  for (const other of ships) {
    if (other.side !== want || other.id === ship.id) continue
    const dist = Math.hypot(other.x - ship.x, other.y - ship.y)
    if (dist < bestDist) {
      best = other
      bestDist = dist
    }
  }
  return best
}

/** Send the miner to the nearest asteroid. Several miners may pick the same one. */
export function engageNearest(ship: ShipState, world: MinerWorld): void {
  const asteroid = world.asteroids.nearest(ship)
  if (!asteroid) {
    order(ship, ship.cargo > 0 ? 'back' : 'wait', null)
    return
  }
  order(ship, 'engage', asteroid.id)
}

/** Loot sharing a map cell is taken by a random ship that still has room in that cell. */
export function scoopCells(ships: ShipState[], world: MinerWorld, roll: () => number): void {
  const cell = world.config.map.cell
  if (world.mining.hasTractor() || cell < 1) return
  const grids = new Map<string, ShipState[]>()
  for (const ship of ships) {
    if (ship.role === 'fighter' || full(ship, world)) continue
    const key = cellKey(ship.x, ship.y, cell)
    const list = grids.get(key)
    if (list) list.push(ship)
    else grids.set(key, [ship])
  }
  for (const nugget of world.ore.entries()) {
    const group = grids.get(cellKey(nugget.x, nugget.y, cell))
    if (!group || group.length === 0) continue
    const ship = group[Math.floor(roll() * group.length)]
    if (!ship) continue
    pickup(ship, nugget.id, world)
    if (full(ship, world)) {
      const index = group.indexOf(ship)
      if (index >= 0) group.splice(index, 1)
    }
  }
}

function full(ship: ShipState, world: MinerWorld): boolean {
  return ship.cargo >= world.upgrades.capacityOf(ship, world.config, world.mining.hasGolden())
}

export function pickup(ship: ShipState, oreId: string, world: MinerWorld): void {
  const nugget = world.ore.find(oreId)
  if (!nugget) return
  world.ore.remove(oreId)
  ship.cargo += 1
  ship.cargoValue += nugget.worth
  if (ship.cargo >= world.upgrades.capacityOf(ship, world.config, world.mining.hasGolden())) {
    order(ship, 'back', null)
    return
  }
  assignJob(ship, world)
}

export function deliver(ship: ShipState, ships: ShipState[], world: MinerWorld): void {
  if (ship.side === 'player') world.bank.deposit(ship.cargoValue)
  ship.cargo = 0
  ship.cargoValue = 0
  release(ship, ships, world)
}

export function release(ship: ShipState, ships: ShipState[], world: MinerWorld): void {
  if (fights(ship, world)) {
    huntNearest(ship, ships, world)
    return
  }
  engageNearest(ship, world)
}

/** Miners that were shooting a rock go for the nuggets it dropped. */
export function claimOre(ships: ShipState[], asteroidId: string, oreIds: string[]): void {
  if (oreIds.length === 0) return
  let next = 0
  for (const ship of ships) {
    if ((ship.mode === 'shoot' || ship.mode === 'engage') && ship.targetId === asteroidId) {
      order(ship, 'collect', oreIds[next % oreIds.length] ?? oreIds[0])
      next += 1
    }
  }
}

function order(ship: ShipState, mode: ShipMode, targetId: string | null): void {
  ship.mode = mode
  ship.targetId = targetId
}
