import { moveToward } from '../motion/move'
import type { Side } from '../miner/types'

export interface ShotState {
  id: string
  x: number
  y: number
  targetX: number
  targetY: number
  asteroidId: string | null
  shipId: string | null
  side: Side
  damage: number
  /** True when a base cannon fired this shot. That kill pays no bounty. */
  cannon: boolean
}

export interface FiredShot {
  x: number
  y: number
  targetX: number
  targetY: number
  asteroidId: string | null
  shipId: string | null
  side: Side
  damage: number
  /** True when a base cannon fired this shot. That kill pays no bounty. */
  cannon: boolean
}

export class Volley {
  private shots: ShotState[]
  private nextId: number

  private constructor(shots: ShotState[], nextId: number) {
    this.shots = shots
    this.nextId = nextId
  }

  static empty(): Volley {
    return new Volley([], 1)
  }

  static restore(shots: ShotState[], nextId: number): Volley {
    return new Volley(shots.map(copyShot), nextId)
  }

  fire(shot: FiredShot): void {
    this.shots.push({
      id: `shot-${this.nextId}`,
      x: shot.x,
      y: shot.y,
      targetX: shot.targetX,
      targetY: shot.targetY,
      asteroidId: shot.asteroidId,
      shipId: shot.shipId,
      side: shot.side,
      damage: shot.damage,
      cannon: shot.cannon,
    })
    this.nextId += 1
  }

  fly(
    dtMs: number,
    shotSpeed: number,
    cannonSpeed: number,
    onHit: (shot: ShotState) => void,
    track: (shipId: string) => { x: number; y: number } | undefined,
  ): void {
    const stillFlying: ShotState[] = []
    for (const shot of this.shots) {
      if (shot.shipId) {
        const body = track(shot.shipId)
        if (!body) continue
        shot.targetX = body.x
        shot.targetY = body.y
      }
      const speed = shot.cannon ? cannonSpeed : shotSpeed
      const hit = moveToward(shot, { x: shot.targetX, y: shot.targetY }, speed * (dtMs / 1000))
      if (!hit) {
        stillFlying.push(shot)
        continue
      }
      onHit(shot)
    }
    this.shots = stillFlying
  }

  scene(): { id: string; x: number; y: number; side: Side }[] {
    return this.shots
      .filter(shot => !shot.cannon)
      .map(shot => ({ id: shot.id, x: shot.x, y: shot.y, side: shot.side }))
  }

  save(): { nextShotId: number; shots: ShotState[] } {
    return { nextShotId: this.nextId, shots: this.shots.map(copyShot) }
  }
}

export function copyShot(shot: ShotState): ShotState {
  return { ...shot }
}
