import type { MapLayoutConfig } from '../../data/map'
import type { Side } from '../miner/types'

export class MapLayout {
  private readonly map: MapLayoutConfig

  constructor(map: MapLayoutConfig) {
    this.map = map
  }

  home(side: Side): { x: number; y: number } {
    if (side === 'rival') return { x: this.map.rivalBaseX, y: this.map.rivalBaseY }
    return { x: this.map.baseX, y: this.map.baseY }
  }

  scene(): {
    width: number
    height: number
    base: { x: number; y: number; radius: number }
    rival: { x: number; y: number; radius: number }
    field: { x0: number; y0: number; x1: number; y1: number }
  } {
    return {
      width: this.map.width,
      height: this.map.height,
      base: { x: this.map.baseX, y: this.map.baseY, radius: this.map.baseRadius },
      rival: { x: this.map.rivalBaseX, y: this.map.rivalBaseY, radius: this.map.baseRadius },
      field: {
        x0: this.map.fieldX0,
        y0: this.map.fieldY0,
        x1: this.map.fieldX1,
        y1: this.map.fieldY1,
      },
    }
  }
}
