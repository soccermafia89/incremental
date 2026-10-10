import { read } from '../number'

/** Where the bases and the asteroid field sit. */
export interface MapLayoutConfig {
  width: number
  height: number
  baseX: number
  baseY: number
  baseRadius: number
  rivalBaseX: number
  rivalBaseY: number
  fieldX0: number
  fieldY0: number
  fieldX1: number
  fieldY1: number
  /** Pixel size of one repulsion cell. */
  cell: number
}

export function parseMapLayout(raw: unknown): MapLayoutConfig {
  const map = read<MapLayoutConfig>(raw, 'map', {
    width: { min: 0 },
    height: { min: 0 },
    baseX: {},
    baseY: {},
    baseRadius: { min: 0 },
    rivalBaseX: {},
    rivalBaseY: {},
    fieldX0: {},
    fieldY0: {},
    fieldX1: {},
    fieldY1: {},
    cell: { integer: true, min: 1 },
  })
  if (map.fieldX0 >= map.fieldX1 || map.fieldY0 >= map.fieldY1) {
    throw new Error('asteroid field bounds are inverted')
  }
  if (
    map.fieldX0 < 0 || map.fieldY0 < 0 ||
    map.fieldX1 > map.width || map.fieldY1 > map.height
  ) {
    throw new Error('asteroid field must sit inside the map')
  }
  place(map, map.baseX, map.baseY, 'base')
  place(map, map.rivalBaseX, map.rivalBaseY, 'rival base')
  return map
}

function place(map: MapLayoutConfig, x: number, y: number, label: string): void {
  if (x < 0 || x > map.width || y < 0 || y > map.height) {
    throw new Error(`${label} must sit inside the map`)
  }
}
