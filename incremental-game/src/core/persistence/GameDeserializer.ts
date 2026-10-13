import type { GameConfig } from '../../data/GameConfig'
import { loadGameConfig } from '../../data/GameConfig'
import { isGunId } from '../../data/designer'
import { mapping, requireNumber } from '../../data/number'
import { CORVETTE_FIELDS, CORVETTE_UPGRADE_IDS } from '../../data/corvette/upgrades'
import { DEFENSE_FIELDS, DEFENSE_UPGRADE_IDS } from '../../data/defense/upgrades'
import { ENEMY_FIELDS, ENEMY_UPGRADE_IDS } from '../../data/enemy/upgrades'
import { FIGHTER_FIELDS, FIGHTER_UPGRADE_IDS } from '../../data/fighter/upgrades'
import { MINING_FIELDS, MINING_IDS } from '../../data/mining'
import { LEVEL_FIELDS, UPGRADE_IDS } from '../../data/upgrades'
import { WEAPON_FIELDS, WEAPON_UPGRADE_IDS } from '../../data/weapons/upgrades'
import type { AsteroidKind, AsteroidState } from '../asteroid/AsteroidField'
import type { MapState, ProductionBay, ProductionDesign } from '../game/state'
import { GameImpl } from '../game/Game'
import { SHIP_MODES, SHIP_ROLES, type HullCell, type ShipMode, type ShipRole, type ShipState, type Side } from '../miner'
import type { OreState } from '../ore/OreField'
import type { ShotState } from '../shot/Shot'
import { readParts, type NamedDesign, type PlacedPart } from '../designer'
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
      crystals: count(row.crystals, 'crystals'),
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
      corvetteLevels: readLevels(row, CORVETTE_UPGRADE_IDS, CORVETTE_FIELDS),
      corvette: flag(row.corvette, 'corvette'),
      corvetteElapsedMs: count(row.corvetteElapsedMs, 'corvetteElapsedMs'),
      defenseLevels: readLevels(row, DEFENSE_UPGRADE_IDS, DEFENSE_FIELDS),
      defenseElapsedMs: count(row.defenseElapsedMs, 'defenseElapsedMs'),
      weaponLevels: readLevels(row, WEAPON_UPGRADE_IDS, WEAPON_FIELDS),
      tractorBeam: flag(row.tractorBeam, 'tractorBeam'),
      golden: flag(row.golden, 'golden'),
      miningUnlocked: flag(row.miningUnlocked, 'miningUnlocked'),
      automine: flag(row.automine, 'automine'),
      automineElapsedMs: count(row.automineElapsedMs, 'automineElapsedMs'),
      moneyConverter: flag(row.moneyConverter, 'moneyConverter'),
      missileCorvetteKilled: flag(row.missileCorvetteKilled, 'missileCorvetteKilled'),
      shipDesigner: flag(row.shipDesigner, 'shipDesigner'),
      laser: flag(row.laser, 'laser'),
      missile: flag(row.missile, 'missile'),
      mediumEngine: flag(row.mediumEngine, 'mediumEngine'),
      largeEngine: flag(row.largeEngine, 'largeEngine'),
      parts: readParts(row.parts),
      nextPartId: positiveInt(row.nextPartId, 'nextPartId'),
      savedDesign: readSavedDesign(row.savedDesign),
      designs: readDesigns(row.designs),
      bays: readBays(row.bays),
      pendingMiners: nonNegativeInt(row.pendingMiners, 'pendingMiners'),
      minerWork: count(row.minerWork, 'minerWork'),
      minerReady: nonNegativeInt(row.minerReady, 'minerReady'),
      fighterQueue: list(row.fighterQueue, 'fighterQueue').map((item, index) => readProduction(item, `fighterQueue[${index}]`)),
      platformReady: nonNegativeInt(row.platformReady, 'platformReady'),
      rivalCap: positiveInt(row.rivalCap, 'rivalCap'),
      rivalElapsedMs: count(row.rivalElapsedMs, 'rivalElapsedMs'),
      fleetAnswered: flag(row.fleetAnswered, 'fleetAnswered'),
      gift: positiveInt(row.gift, 'gift'),
      crystalGift: positiveInt(row.crystalGift, 'crystalGift'),
      baseCombat: flag(row.baseCombat, 'baseCombat'),
      rivalCombat: flag(row.rivalCombat, 'rivalCombat'),
    }
    return GameImpl.restore(config, state)
  }
}

