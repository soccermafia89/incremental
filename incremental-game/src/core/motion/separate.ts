interface Body {
  id: string
  x: number
  y: number
}

/**
 * Bucket every ship into a map cell, then push apart ships that share a
 * neighborhood. A ship only looks at nearby cells, so the cost follows how
 * many ships are crowded together, not how many ships exist.
 */
export function separateShips(
  ships: Body[],
  cell: number,
  radius: number,
  bounds: { width: number; height: number },
): void {
  if (cell <= 0 || radius <= 0 || ships.length < 2) return
  const minDist = radius * 2
  const reach = Math.max(1, Math.ceil(minDist / cell))
  for (let pass = 0; pass < 80; pass++) {
    const grids = new Map<string, Body[]>()
    for (const ship of ships) {
      const key = cellKey(ship.x, ship.y, cell)
      const list = grids.get(key)
      if (list) list.push(ship)
      else grids.set(key, [ship])
    }
    let pushed = false
    const seen = new Set<string>()
    for (const ship of ships) {
      const cx = Math.floor(ship.x / cell)
      const cy = Math.floor(ship.y / cell)
      for (let ox = -reach; ox <= reach; ox++) {
        for (let oy = -reach; oy <= reach; oy++) {
          const group = grids.get(`${cx + ox},${cy + oy}`)
          if (!group) continue
          for (const other of group) {
            if (other.id <= ship.id) continue
            const pair = `${ship.id}|${other.id}`
            if (seen.has(pair)) continue
            seen.add(pair)
            if (repulse(ship, other, minDist, bounds)) pushed = true
          }
        }
      }
    }
    if (!pushed) return
  }
}

export function cellKey(x: number, y: number, cell: number): string {
  return `${Math.floor(x / cell)},${Math.floor(y / cell)}`
}

function repulse(
  a: Body,
  b: Body,
  minDist: number,
  bounds: { width: number; height: number },
): boolean {
  let dx = b.x - a.x
  let dy = b.y - a.y
  const dist = Math.hypot(dx, dy)
  if (dist >= minDist) return false
  if (dist === 0) {
    const angle = splitAngle(a.id, b.id)
    dx = Math.cos(angle)
    dy = Math.sin(angle)
  } else {
    dx /= dist
    dy /= dist
  }
  const push = (minDist + 1e-4 - dist) / 2
  a.x = clamp(a.x - dx * push, 0, bounds.width)
  a.y = clamp(a.y - dy * push, 0, bounds.height)
  b.x = clamp(b.x + dx * push, 0, bounds.width)
  b.y = clamp(b.y + dy * push, 0, bounds.height)
  return true
}

function splitAngle(a: string, b: string): number {
  const key = a < b ? `${a}|${b}` : `${b}|${a}`
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return (hash % 360) * (Math.PI / 180)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
