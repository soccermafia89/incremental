import { mapping, requireInt } from '../number'

export const COMPONENT_IDS = ['structural', 'weapon', 'thruster', 'energy'] as const
export type ComponentId = (typeof COMPONENT_IDS)[number]

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
  color: string
  cells: GridCell[]
  mounts: Mount[]
}

export interface DesignerConfig {
  cost: number
  half: number
  core: { mounts: Side[] }
  components: Record<ComponentId, ComponentSpec>
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
  return {
    cost,
    half,
    core: { mounts: parseSides(mapping(row.core, 'designer.core').mounts, 'designer.core.mounts') },
    components: parseComponents(row.components),
  }
}

function parseComponents(raw: unknown): Record<ComponentId, ComponentSpec> {
  const row = mapping(raw, 'designer.components')
  for (const key of Object.keys(row)) {
    if (!isComponentId(key)) throw new Error(`designer.components.${key} is unknown`)
  }
  const components = {} as Record<ComponentId, ComponentSpec>
  for (const id of COMPONENT_IDS) {
    if (!(id in row)) throw new Error(`designer.components.${id} is missing`)
    components[id] = parseComponent(row[id], `designer.components.${id}`)
  }
  return components
}

function parseComponent(raw: unknown, label: string): ComponentSpec {
  const row = mapping(raw, label)
  const labelText = row.label
  if (typeof labelText !== 'string' || labelText.length === 0) {
    throw new Error(`${label}.label must be a non-empty string`)
  }
  const color = row.color
  if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error(`${label}.color must be a #rrggbb color`)
  }
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
  return { label: labelText, color, cells, mounts }
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
