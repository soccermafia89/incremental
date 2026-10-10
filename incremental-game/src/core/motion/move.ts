const ARRIVE_PX = 4

export function inWeaponRange(
  ship: { x: number; y: number },
  target: { x: number; y: number },
  range: number,
): boolean {
  return Math.hypot(target.x - ship.x, target.y - ship.y) <= range
}

export function moveToward(
  body: { x: number; y: number },
  target: { x: number; y: number },
  distance: number,
): boolean {
  const dx = target.x - body.x
  const dy = target.y - body.y
  const length = Math.hypot(dx, dy)
  if (length <= distance || length <= ARRIVE_PX) {
    body.x = target.x
    body.y = target.y
    return true
  }
  body.x += (dx / length) * distance
  body.y += (dy / length) * distance
  return false
}

export function moveTowardRange(
  ship: { x: number; y: number },
  target: { x: number; y: number },
  travel: number,
  standOff: number,
): boolean {
  const dx = target.x - ship.x
  const dy = target.y - ship.y
  const length = Math.hypot(dx, dy)
  if (length <= standOff) {
    placeInsideRange(ship, target, standOff)
    return true
  }
  const step = Math.min(travel, length - standOff)
  if (length > 0 && step > 0) {
    ship.x += (dx / length) * step
    ship.y += (dy / length) * step
  }
  if (length - step <= standOff) {
    placeInsideRange(ship, target, standOff)
    return true
  }
  return false
}

/** Park a hair inside weapon range so the arrive check and the fire check agree. */
function placeInsideRange(
  ship: { x: number; y: number },
  target: { x: number; y: number },
  standOff: number,
): void {
  const dx = target.x - ship.x
  const dy = target.y - ship.y
  const length = Math.hypot(dx, dy)
  const hold = Math.max(0, standOff - 0.5)
  if (length <= hold || length === 0) return
  ship.x = target.x - (dx / length) * hold
  ship.y = target.y - (dy / length) * hold
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}
