import type { GameConfig } from '../../data/GameConfig'
import type { MiningPurchase } from '../../data/mining'
import { breakAsteroid } from '../asteroid/break'
import { AsteroidField } from '../asteroid/AsteroidField'
import { Bank } from '../base/Bank'
import { Clock } from '../game/Clock'
import { Rng } from '../game/rng'
import type { MapScene, MapState } from '../game/state'
import { EnemyUpgrades } from '../enemy/Upgrades'
import { FighterUpgrades } from '../fighter/Upgrades'
import { MiningUpgrades } from '../mining/Mining'
import type { EnemyUpgradeId } from '../../data/enemy/upgrades'
import type { FighterUpgradeId } from '../../data/fighter/upgrades'
import { Miners, MinerUpgrades, type MinerUpgradeId, type MinerWorld, type UpgradeResult } from '../miner'
import { OreField } from '../ore/OreField'
import { Volley } from '../shot/Shot'
import { MapLayout } from './Layout'
import { SpawnClock } from './SpawnClock'

/** The live map: bases, rocks, ore, shots, and miners. Game only calls this. */
export class MapSim {
  private readonly config: GameConfig
  private readonly rng: Rng
  private readonly clock = new Clock()
  private readonly layout: MapLayout
  private readonly bank: Bank
  private readonly asteroids: AsteroidField
  private readonly ore: OreField
  private readonly shots: Volley
  private readonly upgrades: MinerUpgrades
  private readonly fighterUpgrades: FighterUpgrades
  private readonly enemyUpgrades: EnemyUpgrades
  private readonly mining: MiningUpgrades
  private readonly miners: Miners
  private readonly spawns: SpawnClock
  private readonly goldenSpawns: SpawnClock
  private pendingMiners: number
  private minerWork: number
  private pendingFighters: number
  private fighterWork: number
  /** True once the player fleet has reached the size that doubles the rival fleet. */
  private fleetAnswered: boolean
  /** Rival miners allowed on the field. Losses refill up to this, one at a time. */
  private rivalCap: number
  private rivalElapsedMs: number
  /** Next payout of the sidebar gift. Doubles after each claim. */
  private gift: number
  private readonly world: MinerWorld

  private constructor(config: GameConfig, rng: Rng, state: MapState | null) {
    this.config = config
    this.rng = rng
    this.layout = new MapLayout(config.map)
    this.bank = state ? Bank.restore(state.money) : Bank.start(config.bank.startingMoney)
    this.asteroids = state
      ? AsteroidField.restore(state.asteroids, state.nextAsteroidId)
      : AsteroidField.empty()
    this.ore = state ? OreField.restore(state.ores, state.nextOreId) : OreField.empty()
    this.shots = state ? Volley.restore(state.shots, state.nextShotId) : Volley.empty()
    this.miners = state ? Miners.restore(state.ships, state.nextShipId) : Miners.empty()
    this.upgrades = state ? MinerUpgrades.restore(state.minerLevels) : MinerUpgrades.create()
    this.fighterUpgrades = state ? FighterUpgrades.restore(state.fighterLevels) : FighterUpgrades.create()
    this.enemyUpgrades = state ? EnemyUpgrades.restore(state.enemyLevels) : EnemyUpgrades.create()
    this.mining = state
      ? MiningUpgrades.restore(state.miningLevels, state.tractorBeam, state.golden, state.miningUnlocked)
      : MiningUpgrades.create()
    this.spawns = state ? SpawnClock.restore(state.spawnAccumulatorMs) : SpawnClock.start()
    this.goldenSpawns = state ? SpawnClock.restore(state.goldenSpawnAccumulatorMs) : SpawnClock.start()
    this.pendingMiners = state?.pendingMiners ?? 0
    this.minerWork = state?.minerWork ?? 0
    this.pendingFighters = state?.pendingFighters ?? 0
    this.fighterWork = state?.fighterWork ?? 0
    this.fleetAnswered = state?.fleetAnswered ?? false
    this.rivalCap = state?.rivalCap ?? 1
    this.rivalElapsedMs = state?.rivalElapsedMs ?? 0
    this.gift = state?.gift ?? config.bank.gift
    this.world = {
      config,
      layout: this.layout,
      asteroids: this.asteroids,
      ore: this.ore,
      shots: this.shots,
      upgrades: this.upgrades,
      fighterUpgrades: this.fighterUpgrades,
      enemyUpgrades: this.enemyUpgrades,
      mining: this.mining,
      bank: this.bank,
    }
  }

  /** The field starts full. Each base has one miner. */
  static open(config: GameConfig, rng: Rng): MapSim {
    const map = new MapSim(config, rng, null)
    while (map.asteroids.length < config.asteroids.max) {
      map.asteroids.spawn(config, () => map.rng.next(), map.mining.rockHealth(config, 'normal'))
    }
    map.miners.spawn('player', map.world)
    map.miners.spawn('rival', map.world)
    map.reinforceRival()
    return map
  }

  static restore(config: GameConfig, rng: Rng, state: MapState): MapSim {
    return new MapSim(config, rng, state)
  }

