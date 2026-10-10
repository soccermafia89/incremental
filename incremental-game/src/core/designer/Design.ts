import type { GameConfig } from '../../data/GameConfig'
import {
  COMPONENT_IDS,
  isComponentId,
  type ComponentId,
  type ComponentSpec,
  type GridCell,
  type Mount,
  type Side,
} from '../../data/designer'

export const ROTATIONS = [0, 90, 180, 270] as const
export type Rotation = (typeof ROTATIONS)[number]

export type DesignResult = 'ok' | 'unknown' | 'attach' | 'overlap' | 'bounds' | 'disconnect'

export interface PlacedPart {
  id: string
  component: ComponentId
  x: number
  y: number
  rotation: Rotation
}

export interface DesignerCell {
  x: number
  y: number
  kind: 'empty' | 'core' | 'part'
  partId: string | null
  component: ComponentId | null
  color: string
  mounts: Side[]
}

export interface DesignerScene {
  owned: boolean
  cost: number | null
  half: number
  cells: DesignerCell[]
  catalog: { id: ComponentId; label: string; color: string; cells: GridCell[] }[]
}

const CLOCKWISE: Record<Side, Side> = { n: 'e', e: 's', s: 'w', w: 'n' }
const DELTA: Record<Side, GridCell> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
}
const OPPOSITE: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' }
const CORE_ID = 'core'
const EMPTY = '#0f172a'
const CORE_COLOR = '#e2e8f0'

export function isRotation(value: number): value is Rotation {
  return value === 0 || value === 90 || value === 180 || value === 270
}

/** Clockwise quarters. Y grows downward, the same way the grid is drawn. */
export function turnCell(x: number, y: number, quarters: number): GridCell {
  let cx = x
  let cy = y
  const steps = ((quarters % 4) + 4) % 4
  for (let i = 0; i < steps; i += 1) {
    const nextX = -cy
    const nextY = cx
    cx = nextX
    cy = nextY
  }
  return { x: cx, y: cy }
}

export function turnSide(side: Side, quarters: number): Side {
  let current = side
  const steps = ((quarters % 4) + 4) % 4
  for (let i = 0; i < steps; i += 1) current = CLOCKWISE[current]
  return current
}

/** The live ship layout. The core square is always present and is not a part. */
export class ShipDesign {
  private unlocked: boolean
  private parts: PlacedPart[]
  private nextId: number

  private constructor(unlocked: boolean, parts: PlacedPart[], nextId: number) {
    this.unlocked = unlocked
    this.parts = parts
    this.nextId = nextId
  }

  static create(): ShipDesign {
    return new ShipDesign(false, [], 1)
  }

  /** Replays the saved parts. Throws when the layout could not have been built. */
  static restore(config: GameConfig, unlocked: boolean, parts: PlacedPart[], nextPartId: number): ShipDesign {
    const design = new ShipDesign(unlocked, [], 1)
    if (!unlocked && parts.length > 0) throw new Error('parts require the ship designer')
    for (const part of parts) {
      const result = design.place(config, part.component, part.x, part.y, part.rotation, part.id)
      if (result !== 'ok') throw new Error('parts layout is invalid')
    }
    if (nextPartId < design.nextId) throw new Error('nextPartId is already used')
    design.nextId = nextPartId
    return design
  }

  hasUnlock(): boolean {
    return this.unlocked
  }

  unlock(): void {
    this.unlocked = true
  }

  place(config: GameConfig, component: string, x: number, y: number, rotation: number, id?: string): DesignResult {
    const laid = this.layout(config, component, x, y, rotation, id)
    if (typeof laid === 'string') return laid
    this.parts.push({ id: this.claim(id), component: laid.component, x, y, rotation: laid.rotation })
    return 'ok'
  }

  remove(config: GameConfig, id: string): DesignResult {
    if (!this.unlocked) return 'unknown'
    if (!this.parts.some(part => part.id === id)) return 'unknown'
    const remaining = this.parts.filter(part => part.id !== id)
    if (!this.connected(config, remaining)) return 'disconnect'
    this.parts = remaining
    return 'ok'
  }

  /** Squares the part would cover, when that click is a legal placement. */
  preview(config: GameConfig, component: string, x: number, y: number, rotation: number): GridCell[] | null {
    const laid = this.layout(config, component, x, y, rotation)
    if (typeof laid === 'string') return null
    return laid.cells
  }

  scene(config: GameConfig): DesignerScene {
    const half = config.designer.half
    const occupied = this.occupancy(config, this.parts)
    const cells: DesignerCell[] = []
    for (let y = -half; y <= half; y += 1) {
      for (let x = -half; x <= half; x += 1) {
        const spot = occupied.get(key(x, y))
        if (!spot) {
          cells.push({ x, y, kind: 'empty', partId: null, component: null, color: EMPTY, mounts: [] })
          continue
        }
        if (spot.id === CORE_ID) {
          cells.push({ x, y, kind: 'core', partId: null, component: null, color: CORE_COLOR, mounts: spot.mounts })
          continue
        }
        const part = this.parts.find(item => item.id === spot.id)
        const spec = part ? config.designer.components[part.component] : undefined
        cells.push({
          x,
          y,
          kind: 'part',
          partId: spot.id,
          component: part?.component ?? null,
          color: spec?.color ?? EMPTY,
          mounts: spot.mounts,
        })
      }
    }
    return {
      owned: this.unlocked,
      cost: this.unlocked ? null : config.designer.cost,
      half,
      cells,
      catalog: COMPONENT_IDS.map(id => {
        const spec = config.designer.components[id]
        return { id, label: spec.label, color: spec.color, cells: spec.cells.map(cell => ({ ...cell })) }
      }),
    }
  }

