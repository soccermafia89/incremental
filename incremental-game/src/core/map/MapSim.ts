import type { GameConfig } from '../../data/GameConfig'
import { upgradeMaxed, upgradePrice, upgradeValue } from '../../data/upgradeSpec'
import { isEngineUnlock, isWeaponUnlock } from '../../data/designer'
import { MINING_IDS, type MiningPurchase } from '../../data/mining'
import { UPGRADE_IDS } from '../../data/upgrades'
import { breakAsteroid } from '../asteroid/break'
import { AsteroidField } from '../asteroid/AsteroidField'
import { Bank } from '../base/Bank'
import { Clock } from '../game/Clock'
import { Rng } from '../game/rng'
import type { FleetScene, MapScene, MapState, ProductionBay, ProductionDesign } from '../game/state'
import { CorvetteUpgrades } from '../corvette/Upgrades'
import type { CorvetteUpgradeId } from '../../data/corvette/upgrades'
import { DefenseUpgrades } from '../defense/Upgrades'
import type { DefenseUpgradeId } from '../../data/defense/upgrades'
import { EnemyUpgrades } from '../enemy/Upgrades'
import { FighterUpgrades } from '../fighter/Upgrades'
import { MiningUpgrades } from '../mining/Mining'
import { renamesAfterDiscard } from '../designer/Library'
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

