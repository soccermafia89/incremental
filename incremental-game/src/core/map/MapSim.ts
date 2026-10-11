import type { GameConfig } from '../../data/GameConfig'
import { isEngineUnlock, isWeaponUnlock } from '../../data/designer'
import { MINING_IDS, type MiningPurchase } from '../../data/mining'
import { UPGRADE_IDS } from '../../data/upgrades'
import { breakAsteroid } from '../asteroid/break'
import { AsteroidField } from '../asteroid/AsteroidField'
import { Bank } from '../base/Bank'
import { Clock } from '../game/Clock'
import { Rng } from '../game/rng'
import type { FleetScene, MapScene, MapState, ProductionDesign } from '../game/state'
import { EnemyUpgrades } from '../enemy/Upgrades'
import { FighterUpgrades } from '../fighter/Upgrades'
import { MiningUpgrades } from '../mining/Mining'
import { ShipDesign, type DesignGhost, type DesignResult, type PlacedPart, type WeaponMods } from '../designer'
import type { EnemyUpgradeId } from '../../data/enemy/upgrades'
import type { FighterUpgradeId } from '../../data/fighter/upgrades'
import { Miners, MinerUpgrades, blastCells, type MinerUpgradeId, type MinerWorld, type Side, type UpgradeResult } from '../miner'
import { OreField } from '../ore/OreField'
import { Volley, type FiredShot } from '../shot/Shot'
import { WeaponUpgrades } from '../weapons/Upgrades'
import type { WeaponUpgradeId } from '../../data/weapons/upgrades'
import { MapLayout } from './Layout'
import { SpawnClock } from './SpawnClock'

