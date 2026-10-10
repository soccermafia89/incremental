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
    })
    this.nextId += 1
  }

  fly(
    dtMs: number,
    shotSpeed: number,
    onHit: (shot: ShotState) => void,
    track: (shipId: string) => { x: number; y: number } | undefined,
  ): void {
    const distance = shotSpeed * (dtMs / 1000)
    const stillFlying: ShotState[] = []
    for (const shot of this.shots) {
      if (shot.shipId) {
        const body = track(shot.shipId)
        if (!body) continue
        shot.targetX = body.x
        shot.targetY = body.y
      }
      const hit = moveToward(shot, { x: shot.targetX, y: shot.targetY }, distance)
      if (!hit) {
        stillFlying.push(shot)
        continue
      }
      onHit(shot)
    }
    this.shots = stillFlying
  }

  scene(): { id: string; x: number; y: number; side: Side }[] {
    return this.shots.map(shot => ({ id: shot.id, x: shot.x, y: shot.y, side: shot.side }))
  }

  save(): { nextShotId: number; shots: ShotState[] } {
    return { nextShotId: this.nextId, shots: this.shots.map(copyShot) }
  }
}

export function copyShot(shot: ShotState): ShotState {
  return { ...shot }
}