  claimGift(): void {
    this.bank.deposit(this.gift)
    this.gift *= 2
  }

  upgradeEnemy(upgrade: EnemyUpgradeId): UpgradeResult {
    return this.buy(this.enemyUpgrades.maxed(upgrade, this.config), this.enemyUpgrades.price(upgrade, this.config), () => {
      const before = this.enemyUpgrades.levels().capacity
      this.enemyUpgrades.upgrade(upgrade)
      if (upgrade === 'capacity') this.raiseCapacity(before)
      if (upgrade === 'health') {
        this.miners.raiseRivalHealth(this.config.enemyUpgrades.health.step, this.enemyUpgrades.health(this.config))
      }
    })
  }

  upgradeFighterStat(upgrade: FighterUpgradeId): UpgradeResult {
    return this.buy(this.fighterUpgrades.maxed(upgrade, this.config), this.fighterUpgrades.price(upgrade, this.config), () => {
      this.fighterUpgrades.upgrade(upgrade)
      if (upgrade === 'health') {
        this.miners.raiseFighterHealth(this.config.fighterUpgrades.health.step, this.fighterUpgrades.health(this.config))
      }
      if (upgrade === 'count') this.fillFighters()
    })
  }

  upgrade(upgrade: MinerUpgradeId): UpgradeResult {
    return this.buy(
      this.upgrades.maxed(upgrade, this.config, this.miners.playerCount, this.pendingMiners),
      this.upgrades.price(upgrade, this.config),
      () => {
        if (this.upgrades.upgrade(upgrade)) this.pendingMiners += 1
      },
    )
  }

  upgradeMining(upgrade: MiningPurchase): UpgradeResult {
    if (upgrade === 'unlock') {
      return this.buy(this.mining.hasUnlock(), this.mining.unlockPrice(this.config), () => {
        this.mining.ownUnlock()
      })
    }
    if (upgrade === 'golden') {
      return this.buy(this.mining.hasGolden(), this.mining.goldenPrice(this.config), () => {
        this.mining.ownGolden()
        this.growRivalCap(this.config.golden.rivalShips)
      })
    }
    if (upgrade === 'tractorBeam') {
      return this.buy(this.mining.hasTractor(), this.mining.tractorPrice(this.config), () => {
        this.mining.ownTractor()
        this.bank.deposit(this.ore.drain())
        this.miners.leaveOre(this.world)
        this.miners.turnHostile(this.world)
      })
    }
    return this.buy(
      this.mining.maxed(upgrade, this.config),
      this.mining.price(upgrade, this.config),
      () => {
        this.mining.upgrade(upgrade)
        if (upgrade === 'size') this.asteroids.scaleHealth(this.config.asteroids.healthScale)
      },
    )
  }

  advance(dtMs: number): void {
    this.clock.advance(dtMs, step => this.step(step))
  }

  scene(): MapScene {
    return {
      ...this.layout.scene(),
      maxAsteroids: this.config.asteroids.max,
      money: this.bank.amount,
      asteroids: this.asteroids.scene(),
      ores: this.ore.scene(),
      shots: this.shots.scene(),
      ships: this.miners.scene(this.world),
      spawnInMs: this.spawns.remaining(this.mining.spawnInterval(this.config)),
      asteroidSize: this.mining.rockSize(this.config),
      goldenSize: this.mining.goldenSize(this.config),
      miner: this.upgrades.stats(this.config, this.miners.playerCount, this.pendingMiners),
      nextMiner: this.nextMiner(),
      mining: this.mining.stats(this.config),
      fighter: this.fighterUpgrades.stats(this.config),
      nextFighter: this.nextFighter(),
      enemy: this.enemyScene(),
      gift: this.gift,
    }
  }

  exportState(): MapState {
    return {
      money: this.bank.amount,
      spawnAccumulatorMs: this.spawns.elapsed,
      goldenSpawnAccumulatorMs: this.goldenSpawns.elapsed,
      rngState: this.rng.value,
      ...this.asteroids.save(),
      ...this.ore.save(),
      ...this.shots.save(),
      ...this.miners.save(),
      minerLevels: this.upgrades.levels(),
      miningLevels: this.mining.levels(),
      fighterLevels: this.fighterUpgrades.levels(),
      enemyLevels: this.enemyUpgrades.levels(),
      tractorBeam: this.mining.hasTractor(),
      golden: this.mining.hasGolden(),
      miningUnlocked: this.mining.hasUnlock(),
      pendingMiners: this.pendingMiners,
      minerWork: this.minerWork,
      pendingFighters: this.pendingFighters,
      fighterWork: this.fighterWork,
      rivalCap: this.rivalCap,
      rivalElapsedMs: this.rivalElapsedMs,
      fleetAnswered: this.fleetAnswered,
      gift: this.gift,
    }
  }

