import { mapping, requireInt, requireNumber } from '../number'
import { parseUpgradeRows, type UpgradeSpec } from '../upgradeSpec'

export const COMPONENT_IDS = ['structural', 'armor', 'weapon', 'laser', 'missile', 'thruster', 'mediumEngine', 'largeEngine', 'energy', 'minerLaser'] as const
export type ComponentId = (typeof COMPONENT_IDS)[number]

/** Guns bought on Ship Upgrades after the designer. The stock gun comes with the designer. */
export const WEAPON_UNLOCK_IDS = ['laser', 'missile'] as const
export type WeaponUnlockId = (typeof WEAPON_UNLOCK_IDS)[number]

/** Engines bought on Ship Upgrades after the designer. The stock thruster comes with the designer. */
export const ENGINE_UNLOCK_IDS = ['mediumEngine', 'largeEngine'] as const
export type EngineUnlockId = (typeof ENGINE_UNLOCK_IDS)[number]

export const GUN_IDS = ['weapon', 'laser', 'missile'] as const
export type GunId = (typeof GUN_IDS)[number]

export function isGunId(value: string): value is GunId {
  return (GUN_IDS as readonly string[]).includes(value)
}

export function isEnginePart(value: string): boolean {
  return value === 'thruster' || (ENGINE_UNLOCK_IDS as readonly string[]).includes(value)
}

export const SIDES = ['n', 'e', 's', 'w'] as const
export type Side = (typeof SIDES)[number]

export interface GridCell {
  x: number
  y: number
}

export interface Mount {
  x: number
  y: number
  side: Side
}

export interface ComponentSpec {
  label: string
  /** Production units to build one. Same units as a fighter. */
  units: number
  /** Added to the ship. Every component has some. */
  weight: number
  /** Engines add this. Speed is thrust divided by weight. */
  thrust: number
  /** Positive grants energy. Negative is what a part consumes. */
  energy: number
  /** Added to the ship's health. Zero for parts that are not hull. */
  health: number
  /** How far a shot from this part reaches. Zero for parts that are not guns. */
  range: number
  color: string
  cells: GridCell[]
  mounts: Mount[]
}

export interface WeaponUnlock {
  cost: number
}

export interface MissileUnlock {
  crystal: number
}

export interface DesignerConfig {
  cost: number
  half: number
  /** Damage of one weapon that has energy left to spend. */
  weaponDamage: number
  /** Crystal cost of each extra production bay, in unlock order. The first bay is free. */
  bays: number[]
  /** Per-bay build rate. `scale` of the fighter rate, then `bonus` for each money purchase. */
  bayProduction: UpgradeSpec & { scale: number; bonus: number }
  /** Ships an extra bay keeps. The first row is included in the unlock. */
  bayCapacity: UpgradeSpec
  weapons: { laser: WeaponUnlock; missile: MissileUnlock }
  engines: Record<EngineUnlockId, WeaponUnlock>
  core: { weight: number; health: number; mounts: Side[] }
  components: Record<ComponentId, ComponentSpec>
}

export function isWeaponUnlock(value: string): value is WeaponUnlockId {
  return (WEAPON_UNLOCK_IDS as readonly string[]).includes(value)
}

export function isEngineUnlock(value: string): value is EngineUnlockId {
  return (ENGINE_UNLOCK_IDS as readonly string[]).includes(value)
}

export function isComponentId(value: string): value is ComponentId {
  return (COMPONENT_IDS as readonly string[]).includes(value)
}

export function parseDesigner(raw: unknown): DesignerConfig {
  const row = mapping(raw, 'designer')
  const cost = requireInt(row.cost, 'designer.cost')
  const half = requireInt(row.half, 'designer.half')
  if (cost < 1) throw new Error('designer.cost must be at least 1')
  if (half < 1) throw new Error('designer.half must be at least 1')
  const weaponDamage = requireInt(row.weaponDamage, 'designer.weaponDamage')
  if (weaponDamage < 1) throw new Error('designer.weaponDamage must be at least 1')
  return {
    cost,
    half,
    weaponDamage,
    bays: parseBayCosts(row.bays),
    bayProduction: parseBayProduction(row.bayProduction),
    bayCapacity: parseBayCapacity(row.bayCapacity),
    weapons: parseWeapons(row.weapons),
    engines: parseUnlocks(row.engines, ENGINE_UNLOCK_IDS, 'designer.engines'),
    core: parseCore(row.core),
    components: parseComponents(row.components),
  }
}

