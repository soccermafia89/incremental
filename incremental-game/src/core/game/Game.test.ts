import { describe, expect, it } from 'vitest'
import { corvetteHull } from '../corvette/hull'
import { blankCorvetteLevels } from '../../data/corvette/upgrades'
import { blankDefenseLevels } from '../../data/defense/upgrades'
import { blankEnemyLevels } from '../../data/enemy/upgrades'
import { blankFighterLevels } from '../../data/fighter/upgrades'
import { blankMiningLevels } from '../../data/mining'
import { blankLevels } from '../../data/upgrades'
import { blankWeaponLevels } from '../../data/weapons/upgrades'
import { loadGameConfig } from '../../data/GameConfig'
import { linearTable } from '../../data/upgradeSpec'
import { GameImpl, type MapState } from './Game'
import { platformAnchor, platformStop } from '../defense/Upgrades'
import { ShipDesign } from '../designer'
import { config, tuned } from './fixture'

function ceiling(spec: { levels: { value: number }[] }): number {
  return spec.levels[spec.levels.length - 1].value
}

describe('mining map', () => {
  it('opens with one miner at each base and a full asteroid field', () => {
    const scene = GameImpl.create(config, 1).scene()
    expect(scene.ships).toHaveLength(2)
    const player = scene.ships.find(ship => ship.side === 'player')
    const rival = scene.ships.find(ship => ship.side === 'rival')
    expect(player?.x).toBe(config.map.baseX)
    expect(rival?.x).toBe(config.map.rivalBaseX)
    expect(scene.rival.x).toBe(config.map.rivalBaseX)
    expect(scene.asteroids).toHaveLength(config.asteroids.max)
    for (const asteroid of scene.asteroids) {
      expect(asteroid.x).toBeGreaterThanOrEqual(config.map.fieldX0)
      expect(asteroid.x).toBeLessThanOrEqual(config.map.fieldX1)
      expect(asteroid.y).toBeGreaterThanOrEqual(config.map.fieldY0)
      expect(asteroid.y).toBeLessThanOrEqual(config.map.fieldY1)
      expect(asteroid.health).toBe(config.asteroids.health)
      expect(asteroid.maxHealth).toBe(config.asteroids.health)
      expect(asteroid.kind).toBe('normal')
    }
    expect(scene.money).toBe(config.bank.startingMoney)
    expect(scene.spawnInMs).toBe(config.asteroids.spawnMs)
  })

  it('draws a miner as a core, an engine, and a yellow mining laser', () => {
    const hull = ShipDesign.minerHull(config)
    const scene = GameImpl.create(config, 1).scene()
    expect(scene.ships.map(ship => ship.hull)).toEqual([hull, hull])
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      cannon: { range: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [{ id: 'asteroid-1', x: 220, y: 325, health: 100, maxHealth: 100, kind: 'normal' }],
      ships: [ship('player', 100, 325, 'shoot', 'asteroid-1')],
    }))
    game.advance(50)
    expect(game.scene().shots[0]).toMatchObject({ mining: true, splash: false })
    expect(game.scene().asteroids[0]?.health).toBe(100)
    const loaded = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      cannon: { range: 0 },
      asteroids: { spawnMs: 999_999 },
    }), game.exportState())
    expect(loaded.exportState().shots[0]?.mining).toBe(true)
  })

  it('shoots the asteroid apart, then hauls the ore it drops', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 400, shotSpeed: 700, weaponRange: 120, minerRange: 120, shotIntervalMs: 150 },
      asteroids: { health: 16, spawnMs: 999_999 },
    }), fresh({
      asteroids: [{ id: 'asteroid-1', x: 520, y: 325, health: 16, maxHealth: 16, kind: 'normal' }],
      ships: [ship('player', config.map.baseX, config.map.baseY, 'engage', 'asteroid-1')],
    }))

    advanceUntil(game, () => game.exportState().ships.some(miner => miner.mode === 'shoot'), 20_000)
    const rock = game.scene().asteroids[0]
    expect(rock).toBeDefined()
    if (!rock) return
    expect(rock.health).toBe(rock.maxHealth)

    advanceUntil(game, () => {
      const current = game.scene().asteroids[0]
      return current !== undefined && current.health < current.maxHealth
    }, 20_000)

    advanceUntil(game, () => game.scene().asteroids.length === 0 && game.scene().ores.length === 1, 20_000)
    expect(game.scene().ships[0]?.carrying).toBe(false)

    advanceUntil(game, () => game.scene().ships[0]?.carrying === true, 20_000)
    expect(game.scene().ores).toHaveLength(0)

    advanceUntil(game, () => game.scene().money === config.bank.startingMoney + config.ore.value, 20_000)
    expect(game.scene().ships).toHaveLength(1)
    expect(game.scene().ships[0]?.carrying).toBe(false)
  })

  it('keeps one ship at each base', () => {
    const game = GameImpl.create(tuned({ ships: { speed: 0 } }), 1)
    expect(game.scene().ships).toHaveLength(2)
    game.advance(config.asteroids.spawnMs * 9)
    expect(game.scene().asteroids).toHaveLength(10)
    expect(game.scene().ships).toHaveLength(2)
    expect(game.exportState().ships.filter(miner => miner.side === 'rival')).toHaveLength(1)
    expect(game.exportState().ships.filter(miner => miner.side === 'player')).toHaveLength(1)
  })

  it('lets both ships mine the same asteroid', () => {
    const game = GameImpl.create(tuned({ ships: { speed: 0 }, asteroids: { max: 1 } }), 1)
    game.advance(config.asteroids.spawnMs)
    const state = game.exportState()
    expect(state.ships).toHaveLength(2)
    expect(state.asteroids).toHaveLength(1)
    expect(state.ships.every(miner => miner.targetId === state.asteroids[0]?.id)).toBe(true)
  })

  it('gives the ore to whichever ship reaches it first', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 400 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [],
      ores: [{ id: 'ore-1', x: 500, y: 325, vx: 0, vy: 0, worth: 1, kind: 'normal' }],
      ships: [
        { ...ship('player', 470, 325, 'collect', 'ore-1'), id: 'ship-1' },
        { ...ship('rival', 620, 325, 'collect', 'ore-1'), id: 'ship-2' },
      ],
    }))

    advanceUntil(game, () => game.scene().ships.some(miner => miner.carrying), 10_000)
    const carriers = game.exportState().ships.filter(miner => miner.cargo > 0)
    expect(carriers).toHaveLength(1)
    expect(carriers[0]?.side).toBe('player')
    expect(game.scene().ores).toHaveLength(0)
    expect(game.scene().money).toBe(config.bank.startingMoney)

    advanceUntil(game, () => game.scene().money === config.bank.startingMoney + config.ore.value, 20_000)
    expect(game.scene().ships).toHaveLength(2)
  })

  it('breaks ore off the asteroid at a small random speed', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 2000, weaponRange: 400, minerRange: 400, shotIntervalMs: 10_000 },
      asteroids: { health: 8, spawnMs: 999_999 },
      ore: { speed: 40 },
    }), fresh({
      asteroids: [{ id: 'asteroid-1', x: 500, y: 325, health: 8, maxHealth: 8, kind: 'normal' }],
      ships: [ship('player', 500, 180, 'shoot', 'asteroid-1')],
    }))

    advanceUntil(game, () => game.scene().ores.length === 1, 5_000)
    const spawned = game.exportState().ores[0]
    expect(spawned).toBeDefined()
    if (!spawned) return
    expect(Math.hypot(spawned.vx, spawned.vy)).toBeCloseTo(40, 5)
    const x0 = spawned.x
    const y0 = spawned.y
    game.advance(1000)
    const later = game.exportState().ores[0]
    expect(later).toBeDefined()
    if (!later) return
    expect(Math.hypot(later.x - x0, later.y - y0)).toBeGreaterThan(30)
  })

  it('hauls ore from a red miner back to the opposing base', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 400, shotSpeed: 700, weaponRange: 120, minerRange: 120, shotIntervalMs: 100 },
      asteroids: { health: 8, spawnMs: 999_999 },
    }), fresh({
      nextShipId: 2,
      nextOreId: 1,
      asteroids: [{ id: 'asteroid-1', x: 520, y: 325, health: 8, maxHealth: 8, kind: 'normal' }],
      ships: [{
        id: 'ship-1',
        x: config.map.rivalBaseX,
        y: config.map.rivalBaseY,
        cargo: 0,
        cargoValue: 0,
        mode: 'engage',
        targetId: 'asteroid-1',
        fireCooldownMs: 0,
        missiles: false,
        missileCooldownMs: 0,
        cannonSide: 0,
        bay: null,
        side: 'rival',
        role: 'miner',
        health: 20,
        maxHealth: 20,
        craft: null,
      }],
    }))
    advanceUntil(game, () => {
      const scene = game.scene()
      const miner = scene.ships[0]
      return scene.asteroids.length === 0 && scene.ores.length === 0 && miner?.carrying === false
    }, 30_000)
    expect(game.scene().money).toBe(config.bank.startingMoney)
    expect(game.scene().ships).toHaveLength(1)
  })

  it('stops a friendly miner short of the range other ships still use', () => {
    const placed = (minerX: number) => GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 90, minerRange: 70, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0 },
    }), fresh({
      asteroids: [{ id: 'asteroid-1', x: 180, y: 325, health: 100, maxHealth: 100, kind: 'normal' }],
      ships: [
        ship('player', minerX, 325, 'shoot', 'asteroid-1'),
        ship('rival', 260, 325, 'shoot', 'asteroid-1'),
      ],
    }))
    const outside = placed(100)
    outside.advance(50)
    const shots = outside.exportState().shots
    expect(shots.filter(shot => shot.side === 'player')).toHaveLength(0)
    expect(shots.filter(shot => shot.side === 'rival')).toHaveLength(1)
    expect(outside.scene().asteroids[0]?.health).toBe(100)

    const inside = placed(110)
    inside.advance(50)
    expect(inside.exportState().shots.filter(shot => shot.side === 'player')).toHaveLength(1)

    const fighter = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 90, minerRange: 70, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0 },
    }), fresh({
      asteroids: [],
      ships: [
        { ...ship('player', 100, 200, 'attack', 'ship-4'), id: 'ship-3', role: 'fighter' },
        { ...ship('rival', 180, 200, 'wait', null), id: 'ship-4' },
      ],
    }))
    fighter.advance(50)
    expect(fighter.exportState().shots.filter(shot => shot.side === 'player')).toHaveLength(1)
  })

  it('charges the listed miner fire rate and damage prices', () => {
    const game = GameImpl.restore(loadGameConfig(), fresh({
      money: 3_000,
      asteroids: [],
      ships: [ship('player', 100, 100, 'wait', null)],
    }))
    const buy = (id: 'fireRate' | 'damage', prices: number[]) => {
      for (const price of prices) {
        const before = game.scene().money
        expect(game.scene().miner.costs[id]).toBe(price)
        expect(game.upgradeMiner(id)).toBe('ok')
        expect(game.scene().money).toBe(before - price)
      }
      expect(game.scene().miner.costs[id]).toBeNull()
    }
    buy('fireRate', [1, 10, 50, 200])
    buy('damage', [1, 2, 5, 10, 30, 80, 200, 500, 1_000])
  })

  it('raises only the player miner damage', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      upgrades: {
        ...config.upgrades,
        damage: linearTable(8, 4, 100, 1),
      },
    }), fresh({
      money: 10,
      asteroids: [{ id: 'asteroid-1', x: 500, y: 325, health: 100, maxHealth: 100, kind: 'normal' }],
      ships: [
        ship('player', 300, 325, 'shoot', 'asteroid-1'),
        ship('rival', 300, 340, 'shoot', 'asteroid-1'),
      ],
    }))
    game.upgradeMiner('damage')
    game.advance(50)
    const shots = game.exportState().shots
    expect(shots.find(shot => shot.side === 'player')?.damage).toBe(12)
    expect(shots.find(shot => shot.side === 'rival')?.damage).toBe(config.enemyUpgrades.damage.levels[0].value)
    expect(game.scene().miner.values.damage).toBe(12)
  })

  it('moves only the player miner faster', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 100, weaponRange: 30, minerRange: 30 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 10,
      asteroids: [{ id: 'asteroid-1', x: 800, y: 325, health: 40, maxHealth: 40, kind: 'normal' }],
      ships: [
        ship('player', 400, 325, 'engage', 'asteroid-1'),
        ship('rival', 400, 340, 'engage', 'asteroid-1'),
      ],
    }))
    expect(game.scene().miner.values.speed).toBe(10)
    game.upgradeMiner('speed')
    expect(game.scene().miner.values.speed).toBe(12)
    game.advance(1000)
    const ships = game.exportState().ships
    expect(ships.find(miner => miner.side === 'player')?.x).toBeCloseTo(520, 0)
    expect(ships.find(miner => miner.side === 'rival')?.x).toBeCloseTo(550, 0)
  })

  it('fires only the player miner faster', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 500, minerRange: 500, shotIntervalMs: 1000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 10,
      asteroids: [{ id: 'asteroid-1', x: 500, y: 325, health: 100, maxHealth: 100, kind: 'normal' }],
      ships: [
        ship('player', 450, 325, 'shoot', 'asteroid-1'),
        ship('rival', 450, 340, 'shoot', 'asteroid-1'),
      ],
    }))
    game.upgradeMiner('fireRate')
    game.advance(50)
    const ships = game.exportState().ships
    expect(ships.find(miner => miner.side === 'player')?.fireCooldownMs).toBe(450)
    expect(ships.find(miner => miner.side === 'rival')?.fireCooldownMs).toBe(3950)
  })

  it('holds a second nugget before flying home', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 400 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      minerLevels: { ...blankLevels(), carry: 1 },
      asteroids: [],
      ores: [
        { id: 'ore-1', x: 500, y: 325, vx: 0, vy: 0, worth: 1, kind: 'normal' },
        { id: 'ore-2', x: 530, y: 325, vx: 0, vy: 0, worth: 1, kind: 'normal' },
      ],
      ships: [ship('player', 500, 325, 'collect', 'ore-1')],
    }))
    advanceUntil(game, () => {
      const miner = game.exportState().ships[0]
      return miner?.cargo === 2 && miner.mode === 'back'
    }, 10_000)
    expect(game.scene().ores).toHaveLength(0)
    advanceUntil(game, () => game.scene().money === 2, 20_000)
  })

  it('launches a bought miner after a minute, one at a time', () => {
    const game = GameImpl.create(tuned({ ships: { speed: 0 }, bank: { startingMoney: 15 } }), 1)
    expect(game.scene().miner.values.count).toBe(1)
    expect(game.upgradeMiner('count')).toBe('ok')
    expect(game.scene().miner.values.count).toBe(2)
    expect(game.upgradeMiner('count')).toBe('ok')
    expect(game.scene().miner.values.count).toBe(3)
    const players = () => game.exportState().ships.filter(miner => miner.side === 'player')
    expect(players()).toHaveLength(1)
    expect(game.scene().miner.costs.count).toBe(20)
    expect(game.scene().nextMiner?.progress).toBe(0)
    expect(game.scene().money).toBe(0)
    game.advance(30_000)
    expect(game.scene().nextMiner?.progress).toBeCloseTo(0.5, 5)
    expect(players()).toHaveLength(1)
    game.advance(30_000)
    expect(players()).toHaveLength(2)
    expect(game.scene().miner.values.count).toBe(3)
    expect(game.scene().nextMiner?.progress).toBe(0)
    expect(game.exportState().ships.filter(miner => miner.side === 'rival')).toHaveLength(1)
    game.advance(60_000)
    expect(players()).toHaveLength(3)
    expect(game.scene().nextMiner?.progress).toBe(0)
    expect(game.exportState().minerReady).toBe(0)
    expect(game.exportState().ships.filter(miner => miner.side === 'rival')).toHaveLength(1)
  })

  it('builds another miner when one is destroyed and the count is not full', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 0,
      tractorBeam: true,
      asteroids: [],
      ships: [
        { ...ship('player', 400, 300, 'wait', null), health: 1, maxHealth: 1 },
        ship('rival', 450, 300, 'attack', 'ship-1'),
      ],
    }))
    expect(game.scene().miner.values.count).toBe(1)
    game.advance(50)
    const miners = () => game.exportState().ships.filter(miner => miner.side === 'player' && miner.role === 'miner')
    expect(miners()).toHaveLength(0)
    expect(game.exportState().pendingMiners).toBe(1)
    expect(game.scene().miner.values.count).toBe(1)
    expect(game.scene().nextMiner?.progress).toBeCloseTo(50 / (config.ships.units * 1000), 5)
  })

  it('fills each build bar from its own production rate', () => {
    const placed = () => GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 1,
      pendingMiners: 1,
      fighterLevels: { ...blankFighterLevels(), count: 1 },
      bays: [{ design: 'fighter', pending: 1, work: 0, production: 0, capacity: 0 }],
      asteroids: [],
      ships: [],
    }))
    const slow = placed()
    slow.advance(12_500)
    expect(slow.scene().nextMiner?.progress).toBeCloseTo(12_500 / 60_000, 5)
    expect(slow.scene().nextFighter?.progress).toBeCloseTo(0.5 * config.designer.bayProduction.scale, 5)
    expect(slow.exportState().ships).toHaveLength(0)

    const miners = placed()
    expect(miners.upgradeMiner('production')).toBe('ok')
    expect(miners.scene().miner.values.production).toBe(2)
    miners.advance(15_000)
    expect(miners.scene().nextMiner?.progress).toBeCloseTo(0.5, 5)
    expect(miners.scene().nextFighter?.progress).toBeCloseTo(0.6 * config.designer.bayProduction.scale, 5)

    const fighters = placed()
    expect(fighters.upgradeFighterStat('production')).toBe('ok')
    expect(fighters.scene().money).toBe(0)
    expect(fighters.scene().fighter.values.production).toBeCloseTo((60 / 25) * (10 / 7), 5)
    expect(fighters.scene().fighter.costs.production).toBe(2)
    fighters.advance(15_000)
    expect(fighters.scene().nextFighter?.progress).toBeCloseTo((6 / 7) * config.designer.bayProduction.scale, 5)
    expect(fighters.scene().nextMiner?.progress).toBeCloseTo(0.25, 5)
    fighters.advance(27_000)
    expect(fighters.exportState().bays[0].pending).toBe(0)
    expect(fighters.exportState().pendingMiners).toBe(1)
    expect(fighters.upgradeFighterStat('production')).toBe('broke')

    const heavy = GameImpl.restore(tuned({
      ships: { speed: 0 },
      fighter: { units: 1000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      fighterLevels: { ...blankFighterLevels(), count: 1 },
      bays: [{ design: 'fighter', pending: 1, work: 0, production: 0, capacity: 0 }],
      asteroids: [],
      ships: [],
    }))
    expect(heavy.scene().fighter.values.production).toBeCloseTo(40, 5)
    heavy.advance(12_500)
    expect(heavy.scene().nextFighter?.progress).toBeCloseTo(0.5 * config.designer.bayProduction.scale, 5)
    expect(heavy.exportState().bays[0].pending).toBe(1)
  })

  it('allows two more fighter production purchases', () => {
    const game = GameImpl.create(tuned({ bank: { startingMoney: 1_000_000 } }), 1)
    const levels = config.fighterUpgrades.production.levels.length - 1
    let bought = 0
    while (game.upgradeFighterStat('production') === 'ok') bought += 1
    expect(bought).toBe(levels)
    expect(game.upgradeFighterStat('production')).toBe('maxed')
  })

  it('builds each bay at 60% of the fighter rate, and two money purchases raise that bay by half', () => {
    const spec = config.designer.bayProduction
    const base = (config.fighter.units / 25) * spec.scale
    const game = GameImpl.restore(tuned({ ships: { speed: 0 } }), fresh({
      money: 10_000,
      crystals: 20,
      shipDesigner: true,
      fighterLevels: { ...blankFighterLevels(), count: 2 },
      asteroids: [],
      ships: [],
    }))
    expect(game.upgradeBay(0)).toBe('ok')
    const first = spec.levels[0].cost ?? 0
    const second = spec.levels[1].cost ?? 0
    expect(game.scene().money).toBe(10_000 - first)
    expect(game.scene().fleet.rate).toBeCloseTo(base * spec.bonus, 5)
    expect(game.scene().fleet.production).toBe(1)
    expect(game.scene().fleet.productionCost).toBe(second)
    expect(game.unlockBay()).toBe('ok')
    expect(game.scene().fleet.bays[0]).toMatchObject({ owned: true, production: 0, productionCost: first })
    expect(game.scene().fleet.bays[0].rate).toBeCloseTo(base, 5)
    expect(game.upgradeBay(1)).toBe('ok')
    expect(game.upgradeBay(1)).toBe('ok')
    expect(game.upgradeBay(1)).toBe('maxed')
    expect(game.scene().fleet.bays[0].rate).toBeCloseTo(base * spec.bonus ** 2, 5)
    expect(game.scene().fleet.bays[0].productionCost).toBeNull()
    expect(game.scene().fleet.rate).toBeCloseTo(base * spec.bonus, 5)
    expect(game.upgradeBay(2)).toBe('unknown')
    expect(game.scene().money).toBe(10_000 - first - first - second)

    const paced = GameImpl.restore(tuned({ ships: { speed: 0 } }), fresh({
      money: 0,
      shipDesigner: true,
      bays: [
        { design: 'fighter', pending: 1, work: 0, production: 0, capacity: 0 },
        { design: 'fighter', pending: 1, work: 0, production: 1, capacity: 0 },
      ],
      asteroids: [],
      ships: [],
    }))
    expect(paced.upgradeBay(0)).toBe('broke')
    paced.advance(1_000)
    const bays = paced.exportState().bays
    expect(bays[1].work).toBeCloseTo(bays[0].work * spec.bonus, 5)
  })

  it('doubles the rival fleet once the third ship launches, and golden multiplies that', () => {
    const rivals = (game: GameImpl) => game.exportState().ships.filter(miner => miner.side === 'rival')
    const players = (game: GameImpl) => game.exportState().ships.filter(miner => miner.side === 'player')

    const fourth = GameImpl.create(tuned({ ships: { speed: 0 }, bank: { startingMoney: 35 } }), 1)
    expect(fourth.upgradeMiner('count')).toBe('ok')
    expect(fourth.upgradeMiner('count')).toBe('ok')
    expect(fourth.upgradeMiner('count')).toBe('ok')
    fourth.advance(120_000)
    expect(players(fourth)).toHaveLength(3)
    expect(rivals(fourth)).toHaveLength(1)
    fourth.advance(60_000)
    expect(players(fourth)).toHaveLength(4)
    expect(rivals(fourth)).toHaveLength(2)

    const goldenFirst = GameImpl.create(tuned({ ships: { speed: 0 }, bank: { startingMoney: 65 } }), 1)
    expect(goldenFirst.upgradeMining('golden')).toBe('ok')
    expect(rivals(goldenFirst)).toHaveLength(1)
    expect(goldenFirst.upgradeMiner('count')).toBe('ok')
    expect(goldenFirst.upgradeMiner('count')).toBe('ok')
    goldenFirst.advance(120_000)
    expect(players(goldenFirst)).toHaveLength(3)
    expect(rivals(goldenFirst)).toHaveLength(3)

    const shipsFirst = GameImpl.create(tuned({ ships: { speed: 0 }, bank: { startingMoney: 65 } }), 1)
    expect(shipsFirst.upgradeMiner('count')).toBe('ok')
    expect(shipsFirst.upgradeMiner('count')).toBe('ok')
    shipsFirst.advance(120_000)
    expect(rivals(shipsFirst)).toHaveLength(1)
    expect(shipsFirst.upgradeMining('golden')).toBe('ok')
    expect(rivals(shipsFirst)).toHaveLength(1)
  })

  it('makes rival ships half again as fast once the player speed reaches 8', () => {
    const flown = (speedLevel: number) => {
      const game = GameImpl.restore(tuned({
        ships: { speed: 100, weaponRange: 30, minerRange: 30 },
        asteroids: { spawnMs: 999_999 },
        upgrades: {
          ...config.upgrades,
          speed: linearTable(1, 1, 10, 1),
        },
      }), fresh({
        minerLevels: { ...blankLevels(), speed: speedLevel },
        asteroids: [{ id: 'asteroid-1', x: 900, y: 325, health: 40, maxHealth: 40, kind: 'normal' }],
        ships: [
          ship('player', 400, 325, 'engage', 'asteroid-1'),
          ship('rival', 400, 340, 'engage', 'asteroid-1'),
        ],
      }))
      const before = game.exportState().ships.find(miner => miner.side === 'rival')?.x ?? 0
      game.advance(1000)
      const after = game.exportState().ships.find(miner => miner.side === 'rival')?.x ?? 0
      return after - before
    }
    expect(flown(6)).toBeCloseTo(100, 0)
    expect(flown(7)).toBeCloseTo(150, 0)
  })

  it('refuses another miner when the cost is not paid', () => {
    const game = GameImpl.create(tuned({ ships: { speed: 0 }, bank: { startingMoney: 4 } }), 1)
    expect(game.upgradeMiner('count')).toBe('broke')
    expect(game.exportState().ships.filter(miner => miner.side === 'player')).toHaveLength(1)
    expect(game.scene().money).toBe(4)
  })

  it('doubles the price and stops at the max', () => {
    const game = GameImpl.create(tuned({
      bank: { startingMoney: 100 },
      upgrades: {
        ...config.upgrades,
        damage: linearTable(1, 1, 3, 1),
      },
    }), 1)
    expect(game.scene().miner.values.damage).toBe(1)
    expect(game.scene().miner.costs.damage).toBe(1)
    expect(game.upgradeMiner('damage')).toBe('ok')
    expect(game.scene().miner.values.damage).toBe(2)
    expect(game.scene().miner.costs.damage).toBe(2)
    expect(game.scene().money).toBe(99)
    expect(game.upgradeMiner('damage')).toBe('ok')
    expect(game.scene().miner.values.damage).toBe(3)
    expect(game.scene().miner.costs.damage).toBeNull()
    expect(game.upgradeMiner('damage')).toBe('maxed')
    expect(game.scene().money).toBe(97)
  })

  it('puts a miner back on a real job within a second', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [{ id: 'asteroid-1', x: 500, y: 325, health: 40, maxHealth: 40, kind: 'normal' }],
      ships: [ship('player', 200, 325, 'collect', 'ore-gone')],
    }))
    game.advance(1000)
    const miner = game.exportState().ships[0]
    expect(miner?.targetId).toBe('asteroid-1')
    expect(miner?.mode === 'engage' || miner?.mode === 'shoot').toBe(true)
  })

  it('pushes ships out of a shared grid cell', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [],
      ships: [
        { ...ship('player', 400, 300, 'wait', null), id: 'ship-1' },
        { ...ship('player', 402, 300, 'wait', null), id: 'ship-2' },
      ],
    }))
    game.advance(50)
    const ships = game.exportState().ships
    const gap = Math.hypot(ships[0].x - ships[1].x, ships[0].y - ships[1].y)
    expect(gap).toBeGreaterThanOrEqual(16)
  })

  it('collects loot that shares a grid cell with a ship', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
      ore: { speed: 0 },
    }), fresh({
      asteroids: [],
      ores: [{ id: 'ore-1', x: 405, y: 303, vx: 0, vy: 0, worth: 7, kind: 'normal' }],
      ships: [
        { ...ship('player', 400, 300, 'back', null), cargo: 1, cargoValue: 1 },
        { ...ship('rival', 401, 301, 'wait', null) },
      ],
    }))
    game.advance(50)
    const ships = game.exportState().ships
    expect(game.scene().ores).toHaveLength(0)
    expect(ships.find(miner => miner.id === 'ship-1')?.cargo).toBe(1)
    expect(ships.find(miner => miner.id === 'ship-2')?.cargoValue).toBe(7)
  })

  it('gives one shared-cell nugget to a single seeded ship', () => {
    const placed = () => GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
      ore: { speed: 0 },
    }), fresh({
      asteroids: [],
      ores: [{ id: 'ore-1', x: 405, y: 303, vx: 0, vy: 0, worth: 4, kind: 'normal' }],
      ships: [
        ship('player', 400, 300, 'wait', null),
        ship('rival', 402, 300, 'wait', null),
      ],
    }))
    const game = placed()
    game.advance(50)
    const carriers = game.exportState().ships.filter(miner => miner.cargo > 0)
    expect(game.scene().ores).toHaveLength(0)
    expect(carriers).toHaveLength(1)
    expect(carriers[0]?.cargoValue).toBe(4)
    const again = placed()
    again.advance(50)
    expect(again.exportState().ships.find(miner => miner.cargo > 0)?.id).toBe(carriers[0]?.id)
  })

  it('leaves loot in a cell when every ship there is already full', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
      ore: { speed: 0 },
    }), fresh({
      asteroids: [],
      ores: [{ id: 'ore-1', x: 405, y: 303, vx: 0, vy: 0, worth: 1, kind: 'normal' }],
      ships: [{ ...ship('player', 400, 300, 'back', null), cargo: 1, cargoValue: 1 }],
    }))
    game.advance(50)
    expect(game.scene().ores).toHaveLength(1)
    expect(game.exportState().ships[0]?.cargo).toBe(1)
  })

  it('leaves loot alone when no ship shares its grid cell', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
      ore: { speed: 0 },
    }), fresh({
      asteroids: [],
      ores: [{ id: 'ore-1', x: 420, y: 300, vx: 0, vy: 0, worth: 1, kind: 'normal' }],
      ships: [ship('player', 400, 300, 'wait', null)],
    }))
    game.advance(50)
    expect(game.scene().ores).toHaveLength(1)
    expect(game.exportState().ships[0]?.cargo).toBe(0)
  })

  it('stays put when there is nothing to mine', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 400 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [],
      ships: [ship('player', 400, 200, 'wait', null)],
    }))
    game.advance(2000)
    const miner = game.exportState().ships[0]
    expect(miner?.mode).toBe('wait')
    expect(miner?.x).toBe(400)
    expect(miner?.y).toBe(200)
  })

  it('doubles asteroid health each time loot size is bought', () => {
    const game = GameImpl.create(tuned({
      ships: { speed: 0 },
      bank: { startingMoney: 3 },
      asteroids: { health: 5, max: 1, spawnMs: 999_999 },
    }), 1)
    const rock = () => game.exportState().asteroids[0]
    expect(rock()?.health).toBe(5)
    expect(rock()?.maxHealth).toBe(5)
    expect(game.upgradeMining('size')).toBe('ok')
    expect(rock()?.health).toBe(10)
    expect(rock()?.maxHealth).toBe(10)
    expect(game.upgradeMining('size')).toBe('ok')
    expect(rock()?.health).toBe(20)
    expect(rock()?.maxHealth).toBe(20)
  })

  it('drops one more nugget and grows the rock when asteroid size is bought', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 2000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 5,
      asteroids: [{ id: 'asteroid-1', x: 500, y: 325, health: 8, maxHealth: 8, kind: 'normal' }],
      ships: [ship('player', 300, 325, 'shoot', 'asteroid-1')],
    }))
    expect(game.scene().asteroidSize).toBe(18)
    expect(game.upgradeMining('size')).toBe('ok')
    expect(game.scene().mining.values.size).toBe(2)
    expect(game.scene().asteroidSize).toBe(20)
    expect(game.exportState().asteroids[0]?.health).toBe(16)
    expect(game.exportState().asteroids[0]?.maxHealth).toBe(16)
    advanceUntil(game, () => game.scene().ores.length === 2, 15_000)
  })

  it('banks broken rocks immediately and stops the collect flight', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 2000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      ore: { value: 3 },
    }), fresh({
      money: 500,
      asteroids: [{ id: 'asteroid-1', x: 500, y: 325, health: 8, maxHealth: 8, kind: 'normal' }],
      ores: [{ id: 'ore-1', x: 400, y: 325, vx: 0, vy: 0, worth: 3, kind: 'normal' }],
      ships: [ship('player', 300, 325, 'collect', 'ore-1')],
    }))
    expect(game.upgradeMining('tractorBeam')).toBe('ok')
    expect(game.exportState().money).toBe(3)
    expect(game.exportState().ores).toEqual([])
    expect(game.exportState().tractorBeam).toBe(true)
    expect(game.exportState().ships[0]?.mode).not.toBe('collect')
    expect(game.upgradeMining('tractorBeam')).toBe('maxed')
    advanceUntil(game, () => game.scene().asteroids.length === 0, 5_000)
    expect(game.scene().ores).toEqual([])
    expect(game.scene().money).toBe(6)
    expect(game.exportState().ships.every(miner => miner.mode !== 'collect')).toBe(true)
  })

  it('refuses the tractor beam when the money is short', () => {
    const game = GameImpl.restore(tuned({ asteroids: { spawnMs: 999_999 } }), fresh({
      money: 499,
      asteroids: [],
      ships: [ship('player', 300, 325, 'wait', null)],
    }))
    expect(game.upgradeMining('tractorBeam')).toBe('broke')
    expect(game.exportState().tractorBeam).toBe(false)
    expect(game.exportState().money).toBe(499)
  })

  it('starts every ship at the configured health', () => {
    const game = GameImpl.create(tuned({ asteroids: { max: 0 } }), 1)
    const ships = game.exportState().ships
    expect(ships).toHaveLength(2)
    expect(ships.every(miner => miner.health === 20 && miner.maxHealth === 20 && miner.role === 'miner')).toBe(true)
  })

  it('sends rival miners after our ships once the tractor beam is on', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 200, shotIntervalMs: 10_000, weaponRange: 30, minerRange: 30 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 500,
      asteroids: [],
      ships: [
        ship('player', 200, 300, 'wait', null),
        ship('rival', 700, 300, 'wait', null),
      ],
    }))
    expect(game.upgradeMining('tractorBeam')).toBe('ok')
    const rival = game.exportState().ships.find(miner => miner.id === 'ship-2')
    expect(rival?.mode).toBe('hunt')
    expect(rival?.targetId).toBe('ship-1')
    const before = rival?.x ?? 0
    game.advance(1000)
    const after = game.exportState().ships.find(miner => miner.id === 'ship-2')
    expect(after?.x).toBeLessThan(before)
    expect(game.exportState().ships.find(miner => miner.id === 'ship-1')?.health).toBe(20)
  })

  it('lets a rival in range shoot our ship', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 500,
      asteroids: [],
      ships: [
        ship('player', 400, 300, 'wait', null),
        ship('rival', 450, 300, 'wait', null),
      ],
    }))
    expect(game.upgradeMining('tractorBeam')).toBe('ok')
    expect(game.exportState().ships.find(miner => miner.id === 'ship-2')?.mode).toBe('attack')
    game.advance(50)
    expect(game.exportState().ships.find(miner => miner.id === 'ship-1')?.health).toBe(4)
  })

  it('doubles rival shot damage from its base when the shot is aimed at a ship', () => {
    const damage = (atShip: boolean, golden: boolean, bought: boolean) => {
      const game = GameImpl.restore(tuned({
        ships: { speed: 0, shotSpeed: 0, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
        asteroids: { spawnMs: 999_999 },
        enemyUpgrades: {
          ...config.enemyUpgrades,
          damage: linearTable(1, 1, 10, 1, 1.3),
        },
      }), fresh({
        money: 1_000,
        asteroids: atShip ? [] : [{ id: 'asteroid-1', x: 500, y: 325, health: 100, maxHealth: 100, kind: 'normal' }],
        ships: atShip
          ? [ship('player', 450, 325, 'wait', null), ship('rival', 450, 340, 'wait', null)]
          : [ship('player', 450, 325, 'shoot', 'asteroid-1'), ship('rival', 450, 340, 'shoot', 'asteroid-1')],
      }))
      if (golden) expect(game.upgradeMining('golden')).toBe('ok')
      if (bought) expect(game.upgradeEnemy('damage')).toBe('ok')
      if (atShip) expect(game.upgradeMining('tractorBeam')).toBe('ok')
      game.advance(50)
      return game.exportState().shots.find(shot => shot.side === 'rival')?.damage
    }
    expect(damage(false, false, false)).toBe(1)
    expect(damage(true, false, false)).toBe(2)
    expect(damage(true, false, true)).toBe(4)
    expect(damage(false, true, false)).toBe(2)
    expect(damage(true, true, false)).toBe(4)
    expect(damage(true, true, true)).toBe(8)
  })

  it('wakes a base inside the short range and then shoots every enemy out to cannon range', () => {
    const parked = (ships: MapState['ships'], cannon?: Partial<typeof config.cannon>, combat?: Partial<Pick<MapState, 'baseCombat' | 'rivalCombat'>>) => GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0 },
      asteroids: { spawnMs: 999_999 },
      cannon,
    }), fresh({ asteroids: [], ships, ...combat }))
    const inRange = parked([
      ship('player', config.map.baseX, config.map.baseY, 'wait', null),
      ship('rival', config.map.baseX + config.cannon.wake - 10, config.map.baseY, 'wait', null),
    ], { shotSpeed: 0 })
    inRange.advance(50)
    const first = inRange.exportState().shots
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({ side: 'player', damage: config.cannon.damage, shipId: 'ship-2', cannon: true })
    expect(inRange.exportState().baseCombat).toBe(true)
    inRange.advance(50)
    expect(inRange.exportState().shots).toHaveLength(1)
    inRange.advance(50)
    expect(inRange.exportState().shots).toHaveLength(2)

    const outer = parked([
      ship('player', config.map.baseX, config.map.baseY, 'wait', null),
      ship('rival', config.map.baseX + config.cannon.wake + 20, config.map.baseY, 'wait', null),
    ])
    outer.advance(1000)
    expect(outer.exportState().shots).toHaveLength(0)
    expect(outer.exportState().baseCombat).toBe(false)

    const holding = parked([
      ship('player', config.map.baseX, config.map.baseY, 'wait', null),
      ship('rival', config.map.baseX + config.cannon.range - 10, config.map.baseY, 'wait', null),
    ], { shotSpeed: 0, damage: 1 }, { baseCombat: true })
    holding.advance(50)
    expect(holding.exportState().shots).toHaveLength(1)
    expect(holding.exportState().baseCombat).toBe(true)
    const saved = holding.exportState()
    expect(GameImpl.restore(tuned({ ships: { speed: 0 }, asteroids: { spawnMs: 999_999 }, cannon: { shotSpeed: 0, damage: 1 } }), saved).exportState().baseCombat).toBe(true)

    const volley = parked([
      ship('player', config.map.baseX, config.map.baseY, 'wait', null),
      ship('rival', config.map.baseX + config.cannon.wake - 10, config.map.baseY, 'wait', null),
      { ...ship('rival', config.map.baseX + config.cannon.range - 10, config.map.baseY, 'wait', null), id: 'ship-3' },
    ], { shotSpeed: 0, damage: 1 })
    volley.advance(50)
    expect(volley.exportState().shots.map(shot => shot.shipId).sort()).toEqual(['ship-2', 'ship-3'])
    expect(volley.scene().lasers).toHaveLength(2)
    expect(volley.exportState().baseCombat).toBe(true)

    const asleep = parked([
      ship('player', config.map.baseX, config.map.baseY, 'wait', null),
    ], undefined, { baseCombat: true })
    asleep.advance(50)
    expect(asleep.exportState().shots).toHaveLength(0)
    expect(asleep.exportState().baseCombat).toBe(false)

    const far = parked([
      ship('rival', config.map.baseX + config.cannon.range + 1, config.map.baseY, 'wait', null),
    ])
    far.advance(1000)
    expect(far.exportState().shots).toHaveLength(0)

    const rivalGun = parked([
      ship('player', config.map.rivalBaseX - 40, config.map.rivalBaseY, 'wait', null),
      ship('rival', config.map.rivalBaseX, config.map.rivalBaseY, 'wait', null),
    ], { shotSpeed: 0 })
    rivalGun.advance(50)
    expect(rivalGun.exportState().shots).toHaveLength(1)
    expect(rivalGun.exportState().shots[0]).toMatchObject({ side: 'rival', damage: config.cannon.damage, shipId: 'ship-1' })

    const killed = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 280 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [],
      ships: [
        ship('player', config.map.baseX, config.map.baseY, 'wait', null),
        ship('rival', config.map.baseX + 20, config.map.baseY, 'wait', null),
      ],
    }))
    killed.advance(100)
    expect(killed.exportState().ships.map(miner => miner.side)).toEqual(['player'])
    expect(killed.scene().money).toBe(0)

    const zapped = parked([
      ship('player', config.map.baseX, config.map.baseY, 'wait', null),
      ship('rival', config.map.baseX + config.cannon.wake - 10, config.map.baseY, 'wait', null),
    ])
    zapped.advance(50)
    expect(zapped.exportState().ships.map(miner => miner.side)).toEqual(['player'])
    expect(zapped.scene().money).toBe(0)
    expect(zapped.scene().lasers[0]).toMatchObject({
      x0: config.map.baseX,
      y0: config.map.baseY,
      x1: config.map.baseX + config.cannon.wake - 10,
      y1: config.map.baseY,
      side: 'player',
      source: 'cannon',
    })
  })

  it('sends a fighter to shoot the enemy base when no rivals are left', () => {
    const alone = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 80, minerRange: 80, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 1 },
    }), fresh({
      tractorBeam: true,
      asteroids: [],
      ships: [
        { ...ship('player', config.map.rivalBaseX - 60, config.map.rivalBaseY, 'wait', null), role: 'fighter' },
        ship('rival', config.map.rivalBaseX, config.map.rivalBaseY, 'wait', null),
      ],
    }))
    alone.advance(100)
    const busy = alone.exportState().ships.find(miner => miner.role === 'fighter')
    expect(busy?.targetId).toBe('ship-2')
    expect(alone.exportState().shots.every(shot => shot.asteroidId !== 'base')).toBe(true)

    const shelling = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 80, minerRange: 80, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 1 },
    }), fresh({
      tractorBeam: true,
      asteroids: [],
      ships: [
        { ...ship('player', config.map.rivalBaseX - 60, config.map.rivalBaseY, 'wait', null), role: 'fighter' },
      ],
    }))
    shelling.advance(100)
    const fighter = shelling.exportState().ships.find(miner => miner.role === 'fighter')
    expect(fighter?.mode).toBe('attack')
    expect(fighter?.targetId).toBe('base')
    const shot = shelling.exportState().shots[0]
    expect(shot).toMatchObject({
      side: 'player',
      asteroidId: 'base',
      shipId: null,
      targetX: config.map.rivalBaseX,
      targetY: config.map.rivalBaseY,
      damage: config.fighterUpgrades.damage.levels[0].value,
    })
    expect(shelling.scene().money).toBe(0)
    expect(shelling.exportState().ships).toHaveLength(1)

    const rival = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 80, minerRange: 80, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 1 },
    }), fresh({
      tractorBeam: true,
      asteroids: [],
      ships: [ship('rival', config.map.baseX + 60, config.map.baseY, 'wait', null)],
    }))
    rival.advance(100)
    const red = rival.exportState().ships[0]
    expect(red?.mode).toBe('attack')
    expect(red?.targetId).toBe('base')
    expect(rival.exportState().shots[0]).toMatchObject({
      side: 'rival',
      asteroidId: 'base',
      shipId: null,
      targetX: config.map.baseX,
      targetY: config.map.baseY,
    })
    expect(rival.scene().money).toBe(0)
  })

  it('removes our ship when its health is gone and pays nothing', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      fighter: { bounty: 100 },
    }), fresh({
      money: 500,
      asteroids: [],
      ships: [
        { ...ship('player', 400, 300, 'wait', null), health: 8, maxHealth: 8 },
        ship('rival', 450, 300, 'wait', null),
      ],
    }))
    expect(game.upgradeMining('tractorBeam')).toBe('ok')
    game.advance(50)
    expect(game.exportState().ships.filter(miner => miner.side === 'player')).toHaveLength(0)
    expect(game.scene().money).toBe(0)
  })

  it('queues one free fighter and pays the bounty when it destroys a rival', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      fighter: { cost: 0, units: 1, bounty: 100 },
    }), fresh({
      money: 1,
      tractorBeam: true,
      asteroids: [],
      ships: [
        ship('player', 200, 300, 'wait', null),
        { ...ship('rival', 450, 325, 'wait', null), health: 1, maxHealth: 1 },
      ],
    }))
    expect(game.scene().fighter.values.count).toBe(0)
    expect(game.upgradeFighterStat('count')).toBe('ok')
    expect(game.exportState().money).toBe(1)
    expect(game.exportState().bays[0].pending).toBe(1)
    expect(game.scene().nextFighter?.progress).toBe(0)
    expect(game.scene().fighter.values.count).toBe(1)
    const build = 25_000 / config.designer.bayProduction.scale
    game.advance(build * 0.95)
    expect(game.exportState().ships.filter(miner => miner.role === 'fighter')).toHaveLength(0)
    expect(game.scene().nextFighter?.progress).toBeCloseTo(0.95)
    expect(game.scene().nextFighter?.cells).toEqual(ShipDesign.minerHull(config))
    game.advance(build * 0.05)
    const fighter = game.exportState().ships.find(miner => miner.role === 'fighter')
    expect(fighter?.side).toBe('player')
    expect(game.scene().ships.find(miner => miner.role === 'fighter')?.hull).toEqual(ShipDesign.minerHull(config))
    expect(fighter?.health).toBe(20)
    expect(fighter?.targetId).toBe('ship-2')
    expect(game.scene().nextFighter?.progress).toBeCloseTo(0, 5)
    expect(game.exportState().ships.filter(miner => miner.role === 'fighter')).toHaveLength(1)
    expect(game.scene().miner.values.count).toBe(1)
    game.advance(100)
    expect(game.exportState().ships.filter(miner => miner.side === 'rival')).toHaveLength(0)
    expect(game.scene().money).toBe(101)
  })

  it('replaces destroyed rival miners at their base once a minute, up to the fleet cap', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      rival: { replenishMs: 1000 },
    }), fresh({
      tractorBeam: true,
      rivalCap: 2,
      fleetAnswered: true,
      nextShipId: 4,
      asteroids: [],
      ships: [
        { ...ship('player', 400, 300, 'attack', 'ship-2'), role: 'fighter' },
        { ...ship('rival', 420, 300, 'wait', null), health: 1, maxHealth: 1 },
        { ...ship('rival', 440, 300, 'wait', null), id: 'ship-3', health: 1, maxHealth: 1 },
      ],
    }))
    game.advance(50)
    const rivals = () => game.exportState().ships.filter(miner => miner.side === 'rival')
    expect(rivals()).toHaveLength(1)
    game.advance(900)
    expect(rivals()).toHaveLength(1)
    game.advance(50)
    expect(rivals()).toHaveLength(2)
    const born = rivals().find(miner => miner.id !== 'ship-3')
    expect(born?.x).toBe(config.map.rivalBaseX)
    expect(born?.y).toBe(config.map.rivalBaseY)
    game.advance(5000)
    expect(rivals()).toHaveLength(2)
  })

  it('upgrades only the fighter speed, attack rate, health, and damage', () => {
    const flying = GameImpl.restore(tuned({
      ships: { speed: 100, weaponRange: 30, minerRange: 30 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 10,
      tractorBeam: true,
      asteroids: [],
      ships: [
        { ...ship('player', 100, 325, 'hunt', 'ship-2'), role: 'fighter', health: 12, maxHealth: 20 },
        { ...ship('player', 100, 400, 'wait', null), id: 'ship-3' },
        ship('rival', 800, 325, 'wait', null),
      ],
    }))
    expect(flying.upgradeFighterStat('health')).toBe('ok')
    const fighter = () => flying.exportState().ships.find(miner => miner.role === 'fighter')
    expect(fighter()?.health).toBe(22)
    expect(fighter()?.maxHealth).toBe(30)
    expect(flying.exportState().ships.find(miner => miner.id === 'ship-3')?.health).toBe(20)
    expect(flying.scene().fighter.values.health).toBe(30)
    expect(flying.scene().fighter.costs.health).toBe(2)
    expect(flying.upgradeFighterStat('speed')).toBe('ok')
    flying.advance(1000)
    expect(fighter()?.x).toBeCloseTo(220, 0)
    expect(flying.exportState().ships.find(miner => miner.id === 'ship-3')?.x).toBe(100)

    const shooting = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 40, minerRange: 40, shotIntervalMs: 1000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 10,
      tractorBeam: true,
      asteroids: [],
      ships: [
        { ...ship('player', 100, 325, 'attack', 'ship-2'), role: 'fighter' },
        ship('rival', 130, 325, 'wait', null),
      ],
    }))
    expect(shooting.upgradeFighterStat('damage')).toBe('ok')
    expect(shooting.upgradeFighterStat('attackRate')).toBe('ok')
    shooting.advance(50)
    expect(shooting.exportState().shots.find(shot => shot.shipId === 'ship-2')?.damage).toBe(2)
    expect(shooting.exportState().ships.find(miner => miner.role === 'fighter')?.fireCooldownMs).toBe(450)

    const launching = GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
      fighter: { units: 1 },
    }), fresh({
      money: 5,
      tractorBeam: true,
      asteroids: [],
      ships: [],
    }))
    expect(launching.upgradeFighterStat('health')).toBe('ok')
    expect(launching.upgradeFighterStat('count')).toBe('ok')
    launching.advance(60_000)
    expect(launching.exportState().ships.find(miner => miner.role === 'fighter')?.health).toBe(30)

    const broke = GameImpl.restore(tuned({ asteroids: { spawnMs: 999_999 } }), fresh({
      money: 0,
      tractorBeam: true,
      asteroids: [],
      ships: [ship('player', 100, 325, 'wait', null)],
    }))
    expect(broke.upgradeFighterStat('damage')).toBe('broke')
    expect(broke.scene().fighter.values.damage).toBe(1)
  })

  it('raises how many fighters we are allowed to build, and reopens a slot when one dies', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0 },
      asteroids: { spawnMs: 999_999 },
      fighter: { cost: 0, units: 1 },
    }), fresh({
      money: 1,
      tractorBeam: true,
      asteroids: [],
      ships: [],
    }))
    expect(game.scene().fighter.values.count).toBe(0)
    expect(game.scene().fighter.costs.count).toBe(0)
    expect(game.upgradeFighterStat('count')).toBe('ok')
    expect(game.scene().money).toBe(1)
    expect(game.scene().fighter.values.count).toBe(1)
    expect(game.scene().fighter.costs.count).toBe(1)
    expect(game.exportState().bays[0].pending).toBe(1)
    expect(game.upgradeFighterStat('count')).toBe('ok')
    expect(game.scene().money).toBe(0)
    expect(game.scene().fighter.values.count).toBe(2)
    expect(game.scene().fighter.costs.count).toBe(2)
    expect(game.exportState().bays[0].pending).toBe(2)
    const build = 25_000 / config.designer.bayProduction.scale
    game.advance(build)
    expect(game.exportState().ships.filter(miner => miner.role === 'fighter')).toHaveLength(1)
    expect(game.exportState().bays[0].pending).toBe(1)
    game.advance(build)
    expect(game.exportState().ships.filter(miner => miner.role === 'fighter')).toHaveLength(2)
    expect(game.upgradeFighterStat('count')).toBe('broke')

    const replaced = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 0,
      tractorBeam: true,
      fighterLevels: { ...blankFighterLevels(), count: 1 },
      asteroids: [],
      ships: [
        { ...ship('player', 400, 300, 'attack', 'ship-2'), role: 'fighter', health: 1, maxHealth: 1 },
        { ...ship('rival', 420, 300, 'attack', 'ship-1'), health: 1, maxHealth: 1 },
      ],
    }))
    replaced.advance(50)
    expect(replaced.exportState().ships.filter(miner => miner.role === 'fighter')).toHaveLength(0)
    expect(replaced.exportState().bays[0].pending).toBe(1)
  })

  it('adds three fighters on each crystal count level after the money levels', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 15,
      crystals: 0,
      tractorBeam: true,
      asteroids: [],
      ships: [],
    }))
    for (const ships of [1, 2, 3, 4, 5]) {
      expect(game.upgradeFighterStat('count')).toBe('ok')
      expect(game.scene().fighter.values.count).toBe(ships)
    }
    expect(game.scene().money).toBe(0)
    expect(game.scene().fighter.countCrystals).toBe(true)
    expect(game.scene().fighter.costs.count).toBe(1)
    expect(game.exportState().bays[0].pending).toBe(5)
    expect(game.upgradeFighterStat('count')).toBe('broke')
    expect(game.scene().fighter.values.count).toBe(5)
    expect(game.scene().crystals).toBe(0)

    const paying = GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 15,
      crystals: 7,
      tractorBeam: true,
      asteroids: [],
      ships: [],
    }))
    for (let bought = 0; bought < 5; bought += 1) expect(paying.upgradeFighterStat('count')).toBe('ok')
    expect(paying.scene().money).toBe(0)
    expect(paying.scene().crystals).toBe(7)
    expect(paying.upgradeFighterStat('count')).toBe('ok')
    expect(paying.scene().fighter.values.count).toBe(8)
    expect(paying.scene().crystals).toBe(6)
    expect(paying.scene().fighter.costs.count).toBe(2)
    expect(paying.exportState().bays[0].pending).toBe(8)
    expect(paying.upgradeFighterStat('count')).toBe('ok')
    expect(paying.scene().fighter.values.count).toBe(11)
    expect(paying.scene().crystals).toBe(4)
    expect(paying.upgradeFighterStat('count')).toBe('ok')
    expect(paying.scene().fighter.values.count).toBe(14)
    expect(paying.scene().crystals).toBe(0)
    expect(paying.scene().fighter.costs.count).toBeNull()
    expect(paying.scene().fighter.countCrystals).toBe(false)
    expect(paying.upgradeFighterStat('count')).toBe('maxed')
    expect(paying.scene().money).toBe(0)
  })

  it('replaces a destroyed rival sooner after the enemy spawn rate is bought', () => {
    const placed = (money = 1) => GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      rival: { replenishMs: 1000 },
    }), fresh({
      money,
      tractorBeam: true,
      rivalCap: 1,
      asteroids: [],
      ships: [
        { ...ship('player', 400, 300, 'attack', 'ship-2'), role: 'fighter' },
        { ...ship('rival', 420, 300, 'wait', null), health: 1, maxHealth: 1 },
      ],
    }))
    const rivals = (game: GameImpl) => game.exportState().ships.filter(miner => miner.side === 'rival')
    const slow = placed()
    slow.advance(50)
    expect(rivals(slow)).toHaveLength(0)
    slow.advance(900)
    expect(rivals(slow)).toHaveLength(0)
    slow.advance(50)
    expect(rivals(slow)).toHaveLength(1)

    const fast = placed()
    expect(fast.upgradeEnemy('spawnRate')).toBe('ok')
    expect(fast.scene().money).toBe(0)
    expect(fast.scene().enemy.values.spawnRate).toBe(2)
    expect(fast.scene().enemy.costs.spawnRate).toBe(2)
    expect(fast.upgradeEnemy('spawnRate')).toBe('broke')
    fast.advance(50)
    expect(rivals(fast)).toHaveLength(0)
    fast.advance(400)
    expect(rivals(fast)).toHaveLength(0)
    fast.advance(50)
    expect(rivals(fast)).toHaveLength(1)

    const again = placed(3)
    expect(again.upgradeEnemy('spawnRate')).toBe('ok')
    expect(again.upgradeEnemy('spawnRate')).toBe('ok')
    expect(again.scene().enemy.values.spawnRate).toBe(4)
    again.advance(50)
    expect(rivals(again)).toHaveLength(0)
    again.advance(150)
    expect(rivals(again)).toHaveLength(0)
    again.advance(50)
    expect(rivals(again)).toHaveLength(1)
  })

  it('starts the rival cap at 1, then the first capacity buy sets it to 10 and later buys add 5', () => {
    const rivals = (game: GameImpl) => game.exportState().ships.filter(miner => miner.side === 'rival')
    const opened = GameImpl.create(tuned({
      ships: { speed: 0 },
      bank: { startingMoney: 3 },
    }), 1)
    expect(rivals(opened)).toHaveLength(1)
    expect(opened.exportState().rivalCap).toBe(1)
    expect(opened.scene().enemy.values.capacity).toBe(1)
    expect(opened.scene().enemy.costs.capacity).toBe(1)
    expect(opened.upgradeEnemy('capacity')).toBe('ok')
    expect(opened.scene().enemy.values.capacity).toBe(10)
    expect(opened.exportState().rivalCap).toBe(10)
    expect(rivals(opened)).toHaveLength(1)
    expect(opened.scene().enemy.costs.capacity).toBe(2)
    expect(opened.upgradeEnemy('capacity')).toBe('ok')
    expect(opened.scene().money).toBe(0)
    expect(opened.scene().enemy.values.capacity).toBe(15)
    expect(opened.exportState().rivalCap).toBe(15)
    expect(rivals(opened)).toHaveLength(1)
    expect(opened.upgradeEnemy('capacity')).toBe('broke')
    opened.advance(60_000)
    expect(rivals(opened)).toHaveLength(2)
    opened.advance(60_000)
    expect(rivals(opened)).toHaveLength(3)

    const doubled = GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 1,
      tractorBeam: true,
      rivalCap: 2,
      fleetAnswered: true,
      asteroids: [],
      ships: [ship('rival', 900, 325, 'wait', null)],
    }))
    expect(doubled.scene().enemy.values.capacity).toBe(2)
    expect(doubled.upgradeEnemy('capacity')).toBe('ok')
    expect(doubled.exportState().rivalCap).toBe(10)
    expect(rivals(doubled)).toHaveLength(1)
  })

  it('compounds destroyed-ship bounty by 1.3 for each capacity buy, and not for spawn rate', () => {
    const placed = (levels: { capacity?: number; spawnRate?: number }) => GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      fighter: { bounty: 100 },
    }), fresh({
      tractorBeam: true,
      enemyLevels: { ...blankEnemyLevels(), ...levels },
      asteroids: [],
      ships: [
        { ...ship('player', 400, 300, 'attack', 'ship-2'), role: 'fighter' },
        { ...ship('rival', 420, 300, 'wait', null), health: 1, maxHealth: 1 },
      ],
    }))
    const paid = (levels: { capacity?: number; spawnRate?: number }) => {
      const game = placed(levels)
      game.advance(50)
      return game.scene().money
    }
    expect(placed({}).scene().enemy.bounty).toBe(1)
    expect(paid({})).toBe(100)
    expect(placed({ capacity: 1 }).scene().enemy.bounty).toBeCloseTo(1.3)
    expect(paid({ capacity: 1 })).toBe(130)
    expect(placed({ capacity: 2 }).scene().enemy.bounty).toBeCloseTo(1.69)
    expect(paid({ capacity: 2 })).toBe(169)
    expect(placed({ spawnRate: 4 }).scene().enemy.bounty).toBe(1)
    expect(paid({ spawnRate: 4 })).toBe(100)
    expect(placed({ capacity: 2, spawnRate: 4 }).scene().enemy.bounty).toBeCloseTo(1.69)
    expect(paid({ capacity: 2, spawnRate: 4 })).toBe(169)
  })

  it('raises rival health, damage, and attack rate, and compounds the bounty for each', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 500, minerRange: 500, shotIntervalMs: 1000 },
      asteroids: { spawnMs: 999_999 },
      fighter: { bounty: 100 },
      enemyUpgrades: {
        ...config.enemyUpgrades,
        damage: linearTable(1, 1, 10, 1, 1.3),
      },
    }), fresh({
      money: 7,
      tractorBeam: true,
      asteroids: [{ id: 'asteroid-1', x: 500, y: 325, health: 100, maxHealth: 100, kind: 'normal' }],
      ships: [
        ship('player', 450, 325, 'shoot', 'asteroid-1'),
        { ...ship('rival', 450, 340, 'shoot', 'asteroid-1'), health: 12, maxHealth: 20 },
      ],
    }))
    expect(game.scene().enemy.values.health).toBe(20)
    expect(game.scene().enemy.values.damage).toBe(1)
    expect(game.scene().enemy.values.attackRate).toBe(1)
    expect(game.upgradeEnemy('health')).toBe('ok')
    const rival = () => game.exportState().ships.find(miner => miner.side === 'rival')
    expect(rival()?.health).toBe(22)
    expect(rival()?.maxHealth).toBe(30)
    expect(game.exportState().ships.find(miner => miner.side === 'player')?.health).toBe(20)
    expect(game.upgradeEnemy('damage')).toBe('ok')
    expect(game.upgradeEnemy('attackRate')).toBe('ok')
    expect(game.scene().enemy.bounty).toBeCloseTo(1.3 ** 3)
    game.advance(50)
    expect(game.exportState().shots.find(shot => shot.side === 'rival')?.damage).toBe(4)
    expect(rival()?.fireCooldownMs).toBe(1950)

    const killing = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      fighter: { bounty: 100 },
    }), fresh({
      tractorBeam: true,
      enemyLevels: { ...blankEnemyLevels(), health: 1, damage: 1, attackRate: 1 },
      asteroids: [],
      ships: [
        { ...ship('player', 400, 300, 'attack', 'ship-2'), role: 'fighter' },
        { ...ship('rival', 420, 300, 'wait', null), health: 1, maxHealth: 1 },
      ],
    }))
    killing.advance(50)
    expect(killing.scene().money).toBe(Math.round(100 * 1.3 ** 3))
  })

  it('matches buying every miner and mining upgrade', () => {
    const opened = () => GameImpl.create(tuned({
      ships: { speed: 0 },
      bank: { startingMoney: 100_000 },
      upgrades: {
        speed: linearTable(10, 2, 14, 1),
        damage: linearTable(8, 1, 10, 1),
        fireRate: linearTable(1, 1, 3, 1),
        carry: linearTable(1, 1, 3, 1),
        count: linearTable(1, 1, 3, 1),
        production: linearTable(1, 1, 3, 1),
      },
      mining: {
        ...config.mining,
        size: linearTable(1, 1, 3, 1),
        spawnRate: linearTable(1, 1, 3, 1),
        goldenSpawnRate: linearTable(1, 1, 3, 1),
      },
    }), 1)
    const buyAll = (game: GameImpl) => {
      for (const upgrade of ['speed', 'damage', 'fireRate', 'carry', 'count', 'production'] as const) {
        while (game.upgradeMiner(upgrade) === 'ok') { /* every level */ }
      }
      while (game.upgradeMining('unlock') === 'ok') { /* once */ }
      while (game.upgradeMining('size') === 'ok') { /* every level */ }
      while (game.upgradeMining('spawnRate') === 'ok') { /* every level */ }
      while (game.upgradeMining('golden') === 'ok') { /* once */ }
      while (game.upgradeMining('goldenSpawnRate') === 'ok') { /* every level */ }
      while (game.upgradeMining('tractorBeam') === 'ok') { /* once */ }
    }
    const bought = opened()
    buyAll(bought)
    const skipped = opened()
    skipped.skipLevelOne()
    const { money: boughtMoney, ...boughtState } = bought.exportState()
    const { money: skippedMoney, ...skippedState } = skipped.exportState()
    expect(skippedMoney).toBe(100_000)
    expect(boughtMoney).toBeLessThan(skippedMoney)
    expect(skippedState).toEqual(boughtState)

    const partialBought = opened()
    const partialSkipped = opened()
    expect(partialBought.upgradeMining('unlock')).toBe('ok')
    expect(partialSkipped.upgradeMining('unlock')).toBe('ok')
    expect(partialBought.upgradeMining('size')).toBe('ok')
    expect(partialSkipped.upgradeMining('size')).toBe('ok')
    buyAll(partialBought)
    partialSkipped.skipLevelOne()
    const { money: partialBoughtMoney, ...partialBoughtState } = partialBought.exportState()
    const { money: partialSkippedMoney, ...partialSkippedState } = partialSkipped.exportState()
    expect(partialSkippedMoney).toBeGreaterThan(partialBoughtMoney)
    expect(partialSkippedState).toEqual(partialBoughtState)
  })

  it('maxes every upgrade through the ship designer without spending', () => {
    const game = GameImpl.create(tuned({ bank: { startingMoney: 40 }, ships: { speed: 0 } }), 1)
    game.upgradesToShipDesign()
    expect(game.scene().money).toBe(40)
    expect(game.scene().miner.costs.speed).toBeNull()
    expect(game.scene().miner.costs.production).toBeNull()
    expect(game.scene().mining.costs.size).toBeNull()
    expect(game.scene().mining.costs.goldenSpawnRate).toBeNull()
    expect(game.exportState().tractorBeam).toBe(true)
    expect(game.scene().fighter.costs.speed).toBeNull()
    expect(game.scene().fighter.costs.count).toBeNull()
    expect(game.scene().enemy.costs.spawnRate).toBeNull()
    expect(game.scene().enemy.costs.capacity).toBeNull()
    expect(game.exportState().shipDesigner).toBe(true)
    expect(game.exportState().laser).toBe(true)
    expect(game.exportState().missile).toBe(false)
    expect(game.exportState().missileCorvetteKilled).toBe(false)
    expect(game.scene().weapon.values.missileFireRate).toBe(config.weaponUpgrades.missileFireRate.levels[0].value)
    expect(game.scene().weapon.values.missileDamage).toBe(config.weaponUpgrades.missileDamage.levels[0].value)
    expect(game.scene().weapon.costs.missileFireRate).toBe(config.weaponUpgrades.missileFireRate.levels[0].cost)
    expect(game.scene().weapon.costs.missileDamage).toBe(config.weaponUpgrades.missileDamage.levels[0].cost)
    expect(game.exportState().mediumEngine).toBe(true)
    expect(game.exportState().largeEngine).toBe(true)
    expect(game.exportState().automine).toBe(true)
    expect(game.exportState().pendingMiners).toBe(0)
    expect(game.exportState().asteroids).toEqual([])
    expect(game.exportState().ships.filter(miner => miner.side === 'player')).toEqual([])
    const fighterCap = ceiling(config.fighterUpgrades.count)
    expect(game.exportState().bays[0].pending).toBe(fighterCap)
    game.upgradesToShipDesign()
    expect(game.scene().money).toBe(40)
    expect(game.exportState().automine).toBe(true)
    expect(game.exportState().pendingMiners).toBe(0)
    expect(game.exportState().bays[0].pending).toBe(fighterCap)
  })

  it('maxes every miner and mining upgrade', () => {
    const game = GameImpl.create(tuned({ ships: { speed: 0 } }), 1)
    const rivals = () => game.exportState().ships.filter(miner => miner.side === 'rival')
    const sizeSteps = config.mining.size.levels.length - 1
    expect(game.scene().money).toBe(0)
    game.skipLevelOne()
    expect(game.scene().money).toBe(0)
    expect(game.scene().miner.values.speed).toBe(ceiling(config.upgrades.speed))
    expect(game.scene().miner.costs.speed).toBeNull()
    expect(game.scene().miner.values.damage).toBe(ceiling(config.upgrades.damage))
    expect(game.scene().miner.values.fireRate).toBe(ceiling(config.upgrades.fireRate))
    expect(game.scene().miner.values.carry).toBe(ceiling(config.upgrades.carry))
    expect(game.scene().miner.values.count).toBe(ceiling(config.upgrades.count))
    expect(game.scene().miner.costs.count).toBeNull()
    expect(game.scene().miner.values.production).toBe(ceiling(config.upgrades.production))
    expect(game.exportState().pendingMiners).toBe(ceiling(config.upgrades.count) - 1)
    expect(game.exportState().miningUnlocked).toBe(true)
    expect(game.exportState().automine).toBe(false)
    expect(game.exportState().shipDesigner).toBe(false)
    expect(game.exportState().golden).toBe(true)
    expect(game.exportState().tractorBeam).toBe(true)
    expect(game.scene().mining.values.size).toBe(ceiling(config.mining.size))
    expect(game.scene().mining.costs.size).toBeNull()
    expect(game.scene().mining.values.spawnRate).toBe(ceiling(config.mining.spawnRate))
    expect(game.scene().mining.values.goldenSpawnRate).toBe(ceiling(config.mining.goldenSpawnRate))
    expect(game.scene().mining.golden.owned).toBe(true)
    expect(game.scene().mining.tractorBeam.owned).toBe(true)
    expect(game.exportState().asteroids.every(asteroid => asteroid.health === config.asteroids.health * config.asteroids.healthScale ** sizeSteps)).toBe(true)
    expect(rivals()).toHaveLength(1)
    game.skipLevelOne()
    expect(game.scene().miner.values.speed).toBe(ceiling(config.upgrades.speed))
    expect(game.exportState().pendingMiners).toBe(ceiling(config.upgrades.count) - 1)
    expect(rivals()).toHaveLength(1)
  })

  it('replaces our miners and the asteroid field with a flat income', () => {
    const game = GameImpl.restore(tuned({
      asteroids: { spawnMs: 1_000 },
      golden: { spawnMs: 1_000 },
    }), fresh({
      money: 9_999,
      miningUnlocked: true,
      tractorBeam: true,
      asteroids: [
        { id: 'rock-1', x: 500, y: 300, health: 5, maxHealth: 5, kind: 'normal' },
      ],
      ships: [
        ship('player', config.map.baseX, config.map.baseY, 'engage', 'rock-1'),
      ],
    }))
    expect(game.upgradeMining('automine')).toBe('broke')
    const early = GameImpl.restore(tuned({ asteroids: { spawnMs: 999_999 } }), fresh({
      money: 10_000,
      miningUnlocked: true,
      asteroids: [{ id: 'rock-1', x: 500, y: 300, health: 5, maxHealth: 5, kind: 'normal' }],
      ships: [ship('rival', 800, config.map.baseY, 'back', null)],
    }))
    expect(early.upgradeMining('automine')).toBe('maxed')
    expect(early.exportState().automine).toBe(false)
    expect(early.scene().money).toBe(10_000)
    expect(early.exportState().ships[0]?.mode).toBe('back')
    expect(game.scene().money).toBe(9_999)
    expect(game.exportState().asteroids).toHaveLength(1)
    expect(game.exportState().ships).toHaveLength(1)
    const funded = GameImpl.restore(tuned({
      asteroids: { spawnMs: 1_000 },
      golden: { spawnMs: 1_000 },
    }), fresh({
      money: 10_000,
      miningUnlocked: true,
      tractorBeam: true,
      golden: true,
      pendingMiners: 2,
      minerWork: 500,
      asteroids: [
        { id: 'rock-1', x: 500, y: 300, health: 5, maxHealth: 5, kind: 'normal' },
        { id: 'rock-2', x: 520, y: 320, health: 20, maxHealth: 20, kind: 'golden' },
      ],
      ships: [
        ship('player', config.map.baseX, config.map.baseY, 'engage', 'rock-1'),
        { ...ship('rival', 800, config.map.baseY, 'back', null), cargo: 1, cargoValue: 1 },
        { ...ship('player', config.map.baseX, config.map.baseY + 40, 'wait', null), id: 'ship-3', role: 'fighter' },
      ],
      nextShipId: 4,
      nextAsteroidId: 3,
    }))
    expect(funded.scene().mining.automine).toEqual({ owned: false, cost: 10_000, payout: 800, everyMs: 5_000 })
    expect(funded.upgradeMining('automine')).toBe('ok')
    expect(funded.scene().money).toBe(0)
    expect(funded.exportState().asteroids).toEqual([])
    expect(funded.exportState().automine).toBe(true)
    expect(funded.exportState().pendingMiners).toBe(0)
    expect(funded.exportState().minerWork).toBe(0)
    expect(funded.scene().nextMiner).toBeNull()
    expect(funded.exportState().ships.map(miner => miner.role === 'fighter' ? 'fighter' : miner.side)).toEqual(['rival', 'fighter'])
    const rival = funded.exportState().ships.find(miner => miner.side === 'rival')
    expect(rival?.mode).not.toBe('back')
    expect(rival?.cargo).toBe(0)
    expect(funded.upgradeMining('automine')).toBe('maxed')
    expect(funded.upgradeMiner('speed')).toBe('maxed')
    funded.advance(1_000)
    const later = funded.exportState().ships.find(miner => miner.side === 'rival')
    expect(later?.mode).not.toBe('back')
    expect(later?.x).toBeLessThan(800)
    expect(funded.scene().money).toBe(0)
    expect(funded.exportState().asteroids).toEqual([])
    funded.advance(4_000)
    expect(funded.scene().money).toBe(800)
    expect(funded.exportState().automineElapsedMs).toBe(0)
    const waiting = funded.exportState()
    waiting.automineElapsedMs = 4_000
    const loaded = GameImpl.restore(tuned(), waiting)
    loaded.advance(1_000)
    expect(loaded.scene().money).toBe(1_600)
    expect(loaded.exportState().asteroids).toEqual([])
    expect(loaded.exportState().ships.filter(miner => miner.side === 'player' && miner.role === 'miner')).toEqual([])
    funded.skipLevelOne()
    expect(funded.exportState().ships.filter(miner => miner.side === 'player' && miner.role === 'miner')).toEqual([])
    expect(funded.exportState().pendingMiners).toBe(0)
    expect(funded.exportState().automine).toBe(true)
  })

  it('converts a balance above $100,000 into one crystal', () => {
    const early = GameImpl.restore(tuned(), fresh({
      money: 200_000,
      miningUnlocked: true,
      tractorBeam: true,
      asteroids: [],
      ships: [],
    }))
    expect(early.upgradeMining('moneyConverter')).toBe('maxed')
    expect(early.scene().money).toBe(200_000)
    expect(early.scene().crystals).toBe(0)

    const bought = GameImpl.restore(tuned(), fresh({
      money: 200_001,
      miningUnlocked: true,
      tractorBeam: true,
      automine: true,
      asteroids: [],
      ships: [],
    }))
    expect(bought.scene().mining.moneyConverter).toEqual({ owned: false, cost: 100_000 })
    expect(bought.upgradeMining('moneyConverter')).toBe('ok')
    expect(bought.scene().money).toBe(0)
    expect(bought.scene().crystals).toBe(1)
    expect(bought.upgradeMining('size')).toBe('maxed')

    const held = GameImpl.restore(tuned(), fresh({
      money: 100_000,
      automine: true,
      moneyConverter: true,
      asteroids: [],
      ships: [],
    }))
    held.advance(1)
    expect(held.scene().money).toBe(100_000)
    expect(held.scene().crystals).toBe(0)

    const over = GameImpl.restore(tuned(), fresh({
      money: 100_001,
      automine: true,
      moneyConverter: true,
      asteroids: [],
      ships: [],
    }))
    over.advance(1)
    expect(over.scene().money).toBe(0)
    expect(over.scene().crystals).toBe(1)

    const income = GameImpl.restore(tuned(), fresh({
      money: 99_900,
      automine: true,
      moneyConverter: true,
      asteroids: [],
      ships: [],
    }))
    income.advance(5_000)
    expect(income.scene().money).toBe(0)
    expect(income.scene().crystals).toBe(1)
    income.advance(5_000)
    expect(income.scene().money).toBe(800)
    expect(income.scene().crystals).toBe(1)

    const gifted = GameImpl.restore(tuned(), fresh({
      money: 90_000,
      gift: 20_000,
      automine: true,
      moneyConverter: true,
      asteroids: [],
      ships: [],
    }))
    gifted.claimGift()
    expect(gifted.scene().money).toBe(0)
    expect(gifted.scene().crystals).toBe(1)
  })

  it('unlocks the ship designer and keeps a part bolted to the core', () => {
    const game = GameImpl.create(tuned({ bank: { startingMoney: 2_000 }, ships: { speed: 0 } }), 1)
    expect(game.placeComponent('structural', 1, 0, 0)).toBe('unknown')
    expect(game.saveDesign()).toBe('unknown')
    expect(game.unlockDesigner()).toBe('ok')
    expect(game.scene().money).toBe(0)
    expect(game.scene().designer.owned).toBe(true)
    expect(game.unlockDesigner()).toBe('maxed')
    expect(game.placeComponent('structural', 1, 0, 0)).toBe('ok')
    expect(game.placeComponent('structural', 2, 1, 0)).toBe('attach')
    expect(game.exportState().savedDesign).toBeNull()
    expect(game.scene().designer.saved).toBeNull()
    expect(game.saveDesign()).toBe('energy')
    expect(game.placeComponent('energy', 0, 1, 0)).toBe('ok')
    expect(game.saveDesign()).toBe('ok')
    const committed = game.exportState().savedDesign
    expect(committed).toEqual(game.exportState().parts)
    expect(game.exportState().designs).toEqual([{ name: 'ship1', parts: committed }])
    expect(game.scene().designer.saved?.units).toBe(game.scene().designer.units)
    const saved = game.exportState()
    const loaded = GameImpl.restore(tuned({ ships: { speed: 0 } }), saved)
    expect(loaded.exportState().shipDesigner).toBe(true)
    expect(loaded.exportState().parts).toEqual(saved.parts)
    expect(loaded.exportState().savedDesign).toEqual(committed)
    const id = saved.parts[0]?.id
    expect(id).toBe('part-1')
    if (!id) return
    expect(loaded.removeComponent(id)).toBe('ok')
    expect(loaded.exportState().parts).toHaveLength(1)
    expect(loaded.exportState().savedDesign).toEqual(committed)
    expect(loaded.scene().designer.saved?.units).toBe(game.scene().designer.units)
    expect(game.importDesign({ version: 1, parts: [] })).toBe('ok')
    expect(game.exportState().parts).toEqual([])
    expect(game.exportState().savedDesign).toEqual(committed)
    expect(game.loadDesign('ship1')).toBe('ok')
    expect(game.exportState().parts).toEqual(committed)
    expect(game.loadDesign('ship2')).toBe('unknown')
    expect(game.importDesign({ version: 9, parts: [] })).toBe('layout')
  })

  it('rewrites the ship being edited and sends a bay back to the fighter when that ship is deleted', () => {
    const game = GameImpl.create(tuned({ bank: { startingMoney: 2_000 }, ships: { speed: 0 } }), 1)
    game.unlockDesigner()
    expect(game.placeComponent('energy', 0, 1, 0)).toBe('ok')
    expect(game.saveDesign()).toBe('ok')
    expect(game.placeComponent('structural', -1, 0, 0)).toBe('ok')
    expect(game.saveDesign()).toBe('ok')
    expect(game.chooseProduction('ship2')).toBe('ok')
    expect(game.loadDesign('ship1')).toBe('ok')
    expect(game.placeComponent('structural', 1, 0, 0)).toBe('ok')
    expect(game.rewriteDesign('ship1')).toBe('ok')
    expect(game.exportState().designs).toHaveLength(2)
    expect(game.exportState().designs[0]?.parts).toHaveLength(2)
    expect(game.exportState().savedDesign).toEqual(game.exportState().designs[1]?.parts)
    expect(game.exportState().bays[0].design).toBe('ship2')
    expect(game.deleteDesign('ship1')).toBe('ok')
    expect(game.exportState().designs.map(item => item.name)).toEqual(['ship1'])
    expect(game.exportState().bays[0].design).toBe('ship1')
    expect(game.exportState().savedDesign).toEqual(game.exportState().designs[0]?.parts)
    expect(game.deleteDesign('ship1')).toBe('ok')
    expect(game.exportState().designs).toEqual([])
    expect(game.exportState().savedDesign).toBeNull()
    expect(game.exportState().bays[0].design).toBe('fighter')
    expect(game.deleteDesign('ship1')).toBe('unknown')
    expect(game.rewriteDesign('ship1')).toBe('unknown')
  })

  it('sells a laser and a missile after the designer and refuses them before', () => {
    const game = GameImpl.create(tuned({ bank: { startingMoney: 20_000 }, ships: { speed: 0 } }), 1)
    expect(game.unlockWeapon('laser')).toBe('unknown')
    expect(game.scene().designer.weapons.map(weapon => weapon.cost)).toEqual([
      config.designer.weapons.laser.cost,
      null,
    ])
    expect(game.scene().designer.weapons.find(weapon => weapon.id === 'missile')?.crystal).toBe(config.designer.weapons.missile.crystal)
    expect(game.unlockDesigner()).toBe('ok')
    expect(game.scene().designer.catalog.map(item => item.id)).not.toContain('laser')
    expect(game.placeComponent('laser', 0, -1, 0)).toBe('unknown')
    expect(game.unlockWeapon('laser')).toBe('ok')
    expect(game.unlockWeapon('laser')).toBe('maxed')
    expect(game.scene().designer.catalog.map(item => item.id)).toContain('laser')
    expect(game.scene().designer.weapons.find(weapon => weapon.id === 'laser')?.cost).toBeNull()
    expect(game.placeComponent('missile', -1, 0, 270)).toBe('unknown')
    expect(game.unlockWeapon('missile')).toBe('unknown')
    expect(game.scene().money).toBe(20_000 - config.designer.cost - config.designer.weapons.laser.cost)
    const saved = game.exportState()
    expect(GameImpl.restore(tuned({ ships: { speed: 0 } }), saved).exportState().missile).toBe(false)
  })

  it('spends crystals on missiles only after a ship kills a missile corvette', () => {
    const cannon = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [],
      ships: [
        { ...ship('rival', config.map.baseX + 40, config.map.baseY, 'wait', null), role: 'corvette', missiles: true, health: 1, maxHealth: 200 },
      ],
    }))
    cannon.advance(50)
    expect(cannon.exportState().ships.some(body => body.role === 'corvette')).toBe(false)
    expect(cannon.exportState().missileCorvetteKilled).toBe(false)
    expect(cannon.scene().crystals).toBe(0)

    const plain = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0, wake: 0 },
    }), fresh({
      tractorBeam: true,
      asteroids: [],
      ships: [
        { ...ship('player', 500, 300, 'attack', 'ship-2'), role: 'fighter' },
        { ...ship('rival', 520, 300, 'wait', null), role: 'corvette', health: 1, maxHealth: 200 },
      ],
    }))
    plain.advance(50)
    expect(plain.exportState().missileCorvetteKilled).toBe(false)

    const killing = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0, wake: 0 },
      corvette: { bounty: 500, crystal: 1 },
    }), fresh({
      tractorBeam: true,
      corvette: true,
      corvetteLevels: { ...blankCorvetteLevels(), missiles: 1 },
      asteroids: [],
      ships: [
        { ...ship('player', 500, 300, 'attack', 'ship-2'), role: 'fighter' },
        { ...ship('rival', 520, 300, 'wait', null), role: 'corvette', missiles: true, health: 1, maxHealth: 200 },
      ],
    }))
    killing.advance(50)
    expect(killing.exportState().missileCorvetteKilled).toBe(true)
    expect(killing.scene().crystals).toBe(2)
    expect(killing.scene().money).toBe(500)

    const locked = GameImpl.restore(tuned(), fresh({
      shipDesigner: true,
      money: 5_000,
      crystals: 6,
      asteroids: [],
      ships: [],
    }))
    expect(locked.unlockWeapon('missile')).toBe('unknown')
    expect(locked.scene().crystals).toBe(6)
    expect(locked.scene().money).toBe(5_000)

    const open = GameImpl.restore(tuned(), fresh({
      shipDesigner: true,
      money: 5_000,
      crystals: 6,
      missileCorvetteKilled: true,
      asteroids: [],
      ships: [],
    }))
    expect(open.upgradeWeapon('missileDamage')).toBe('unknown')
    expect(open.unlockWeapon('missile')).toBe('ok')
    expect(open.scene().money).toBe(5_000)
    expect(open.scene().crystals).toBe(5)
    expect(open.upgradeWeapon('missileDamage')).toBe('ok')
    expect(open.scene().weapon.values.missileDamage).toBe(config.weaponUpgrades.missileDamage.levels[1].value)
    expect(open.scene().crystals).toBe(0)
    expect(open.scene().money).toBe(5_000)
    expect(open.upgradeWeapon('missileFireRate')).toBe('broke')
    expect(open.scene().weapon.costs.missileFireRate).toBe(config.weaponUpgrades.missileFireRate.levels[0].cost)
  })

  it('sells medium and large engines after the designer and refuses them before', () => {
    const game = GameImpl.create(tuned({ bank: { startingMoney: 40_000 }, ships: { speed: 0 } }), 1)
    expect(game.unlockEngine('mediumEngine')).toBe('unknown')
    expect(game.unlockDesigner()).toBe('ok')
    const catalog = () => game.scene().designer.catalog.map(item => item.id)
    expect(catalog()).toContain('thruster')
    expect(catalog()).not.toContain('mediumEngine')
    expect(game.placeComponent('mediumEngine', 0, 1, 0)).toBe('unknown')
    expect(game.scene().designer.engines).toEqual([
      {
        id: 'mediumEngine',
        label: 'Medium engine',
        cost: config.designer.engines.mediumEngine.cost,
        thrust: 20,
        energy: -4,
        units: 80,
        cells: 2,
      },
      {
        id: 'largeEngine',
        label: 'Large engine',
        cost: config.designer.engines.largeEngine.cost,
        thrust: 50,
        energy: -10,
        units: 240,
        cells: 6,
      },
    ])
    expect(game.unlockEngine('mediumEngine')).toBe('ok')
    expect(game.unlockEngine('mediumEngine')).toBe('maxed')
    expect(catalog()).toContain('mediumEngine')
    expect(catalog()).not.toContain('largeEngine')
    expect(game.placeComponent('mediumEngine', 0, 1, 0)).toBe('ok')
    expect(game.scene().designer.stats.thrust).toBe(config.designer.components.mediumEngine.thrust)
    expect(game.scene().designer.stats.energy).toBe(
      config.designer.components.mediumEngine.energy,
    )
    expect(game.unlockEngine('largeEngine')).toBe('ok')
    const saved = game.exportState()
    const loaded = GameImpl.restore(tuned({ ships: { speed: 0 } }), saved)
    expect(loaded.exportState().mediumEngine).toBe(true)
    expect(loaded.exportState().largeEngine).toBe(true)
    expect(loaded.scene().designer.catalog.map(item => item.id)).toContain('largeEngine')
    expect(loaded.scene().designer.stats.thrust).toBeGreaterThan(config.designer.components.thruster.thrust)
  })

  it('raises laser range and cuts its draw, and raises missile fire rate and damage', () => {
    const locked = GameImpl.create(tuned({ bank: { startingMoney: 100_000 } }), 1)
    expect(locked.upgradeWeapon('cannonFireRate')).toBe('unknown')
    expect(locked.upgradeWeapon('cannonDamage')).toBe('unknown')
    expect(locked.upgradeWeapon('laserRange')).toBe('unknown')
    expect(locked.unlockDesigner()).toBe('ok')
    expect(locked.upgradeWeapon('missileDamage')).toBe('unknown')

    const game = GameImpl.restore(tuned({
      bank: { startingMoney: 100_000 },
      ships: { speed: 0, shotSpeed: 0, weaponRange: 90, minerRange: 90, shotIntervalMs: 1000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0 },
    }), fresh({
      shipDesigner: true,
      laser: true,
      missile: true,
      money: 100_000,
      crystals: 20,
      asteroids: [],
      ships: [
        {
          ...ship('player', 100, 325, 'attack', 'ship-2'),
          role: 'fighter',
          craft: {
            speed: 0,
            damage: 10,
            weapons: [
              { kind: 'laser', range: config.designer.components.laser.range, splash: false },
              { kind: 'missile', range: 500, splash: true },
            ],
            cooldown: { weapon: 0, laser: 0, missile: 0 },
            cells: [],
          },
        },
        ship('rival', 400, 325, 'wait', null),
      ],
    }))
    expect(game.upgradeWeapon('laserRange')).toBe('ok')
    expect(game.upgradeWeapon('laserEnergy')).toBe('ok')
    expect(game.scene().money).toBe(100_000)
    expect(game.scene().weapon.crystals.laserRange).toBe(true)
    expect(game.scene().weapon.costs.laserRange).toBe(10)
    expect(game.scene().weapon.values.laserRange).toBe(config.weaponUpgrades.laserRange.levels[1].value)
    expect(game.scene().weapon.values.laserEnergy).toBe(1)
    expect(game.placeComponent('thruster', 0, 1, 0)).toBe('ok')
    expect(game.placeComponent('energy', 1, 0, 0)).toBe('ok')
    expect(game.placeComponent('laser', 0, -1, 0)).toBe('ok')
    expect(game.saveDesign()).toBe('ok')
    expect(game.scene().designer.saved?.stats.range).toBe(config.designer.components.laser.range + 90)
    expect(game.scene().designer.saved?.stats.energy).toBe(0)
    expect(game.upgradeWeapon('missileFireRate')).toBe('ok')
    expect(game.upgradeWeapon('missileDamage')).toBe('ok')
    game.advance(50)
    const state = game.exportState()
    expect(state.shots).toHaveLength(1)
    expect(state.shots[0]).toMatchObject({ splash: true, damage: 40 })
    expect(state.ships.find(miner => miner.id === 'ship-2')?.health).toBe(10)
    expect(game.scene().lasers).toEqual([
      expect.objectContaining({
        x0: 100,
        y0: 325,
        x1: 400,
        y1: 325,
        side: 'player',
        source: 'laser',
      }),
    ])
    expect(state.ships.find(miner => miner.id === 'ship-1')?.craft?.cooldown).toEqual({ weapon: 0, laser: 950, missile: 2450 })
  })

  it('raises cannon fire rate and damage after the designer is owned', () => {
    const game = GameImpl.restore(tuned({
      bank: { startingMoney: 100_000 },
      ships: { speed: 0, shotSpeed: 0, weaponRange: 90, minerRange: 90, shotIntervalMs: 1000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0 },
    }), fresh({
      shipDesigner: true,
      money: 100_000,
      asteroids: [],
      ships: [
        {
          ...ship('player', 100, 325, 'attack', 'ship-2'),
          role: 'fighter',
          craft: {
            speed: 0,
            damage: 10,
            weapons: [{ kind: 'weapon', range: 500, splash: false }],
            cooldown: { weapon: 0, laser: 0, missile: 0 },
            cells: [],
          },
        },
        ship('rival', 400, 325, 'wait', null),
      ],
    }))
    expect(game.upgradeWeapon('cannonDamage')).toBe('ok')
    expect(game.upgradeWeapon('cannonFireRate')).toBe('ok')
    expect(game.scene().money).toBe(96_000)
    expect(game.scene().weapon.crystals.cannonDamage).toBe(true)
    expect(game.scene().weapon.costs.cannonDamage).toBe(5)
    expect(game.upgradeWeapon('cannonDamage')).toBe('broke')
    game.advance(50)
    const state = game.exportState()
    expect(state.shots[0]).toMatchObject({ splash: false, damage: 20 })
    expect(state.ships.find(miner => miner.id === 'ship-1')?.craft?.cooldown.weapon).toBe(450)
  })

  it('charges later cannon levels in crystals, and laser levels in crystals from the first buy', () => {
    const cannon = GameImpl.restore(tuned(), fresh({
      shipDesigner: true,
      money: 2_000,
      crystals: 15,
      asteroids: [],
      ships: [],
    }))
    expect(cannon.scene().weapon.crystals.cannonFireRate).toBe(false)
    expect(cannon.upgradeWeapon('cannonDamage')).toBe('ok')
    expect(cannon.scene().money).toBe(0)
    expect(cannon.scene().crystals).toBe(15)
    expect(cannon.upgradeWeapon('cannonDamage')).toBe('ok')
    expect(cannon.scene().weapon.costs.cannonDamage).toBe(10)
    expect(cannon.upgradeWeapon('cannonDamage')).toBe('ok')
    expect(cannon.scene().crystals).toBe(0)
    expect(cannon.scene().weapon.values.cannonDamage).toBe(40)
    expect(cannon.upgradeWeapon('cannonDamage')).toBe('maxed')

    const laser = GameImpl.restore(tuned(), fresh({
      shipDesigner: true,
      laser: true,
      money: 50_000,
      crystals: 15,
      asteroids: [],
      ships: [],
    }))
    expect(laser.scene().weapon.crystals.laserEnergy).toBe(true)
    expect(laser.scene().weapon.costs.laserEnergy).toBe(5)
    expect(laser.upgradeWeapon('laserEnergy')).toBe('ok')
    expect(laser.scene().money).toBe(50_000)
    expect(laser.scene().weapon.costs.laserEnergy).toBe(10)
    expect(laser.upgradeWeapon('laserEnergy')).toBe('ok')
    expect(laser.scene().crystals).toBe(0)
    expect(laser.scene().money).toBe(50_000)
  })

  it('shoots from the farthest powered gun and only counts guns that reach', () => {
    const aimed = (ranges: number[]) => GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 90, minerRange: 90, shotIntervalMs: 1000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [],
      ships: [
        { ...ship('player', 100, 325, 'attack', 'ship-2'), role: 'fighter', craft: { speed: 0, damage: 10, weapons: ranges.map(range => ({ kind: 'weapon' as const, range, splash: false })), cooldown: { weapon: 0, laser: 0, missile: 0 }, cells: [] } },
        ship('rival', 300, 325, 'wait', null),
      ],
    }))
    const laser = aimed([config.designer.components.laser.range])
    laser.advance(50)
    expect(laser.exportState().shots).toHaveLength(1)
    expect(laser.exportState().shots[0]?.damage).toBe(10)
    const gun = aimed([config.designer.components.weapon.range])
    gun.advance(50)
    expect(gun.exportState().shots).toHaveLength(0)
    const mixed = aimed([config.designer.components.laser.range, config.designer.components.weapon.range])
    mixed.advance(50)
    expect(mixed.exportState().shots).toHaveLength(1)
    expect(mixed.exportState().ships.find(miner => miner.id === 'ship-1')?.craft?.cooldown.weapon).toBe(950)
  })

  it('closes until the shortest gun can fire, and longer guns shoot on the way in', () => {
    const laser = config.designer.components.laser.range
    const gun = config.designer.components.weapon.range
    const armed = (weapons: { kind: 'laser' | 'weapon'; range: number }[], speed: number) => ({
      speed,
      damage: 10,
      weapons: weapons.map(row => ({ kind: row.kind, range: row.range, splash: false as const })),
      cooldown: { weapon: 0, laser: 0, missile: 0 },
      cells: [] as [],
    })
    const duel = (weapons: { kind: 'laser' | 'weapon'; range: number }[], speed: number, health = 20) => GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 90, minerRange: 90, shotIntervalMs: 1000, radius: 0 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0 },
    }), fresh({
      asteroids: [],
      ships: [
        { ...ship('player', 100, 325, 'attack', 'ship-2'), role: 'fighter', craft: armed(weapons, speed) },
        { ...ship('rival', 300, 325, 'wait', null), health, maxHealth: health },
      ],
    }))

    const held = duel([{ kind: 'laser', range: laser }], 100)
    held.advance(50)
    expect(held.scene().lasers).toEqual([
      expect.objectContaining({ x0: 100, y0: 325, x1: 300, y1: 325, side: 'player', source: 'laser' }),
    ])
    expect(held.exportState().ships.find(miner => miner.id === 'ship-2')?.health).toBe(10)
    held.advance(150)
    expect(held.scene().lasers).toHaveLength(1)
    held.advance(300)
    const heldShip = held.exportState().ships.find(miner => miner.id === 'ship-1')
    expect(heldShip?.mode).toBe('attack')
    expect(heldShip?.x).toBe(100)
    expect(held.exportState().shots).toHaveLength(0)
    expect(held.scene().lasers).toEqual([])

    const closing = duel([
      { kind: 'laser', range: laser },
      { kind: 'weapon', range: gun },
    ], 100, 1_000)
    closing.advance(50)
    const mid = closing.exportState()
    const midShip = mid.ships.find(miner => miner.id === 'ship-1')
    expect(midShip?.mode).toBe('hunt')
    expect(midShip?.x).toBeGreaterThan(100)
    expect(Math.hypot(300 - (midShip?.x ?? 0), 325 - (midShip?.y ?? 0))).toBeGreaterThan(gun)
    expect(mid.shots).toHaveLength(0)
    expect(closing.scene().lasers).toEqual([
      expect.objectContaining({ side: 'player', source: 'laser' }),
    ])
    expect(mid.ships.find(miner => miner.id === 'ship-2')?.health).toBe(990)
    expect(midShip?.craft?.cooldown).toEqual({ weapon: 0, laser: 950, missile: 0 })
    advanceUntil(closing, () => closing.exportState().ships.find(miner => miner.id === 'ship-1')?.mode === 'attack', 10_000)
    const parked = closing.exportState().ships.find(miner => miner.id === 'ship-1')
    expect(Math.hypot(300 - (parked?.x ?? 0), 325 - (parked?.y ?? 0))).toBeLessThanOrEqual(gun)

    const rock = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 90, minerRange: 90, shotIntervalMs: 1000, radius: 0 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0 },
    }), fresh({
      asteroids: [{ id: 'asteroid-1', x: 300, y: 325, health: 100, maxHealth: 100, kind: 'normal' }],
      ships: [{
        ...ship('player', 100, 325, 'engage', 'asteroid-1'),
        craft: armed([{ kind: 'laser', range: laser }, { kind: 'weapon', range: gun }], 100),
      }],
    }))
    rock.advance(50)
    const miner = rock.exportState().ships[0]
    expect(miner?.mode).toBe('engage')
    expect(miner?.x).toBeGreaterThan(100)
    expect(rock.exportState().shots).toHaveLength(0)
    expect(rock.exportState().asteroids[0]?.health).toBe(90)
    expect(rock.scene().lasers).toEqual([
      expect.objectContaining({ x0: miner?.x, y0: 325, x1: 300, y1: 325, side: 'player', source: 'laser' }),
    ])
  })

  it('draws a red beam when a rival laser hits', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 90, minerRange: 90, shotIntervalMs: 1000, radius: 0 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0 },
    }), fresh({
      asteroids: [],
      ships: [
        ship('player', 300, 325, 'wait', null),
        {
          ...ship('rival', 100, 325, 'attack', 'ship-1'),
          craft: {
            speed: 0,
            damage: 10,
            weapons: [{ kind: 'laser', range: 270, splash: false }],
            cooldown: { weapon: 0, laser: 0, missile: 0 },
            cells: [],
          },
        },
      ],
    }))
    game.advance(50)
    expect(game.exportState().shots).toEqual([])
    expect(game.exportState().ships.find(miner => miner.id === 'ship-1')?.health).toBe(10)
    expect(game.scene().lasers).toEqual([
      expect.objectContaining({ x0: 100, y0: 325, x1: 300, y1: 325, side: 'rival', source: 'laser' }),
    ])
  })

  it('splashes half damage onto enemy ships in the cells around a missile hit', () => {
    const cell = config.map.cell
    const target = { x: 140, y: 325 }
    const beside = { x: target.x + cell, y: target.y - cell }
    const crowd = (splash: boolean) => GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 2000, weaponRange: 90, minerRange: 90, shotIntervalMs: 10_000, radius: 0 },
      cannon: { range: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [],
      ships: [
        { ...ship('player', 100, 325, 'attack', 'ship-2'), role: 'fighter', craft: { speed: 0, damage: 10, weapons: [{ kind: 'missile', range: 500, splash }], cooldown: { weapon: 0, laser: 0, missile: 0 }, cells: [] } },
        { ...ship('rival', target.x, target.y, 'wait', null), health: 100, maxHealth: 100 },
        { ...ship('rival', beside.x, beside.y, 'wait', null), id: 'ship-3', health: 20, maxHealth: 20 },
        { ...ship('rival', target.x + 1, target.y, 'wait', null), id: 'ship-4', health: 20, maxHealth: 20 },
        { ...ship('rival', target.x + cell * 2, target.y, 'wait', null), id: 'ship-7', health: 20, maxHealth: 20 },
        { ...ship('rival', target.x + cell * 3, target.y, 'wait', null), id: 'ship-5', health: 20, maxHealth: 20 },
        { ...ship('rival', target.x + cell * 4, target.y, 'wait', null), id: 'ship-8', health: 20, maxHealth: 20 },
        { ...ship('rival', target.x + cell * 3, target.y + cell * 2, 'wait', null), id: 'ship-9', health: 20, maxHealth: 20 },
        { ...ship('player', beside.x, target.y, 'wait', null), id: 'ship-6', health: 20, maxHealth: 20 },
      ],
    }))
    const health = (game: GameImpl, id: string) => game.exportState().ships.find(miner => miner.id === id)?.health
    const missile = crowd(true)
    missile.advance(50)
    expect(health(missile, 'ship-2')).toBe(70)
    expect(health(missile, 'ship-3')).toBe(5)
    expect(health(missile, 'ship-4')).toBe(20)
    expect(health(missile, 'ship-5')).toBe(5)
    expect(health(missile, 'ship-7')).toBe(5)
    expect(health(missile, 'ship-8')).toBe(20)
    expect(health(missile, 'ship-9')).toBe(20)
    expect(health(missile, 'ship-6')).toBe(20)
    const gun = crowd(false)
    gun.advance(50)
    expect(health(gun, 'ship-2')).toBe(70)
    expect(health(gun, 'ship-3')).toBe(20)
    expect(gun.scene().blasts).toEqual([])
  })

  it('lights every map cell a missile blast covers, then fades', () => {
    const cell = config.map.cell
    const target = { x: 140, y: 325 }
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 2000, weaponRange: 90, minerRange: 90, shotIntervalMs: 10_000, radius: 0 },
      cannon: { range: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [],
      ships: [
        { ...ship('player', 100, 325, 'attack', 'ship-2'), role: 'fighter', craft: { speed: 0, damage: 10, weapons: [{ kind: 'missile', range: 500, splash: true }], cooldown: { weapon: 0, laser: 0, missile: 0 }, cells: [] } },
        { ...ship('rival', target.x, target.y, 'wait', null), health: 100, maxHealth: 100 },
      ],
    }))
    game.advance(50)
    const blast = game.scene().blasts
    expect(blast).toHaveLength(1)
    expect(blast[0]).toMatchObject({ side: 'player', size: cell, bright: 1 })
    const originX = Math.floor(target.x / cell) * cell
    const originY = Math.floor(target.y / cell) * cell
    const expected: string[] = []
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        if (dx * dx + dy * dy > 12) continue
        expected.push(`${originX + dx * cell},${originY + dy * cell}`)
      }
    }
    const lit = blast[0].cells.map(spot => `${spot.x},${spot.y}`).sort()
    expect(lit).toEqual(expected.sort())
    expect(lit).toContain(`${originX + 3 * cell},${originY}`)
    expect(lit).toContain(`${originX + 3 * cell},${originY + cell}`)
    expect(lit).not.toContain(`${originX + 3 * cell},${originY + 2 * cell}`)
    expect(lit).not.toContain(`${originX + 4 * cell},${originY}`)
    game.advance(50)
    expect(game.scene().blasts[0]?.bright).toBeCloseTo(0.875, 5)
    game.advance(400)
    expect(game.scene().blasts).toEqual([])
  })

  it('flies a missile at half the speed of a gun shot', () => {
    const armed = (splash: boolean) => GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 1_000, weaponRange: 90, minerRange: 90, shotIntervalMs: 10_000, radius: 0 },
      cannon: { range: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [],
      ships: [
        {
          ...ship('player', 100, 325, 'attack', 'ship-2'),
          role: 'fighter',
          craft: {
            speed: 0,
            damage: 10,
            weapons: [{ kind: splash ? 'missile' as const : 'weapon' as const, range: 500, splash }],
            cooldown: { weapon: 0, laser: 0, missile: 0 },
            cells: [],
          },
        },
        ship('rival', 500, 325, 'wait', null),
      ],
    }))
    const gun = armed(false)
    const missile = armed(true)
    gun.advance(100)
    missile.advance(100)
    expect(gun.exportState().shots[0]?.x).toBeCloseTo(200, 5)
    expect(missile.exportState().shots[0]?.x).toBeCloseTo(150, 5)
    expect(missile.scene().shots[0]).toMatchObject({ splash: true, angle: 0 })
  })

  it('launches a corvette missile twice as often as a rate-1 player missile', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 90, minerRange: 90, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0, wake: 0 },
      corvette: { shotMs: 60_000 },
    }), fresh({
      corvette: true,
      asteroids: [],
      ships: [
        {
          ...ship('rival', 100, 300, 'attack', 'ship-1'),
          role: 'corvette',
          missiles: true,
          missileCooldownMs: 0,
          fireCooldownMs: 60_000,
          health: 500,
          maxHealth: 500,
        },
        ship('player', 250, 300, 'wait', null),
      ],
    }))
    const splash = () => game.exportState().shots.filter(shot => shot.splash)
    const cooldown = () => game.exportState().ships.find(body => body.role === 'corvette')?.missileCooldownMs
    game.advance(100)
    expect(splash()).toHaveLength(1)
    expect(cooldown()).toBe(2_400)
    game.advance(2_350)
    expect(splash()).toHaveLength(1)
    expect(cooldown()).toBe(50)
    game.advance(50)
    expect(splash()).toHaveLength(2)
  })

  it('fires each gun type on its own timer, so extra missiles do not speed up the stock gun', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 90, minerRange: 90, shotIntervalMs: 1000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0 },
    }), fresh({
      asteroids: [],
      ships: [
        {
          ...ship('player', 100, 325, 'attack', 'ship-2'),
          role: 'fighter',
          craft: {
            speed: 0,
            damage: 10,
            weapons: [
              { kind: 'weapon', range: 500, splash: false },
              { kind: 'missile', range: 500, splash: true },
              { kind: 'missile', range: 500, splash: true },
            ],
            cooldown: { weapon: 0, laser: 0, missile: 0 },
            cells: [],
          },
        },
        ship('rival', 140, 325, 'wait', null),
      ],
    }))
    game.advance(50)
    const first = game.exportState()
    expect(first.shots).toHaveLength(2)
    expect(first.shots.filter(shot => shot.splash)).toHaveLength(1)
    expect(first.ships.find(miner => miner.id === 'ship-1')?.craft?.cooldown).toEqual({ weapon: 950, laser: 0, missile: 2450 })
    game.advance(1000)
    const second = game.exportState()
    expect(second.shots).toHaveLength(3)
    expect(second.shots.filter(shot => shot.splash)).toHaveLength(1)
    expect(second.ships.find(miner => miner.id === 'ship-1')?.craft?.cooldown).toEqual({ weapon: 950, laser: 0, missile: 1450 })
  })

  it('builds the selected design instead of the default fighter', () => {
    const game = GameImpl.create(tuned({ bank: { startingMoney: 2_000 }, ships: { speed: 0 } }), 1)
    expect(game.scene().fleet.selected).toBe('fighter')
    expect(game.scene().fleet.choices.map(choice => choice.id)).toEqual(['fighter'])
    expect(game.chooseProduction('saved')).toBe('unknown')
    expect(game.unlockDesigner()).toBe('ok')
    expect(game.placeComponent('structural', 1, 0, 0)).toBe('ok')
    expect(game.saveDesign()).toBe('energy')
    expect(game.placeComponent('energy', 0, 1, 0)).toBe('ok')
    expect(game.saveDesign()).toBe('ok')
    const choices = game.scene().fleet.choices
    expect(choices.map(choice => choice.id)).toEqual(['fighter', 'ship1'])
    expect(choices.find(choice => choice.id === 'fighter')?.units).toBe(config.fighter.units)
    const saved = choices.find(choice => choice.id === 'ship1')
    const designUnits = config.designer.components.structural.units + config.designer.components.energy.units
    expect(saved?.units).toBe(designUnits)
    expect(saved?.cells.map(cell => `${cell.x},${cell.y}`).sort()).toEqual(['0,0', '0,1', '0,2', '1,0'])
    expect(game.chooseProduction('ship1')).toBe('ok')
    expect(game.scene().fleet.selected).toBe('ship1')

    const building = GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), {
      ...game.exportState(),
      fighterLevels: { ...game.exportState().fighterLevels, count: 1 },
      bays: [{ design: 'ship1', pending: 1, work: 0, production: 0, capacity: 0 }],
      ships: [],
      asteroids: [],
    })
    const halfMs = (designUnits / 2) * 1000 * 25 / (config.fighter.units * config.designer.bayProduction.scale)
    building.advance(halfMs)
    expect(building.scene().nextFighter?.progress).toBeCloseTo(0.5, 5)
    expect(building.scene().nextFighter?.cells.map(cell => `${cell.x},${cell.y}`).sort()).toEqual(['0,0', '0,1', '0,2', '1,0'])
    building.advance(halfMs)
    expect(building.exportState().bays[0].pending).toBe(0)
    expect(building.exportState().ships.filter(miner => miner.role === 'fighter')).toHaveLength(1)
    expect(building.chooseProduction('fighter')).toBe('ok')
    expect(building.exportState().bays[0].design).toBe('fighter')
    const loaded = GameImpl.restore(tuned({ ships: { speed: 0 } }), building.exportState())
    expect(loaded.scene().fleet.selected).toBe('fighter')
    expect(game.placeComponent('structural', -1, 0, 0)).toBe('ok')
    expect(game.saveDesign()).toBe('ok')
    expect(game.scene().fleet.choices.map(choice => choice.id)).toEqual(['fighter', 'ship1', 'ship2'])
    expect(game.chooseProduction('ship2')).toBe('ok')
    expect(game.scene().fleet.selected).toBe('ship2')
    expect(game.chooseProduction('ship1')).toBe('ok')
    expect(game.scene().fleet.selected).toBe('ship1')

    expect(() => GameImpl.restore(tuned(), fresh({
      shipDesigner: true,
      bays: [{ design: 'saved', pending: 0, work: 0, production: 0, capacity: 0 }],
      asteroids: [],
      ships: [],
    }))).toThrow(/saved design/)
  })

  it('builds a second ship at the same time once that bay is unlocked', () => {
    const saved: MapState['savedDesign'] = [
      { id: 'part-1', component: 'structural', x: 1, y: 0, rotation: 0 },
    ]
    const locked = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({ crystals: 20, asteroids: [], ships: [] }))
    expect(locked.unlockBay()).toBe('unknown')

    const broke = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      crystals: 19,
      shipDesigner: true,
      fighterLevels: { ...blankFighterLevels(), count: 2 },
      parts: saved ?? [],
      nextPartId: 2,
      savedDesign: saved,
      designs: [{ name: 'ship1', parts: saved ?? [] }],
      asteroids: [],
      ships: [],
    }))
    expect(broke.scene().fleet.bays).toEqual([{ index: 1, owned: false, crystal: 20, selected: 'fighter', rate: null, production: null, productionCost: null, capacity: null, capacityCost: null }])
    expect(broke.unlockBay()).toBe('broke')
    expect(broke.chooseProduction('saved', 1)).toBe('unknown')
    expect(broke.exportState().crystals).toBe(19)

    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      crystals: 20,
      shipDesigner: true,
      fighterLevels: { ...blankFighterLevels(), count: 2 },
      parts: saved ?? [],
      nextPartId: 2,
      savedDesign: saved,
      designs: [{ name: 'ship1', parts: saved ?? [] }],
      asteroids: [],
      ships: [],
    }))
    expect(game.unlockBay()).toBe('ok')
    expect(game.exportState().crystals).toBe(0)
    expect(game.unlockBay()).toBe('maxed')
    expect(game.exportState().bays[0].pending).toBe(2)
    expect(game.exportState().bays[1].pending).toBe(1)
    expect(game.chooseProduction('ship1', 1)).toBe('ok')
    expect(game.scene().fleet.selected).toBe('fighter')
    expect(game.scene().fleet.bays[0].selected).toBe('ship1')

    const units = config.designer.components.structural.units
    const rate = (config.fighter.units / 25) * config.designer.bayProduction.scale
    game.advance(Math.ceil((units * 1000) / rate))
    const flying = game.exportState().ships.filter(miner => miner.side === 'player' && miner.role === 'fighter')
    expect(flying).toHaveLength(1)
    expect(flying[0]?.craft).not.toBeNull()
    expect(flying[0]?.bay).toBe(1)
    expect(game.exportState().bays[0].pending).toBe(2)
    expect(game.exportState().bays[1].pending).toBe(0)
    expect(game.scene().nextBays).toHaveLength(1)
    expect(game.scene().nextBays[0]?.index).toBe(1)
    expect(game.scene().nextBays[0]?.progress).toBeLessThan(0.01)
    expect(game.scene().nextFighter?.progress).toBeGreaterThan(0)
    expect(game.scene().nextFighter?.progress).toBeLessThan(1)

    game.advance(Math.ceil((config.fighter.units * 1000) / rate))
    const both = game.exportState().ships.filter(miner => miner.side === 'player' && miner.role === 'fighter')
    expect(both).toHaveLength(2)
    expect(both.filter(miner => miner.craft === null)).toHaveLength(1)
    expect(both.filter(miner => miner.craft !== null)).toHaveLength(1)
    expect(game.exportState().bays[0].pending).toBe(1)
    expect(game.exportState().bays[1].pending).toBe(0)

    const one = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      shipDesigner: true,
      bays: [
        { design: 'fighter', pending: 0, work: 0, production: 0, capacity: 0 },
        { design: 'fighter', pending: 0, work: 0, production: 0, capacity: 0 },
      ],
      fighterLevels: { ...blankFighterLevels(), count: 1 },
      asteroids: [],
      ships: [],
    }))
    one.advance(1)
    expect(one.exportState().bays[0].pending).toBe(1)
    expect(one.exportState().bays[1].pending).toBe(1)
    expect(one.scene().nextBays[0]?.progress).toBeLessThan(0.01)

    const queued = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      crystals: 20,
      shipDesigner: true,
      fighterLevels: { ...blankFighterLevels(), count: 2 },
      bays: [{ design: 'fighter', pending: 2, work: 100, production: 0, capacity: 0 }],
      asteroids: [],
      ships: [],
    }))
    expect(queued.unlockBay()).toBe('ok')
    expect(queued.exportState().bays[0].pending).toBe(2)
    expect(queued.exportState().bays[1].pending).toBe(1)
    expect(queued.exportState().bays[0].work).toBe(100)
    expect(queued.exportState().bays[1].work).toBe(0)

    const third = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0 },
      asteroids: { spawnMs: 999_999 },
      designer: { ...config.designer, bays: [5, 7] },
    }), fresh({
      crystals: 12,
      shipDesigner: true,
      fighterLevels: { ...blankFighterLevels(), count: 3 },
      asteroids: [],
      ships: [],
    }))
    expect(third.scene().fleet.bays).toEqual([{ index: 1, owned: false, crystal: 5, selected: 'fighter', rate: null, production: null, productionCost: null, capacity: null, capacityCost: null }])
    expect(third.unlockBay()).toBe('ok')
    expect(third.exportState().crystals).toBe(7)
    expect(third.scene().fleet.bays.map(bay => [bay.index, bay.owned, bay.crystal])).toEqual([
      [1, true, null],
      [2, false, 7],
    ])
    expect(third.unlockBay()).toBe('ok')
    expect(third.exportState().crystals).toBe(0)
    expect(third.unlockBay()).toBe('maxed')
    expect(third.exportState().bays.map(bay => bay.pending)).toEqual([3, 1, 1])
  })

  it('gives each extra bay its own capacity, starting at one ship', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 1,
      crystals: 20,
      shipDesigner: true,
      tractorBeam: true,
      fighterLevels: { ...blankFighterLevels(), count: 1 },
      asteroids: [],
      ships: [],
    }))
    expect(game.unlockBay()).toBe('ok')
    expect(game.exportState().bays[0].pending).toBe(1)
    expect(game.exportState().bays[1].pending).toBe(1)
    expect(game.scene().fleet.capacity).toBe(1)
    expect(game.scene().fleet.bays[0]).toMatchObject({ capacity: 1, capacityCost: 1 })
    expect(game.upgradeBayCapacity(1)).toBe('ok')
    expect(game.scene().money).toBe(0)
    expect(game.scene().fleet.bays[0].capacity).toBe(2)
    expect(game.exportState().bays[1].pending).toBe(2)
    expect(game.exportState().bays[0].pending).toBe(1)
  })

  it('builds a saved design that flies at its speed and fires its weapons', () => {
    const parts: MapState['parts'] = [
      { id: 'part-1', component: 'thruster', x: 0, y: 1, rotation: 0 },
      { id: 'part-2', component: 'weapon', x: 0, y: -1, rotation: 0 },
      { id: 'part-3', component: 'energy', x: 1, y: 0, rotation: 0 },
    ]
    const weight = config.designer.core.weight
      + config.designer.components.thruster.weight
      + config.designer.components.weapon.weight
      + config.designer.components.energy.weight
    const speed = config.ships.speed * (config.designer.components.thruster.thrust / weight)
    const game = GameImpl.restore(tuned({ asteroids: { spawnMs: 999_999 } }), fresh({
      shipDesigner: true,
      parts,
      nextPartId: 4,
      savedDesign: parts,
      designs: [{ name: 'ship1', parts }],
      fighterLevels: { ...blankFighterLevels(), count: 1 },
      bays: [{ design: 'ship1', pending: 1, work: 0, production: 0, capacity: 0 }],
      asteroids: [],
      ships: [
        ship('player', 400, 100, 'wait', null),
        ship('rival', config.map.rivalBaseX, config.map.rivalBaseY, 'wait', null),
      ],
    }))
    const units = parts.reduce((sum, part) => sum + config.designer.components[part.component].units, 0)
    game.advance(units * 1000 * 25 / (60 * config.designer.bayProduction.scale))
    const fighter = game.exportState().ships.find(miner => miner.role === 'fighter')
    const cells = [
      { x: 0, y: 0, color: '#e2e8f0' },
      { x: 0, y: 1, color: config.designer.components.thruster.color },
      { x: 0, y: -1, color: config.designer.components.weapon.color },
      { x: 0, y: -2, color: config.designer.components.weapon.color },
      { x: 1, y: 0, color: config.designer.components.energy.color },
      { x: 1, y: 1, color: config.designer.components.energy.color },
    ]
    expect(fighter?.craft).toEqual({
      speed,
      damage: config.designer.weaponDamage,
      weapons: [{ kind: 'weapon', range: config.designer.components.weapon.range, splash: false }],
      cooldown: { weapon: 0, laser: 0, missile: 0 },
      cells,
    })
    expect(game.scene().ships.find(miner => miner.role === 'fighter')?.hull).toEqual(cells)
    expect(fighter?.x).toBe(config.map.baseX)
    game.advance(1000)
    expect(game.exportState().ships.find(miner => miner.role === 'fighter')?.x).toBeCloseTo(config.map.baseX + speed, 0)

    const shooting = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 500, minerRange: 500, shotIntervalMs: 1000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [],
      ships: [
        { ...ship('player', 100, 325, 'attack', 'ship-2'), role: 'fighter', craft: { speed: 30, damage: 10, weapons: [{ kind: 'weapon', range: 500, splash: false }, { kind: 'weapon', range: 500, splash: false }], cooldown: { weapon: 0, laser: 0, missile: 0 }, cells: [] } },
        ship('rival', 140, 325, 'wait', null),
      ],
    }))
    shooting.advance(50)
    expect(shooting.exportState().shots.find(shot => shot.shipId === 'ship-2')?.damage).toBe(10)
    expect(shooting.exportState().ships.find(miner => miner.id === 'ship-1')?.craft?.cooldown.weapon).toBe(450)
  })

  it('launches a designed ship with hull health and leaves the fighter health upgrade on the default fighter', () => {
    const parts: MapState['parts'] = [
      { id: 'part-1', component: 'structural', x: 1, y: 0, rotation: 0 },
      { id: 'part-2', component: 'armor', x: 0, y: 1, rotation: 0 },
    ]
    const hull = config.designer.core.health + config.designer.components.structural.health + config.designer.components.armor.health
    const game = GameImpl.restore(tuned({ asteroids: { spawnMs: 999_999 } }), fresh({
      money: 20,
      tractorBeam: true,
      shipDesigner: true,
      parts,
      nextPartId: 3,
      savedDesign: parts,
      designs: [{ name: 'ship1', parts }],
      fighterLevels: { ...blankFighterLevels(), count: 1 },
      bays: [{ design: 'ship1', pending: 1, work: 0, production: 0, capacity: 0 }],
      asteroids: [],
      ships: [],
    }))
    expect(game.upgradeFighterStat('health')).toBe('ok')
    const units = parts.reduce((sum, part) => sum + config.designer.components[part.component].units, 0)
    game.advance(units * 1000 * 25 / (60 * config.designer.bayProduction.scale))
    const fighter = game.exportState().ships.find(miner => miner.role === 'fighter')
    expect(fighter?.health).toBe(hull)
    expect(fighter?.maxHealth).toBe(hull)
    expect(game.upgradeFighterStat('health')).toBe('ok')
    expect(game.exportState().ships.find(miner => miner.role === 'fighter')?.health).toBe(hull)
    expect(game.scene().fighter.values.health).toBe(40)
  })

  it('pays 20, then 10000, then doubles the sidebar gift', () => {
    const game = GameImpl.create(tuned({ ships: { speed: 0 } }), 1)
    expect(game.scene().gift).toBe(20)
    game.claimGift()
    expect(game.scene().money).toBe(20)
    expect(game.scene().gift).toBe(10_000)
    game.claimGift()
    expect(game.scene().money).toBe(10_020)
    expect(game.scene().gift).toBe(20_000)
    game.claimGift()
    expect(game.scene().money).toBe(30_020)
    expect(game.scene().gift).toBe(40_000)
    const loaded = GameImpl.restore(tuned({ ships: { speed: 0 } }), game.exportState())
    expect(loaded.scene().money).toBe(30_020)
    expect(loaded.scene().gift).toBe(40_000)
  })

  it('pays a doubling crystal gift from the sidebar button', () => {
    const game = GameImpl.create(tuned({ ships: { speed: 0 } }), 1)
    expect(game.scene().crystalGift).toBe(10_000)
    game.claimCrystalGift()
    expect(game.scene().crystals).toBe(10_000)
    expect(game.scene().crystalGift).toBe(20_000)
    game.claimCrystalGift()
    expect(game.scene().crystals).toBe(30_000)
    expect(game.scene().crystalGift).toBe(40_000)
    const loaded = GameImpl.restore(tuned({ ships: { speed: 0 } }), game.exportState())
    expect(loaded.scene().crystals).toBe(30_000)
    expect(loaded.scene().crystalGift).toBe(40_000)
  })

  it('spawns small golden asteroids with tougher health and richer loot', () => {
    const game = GameImpl.create(tuned({
      bank: { startingMoney: 50 },
      ships: { speed: 0 },
      asteroids: { health: 5, spawnMs: 999_999 },
      golden: { spawnMs: 1_000, max: 2 },
      ore: { value: 1 },
    }), 1)
    expect(game.scene().goldenSize).toBe(10)
    expect(game.upgradeMining('golden')).toBe('ok')
    expect(game.exportState().golden).toBe(true)
    expect(game.upgradeMining('golden')).toBe('maxed')
    game.advance(1_000)
    const spawned = game.exportState().asteroids.filter(asteroid => asteroid.kind === 'golden')
    expect(spawned).toHaveLength(1)
    expect(spawned[0]?.maxHealth).toBe(20)
    expect(game.exportState().asteroids.filter(asteroid => asteroid.kind === 'normal')).toHaveLength(10)
    game.advance(3_000)
    expect(game.exportState().asteroids.filter(asteroid => asteroid.kind === 'golden')).toHaveLength(2)
  })

  it('drops golden loot worth twenty times a normal nugget', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 2000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      ore: { value: 1 },
    }), fresh({
      asteroids: [{ id: 'asteroid-1', x: 500, y: 325, health: 8, maxHealth: 8, kind: 'golden' }],
      ships: [ship('player', 300, 325, 'shoot', 'asteroid-1')],
    }))
    advanceUntil(game, () => game.scene().ores.length === 1, 5_000)
    expect(game.exportState().ores[0]?.worth).toBe(20)
    expect(game.exportState().ores[0]?.kind).toBe('golden')
  })

  it('spawns golden asteroids sooner as their rate goes up', () => {
    const setup = () => GameImpl.create(tuned({
      bank: { startingMoney: 51 },
      asteroids: { spawnMs: 999_999 },
      golden: { spawnMs: 1_000, max: 3 },
    }), 1)
    const slow = setup()
    expect(slow.upgradeMining('golden')).toBe('ok')
    slow.advance(500)
    expect(slow.exportState().asteroids.some(asteroid => asteroid.kind === 'golden')).toBe(false)
    const fast = setup()
    expect(fast.upgradeMining('golden')).toBe('ok')
    expect(fast.upgradeMining('goldenSpawnRate')).toBe('ok')
    expect(fast.scene().mining.values.goldenSpawnRate).toBe(2)
    fast.advance(500)
    expect(fast.exportState().asteroids.filter(asteroid => asteroid.kind === 'golden')).toHaveLength(1)
  })

  it('triples the rival fleet and makes those ships hotter and roomier', () => {
    const shooting = GameImpl.restore(tuned({
      ships: { speed: 100, shotSpeed: 0, weaponRange: 500, minerRange: 500, shotIntervalMs: 1000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 50,
      asteroids: [{ id: 'asteroid-1', x: 500, y: 325, health: 100, maxHealth: 100, kind: 'normal' }],
      ships: [
        ship('player', 450, 325, 'shoot', 'asteroid-1'),
        ship('rival', 450, 340, 'shoot', 'asteroid-1'),
      ],
    }))
    expect(shooting.upgradeMining('golden')).toBe('ok')
    expect(shooting.exportState().ships.filter(miner => miner.side === 'rival')).toHaveLength(1)
    expect(shooting.exportState().ships.filter(miner => miner.side === 'player')).toHaveLength(1)
    shooting.advance(50)
    const rivals = shooting.exportState().ships.filter(miner => miner.side === 'rival')
    expect(rivals.find(miner => miner.id === 'ship-2')?.fireCooldownMs).toBe(1950)
    expect(shooting.exportState().shots.find(shot => shot.side === 'rival')?.damage).toBe(2)

    const flying = GameImpl.restore(tuned({
      ships: { speed: 100, weaponRange: 30, minerRange: 30 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 50,
      asteroids: [{ id: 'asteroid-1', x: 800, y: 325, health: 40, maxHealth: 40, kind: 'normal' }],
      ships: [
        ship('player', 400, 325, 'engage', 'asteroid-1'),
        ship('rival', 400, 340, 'engage', 'asteroid-1'),
      ],
    }))
    expect(flying.upgradeMining('golden')).toBe('ok')
    flying.advance(1000)
    const moved = flying.exportState().ships
    expect(moved.find(miner => miner.side === 'player')?.x).toBeCloseTo(500, 0)
    expect(moved.find(miner => miner.id === 'ship-2')?.x).toBeCloseTo(550, 0)

    const hauling = GameImpl.restore(tuned({
      ships: { speed: 400 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 50,
      asteroids: [],
      ores: [
        { id: 'ore-1', x: 500, y: 325, vx: 0, vy: 0, worth: 1, kind: 'normal' },
        { id: 'ore-2', x: 530, y: 325, vx: 0, vy: 0, worth: 1, kind: 'normal' },
      ],
      ships: [ship('rival', 500, 325, 'collect', 'ore-1')],
    }))
    expect(hauling.upgradeMining('golden')).toBe('ok')
    advanceUntil(hauling, () => {
      const miner = hauling.exportState().ships.find(ship => ship.id === 'ship-2')
      return miner?.cargo === 2 && miner.mode === 'back'
    }, 10_000)
  })

  it('doubles rival cargo once player carry reaches 4', () => {
    const ores = [0, 1, 2, 3].map(index => ({
      id: `ore-${index + 1}`,
      x: 500 + index * 20,
      y: 325,
      vx: 0,
      vy: 0,
      worth: 1,
      kind: 'normal' as const,
    }))
    const haul = (carry: number, golden: boolean) => GameImpl.restore(tuned({
      ships: { speed: 400 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      minerLevels: { ...blankLevels(), carry },
      golden,
      asteroids: [],
      ores,
      ships: [ship('rival', 500, 325, 'collect', 'ore-1')],
    }))
    const early = haul(2, false)
    advanceUntil(early, () => early.exportState().ships[0]?.mode === 'back', 10_000)
    expect(early.exportState().ships[0]?.cargo).toBe(1)

    const ready = haul(3, false)
    advanceUntil(ready, () => {
      const miner = ready.exportState().ships[0]
      return miner?.cargo === 2 && miner.mode === 'back'
    }, 10_000)

    const stacked = haul(3, true)
    advanceUntil(stacked, () => {
      const miner = stacked.exportState().ships[0]
      return miner?.cargo === 4 && miner.mode === 'back'
    }, 10_000)
  })

  it('refuses golden asteroids when the money is short', () => {
    const game = GameImpl.create(tuned({ bank: { startingMoney: 49 } }), 1)
    expect(game.upgradeMining('golden')).toBe('broke')
    expect(game.exportState().golden).toBe(false)
    expect(game.exportState().money).toBe(49)
  })

  it('shortens the asteroid spawn interval as the rate goes up', () => {
    const game = GameImpl.create(tuned({
      bank: { startingMoney: 5 },
      asteroids: { spawnMs: 10_000 },
    }), 1)
    expect(game.scene().spawnInMs).toBe(10_000)
    expect(game.upgradeMining('spawnRate')).toBe('ok')
    expect(game.scene().mining.values.spawnRate).toBe(2)
    expect(game.scene().spawnInMs).toBe(5_000)
    expect(game.scene().mining.costs.spawnRate).toBe(2)
  })

  it('does not leave a miner idle while there is something to mine', () => {
    const shotIntervalMs = 1200
    const game = GameImpl.create(tuned({
      ships: { speed: 45, weaponRange: 45, minerRange: 45, shotIntervalMs },
      ore: { speed: 24 },
      asteroids: { health: 40, spawnMs: 60_000 },
    }), 7)
    const idleMs = new Map<string, number>()
    let previous = new Map(game.exportState().ships.map(ship => [ship.id, { x: ship.x, y: ship.y, health: 0 }]))
    for (let elapsed = 0; elapsed < 180_000; elapsed += 500) {
      game.advance(500)
      const state = game.exportState()
      for (const ship of state.ships) {
        const before = previous.get(ship.id)
        const moved = before !== undefined && Math.hypot(ship.x - before.x, ship.y - before.y) > 1
        const rock = state.asteroids.find(asteroid => asteroid.id === ship.targetId)
        const ore = state.ores.find(item => item.id === ship.targetId)
        const shooting = ship.mode === 'shoot' && rock !== undefined && before !== undefined && rock.health < before.health
        const working = moved || shooting || (ship.mode === 'wait' && state.asteroids.length === 0 && !ore)
        idleMs.set(ship.id, working ? 0 : (idleMs.get(ship.id) ?? 0) + 500)
        const gap = rock ? Math.hypot(rock.x - ship.x, rock.y - ship.y) : -1
        expect(
          idleMs.get(ship.id),
          `${ship.side} ${ship.mode} target=${ship.targetId} gap=${gap.toFixed(1)} xy=${ship.x.toFixed(1)},${ship.y.toFixed(1)} asteroids=${state.asteroids.length} ores=${state.ores.length}`,
        ).toBeLessThan(shotIntervalMs * 4 + 500)
      }
      previous = new Map(state.ships.map(ship => {
        const rock = state.asteroids.find(asteroid => asteroid.id === ship.targetId)
        return [ship.id, { x: ship.x, y: ship.y, health: rock?.health ?? 0 }]
      }))
    }
  })

  it('adds half a corvette speed step on each purchase', () => {
    const moved = (level: number) => {
      const game = GameImpl.restore(tuned({
        ships: { speed: 100, shotSpeed: 0 },
        asteroids: { spawnMs: 999_999 },
        cannon: { range: 0, wake: 0 },
      }), fresh({
        corvette: true,
        corvetteLevels: { ...blankCorvetteLevels(), speed: level },
        asteroids: [],
        ships: [{
          ...ship('rival', config.map.baseX + 800, config.map.baseY, 'attack', 'base'),
          id: 'corvette',
          role: 'corvette',
          health: 500,
          maxHealth: 500,
        }],
      }))
      const before = game.exportState().ships.find(body => body.id === 'corvette')?.x ?? 0
      game.advance(1_000)
      const after = game.exportState().ships.find(body => body.id === 'corvette')?.x ?? 0
      return before - after
    }
    const game = GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 5,
      crystals: 3,
      corvette: true,
      asteroids: [],
      ships: [],
    }))
    expect(game.scene().corvette.values.speed).toBe(1)
    expect(game.upgradeCorvette('speed')).toBe('ok')
    expect(game.scene().corvette.values.speed).toBe(1.5)
    expect(game.scene().money).toBe(5)
    expect(game.scene().crystals).toBe(2)
    expect(game.upgradeCorvette('speed')).toBe('ok')
    expect(game.scene().corvette.values.speed).toBe(2)
    expect(game.scene().money).toBe(5)
    expect(game.scene().crystals).toBe(0)
    expect(game.upgradeCorvette('speed')).toBe('maxed')
    const base = moved(0)
    expect(moved(1)).toBeCloseTo(base * 1.5, 0)
    expect(moved(2)).toBeCloseTo(base * 2, 0)
  })

  it('builds one corvette at a time, and a ship kill pays cash and a crystal', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      corvette: { spawnMs: 1_000 },
    }), fresh({
      money: 10,
      crystals: 1,
      tractorBeam: true,
      asteroids: [],
      ships: [
        ship('player', 400, 300, 'wait', null),
        ship('rival', 900, 300, 'wait', null),
      ],
    }))
    const corvettes = () => game.exportState().ships.filter(ship => ship.role === 'corvette')
    expect(game.scene().corvette.owned).toBe(false)
    expect(game.scene().crystals).toBe(1)
    expect(game.unlockCorvette()).toBe('ok')
    expect(corvettes()).toHaveLength(0)
    game.advance(1_000)
    expect(corvettes()).toHaveLength(1)
    expect(game.scene().ships.find(ship => ship.role === 'corvette')?.hull).toEqual(corvetteHull())
    expect(corvetteHull()).toHaveLength(19)
    expect(corvetteHull(true)).toHaveLength(23)
    const engines = corvetteHull().filter(cell => cell.color === '#fb923c')
    expect(engines.map(cell => cell.x).sort((a, b) => a - b)).toEqual([-1, 0, 1])
    expect(engines.every(cell => cell.y === 2)).toBe(true)
    expect(corvetteHull().filter(cell => cell.color !== '#fb923c').every(cell => Math.abs(cell.x) <= 1)).toBe(true)
    expect(corvetteHull().length).toBeGreaterThan(ShipDesign.minerHull(config).length)
    game.advance(5_000)
    expect(corvettes()).toHaveLength(1)
    expect(game.upgradeCorvette('capacity')).toBe('ok')
    expect(corvettes()).toHaveLength(1)
    game.advance(1_000)
    expect(corvettes()).toHaveLength(2)

    const killing = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0, wake: 0 },
      corvette: { bounty: 500, crystal: 1 },
    }), fresh({
      tractorBeam: true,
      corvette: true,
      asteroids: [],
      ships: [
        { ...ship('player', 500, 300, 'attack', 'ship-2'), role: 'fighter' },
        { ...ship('rival', 520, 300, 'wait', null), role: 'corvette', health: 1, maxHealth: 200 },
      ],
    }))
    killing.advance(50)
    expect(killing.exportState().ships.some(ship => ship.role === 'corvette')).toBe(false)
    expect(killing.scene().money).toBe(500)
    expect(killing.scene().crystals).toBe(1)

    const cannon = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000 },
      asteroids: { spawnMs: 999_999 },
      corvette: { bounty: 500, crystal: 1 },
    }), fresh({
      asteroids: [],
      ships: [
        { ...ship('rival', config.map.baseX + 40, config.map.baseY, 'wait', null), role: 'corvette', health: 1, maxHealth: 200 },
      ],
    }))
    cannon.advance(50)
    expect(cannon.exportState().ships.some(ship => ship.role === 'corvette')).toBe(false)
    expect(cannon.scene().money).toBe(0)
    expect(cannon.scene().crystals).toBe(0)
  })

  it('fires the corvette cannon from half again a fighter gun, and not from farther than that', () => {
    const duel = (gap: number) => GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 90, minerRange: 90, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0, wake: 0 },
      corvette: { shotMs: 1 },
    }), fresh({
      corvette: true,
      asteroids: [],
      ships: [
        { ...ship('player', 500, 300, 'wait', null), role: 'fighter', health: 500, maxHealth: 500 },
        { ...ship('rival', 500 + gap, 300, 'attack', 'ship-1'), role: 'corvette', health: 200, maxHealth: 200 },
      ],
    }))
    const close = duel(100)
    close.advance(50)
    expect(close.exportState().shots).toEqual([
      expect.objectContaining({ side: 'rival', splash: false, damage: config.corvetteUpgrades.damage.levels[0].value }),
    ])
    const far = duel(140)
    far.advance(50)
    expect(far.exportState().shots).toEqual([])
  })

  it('closes an extra 15% of cannon range after a corvette can already fire', () => {
    const range = Math.round(90 * config.corvette.rangeScale)
    const stop = Math.round(range * 0.85)
    const game = GameImpl.restore(tuned({
      ships: { speed: 400, shotSpeed: 0, weaponRange: 90, minerRange: 90, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0, wake: 0 },
      corvette: { shotMs: 60_000 },
    }), fresh({
      asteroids: [],
      ships: [
        { ...ship('player', 500, 300, 'wait', null), role: 'fighter', health: 500, maxHealth: 500 },
        { ...ship('rival', 500 + range - 5, 300, 'attack', 'ship-1'), role: 'corvette', health: 200, maxHealth: 200 },
      ],
    }))
    game.advance(50)
    const body = game.exportState().ships.find(miner => miner.role === 'corvette')
    expect(Math.hypot((body?.x ?? 0) - 500, (body?.y ?? 0) - 300)).toBeCloseTo(stop - 0.5, 0)
    expect(body?.x).toBeLessThan(500 + range - 5)
  })

  it('keeps a cannon shot flying after its target is destroyed until it leaves the map', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 100, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0, wake: 0 },
    }), fresh({
      asteroids: [],
      ships: [
        { ...ship('player', 100, 200, 'attack', 'ship-2'), role: 'fighter' },
        {
          ...ship('player', 480, 200, 'attack', 'ship-2'),
          id: 'laser',
          role: 'fighter',
          craft: {
            speed: 0,
            damage: 100,
            weapons: [{ kind: 'laser', range: 500, splash: false }],
            cooldown: { weapon: 0, laser: 0, missile: 0 },
            cells: [],
          },
        },
        ship('rival', 500, 200, 'wait', null),
      ],
      nextShipId: 4,
    }))
    game.advance(50)
    const shot = game.exportState().shots.find(item => item.shipId === 'ship-2')
    expect(game.exportState().ships.some(body => body.id === 'ship-2')).toBe(false)
    expect(shot?.x).toBeGreaterThan(100)
    expect(shot?.x).toBeLessThan(500)
    game.advance(4_500)
    const past = game.exportState().shots.find(item => item.shipId === 'ship-2')
    expect(past?.x).toBeGreaterThan(500)
    expect(past?.x).toBeLessThan(config.map.width)
    game.advance(5_000)
    expect(game.exportState().shots.filter(item => item.shipId === 'ship-2')).toHaveLength(0)
  })

  it('sends a missile to the closest opposing ship after its target is destroyed', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 100, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0, wake: 0 },
    }), fresh({
      asteroids: [],
      ships: [
        {
          ...ship('player', 100, 200, 'attack', 'ship-2'),
          role: 'fighter',
          craft: {
            speed: 0,
            damage: 10,
            weapons: [{ kind: 'missile', range: 500, splash: true }],
            cooldown: { weapon: 0, laser: 0, missile: 0 },
            cells: [],
          },
        },
        {
          ...ship('player', 480, 200, 'attack', 'ship-2'),
          id: 'laser',
          role: 'fighter',
          craft: {
            speed: 0,
            damage: 100,
            weapons: [{ kind: 'laser', range: 500, splash: false }],
            cooldown: { weapon: 0, laser: 0, missile: 0 },
            cells: [],
          },
        },
        { ...ship('player', 100, 250, 'wait', null), id: 'friend' },
        ship('rival', 500, 200, 'wait', null),
        { ...ship('rival', 100, 400, 'wait', null), id: 'other' },
      ],
      nextShipId: 6,
    }))
    game.advance(50)
    expect(game.exportState().ships.some(body => body.id === 'ship-2')).toBe(false)
    const missile = game.exportState().shots.find(shot => shot.splash)
    expect(missile?.shipId).toBe('other')
    expect(missile?.y).toBeGreaterThan(200)
    expect(missile?.y).toBeLessThan(210)
  })

  it('alternates corvette cannon shots from each side at the closest ship there', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 90, minerRange: 90, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0, wake: 0 },
      corvette: { shotMs: 1 },
    }), fresh({
      corvette: true,
      asteroids: [],
      ships: [
        { ...ship('player', 400, 240, 'wait', null), id: 'port', role: 'fighter', health: 500, maxHealth: 500 },
        { ...ship('player', 400, 370, 'wait', null), id: 'starboard', role: 'fighter', health: 500, maxHealth: 500 },
        { ...ship('player', 800, 300, 'wait', null), id: 'ahead', role: 'fighter', health: 500, maxHealth: 500 },
        {
          ...ship('rival', 400, 300, 'attack', 'ahead'),
          id: 'corvette',
          role: 'corvette',
          health: 200,
          maxHealth: 200,
          cannonSide: 0,
        },
      ],
      nextShipId: 6,
    }))
    game.advance(50)
    const first = game.exportState().shots
    expect(first).toHaveLength(1)
    expect(first[0]?.shipId).toBe('port')
    expect(first[0]?.y).toBeLessThan(300)
    expect(game.exportState().ships.find(body => body.id === 'corvette')?.cannonSide).toBe(1)
    game.advance(50)
    const second = game.exportState().shots.filter(shot => shot.shipId === 'starboard')
    expect(second).toHaveLength(1)
    expect(second[0]?.y).toBeGreaterThan(300)
    expect(game.exportState().shots.filter(shot => shot.shipId === 'ahead')).toHaveLength(0)
  })

  it('lets both corvette cannons fire at one ship when it is closest to both muzzles', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 90, minerRange: 90, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0, wake: 0 },
      corvette: { shotMs: 1 },
    }), fresh({
      corvette: true,
      asteroids: [],
      ships: [
        { ...ship('player', 400, 250, 'wait', null), id: 'near', role: 'fighter', health: 500, maxHealth: 500 },
        { ...ship('player', 400, 420, 'wait', null), id: 'far', role: 'fighter', health: 500, maxHealth: 500 },
        { ...ship('player', 800, 300, 'wait', null), id: 'ahead', role: 'fighter', health: 500, maxHealth: 500 },
        {
          ...ship('rival', 400, 300, 'attack', 'ahead'),
          id: 'corvette',
          role: 'corvette',
          health: 200,
          maxHealth: 200,
          cannonSide: 0,
        },
      ],
      nextShipId: 6,
    }))
    game.advance(50)
    const first = game.exportState().shots
    expect(first).toHaveLength(1)
    expect(first[0]?.shipId).toBe('near')
    expect(first[0]?.y).toBeLessThan(300)
    game.advance(50)
    const second = game.exportState().shots.filter(shot => shot.y > 300)
    expect(second).toHaveLength(1)
    expect(second[0]?.shipId).toBe('near')
  })

  it('waits twice as long to build an enemy fighter once a corvette is unlocked', () => {
    const opened = (corvette: boolean) => GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
      rival: { replenishMs: 1_000 },
    }), fresh({
      tractorBeam: true,
      corvette,
      rivalCap: 2,
      asteroids: [],
      ships: [ship('rival', 900, 300, 'wait', null)],
    }))
    const fighters = (game: GameImpl) => game.exportState().ships.filter(miner => miner.side === 'rival' && miner.role !== 'corvette')
    const plain = opened(false)
    plain.advance(1_000)
    expect(fighters(plain)).toHaveLength(2)
    const slowed = opened(true)
    slowed.advance(1_000)
    expect(fighters(slowed)).toHaveLength(1)
    slowed.advance(1_000)
    expect(fighters(slowed)).toHaveLength(2)
  })

  it('fits a missile on corvettes and doubles the crystals they pay', () => {
    const armed = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 90, minerRange: 90, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0, wake: 0 },
      corvette: { shotMs: 60_000, bounty: 500, crystal: 1 },
    }), fresh({
      money: 5,
      crystals: 1,
      tractorBeam: true,
      corvette: true,
      weaponLevels: { ...blankWeaponLevels(), missileDamage: 2 },
      asteroids: [],
      ships: [
        { ...ship('player', 500, 300, 'wait', null), role: 'fighter', health: 500, maxHealth: 500 },
        { ...ship('rival', 680, 300, 'attack', 'ship-1'), role: 'corvette', health: 200, maxHealth: 200 },
      ],
    }))
    armed.advance(50)
    expect(armed.exportState().shots).toHaveLength(0)
    expect(armed.scene().ships.find(ship => ship.role === 'corvette')?.hull).toEqual(corvetteHull())
    expect(armed.upgradeCorvette('missiles')).toBe('ok')
    const corvette = () => armed.exportState().ships.find(ship => ship.role === 'corvette')
    expect(corvette()?.missiles).toBe(true)
    expect(armed.scene().ships.find(ship => ship.role === 'corvette')?.hull).toEqual(corvetteHull(true))
    armed.advance(50)
    expect(armed.exportState().shots).toEqual([
      expect.objectContaining({
        side: 'rival',
        splash: true,
        damage: config.corvette.missileDamage,
      }),
    ])

    const built = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0 },
      asteroids: { spawnMs: 999_999 },
      corvette: { spawnMs: 1_000 },
    }), fresh({
      tractorBeam: true,
      corvette: true,
      corvetteLevels: { ...blankCorvetteLevels(), missiles: 1 },
      asteroids: [],
      ships: [
        ship('player', 400, 300, 'wait', null),
        ship('rival', 900, 300, 'wait', null),
      ],
    }))
    built.advance(1_000)
    const produced = built.exportState().ships.find(ship => ship.role === 'corvette')
    expect(produced?.missiles).toBe(true)
    expect(built.scene().ships.find(ship => ship.role === 'corvette')?.hull).toEqual(corvetteHull(true))

    const killing = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      cannon: { range: 0, wake: 0 },
      corvette: { bounty: 500, crystal: 1 },
    }), fresh({
      tractorBeam: true,
      corvette: true,
      corvetteLevels: { ...blankCorvetteLevels(), missiles: 1 },
      asteroids: [],
      ships: [
        { ...ship('player', 500, 300, 'attack', 'ship-2'), role: 'fighter' },
        { ...ship('rival', 520, 300, 'wait', null), role: 'corvette', health: 1, maxHealth: 200 },
      ],
    }))
    killing.advance(50)
    expect(killing.scene().money).toBe(500)
    expect(killing.scene().crystals).toBe(2)

    const cannon = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000 },
      asteroids: { spawnMs: 999_999 },
      corvette: { bounty: 500, crystal: 1 },
    }), fresh({
      corvette: true,
      corvetteLevels: { ...blankCorvetteLevels(), missiles: 1 },
      asteroids: [],
      ships: [
        { ...ship('rival', config.map.baseX + 40, config.map.baseY, 'wait', null), role: 'corvette', health: 1, maxHealth: 200 },
      ],
    }))
    cannon.advance(50)
    expect(cannon.scene().money).toBe(0)
    expect(cannon.scene().crystals).toBe(0)
  })

  it('builds one defense platform a minute and shoots at three cannon ranges', () => {
    const spot = platformAnchor(config)
    const far = { x: spot.x + config.cannon.range * 3 + 40, y: spot.y }
    const near = { x: spot.x + config.cannon.range + 80, y: spot.y }
    const locked = GameImpl.restore(tuned({ defense: { buildMs: 1_000 } }), fresh({
      asteroids: [],
      ships: [ship('rival', near.x, near.y, 'wait', null)],
      money: 20,
    }))
    expect(locked.upgradeDefense('capacity')).toBe('unknown')

    const game = GameImpl.restore(tuned({ defense: { buildMs: 1_000 } }), fresh({
      asteroids: [],
      ships: [ship('rival', near.x, near.y, 'wait', null)],
      money: 20,
      tractorBeam: true,
    }))
    expect(game.upgradeDefense('health')).toBe('unknown')
    expect(game.upgradeDefense('capacity')).toBe('ok')
    expect(game.upgradeDefense('capacity')).toBe('maxed')
    expect(game.upgradeDefense('health')).toBe('broke')
    expect(game.scene().money).toBe(19)
    expect(game.scene().crystals).toBe(0)
    const paid = GameImpl.restore(tuned(), fresh({
      money: 20,
      crystals: 1,
      tractorBeam: true,
      defenseLevels: { ...blankDefenseLevels(), capacity: 1 },
      asteroids: [],
      ships: [],
    }))
    expect(paid.upgradeDefense('damage')).toBe('ok')
    expect(paid.scene().money).toBe(20)
    expect(paid.scene().crystals).toBe(0)
    expect(paid.scene().defense.values.damage).toBe(180)
    expect(paid.upgradeDefense('attackRate')).toBe('broke')
    expect(game.scene().defense.range).toBe(config.cannon.range * 3)
    expect(game.scene().defense.values).toMatchObject({ capacity: 1, health: 2_000, attackRate: 1, damage: 120 })
    expect(game.scene().defense.building).toBe(0)
    const platform = game.exportState().ships.find(body => body.role === 'platform')
    expect(platform?.health).toBe(2_000)
    expect(platform?.maxHealth).toBe(2_000)
    expect(platform?.x).toBe(spot.x)
    expect(platform?.y).toBe(spot.y)
    expect(game.scene().ships.find(body => body.role === 'platform')?.hull).toBeNull()
    game.advance(1)
    const shot = game.exportState().shots.find(item => item.shipId === 'ship-2' && item.side === 'player')
    expect(shot?.damage).toBe(120)
    expect(shot?.heavy).toBe(true)
    expect(game.scene().shots.find(item => item.id === shot?.id)?.heavy).toBe(true)
    expect(game.exportState().ships.find(body => body.role === 'platform')?.fireCooldownMs).toBe(config.defense.shotMs - 1)
    expect(Math.hypot((shot?.x ?? 0) - spot.x, (shot?.y ?? 0) - spot.y)).toBeLessThan(1)

    const beyond = GameImpl.restore(tuned({ defense: { buildMs: 1_000 } }), fresh({
      asteroids: [],
      ships: [ship('rival', far.x, far.y, 'wait', null)],
      money: 20,
      tractorBeam: true,
      defenseLevels: { ...blankDefenseLevels(), capacity: 1 },
      defenseElapsedMs: 1_000,
    }))
    beyond.advance(50)
    expect(beyond.exportState().shots).toHaveLength(0)
    expect(beyond.exportState().ships.some(body => body.role === 'platform')).toBe(true)
  })

  it('drifts a defense platform to a third of the map and lets a ship sit on it', () => {
    const spot = platformAnchor(config)
    const stop = platformStop(config)
    expect(stop).toBe(config.map.width / 3 - 40)
    const crawling = GameImpl.restore(tuned({
      defense: { buildMs: 1_000, speed: 20 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [],
      ships: [],
      money: 5,
      tractorBeam: true,
      defenseLevels: { ...blankDefenseLevels(), capacity: 1 },
      defenseElapsedMs: 1_000,
    }))
    crawling.advance(1_000)
    const moving = crawling.exportState().ships.find(body => body.role === 'platform')
    expect(moving?.x).toBeCloseTo(spot.x + 20, 5)
    expect(moving?.y).toBe(spot.y)
    const left = stop - (moving?.x ?? spot.x)
    crawling.advance(Math.ceil(left / 20 * 1_000) + 50)
    expect(crawling.exportState().ships.find(body => body.role === 'platform')?.x).toBeCloseTo(stop, 5)
    crawling.advance(5_000)
    const parked = crawling.exportState().ships.find(body => body.role === 'platform')
    expect(parked?.x).toBeCloseTo(stop, 5)
    expect(parked?.y).toBe(spot.y)

    const sharing = GameImpl.restore(tuned({
      defense: { speed: 0 },
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [],
      ships: [
        ship('player', spot.x, spot.y, 'wait', null),
        {
          ...ship('player', spot.x, spot.y, 'wait', null),
          id: 'ship-9',
          role: 'platform',
          health: 2_000,
          maxHealth: 2_000,
        },
      ],
      nextShipId: 10,
    }))
    sharing.advance(1_000)
    const miner = sharing.exportState().ships.find(body => body.role === 'miner')
    expect(miner?.x).toBeCloseTo(spot.x, 5)
    expect(miner?.y).toBeCloseTo(spot.y, 5)
  })

  it('keeps building at capacity and releases a finished ship when one is destroyed', () => {
    const held = GameImpl.restore(tuned({
      defense: { buildMs: 1_000 },
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      tractorBeam: true,
      defenseLevels: { ...blankDefenseLevels(), capacity: 1 },
      defenseElapsedMs: 0,
      asteroids: [],
      ships: [{
        ...ship('player', 100, 100, 'wait', null),
        id: 'ship-9',
        role: 'platform',
        health: 2_000,
        maxHealth: 2_000,
      }],
      nextShipId: 10,
    }))
    held.advance(1_000)
    expect(held.exportState().ships.filter(body => body.role === 'platform')).toHaveLength(1)
    expect(held.exportState().platformReady).toBe(1)
    expect(held.scene().defense.building).toBe(1)
    held.advance(5_000)
    expect(held.exportState().ships.filter(body => body.role === 'platform')).toHaveLength(1)
    expect(held.exportState().platformReady).toBe(1)
    expect(held.scene().defense.building).toBe(1)

    const released = GameImpl.restore(tuned({
      defense: { buildMs: 60_000 },
      ships: { speed: 0, shotSpeed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      tractorBeam: true,
      defenseLevels: { ...blankDefenseLevels(), capacity: 1 },
      platformReady: 1,
      defenseElapsedMs: 0,
      asteroids: [],
      ships: [],
    }))
    released.advance(1)
    expect(released.exportState().ships.filter(body => body.role === 'platform')).toHaveLength(1)
    expect(released.exportState().platformReady).toBe(0)

    const fighters = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      fighterLevels: { ...blankFighterLevels(), count: 1 },
      fighterQueue: ['fighter'],
      bays: [{ design: 'fighter', pending: 0, work: 0, production: 0, capacity: 0 }],
      asteroids: [],
      ships: [
        { ...ship('player', 400, 300, 'wait', null), id: 'ship-4', role: 'fighter', health: 1, maxHealth: 1 },
        ship('rival', 450, 300, 'attack', 'ship-4'),
      ],
      nextShipId: 5,
    }))
    fighters.advance(50)
    const flying = fighters.exportState().ships.filter(body => body.role === 'fighter')
    expect(flying).toHaveLength(1)
    expect(flying[0]?.id).not.toBe('ship-4')
    expect(fighters.exportState().fighterQueue).toEqual([])

    const miners = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, minerRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      minerReady: 1,
      asteroids: [],
      ships: [
        { ...ship('player', 400, 300, 'wait', null), health: 1, maxHealth: 1 },
        ship('rival', 450, 300, 'attack', 'ship-1'),
      ],
    }))
    miners.advance(50)
    expect(miners.exportState().ships.filter(body => body.side === 'player' && body.role === 'miner')).toHaveLength(1)
    expect(miners.exportState().minerReady).toBe(0)

    const holdingFighter = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      fighterLevels: { ...blankFighterLevels(), count: 1 },
      bays: [{ design: 'fighter', pending: 0, work: 0, production: 0, capacity: 0 }],
      asteroids: [],
      ships: [{ ...ship('player', 100, 100, 'wait', null), role: 'fighter' }],
    }))
    holdingFighter.advance(200_000)
    expect(holdingFighter.exportState().ships.filter(body => body.role === 'fighter')).toHaveLength(1)
    expect(holdingFighter.exportState().fighterQueue).toHaveLength(1)
    expect(holdingFighter.scene().nextFighter?.progress).toBe(1)

    const holdingMiner = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      asteroids: [],
      ships: [ship('player', 100, 100, 'wait', null)],
    }))
    holdingMiner.advance(300_000)
    expect(holdingMiner.exportState().ships.filter(body => body.side === 'player' && body.role === 'miner')).toHaveLength(1)
    expect(holdingMiner.exportState().minerReady).toBe(1)
    expect(holdingMiner.scene().nextMiner?.progress).toBe(1)
  })
})

