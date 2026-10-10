/** Scale that fits a fixed board into the free space, without stretching it. */
export function fitScale(slotW: number, slotH: number, boardW: number, boardH: number): number {
  if (slotW <= 0 || slotH <= 0 || boardW <= 0 || boardH <= 0) return 1
  return Math.min(slotW / boardW, slotH / boardH)
}
