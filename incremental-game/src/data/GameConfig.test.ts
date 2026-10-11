import { describe, expect, it } from 'vitest'
import { loadGameConfig } from './GameConfig'

describe('loadGameConfig', () => {
  it('reads each module file', () => {
    const config = loadGameConfig()
    expect(config.map.fieldX0).toBe(328)
    expect(config.map.fieldX1).toBe(712)
    expect(config.map.baseX).toBeLessThan(config.map.fieldX0)
    expect(config.map.rivalBaseX).toBeGreaterThan(config.map.fieldX1)
    expect(config.asteroids).toEqual({ spawnMs: 5_000, max: 20, health: 5, healthScale: 2, size: 18, sizeStep: 2 })
    expect(config.map.cell).toBe(8)
    expect(config.ships).toEqual({ speed: 45, shotIntervalMs: 1000, weaponRange: 90, shotSpeed: 140, units: 60, radius: 8, health: 20 })
    expect(config.fighter).toEqual({ cost: 0, units: 1000, bounty: 100 })
    expect(config.fighterUpgrades.speed).toEqual({ start: 10, step: 2, max: 30, cost: 4 })
    expect(config.fighterUpgrades.attackRate).toEqual({ start: 1, step: 1, max: 5, cost: 4 })
    expect(config.fighterUpgrades.health).toEqual({ start: 20, step: 10, max: 60, cost: 4 })
    expect(config.fighterUpgrades.damage).toEqual({ start: 10, step: 5, max: 20, cost: 4 })
    expect(config.fighterUpgrades.count).toEqual({ start: 0, step: 1, max: 5, cost: 20 })
    expect(config.fighterUpgrades.production).toEqual({ start: 1, step: 1, max: 8, cost: 4 })
    expect(config.enemyUpgrades.spawnRate).toEqual({ start: 1, step: 1, max: 128, cost: 20, bounty: 1 })
    expect(config.enemyUpgrades.capacity).toEqual({ start: 10, step: 5, max: 30, cost: 5, bounty: 1.3 })
    expect(config.enemyUpgrades.health).toEqual({ start: 20, step: 10, max: 60, cost: 20, bounty: 1.3 })
    expect(config.enemyUpgrades.damage).toEqual({ start: 1, step: 1, max: 10, cost: 20, bounty: 1.3 })
    expect(config.enemyUpgrades.attackRate).toEqual({ start: 1, step: 1, max: 4, cost: 20, bounty: 1.3 })
    expect(config.rival).toEqual({ shipsAt: 3, shipsBy: 2, speedAt: 8, speedBy: 1.5, carryAt: 4, carryBy: 2, replenishMs: 60_000 })
    expect(config.ore).toEqual({ value: 1, speed: 24 })
    expect(config.cannon).toEqual({ wake: 150, range: 300, rate: 9, damage: 1000, shotSpeed: 20000 })
    expect(config.bank).toEqual({ startingMoney: 0, gift: 10_000 })
    expect(config.upgrades.speed).toEqual({ start: 10, step: 2, max: 30, cost: 1 })
    expect(config.upgrades.damage).toEqual({ start: 1, step: 1, max: 10, cost: 1 })
    expect(config.upgrades.fireRate).toEqual({ start: 1, step: 1, max: 5, cost: 1 })
    expect(config.upgrades.carry).toEqual({ start: 1, step: 1, max: 5, cost: 1 })
    expect(config.upgrades.count).toEqual({ start: 1, step: 1, max: 5, cost: 5 })
    expect(config.upgrades.production).toEqual({ start: 1, step: 1, max: 8, cost: 1 })
    expect(config.mining.goldenSpawnRate).toEqual({ start: 1, step: 1, max: 5, cost: 1 })
    expect(config.mining.golden).toEqual({ cost: 50 })
    expect(config.mining.unlock).toEqual({ cost: 10 })
    expect(config.mining.automine).toEqual({ cost: 10_000, perSecond: 200 })
    expect(config.golden).toEqual({
      health: 4,
      value: 20,
      size: 10,
      spawnMs: 10_000,
      max: 3,
      rivalShips: 3,
      rivalFire: 2,
      rivalDamage: 2,
      rivalCarry: 2,
    })
    expect(config.mining.size).toEqual({ start: 1, step: 1, max: 3, cost: 1 })
    expect(config.mining.spawnRate).toEqual({ start: 1, step: 1, max: 5, cost: 1 })
    expect(config.mining.tractorBeam).toEqual({ cost: 350 })
    expect(config.designer.cost).toBe(2_000)
    expect(config.designer.half).toBe(10)
    expect(config.designer.weaponDamage).toBe(10)
    expect(config.designer.weapons.laser).toEqual({ cost: 4_000 })
    expect(config.designer.weapons.missile).toEqual({ cost: 12_000 })
    expect(config.designer.core).toEqual({ weight: 2, health: 20, mounts: ['n', 'e', 's', 'w'] })
    expect(config.designer.components.structural).toMatchObject({ weight: 1, thrust: 0, energy: -1, health: 20 })
    expect(config.designer.components.armor).toMatchObject({ weight: 8, thrust: 0, energy: -4, health: 200, units: 120 })
    expect(config.designer.components.armor.cells).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }])
    expect(config.designer.components.weapon).toMatchObject({ label: 'Cannon', weight: 2, thrust: 0, energy: -1, range: 90 })
    expect(config.designer.components.laser).toMatchObject({ energy: -4, range: 270, units: 60 })
    expect(config.designer.components.laser.cells).toEqual([
      { x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: -2 }, { x: 0, y: -3 },
    ])
    expect(config.designer.components.missile).toMatchObject({ energy: -1, range: 180, units: 400 })
    expect(config.designer.components.missile.cells).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 0, y: -1 }, { x: 1, y: -1 },
    ])
    expect(config.weaponUpgrades.laserRange.start).toBe(config.designer.components.laser.range)
    expect(config.weaponUpgrades.laserEnergy.max).toBe(-config.designer.components.laser.energy)
    expect(config.weaponUpgrades.missileDamage.start).toBe(30)
    expect(config.weaponUpgrades.cannonFireRate).toEqual({ start: 1, step: 1, max: 4, cost: 2_000, baseMs: 1_000 })
    expect(config.weaponUpgrades.cannonDamage).toEqual({ start: 10, step: 10, max: 40, cost: 2_000 })
    expect(config.weaponUpgrades.missileFireRate).toEqual({ start: 1, step: 1, max: 4, cost: 4_000, baseMs: 5_000 })
    expect(config.designer.components.structural.range).toBe(0)
    expect(config.designer.components.thruster).toMatchObject({ weight: 1, thrust: 8, energy: -1 })
    expect(config.designer.engines.mediumEngine.cost).toBe(5_000)
    expect(config.designer.engines.largeEngine.cost).toBe(15_000)
    expect(config.designer.components.mediumEngine).toMatchObject({
      weight: 3, thrust: 20, energy: -4, units: 80,
    })
    expect(config.designer.components.mediumEngine.cells).toHaveLength(2)
    expect(config.designer.components.largeEngine).toMatchObject({
      weight: 10, thrust: 50, energy: -10, units: 240,
    })
    expect(config.designer.components.largeEngine.cells).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 0, y: 1 }, { x: 1, y: 1 },
      { x: 0, y: 2 }, { x: 1, y: 2 },
    ])
    expect(config.designer.components.mediumEngine.thrust).toBeGreaterThan(config.designer.components.thruster.thrust)
    expect(config.designer.components.largeEngine.thrust).toBeGreaterThan(config.designer.components.mediumEngine.thrust)
    expect(config.designer.components.mediumEngine.energy).toBeLessThan(config.designer.components.thruster.energy)
    expect(config.designer.components.largeEngine.energy).toBeLessThan(config.designer.components.mediumEngine.energy)
    expect(config.designer.components.energy).toMatchObject({ weight: 1, thrust: 0, energy: 4 })
    expect(config.designer.components.structural.units).toBe(10)
    expect(config.designer.components.weapon.units).toBe(50)
    expect(config.designer.components.thruster.units).toBe(25)
    expect(config.designer.components.energy.units).toBe(40)
    expect(config.designer.components.weapon.cells).toEqual([{ x: 0, y: 0 }, { x: 0, y: -1 }])
    expect(config.designer.components.weapon.mounts).toEqual([{ x: 0, y: 0, side: 's' }])
    expect(config.designer.components.minerLaser).toMatchObject({
      color: '#fef08a', range: 0, thrust: 0,
    })
    expect(config.designer.components.minerLaser.cells).toEqual([{ x: 0, y: 0 }, { x: 0, y: -1 }])
    expect(config.designer.components.energy.cells).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }])
    expect(config.designer.components.energy.mounts).toEqual([
      { x: 0, y: 0, side: 'n' },
      { x: 0, y: 0, side: 'e' },
      { x: 0, y: 0, side: 's' },
      { x: 0, y: 0, side: 'w' },
      { x: 0, y: 1, side: 'n' },
      { x: 0, y: 1, side: 'e' },
      { x: 0, y: 1, side: 's' },
      { x: 0, y: 1, side: 'w' },
    ])
  })
})
