import type { GameConfig } from '../../data/GameConfig'
import { loadGameConfig } from '../../data/GameConfig'
import { mapping, requireInt, requireNumber } from '../../data/number'
import { ENEMY_FIELDS, ENEMY_UPGRADE_IDS } from '../../data/enemy/upgrades'
import { FIGHTER_FIELDS, FIGHTER_UPGRADE_IDS } from '../../data/fighter/upgrades'
import { MINING_FIELDS, MINING_IDS } from '../../data/mining'
import { LEVEL_FIELDS, UPGRADE_IDS } from '../../data/upgrades'
import type { AsteroidKind, AsteroidState } from '../asteroid/AsteroidField'
import type { MapState } from '../game/state'
import { GameImpl } from '../game/Game'
import { SHIP_MODES, SHIP_ROLES, type ShipMode, type ShipRole, type ShipState, type Side } from '../miner'
import type { OreState } from '../ore/OreField'
import type { ShotState } from '../shot/Shot'
import { isComponentId } from '../../data/designer'
import { isRotation, type PlacedPart } from '../designer/Design'
import { SAVE_FORMAT_VERSION } from './GameSnapshot'

export class GameDeserializer {
  static deserialize(raw: unknown, config: GameConfig = loadGameConfig()): GameImpl {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error('Save file is not a game snapshot')
    }
    const row = raw as Record<string, unknown>
    if (row.version !== SAVE_FORMAT_VERSION) {
      throw new Error(
        `Save format ${String(row.version)} is not supported (expected ${SAVE_FORMAT_VERSION})`,
      )
    }
    const state: MapState = {
      money: count(row.money, 'money'),
      spawnAccumulatorMs: count(row.spawnAccumulatorMs, 'spawnAccumulatorMs'),
      rngState: count(row.rngState, 'rngState'),
      goldenSpawnAccumulatorMs: count(row.goldenSpawnAccumulatorMs, 'goldenSpawnAccumulatorMs'),
      ...nextIds(row),
      asteroids: list(row.asteroids, 'asteroids').map((item, index) => asteroid(item, index)),
      ores: list(row.ores, 'ores').map((item, index) => ore(item, index)),
      shots: list(row.shots, 'shots').map((item, index) => shot(item, index)),
      ships: list(row.ships, 'ships').map((item, index) => ship(item, index)),
      minerLevels: readLevels(row, UPGRADE_IDS, LEVEL_FIELDS),
      miningLevels: readLevels(row, MINING_IDS, MINING_FIELDS),
      fighterLevels: readLevels(row, FIGHTER_UPGRADE_IDS, FIGHTER_FIELDS),
      enemyLevels: readLevels(row, ENEMY_UPGRADE_IDS, ENEMY_FIELDS),
      tractorBeam: flag(row.tractorBeam, 'tractorBeam'),
      golden: flag(row.golden, 'golden'),
      miningUnlocked: flag(row.miningUnlocked, 'miningUnlocked'),
      automine: flag(row.automine, 'automine'),
      shipDesigner: flag(row.shipDesigner, 'shipDesigner'),
      parts: list(row.parts, 'parts').map((item, index) => placedPart(item, index)),
      nextPartId: positiveInt(row.nextPartId, 'nextPartId'),
      pendingMiners: nonNegativeInt(row.pendingMiners, 'pendingMiners'),
      minerWork: count(row.minerWork, 'minerWork'),
      pendingFighters: nonNegativeInt(row.pendingFighters, 'pendingFighters'),
      fighterWork: count(row.fighterWork, 'fighterWork'),
      rivalCap: positiveInt(row.rivalCap, 'rivalCap'),
      rivalElapsedMs: count(row.rivalElapsedMs, 'rivalElapsedMs'),
      fleetAnswered: flag(row.fleetAnswered, 'fleetAnswered'),
      gift: positiveInt(row.gift, 'gift'),
    }
    return GameImpl.restore(config, state)
  }
}

const NEXT_IDS = ['nextAsteroidId', 'nextShipId', 'nextOreId', 'nextShotId'] as const

function nextIds(row: Record<string, unknown>): Pick<MapState, (typeof NEXT_IDS)[number]> {
  const ids = {} as Pick<MapState, (typeof NEXT_IDS)[number]>
  for (const key of NEXT_IDS) ids[key] = positiveInt(row[key], key)
  return ids
}

function placedPart(raw: unknown, index: number): PlacedPart {
  const label = `parts[${index}]`
  const row = mapping(raw, label)
  const component = text(row.component, `${label}.component`)
  if (!isComponentId(component)) throw new Error(`${label}.component is invalid`)
  const id = text(row.id, `${label}.id`)
  if (!/^part-[1-9]\d*$/.test(id)) throw new Error(`${label}.id is invalid`)
  const rotation = requireInt(row.rotation, `${label}.rotation`)
  if (!isRotation(rotation)) throw new Error(`${label}.rotation is invalid`)
  return {
    id,
    component,
    x: requireInt(row.x, `${label}.x`),
    y: requireInt(row.y, `${label}.y`),
    rotation,
  }
}

