import type { GameConfig } from '../../data/GameConfig'
import { lerp } from '../motion/move'
import { nearestTo } from '../motion/nearest'
import type { ShotState } from '../shot/Shot'

export type AsteroidKind = 'normal' | 'golden'

export interface AsteroidState {
  id: string
  x: number
  y: number
  health: number
  maxHealth: number
  kind: AsteroidKind
}

export class AsteroidField {
  private asteroids: AsteroidState[]
  private nextId: number

  private constructor(asteroids: AsteroidState[], nextId: number) {
    this.asteroids = asteroids
    this.nextId = nextId
  }

  static empty(): AsteroidField {
    return new AsteroidField([], 1)
  }

  static restore(asteroids: AsteroidState[], nextId: number): AsteroidField {
    return new AsteroidField(asteroids.map(copyAsteroid), nextId)
  }

  get length(): number {
    return this.asteroids.length
  }

  find(id: string | null): AsteroidState | undefined {
    if (id === null) return undefined
    return this.asteroids.find(asteroid => asteroid.id === id)
  }

  nearest(from: { x: number; y: number }): AsteroidState | undefined {
    return nearestTo(this.asteroids, from)
  }

  spawn(config: GameConfig, roll: () => number, health: number): void {
    this.place('normal', health, config.asteroids.max, config, roll)
  }

  spawnGolden(config: GameConfig, roll: () => number, health: number): void {
    this.place('golden', health, config.golden.max, config, roll)
  }

  /** The field is gone. Ids already handed out stay spent. */
  clear(): void {
    this.asteroids = []
  }

  /** Multiply every rock already on the field. Damage already taken stays in proportion. */
  scaleHealth(factor: number): void {
    for (const asteroid of this.asteroids) {
      asteroid.health *= factor
      asteroid.maxHealth *= factor
    }
  }

  /** Apply one hit. Returns the asteroid when the hit destroys it. */
  hit(shot: ShotState): AsteroidState | undefined {
    const asteroid = this.asteroids.find(item => item.id === shot.asteroidId)
    if (!asteroid) return undefined
    asteroid.health -= shot.damage
    if (asteroid.health > 0) return undefined
    this.asteroids = this.asteroids.filter(item => item.id !== asteroid.id)
    return asteroid
  }

  scene(): AsteroidState[] {
    return this.asteroids.map(copyAsteroid)
  }

  save(): { nextAsteroidId: number; asteroids: AsteroidState[] } {
    return { nextAsteroidId: this.nextId, asteroids: this.scene() }
  }

  private place(kind: AsteroidKind, health: number, cap: number, config: GameConfig, roll: () => number): void {
    if (this.asteroids.filter(asteroid => asteroid.kind === kind).length >= cap) return
    const id = `asteroid-${this.nextId}`
    this.nextId += 1
    this.asteroids.push({
      id,
      kind,
      x: lerp(config.map.fieldX0, config.map.fieldX1, roll()),
      y: lerp(config.map.fieldY0, config.map.fieldY1, roll()),
      health,
      maxHealth: health,
    })
  }
}

export function copyAsteroid(asteroid: AsteroidState): AsteroidState {
  return { ...asteroid }
}
