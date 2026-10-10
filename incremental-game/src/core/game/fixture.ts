import type { GameConfig } from '../../data/GameConfig'

export const config: GameConfig = {
  map: {
    width: 1000,
    height: 650,
    baseX: 72,
    baseY: 325,
    baseRadius: 34,
    rivalBaseX: 928,
    rivalBaseY: 325,
    fieldX0: 400,
    fieldY0: 70,
    fieldX1: 640,
    fieldY1: 580,
    cell: 8,
  },
  asteroids: { spawnMs: 60_000, max: 10, health: 40, healthScale: 2, size: 18, sizeStep: 2 },
  golden: {
    health: 4,
    value: 20,
    size: 10,
    spawnMs: 60_000,
    max: 3,
    rivalShips: 3,
    rivalFire: 2,
    rivalDamage: 2,
    rivalCarry: 2,
  },
  ships: { speed: 90, shotIntervalMs: 400, weaponRange: 150, shotSpeed: 280, units: 60, radius: 8, health: 20 },
  fighter: { cost: 0, units: 60, bounty: 100 },
  fighterUpgrades: {
    speed: { start: 10, step: 2, max: 30, cost: 1 },
    attackRate: { start: 1, step: 1, max: 5, cost: 1 },
    health: { start: 20, step: 10, max: 60, cost: 1 },
    damage: { start: 1, step: 1, max: 10, cost: 1 },
    count: { start: 0, step: 1, max: 5, cost: 1 },
    production: { start: 1, step: 1, max: 8, cost: 1 },
  },
  enemyUpgrades: {
    spawnRate: { start: 1, step: 1, max: 128, cost: 1, bounty: 1 },
    capacity: { start: 10, step: 5, max: 30, cost: 1, bounty: 1.3 },
    health: { start: 20, step: 10, max: 60, cost: 1, bounty: 1.3 },
    damage: { start: 8, step: 1, max: 16, cost: 1, bounty: 1.3 },
    attackRate: { start: 1, step: 1, max: 5, cost: 1, bounty: 1.3 },
  },
  rival: { shipsAt: 3, shipsBy: 2, speedAt: 8, speedBy: 1.5, carryAt: 4, carryBy: 2, replenishMs: 60_000 },
  ore: { value: 1, speed: 0 },
  cannon: { range: 300, rate: 9, damage: 1000, shotSpeed: 20000 },
  bank: { startingMoney: 0, gift: 10_000 },
  upgrades: {
    speed: { start: 10, step: 2, max: 100, cost: 1 },
    damage: { start: 8, step: 1, max: 100, cost: 1 },
    fireRate: { start: 1, step: 1, max: 20, cost: 1 },
    carry: { start: 1, step: 1, max: 20, cost: 1 },
    count: { start: 1, step: 1, max: 20, cost: 5 },
    production: { start: 1, step: 1, max: 8, cost: 1 },
  },
  mining: {
    size: { start: 1, step: 1, max: 3, cost: 1 },
    spawnRate: { start: 1, step: 1, max: 5, cost: 1 },
    goldenSpawnRate: { start: 1, step: 1, max: 5, cost: 1 },
    golden: { cost: 50 },
    tractorBeam: { cost: 500 },
    unlock: { cost: 10 },
    automine: { cost: 10_000, perSecond: 200 },
  },
  designer: {
    cost: 2_000,
    half: 4,
    core: { mounts: ['n', 'e', 's', 'w'] },
    components: {
      structural: {
        label: 'Structural',
        color: '#94a3b8',
        cells: [{ x: 0, y: 0 }],
        mounts: [
          { x: 0, y: 0, side: 'n' },
          { x: 0, y: 0, side: 'e' },
          { x: 0, y: 0, side: 's' },
          { x: 0, y: 0, side: 'w' },
        ],
      },
      weapon: {
        label: 'Weapon',
        color: '#f87171',
        cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        mounts: [{ x: 0, y: 0, side: 'w' }],
      },
      thruster: {
        label: 'Thruster',
        color: '#fb923c',
        cells: [{ x: 0, y: 0 }],
        mounts: [{ x: 0, y: 0, side: 'n' }],
      },
      energy: {
        label: 'Energy',
        color: '#facc15',
        cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
        mounts: [
          { x: 0, y: 0, side: 'w' },
          { x: 0, y: 1, side: 'w' },
        ],
      },
    },
  },
}

export function tuned(over: {
  asteroids?: Partial<GameConfig['asteroids']>
  golden?: Partial<GameConfig['golden']>
  ships?: Partial<GameConfig['ships']>
  fighter?: Partial<GameConfig['fighter']>
  rival?: Partial<GameConfig['rival']>
  ore?: Partial<GameConfig['ore']>
  cannon?: Partial<GameConfig['cannon']>
  bank?: Partial<GameConfig['bank']>
  upgrades?: GameConfig['upgrades']
  mining?: GameConfig['mining']
  enemyUpgrades?: GameConfig['enemyUpgrades']
} = {}): GameConfig {
  return {
    map: config.map,
    asteroids: { ...config.asteroids, ...over.asteroids },
    golden: { ...config.golden, ...over.golden },
    ships: { ...config.ships, ...over.ships },
    fighter: { ...config.fighter, ...over.fighter },
    fighterUpgrades: config.fighterUpgrades,
    enemyUpgrades: over.enemyUpgrades ?? config.enemyUpgrades,
    rival: { ...config.rival, ...over.rival },
    ore: { ...config.ore, ...over.ore },
    cannon: { ...config.cannon, ...over.cannon },
    bank: { ...config.bank, ...over.bank },
    upgrades: over.upgrades ?? config.upgrades,
    mining: over.mining ?? config.mining,
    designer: config.designer,
  }
}
