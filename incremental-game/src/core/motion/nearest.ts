export function nearestTo<T extends { x: number; y: number }>(
  items: readonly T[],
  from: { x: number; y: number },
): T | undefined {
  let best: T | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const item of items) {
    const distance = Math.hypot(item.x - from.x, item.y - from.y)
    if (distance < bestDistance) {
      best = item
      bestDistance = distance
    }
  }
  return best
}