  private step(dtMs: number): void {
    this.ore.drift(dtMs, this.config)
    this.miners.move(dtMs, this.world, () => this.rng.next())
    this.shots.fly(dtMs, this.config.ships.shotSpeed, shot => {
      if (shot.shipId) {
        this.miners.hurt(shot.shipId, shot.damage, this.world)
        return
      }
      breakAsteroid(shot, this.asteroids, this.ore, this.miners, this.mining, this.bank, this.config, () => this.rng.next())
    }, id => this.miners.locate(id))
    this.spawns.tick(dtMs, this.mining.spawnInterval(this.config), () => {
      this.asteroids.spawn(this.config, () => this.rng.next(), this.mining.rockHealth(this.config, 'normal'))
    })
    if (this.mining.hasGolden()) {
      this.goldenSpawns.tick(dtMs, this.mining.goldenInterval(this.config), () => {
        this.asteroids.spawnGolden(this.config, () => this.rng.next(), this.mining.rockHealth(this.config, 'golden'))
      })
    }
    this.miners.scoop(this.world, () => this.rng.next())
    this.miners.finishStep(dtMs, this.world)
    this.launchMiners(dtMs)
    this.launchFighter(dtMs)
    this.replenishRivals(dtMs)
    this.fillFighters()
  }

  private launchMiners(dtMs: number): void {
    if (this.pendingMiners === 0) return
    this.minerWork += this.upgrades.value('production', this.config) * dtMs
    const cost = this.config.ships.units * 1000
    while (this.minerWork >= cost && this.pendingMiners > 0) {
      this.minerWork -= cost
      this.pendingMiners -= 1
      this.miners.spawn('player', this.world)
      this.reinforceRival()
    }
    if (this.pendingMiners === 0) this.minerWork = 0
  }

  /** The first time the player fleet reaches shipsAt, multiply the rival cap by shipsBy. */
  private reinforceRival(): void {
    if (this.fleetAnswered || this.miners.playerCount < this.config.rival.shipsAt) return
    this.fleetAnswered = true
    this.growRivalCap(this.config.rival.shipsBy)
  }

  /** The button shows the live fleet cap. Spawn rate still shows its own rating. */
  private enemyScene() {
    const enemy = this.enemyUpgrades.stats(this.config)
    enemy.values.capacity = this.rivalCap
    return enemy
  }

  /** The first purchase sets the cap to start. Each later purchase adds step. New ships launch now. */
  private raiseCapacity(levelBefore: number): void {
    const spec = this.config.enemyUpgrades.capacity
    const next = levelBefore === 0 ? spec.start : this.rivalCap + spec.step
    const added = next - this.rivalCap
    if (added <= 0) return
    this.rivalCap = next
    for (let i = 0; i < added; i += 1) this.miners.spawn('rival', this.world)
  }

  /** New cap room launches now. Ships already destroyed still come back on the minute clock. */
  private growRivalCap(factor: number): void {
    const added = this.rivalCap * (factor - 1)
    this.rivalCap *= factor
    for (let i = 0; i < added; i += 1) this.miners.spawn('rival', this.world)
  }

  /** One destroyed rival miner returns to the base per replenish interval, and not past the cap. */
  private replenishRivals(dtMs: number): void {
    if (this.miners.rivalCount >= this.rivalCap) {
      this.rivalElapsedMs = 0
      return
    }
    this.rivalElapsedMs += dtMs
    const wait = this.enemyUpgrades.replenishInterval(this.config)
    while (this.rivalElapsedMs >= wait && this.miners.rivalCount < this.rivalCap) {
      this.rivalElapsedMs -= wait
      this.miners.spawn('rival', this.world)
    }
    if (this.miners.rivalCount >= this.rivalCap) this.rivalElapsedMs = 0
  }

  private launchFighter(dtMs: number): void {
    if (this.pendingFighters === 0) return
    this.fighterWork += this.fighterUpgrades.value('production', this.config) * dtMs
    const cost = this.config.fighter.units * 1000
    while (this.fighterWork >= cost && this.pendingFighters > 0) {
      this.fighterWork -= cost
      this.pendingFighters -= 1
      this.miners.spawnFighter(this.world)
    }
    if (this.pendingFighters === 0) this.fighterWork = 0
  }

  /** Fighters on the field plus fighters still in the build queue. */
  private fightersHeld(): number {
    return this.miners.fighterCount + this.pendingFighters
  }

  private fighterCap(): number {
    return this.fighterUpgrades.value('count', this.config)
  }

  /** Keep a fighter building or flying for each one the count upgrade allows. */
  private fillFighters(): void {
    while (this.fightersHeld() < this.fighterCap()) this.pendingFighters += 1
  }

  private nextMiner(): { progress: number } | null {
    if (this.pendingMiners === 0) return null
    return { progress: Math.min(1, this.minerWork / (this.config.ships.units * 1000)) }
  }

  private nextFighter(): { progress: number } | null {
    if (this.pendingFighters === 0) return null
    return { progress: Math.min(1, this.fighterWork / (this.config.fighter.units * 1000)) }
  }

  private buy(maxed: boolean, price: number, apply: () => void): UpgradeResult {
    if (maxed) return 'maxed'
    if (!this.bank.spend(price)) return 'broke'
    apply()
    return 'ok'
  }
}
