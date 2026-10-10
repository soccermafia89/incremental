import { describe, expect, it } from 'vitest'
import { parseMapLayout } from './index'

describe('parseMapLayout', () => {
  it('rejects an inverted asteroid field', () => {
    expect(() => parseMapLayout({
      width: 100,
      height: 100,
      baseX: 10,
      baseY: 50,
      baseRadius: 4,
      rivalBaseX: 90,
      rivalBaseY: 50,
      fieldX0: 80,
      fieldY0: 10,
      fieldX1: 40,
      fieldY1: 90,
      cell: 8,
    })).toThrow(/inverted/)
  })
})
