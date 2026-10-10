import { separateShips } from '../motion/separate'
import { heading, moveMiners } from './flight'
import { claimOre, engageNearest, ensureDuty, fights, huntNearest, release, scoopCells } from './jobs'
import { copyShip, type ShipRole, type ShipState, type Side } from './types'
import type { MinerWorld } from './world'

const DUTY_MS = 1000

export class Miners {
  private ships: ShipState[]
  private nextId: number
  /** Counts toward the once-a-second check that every miner still has a job. */
  private dutyMs = 0

  private constructor(ships: ShipState[], nextId: number) {
    this.ships = ships
    this.nextId = nextId
  }

  static empty(): Miners {
    return new Miners([], 1)
  }

  static restore(ships: ShipState[], nextId: number): Miners {
    return new Miners(ships.map(copyShip), nextId)
  }

  get playerCount(): number {
    return this.ships.filter(ship => ship.side === 'player' && ship.role === 'miner').length
  }

  get fighterCount(): number {
    return this.ships.filter(ship => ship.side === 'player' && ship.role === 'fighter').length
  }

  get rivalCount(): number {
    return this.ships.filter(ship => ship.side === 'rival').length
  }

  spawn(side: Side, world: MinerWorld): void {
    const ship = this.make(side, 'miner', world)
    this.ships.push(ship)
    this.clearOverlap(world)
    if (side === 'rival' && world.mining.hasTractor()) huntNearest(ship, this.ships, world)
    else engageNearest(ship, world)
  }

  spawnFighter(world: MinerWorld): void {
    const ship = this.make('player', 'fighter', world)
    const health = world.fighterUpgrades.health(world.config)
    ship.health = health
    ship.maxHealth = health
    this.ships.push(ship)
    this.clearOverlap(world)
    huntNearest(ship, this.ships, world)
  }

  /** Buying enemy health adds that step to every rival already on the field. */
  raiseRivalHealth(added: number, nextMax: number): void {
    for (const ship of this.ships) {
      if (ship.side !== 'rival') continue
      ship.maxHealth = nextMax
      ship.health = Math.min(nextMax, ship.health + added)
    }
  }

  /** Buying fighter health adds that step to the fighter already on the field. */
  raiseFighterHealth(added: number, nextMax: number): void {
    for (const ship of this.ships) {
      if (ship.role !== 'fighter') continue
      ship.maxHealth = nextMax
      ship.health = Math.min(nextMax, ship.health + added)
    }
  }

  locate(id: string): { x: number; y: number } | undefined {
    const ship = this.ships.find(item => item.id === id)
    return ship ? { x: ship.x, y: ship.y } : undefined
  }

  /** The closest ship of the other side that sits inside `range` of `origin`. */
  nearestEnemy(side: Side, origin: { x: number; y: number }, range: number): { id: string; x: number; y: number } | undefined {
    let nearest: { id: string; x: number; y: number } | undefined
    let best = range
    for (const ship of this.ships) {
      if (ship.side === side) continue
      const distance = Math.hypot(ship.x - origin.x, ship.y - origin.y)
      if (distance > best) continue
      best = distance
      nearest = { id: ship.id, x: ship.x, y: ship.y }
    }
    return nearest
  }

  /** Damage a ship. A rival killed by a ship pays the bounty. A base cannon kill does not. */
  hurt(id: string, damage: number, world: MinerWorld, bounty: boolean): void {
    const ship = this.ships.find(item => item.id === id)
    if (!ship) return
    ship.health -= damage
    if (ship.health > 0) return
    this.ships = this.ships.filter(item => item.id !== id)
    if (ship.side === 'rival' && bounty) {
      const factor = world.enemyUpgrades.bountyMultiplier(world.config)
      world.bank.deposit(Math.round(world.config.fighter.bounty * factor))
    }
    for (const other of this.ships) {
      if (other.targetId === id) release(other, this.ships, world)
    }
  }

  move(dtMs: number, world: MinerWorld, roll: () => number): void {
    moveMiners(this.ships, dtMs, world)
    scoopCells(this.ships, world, roll)
    this.clearOverlap(world)
  }

  /** After movement and spawns: idle miners pick up work, and once a second every miner is checked. */
  finishStep(dtMs: number, world: MinerWorld): void {
    for (const ship of this.ships) {
      if (ship.mode !== 'wait') continue
      if (fights(ship, world)) huntNearest(ship, this.ships, world)
      else engageNearest(ship, world)
    }
    this.dutyMs += dtMs
    if (this.dutyMs < DUTY_MS) return
    this.dutyMs -= DUTY_MS
    for (const ship of this.ships) ensureDuty(ship, this.ships, world)
  }

  scene(world: MinerWorld): { id: string; x: number; y: number; carrying: boolean; heading: number; side: Side; role: ShipRole; health: number; maxHealth: number }[] {
    return this.ships.map(ship => ({
      id: ship.id,
      x: ship.x,
      y: ship.y,
      carrying: ship.cargo > 0,
      heading: heading(ship, world, this.ships),
      side: ship.side,
      role: ship.role,
      health: ship.health,
      maxHealth: ship.maxHealth,
    }))
  }

  save(): { nextShipId: number; ships: ShipState[] } {
    return { nextShipId: this.nextId, ships: this.ships.map(copyShip) }
  }

  /** Nuggets in a ship's grid cell are picked up by a random ship in that cell. */
  scoop(world: MinerWorld, roll: () => number): void {
    scoopCells(this.ships, world, roll)
  }

  claim(asteroidId: string, oreIds: string[]): void {
    claimOre(this.ships, asteroidId, oreIds)
  }

  /** Ships that share a map cell are pushed until their bodies no longer overlap. */
  private clearOverlap(world: MinerWorld): void {
    separateShips(this.ships, world.config.map.cell, world.config.ships.radius, world.config.map)
  }

  /** Our miners leave the map. Fighters and the rival fleet stay. */
  dismissPlayerMiners(world: MinerWorld): void {
    const gone = new Set(
      this.ships.filter(ship => ship.side === 'player' && ship.role === 'miner').map(ship => ship.id),
    )
    this.ships = this.ships.filter(ship => !gone.has(ship.id))
    for (const ship of this.ships) {
      if (ship.targetId !== null && gone.has(ship.targetId)) release(ship, this.ships, world)
    }
  }

  /** Collectors stop chasing nuggets. A hold they already have still goes home. */
  leaveOre(world: MinerWorld): void {
    for (const ship of this.ships) {
      if (ship.mode === 'collect') release(ship, this.ships, world)
    }
  }

  /** Rival miners drop their work and fly at our ships. */
  turnHostile(world: MinerWorld): void {
    for (const ship of this.ships) {
      if (ship.side !== 'rival') continue
      ship.cargo = 0
      ship.cargoValue = 0
      huntNearest(ship, this.ships, world)
    }
  }

  private make(side: Side, role: ShipRole, world: MinerWorld): ShipState {
    const home = world.layout.home(side)
    const health = side === 'rival' ? world.enemyUpgrades.health(world.config) : world.config.ships.health
    const ship: ShipState = {
      id: `ship-${this.nextId}`,
      x: home.x,
      y: home.y,
      cargo: 0,
      cargoValue: 0,
      mode: 'wait',
      targetId: null,
      fireCooldownMs: 0,
      side,
      role,
      health,
      maxHealth: health,
    }
    this.nextId += 1
    return ship
  }

}
