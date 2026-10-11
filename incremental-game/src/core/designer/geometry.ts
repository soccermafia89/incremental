import type { GameConfig } from '../../data/GameConfig'
import type { ComponentSpec, GridCell, Mount, Side } from '../../data/designer'
import type { PlacedPart, Rotation } from './types'

export const CORE_ID = 'core'

const CLOCKWISE: Record<Side, Side> = { n: 'e', e: 's', s: 'w', w: 'n' }
const DELTA: Record<Side, GridCell> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
}
const OPPOSITE: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' }

export interface Occupant {
  id: string
  mounts: Side[]
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

export function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

export function worldCells(spec: ComponentSpec, x: number, y: number, rotation: Rotation): GridCell[] {
  const quarters = rotation / 90
  return spec.cells.map(cell => {
    const turned = turnCell(cell.x, cell.y, quarters)
    return { x: x + turned.x, y: y + turned.y }
  })
}

export function worldMounts(spec: ComponentSpec, x: number, y: number, rotation: Rotation): Mount[] {
  const quarters = rotation / 90
  return spec.mounts.map(mount => {
    const turned = turnCell(mount.x, mount.y, quarters)
    return { x: x + turned.x, y: y + turned.y, side: turnSide(mount.side, quarters) }
  })
}

/** Core at (0, 0), then each placed part. */
export function occupy(config: GameConfig, parts: PlacedPart[]): Map<string, Occupant> {
  const occupied = new Map<string, Occupant>()
  occupied.set(cellKey(0, 0), { id: CORE_ID, mounts: [...config.designer.core.mounts] })
  for (const part of parts) {
    const spec = config.designer.components[part.component]
    const mounts = worldMounts(spec, part.x, part.y, part.rotation)
    for (const cell of worldCells(spec, part.x, part.y, part.rotation)) {
      occupied.set(cellKey(cell.x, cell.y), {
        id: part.id,
        mounts: mounts.filter(mount => mount.x === cell.x && mount.y === cell.y).map(mount => mount.side),
      })
    }
  }
  return occupied
}

/** A mount bolts on when the facing neighbor has the opposite mount. */
export function touches(occupied: Map<string, Occupant>, mounts: Mount[]): boolean {
  return mounts.some(mount => {
    const step = DELTA[mount.side]
    const neighbor = occupied.get(cellKey(mount.x + step.x, mount.y + step.y))
    return neighbor !== undefined && neighbor.mounts.includes(OPPOSITE[mount.side])
  })
}

/** Every part can reach the core by walking across mating mounts. */
export function connected(config: GameConfig, parts: PlacedPart[]): boolean {
  const occupied = occupy(config, parts)
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
      const neighbor = occupied.get(cellKey(x + step.x, y + step.y))
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
