import { GUN_IDS, type GunId } from '../../data/designer'
import { inWeaponRange, moveToward } from '../motion/move'
import { BASE_TARGET, deliver, huntNearest, opposingBase, pickup, release } from './jobs'
import { gunsBearing, weaponReach, weaponStop } from './range'
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
    if (ship.mode === 'engage' || ship.mode === 'shoot') flyToRange(ship, distance, world, ships)
    else if (ship.mode === 'back') {
      if (moveToward(ship, homeSlot(ship, ships, world), distance)) deliver(ship, ships, world)
    } else if (ship.mode === 'hunt' || ship.mode === 'attack') flyToEnemy(ship, distance, world, ships)
  }
  for (const ship of ships) {
    if (ship.mode === 'shoot' || ship.mode === 'engage') fire(ship, dtMs, world, ships)
    else if (ship.mode === 'attack' || ship.mode === 'hunt') fireAtShip(ship, dtMs, world, ships)
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
  if (inWeaponRange(ship, asteroid, weaponStop(ship, world)) || moveToward(ship, slot, distance)) {
    ship.mode = 'shoot'
  } else ship.mode = 'engage'
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
  if (inWeaponRange(ship, target, weaponStop(ship, world)) || moveToward(ship, slot, distance)) {
    ship.mode = 'attack'
  } else ship.mode = 'hunt'
}

function flyToBase(ship: ShipState, distance: number, world: MinerWorld, ships: ShipState[]): void {
  if (ships.some(other => other.side !== ship.side)) {
    huntNearest(ship, ships, world)
    return
  }
  const base = opposingBase(ship, world)
  const slot = attackSlot(ship, { ...base, id: BASE_TARGET }, ships, world)
  if (inWeaponRange(ship, base, weaponStop(ship, world)) || moveToward(ship, slot, distance)) {
    ship.mode = 'attack'
  } else ship.mode = 'hunt'
}

function fire(ship: ShipState, dtMs: number, world: MinerWorld, ships: ShipState[]): void {
  const asteroid = keepTarget(world.asteroids.find(ship.targetId), ship, ships, world)
  if (!asteroid) return
  if (!inWeaponRange(ship, asteroid, weaponStop(ship, world))) ship.mode = 'engage'
  if (!inWeaponRange(ship, asteroid, weaponReach(ship, world))) return
  shoot(ship, asteroid, dtMs, world, { asteroidId: asteroid.id, shipId: null })
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
  if (!inWeaponRange(ship, target, weaponStop(ship, world))) ship.mode = 'hunt'
  if (!inWeaponRange(ship, target, weaponReach(ship, world))) return
  shoot(ship, target, dtMs, world, { asteroidId: null, shipId: target.id })
}

/** The base is a fixed point. The shot is labeled so a save can store it, and the hit finds no rock. */
function fireAtBase(ship: ShipState, dtMs: number, world: MinerWorld, ships: ShipState[]): void {
  if (ships.some(other => other.side !== ship.side)) {
    huntNearest(ship, ships, world)
    return
  }
  const base = opposingBase(ship, world)
  if (!inWeaponRange(ship, base, weaponStop(ship, world))) ship.mode = 'hunt'
  if (!inWeaponRange(ship, base, weaponReach(ship, world))) return
  shoot(ship, base, dtMs, world, { asteroidId: BASE_TARGET, shipId: null })
}

function travel(ship: ShipState, dtMs: number, world: MinerWorld): number {
  if (ship.craft) return ship.craft.speed * (dtMs / 1000)
  if (ship.role === 'fighter') return world.fighterUpgrades.travel(dtMs, world.config)
  return world.upgrades.travel(ship, dtMs, world.config)
}

/** Each gun type that can reach fires on its own timer. Extra guns of that type shorten its wait. */
function shoot(
  ship: ShipState,
  target: { x: number; y: number },
  dtMs: number,
  world: MinerWorld,
  aim: { asteroidId: string | null; shipId: string | null },
): void {
  if (!ship.craft) {
    const damage = gunDamage(ship, world)
    if (damage <= 0) return
    ship.fireCooldownMs -= dtMs
    if (ship.fireCooldownMs > 0) return
    launch(ship, target, world, 'weapon', false, damage, aim)
    ship.fireCooldownMs += gunInterval(ship, world)
    if (ship.fireCooldownMs < 0) ship.fireCooldownMs = 0
    return
  }
  const craft = ship.craft
  for (const kind of GUN_IDS) {
    const guns = gunsBearing(ship, target, world).filter(gun => gun.kind === kind)
    if (guns.length === 0) continue
    craft.cooldown[kind] -= dtMs
    if (craft.cooldown[kind] > 0) continue
    const damage = kind === 'missile'
      ? world.weaponUpgrades.missileDamage(world.config)
      : kind === 'weapon'
        ? world.weaponUpgrades.cannonDamage(world.config)
        : gunDamage(ship, world)
    if (damage <= 0) continue
    launch(ship, target, world, kind, guns.some(gun => gun.splash), damage, aim)
    const wait = kind === 'missile'
      ? world.weaponUpgrades.missileInterval(world.config, guns.length)
      : kind === 'weapon'
        ? world.weaponUpgrades.cannonInterval(world.config, guns.length)
        : Math.max(1, Math.round(world.config.ships.shotIntervalMs / guns.length))
    craft.cooldown[kind] += wait
    if (craft.cooldown[kind] < 0) craft.cooldown[kind] = 0
  }
}

/** A laser hits now and draws a line. Every other gun launches a shot. */
function launch(
  ship: ShipState,
  target: { x: number; y: number },
  world: MinerWorld,
  kind: GunId,
  splash: boolean,
  damage: number,
  aim: { asteroidId: string | null; shipId: string | null },
): void {
  if (kind === 'laser') {
    world.beam(ship, target, ship.side)
    world.hit({
      x: target.x,
      y: target.y,
      targetX: target.x,
      targetY: target.y,
      asteroidId: aim.asteroidId,
      shipId: aim.shipId,
      side: ship.side,
      damage,
      cannon: false,
      splash: false,
      mining: false,
    })
    return
  }
  world.shots.fire({
    x: ship.x,
    y: ship.y,
    targetX: target.x,
    targetY: target.y,
    asteroidId: aim.asteroidId,
    shipId: aim.shipId,
    side: ship.side,
    damage,
    cannon: false,
    splash,
    mining: ship.role === 'miner',
  })
}

function gunDamage(ship: ShipState, world: MinerWorld): number {
  if (ship.craft) return ship.craft.damage
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
