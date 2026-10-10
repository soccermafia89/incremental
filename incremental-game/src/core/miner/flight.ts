import { inWeaponRange, moveToward } from '../motion/move'
import { BASE_TARGET, deliver, huntNearest, opposingBase, pickup, release } from './jobs'
import { attackSlot, fireSlot, homeSlot } from './slots'
import type { ShipState } from './types'
import type { MinerWorld } from './world'

export function moveMiners(ships: ShipState[], dtMs: number, world: MinerWorld): void {
  const collectors = ships
    .filter(ship => ship.mode === 'collect')
    .sort((a, b) => world.ore.distance(a) - world.ore.distance(b))
  for (const ship of collectors) flyToOre(ship, travel(ship, dtMs, world), world, ships)
  for (const ship of ships) {
    const distance = travel(ship, dtMs, world)
    if (ship.mode === 'engage') flyToRange(ship, distance, world, ships)
    else if (ship.mode === 'back') {
      if (moveToward(ship, homeSlot(ship, ships, world), distance)) deliver(ship, ships, world)
    } else if (ship.mode === 'hunt') flyToEnemy(ship, distance, world, ships)
  }
  for (const ship of ships) {
    if (ship.mode === 'shoot') fire(ship, dtMs, world, ships)
    else if (ship.mode === 'attack') fireAtShip(ship, dtMs, world, ships)
  }
}

export function heading(ship: ShipState, world: MinerWorld, ships: ShipState[]): number {
  if (ship.mode === 'back') return aim(ship, homeSlot(ship, ships, world))
  if (ship.mode === 'hunt' || ship.mode === 'attack') {
    if (ship.targetId === BASE_TARGET) return aim(ship, opposingBase(ship, world))
    const enemy = ships.find(other => other.id === ship.targetId)
    return enemy ? aim(ship, enemy) : 0
  }
  const ore = ship.mode === 'collect' ? world.ore.find(ship.targetId) : undefined
  if (ore) return aim(ship, ore)
  const asteroid = world.asteroids.find(ship.targetId)
  if (!asteroid) return 0
  if (ship.mode === 'engage') return aim(ship, fireSlot(ship, asteroid, ships, world))
  return aim(ship, asteroid)
}

