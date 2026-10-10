import { describe, expect, it } from 'vitest'
import { fitScale } from './fitScale'

describe('fitScale', () => {
  it('fits the board to the shorter side', () => {
    expect(fitScale(500, 650, 1000, 650)).toBe(0.5)
    expect(fitScale(2000, 650, 1000, 650)).toBe(1)
    expect(fitScale(2000, 1300, 1000, 650)).toBe(2)
  })

  it('leaves the board alone until the slot has a size', () => {
    expect(fitScale(0, 400, 1000, 650)).toBe(1)
  })
})