/** How long a ship laser line stays after the step that fired it. The hit already landed. */
const LASER_BEAM_MS = 200
/** How long the lit cells of a missile blast stay on the map. */
const BLAST_MS = 400

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
  private readonly weaponUpgrades: WeaponUpgrades
  private readonly design: ShipDesign
  /** Which ship the fighter bar is building. */
  private productionDesign: ProductionDesign
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
  /** Unpaid fraction of automine income, in thousandths of a dollar. Not saved. */
  private automineMilli = 0
  /** Time until each base cannon can fire. Not saved. */
  private playerCannonMs = 0
  private rivalCannonMs = 0
  /** Combat shoots every enemy inside cannon range. Stasis ignores them until one enters wake. */
  private baseCombat = false
  private rivalCombat = false
  /** Beams drawn for shots. A ship laser keeps `life`. A cannon bolt does not. Not saved. */
  private lasers: (MapScene['lasers'][number] & { life?: number })[] = []
  private nextLaser = 1
  /** Lit map cells of a missile blast. Not saved. */
  private blasts: { id: number; side: Side; size: number; life: number; cells: { x: number; y: number }[] }[] = []
  private nextBlast = 1
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
      ? MiningUpgrades.restore(state.miningLevels, state.tractorBeam, state.golden, state.miningUnlocked, state.automine)
      : MiningUpgrades.create()
    this.weaponUpgrades = state ? WeaponUpgrades.restore(state.weaponLevels) : WeaponUpgrades.create()
    this.design = state
      ? ShipDesign.restore(config, state.shipDesigner, state.laser, state.missile, state.mediumEngine, state.largeEngine, state.parts, state.nextPartId, state.savedDesign)
      : ShipDesign.create()
    this.productionDesign = state?.productionDesign ?? 'fighter'
    if (this.productionDesign === 'saved' && !this.design.hasSaved()) {
      throw new Error('production requires a saved design')
    }
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
    this.baseCombat = state?.baseCombat ?? false
    this.rivalCombat = state?.rivalCombat ?? false
    this.world = {
      config,
      layout: this.layout,
      asteroids: this.asteroids,
      ore: this.ore,
      shots: this.shots,
      upgrades: this.upgrades,
      fighterUpgrades: this.fighterUpgrades,
      enemyUpgrades: this.enemyUpgrades,
      weaponUpgrades: this.weaponUpgrades,
      mining: this.mining,
      bank: this.bank,
      hit: shot => this.resolveHit(shot),
      beam: (from, to, side) => {
        this.lasers.push({
          id: this.nextLaser,
          x0: from.x,
          y0: from.y,
          x1: to.x,
          y1: to.y,
          side,
          source: 'laser',
          life: LASER_BEAM_MS,
        })
        this.nextLaser += 1
      },
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

  /**
   * Max every upgrade through the ship designer. Each level uses the same effects as buying it.
   * Nothing is charged. The names are written out here, so an upgrade added later is not included.
   */
  upgradesToShipDesign(): void {
    if (!this.mining.hasAutomine()) {
      for (const upgrade of ['speed', 'damage', 'fireRate', 'carry', 'count', 'production'] as const) {
        while (!this.upgrades.maxed(upgrade, this.config)) this.grantMiner(upgrade)
      }
    }
    if (!this.mining.hasUnlock()) this.grantMining('unlock')
    for (const upgrade of ['size', 'spawnRate'] as const) {
      while (!this.mining.maxed(upgrade, this.config)) this.grantMining(upgrade)
    }
    if (!this.mining.hasGolden()) this.grantMining('golden')
    while (!this.mining.maxed('goldenSpawnRate', this.config)) this.grantMining('goldenSpawnRate')
    if (!this.mining.hasTractor()) this.grantMining('tractorBeam')
    if (!this.mining.hasAutomine()) this.grantMining('automine')
    for (const upgrade of ['speed', 'attackRate', 'health', 'damage', 'count', 'production'] as const) {
      while (!this.fighterUpgrades.maxed(upgrade, this.config)) this.grantFighter(upgrade)
    }
    for (const upgrade of ['spawnRate', 'capacity', 'health', 'damage', 'attackRate'] as const) {
      while (!this.enemyUpgrades.maxed(upgrade, this.config)) this.grantEnemy(upgrade)
    }
    if (!this.design.hasUnlock()) this.design.unlock()
    if (!this.design.hasWeapon('laser')) this.design.unlockWeapon('laser')
    if (!this.design.hasWeapon('missile')) this.design.unlockWeapon('missile')
    if (!this.design.hasEngine('mediumEngine')) this.design.unlockEngine('mediumEngine')
    if (!this.design.hasEngine('largeEngine')) this.design.unlockEngine('largeEngine')
  }

  /**
   * Max every miner upgrade and every upgrade on the Mining page.
   * Each level uses the same effects as buying it. Nothing is charged.
   */
  skipLevelOne(): void {
    if (!this.mining.hasAutomine()) {
      for (const id of UPGRADE_IDS) {
        while (!this.upgrades.maxed(id, this.config)) this.grantMiner(id)
      }
    }
    if (!this.mining.hasUnlock()) this.grantMining('unlock')
    for (const id of MINING_IDS) {
      if (id === 'goldenSpawnRate') continue
      while (!this.mining.maxed(id, this.config)) this.grantMining(id)
    }
    if (!this.mining.hasGolden()) this.grantMining('golden')
    while (!this.mining.maxed('goldenSpawnRate', this.config)) this.grantMining('goldenSpawnRate')
    if (!this.mining.hasTractor()) this.grantMining('tractorBeam')
  }

  /** The effects of one fighter purchase, apart from the price. */
  private grantFighter(upgrade: FighterUpgradeId): void {
    this.fighterUpgrades.upgrade(upgrade)
    if (upgrade === 'health') {
      this.miners.raiseFighterHealth(this.config.fighterUpgrades.health.step, this.fighterUpgrades.health(this.config))
    }
    if (upgrade === 'count') this.fillFighters()
  }

  /** The effects of one enemy purchase, apart from the price. */
  private grantEnemy(upgrade: EnemyUpgradeId): void {
    const before = this.enemyUpgrades.levels().capacity
    this.enemyUpgrades.upgrade(upgrade)
    if (upgrade === 'capacity') this.raiseCapacity(before)
    if (upgrade === 'health') {
      this.miners.raiseRivalHealth(this.config.enemyUpgrades.health.step, this.enemyUpgrades.health(this.config))
    }
  }

  /** The effects of one miner purchase, apart from the price. */
  private grantMiner(upgrade: MinerUpgradeId): void {
    this.upgrades.upgrade(upgrade)
    if (upgrade === 'count') this.fillMiners()
  }

  /** The effects of one mining purchase, apart from the price. */
  private grantMining(upgrade: MiningPurchase): void {
    if (upgrade === 'unlock') {
      this.mining.ownUnlock()
      return
    }
    if (upgrade === 'golden') {
      this.mining.ownGolden()
      this.growRivalCap(this.config.golden.rivalShips)
      return
    }
    if (upgrade === 'tractorBeam') {
      this.mining.ownTractor()
      this.bank.deposit(this.ore.drain())
      this.miners.leaveOre(this.world)
      this.miners.turnHostile(this.world)
      return
    }
    if (upgrade === 'automine') {
      this.mining.ownAutomine()
      this.asteroids.clear()
      this.pendingMiners = 0
      this.minerWork = 0
      this.miners.dismissPlayerMiners(this.world)
      this.miners.holdTheField(this.world)
      return
    }
    this.mining.upgrade(upgrade)
    if (upgrade === 'size') this.asteroids.scaleHealth(this.config.asteroids.healthScale)
  }

  upgradeEnemy(upgrade: EnemyUpgradeId): UpgradeResult {
    return this.buy(this.enemyUpgrades.maxed(upgrade, this.config), this.enemyUpgrades.price(upgrade, this.config), () => {
      this.grantEnemy(upgrade)
    })
  }

  upgradeFighterStat(upgrade: FighterUpgradeId): UpgradeResult {
    return this.buy(this.fighterUpgrades.maxed(upgrade, this.config), this.fighterUpgrades.price(upgrade, this.config), () => {
      this.grantFighter(upgrade)
    })
  }

  unlockDesigner(): UpgradeResult {
    return this.buy(this.design.hasUnlock(), this.config.designer.cost, () => {
      this.design.unlock()
    })
  }

  private weaponMods(): WeaponMods {
    return {
      laserRange: this.weaponUpgrades.laserRange(this.config),
      laserEnergy: this.weaponUpgrades.laserEnergy(this.config),
      cannonRate: this.weaponUpgrades.cannonRate(this.config),
      cannonDamage: this.weaponUpgrades.cannonDamage(this.config),
      missileRate: this.weaponUpgrades.missileRate(this.config),
      missileDamage: this.weaponUpgrades.missileDamage(this.config),
    }
  }

  upgradeWeapon(upgrade: WeaponUpgradeId): UpgradeResult | 'unknown' {
    if (!this.design.hasUnlock()) return 'unknown'
    if ((upgrade === 'laserRange' || upgrade === 'laserEnergy') && !this.design.hasWeapon('laser')) return 'unknown'
    if ((upgrade === 'missileFireRate' || upgrade === 'missileDamage') && !this.design.hasWeapon('missile')) return 'unknown'
    return this.buy(this.weaponUpgrades.maxed(upgrade, this.config), this.weaponUpgrades.price(upgrade, this.config), () => {
      this.weaponUpgrades.upgrade(upgrade)
    })
  }

  unlockWeapon(id: string): UpgradeResult | 'unknown' {
    if (!this.design.hasUnlock() || !isWeaponUnlock(id)) return 'unknown'
    return this.buy(this.design.hasWeapon(id), this.config.designer.weapons[id].cost, () => {
      this.design.unlockWeapon(id)
    })
  }

  unlockEngine(id: string): UpgradeResult | 'unknown' {
    if (!this.design.hasUnlock() || !isEngineUnlock(id)) return 'unknown'
    return this.buy(this.design.hasEngine(id), this.config.designer.engines[id].cost, () => {
      this.design.unlockEngine(id)
    })
  }

  placeComponent(component: string, x: number, y: number, rotation: number): DesignResult {
    return this.design.place(this.config, component, x, y, rotation)
  }

  saveDesign(): DesignResult {
    return this.design.commit()
  }

  importDesign(parts: PlacedPart[]): DesignResult {
    return this.design.install(this.config, parts)
  }

  resetDesign(): DesignResult {
    return this.design.clear()
  }

  chooseProduction(design: string): DesignResult {
    if (!this.design.hasUnlock()) return 'unknown'
    if (design === 'fighter') {
      this.productionDesign = 'fighter'
      return 'ok'
    }
    if (design === 'saved' && this.design.hasSaved()) {
      this.productionDesign = 'saved'
      return 'ok'
    }
    return 'unknown'
  }

  removeComponent(id: string): DesignResult {
    return this.design.remove(this.config, id)
  }

  designPreview(component: string, x: number, y: number, rotation: number): DesignGhost | null {
    return this.design.preview(this.config, component, x, y, rotation)
  }

  upgrade(upgrade: MinerUpgradeId): UpgradeResult {
    if (this.mining.hasAutomine()) return 'maxed'
    return this.buy(this.upgrades.maxed(upgrade, this.config), this.upgrades.price(upgrade, this.config), () => {
      this.grantMiner(upgrade)
    })
  }

  upgradeMining(upgrade: MiningPurchase): UpgradeResult {
    if (this.mining.hasAutomine()) return 'maxed'
    if (upgrade === 'automine') {
      if (!this.mining.hasTractor()) return 'maxed'
      return this.buy(false, this.mining.autominePrice(this.config), () => {
        this.grantMining('automine')
      })
    }
    if (upgrade === 'unlock') {
      return this.buy(this.mining.hasUnlock(), this.mining.unlockPrice(this.config), () => {
        this.grantMining('unlock')
      })
    }
    if (upgrade === 'golden') {
      return this.buy(this.mining.hasGolden(), this.mining.goldenPrice(this.config), () => {
        this.grantMining('golden')
      })
    }
    if (upgrade === 'tractorBeam') {
      return this.buy(this.mining.hasTractor(), this.mining.tractorPrice(this.config), () => {
        this.grantMining('tractorBeam')
      })
    }
    return this.buy(this.mining.maxed(upgrade, this.config), this.mining.price(upgrade, this.config), () => {
      this.grantMining(upgrade)
    })
  }

  advance(dtMs: number): void {
    this.clock.advance(dtMs, step => this.step(step))
  }

  scene(): MapScene {
    return {
      ...this.layout.scene(),
      baseCombat: this.baseCombat,
      rivalCombat: this.rivalCombat,
      maxAsteroids: this.config.asteroids.max,
      money: this.bank.amount,
      asteroids: this.asteroids.scene(),
      ores: this.ore.scene(),
      shots: this.shots.scene(),
      lasers: this.lasers.map(laser => ({
        id: laser.id,
        x0: laser.x0,
        y0: laser.y0,
        x1: laser.x1,
        y1: laser.y1,
        side: laser.side,
        source: laser.source,
      })),
      blasts: this.blasts.map(blast => ({
        id: blast.id,
        side: blast.side,
        size: blast.size,
        bright: blast.life / BLAST_MS,
        cells: blast.cells,
      })),
      ships: this.miners.scene(this.world),
      spawnInMs: this.spawns.remaining(this.mining.spawnInterval(this.config)),
      asteroidSize: this.mining.rockSize(this.config),
      goldenSize: this.mining.goldenSize(this.config),
      miner: this.upgrades.stats(this.config),
      nextMiner: this.nextMiner(),
      mining: this.mining.stats(this.config),
      fighter: this.fighterUpgrades.stats(this.config),
      nextFighter: this.nextFighter(),
      enemy: this.enemyScene(),
      weapon: this.weaponUpgrades.stats(this.config),
      gift: this.gift,
      designer: this.design.scene(this.config, this.weaponMods()),
      fleet: this.fleetScene(),
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
      weaponLevels: this.weaponUpgrades.levels(),
      tractorBeam: this.mining.hasTractor(),
      golden: this.mining.hasGolden(),
      miningUnlocked: this.mining.hasUnlock(),
      automine: this.mining.hasAutomine(),
      pendingMiners: this.pendingMiners,
      minerWork: this.minerWork,
      pendingFighters: this.pendingFighters,
      fighterWork: this.fighterWork,
      rivalCap: this.rivalCap,
      rivalElapsedMs: this.rivalElapsedMs,
      fleetAnswered: this.fleetAnswered,
      gift: this.gift,
      baseCombat: this.baseCombat,
      rivalCombat: this.rivalCombat,
      productionDesign: this.productionDesign,
      ...this.design.save(),
    }
  }

  private step(dtMs: number): void {
    this.fadeBeams(dtMs)
    this.fadeBlasts(dtMs)
    this.ore.drift(dtMs, this.config)
    this.miners.move(dtMs, this.world, () => this.rng.next())
    this.fireCannons(dtMs)
    this.shots.fly(dtMs, this.config.ships.shotSpeed, this.config.cannon.shotSpeed, shot => {
      this.resolveHit(shot)
    }, id => this.miners.locate(id))
    if (!this.mining.hasAutomine()) {
      this.spawns.tick(dtMs, this.mining.spawnInterval(this.config), () => {
        this.asteroids.spawn(this.config, () => this.rng.next(), this.mining.rockHealth(this.config, 'normal'))
      })
      if (this.mining.hasGolden()) {
        this.goldenSpawns.tick(dtMs, this.mining.goldenInterval(this.config), () => {
          this.asteroids.spawnGolden(this.config, () => this.rng.next(), this.mining.rockHealth(this.config, 'golden'))
        })
      }
    }
    this.miners.scoop(this.world, () => this.rng.next())
    this.miners.finishStep(dtMs, this.world)
    if (!this.mining.hasAutomine()) this.launchMiners(dtMs)
    this.payAutomine(dtMs)
    this.launchFighter(dtMs)
    this.replenishRivals(dtMs)
    if (!this.mining.hasAutomine()) this.fillMiners()
    this.fillFighters()
  }

  /** `perSecond` dollars each second, paid as whole dollars as time accrues. */
  private payAutomine(dtMs: number): void {
    if (!this.mining.hasAutomine()) return
    this.automineMilli += this.mining.automineIncome(this.config) * dtMs
    const dollars = Math.floor(this.automineMilli / 1000)
    if (dollars <= 0) return
    this.automineMilli -= dollars * 1000
    this.bank.deposit(dollars)
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

  /** New cap room launches now. Ships already destroyed still come back on the spawn-rate clock. */
  private growRivalCap(factor: number): void {
    const added = this.rivalCap * (factor - 1)
    this.rivalCap *= factor
    for (let i = 0; i < added; i += 1) this.miners.spawn('rival', this.world)
  }

  /** Drop cannon bolts. Keep a ship laser until its time runs out. */
  private fadeBeams(dtMs: number): void {
    const still: (MapScene['lasers'][number] & { life?: number })[] = []
    for (const beam of this.lasers) {
      if (beam.life === undefined) continue
      beam.life -= dtMs
      if (beam.life > 0) still.push(beam)
    }
    this.lasers = still
  }

  /** A missile blast fades after it lights the cells it covered. */
  private fadeBlasts(dtMs: number): void {
    const still: typeof this.blasts = []
    for (const blast of this.blasts) {
      blast.life -= dtMs
      if (blast.life > 0) still.push(blast)
    }
    this.blasts = still
  }

  /** A traveling shot that arrived, or a laser that hit in the same step. */
  private resolveHit(shot: FiredShot): void {
    if (shot.shipId) this.miners.hurt(shot.shipId, shot.damage, this.world, !shot.cannon)
    else breakAsteroid({ ...shot, id: 'hit' }, this.asteroids, this.ore, this.miners, this.mining, this.bank, this.config, () => this.rng.next())
    if (shot.splash) {
      this.miners.splash(shot, this.world)
      const cell = this.config.map.cell
      this.blasts.push({
        id: this.nextBlast,
        side: shot.side,
        size: cell,
        life: BLAST_MS,
        cells: blastCells(shot.x, shot.y, cell),
      })
      this.nextBlast += 1
    }
  }

  /** Stasis until an enemy enters wake. Combat then shoots every enemy inside range. */
  private fireCannons(dtMs: number): void {
    this.fireCannon('player', dtMs)
    this.fireCannon('rival', dtMs)
  }

  private fireCannon(side: Side, dtMs: number): void {
    const home = this.layout.home(side)
    const wake = this.miners.enemiesWithin(side, home, this.config.cannon.wake)
    const targets = this.miners.enemiesWithin(side, home, this.config.cannon.range)
    if (!this.combatOf(side)) {
      if (wake.length === 0) return
      this.setCombat(side, true)
      this.setCannonCooldown(side, 0)
    }
    if (targets.length === 0) {
      this.setCombat(side, false)
      this.setCannonCooldown(side, 0)
      return
    }
    const cooldown = side === 'player' ? this.playerCannonMs : this.rivalCannonMs
    const next = cooldown - dtMs
    if (next > 0) {
      this.setCannonCooldown(side, next)
      return
    }
    for (const target of targets) {
      this.shots.fire({
        x: home.x,
        y: home.y,
        targetX: target.x,
        targetY: target.y,
        asteroidId: null,
        shipId: target.id,
        side,
        damage: this.config.cannon.damage,
        splash: false,
        cannon: true,
        mining: false,
      })
      this.lasers.push({
        id: this.nextLaser,
        x0: home.x,
        y0: home.y,
        x1: target.x,
        y1: target.y,
        side,
        source: 'cannon',
      })
      this.nextLaser += 1
    }
    const interval = Math.round(1000 / this.config.cannon.rate)
    const reloaded = next + interval
    this.setCannonCooldown(side, reloaded < 0 ? 0 : reloaded)
  }

  private combatOf(side: Side): boolean {
    return side === 'player' ? this.baseCombat : this.rivalCombat
  }

  private setCombat(side: Side, combat: boolean): void {
    if (side === 'player') this.baseCombat = combat
    else this.rivalCombat = combat
  }

  private setCannonCooldown(side: Side, ms: number): void {
    if (side === 'player') this.playerCannonMs = ms
    else this.rivalCannonMs = ms
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
    const cost = this.productionUnits() * 1000
    while (this.fighterWork >= cost && this.pendingFighters > 0) {
      this.fighterWork -= cost
      this.pendingFighters -= 1
      const craft = this.productionDesign === 'saved' ? this.design.combat(this.config, this.weaponMods()) : null
      this.miners.spawnFighter(this.world, craft === null ? null : { speed: craft.speed, damage: craft.damage, weapons: craft.weapons.map(gun => ({ ...gun })), cooldown: { weapon: 0, laser: 0, missile: 0 }, cells: craft.cells }, craft?.health ?? null)
    }
    if (this.pendingFighters === 0) this.fighterWork = 0
  }

  /** Miners on the field plus miners still in the build queue. */
  private minersHeld(): number {
    return this.miners.playerCount + this.pendingMiners
  }

  /** Keep a miner building or flying for each one the count upgrade allows. */
  private fillMiners(): void {
    while (this.minersHeld() < this.upgrades.value('count', this.config)) this.pendingMiners += 1
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

  private nextMiner(): { progress: number; cells: { x: number; y: number; color: string }[] } | null {
    if (this.pendingMiners === 0) return null
    return {
      progress: Math.min(1, this.minerWork / (this.config.ships.units * 1000)),
      cells: ShipDesign.minerHull(this.config),
    }
  }

  private nextFighter(): { progress: number; cells: { x: number; y: number; color: string }[] } | null {
    if (this.pendingFighters === 0) return null
    const units = this.productionUnits()
    const saved = this.productionDesign === 'saved' ? this.design.savedShape(this.config) : null
    const cells = saved
      ? saved.cells.map(cell => ({ x: cell.x, y: cell.y, color: cell.color }))
      : ShipDesign.minerHull(this.config)
    if (units === 0) return { progress: 1, cells }
    return { progress: Math.min(1, this.fighterWork / (units * 1000)), cells }
  }

  /** Build units for the ship currently selected in Fleet Design. */
  private productionUnits(): number {
    if (this.productionDesign === 'saved') {
      const saved = this.design.savedShape(this.config)
      if (saved) return saved.units
    }
    return this.config.fighter.units
  }

  private fleetScene(): FleetScene {
    const saved = this.design.savedShape(this.config)
    const choices: FleetScene['choices'] = [{
      id: 'fighter',
      label: 'Default fighter',
      units: this.config.fighter.units,
      cells: ShipDesign.minerLayout(this.config),
    }]
    if (saved) {
      choices.push({ id: 'saved', label: 'Saved design', units: saved.units, cells: saved.cells })
    }
    return { selected: this.productionDesign === 'saved' && saved ? 'saved' : 'fighter', choices }
  }

  private buy(maxed: boolean, price: number, apply: () => void): UpgradeResult {
    if (maxed) return 'maxed'
    if (!this.bank.spend(price)) return 'broke'
    apply()
    return 'ok'
  }
}
