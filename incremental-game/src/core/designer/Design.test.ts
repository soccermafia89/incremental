import { describe, expect, it } from 'vitest'
import { loadGameConfig } from '../../data/GameConfig'
import { ShipDesign } from './Design'

const config = loadGameConfig()

function open(): ShipDesign {
  const design = ShipDesign.create()
  design.unlock()
  return design
}

describe('ship designer', () => {
  it('bolts a part onto the core and refuses a square that only touches a corner', () => {
    const design = open()
    expect(design.place(config, 'structural', 1, 0, 0)).toBe('ok')
    expect(design.place(config, 'structural', 0, 1, 0)).toBe('ok')
    expect(design.place(config, 'structural', 2, 1, 0)).toBe('attach')
    expect(design.place(config, 'nope', 2, 0, 0)).toBe('unknown')
    expect(design.place(config, 'structural', 2, 0, 45)).toBe('unknown')
    expect(design.save().parts).toHaveLength(2)
  })

  it('attaches a weapon only by its mount, and turns that mount when the part rotates', () => {
    const design = open()
    expect(design.place(config, 'weapon', 1, 0, 0)).toBe('ok')
    expect(design.place(config, 'structural', 3, 0, 0)).toBe('attach')
    expect(design.place(config, 'weapon', 0, 1, 0)).toBe('attach')
    expect(design.place(config, 'weapon', 0, 1, 90)).toBe('ok')
    expect(design.preview(config, 'weapon', -1, 0, 180)?.map(cell => `${cell.x},${cell.y}`)).toEqual(['-1,0', '-2,0'])
    expect(design.place(config, 'weapon', 4, 0, 0)).toBe('bounds')
    expect(design.place(config, 'structural', 1, 0, 0)).toBe('overlap')
  })

  it('attaches a thruster and an energy block on their own mounts', () => {
    const design = open()
    expect(design.place(config, 'thruster', 1, 0, 0)).toBe('attach')
    expect(design.place(config, 'thruster', 0, 1, 0)).toBe('ok')
    expect(design.place(config, 'energy', 1, 0, 0)).toBe('ok')
    expect(design.place(config, 'energy', 0, -2, 0)).toBe('attach')
    expect(design.place(config, 'energy', 0, -1, 270)).toBe('ok')
  })

  it('refuses to pull a part that the rest of the ship is hanging from', () => {
    const design = open()
    expect(design.place(config, 'structural', 1, 0, 0)).toBe('ok')
    expect(design.place(config, 'structural', 2, 0, 0)).toBe('ok')
    const [inner, outer] = design.save().parts
    expect(inner).toBeDefined()
    expect(outer).toBeDefined()
    if (!inner || !outer) return
    expect(design.remove(config, inner.id)).toBe('disconnect')
    expect(design.remove(config, outer.id)).toBe('ok')
    expect(design.remove(config, inner.id)).toBe('ok')
    expect(design.remove(config, inner.id)).toBe('unknown')
    expect(design.save().parts).toEqual([])
  })

  it('rejects a saved layout that could not have been built', () => {
    expect(() => ShipDesign.restore(config, false, [{
      id: 'part-1', component: 'structural', x: 1, y: 0, rotation: 0,
    }], 2)).toThrow(/ship designer/)
    expect(() => ShipDesign.restore(config, true, [{
      id: 'part-1', component: 'structural', x: 2, y: 2, rotation: 0,
    }], 2)).toThrow(/invalid/)
  })
})