function aim(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

function flyToRange(ship: ShipState, distance: number, world: MinerWorld, ships: ShipState[]): void {
  const asteroid = keepTarget(world.asteroids.find(ship.targetId), ship, ships, world)
  if (!asteroid) return
  const slot = fireSlot(ship, asteroid, ships, world)
  if (inWeaponRange(ship, asteroid, world.config.ships.weaponRange) || moveToward(ship, slot, distance)) {
    ship.mode = 'shoot'
  }
}

function flyToOre(ship: ShipState, distance: number, world: MinerWorld, ships: ShipState[]): void {
  const ore = keepTarget(world.ore.find(ship.targetId), ship, ships, world)
  if (!ore) return
  if (moveToward(ship, ore, distance)) pickup(ship, ore.id, world)
}

function flyToEnemy(ship: ShipState, distance: number, world: MinerWorld, ships: ShipState[]): void {
  if (ship.targetId === BASE_TARGET) {
    flyToBase(ship, distance, world, ships)
    return
  }
  const target = ships.find(other => other.id === ship.targetId && other.side !== ship.side)
  if (!target) {
    release(ship, ships, world)
    return
  }
  const slot = attackSlot(ship, target, ships, world)
  if (inWeaponRange(ship, target, world.config.ships.weaponRange) || moveToward(ship, slot, distance)) {
    ship.mode = 'attack'
  }
}

function flyToBase(ship: ShipState, distance: number, world: MinerWorld, ships: ShipState[]): void {
  if (ships.some(other => other.side !== ship.side)) {
    huntNearest(ship, ships, world)
    return
  }
  const base = opposingBase(ship, world)
  const slot = attackSlot(ship, { ...base, id: BASE_TARGET }, ships, world)
  if (inWeaponRange(ship, base, world.config.ships.weaponRange) || moveToward(ship, slot, distance)) {
    ship.mode = 'attack'
  }
}

function fire(ship: ShipState, dtMs: number, world: MinerWorld, ships: ShipState[]): void {
  const asteroid = keepTarget(world.asteroids.find(ship.targetId), ship, ships, world)
  if (!asteroid) return
  if (!inWeaponRange(ship, asteroid, world.config.ships.weaponRange)) {
    ship.mode = 'engage'
    return
  }
  ship.fireCooldownMs -= dtMs
  if (ship.fireCooldownMs > 0) return
  world.shots.fire({
    x: ship.x,
    y: ship.y,
    targetX: asteroid.x,
    targetY: asteroid.y,
    asteroidId: asteroid.id,
    shipId: null,
    side: ship.side,
    damage: gunDamage(ship, world),
    cannon: false,
  })
  ship.fireCooldownMs += gunInterval(ship, world)
  if (ship.fireCooldownMs < 0) ship.fireCooldownMs = 0
}

function fireAtShip(ship: ShipState, dtMs: number, world: MinerWorld, ships: ShipState[]): void {
  if (ship.targetId === BASE_TARGET) {
    fireAtBase(ship, dtMs, world, ships)
    return
  }
  const target = ships.find(other => other.id === ship.targetId && other.side !== ship.side)
  if (!target) {
    release(ship, ships, world)
    return
  }
  if (!inWeaponRange(ship, target, world.config.ships.weaponRange)) {
    ship.mode = 'hunt'
    return
  }
  ship.fireCooldownMs -= dtMs
  if (ship.fireCooldownMs > 0) return
  world.shots.fire({
    x: ship.x,
    y: ship.y,
    targetX: target.x,
    targetY: target.y,
    asteroidId: null,
    shipId: target.id,
    side: ship.side,
    damage: gunDamage(ship, world),
    cannon: false,
  })
  ship.fireCooldownMs += gunInterval(ship, world)
  if (ship.fireCooldownMs < 0) ship.fireCooldownMs = 0
}

/** The base is a fixed point. The shot is labeled so a save can store it, and the hit finds no rock. */
function fireAtBase(ship: ShipState, dtMs: number, world: MinerWorld, ships: ShipState[]): void {
  if (ships.some(other => other.side !== ship.side)) {
    huntNearest(ship, ships, world)
    return
  }
  const base = opposingBase(ship, world)
  if (!inWeaponRange(ship, base, world.config.ships.weaponRange)) {
    ship.mode = 'hunt'
    return
  }
  ship.fireCooldownMs -= dtMs
  if (ship.fireCooldownMs > 0) return
  world.shots.fire({
    x: ship.x,
    y: ship.y,
    targetX: base.x,
    targetY: base.y,
    asteroidId: BASE_TARGET,
    shipId: null,
    side: ship.side,
    damage: gunDamage(ship, world),
    cannon: false,
  })
  ship.fireCooldownMs += gunInterval(ship, world)
  if (ship.fireCooldownMs < 0) ship.fireCooldownMs = 0
}

function travel(ship: ShipState, dtMs: number, world: MinerWorld): number {
  if (ship.role === 'fighter') return world.fighterUpgrades.travel(dtMs, world.config)
  return world.upgrades.travel(ship, dtMs, world.config)
}

function gunDamage(ship: ShipState, world: MinerWorld): number {
  if (ship.role === 'fighter') return world.fighterUpgrades.damage(world.config)
  if (ship.side !== 'player') return world.enemyUpgrades.shotDamage(world.config, world.mining.hasGolden())
  return world.upgrades.damageOf(ship, world.config, world.mining.hasGolden())
}

function gunInterval(ship: ShipState, world: MinerWorld): number {
  if (ship.role === 'fighter') return world.fighterUpgrades.interval(world.config)
  if (ship.side !== 'player') return world.enemyUpgrades.shotInterval(world.config, world.mining.hasGolden())
  return world.upgrades.intervalOf(ship, world.config, world.mining.hasGolden())
}

function keepTarget<T>(target: T | undefined, ship: ShipState, ships: ShipState[], world: MinerWorld): T | undefined {
  if (target) return target
  release(ship, ships, world)
  return undefined
}