function parseBayProduction(raw: unknown): DesignerConfig['bayProduction'] {
  const row = mapping(raw, 'designer.bayProduction')
  const scale = requireNumber(row.scale, 'designer.bayProduction.scale')
  const bonus = requireNumber(row.bonus, 'designer.bayProduction.bonus')
  if (scale <= 0) throw new Error('designer.bayProduction.scale must be above 0')
  if (bonus <= 0) throw new Error('designer.bayProduction.bonus must be above 0')
  const table = parseUpgradeRows({ bayProduction: raw }, ['bayProduction'] as const, 'designer').bayProduction
  return { ...table, scale, bonus }
}

function parseBayCapacity(raw: unknown): DesignerConfig['bayCapacity'] {
  return parseUpgradeRows({ bayCapacity: raw }, ['bayCapacity'] as const, 'designer').bayCapacity
}

function parseBayCosts(raw: unknown): number[] {
  if (!Array.isArray(raw)) throw new Error('designer.bays must be a list')
  return raw.map((item, index) => {
    const cost = requireInt(item, `designer.bays[${index}]`)
    if (cost < 1) throw new Error(`designer.bays[${index}] must be at least 1`)
    return cost
  })
}

function parseComponents(raw: unknown): Record<ComponentId, ComponentSpec> {
  const row = mapping(raw, 'designer.components')
  for (const key of Object.keys(row)) {
    if (!isComponentId(key)) throw new Error(`designer.components.${key} is unknown`)
  }
  const components = {} as Record<ComponentId, ComponentSpec>
  for (const id of COMPONENT_IDS) {
    if (!(id in row)) throw new Error(`designer.components.${id} is missing`)
    components[id] = parseComponent(row[id], `designer.components.${id}`, id)
  }
  return components
}

function parseWeapons(raw: unknown): DesignerConfig['weapons'] {
  const row = mapping(raw, 'designer.weapons')
  for (const key of Object.keys(row)) {
    if (key !== 'laser' && key !== 'missile') throw new Error(`designer.weapons.${key} is unknown`)
  }
  if (!('laser' in row)) throw new Error('designer.weapons.laser is missing')
  if (!('missile' in row)) throw new Error('designer.weapons.missile is missing')
  const laser = mapping(row.laser, 'designer.weapons.laser')
  const missile = mapping(row.missile, 'designer.weapons.missile')
  const cost = requireInt(laser.cost, 'designer.weapons.laser.cost')
  const crystal = requireInt(missile.crystal, 'designer.weapons.missile.crystal')
  if (cost < 1) throw new Error('designer.weapons.laser.cost must be at least 1')
  if (crystal < 1) throw new Error('designer.weapons.missile.crystal must be at least 1')
  return { laser: { cost }, missile: { crystal } }
}

function parseUnlocks<Id extends string>(raw: unknown, ids: readonly Id[], label: string): Record<Id, WeaponUnlock> {
  const row = mapping(raw, label)
  const known = new Set<string>(ids)
  for (const key of Object.keys(row)) {
    if (!known.has(key)) throw new Error(`${label}.${key} is unknown`)
  }
  const unlocks = {} as Record<Id, WeaponUnlock>
  for (const id of ids) {
    if (!(id in row)) throw new Error(`${label}.${id} is missing`)
    const spec = mapping(row[id], `${label}.${id}`)
    const cost = requireInt(spec.cost, `${label}.${id}.cost`)
    if (cost < 1) throw new Error(`${label}.${id}.cost must be at least 1`)
    unlocks[id] = { cost }
  }
  return unlocks
}

