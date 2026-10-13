import { GUN_IDS, type GunId } from '../../data/designer'
import { inWeaponRange, moveToward } from '../motion/move'
import { BASE_TARGET, deliver, huntNearest, opposingBase, pickup, release } from './jobs'
import { corvetteGunRange, gunsBearing, weaponReach, weaponStop } from './range'
import { attackSlot, fireSlot, homeSlot } from './slots'
import type { ShipState } from './types'
import type { MinerWorld } from './world'

export function moveMiners(ships: ShipState[], dtMs: number, world: MinerWorld): void {
  const collectors = ships
    .filter(ship => ship.mode === 'collect')
    .sort((a, b) => world.ore.distance(a) - world.ore.distance(b))
  for (const ship of collectors) flyToOre(ship, travel(ship, dtMs, world), world, ships)
  for (const ship of ships) {
    if (ship.role === 'platform') continue
    const distance = travel(ship, dtMs, world)
    if (ship.mode === 'engage' || ship.mode === 'shoot') flyToRange(ship, distance, world, ships)
    else if (ship.mode === 'back') {
      if (moveToward(ship, homeSlot(ship, ships, world), distance)) deliver(ship, ships, world)
    } else if (ship.mode === 'hunt' || ship.mode === 'attack') flyToEnemy(ship, distance, world, ships)
  }
  for (const ship of ships) {
    if (ship.role === 'platform') continue
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
  shoot(ship, asteroid, dtMs, world, { asteroidId: asteroid.id, shipId: null }, ships)
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
  if (ship.role === 'corvette') {
    shoot(ship, target, dtMs, world, { asteroidId: null, shipId: target.id }, ships)
    return
  }
  if (!inWeaponRange(ship, target, weaponReach(ship, world))) return
  shoot(ship, target, dtMs, world, { asteroidId: null, shipId: target.id }, ships)
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
  shoot(ship, base, dtMs, world, { asteroidId: BASE_TARGET, shipId: null }, ships)
}

function travel(ship: ShipState, dtMs: number, world: MinerWorld): number {
  if (ship.craft) return ship.craft.speed * (dtMs / 1000)
  if (ship.role === 'fighter') return world.fighterUpgrades.travel(dtMs, world.config)
  if (ship.role === 'corvette') return world.corvetteUpgrades.travel(dtMs, world.config)
  return world.upgrades.travel(ship, dtMs, world.config)
}

/** Each gun type that can reach fires on its own timer. Extra guns of that type shorten its wait. */
function shoot(
  ship: ShipState,
  target: { x: number; y: number },
  dtMs: number,
  world: MinerWorld,
  aim: { asteroidId: string | null; shipId: string | null },
  ships: ShipState[],
): void {
  if (!ship.craft) {
    if (ship.role === 'corvette') {
      fireCorvetteCannon(ship, target, dtMs, world, ships, aim)
    } else if (gunInRange(ship, target, world)) {
      const damage = gunDamage(ship, world)
      if (damage > 0) {
        ship.fireCooldownMs -= dtMs
        if (ship.fireCooldownMs <= 0) {
          launch(ship, target, world, 'weapon', false, damage, aim)
          ship.fireCooldownMs += gunInterval(ship, world)
          if (ship.fireCooldownMs < 0) ship.fireCooldownMs = 0
        }
      }
    }
    fireCorvetteMissile(ship, target, dtMs, world, aim)
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

/** How far from the center a corvette cannon shot starts, on the port or starboard side. */
const BROADSIDE_MUZZLE = 14

/**
 * One cannon shot, alternating sides. Each muzzle aims at the enemy closest to
 * it, so the two guns may pick the same ship or two different ones. The wait is
 * `corvette.shotMs`.
 */
function fireCorvetteCannon(
  ship: ShipState,
  fallback: { x: number; y: number },
  dtMs: number,
  world: MinerWorld,
  ships: ShipState[],
  aim: { asteroidId: string | null; shipId: string | null },
): void {
  const damage = gunDamage(ship, world)
  if (damage <= 0) return
  const range = corvetteGunRange(world)
  const face = heading(ship, world, ships)
  const port = nearestToMuzzle(ship, ships, range, face, 0)
  const starboard = nearestToMuzzle(ship, ships, range, face, 1)
  const base = aim.asteroidId === BASE_TARGET && inWeaponRange(ship, fallback, range)
  if (!port && !starboard && !base) return
  ship.fireCooldownMs -= dtMs
  if (ship.fireCooldownMs > 0) return
  const wanted = ship.cannonSide
  const picked = wanted === 0 ? port : starboard
  if (picked) {
    launch(ship, picked, world, 'weapon', false, damage, { asteroidId: null, shipId: picked.id }, broadsideOrigin(ship, face, wanted))
  } else if (base) {
    launch(ship, fallback, world, 'weapon', false, damage, aim, broadsideOrigin(ship, face, wanted))
  } else {
    ship.fireCooldownMs = 0
    return
  }
  ship.cannonSide = wanted === 0 ? 1 : 0
  ship.fireCooldownMs += gunInterval(ship, world)
  if (ship.fireCooldownMs < 0) ship.fireCooldownMs = 0
}

/** Closest enemy in cannon range, measured from this side's muzzle. */
function nearestToMuzzle(
  ship: ShipState,
  ships: ShipState[],
  range: number,
  face: number,
  side: 0 | 1,
): ShipState | undefined {
  const origin = broadsideOrigin(ship, face, side)
  let best: ShipState | undefined
  let bestDist = Infinity
  for (const other of ships) {
    if (other.side === ship.side) continue
    if (Math.hypot(other.x - ship.x, other.y - ship.y) > range) continue
    const dist = Math.hypot(other.x - origin.x, other.y - origin.y)
    if (dist >= bestDist) continue
    best = other
    bestDist = dist
  }
  return best
}

function broadsideOrigin(ship: ShipState, face: number, side: 0 | 1): { x: number; y: number } {
  const port = side === 0
  const nx = port ? Math.sin(face) : -Math.sin(face)
  const ny = port ? -Math.cos(face) : Math.cos(face)
  return { x: ship.x + nx * BROADSIDE_MUZZLE, y: ship.y + ny * BROADSIDE_MUZZLE }
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
  origin: { x: number; y: number } = ship,
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
      heavy: false,
    })
    return
  }
  world.shots.fire({
    x: origin.x,
    y: origin.y,
    targetX: target.x,
    targetY: target.y,
    asteroidId: aim.asteroidId,
    shipId: aim.shipId,
    side: ship.side,
    damage,
    cannon: false,
    splash,
    mining: ship.role === 'miner',
    heavy: false,
  })
}

