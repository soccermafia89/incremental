import { describe, expect, it } from 'vitest'
import { loadGameConfig } from '../../data/GameConfig'
import { ShipDesign } from './Design'
import { designFile, readDesignFile } from './file'

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
    expect(design.place(config, 'weapon', 0, -1, 0)).toBe('ok')
    expect(design.place(config, 'structural', 0, -3, 0)).toBe('attach')
    expect(design.place(config, 'weapon', 1, 0, 0)).toBe('attach')
    expect(design.place(config, 'weapon', 1, 0, 90)).toBe('ok')
    const aimed = design.preview(config, 'weapon', -1, 0, 270)
    expect(aimed?.legal).toBe(true)
    expect(aimed?.cells.map(cell => `${cell.x},${cell.y}`)).toEqual(['-1,0', '-2,0'])
    expect(aimed?.mounts).toEqual([{ x: -1, y: 0, side: 'e' }])
    expect(design.place(config, 'weapon', 0, -config.designer.half, 0)).toBe('bounds')
    expect(design.place(config, 'structural', 0, -1, 0)).toBe('overlap')
    const missed = design.preview(config, 'weapon', 3, 3, 0)
    expect(missed?.legal).toBe(false)
    expect(missed?.cells.map(cell => `${cell.x},${cell.y}`)).toEqual(['3,3', '3,2'])
    expect(missed?.mounts).toEqual([{ x: 3, y: 3, side: 's' }])
  })

  it('attaches a thruster and an energy block on their own mounts', () => {
    const design = open()
    expect(design.place(config, 'thruster', 1, 0, 0)).toBe('attach')
    expect(design.place(config, 'thruster', 0, 1, 0)).toBe('ok')
    expect(design.place(config, 'energy', 1, 0, 0)).toBe('ok')
    expect(design.place(config, 'energy', 0, -2, 0)).toBe('ok')
    expect(design.place(config, 'energy', 3, 3, 0)).toBe('attach')
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

  it('adds each placed piece into the ship build units', () => {
    const design = open()
    expect(design.scene(config).units).toBe(0)
    expect(design.place(config, 'structural', 1, 0, 0)).toBe('ok')
    expect(design.place(config, 'weapon', 0, -1, 0)).toBe('ok')
    const structural = config.designer.components.structural.units
    const weapon = config.designer.components.weapon.units
    expect(design.scene(config).units).toBe(structural + weapon)
    const id = design.save().parts[0]?.id
    expect(id).toBe('part-1')
    if (!id) return
    expect(design.remove(config, id)).toBe('ok')
    expect(design.scene(config).units).toBe(weapon)
  })

  it('sets speed to thrust divided by weight and nets energy', () => {
    const design = open()
    expect(design.scene(config).stats).toEqual({
      weight: config.designer.core.weight,
      thrust: 0,
      speed: 0,
      energy: 0,
      health: config.designer.core.health,
      damage: 0,
      fires: [],
      range: 0,
    })
    expect(design.place(config, 'thruster', 0, 1, 0)).toBe('ok')
    expect(design.place(config, 'energy', 1, 0, 0)).toBe('ok')
    expect(design.place(config, 'weapon', 0, -1, 0)).toBe('ok')
    const parts = ['thruster', 'energy', 'weapon'] as const
    const weight = config.designer.core.weight + parts.reduce((sum, id) => sum + config.designer.components[id].weight, 0)
    const thrust = parts.reduce((sum, id) => sum + config.designer.components[id].thrust, 0)
    const energy = parts.reduce((sum, id) => sum + config.designer.components[id].energy, 0)
    expect(design.scene(config).stats).toEqual({
      weight,
      thrust,
      speed: thrust / weight,
      energy,
      health: config.designer.core.health,
      damage: config.designer.weaponDamage,
      fires: [{ kind: 'weapon', label: config.designer.components.weapon.label, damage: config.designer.weaponDamage, interval: config.ships.shotIntervalMs, range: config.designer.components.weapon.range }],
      range: config.designer.components.weapon.range,
    })
  })

  it('adds structural health, and armor adds much more', () => {
    const design = open()
    expect(design.place(config, 'structural', 1, 0, 0)).toBe('ok')
    expect(design.scene(config).stats.health).toBe(config.designer.core.health + config.designer.components.structural.health)
    expect(design.place(config, 'armor', 0, 1, 0)).toBe('ok')
    expect(design.scene(config).stats.health).toBe(
      config.designer.core.health + config.designer.components.structural.health + config.designer.components.armor.health,
    )
    expect(design.place(config, 'armor', 0, -1, 90)).toBe('overlap')
  })

  it('keeps the copied design after the grid changes', () => {
    expect(ShipDesign.create().commit()).toBe('unknown')
    const design = open()
    expect(design.save().savedDesign).toBeNull()
    expect(design.place(config, 'structural', 1, 0, 0)).toBe('ok')
    expect(design.commit()).toBe('ok')
    const copied = design.save().savedDesign
    const id = design.save().parts[0]?.id
    expect(id).toBeDefined()
    if (!id) return
    expect(design.remove(config, id)).toBe('ok')
    expect(design.save().parts).toEqual([])
    expect(design.save().savedDesign).toEqual(copied)
    expect(design.scene(config).units).toBe(0)
    expect(design.scene(config).saved?.units).toBe(config.designer.components.structural.units)
  })

  it('flies and shoots from the saved design', () => {
    const design = open()
    expect(design.combat(config)).toBeNull()
    expect(design.place(config, 'thruster', 0, 1, 0)).toBe('ok')
    expect(design.place(config, 'weapon', 0, -1, 0)).toBe('ok')
    expect(design.commit()).toBe('ok')
    const weight = config.designer.core.weight + config.designer.components.thruster.weight + config.designer.components.weapon.weight
    expect(design.combat(config)).toEqual({
      speed: config.ships.speed * (config.designer.components.thruster.thrust / weight),
      damage: 0,
      fires: [],
      weapons: [],
      health: config.designer.core.health,
      cells: [
        { x: 0, y: 0, color: '#e2e8f0' },
        { x: 0, y: 1, color: config.designer.components.thruster.color },
        { x: 0, y: -1, color: config.designer.components.weapon.color },
        { x: 0, y: -2, color: config.designer.components.weapon.color },
      ],
    })
    expect(design.place(config, 'energy', 1, 0, 0)).toBe('ok')
    expect(design.commit()).toBe('ok')
    const powered = weight + config.designer.components.energy.weight
    expect(design.combat(config)).toEqual({
      speed: config.ships.speed * (config.designer.components.thruster.thrust / powered),
      damage: config.designer.weaponDamage,
      fires: [{ kind: 'weapon', label: config.designer.components.weapon.label, damage: config.designer.weaponDamage, interval: config.ships.shotIntervalMs, range: config.designer.components.weapon.range }],
      weapons: [{ kind: 'weapon', range: config.designer.components.weapon.range, splash: false }],
      health: config.designer.core.health,
      cells: [
        { x: 0, y: 0, color: '#e2e8f0' },
        { x: 0, y: 1, color: config.designer.components.thruster.color },
        { x: 0, y: -1, color: config.designer.components.weapon.color },
        { x: 0, y: -2, color: config.designer.components.weapon.color },
        { x: 1, y: 0, color: config.designer.components.energy.color },
        { x: 1, y: 1, color: config.designer.components.energy.color },
      ],
    })
  })

  it('fires faster as more weapons get power, and each shot keeps the same damage', () => {
    const design = open()
    expect(design.place(config, 'thruster', 0, 1, 0)).toBe('ok')
    expect(design.place(config, 'energy', 1, 0, 0)).toBe('ok')
    expect(design.place(config, 'structural', -1, 0, 0)).toBe('ok')
    expect(design.place(config, 'weapon', 0, -1, 0)).toBe('ok')
    expect(design.place(config, 'weapon', 2, 0, 90)).toBe('ok')
    expect(design.place(config, 'weapon', 1, 2, 180)).toBe('ok')
    expect(design.commit()).toBe('ok')
    const spare = config.designer.components.energy.energy
      + config.designer.components.thruster.energy
      + config.designer.components.structural.energy
    const powered = Math.floor(spare / -config.designer.components.weapon.energy)
    expect(powered).toBe(2)
    expect(design.combat(config)?.fires).toEqual([
      { kind: 'weapon', label: config.designer.components.weapon.label, damage: config.designer.weaponDamage, interval: Math.round(config.ships.shotIntervalMs / powered), range: config.designer.components.weapon.range },
    ])
    expect(design.combat(config)?.weapons).toEqual([
      { kind: 'weapon', range: config.designer.components.weapon.range, splash: false },
      { kind: 'weapon', range: config.designer.components.weapon.range, splash: false },
    ])
  })

  it('keeps a laser dark until a whole energy block is free, and reaches farther without raising damage', () => {
    const design = open()
    expect(design.place(config, 'laser', 0, -1, 0)).toBe('unknown')
    design.unlockWeapon('laser')
    expect(design.place(config, 'thruster', 0, 1, 0)).toBe('ok')
    expect(design.place(config, 'energy', 1, 0, 0)).toBe('ok')
    expect(design.place(config, 'laser', 0, -1, 0)).toBe('ok')
    expect(design.commit()).toBe('ok')
    expect(design.combat(config)).toMatchObject({ damage: 0, weapons: [] })
    const eased = { laserRange: config.designer.components.laser.range + 90, laserEnergy: -3, cannonRate: 1, cannonDamage: config.designer.weaponDamage, missileRate: 1, missileDamage: config.designer.weaponDamage }
    expect(design.combat(config, eased)?.weapons).toEqual([
      { kind: 'laser', range: config.designer.components.laser.range + 90, splash: false },
    ])
    expect(design.place(config, 'energy', -1, 0, 0)).toBe('ok')
    expect(design.commit()).toBe('ok')
    expect(design.combat(config)).toMatchObject({
      damage: config.designer.weaponDamage,
      fires: [{ kind: 'laser', label: config.designer.components.laser.label, damage: config.designer.weaponDamage, interval: config.ships.shotIntervalMs, range: config.designer.components.laser.range }],
      weapons: [{ kind: 'laser', range: config.designer.components.laser.range, splash: false }],
    })
    expect(design.scene(config).stats.range).toBe(config.designer.components.laser.range)
  })

  it('powers a missile at medium range', () => {
    const design = open()
    design.unlockWeapon('missile')
    expect(design.place(config, 'thruster', 0, 1, 0)).toBe('ok')
    expect(design.place(config, 'energy', 1, 0, 0)).toBe('ok')
    expect(design.place(config, 'missile', 0, -1, 0)).toBe('ok')
    expect(design.commit()).toBe('ok')
    expect(design.combat(config)).toMatchObject({
      damage: config.weaponUpgrades.missileDamage.start,
      weapons: [{ kind: 'missile', range: config.designer.components.missile.range, splash: true }],
    })
  })

  it('clears the grid and leaves the copied ship', () => {
    expect(ShipDesign.create().clear()).toBe('unknown')
    const design = open()
    expect(design.place(config, 'structural', 1, 0, 0)).toBe('ok')
    expect(design.commit()).toBe('ok')
    const copied = design.save().savedDesign
    expect(design.clear()).toBe('ok')
    expect(design.save().parts).toEqual([])
    expect(design.save().savedDesign).toEqual(copied)
  })

  it('reads a design file and replaces the grid', () => {
    const part = { id: 'part-1', component: 'structural' as const, x: 1, y: 0, rotation: 0 as const }
    expect(readDesignFile(designFile([part]))).toEqual([part])
    expect(() => readDesignFile({ version: 2, parts: [] })).toThrow(/not supported/)
    const design = open()
    expect(design.place(config, 'thruster', 0, 1, 0)).toBe('ok')
    expect(design.commit()).toBe('ok')
    const copied = design.save().savedDesign
    expect(design.install(config, [part])).toBe('ok')
    expect(design.save().parts).toEqual([part])
    expect(design.save().nextPartId).toBe(2)
    expect(design.save().savedDesign).toEqual(copied)
    expect(design.install(config, [{ id: 'part-2', component: 'structural', x: 4, y: 4, rotation: 0 }])).toBe('layout')
    expect(design.save().parts).toEqual([part])
  })

  it('rejects a saved layout that could not have been built', () => {
    expect(() => ShipDesign.restore(config, false, false, false, false, false, [{
      id: 'part-1', component: 'structural', x: 1, y: 0, rotation: 0,
    }], 2, null)).toThrow(/ship designer/)
    expect(() => ShipDesign.restore(config, true, false, false, false, false, [{
      id: 'part-1', component: 'structural', x: 2, y: 2, rotation: 0,
    }], 2, null)).toThrow(/invalid/)
    expect(() => ShipDesign.restore(config, false, false, false, false, false, [], 1, [{
      id: 'part-1', component: 'structural', x: 1, y: 0, rotation: 0,
    }])).toThrow(/saved design/)
    expect(() => ShipDesign.restore(config, true, false, false, false, false, [], 1, [{
      id: 'part-1', component: 'structural', x: 2, y: 2, rotation: 0,
    }])).toThrow(/saved design is invalid/)
  })

  it('builds the miner from a core, a thruster, and a miner laser, and will not sell that laser', () => {
    const design = open()
    expect(design.place(config, 'minerLaser', 0, -1, 0)).toBe('unknown')
    expect(design.scene(config).catalog.map(item => item.id)).not.toContain('minerLaser')
    expect(ShipDesign.minerHull(config)).toEqual([
      { x: 0, y: 0, color: '#e2e8f0' },
      { x: 0, y: -1, color: '#fef08a' },
      { x: 0, y: -2, color: '#fef08a' },
      { x: 0, y: 1, color: '#fb923c' },
    ])
  })

  it('lists damage, attack interval, and range on the cannon and the missile', () => {
    const design = open()
    design.unlockWeapon('missile')
    const catalog = design.scene(config).catalog
    expect(catalog.find(item => item.id === 'weapon')).toMatchObject({
      damage: config.designer.weaponDamage,
      interval: config.ships.shotIntervalMs,
      range: config.designer.components.weapon.range,
    })
    expect(catalog.find(item => item.id === 'missile')).toMatchObject({
      damage: config.weaponUpgrades.missileDamage.start,
      interval: config.weaponUpgrades.missileFireRate.baseMs,
      range: config.designer.components.missile.range,
    })
  })
})
