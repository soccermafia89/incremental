import { describe, expect, it } from 'vitest'
import { loadGameConfig } from './GameConfig'
import { doublingTable, linearTable, powerTable, type UpgradeSpec } from './upgradeSpec'

function crystal(spec: UpgradeSpec): UpgradeSpec {
  return { ...spec, levels: spec.levels.map(level => ({ ...level, crystal: true })) }
}

describe('loadGameConfig', () => {
  it('reads each module file', () => {
    const config = loadGameConfig()
    expect(config.map.fieldX0).toBe(328)
    expect(config.map.fieldX1).toBe(712)
    expect(config.map.baseX).toBeLessThan(config.map.fieldX0)
    expect(config.map.rivalBaseX).toBeGreaterThan(config.map.fieldX1)
    expect(config.asteroids).toEqual({ spawnMs: 5_000, max: 20, health: 5, healthScale: 2, size: 18, sizeStep: 2 })
    expect(config.map.cell).toBe(8)
    expect(config.ships).toEqual({ speed: 45, shotIntervalMs: 1000, weaponRange: 90, minerRange: 70, shotSpeed: 140, units: 60, radius: 8, health: 20 })
    expect(config.fighter).toEqual({ cost: 0, units: 1000, bounty: 30 })
    expect(config.fighterUpgrades.speed).toEqual(linearTable(10, 2, 30, 200))
    expect(config.fighterUpgrades.attackRate).toEqual(linearTable(1, 1, 4, 200))
    expect(config.fighterUpgrades.health).toEqual(linearTable(20, 10, 70, 200))
    expect(config.fighterUpgrades.damage).toEqual(linearTable(10, 5, 20, 200))
    expect(config.fighterUpgrades.count).toEqual({
      levels: [
        { value: 0, cost: 0 },
        { value: 1, cost: 200 },
        { value: 2, cost: 400 },
        { value: 3, cost: 800 },
        { value: 4, cost: 1600 },
        { value: 5, cost: 5, crystal: true },
        { value: 8, cost: 10, crystal: true },
        { value: 11, cost: 20, crystal: true },
        { value: 14 },
      ],
    })
    expect(config.fighterUpgrades.production).toEqual(powerTable(6, 10 / 7, 200))
    expect(config.enemyUpgrades.spawnRate).toEqual(doublingTable(1, 128, 800, 1))
    expect(config.enemyUpgrades.capacity).toEqual({
      bounty: 1.3,
      levels: [
        { value: 1, cost: 500 },
        { value: 10, cost: 1000 },
        { value: 15, cost: 2000 },
        { value: 20, cost: 4000 },
        { value: 25, cost: 8000 },
        { value: 30 },
      ],
    })
    expect(config.enemyUpgrades.health).toEqual(linearTable(20, 20, 80, 500, 1.3))
    expect(config.enemyUpgrades.damage).toEqual(linearTable(1, 1, 4, 500, 1.3))
    expect(config.enemyUpgrades.attackRate).toEqual(linearTable(1, 1, 4, 500, 1.3))
    expect(config.corvette).toEqual({ cost: 5_000, bounty: 500, crystal: 1, spawnMs: 12_500, shotMs: 375, speedScale: 0.975, rangeScale: 1.5, missileDamage: 160 })
    expect(config.corvetteUpgrades.health).toEqual(crystal(linearTable(600, 120, 1_200, 5)))
    expect(config.corvetteUpgrades.damage).toEqual(crystal(linearTable(24, 8, 64, 5)))
    expect(config.corvetteUpgrades.attackRate).toEqual(crystal(linearTable(1, 1, 3, 5)))
    expect(config.corvetteUpgrades.speed).toEqual(crystal({
      levels: [
        { value: 1, cost: 5 },
        { value: 1.5, cost: 10 },
        { value: 2 },
      ],
    }))
    expect(config.corvetteUpgrades.spawnRate).toEqual(crystal(doublingTable(1, 8, 5)))
    expect(config.corvetteUpgrades.capacity).toEqual(crystal(linearTable(0, 1, 4, 5)))
    expect(config.corvetteUpgrades.missiles).toEqual(crystal(linearTable(0, 1, 1, 5)))
    expect(config.rival).toEqual({ shipsAt: 3, shipsBy: 2, speedAt: 8, speedBy: 1.5, carryAt: 4, carryBy: 2, replenishMs: 60_000 })
    expect(config.ore).toEqual({ value: 1, speed: 24 })
    expect(config.cannon).toEqual({ wake: 150, range: 300, rate: 9, damage: 1000, shotSpeed: 20000 })
    expect(config.defense).toEqual({ buildMs: 60_000, rangeScale: 1.125, shotMs: 2_000, speed: 8 })
    expect(config.defenseUpgrades.capacity).toEqual(linearTable(0, 1, 1, 4_000))
    expect(config.defenseUpgrades.health).toEqual(crystal(linearTable(2_000, 1_000, 5_000, 5)))
    expect(config.defenseUpgrades.attackRate).toEqual(crystal(linearTable(1, 1, 4, 5)))
    expect(config.defenseUpgrades.damage).toEqual(crystal(linearTable(120, 60, 300, 5)))
    expect(config.bank).toEqual({ startingMoney: 0, gift: 20, giftNext: 10_000, crystalGift: 10_000 })
    expect(config.upgrades.speed).toEqual(linearTable(10, 2, 30, 1))
    expect(config.upgrades.damage.levels.map(level => level.cost)).toEqual([1, 2, 5, 10, 30, 80, 200, 500, 1000, undefined])
    expect(config.upgrades.damage.levels.map(level => level.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(config.upgrades.fireRate.levels.map(level => [level.value, level.cost])).toEqual([
      [1, 1], [2, 10], [3, 50], [4, 200], [5, undefined],
    ])
    expect(config.upgrades.carry).toEqual(linearTable(1, 1, 5, 1))
    expect(config.upgrades.count).toEqual(linearTable(1, 1, 5, 5))
    expect(config.upgrades.production).toEqual(linearTable(1, 1, 8, 1))
    expect(config.mining.goldenSpawnRate.levels.map(level => [level.value, level.cost])).toEqual([
      [1, 50], [2, 100], [3, 200], [4, 500], [5, undefined],
    ])
    expect(config.mining.golden).toEqual({ cost: 50 })
    expect(config.mining.unlock).toEqual({ cost: 10 })
    expect(config.mining.automine).toEqual({ cost: 10_000, payout: 800, everyMs: 5_000 })
    expect(config.mining.moneyConverter).toEqual({ cost: 100_000, above: 100_000 })
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
    expect(config.mining.size).toEqual(linearTable(1, 1, 3, 1))
    expect(config.mining.spawnRate).toEqual(linearTable(1, 1, 5, 1))
    expect(config.mining.tractorBeam).toEqual({ cost: 350 })
    expect(config.designer.cost).toBe(10_000)
    expect(config.designer.half).toBe(10)
    expect(config.designer.weaponDamage).toBe(10)
    expect(config.designer.bays).toEqual([20])
    expect(config.designer.bayProduction).toEqual({
      scale: 0.6,
      bonus: 1.5,
      levels: [
        { value: 0, cost: 2_000 },
        { value: 1, cost: 4_000 },
        { value: 2 },
      ],
    })
    expect(config.designer.bayCapacity).toEqual({
      levels: [
        { value: 1, cost: 2_000 },
        { value: 2, cost: 4_000 },
        { value: 3, cost: 8_000 },
        { value: 4 },
      ],
    })
    expect(config.designer.weapons.laser).toEqual({ cost: 4_000 })
    expect(config.designer.weapons.missile).toEqual({ crystal: 1 })
    expect(config.designer.core).toEqual({ weight: 2, health: 20, mounts: ['n', 'e', 's', 'w'] })
    expect(config.designer.components.structural).toMatchObject({ weight: 1, thrust: 0, energy: -1, health: 10 })
    expect(config.designer.components.armor).toMatchObject({ weight: 10, thrust: 0, energy: 0, health: 300, units: 200 })
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
    expect(config.weaponUpgrades.laserRange.levels[0].value).toBe(config.designer.components.laser.range)
    expect(config.weaponUpgrades.laserEnergy.levels.at(-1)?.value).toBe(-config.designer.components.laser.energy)
    expect(config.weaponUpgrades.missileDamage.levels[0].value).toBe(30)
    expect(config.weaponUpgrades.laserRange).toEqual(crystal(linearTable(270, 90, 540, 5)))
    expect(config.weaponUpgrades.laserEnergy).toEqual(crystal(linearTable(0, 1, 4, 5)))
    expect(config.weaponUpgrades.cannonFireRate).toEqual({
      baseMs: 1_000,
      levels: [
        { value: 1, cost: 2_000 },
        { value: 2, cost: 5, crystal: true },
        { value: 3, cost: 10, crystal: true },
        { value: 4, crystal: true },
      ],
    })
    expect(config.weaponUpgrades.cannonDamage).toEqual({
      levels: [
        { value: 10, cost: 2_000 },
        { value: 20, cost: 5, crystal: true },
        { value: 30, cost: 10, crystal: true },
        { value: 40, crystal: true },
      ],
    })
    expect(config.weaponUpgrades.missileFireRate).toEqual({ ...crystal(linearTable(1, 1, 4, 5)), baseMs: 5_000 })
    expect(config.weaponUpgrades.missileDamage.levels[0].cost).toBe(5)
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
