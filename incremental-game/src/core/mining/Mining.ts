import type { GameConfig } from '../../data/GameConfig'
import { MINING_IDS, blankMiningLevels, type MiningId, type MiningLevels } from '../../data/mining'
import { upgradePrice, upgradeValue } from '../../data/upgradeSpec'

export interface MiningStats {
  values: MiningLevels
  costs: Record<MiningId, number | null>
  golden: { owned: boolean; cost: number | null }
  tractorBeam: { owned: boolean; cost: number | null }
  unlock: { owned: boolean; cost: number | null }
  automine: { owned: boolean; cost: number | null; perSecond: number }
}

/** Player purchases that change the shared asteroid field. */
export class MiningUpgrades {
  private readonly purchased: MiningLevels
  private beam: boolean
  private golden: boolean
  private unlocked: boolean
  private automine: boolean

  private constructor(purchased: MiningLevels, beam: boolean, golden: boolean, unlocked: boolean, automine: boolean) {
    this.purchased = purchased
    this.beam = beam
    this.golden = golden
    this.unlocked = unlocked
    this.automine = automine
  }

  static create(): MiningUpgrades {
    return new MiningUpgrades(blankMiningLevels(), false, false, false, false)
  }

  static restore(purchased: MiningLevels, beam: boolean, golden: boolean, unlocked: boolean, automine: boolean): MiningUpgrades {
    return new MiningUpgrades({ ...purchased }, beam, golden, unlocked, automine)
  }

  levels(): MiningLevels {
    return { ...this.purchased }
  }

  value(upgrade: MiningId, config: GameConfig): number {
    return upgradeValue(config.mining[upgrade], this.purchased[upgrade])
  }

  price(upgrade: MiningId, config: GameConfig): number {
    return upgradePrice(config.mining[upgrade], this.purchased[upgrade])
  }

  maxed(upgrade: MiningId, config: GameConfig): boolean {
    return this.value(upgrade, config) >= config.mining[upgrade].max
  }

  upgrade(upgrade: MiningId): void {
    this.purchased[upgrade] += 1
  }

  stats(config: GameConfig): MiningStats {
    const values = {} as MiningStats['values']
    const costs = {} as MiningStats['costs']
    for (const id of MINING_IDS) {
      values[id] = this.value(id, config)
      costs[id] = this.maxed(id, config) ? null : this.price(id, config)
    }
    return {
      values,
      costs,
      golden: {
        owned: this.golden,
        cost: this.golden ? null : config.mining.golden.cost,
      },
      tractorBeam: {
        owned: this.beam,
        cost: this.beam ? null : config.mining.tractorBeam.cost,
      },
      unlock: {
        owned: this.unlocked,
        cost: this.unlocked ? null : config.mining.unlock.cost,
      },
      automine: {
        owned: this.automine,
        cost: this.automine ? null : config.mining.automine.cost,
        perSecond: config.mining.automine.perSecond,
      },
    }
  }

  hasGolden(): boolean {
    return this.golden
  }

  goldenPrice(config: GameConfig): number {
    return config.mining.golden.cost
  }

  ownGolden(): void {
    this.golden = true
  }

  /** Milliseconds between golden asteroids. Rate 1 is the yaml interval. */
  goldenInterval(config: GameConfig): number {
    const rate = this.value('goldenSpawnRate', config)
    return Math.round(config.golden.spawnMs * config.mining.goldenSpawnRate.start / rate)
  }

  hasUnlock(): boolean {
    return this.unlocked
  }

  unlockPrice(config: GameConfig): number {
    return config.mining.unlock.cost
  }

  ownUnlock(): void {
    this.unlocked = true
  }

  hasAutomine(): boolean {
    return this.automine
  }

  autominePrice(config: GameConfig): number {
    return config.mining.automine.cost
  }

  /** Dollars earned each second once automine is owned. */
  automineIncome(config: GameConfig): number {
    return config.mining.automine.perSecond
  }

  ownAutomine(): void {
    this.automine = true
  }

  hasTractor(): boolean {
    return this.beam
  }

  tractorPrice(config: GameConfig): number {
    return config.mining.tractorBeam.cost
  }

  ownTractor(): void {
    this.beam = true
  }

  /** Nuggets one asteroid drops. */
  loot(config: GameConfig): number {
    return this.value('size', config)
  }

  /** Spawn health. Each size upgrade multiplies the base by `healthScale`. Golden keeps its extra multiplier. */
  rockHealth(config: GameConfig, kind: 'normal' | 'golden'): number {
    const scaled = config.asteroids.health * config.asteroids.healthScale ** this.grown(config)
    const health = kind === 'golden' ? scaled * config.golden.health : scaled
    return Math.round(health)
  }

  rockSize(config: GameConfig): number {
    return config.asteroids.size + this.grown(config) * config.asteroids.sizeStep
  }

  goldenSize(config: GameConfig): number {
    return config.golden.size + this.grown(config) * config.asteroids.sizeStep
  }

  /** How many size upgrades have been bought. Drawing grows by sizeStep each one. */
  private grown(config: GameConfig): number {
    return this.loot(config) - config.mining.size.start
  }

  /** Milliseconds between asteroid spawns. Rate 1 is the yaml interval. */
  spawnInterval(config: GameConfig): number {
    const rate = this.value('spawnRate', config)
    return Math.round(config.asteroids.spawnMs * config.mining.spawnRate.start / rate)
  }
}
