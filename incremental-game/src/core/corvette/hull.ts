import type { HullCell } from '../miner'

const HULL = '#991b1b'
const ARMOR = '#7f1d1d'
const NOSE = '#fecaca'
const ENGINE = '#fb923c'
/** Same color as the designer missile. */
const MISSILE = '#e879f9'

function row(y: number, xs: number[], color: string): HullCell[] {
  return xs.map(x => ({ x, y, color }))
}

/** A narrow warship. The body is three cells wide. Three engines sit abreast at the stern. Nose is toward smaller y. */
export function corvetteHull(missiles = false): HullCell[] {
  const body = [
    ...row(-4, [0], NOSE),
    ...row(-3, [-1, 0, 1], NOSE),
    ...row(-2, [-1, 0, 1], HULL),
    ...row(-1, [-1, 0, 1], ARMOR),
    ...row(0, [-1, 0, 1], HULL),
    ...row(1, [-1, 0, 1], HULL),
    ...row(2, [-1, 0, 1], ENGINE),
  ]
  if (!missiles) return body
  // The designer missile is a 2x2. This pod sits on the port side, barrel toward the nose.
  return [
    ...body,
    ...row(-1, [-3, -2], MISSILE),
    ...row(0, [-3, -2], MISSILE),
  ]
}