/** A corvette missile reaches past the gun. The gun uses the corvette cannon range. */
function gunInRange(ship: ShipState, target: { x: number; y: number }, world: MinerWorld): boolean {
  if (ship.role === 'corvette' && ship.missiles) {
    return inWeaponRange(ship, target, corvetteGunRange(world))
  }
  return true
}

/**
 * One corvette missile. Its damage is the corvette's own number, not the
 * player's missile upgrades. It launches twice as often as a rate-1 player missile.
 */
function fireCorvetteMissile(
  ship: ShipState,
  target: { x: number; y: number },
  dtMs: number,
  world: MinerWorld,
  aim: { asteroidId: string | null; shipId: string | null },
): void {
  if (ship.role !== 'corvette' || !ship.missiles) return
  const missile = world.config.designer.components.missile
  if (!inWeaponRange(ship, target, missile.range)) return
  ship.missileCooldownMs -= dtMs
  if (ship.missileCooldownMs > 0) return
  const damage = world.config.corvette.missileDamage
  if (damage <= 0) return
  launch(ship, target, world, 'missile', true, damage, aim)
  const baseMs = world.config.weaponUpgrades.missileFireRate.baseMs ?? 1
  ship.missileCooldownMs += Math.round(baseMs / 2)
  if (ship.missileCooldownMs < 0) ship.missileCooldownMs = 0
}

function gunDamage(ship: ShipState, world: MinerWorld): number {
  if (ship.craft) return ship.craft.damage
  if (ship.role === 'fighter') return world.fighterUpgrades.damage(world.config)
  if (ship.role === 'corvette') return world.corvetteUpgrades.damage(world.config)
  if (ship.side !== 'player') {
    return world.enemyUpgrades.shotDamage(world.config, world.mining.hasGolden(), world.mining.hasTractor())
  }
  return world.upgrades.damageOf(ship, world.config, world.mining.hasGolden())
}

function gunInterval(ship: ShipState, world: MinerWorld): number {
  if (ship.role === 'fighter') return world.fighterUpgrades.interval(world.config)
  if (ship.role === 'corvette') return world.corvetteUpgrades.interval(world.config)
  if (ship.side !== 'player') return world.enemyUpgrades.shotInterval(world.config, world.mining.hasGolden())
  return world.upgrades.intervalOf(ship, world.config, world.mining.hasGolden())
}

function keepTarget<T>(target: T | undefined, ship: ShipState, ships: ShipState[], world: MinerWorld): T | undefined {
  if (target) return target
  release(ship, ships, world)
  return undefined
}
