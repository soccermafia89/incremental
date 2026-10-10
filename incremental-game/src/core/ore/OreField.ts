import type { GameConfig } from '../../data/GameConfig'
import type { AsteroidKind } from '../asteroid/AsteroidField'
import { nearestTo } from '../motion/nearest'

export interface OreState {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  /** Money this nugget pays. Stamped when the rock breaks. */
  worth: number
  kind: AsteroidKind
}

export class OreField {
  private ores: OreState[]
  private nextId: number

  private constructor(ores: OreState[], nextId: number) {
    this.ores = ores
    this.nextId = nextId
  }

  static empty(): OreField {
    return new OreField([], 1)
  }

  static restore(ores: OreState[], nextId: number): OreField {
    return new OreField(ores.map(copyOre), nextId)
  }

  entries(): OreState[] {
    return this.ores.slice()
  }

  find(id: string | null): OreState | undefined {
    if (id === null) return undefined
    return this.ores.find(ore => ore.id === id)
  }

  nearest(from: { x: number; y: number }): OreState | undefined {
    return nearestTo(this.ores, from)
  }

  distance(ship: { x: number; y: number; targetId: string | null }): number {
    const ore = this.find(ship.targetId)
    if (!ore) return Number.POSITIVE_INFINITY
    return Math.hypot(ore.x - ship.x, ore.y - ship.y)
  }

  drift(dtMs: number, config: GameConfig): void {
    const dt = dtMs / 1000
    const width = config.map.width
    const height = config.map.height
    for (const ore of this.ores) {
      ore.x += ore.vx * dt
      ore.y += ore.vy * dt
      if (ore.x < 0) {
        ore.x = 0
        ore.vx = Math.abs(ore.vx)
      } else if (ore.x > width) {
        ore.x = width
        ore.vx = -Math.abs(ore.vx)
      }
      if (ore.y < 0) {
        ore.y = 0
        ore.vy = Math.abs(ore.vy)
      } else if (ore.y > height) {
        ore.y = height
        ore.vy = -Math.abs(ore.vy)
      }
    }
  }

  spawn(x: number, y: number, config: GameConfig, roll: () => number, kind: AsteroidKind): OreState {
    const angle = roll() * Math.PI * 2
    const ore: OreState = {
      id: `ore-${this.nextId}`,
      x,
      y,
      vx: Math.cos(angle) * config.ore.speed,
      vy: Math.sin(angle) * config.ore.speed,
      worth: kind === 'golden' ? config.ore.value * config.golden.value : config.ore.value,
      kind,
    }
    this.nextId += 1
    this.ores.push(ore)
    return ore
  }

  remove(id: string): void {
    this.ores = this.ores.filter(ore => ore.id !== id)
  }

  /** Remove every nugget and return the money they are worth together. */
  drain(): number {
    const worth = this.ores.reduce((sum, ore) => sum + ore.worth, 0)
    this.ores = []
    return worth
  }

  scene(): { id: string; x: number; y: number; kind: AsteroidKind }[] {
    return this.ores.map(ore => ({ id: ore.id, x: ore.x, y: ore.y, kind: ore.kind }))
  }

  save(): { nextOreId: number; ores: OreState[] } {
    return { nextOreId: this.nextId, ores: this.ores.map(copyOre) }
  }
}

export function copyOre(ore: OreState): OreState {
  return { ...ore }
}
