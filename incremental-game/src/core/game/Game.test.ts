import { describe, expect, it } from 'vitest'
import { blankEnemyLevels } from '../../data/enemy/upgrades'
import { blankFighterLevels } from '../../data/fighter/upgrades'
import { blankMiningLevels } from '../../data/mining'
import { blankLevels } from '../../data/upgrades'
import { GameImpl, type MapState } from './Game'
import { config, tuned } from './fixture'

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

  it('shoots the asteroid apart, then hauls the ore it drops', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 400, shotSpeed: 700, weaponRange: 120, shotIntervalMs: 150 },
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
      ships: { speed: 0, shotSpeed: 2000, weaponRange: 400, shotIntervalMs: 10_000 },
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
      ships: { speed: 400, shotSpeed: 700, weaponRange: 120, shotIntervalMs: 100 },
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
        side: 'rival',
        role: 'miner',
        health: 20,
        maxHealth: 20,
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

  it('raises only the player miner damage', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      upgrades: {
        ...config.upgrades,
        damage: { start: 8, step: 4, max: 100, cost: 1 },
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
    expect(shots.find(shot => shot.side === 'rival')?.damage).toBe(config.enemyUpgrades.damage.start)
    expect(game.scene().miner.values.damage).toBe(12)
  })

  it('moves only the player miner faster', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 100, weaponRange: 30 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 10,
      asteroids: [{ id: 'asteroid-1', x: 800, y: 325, health: 40, maxHealth: 40, kind: 'normal' }],
      ships: [
        ship('player', 100, 325, 'engage', 'asteroid-1'),
        ship('rival', 100, 340, 'engage', 'asteroid-1'),
      ],
    }))
    expect(game.scene().miner.values.speed).toBe(10)
    game.upgradeMiner('speed')
    expect(game.scene().miner.values.speed).toBe(12)
    game.advance(1000)
    const ships = game.exportState().ships
    expect(ships.find(miner => miner.side === 'player')?.x).toBeCloseTo(220, 0)
    expect(ships.find(miner => miner.side === 'rival')?.x).toBeCloseTo(250, 0)
  })

  it('fires only the player miner faster', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 0, weaponRange: 500, shotIntervalMs: 1000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 10,
      asteroids: [{ id: 'asteroid-1', x: 500, y: 325, health: 100, maxHealth: 100, kind: 'normal' }],
      ships: [
        ship('player', 300, 325, 'shoot', 'asteroid-1'),
        ship('rival', 300, 340, 'shoot', 'asteroid-1'),
      ],
    }))
    game.upgradeMiner('fireRate')
    game.advance(50)
    const ships = game.exportState().ships
    expect(ships.find(miner => miner.side === 'player')?.fireCooldownMs).toBe(450)
    expect(ships.find(miner => miner.side === 'rival')?.fireCooldownMs).toBe(950)
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
    expect(game.upgradeMiner('count')).toBe('ok')
    expect(game.upgradeMiner('count')).toBe('ok')
    const players = () => game.exportState().ships.filter(miner => miner.side === 'player')
    expect(players()).toHaveLength(1)
    expect(game.scene().miner.values.count).toBe(1)
    expect(game.scene().miner.costs.count).toBe(20)
    expect(game.scene().nextMiner?.progress).toBe(0)
    expect(game.scene().money).toBe(0)
    game.advance(30_000)
    expect(game.scene().nextMiner?.progress).toBeCloseTo(0.5, 5)
    expect(players()).toHaveLength(1)
    game.advance(30_000)
    expect(players()).toHaveLength(2)
    expect(game.scene().miner.values.count).toBe(2)
    expect(game.scene().nextMiner?.progress).toBe(0)
    expect(game.exportState().ships.filter(miner => miner.side === 'rival')).toHaveLength(1)
    game.advance(60_000)
    expect(players()).toHaveLength(3)
    expect(game.scene().nextMiner).toBeNull()
    expect(game.exportState().ships.filter(miner => miner.side === 'rival')).toHaveLength(2)
  })

  it('fills each build bar from its own production rate', () => {
    const placed = () => GameImpl.restore(tuned({
      ships: { speed: 0 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 1,
      pendingMiners: 1,
      pendingFighters: 1,
      asteroids: [],
      ships: [],
    }))
    const slow = placed()
    slow.advance(30_000)
    expect(slow.scene().nextMiner?.progress).toBeCloseTo(0.5, 5)
    expect(slow.scene().nextFighter?.progress).toBeCloseTo(0.5, 5)
    expect(slow.exportState().ships).toHaveLength(0)

    const miners = placed()
    expect(miners.upgradeMiner('production')).toBe('ok')
    expect(miners.scene().miner.values.production).toBe(2)
    miners.advance(15_000)
    expect(miners.scene().nextMiner?.progress).toBeCloseTo(0.5, 5)
    expect(miners.scene().nextFighter?.progress).toBeCloseTo(0.25, 5)

    const fighters = placed()
    expect(fighters.upgradeFighterStat('production')).toBe('ok')
    expect(fighters.scene().money).toBe(0)
    expect(fighters.scene().fighter.values.production).toBe(2)
    expect(fighters.scene().fighter.costs.production).toBe(2)
    fighters.advance(15_000)
    expect(fighters.scene().nextFighter?.progress).toBeCloseTo(0.5, 5)
    expect(fighters.scene().nextMiner?.progress).toBeCloseTo(0.25, 5)
    fighters.advance(15_000)
    expect(fighters.exportState().pendingFighters).toBe(0)
    expect(fighters.exportState().pendingMiners).toBe(1)
    expect(fighters.upgradeFighterStat('production')).toBe('broke')
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
    expect(rivals(fourth)).toHaveLength(2)
    fourth.advance(60_000)
    expect(players(fourth)).toHaveLength(4)
    expect(rivals(fourth)).toHaveLength(2)

    const goldenFirst = GameImpl.create(tuned({ ships: { speed: 0 }, bank: { startingMoney: 65 } }), 1)
    expect(goldenFirst.upgradeMining('golden')).toBe('ok')
    expect(rivals(goldenFirst)).toHaveLength(3)
    expect(goldenFirst.upgradeMiner('count')).toBe('ok')
    expect(goldenFirst.upgradeMiner('count')).toBe('ok')
    goldenFirst.advance(120_000)
    expect(players(goldenFirst)).toHaveLength(3)
    expect(rivals(goldenFirst)).toHaveLength(6)

    const shipsFirst = GameImpl.create(tuned({ ships: { speed: 0 }, bank: { startingMoney: 65 } }), 1)
    expect(shipsFirst.upgradeMiner('count')).toBe('ok')
    expect(shipsFirst.upgradeMiner('count')).toBe('ok')
    shipsFirst.advance(120_000)
    expect(rivals(shipsFirst)).toHaveLength(2)
    expect(shipsFirst.upgradeMining('golden')).toBe('ok')
    expect(rivals(shipsFirst)).toHaveLength(6)
  })

  it('makes rival ships half again as fast once the player speed reaches 8', () => {
    const flown = (speedLevel: number) => {
      const game = GameImpl.restore(tuned({
        ships: { speed: 100, weaponRange: 30 },
        asteroids: { spawnMs: 999_999 },
        upgrades: {
          ...config.upgrades,
          speed: { start: 1, step: 1, max: 10, cost: 1 },
        },
      }), fresh({
        minerLevels: { ...blankLevels(), speed: speedLevel },
        asteroids: [{ id: 'asteroid-1', x: 900, y: 325, health: 40, maxHealth: 40, kind: 'normal' }],
        ships: [
          ship('player', 100, 325, 'engage', 'asteroid-1'),
          ship('rival', 100, 340, 'engage', 'asteroid-1'),
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
        damage: { start: 1, step: 1, max: 3, cost: 1 },
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
      ships: { speed: 0, shotSpeed: 2000, weaponRange: 500, shotIntervalMs: 10_000 },
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
      ships: { speed: 0, shotSpeed: 2000, weaponRange: 500, shotIntervalMs: 10_000 },
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
      ships: { speed: 200, shotIntervalMs: 10_000, weaponRange: 30 },
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
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, shotIntervalMs: 10_000 },
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
    expect(game.exportState().ships.find(miner => miner.id === 'ship-1')?.health).toBe(12)
  })

  it('removes our ship when its health is gone and pays nothing', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, shotIntervalMs: 10_000 },
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
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      fighter: { cost: 0, units: 1, bounty: 100 },
    }), fresh({
      money: 1,
      tractorBeam: true,
      asteroids: [],
      ships: [
        ship('player', 200, 300, 'wait', null),
        { ...ship('rival', 200, 325, 'wait', null), health: 1, maxHealth: 1 },
      ],
    }))
    expect(game.scene().fighter.values.count).toBe(0)
    expect(game.upgradeFighterStat('count')).toBe('ok')
    expect(game.exportState().money).toBe(0)
    expect(game.exportState().pendingFighters).toBe(1)
    expect(game.scene().nextFighter?.progress).toBe(0)
    expect(game.scene().fighter.values.count).toBe(1)
    game.advance(950)
    expect(game.exportState().ships.filter(miner => miner.role === 'fighter')).toHaveLength(0)
    expect(game.scene().nextFighter?.progress).toBeCloseTo(0.95)
    game.advance(50)
    const fighter = game.exportState().ships.find(miner => miner.role === 'fighter')
    expect(fighter?.side).toBe('player')
    expect(fighter?.health).toBe(20)
    expect(fighter?.targetId).toBe('ship-2')
    expect(game.scene().nextFighter).toBeNull()
    expect(game.scene().miner.values.count).toBe(1)
    game.advance(50)
    expect(game.exportState().ships.filter(miner => miner.side === 'rival')).toHaveLength(0)
    expect(game.scene().money).toBe(100)
  })

  it('replaces destroyed rival miners at their base once a minute, up to the fleet cap', () => {
    const game = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, shotIntervalMs: 10_000 },
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
      ships: { speed: 100, weaponRange: 30 },
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
      ships: { speed: 0, shotSpeed: 0, weaponRange: 40, shotIntervalMs: 1000 },
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
    launching.advance(1000)
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
      money: 3,
      tractorBeam: true,
      asteroids: [],
      ships: [],
    }))
    expect(game.scene().fighter.values.count).toBe(0)
    expect(game.upgradeFighterStat('count')).toBe('ok')
    expect(game.scene().money).toBe(2)
    expect(game.scene().fighter.values.count).toBe(1)
    expect(game.exportState().pendingFighters).toBe(1)
    expect(game.upgradeFighterStat('count')).toBe('ok')
    expect(game.scene().money).toBe(0)
    expect(game.scene().fighter.values.count).toBe(2)
    expect(game.scene().fighter.costs.count).toBe(4)
    expect(game.exportState().pendingFighters).toBe(2)
    game.advance(1000)
    expect(game.exportState().ships.filter(miner => miner.role === 'fighter')).toHaveLength(1)
    expect(game.exportState().pendingFighters).toBe(1)
    game.advance(1000)
    expect(game.exportState().ships.filter(miner => miner.role === 'fighter')).toHaveLength(2)
    expect(game.upgradeFighterStat('count')).toBe('broke')

    const replaced = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, shotIntervalMs: 10_000 },
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
    expect(replaced.exportState().pendingFighters).toBe(1)
  })

  it('replaces a destroyed rival sooner after the enemy spawn rate is bought', () => {
    const placed = () => GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, shotIntervalMs: 10_000 },
      asteroids: { spawnMs: 999_999 },
      rival: { replenishMs: 1000 },
    }), fresh({
      money: 1,
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
    expect(rivals(opened)).toHaveLength(10)
    expect(opened.scene().enemy.costs.capacity).toBe(2)
    expect(opened.upgradeEnemy('capacity')).toBe('ok')
    expect(opened.scene().money).toBe(0)
    expect(opened.scene().enemy.values.capacity).toBe(15)
    expect(opened.exportState().rivalCap).toBe(15)
    expect(rivals(opened)).toHaveLength(15)
    expect(opened.upgradeEnemy('capacity')).toBe('broke')

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
    expect(rivals(doubled)).toHaveLength(9)
  })

  it('compounds destroyed-ship bounty by 1.3 for each capacity buy, and not for spawn rate', () => {
    const placed = (levels: { capacity?: number; spawnRate?: number }) => GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, shotIntervalMs: 10_000 },
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
      ships: { speed: 0, shotSpeed: 0, weaponRange: 500, shotIntervalMs: 1000 },
      asteroids: { spawnMs: 999_999 },
      fighter: { bounty: 100 },
      enemyUpgrades: {
        ...config.enemyUpgrades,
        damage: { start: 1, step: 1, max: 10, cost: 1, bounty: 1.3 },
      },
    }), fresh({
      money: 7,
      tractorBeam: true,
      asteroids: [{ id: 'asteroid-1', x: 500, y: 325, health: 100, maxHealth: 100, kind: 'normal' }],
      ships: [
        ship('player', 300, 325, 'shoot', 'asteroid-1'),
        { ...ship('rival', 300, 340, 'shoot', 'asteroid-1'), health: 12, maxHealth: 20 },
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
    expect(game.exportState().shots.find(shot => shot.side === 'rival')?.damage).toBe(2)
    expect(rival()?.fireCooldownMs).toBe(450)

    const killing = GameImpl.restore(tuned({
      ships: { speed: 0, shotSpeed: 5000, weaponRange: 500, shotIntervalMs: 10_000 },
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

  it('pays a doubling gift from the sidebar button', () => {
    const game = GameImpl.create(tuned({ ships: { speed: 0 } }), 1)
    expect(game.scene().gift).toBe(10)
    game.claimGift()
    expect(game.scene().money).toBe(10)
    expect(game.scene().gift).toBe(20)
    game.claimGift()
    expect(game.scene().money).toBe(30)
    expect(game.scene().gift).toBe(40)
    const loaded = GameImpl.restore(tuned({ ships: { speed: 0 } }), game.exportState())
    expect(loaded.scene().money).toBe(30)
    expect(loaded.scene().gift).toBe(40)
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
      ships: { speed: 0, shotSpeed: 2000, weaponRange: 500, shotIntervalMs: 10_000 },
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
      ships: { speed: 100, shotSpeed: 0, weaponRange: 500, shotIntervalMs: 1000 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 50,
      asteroids: [{ id: 'asteroid-1', x: 500, y: 325, health: 100, maxHealth: 100, kind: 'normal' }],
      ships: [
        ship('player', 300, 325, 'shoot', 'asteroid-1'),
        ship('rival', 300, 340, 'shoot', 'asteroid-1'),
      ],
    }))
    expect(shooting.upgradeMining('golden')).toBe('ok')
    expect(shooting.exportState().ships.filter(miner => miner.side === 'rival')).toHaveLength(3)
    expect(shooting.exportState().ships.filter(miner => miner.side === 'player')).toHaveLength(1)
    shooting.advance(50)
    const rivals = shooting.exportState().ships.filter(miner => miner.side === 'rival')
    expect(rivals.find(miner => miner.id === 'ship-2')?.fireCooldownMs).toBe(450)
    expect(shooting.exportState().shots.find(shot => shot.side === 'rival')?.damage).toBe(2)

    const flying = GameImpl.restore(tuned({
      ships: { speed: 100, weaponRange: 30 },
      asteroids: { spawnMs: 999_999 },
    }), fresh({
      money: 50,
      asteroids: [{ id: 'asteroid-1', x: 800, y: 325, health: 40, maxHealth: 40, kind: 'normal' }],
      ships: [
        ship('player', 100, 325, 'engage', 'asteroid-1'),
        ship('rival', 100, 340, 'engage', 'asteroid-1'),
      ],
    }))
    expect(flying.upgradeMining('golden')).toBe('ok')
    flying.advance(1000)
    const moved = flying.exportState().ships
    expect(moved.find(miner => miner.side === 'player')?.x).toBeCloseTo(200, 0)
    expect(moved.find(miner => miner.id === 'ship-2')?.x).toBeCloseTo(250, 0)

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
    const game = GameImpl.create(tuned({
      ships: { speed: 45, weaponRange: 45, shotIntervalMs: 1200 },
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
        ).toBeLessThan(4000)
      }
      previous = new Map(state.ships.map(ship => {
        const rock = state.asteroids.find(asteroid => asteroid.id === ship.targetId)
        return [ship.id, { x: ship.x, y: ship.y, health: rock?.health ?? 0 }]
      }))
    }
  })
})

function fresh(partial: Pick<MapState, 'asteroids' | 'ships'> & Partial<MapState>): MapState {
  return {
    money: 0,
    spawnAccumulatorMs: 0,
    rngState: 1,
    nextAsteroidId: 2,
    nextShipId: 3,
    nextOreId: 2,
    nextShotId: 1,
    ores: [],
    shots: [],
    minerLevels: blankLevels(),
    miningLevels: blankMiningLevels(),
    fighterLevels: blankFighterLevels(),
    enemyLevels: blankEnemyLevels(),
    tractorBeam: false,
    golden: false,
    miningUnlocked: false,
    goldenSpawnAccumulatorMs: 0,
    pendingMiners: 0,
    minerWork: 0,
    pendingFighters: 0,
    fighterWork: 0,
    rivalCap: 1,
    rivalElapsedMs: 0,
    fleetAnswered: false,
    gift: 10,
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
    side,
    role: 'miner',
    health: 20,
    maxHealth: 20,
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