function parseComponent(raw: unknown, label: string, id: ComponentId): ComponentSpec {
  const row = mapping(raw, label)
  const labelText = row.label
  if (typeof labelText !== 'string' || labelText.length === 0) {
    throw new Error(`${label}.label must be a non-empty string`)
  }
  const color = row.color
  if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error(`${label}.color must be a #rrggbb color`)
  }
  const units = requireInt(row.units, `${label}.units`)
  if (units < 1) throw new Error(`${label}.units must be at least 1`)
  const weight = requireInt(row.weight, `${label}.weight`)
  if (weight < 1) throw new Error(`${label}.weight must be at least 1`)
  const thrust = requireInt(row.thrust, `${label}.thrust`)
  if (thrust < 0) throw new Error(`${label}.thrust must be at least 0`)
  const energy = requireInt(row.energy, `${label}.energy`)
  const health = requireInt(row.health, `${label}.health`)
  if (health < 0) throw new Error(`${label}.health must be at least 0`)
  const range = requireInt(row.range, `${label}.range`)
  const gun = (GUN_IDS as readonly string[]).includes(id)
  if (gun && range < 1) throw new Error(`${label}.range must be at least 1`)
  if (!gun && range !== 0) throw new Error(`${label}.range must be 0`)
  const cells = parseCells(row.cells, `${label}.cells`)
  if (!cells.some(cell => cell.x === 0 && cell.y === 0)) {
    throw new Error(`${label}.cells must include 0,0`)
  }
  const mounts = parseMounts(row.mounts, `${label}.mounts`)
  for (const mount of mounts) {
    if (!cells.some(cell => cell.x === mount.x && cell.y === mount.y)) {
      throw new Error(`${label}.mounts must sit on one of its cells`)
    }
  }
  return { label: labelText, units, weight, thrust, energy, health, range, color, cells, mounts }
}

function parseCore(raw: unknown): DesignerConfig['core'] {
  const row = mapping(raw, 'designer.core')
  const weight = requireInt(row.weight, 'designer.core.weight')
  if (weight < 1) throw new Error('designer.core.weight must be at least 1')
  const health = requireInt(row.health, 'designer.core.health')
  if (health < 0) throw new Error('designer.core.health must be at least 0')
  return { weight, health, mounts: parseSides(row.mounts, 'designer.core.mounts') }
}

function parseCells(raw: unknown, label: string): GridCell[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error(`${label} must be a list`)
  const cells = raw.map((item, index) => parsePair(item, `${label}[${index}]`))
  const seen = new Set<string>()
  for (const cell of cells) {
    const key = `${cell.x},${cell.y}`
    if (seen.has(key)) throw new Error(`${label} repeats a cell`)
    seen.add(key)
  }
  return cells
}

function parseMounts(raw: unknown, label: string): Mount[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error(`${label} must be a list`)
  return raw.map((item, index) => {
    const spot = `${label}[${index}]`
    if (!Array.isArray(item) || item.length !== 3) throw new Error(`${spot} must be x, y, side`)
    const cell = parsePair([item[0], item[1]], spot)
    return { ...cell, side: parseSide(item[2], `${spot} side`) }
  })
}

function parseSides(raw: unknown, label: string): Side[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error(`${label} must be a list`)
  const sides = raw.map((item, index) => parseSide(item, `${label}[${index}]`))
  if (new Set(sides).size !== sides.length) throw new Error(`${label} repeats a side`)
  return sides
}

function parsePair(raw: unknown, label: string): GridCell {
  if (!Array.isArray(raw) || raw.length !== 2) throw new Error(`${label} must be x, y`)
  return { x: requireInt(raw[0], `${label} x`), y: requireInt(raw[1], `${label} y`) }
}

function parseSide(raw: unknown, label: string): Side {
  if (typeof raw !== 'string' || !(SIDES as readonly string[]).includes(raw)) {
    throw new Error(`${label} is invalid`)
  }
  return raw as Side
}
