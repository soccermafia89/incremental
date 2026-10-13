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
  /** A missile. Enemy ships inside the round blast take half damage. */
  splash: boolean
  /** A miner shot. Drawn as a yellow beam. Its damage and speed stay on the miner upgrades. */
  mining: boolean
  /** A defense-platform cannon shot. Drawn larger than a gun bolt. */
  heavy: boolean
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
  /** A missile. Enemy ships inside the round blast take half damage. */
  splash: boolean
  /** A miner shot. Drawn as a yellow beam. Its damage and speed stay on the miner upgrades. */
  mining: boolean
  /** A defense-platform cannon shot. Drawn larger than a gun bolt. */
  heavy: boolean
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
      splash: shot.splash,
      mining: shot.mining,
      heavy: shot.heavy,
    })
    this.nextId += 1
  }

  fly(
    dtMs: number,
    shotSpeed: number,
    cannonSpeed: number,
    onHit: (shot: ShotState) => void,
    track: (shipId: string) => { x: number; y: number } | undefined,
    acquire: (shot: { x: number; y: number; side: Side }) => { id: string; x: number; y: number } | undefined,
    map: { width: number; height: number },
  ): void {
    const stillFlying: ShotState[] = []
    for (const shot of this.shots) {
      let body: { x: number; y: number } | undefined
      if (shot.shipId) body = track(shot.shipId)
      if (shot.splash && !body) {
        const next = acquire(shot)
        if (next) {
          shot.shipId = next.id
          shot.asteroidId = null
          body = next
        }
      }
      if (shot.shipId) {
        if (body) {
          shot.targetX = body.x
          shot.targetY = body.y
        } else if (!coast(shot)) {
          continue
        }
      }
      const speed = shot.cannon ? cannonSpeed : shot.splash ? shotSpeed / 2 : shotSpeed
      const hit = moveToward(shot, { x: shot.targetX, y: shot.targetY }, speed * (dtMs / 1000))
      if (outside(shot, map)) continue
      if (!hit) {
        stillFlying.push(shot)
        continue
      }
      if (shot.shipId && !body) {
        if (!coast(shot)) continue
        stillFlying.push(shot)
        continue
      }
      onHit(shot)
    }
    this.shots = stillFlying
  }

  scene(): { id: string; x: number; y: number; side: Side; splash: boolean; mining: boolean; heavy: boolean; angle: number }[] {
    return this.shots
      .filter(shot => !shot.cannon)
      .map(shot => ({
        id: shot.id,
        x: shot.x,
        y: shot.y,
        side: shot.side,
        splash: shot.splash,
        mining: shot.mining,
        heavy: shot.heavy,
        angle: Math.atan2(shot.targetY - shot.y, shot.targetX - shot.x),
      }))
  }

  save(): { nextShotId: number; shots: ShotState[] } {
    return { nextShotId: this.nextId, shots: this.shots.map(copyShot) }
  }
}

export function copyShot(shot: ShotState): ShotState {
  return { ...shot }
}

/** Keep the last heading, aimed far past the map, once the ship it was following is gone. */
function coast(shot: ShotState): boolean {
  const dx = shot.targetX - shot.x
  const dy = shot.targetY - shot.y
  const length = Math.hypot(dx, dy)
  if (length < 1) return false
  const reach = 100_000
  shot.targetX = shot.x + (dx / length) * reach
  shot.targetY = shot.y + (dy / length) * reach
  return true
}

function outside(shot: { x: number; y: number }, map: { width: number; height: number }): boolean {
  return shot.x < 0 || shot.y < 0 || shot.x > map.width || shot.y > map.height
}