/** One finished ship waits for a free slot. The build bar stays full until it launches. */
const BUILD_QUEUE_CAP = 1
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
  private readonly corvetteUpgrades: CorvetteUpgrades
  private corvetteOwned: boolean
  private corvetteElapsedMs: number
  private readonly defenseUpgrades: DefenseUpgrades
  /** Time already waited toward the next defense platform. The clock runs only while none is standing. */
  private defenseElapsedMs: number
  private missileCorvetteKilled: boolean
  private crystals: number
  private readonly mining: MiningUpgrades
  private readonly weaponUpgrades: WeaponUpgrades
  private readonly design: ShipDesign
  /** Production bays. Index 0 is always open and holds ships waiting for a free bay. */
  private bays: ProductionBay[]
  private readonly miners: Miners
  private readonly spawns: SpawnClock
  private readonly goldenSpawns: SpawnClock
  private pendingMiners: number
  private minerWork: number
  /** Miners built and waiting because the miner cap is full. */
  private minerReady: number
  /** Fighters built and waiting because the fighter cap is full. Each entry is the design to launch. */
  private fighterQueue: string[]
  /** Defense platforms built and waiting because one is already deployed. */
  private platformReady: number
  /** True once the player fleet has reached the size that doubles the rival fleet. */
  private fleetAnswered: boolean
  /** Rival miners allowed on the field. Losses refill up to this, one at a time. */
  private rivalCap: number
  private rivalElapsedMs: number
  /** Next payout of the sidebar gift. The first claim jumps to `giftNext`, then each claim doubles. */
  private gift: number
  /** Next payout of the sidebar crystal button. Doubles after each claim. */
  private crystalGift: number
  /** Time already waited toward the next automine payout. */
  private automineElapsedMs = 0
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
    this.corvetteUpgrades = state ? CorvetteUpgrades.restore(state.corvetteLevels) : CorvetteUpgrades.create()
    this.corvetteOwned = state?.corvette ?? false
    this.corvetteElapsedMs = state?.corvetteElapsedMs ?? 0
    this.defenseUpgrades = state ? DefenseUpgrades.restore(state.defenseLevels) : DefenseUpgrades.create()
    this.defenseElapsedMs = state?.defenseElapsedMs ?? 0
    this.missileCorvetteKilled = state?.missileCorvetteKilled ?? false
    this.crystals = state?.crystals ?? 0
    this.mining = state
      ? MiningUpgrades.restore(state.miningLevels, state.tractorBeam, state.golden, state.miningUnlocked, state.automine, state.moneyConverter)
      : MiningUpgrades.create()
    this.weaponUpgrades = state ? WeaponUpgrades.restore(state.weaponLevels) : WeaponUpgrades.create()
    this.design = state
      ? ShipDesign.restore(config, state.shipDesigner, state.laser, state.missile, state.mediumEngine, state.largeEngine, state.parts, state.nextPartId, state.savedDesign, state.designs)
      : ShipDesign.create()
    this.bays = (state?.bays ?? [{ design: 'fighter', pending: 0, work: 0, production: 0, capacity: 0 }]).map(bay => ({ ...bay }))
    if (this.bays.length < 1) throw new Error('bays is empty')
    if (this.bays.length - 1 > this.config.designer.bays.length) throw new Error('too many production bays')
    const productionLevels = this.config.designer.bayProduction.levels.length - 1
    for (const bay of this.bays) {
      if (!Number.isInteger(bay.production) || bay.production < 0 || bay.production > productionLevels) {
        throw new Error('bay production is invalid')
      }
    }
    for (const bay of this.bays) {
      if (bay.design !== 'fighter' && this.design.namedParts(bay.design) === null) throw new Error('production requires a saved design')
      const capacityLevels = this.config.designer.bayCapacity.levels.length - 1
      if (!Number.isInteger(bay.capacity) || bay.capacity < 0 || bay.capacity > capacityLevels) {
        throw new Error('bay capacity is invalid')
      }
    }
    this.spawns = state ? SpawnClock.restore(state.spawnAccumulatorMs) : SpawnClock.start()
    this.goldenSpawns = state ? SpawnClock.restore(state.goldenSpawnAccumulatorMs) : SpawnClock.start()
    this.pendingMiners = state?.pendingMiners ?? 0
    this.minerWork = state?.minerWork ?? 0
    this.minerReady = Math.min(state?.minerReady ?? 0, BUILD_QUEUE_CAP)
    this.fighterQueue = state?.fighterQueue ? [...state.fighterQueue].slice(0, BUILD_QUEUE_CAP) : []
    this.platformReady = Math.min(state?.platformReady ?? 0, BUILD_QUEUE_CAP)
    this.automineElapsedMs = this.mining.hasAutomine() ? (state?.automineElapsedMs ?? 0) : 0
    this.fleetAnswered = state?.fleetAnswered ?? false
    this.rivalCap = state?.rivalCap ?? 1
    this.rivalElapsedMs = state?.rivalElapsedMs ?? 0
    this.gift = state?.gift ?? config.bank.gift
    this.crystalGift = state?.crystalGift ?? config.bank.crystalGift
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
      corvetteUpgrades: this.corvetteUpgrades,
      weaponUpgrades: this.weaponUpgrades,
      mining: this.mining,
      bank: this.bank,
      gainCrystal: amount => {
        this.crystals += amount
      },
      noteMissileCorvette: () => {
        this.missileCorvetteKilled = true
      },
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
    const paid = this.gift
    this.bank.deposit(paid)
    this.gift = paid === this.config.bank.gift ? this.config.bank.giftNext : paid * 2
    this.convertMoney()
  }

  claimCrystalGift(): void {
    this.crystals += this.crystalGift
    this.crystalGift *= 2
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
    const before = upgrade === 'health' ? this.fighterUpgrades.health(this.config) : 0
    this.fighterUpgrades.upgrade(upgrade)
    if (upgrade === 'health') {
      const next = this.fighterUpgrades.health(this.config)
      this.miners.raiseFighterHealth(next - before, next)
    }
    if (upgrade === 'count') this.fillFighters()
  }

  /** The effects of one enemy purchase, apart from the price. */
  private grantEnemy(upgrade: EnemyUpgradeId): void {
    const before = this.enemyUpgrades.levels().capacity
    const beforeHealth = upgrade === 'health' ? this.enemyUpgrades.health(this.config) : 0
    this.enemyUpgrades.upgrade(upgrade)
    if (upgrade === 'capacity') this.raiseCapacity(before)
    if (upgrade === 'health') {
      const next = this.enemyUpgrades.health(this.config)
      this.miners.raiseRivalHealth(next - beforeHealth, next)
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
      this.minerReady = 0
      this.miners.dismissPlayerMiners(this.world)
      this.miners.holdTheField(this.world)
      return
    }
    if (upgrade === 'moneyConverter') {
      this.mining.ownMoneyConverter()
      this.convertMoney()
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

  unlockCorvette(): UpgradeResult {
    return this.buy(this.corvetteOwned, this.config.corvette.cost, () => {
      this.corvetteOwned = true
    })
  }

  upgradeCorvette(upgrade: CorvetteUpgradeId): UpgradeResult {
    if (!this.corvetteOwned) return 'maxed'
    const pay = this.corvetteUpgrades.paysCrystals(upgrade, this.config) ? this.buyCrystal.bind(this) : this.buy.bind(this)
    return pay(this.corvetteUpgrades.maxed(upgrade, this.config), this.corvetteUpgrades.price(upgrade, this.config), () => {
      const before = upgrade === 'health' ? this.corvetteUpgrades.health(this.config) : 0
      this.corvetteUpgrades.upgrade(upgrade)
      if (upgrade === 'health') {
        const next = this.corvetteUpgrades.health(this.config)
        this.miners.raiseCorvetteHealth(next - before, next)
      }
      if (upgrade === 'missiles') this.miners.armCorvetteMissiles()
    })
  }

  upgradeFighterStat(upgrade: FighterUpgradeId): UpgradeResult {
    const pay = upgrade === 'count' && this.fighterUpgrades.countPaysCrystals(this.config)
      ? this.buyCrystal.bind(this)
      : this.buy.bind(this)
    return pay(this.fighterUpgrades.maxed(upgrade, this.config), this.fighterUpgrades.price(upgrade, this.config), () => {
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
    const price = this.weaponUpgrades.price(upgrade, this.config)
    const apply = () => {
      this.weaponUpgrades.upgrade(upgrade)
    }
    if (this.weaponUpgrades.paysCrystals(upgrade, this.config)) {
      return this.buyCrystal(this.weaponUpgrades.maxed(upgrade, this.config), price, apply)
    }
    return this.buy(this.weaponUpgrades.maxed(upgrade, this.config), price, apply)
  }

  unlockWeapon(id: string): UpgradeResult | 'unknown' {
    if (!this.design.hasUnlock() || !isWeaponUnlock(id)) return 'unknown'
    if (id === 'missile') {
      if (!this.missileCorvetteKilled) return 'unknown'
      return this.buyCrystal(this.design.hasWeapon(id), this.config.designer.weapons.missile.crystal, () => {
        this.design.unlockWeapon(id)
      })
    }
    return this.buy(this.design.hasWeapon(id), this.config.designer.weapons.laser.cost, () => {
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
    return this.design.commit(this.config, this.weaponMods())
  }

  loadDesign(name: string): DesignResult {
    return this.design.load(this.config, name)
  }

  /** Replaces one named ship with the current grid. */
  rewriteDesign(name: string): DesignResult {
    return this.design.rewrite(this.config, name, this.weaponMods())
  }

  /** Removes one named ship. A bay that was building it, or a later ship, follows the new names. */
  deleteDesign(name: string): DesignResult {
    const before = this.design.save().designs.map(design => design.name)
    const result = this.design.discard(name)
    if (result !== 'ok') return result
    const rename = renamesAfterDiscard(before, name)
    for (const bay of this.bays) {
      if (bay.design === 'fighter') continue
      bay.design = rename.get(bay.design) ?? 'fighter'
    }
    this.fighterQueue = this.fighterQueue.map(design => design === 'fighter' ? design : rename.get(design) ?? 'fighter')
    return 'ok'
  }

  importDesign(parts: PlacedPart[]): DesignResult {
    return this.design.install(this.config, parts)
  }

  resetDesign(): DesignResult {
    return this.design.clear()
  }

  chooseProduction(design: string, bay = 0): DesignResult {
    if (!this.design.hasUnlock()) return 'unknown'
    if (!Number.isInteger(bay) || bay < 0 || bay >= this.bays.length) return 'unknown'
    if (design === 'fighter' || this.design.namedParts(design) !== null) {
      this.bays[bay].design = design
      return 'ok'
    }
    return 'unknown'
  }

  unlockBay(): UpgradeResult | 'unknown' {
    if (!this.design.hasUnlock()) return 'unknown'
    const cost = this.config.designer.bays[this.bays.length - 1]
    if (cost === undefined) return 'maxed'
    const bought = this.buyCrystal(false, cost, () => {
      this.bays.push({ design: 'fighter', pending: 0, work: 0, production: 0, capacity: 0 })
    })
    if (bought === 'ok') this.fillFighters()
    return bought
  }

  upgradeBay(index: number): UpgradeResult | 'unknown' {
    if (!this.design.hasUnlock()) return 'unknown'
    if (!Number.isInteger(index) || index < 0 || index >= this.bays.length) return 'unknown'
    const spec = this.config.designer.bayProduction
    const level = this.bays[index].production
    if (upgradeMaxed(spec, level)) return 'maxed'
    return this.buy(false, upgradePrice(spec, level), () => {
      this.bays[index].production += 1
    })
  }

  /** Bay 0 buys the fighter count. An extra bay buys its own capacity. */
  upgradeBayCapacity(index: number): UpgradeResult | 'unknown' {
    if (!this.design.hasUnlock()) return 'unknown'
    if (!Number.isInteger(index) || index < 0 || index >= this.bays.length) return 'unknown'
    if (index === 0) return this.upgradeFighterStat('count')
    const spec = this.config.designer.bayCapacity
    const level = this.bays[index].capacity
    if (upgradeMaxed(spec, level)) return 'maxed'
    return this.buy(false, upgradePrice(spec, level), () => {
      this.bays[index].capacity += 1
      this.fillFighters()
    })
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
    if (upgrade === 'moneyConverter') {
      if (!this.mining.hasAutomine()) return 'maxed'
      return this.buy(this.mining.hasMoneyConverter(), this.mining.moneyConverterPrice(this.config), () => {
        this.grantMining('moneyConverter')
      })
    }
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
      crystals: this.crystals,
      missileCorvetteKilled: this.missileCorvetteKilled,
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
      nextFighter: this.bayBar(0),
      nextBays: this.bays.slice(1).flatMap((_, offset) => {
        const bar = this.bayBar(offset + 1)
        return bar === null ? [] : [{ index: offset + 1, ...bar }]
      }),
      enemy: this.enemyScene(),
      corvette: this.corvetteUpgrades.stats(this.config, this.corvetteOwned),
      defense: this.defenseUpgrades.stats(this.config, this.platformProgress()),
      weapon: this.weaponUpgrades.stats(this.config),
      gift: this.gift,
      crystalGift: this.crystalGift,
      designer: this.design.scene(this.config, this.weaponMods()),
      fleet: this.fleetScene(),
    }
  }

  exportState(): MapState {
    return {
      money: this.bank.amount,
      crystals: this.crystals,
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
      corvetteLevels: this.corvetteUpgrades.levels(),
      corvette: this.corvetteOwned,
      corvetteElapsedMs: this.corvetteElapsedMs,
      defenseLevels: this.defenseUpgrades.levels(),
      defenseElapsedMs: this.defenseElapsedMs,
      weaponLevels: this.weaponUpgrades.levels(),
      tractorBeam: this.mining.hasTractor(),
      golden: this.mining.hasGolden(),
      miningUnlocked: this.mining.hasUnlock(),
      automine: this.mining.hasAutomine(),
      automineElapsedMs: this.automineElapsedMs,
      moneyConverter: this.mining.hasMoneyConverter(),
      missileCorvetteKilled: this.missileCorvetteKilled,
      pendingMiners: this.pendingMiners,
      minerWork: this.minerWork,
      minerReady: this.minerReady,
      fighterQueue: [...this.fighterQueue],
      platformReady: this.platformReady,
      bays: this.bays.map(bay => ({ ...bay })),
      rivalCap: this.rivalCap,
      rivalElapsedMs: this.rivalElapsedMs,
      fleetAnswered: this.fleetAnswered,
      gift: this.gift,
      crystalGift: this.crystalGift,
      baseCombat: this.baseCombat,
      rivalCombat: this.rivalCombat,
      ...this.design.save(),
    }
  }

  private step(dtMs: number): void {
    this.fadeBeams(dtMs)
    this.fadeBlasts(dtMs)
    this.ore.drift(dtMs, this.config)
    this.miners.move(dtMs, this.world, () => this.rng.next())
    this.buildPlatform(dtMs)
    this.miners.driftPlatform(dtMs, this.world)
    this.firePlatforms(dtMs)
    this.fireCannons(dtMs)
    this.shots.fly(dtMs, this.config.ships.shotSpeed, this.config.cannon.shotSpeed, shot => {
      this.resolveHit(shot)
    }, id => this.miners.locate(id), shot => this.miners.nearestOpposite(shot.side, shot), { width: this.config.map.width, height: this.config.map.height })
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
    this.convertMoney()
    this.launchFighter(dtMs)
    this.replenishRivals(dtMs)
    this.replenishCorvettes(dtMs)
    if (!this.mining.hasAutomine()) this.fillMiners()
    this.fillFighters()
  }

  /** Pays `payout` in one deposit each time `everyMs` elapses. */
  private payAutomine(dtMs: number): void {
    if (!this.mining.hasAutomine()) return
    this.automineElapsedMs += dtMs
    const every = this.config.mining.automine.everyMs
    while (this.automineElapsedMs >= every) {
      this.automineElapsedMs -= every
      this.bank.deposit(this.mining.autominePayout(this.config))
      this.convertMoney()
    }
  }

  /** Once the converter is owned, money above the line becomes one crystal and the balance is cleared. */
  private convertMoney(): void {
    if (!this.mining.hasMoneyConverter()) return
    if (this.bank.amount <= this.config.mining.moneyConverter.above) return
    this.bank.spend(this.bank.amount)
    this.crystals += 1
  }

  private launchMiners(dtMs: number): void {
    this.releaseMiners()
    const cap = this.upgrades.value('count', this.config)
    if (this.miners.playerCount >= cap && this.minerReady >= BUILD_QUEUE_CAP) return
    const building = this.pendingMiners > 0 || (cap > 0 && this.minerReady < BUILD_QUEUE_CAP)
    if (!building) return
    this.minerWork += this.upgrades.value('production', this.config) * dtMs
    const cost = this.config.ships.units * 1000
    while (this.minerWork >= cost && (this.pendingMiners > 0 || (cap > 0 && this.minerReady < BUILD_QUEUE_CAP))) {
      if (this.miners.playerCount < cap) {
        this.minerWork -= cost
        if (this.pendingMiners > 0) this.pendingMiners -= 1
        this.miners.spawn('player', this.world)
        this.reinforceRival()
      } else if (this.minerReady < BUILD_QUEUE_CAP) {
        this.minerWork -= cost
        if (this.pendingMiners > 0) this.pendingMiners -= 1
        this.minerReady += 1
        if (this.minerReady >= BUILD_QUEUE_CAP) {
          this.minerWork = 0
          break
        }
      } else {
        break
      }
    }
    this.releaseMiners()
    if (this.pendingMiners === 0 && cap === 0) this.minerWork = 0
  }

  /** A destroyed miner is replaced from the finished queue before a new one is built. */
  private releaseMiners(): void {
    const cap = this.upgrades.value('count', this.config)
    while (this.miners.playerCount < cap && this.minerReady > 0) {
      this.minerReady -= 1
      this.miners.spawn('player', this.world)
      this.reinforceRival()
    }
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

  /** The first purchase sets the cap to start. Each later purchase adds step. Empty slots fill on the spawn clock. */
  private raiseCapacity(levelBefore: number): void {
    const spec = this.config.enemyUpgrades.capacity
    const nextValue = upgradeValue(spec, levelBefore + 1)
    const next = levelBefore === 0 ? nextValue : this.rivalCap + (nextValue - upgradeValue(spec, levelBefore))
    if (next <= this.rivalCap) return
    this.rivalCap = next
  }

  /** Golden asteroids and the third miner raise the cap. Empty slots fill on the spawn clock. */
  private growRivalCap(factor: number): void {
    this.rivalCap *= factor
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

  /** The next platform keeps building even while one is deployed. It waits until that one is gone. */
  private buildPlatform(dtMs: number): void {
    this.releasePlatform()
    if (!this.defenseUpgrades.owned(this.config) || this.platformReady >= BUILD_QUEUE_CAP) return
    this.defenseElapsedMs += dtMs
    const wait = this.config.defense.buildMs
    while (this.defenseElapsedMs >= wait && this.platformReady < BUILD_QUEUE_CAP) {
      this.defenseElapsedMs -= wait
      if (this.miners.platform()) this.platformReady += 1
      else this.spawnPlatformNow()
      if (this.platformReady >= BUILD_QUEUE_CAP) this.defenseElapsedMs = 0
    }
    this.releasePlatform()
  }

  private releasePlatform(): void {
    if (this.miners.platform() || this.platformReady <= 0) return
    this.platformReady -= 1
    this.spawnPlatformNow()
  }

  private spawnPlatformNow(): void {
    this.miners.spawnPlatform(this.world, this.defenseUpgrades.value('health', this.config))
  }

  private platformProgress(): number | null {
    if (!this.defenseUpgrades.owned(this.config)) return null
    if (this.platformReady >= BUILD_QUEUE_CAP) return 1
    return Math.min(1, this.defenseElapsedMs / this.config.defense.buildMs)
  }

  /** The platform shoots the nearest enemy inside its cannon range. */
  private firePlatforms(dtMs: number): void {
    const platform = this.miners.platform()
    if (!platform) return
    const range = this.defenseUpgrades.range(this.config)
    const targets = this.miners.enemiesWithin('player', platform, range)
    if (targets.length === 0) return
    const next = platform.fireCooldownMs - dtMs
    if (next > 0) {
      platform.fireCooldownMs = next
      return
    }
    let target = targets[0]
    let best = Infinity
    for (const item of targets) {
      const dist = Math.hypot(item.x - platform.x, item.y - platform.y)
      if (dist < best) {
        best = dist
        target = item
      }
    }
    this.shots.fire({
      x: platform.x,
      y: platform.y,
      targetX: target.x,
      targetY: target.y,
      asteroidId: null,
      shipId: target.id,
      side: 'player',
      damage: this.defenseUpgrades.value('damage', this.config),
      splash: false,
      cannon: false,
      mining: false,
      heavy: true,
    })
    const reloaded = next + this.defenseUpgrades.interval(this.config)
    platform.fireCooldownMs = reloaded < 0 ? 0 : reloaded
  }

  upgradeDefense(upgrade: DefenseUpgradeId): UpgradeResult | 'unknown' {
    if (!this.mining.hasTractor()) return 'unknown'
    if (upgrade !== 'capacity' && !this.defenseUpgrades.owned(this.config)) return 'unknown'
    const before = this.defenseUpgrades.value('health', this.config)
    const pay = this.defenseUpgrades.paysCrystals(upgrade, this.config) ? this.buyCrystal.bind(this) : this.buy.bind(this)
    const result = pay(
      this.defenseUpgrades.maxed(upgrade, this.config),
      this.defenseUpgrades.price(upgrade, this.config),
      () => this.defenseUpgrades.buy(upgrade),
    )
    if (result === 'ok' && upgrade === 'capacity') {
      this.defenseElapsedMs = 0
      this.spawnPlatformNow()
    }
    if (result === 'ok' && upgrade === 'health') {
      const next = this.defenseUpgrades.value('health', this.config)
      this.miners.raisePlatformHealth(next - before, next)
    }
    return result
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
        heavy: false,
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

  /** While the fleet is under the cap, one ship is produced per spawn interval. At the cap, the clock is off. */
  private replenishRivals(dtMs: number): void {
    if (this.miners.rivalCount >= this.rivalCap) {
      this.rivalElapsedMs = 0
      return
    }
    this.rivalElapsedMs += dtMs
    const wait = this.enemyUpgrades.replenishInterval(this.config) * (this.corvetteOwned ? 2 : 1)
    while (this.rivalElapsedMs >= wait && this.miners.rivalCount < this.rivalCap) {
      this.rivalElapsedMs -= wait
      this.miners.spawn('rival', this.world)
    }
    if (this.miners.rivalCount >= this.rivalCap) this.rivalElapsedMs = 0
  }

  /** While under the corvette cap, one corvette is produced per spawn interval. At the cap, the clock is off. */
  private replenishCorvettes(dtMs: number): void {
    const cap = this.corvetteUpgrades.cap(this.corvetteOwned, this.config)
    if (this.miners.corvetteCount >= cap) {
      this.corvetteElapsedMs = 0
      return
    }
    this.corvetteElapsedMs += dtMs
    const wait = this.corvetteUpgrades.spawnInterval(this.config)
    while (this.corvetteElapsedMs >= wait && this.miners.corvetteCount < cap) {
      this.corvetteElapsedMs -= wait
      this.miners.spawnCorvette(this.world)
    }
    if (this.miners.corvetteCount >= cap) this.corvetteElapsedMs = 0
  }

  private launchFighter(dtMs: number): void {
    this.releaseFighters()
    for (let index = 0; index < this.bays.length; index += 1) this.tickBay(index, dtMs)
    this.releaseFighters()
  }

  private tickBay(index: number, dtMs: number): void {
    const bay = this.bays[index]
    const cap = this.bayShipCap(index)
    if (index === 0 && this.fighterQueue.length >= BUILD_QUEUE_CAP && (this.flyingByBay()[0] ?? 0) >= cap) return
    const overflow = index === 0 && cap > 0 && this.fighterQueue.length < BUILD_QUEUE_CAP
    if (bay.pending === 0 && !overflow) return
    bay.work += this.bayRate(index) * dtMs
    const cost = this.productionUnits(index) * 1000
    if (cost === 0) return
    while (bay.work >= cost && (bay.pending > 0 || overflow)) {
      if ((this.flyingByBay()[index] ?? 0) < cap) {
        bay.work -= cost
        if (bay.pending > 0) bay.pending -= 1
        this.spawnProduction(bay.design, index)
      } else if (index === 0 && this.fighterQueue.length < BUILD_QUEUE_CAP) {
        bay.work -= cost
        if (bay.pending > 0) bay.pending -= 1
        this.fighterQueue.push(bay.design)
        if (this.fighterQueue.length >= BUILD_QUEUE_CAP) {
          bay.work = 0
          break
        }
      } else {
        bay.work = cost
        break
      }
    }
    if (bay.pending === 0 && cap === 0) bay.work = 0
  }

  /** A destroyed fighter is replaced from the first bay's finished queue. */
  private releaseFighters(): void {
    const cap = this.bayShipCap(0)
    while (this.fighterQueue.length > 0 && (this.flyingByBay()[0] ?? 0) < cap) {
      const design = this.fighterQueue.shift()
      if (design !== undefined) this.spawnProduction(design, 0)
    }
  }

  private spawnProduction(design: ProductionDesign, bay: number): void {
    const craft = design === 'fighter' ? null : this.design.combatNamed(this.config, design, this.weaponMods())
    this.miners.spawnFighter(this.world, craft === null ? null : { speed: craft.speed, damage: craft.damage, weapons: craft.weapons.map(gun => ({ ...gun })), cooldown: { weapon: 0, laser: 0, missile: 0 }, cells: craft.cells }, craft?.health ?? null, bay)
  }

  /** Miners on the field plus miners still in the build queue. */
  private minersHeld(): number {
    return this.miners.playerCount + this.pendingMiners
  }

  /** Keep a miner building or flying for each one the count upgrade allows. */
  private fillMiners(): void {
    while (this.minersHeld() < this.upgrades.value('count', this.config)) this.pendingMiners += 1
  }

  /** Ships this bay keeps. Bay 0 is the fighter count. An extra bay starts at the first capacity row. */
  private bayShipCap(index: number): number {
    if (index === 0) return this.fighterUpgrades.value('count', this.config)
    const spec = this.config.designer.bayCapacity
    return upgradeValue(spec, this.bays[index].capacity)
  }

  /** Flying fighters built by each bay. */
  private flyingByBay(): number[] {
    return this.miners.fighterBays(this.bays.length)
  }

  /** Keep each bay building until it has its own ships. The first bay's finished queue counts toward its cap. */
  private fillFighters(): void {
    const flying = this.flyingByBay()
    for (let index = 0; index < this.bays.length; index += 1) {
      const queued = index === 0 ? this.fighterQueue.length : 0
      const have = flying[index] + this.bays[index].pending + queued
      const cap = this.bayShipCap(index)
      for (let n = have; n < cap; n += 1) this.bays[index].pending += 1
    }
  }

  private bayCapacityCost(index: number): number | null {
    if (index === 0) return this.fighterUpgrades.maxed('count', this.config) ? null : this.fighterUpgrades.price('count', this.config)
    const spec = this.config.designer.bayCapacity
    const level = this.bays[index].capacity
    if (upgradeMaxed(spec, level)) return null
    return upgradePrice(spec, level)
  }

  private nextMiner(): { progress: number; cells: { x: number; y: number; color: string }[] } | null {
    if (this.mining.hasAutomine()) return null
    if (this.upgrades.value('count', this.config) <= 0) return null
    const cells = ShipDesign.minerHull(this.config)
    if (this.minerReady >= BUILD_QUEUE_CAP) return { progress: 1, cells }
    return {
      progress: Math.min(1, this.minerWork / (this.config.ships.units * 1000)),
      cells,
    }
  }

  /** Stays once that bay is unlocked. Bay 0 unlocks with the first fighter. */
  private bayBar(index: number): { progress: number; cells: { x: number; y: number; color: string }[] } | null {
    const bay = this.bays[index]
    if (!bay) return null
    if (index === 0 && this.bayShipCap(0) <= 0) return null
    const halted = index === 0 && this.fighterQueue.length >= BUILD_QUEUE_CAP
    const units = this.productionUnits(index)
    const saved = bay.design === 'fighter' ? null : this.design.layoutOf(this.config, bay.design)
    const cells = saved
      ? saved.cells.map(cell => ({ x: cell.x, y: cell.y, color: cell.color }))
      : ShipDesign.minerHull(this.config)
    if (units === 0 || halted) return { progress: 1, cells }
    return { progress: Math.min(1, bay.work / (units * 1000)), cells }
  }

  /** Units per second on one bay. The fighter rate, scaled down, then raised by this bay's purchases. */
  private bayRate(index: number): number {
    const spec = this.config.designer.bayProduction
    const base = this.fighterUpgrades.value('production', this.config) * spec.scale
    return base * spec.bonus ** this.bays[index].production
  }

  private bayProductionCost(level: number): number | null {
    const spec = this.config.designer.bayProduction
    if (upgradeMaxed(spec, level)) return null
    return upgradePrice(spec, level)
  }

  /** Build units for the ship selected on that fleet bay. */
  private productionUnits(index: number): number {
    const design = this.bays[index].design
    if (design !== 'fighter') {
      const saved = this.design.layoutOf(this.config, design)
      if (saved) return saved.units
    }
    return this.config.fighter.units
  }

  private fleetScene(): FleetScene {
    const choices: FleetScene['choices'] = [{
      id: 'fighter',
      label: 'Default fighter',
      units: this.config.fighter.units,
      cells: ShipDesign.minerLayout(this.config),
    }]
    for (const named of this.design.save().designs) {
      const layout = this.design.layoutOf(this.config, named.name)
      if (!layout) continue
      choices.push({ id: named.name, label: named.name, units: layout.units, cells: layout.cells })
    }
    const extras: FleetScene['bays'] = []
    for (let index = 1; index <= this.config.designer.bays.length && index <= this.bays.length; index += 1) {
      const owned = index < this.bays.length
      const bay = this.bays[index]
      extras.push({
        index,
        owned,
        crystal: owned ? null : this.config.designer.bays[index - 1],
        selected: owned && this.design.namedParts(bay.design) !== null ? bay.design : 'fighter',
        rate: owned && bay ? this.bayRate(index) : null,
        production: owned && bay ? bay.production : null,
        productionCost: owned && bay ? this.bayProductionCost(bay.production) : null,
        capacity: owned && bay ? this.bayShipCap(index) : null,
        capacityCost: owned && bay ? this.bayCapacityCost(index) : null,
      })
    }
    return {
      selected: this.design.namedParts(this.bays[0].design) !== null ? this.bays[0].design : 'fighter',
      choices,
      rate: this.bayRate(0),
      production: this.bays[0].production,
      productionCost: this.bayProductionCost(this.bays[0].production),
      capacity: this.bayShipCap(0),
      capacityCost: this.bayCapacityCost(0),
      capacityCrystals: this.fighterUpgrades.countPaysCrystals(this.config),
      bays: extras,
    }
  }

  private buy(maxed: boolean, price: number, apply: () => void): UpgradeResult {
    if (maxed) return 'maxed'
    if (!this.bank.spend(price)) return 'broke'
    apply()
    return 'ok'
  }

  private buyCrystal(maxed: boolean, price: number, apply: () => void): UpgradeResult {
    if (maxed) return 'maxed'
    if (this.crystals < price) return 'broke'
    this.crystals -= price
    apply()
    return 'ok'
  }
}