function fresh(partial: Pick<MapState, 'asteroids' | 'ships'> & Partial<MapState>): MapState {
  return {
    money: 0,
    crystals: 0,
    spawnAccumulatorMs: 0,
    rngState: 1,
    nextAsteroidId: 2,
    nextShipId: 3,
    nextOreId: 2,
    nextShotId: 1,
    ores: [],
    shots: [],
    minerLevels: blankLevels(),
    weaponLevels: blankWeaponLevels(),
    miningLevels: blankMiningLevels(),
    fighterLevels: blankFighterLevels(),
    enemyLevels: blankEnemyLevels(),
    corvetteLevels: blankCorvetteLevels(),
    corvette: false,
    corvetteElapsedMs: 0,
    defenseLevels: blankDefenseLevels(),
    defenseElapsedMs: 0,
    tractorBeam: false,
    golden: false,
    miningUnlocked: false,
    automine: false,
    automineElapsedMs: 0,
    moneyConverter: false,
    missileCorvetteKilled: false,
    shipDesigner: false,
    laser: false,
    missile: false,
    mediumEngine: false,
    largeEngine: false,
    parts: [],
    nextPartId: 1,
    savedDesign: null,
    designs: [],
    bays: [{ design: 'fighter', pending: 0, work: 0, production: 0, capacity: 0 }],
    goldenSpawnAccumulatorMs: 0,
    pendingMiners: 0,
    minerWork: 0,
    minerReady: 0,
    fighterQueue: [],
    platformReady: 0,
    rivalCap: 1,
    rivalElapsedMs: 0,
    fleetAnswered: false,
    gift: 10,
    crystalGift: 10,
    baseCombat: false,
    rivalCombat: false,
    ...partial,
  }
}

function ship(
  side: 'player' | 'rival',
  x: number,
  y: number,
  mode: MapState['ships'][number]['mode'],
  targetId: string | null,
): MapState['ships'][number] {
  return {
    id: side === 'player' ? 'ship-1' : 'ship-2',
    x,
    y,
    cargo: 0,
    cargoValue: 0,
    mode,
    targetId,
    fireCooldownMs: 0,
    missiles: false,
    missileCooldownMs: 0,
    cannonSide: 0,
    bay: null,
    side,
    role: 'miner',
    health: 20,
    maxHealth: 20,
    craft: null,
  }
}

function advanceUntil(game: GameImpl, done: () => boolean, capMs: number): void {
  let waited = 0
  while (!done() && waited < capMs) {
    game.advance(50)
    waited += 50
  }
  expect(done()).toBe(true)
}