function readBays(raw: unknown): ProductionBay[] {
  const rows = list(raw, 'bays')
  if (rows.length < 1) throw new Error('bays is empty')
  return rows.map((item, index) => {
    const row = mapping(item, `bays[${index}]`)
    return {
      design: readProduction(row.design, `bays[${index}].design`),
      pending: nonNegativeInt(row.pending, `bays[${index}].pending`),
      work: count(row.work, `bays[${index}].work`),
      production: nonNegativeInt(row.production, `bays[${index}].production`),
      capacity: nonNegativeInt(row.capacity, `bays[${index}].capacity`),
    }
  })
}

function readProduction(raw: unknown, label = 'productionDesign'): ProductionDesign {
  if (raw === 'fighter' || (typeof raw === 'string' && /^ship[1-9]\d*$/.test(raw))) return raw
  throw new Error(`${label} is invalid`)
}

function readDesigns(raw: unknown): NamedDesign[] {
  return list(raw, 'designs').map((item, index) => {
    const row = mapping(item, `designs[${index}]`)
    const name = textName(row.name, `designs[${index}].name`)
    if (name !== `ship${index + 1}`) throw new Error(`designs[${index}].name is invalid`)
    return { name, parts: readParts(row.parts, `designs[${index}].parts`) }
  })
}

function textName(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} is invalid`)
  return value
}

function readSavedDesign(raw: unknown): PlacedPart[] | null {
  if (raw === null) return null
  return readParts(raw, 'savedDesign')
}

const NEXT_IDS = ['nextAsteroidId', 'nextShipId', 'nextOreId', 'nextShotId'] as const

function nextIds(row: Record<string, unknown>): Pick<MapState, (typeof NEXT_IDS)[number]> {
  const ids = {} as Pick<MapState, (typeof NEXT_IDS)[number]>
  for (const key of NEXT_IDS) ids[key] = positiveInt(row[key], key)
  return ids
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
    splash: flag(row.splash, `${label}.splash`),
    mining: flag(row.mining, `${label}.mining`),
    heavy: flag(row.heavy, `${label}.heavy`),
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

function readCraft(raw: unknown, label: string): ShipState['craft'] {
  if (raw === null) return null
  const row = mapping(raw, label)
  const speed = requireNumber(row.speed, `${label}.speed`)
  if (speed < 0) throw new Error(`${label}.speed is negative`)
  return {
    speed,
    damage: nonNegativeInt(row.damage, `${label}.damage`),
    weapons: readWeapons(row.weapons, `${label}.weapons`),
    cooldown: readCooldown(row.cooldown, `${label}.cooldown`),
    cells: readHull(row.cells, `${label}.cells`),
  }
}

function readCooldown(raw: unknown, label: string): { weapon: number; laser: number; missile: number } {
  const row = mapping(raw, label)
  return {
    weapon: nonNegativeInt(row.weapon, `${label}.weapon`),
    laser: nonNegativeInt(row.laser, `${label}.laser`),
    missile: nonNegativeInt(row.missile, `${label}.missile`),
  }
}

function readWeapons(raw: unknown, label: string): { kind: 'weapon' | 'laser' | 'missile'; range: number; splash: boolean }[] {
  return list(raw, label).map((item, index) => {
    const gun = mapping(item, `${label}[${index}]`)
    const kind = gun.kind
    if (typeof kind !== 'string' || !isGunId(kind)) throw new Error(`${label}[${index}].kind is invalid`)
    return {
      kind,
      range: positiveInt(gun.range, `${label}[${index}].range`),
      splash: flag(gun.splash, `${label}[${index}].splash`),
    }
  })
}

function readHull(raw: unknown, label: string): HullCell[] {
  return list(raw, label).map((item, index) => {
    const cell = mapping(item, `${label}[${index}]`)
    return {
      x: integer(cell.x, `${label}[${index}].x`),
      y: integer(cell.y, `${label}[${index}].y`),
      color: text(cell.color, `${label}[${index}].color`),
    }
  })
}

function readShipBay(raw: unknown, label: string): number | null {
  if (raw === null) return null
  return nonNegativeInt(raw, label)
}

function readCannonSide(raw: unknown, label: string): 0 | 1 {
  if (raw === 0 || raw === 1) return raw
  throw new Error(`${label} is invalid`)
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
    missiles: flag(row.missiles, `${label}.missiles`),
    missileCooldownMs: count(row.missileCooldownMs, `${label}.missileCooldownMs`),
    cannonSide: readCannonSide(row.cannonSide, `${label}.cannonSide`),
    bay: readShipBay(row.bay, `${label}.bay`),
    side: side(row.side, `${label}.side`),
    role: role(row.role, `${label}.role`),
    ...shipHealth(row, label),
    craft: readCraft(row.craft, `${label}.craft`),
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

function integer(value: unknown, label: string): number {
  const number = requireNumber(value, label)
  if (!Number.isInteger(number)) throw new Error(`${label} must be an integer`)
  return number
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