  save(): { shipDesigner: boolean; parts: PlacedPart[]; nextPartId: number } {
    return {
      shipDesigner: this.unlocked,
      parts: this.parts.map(part => ({ ...part })),
      nextPartId: this.nextId,
    }
  }

  private layout(
    config: GameConfig,
    component: string,
    x: number,
    y: number,
    rotation: number,
    id?: string,
  ): DesignResult | { component: ComponentId; rotation: Rotation; cells: GridCell[] } {
    if (!this.unlocked || !isComponentId(component) || !isRotation(rotation)) return 'unknown'
    if (id !== undefined && !/^part-[1-9]\d*$/.test(id)) return 'unknown'
    if (id !== undefined && this.parts.some(part => part.id === id)) return 'unknown'
    const spec = config.designer.components[component]
    const cells = worldCells(spec, x, y, rotation)
    const mounts = worldMounts(spec, x, y, rotation)
    const half = config.designer.half
    if (cells.some(cell => Math.abs(cell.x) > half || Math.abs(cell.y) > half)) return 'bounds'
    const occupied = this.occupancy(config, this.parts)
    if (cells.some(cell => occupied.has(key(cell.x, cell.y)))) return 'overlap'
    if (!touches(occupied, mounts)) return 'attach'
    return { component, rotation, cells }
  }

  private claim(requested?: string): string {
    if (requested === undefined) {
      const id = `part-${this.nextId}`
      this.nextId += 1
      return id
    }
    const number = Number(requested.slice('part-'.length))
    if (number >= this.nextId) this.nextId = number + 1
    return requested
  }

  private occupancy(config: GameConfig, parts: PlacedPart[]): Map<string, { id: string; mounts: Side[] }> {
    const occupied = new Map<string, { id: string; mounts: Side[] }>()
    occupied.set(key(0, 0), { id: CORE_ID, mounts: [...config.designer.core.mounts] })
    for (const part of parts) {
      const spec = config.designer.components[part.component]
      const mounts = worldMounts(spec, part.x, part.y, part.rotation)
      for (const cell of worldCells(spec, part.x, part.y, part.rotation)) {
        occupied.set(key(cell.x, cell.y), {
          id: part.id,
          mounts: mounts.filter(mount => mount.x === cell.x && mount.y === cell.y).map(mount => mount.side),
        })
      }
    }
    return occupied
  }

  /** Every part can reach the core by walking across mating mounts. */
  private connected(config: GameConfig, parts: PlacedPart[]): boolean {
    const occupied = this.occupancy(config, parts)
    const links = new Map<string, Set<string>>()
    const join = (left: string, right: string) => {
      const list = links.get(left) ?? new Set<string>()
      list.add(right)
      links.set(left, list)
    }
    for (const [spot, occupant] of occupied) {
      const [x, y] = spot.split(',').map(Number)
      for (const side of occupant.mounts) {
        const step = DELTA[side]
        const neighbor = occupied.get(key(x + step.x, y + step.y))
        if (!neighbor || neighbor.id === occupant.id) continue
        if (!neighbor.mounts.includes(OPPOSITE[side])) continue
        join(occupant.id, neighbor.id)
        join(neighbor.id, occupant.id)
      }
    }
    const seen = new Set<string>([CORE_ID])
    const queue = [CORE_ID]
    while (queue.length > 0) {
      const id = queue.pop()
      if (!id) continue
      for (const next of links.get(id) ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push(next)
      }
    }
    return parts.every(part => seen.has(part.id))
  }
}

function worldCells(spec: ComponentSpec, x: number, y: number, rotation: Rotation): GridCell[] {
  const quarters = rotation / 90
  return spec.cells.map(cell => {
    const turned = turnCell(cell.x, cell.y, quarters)
    return { x: x + turned.x, y: y + turned.y }
  })
}

function worldMounts(spec: ComponentSpec, x: number, y: number, rotation: Rotation): Mount[] {
  const quarters = rotation / 90
  return spec.mounts.map(mount => {
    const turned = turnCell(mount.x, mount.y, quarters)
    return { x: x + turned.x, y: y + turned.y, side: turnSide(mount.side, quarters) }
  })
}

function touches(occupied: Map<string, { mounts: Side[] }>, mounts: Mount[]): boolean {
  return mounts.some(mount => {
    const step = DELTA[mount.side]
    const neighbor = occupied.get(key(mount.x + step.x, mount.y + step.y))
    return neighbor !== undefined && neighbor.mounts.includes(OPPOSITE[mount.side])
  })
}

function key(x: number, y: number): string {
  return `${x},${y}`
}