function asteroid(raw: unknown, index: number): AsteroidState {
  const label = `asteroids[${index}]`
  const row = mapping(raw, label)
  const maxHealth = positiveInt(row.maxHealth, `${label}.maxHealth`)
  const health = positiveInt(row.health, `${label}.health`)
  if (health > maxHealth) throw new Error(`${label}.health is above its max`)
  return { ...body(row, label), health, maxHealth, kind: asteroidKind(row.kind, `${label}.kind`) }
}

function shipHealth(row: Record<string, unknown>, label: string): { health: number; maxHealth: number } {
  const maxHealth = positiveInt(row.maxHealth, `${label}.maxHealth`)
  const health = positiveInt(row.health, `${label}.health`)
  if (health > maxHealth) throw new Error(`${label}.health is above its max`)
  return { health, maxHealth }
}

function ore(raw: unknown, index: number): OreState {
  const label = `ores[${index}]`
  const row = mapping(raw, label)
  return {
    ...body(row, label),
    vx: requireNumber(row.vx, `${label}.vx`),
    vy: requireNumber(row.vy, `${label}.vy`),
    worth: positiveInt(row.worth, `${label}.worth`),
    kind: asteroidKind(row.kind, `${label}.kind`),
  }
}

function shot(raw: unknown, index: number): ShotState {
  const label = `shots[${index}]`
  const row = mapping(raw, label)
  return {
    ...body(row, label),
    targetX: requireNumber(row.targetX, `${label}.targetX`),
    targetY: requireNumber(row.targetY, `${label}.targetY`),
    ...shotTarget(row, label),
    side: side(row.side, `${label}.side`),
    damage: positiveInt(row.damage, `${label}.damage`),
    cannon: flag(row.cannon, `${label}.cannon`),
  }
}

function shotTarget(row: Record<string, unknown>, label: string): { asteroidId: string | null; shipId: string | null } {
  const asteroidId = optionalId(row.asteroidId, `${label}.asteroidId`)
  const shipId = optionalId(row.shipId, `${label}.shipId`)
  if ((asteroidId === null) === (shipId === null)) {
    throw new Error(`${label} must target an asteroid or a ship`)
  }
  return { asteroidId, shipId }
}

function ship(raw: unknown, index: number): ShipState {
  const label = `ships[${index}]`
  const row = mapping(raw, label)
  const mode = row.mode
  if (typeof mode !== 'string' || !(SHIP_MODES as readonly string[]).includes(mode)) {
    throw new Error(`${label}.mode is invalid`)
  }
  const targetId = row.targetId
  if (targetId !== null && typeof targetId !== 'string') {
    throw new Error(`${label}.targetId is invalid`)
  }
  return {
    ...body(row, label),
    cargo: nonNegativeInt(row.cargo, `${label}.cargo`),
    cargoValue: nonNegativeInt(row.cargoValue, `${label}.cargoValue`),
    mode: mode as ShipMode,
    targetId,
    fireCooldownMs: count(row.fireCooldownMs, `${label}.fireCooldownMs`),
    side: side(row.side, `${label}.side`),
    role: role(row.role, `${label}.role`),
    ...shipHealth(row, label),
  }
}

function body(row: Record<string, unknown>, label: string): { id: string; x: number; y: number } {
  return {
    id: text(row.id, `${label}.id`),
    x: requireNumber(row.x, `${label}.x`),
    y: requireNumber(row.y, `${label}.y`),
  }
}

function readLevels<Id extends string>(
  row: Record<string, unknown>,
  ids: readonly Id[],
  fields: Record<Id, string>,
): Record<Id, number> {
  const levels = {} as Record<Id, number>
  for (const id of ids) {
    const key = fields[id]
    levels[id] = nonNegativeInt(row[key], key)
  }
  return levels
}

function role(value: unknown, label: string): ShipRole {
  if (typeof value !== 'string' || !(SHIP_ROLES as readonly string[]).includes(value)) {
    throw new Error(`${label} is invalid`)
  }
  return value as ShipRole
}

function optionalId(value: unknown, label: string): string | null {
  if (value === null) return null
  return text(value, label)
}

function side(value: unknown, label: string): Side {
  if (value !== 'player' && value !== 'rival') throw new Error(`${label} is invalid`)
  return value
}

function count(value: unknown, label: string): number {
  const number = requireNumber(value, label)
  if (number < 0) throw new Error(`${label} must be at least 0`)
  return number
}

function nonNegativeInt(value: unknown, label: string): number {
  const number = count(value, label)
  if (!Number.isInteger(number)) throw new Error(`${label} must be an integer`)
  return number
}

function positiveInt(value: unknown, label: string): number {
  const number = count(value, label)
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${label} must be an integer of at least 1`)
  }
  return number
}

function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be a list`)
  return value
}

function asteroidKind(value: unknown, label: string): AsteroidKind {
  if (value !== 'normal' && value !== 'golden') throw new Error(`${label} is invalid`)
  return value
}

function flag(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be true or false`)
  return value
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}
