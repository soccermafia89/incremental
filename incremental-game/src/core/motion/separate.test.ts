import { describe, expect, it } from 'vitest'
import { separateShips } from './separate'

function cellOf(ship: { x: number; y: number }): string {
  return `${Math.floor(ship.x / 8)},${Math.floor(ship.y / 8)}`
}

const bounds = { width: 1000, height: 650 }

describe('separateShips', () => {
  it('pushes ships that share a cell until their bodies are apart', () => {
    const ships = [
      { id: 'ship-1', x: 400, y: 300 },
      { id: 'ship-2', x: 402, y: 300 },
    ]
    separateShips(ships, 8, 8, bounds)
    expect(Math.hypot(ships[0].x - ships[1].x, ships[0].y - ships[1].y)).toBeGreaterThanOrEqual(16)
    expect(cellOf(ships[0])).not.toBe(cellOf(ships[1]))
  })

  it('pushes ships that sit on either side of a cell line', () => {
    const ships = [
      { id: 'ship-1', x: 7.9, y: 40 },
      { id: 'ship-2', x: 8.1, y: 40 },
    ]
    separateShips(ships, 8, 8, bounds)
    expect(Math.hypot(ships[0].x - ships[1].x, ships[0].y - ships[1].y)).toBeGreaterThanOrEqual(16)
  })

  it('leaves ships that are already apart where they are', () => {
    const ships = [
      { id: 'ship-1', x: 100, y: 100 },
      { id: 'ship-2', x: 200, y: 100 },
    ]
    separateShips(ships, 8, 8, bounds)
    expect(ships[0]).toEqual({ id: 'ship-1', x: 100, y: 100 })
    expect(ships[1]).toEqual({ id: 'ship-2', x: 200, y: 100 })
  })

  it('spreads a crowd that started on one point', () => {
    const ships = Array.from({ length: 8 }, (_, index) => ({
      id: `ship-${index + 1}`,
      x: 500,
      y: 300,
    }))
    separateShips(ships, 8, 8, bounds)
    for (let i = 0; i < ships.length; i++) {
      for (let j = i + 1; j < ships.length; j++) {
        const gap = Math.hypot(ships[i].x - ships[j].x, ships[i].y - ships[j].y)
        expect(gap).toBeGreaterThanOrEqual(16)
      }
    }
  })
})
