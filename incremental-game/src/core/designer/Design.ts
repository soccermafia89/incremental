import type { GameConfig } from '../../data/GameConfig'
import type { HullCell } from '../miner/types'
import { COMPONENT_IDS, ENGINE_UNLOCK_IDS, GUN_IDS, WEAPON_UNLOCK_IDS, isComponentId, isEngineUnlock, isGunId, isWeaponUnlock, type ComponentId, type EngineUnlockId, type GridCell, type GunId, type WeaponUnlockId } from '../../data/designer'
import { cellKey, connected, CORE_ID, occupy, touches, worldCells, worldMounts } from './geometry'
import { isRotation, type DesignGhost, type DesignResult, type DesignStats, type DesignerCell, type DesignerScene, type PlacedPart, type Rotation, type WeaponMods } from './types'

const EMPTY = '#0f172a'
const CORE_COLOR = '#e2e8f0'

/** The live ship layout. The core square is always present and is not a part. */
export class ShipDesign {
  private unlocked: boolean
  private laser: boolean
  private missile: boolean
  private mediumEngine: boolean
  private largeEngine: boolean
  private parts: PlacedPart[]
  /** The layout the rest of the game uses. The grid can change after this is copied. */
  private saved: PlacedPart[] | null
  private nextId: number

  private constructor(
    unlocked: boolean,
    laser: boolean,
    missile: boolean,
    mediumEngine: boolean,
    largeEngine: boolean,
    parts: PlacedPart[],
    saved: PlacedPart[] | null,
    nextId: number,
  ) {
    this.unlocked = unlocked
    this.laser = laser
    this.missile = missile
    this.mediumEngine = mediumEngine
    this.largeEngine = largeEngine
    this.parts = parts
    this.saved = saved
    this.nextId = nextId
  }

  static create(): ShipDesign {
    return new ShipDesign(false, false, false, false, false, [], null, 1)
  }

  /** Replays the grid and the design the game uses. Throws when either layout could not have been built. */
  static restore(
    config: GameConfig,
    unlocked: boolean,
    laser: boolean,
    missile: boolean,
    mediumEngine: boolean,
    largeEngine: boolean,
    parts: PlacedPart[],
    nextPartId: number,
    savedDesign: PlacedPart[] | null,
  ): ShipDesign {
    const design = new ShipDesign(unlocked, laser, missile, mediumEngine, largeEngine, [], null, 1)
    if (!unlocked && parts.length > 0) throw new Error('parts require the ship designer')
    for (const part of parts) {
      const result = design.place(config, part.component, part.x, part.y, part.rotation, part.id)
      if (result !== 'ok') throw new Error('parts layout is invalid')
    }
    if (nextPartId < design.nextId) throw new Error('nextPartId is already used')
    design.nextId = nextPartId
    if (savedDesign !== null) {
      if (!unlocked) throw new Error('saved design requires the ship designer')
      ShipDesign.replay(config, savedDesign, laser, missile, mediumEngine, largeEngine)
      design.saved = savedDesign.map(part => ({ ...part }))
    }
    return design
  }

  hasUnlock(): boolean {
    return this.unlocked
  }

  unlock(): void {
    this.unlocked = true
  }

  hasWeapon(id: WeaponUnlockId): boolean {
    return id === 'laser' ? this.laser : this.missile
  }

  unlockWeapon(id: WeaponUnlockId): void {
    if (id === 'laser') this.laser = true
    else this.missile = true
  }

  hasEngine(id: EngineUnlockId): boolean {
    return id === 'mediumEngine' ? this.mediumEngine : this.largeEngine
  }

  unlockEngine(id: EngineUnlockId): void {
    if (id === 'mediumEngine') this.mediumEngine = true
    else this.largeEngine = true
  }

  place(config: GameConfig, component: string, x: number, y: number, rotation: number, id?: string): DesignResult {
    const laid = this.layout(config, component, x, y, rotation, id)
    if (typeof laid === 'string') return laid
    this.parts.push({ id: this.claim(id), component: laid.component, x, y, rotation: laid.rotation })
    return 'ok'
  }

  hasSaved(): boolean {
    return this.saved !== null
  }

  /** Speed in px/s, one shot's damage, each powered gun, and the colored squares, from the copied ship. Null before Save design. */
  combat(config: GameConfig, mods: WeaponMods = stockMods(config)): { speed: number; damage: number; fires: DesignStats['fires']; weapons: { kind: GunId; range: number; splash: boolean }[]; health: number; cells: { x: number; y: number; color: string }[] } | null {
    if (this.saved === null) return null
    const stats = this.stats(config, this.saved, mods)
    return {
      speed: stats.speed * config.ships.speed,
      damage: stats.damage,
      fires: stats.fires,
      weapons: poweredGuns(config, this.saved, mods).map(gun => ({ kind: gun.kind, range: gun.range, splash: gun.splash })),
      cells: this.painted(config, this.saved).map(cell => ({ x: cell.x, y: cell.y, color: cell.color })),
      health: stats.health,
    }
  }

  /** The copied ship: its build cost and the cells that make its shape. */
  savedShape(config: GameConfig): { units: number; cells: DesignerCell[] } | null {
    if (this.saved === null) return null
    return {
      units: this.saved.reduce((sum, part) => sum + config.designer.components[part.component].units, 0),
      cells: this.painted(config, this.saved),
    }
  }

  /** Takes every part off the grid. The design copied for production stays until commit. */
  clear(): DesignResult {
    if (!this.unlocked) return 'unknown'
    this.parts = []
    return 'ok'
  }

  /** Replaces the grid. The design copied for production stays until commit. */
  install(config: GameConfig, parts: PlacedPart[]): DesignResult {
    if (!this.unlocked) return 'unknown'
    let laid: ShipDesign
    try {
      laid = ShipDesign.restore(config, true, this.laser, this.missile, this.mediumEngine, this.largeEngine, parts, nextPartNumber(parts), null)
    } catch {
      return 'layout'
    }
    const saved = laid.save()
    this.parts = saved.parts
    this.nextId = saved.nextPartId
    return 'ok'
  }

  /** Copies the current grid. Later edits stay on the grid until this runs again. */
  commit(): DesignResult {
    if (!this.unlocked) return 'unknown'
    this.saved = this.parts.map(part => ({ ...part }))
    return 'ok'
  }

  remove(config: GameConfig, id: string): DesignResult {
    if (!this.unlocked) return 'unknown'
    if (!this.parts.some(part => part.id === id)) return 'unknown'
    const remaining = this.parts.filter(part => part.id !== id)
    if (!connected(config, remaining)) return 'disconnect'
    this.parts = remaining
    return 'ok'
  }

  /** The part under the cursor, including a placement that will not bolt on. */
  preview(config: GameConfig, component: string, x: number, y: number, rotation: number): DesignGhost | null {
    if (!this.unlocked || !isComponentId(component) || !isRotation(rotation)) return null
    const spec = config.designer.components[component]
    const cells = worldCells(spec, x, y, rotation)
    const mounts = worldMounts(spec, x, y, rotation)
    const laid = this.layout(config, component, x, y, rotation)
    return { cells, mounts, legal: typeof laid !== 'string' }
  }

  scene(config: GameConfig, mods: WeaponMods = stockMods(config)): DesignerScene {
    const half = config.designer.half
    const occupied = occupy(config, this.parts)
    const cells: DesignerCell[] = []
    for (let y = -half; y <= half; y += 1) {
      for (let x = -half; x <= half; x += 1) {
        const spot = occupied.get(cellKey(x, y))
        if (!spot) {
          cells.push({ x, y, kind: 'empty', partId: null, component: null, color: EMPTY, mounts: [] })
          continue
        }
        if (spot.id === CORE_ID) {
          cells.push({ x, y, kind: 'core', partId: null, component: null, color: CORE_COLOR, mounts: spot.mounts })
          continue
        }
        const part = this.parts.find(item => item.id === spot.id)
        const spec = part ? config.designer.components[part.component] : undefined
        cells.push({
          x,
          y,
          kind: 'part',
          partId: spot.id,
          component: part?.component ?? null,
          color: spec?.color ?? EMPTY,
          mounts: spot.mounts,
        })
      }
    }
    return {
      owned: this.unlocked,
      cost: this.unlocked ? null : config.designer.cost,
      units: this.parts.reduce((sum, part) => sum + config.designer.components[part.component].units, 0),
      stats: this.stats(config, this.parts, mods),
      saved: this.saved === null ? null : {
        units: this.saved.reduce((sum, part) => sum + config.designer.components[part.component].units, 0),
        stats: this.stats(config, this.saved, mods),
      },
      half,
      cells,
      weapons: WEAPON_UNLOCK_IDS.map(id => {
        const spec = config.designer.components[id]
        const owned = this.hasWeapon(id)
        return {
          id,
          label: spec.label,
          cost: owned ? null : config.designer.weapons[id].cost,
          range: drawnRange(id, spec.range, mods),
          energy: drawnEnergy(id, spec.energy, mods),
          units: spec.units,
        }
      }),
      engines: ENGINE_UNLOCK_IDS.map(id => {
        const spec = config.designer.components[id]
        const owned = this.hasEngine(id)
        return {
          id,
          label: spec.label,
          cost: owned ? null : config.designer.engines[id].cost,
          thrust: spec.thrust,
          energy: spec.energy,
          units: spec.units,
          cells: spec.cells.length,
        }
      }),
      catalog: COMPONENT_IDS.filter(id => this.allowed(id)).map(id => {
        const spec = config.designer.components[id]
        return {
          id,
          label: spec.label,
          units: spec.units,
          weight: spec.weight,
          thrust: spec.thrust,
          energy: drawnEnergy(id, spec.energy, mods),
          health: spec.health,
          range: drawnRange(id, spec.range, mods),
          damage: isGunId(id) ? (id === 'missile' ? mods.missileDamage : id === 'weapon' ? mods.cannonDamage : config.designer.weaponDamage) : 0,
          interval: isGunId(id) ? fireInterval(config, id, 1, mods) : 0,
          color: spec.color,
          cells: spec.cells.map(cell => ({ ...cell })),
        }
      }),
    }
  }

  save(): { shipDesigner: boolean; laser: boolean; missile: boolean; mediumEngine: boolean; largeEngine: boolean; parts: PlacedPart[]; nextPartId: number; savedDesign: PlacedPart[] | null } {
    return {
      shipDesigner: this.unlocked,
      laser: this.laser,
      missile: this.missile,
      mediumEngine: this.mediumEngine,
      largeEngine: this.largeEngine,
      parts: this.parts.map(part => ({ ...part })),
      nextPartId: this.nextId,
      savedDesign: this.saved?.map(part => ({ ...part })) ?? null,
    }
  }

  /** Core weight plus every part. Speed is thrust divided by that weight. Health is the core plus hull blocks. */
  private stats(config: GameConfig, parts: PlacedPart[], mods: WeaponMods): { weight: number; thrust: number; speed: number; energy: number; health: number; damage: number; fires: DesignStats['fires']; range: number } {
    let weight = config.designer.core.weight
    let thrust = 0
    let energy = 0
    let health = config.designer.core.health
    for (const part of parts) {
      const spec = config.designer.components[part.component]
      weight += spec.weight
      thrust += spec.thrust
      energy += drawnEnergy(part.component, spec.energy, mods)
      health += spec.health
    }
    const guns = poweredGuns(config, parts, mods)
    const missileOnly = guns.length > 0 && guns.every(gun => gun.kind === 'missile')
    const cannon = guns.some(gun => gun.kind === 'weapon')
    return {
      weight,
      thrust,
      speed: thrust / weight,
      energy,
      health,
      damage: guns.length === 0 ? 0 : missileOnly ? mods.missileDamage : cannon ? mods.cannonDamage : config.designer.weaponDamage,
      fires: GUN_IDS.flatMap(kind => {
        const matching = guns.filter(gun => gun.kind === kind)
        if (matching.length === 0) return []
        return [{
          kind,
          label: config.designer.components[kind].label,
          damage: kind === 'missile' ? mods.missileDamage : kind === 'weapon' ? mods.cannonDamage : config.designer.weaponDamage,
          interval: fireInterval(config, kind, matching.length, mods),
          range: matching[0].range,
        }]
      }),
      range: guns.reduce((max, gun) => Math.max(max, gun.range), 0),
    }
  }

  private allowed(component: ComponentId): boolean {
    if (component === 'minerLaser') return false
    if (isWeaponUnlock(component)) return this.hasWeapon(component)
    if (isEngineUnlock(component)) return this.hasEngine(component)
    return true
  }

  /** Core, stock thruster, and the miner laser. Graphics only. Miner upgrades still set the stats. */
  static minerLayout(config: GameConfig): DesignerCell[] {
    const design = new ShipDesign(true, false, false, false, false, [], null, 1)
    const parts: { component: ComponentId; x: number; y: number }[] = [
      { component: 'minerLaser', x: 0, y: -1 },
      { component: 'thruster', x: 0, y: 1 },
    ]
    for (const part of parts) {
      const laid = design.layout(config, part.component, part.x, part.y, 0, undefined, false)
      if (typeof laid === 'string') throw new Error(`miner ${part.component} does not fit`)
      design.parts.push({
        id: design.claim(),
        component: laid.component,
        x: part.x,
        y: part.y,
        rotation: laid.rotation,
      })
    }
    return design.painted(config, design.parts)
  }

  static minerHull(config: GameConfig): HullCell[] {
    return ShipDesign.minerLayout(config).map(cell => ({ x: cell.x, y: cell.y, color: cell.color }))
  }

  private layout(
    config: GameConfig,
    component: string,
    x: number,
    y: number,
    rotation: number,
    id?: string,
    offered = true,
  ): DesignResult | { component: ComponentId; rotation: Rotation; cells: GridCell[] } {
    if (!this.unlocked || !isComponentId(component) || !isRotation(rotation)) return 'unknown'
    if (offered && !this.allowed(component)) return 'unknown'
    if (id !== undefined && !/^part-[1-9]\d*$/.test(id)) return 'unknown'
    if (id !== undefined && this.parts.some(part => part.id === id)) return 'unknown'
    const spec = config.designer.components[component]
    const cells = worldCells(spec, x, y, rotation)
    const mounts = worldMounts(spec, x, y, rotation)
    const half = config.designer.half
    if (cells.some(cell => Math.abs(cell.x) > half || Math.abs(cell.y) > half)) return 'bounds'
    const occupied = occupy(config, this.parts)
    if (cells.some(cell => occupied.has(cellKey(cell.x, cell.y)))) return 'overlap'
    if (!touches(occupied, mounts)) return 'attach'
    return { component, rotation, cells }
  }

  private claim(requested?: string): string {
    if (requested === undefined) {
      const id = `part-${this.nextId}`
      this.nextId += 1
      return id
    }
    const number = Number(requested.slice('part-'.length))
    if (number >= this.nextId) this.nextId = number + 1
    return requested
  }

  /** Core and parts only, in the colors the designer uses. */
  private painted(config: GameConfig, parts: PlacedPart[]): DesignerCell[] {
    const occupied = occupy(config, parts)
    const cells: DesignerCell[] = []
    for (const [key, spot] of occupied) {
      const [x, y] = key.split(',').map(Number)
      if (spot.id === CORE_ID) {
        cells.push({ x, y, kind: 'core', partId: null, component: null, color: CORE_COLOR, mounts: spot.mounts })
        continue
      }
      const part = parts.find(item => item.id === spot.id)
      const spec = part ? config.designer.components[part.component] : undefined
      cells.push({
        x,
        y,
        kind: 'part',
        partId: spot.id,
        component: part?.component ?? null,
        color: spec?.color ?? EMPTY,
        mounts: spot.mounts,
      })
    }
    return cells
  }

  /** Places a copied layout on a throwaway ship so a bad snapshot cannot load. */
  private static replay(config: GameConfig, parts: PlacedPart[], laser: boolean, missile: boolean, mediumEngine: boolean, largeEngine: boolean): void {
    const check = new ShipDesign(true, laser, missile, mediumEngine, largeEngine, [], null, 1)
    for (const part of parts) {
      const result = check.place(config, part.component, part.x, part.y, part.rotation, part.id)
      if (result !== 'ok') throw new Error('saved design is invalid')
    }
  }
}

function nextPartNumber(parts: PlacedPart[]): number {
  let next = 1
  for (const part of parts) {
    const number = Number(part.id.slice('part-'.length))
    if (number >= next) next = number + 1
  }
  return next
}

function stockMods(config: GameConfig): WeaponMods {
  return {
    laserRange: config.designer.components.laser.range,
    laserEnergy: config.designer.components.laser.energy,
    cannonRate: 1,
    cannonDamage: config.weaponUpgrades.cannonDamage.start,
    missileRate: 1,
    missileDamage: config.weaponUpgrades.missileDamage.start,
  }
}

function drawnEnergy(component: string, energy: number, mods: WeaponMods): number {
  return component === 'laser' ? mods.laserEnergy : energy
}

function drawnRange(component: string, range: number, mods: WeaponMods): number {
  return component === 'laser' ? mods.laserRange : range
}

/** Milliseconds between shots of one gun type. Each powered gun of that type shortens its wait. */
function fireInterval(config: GameConfig, kind: GunId, guns: number, mods: WeaponMods): number {
  if (kind === 'weapon') {
    return ratedWait(config.weaponUpgrades.cannonFireRate, mods.cannonRate, guns)
  }
  if (kind === 'missile') {
    return ratedWait(config.weaponUpgrades.missileFireRate, mods.missileRate, guns)
  }
  if (guns <= 0) return config.ships.shotIntervalMs
  return Math.max(1, Math.round(config.ships.shotIntervalMs / guns))
}

function ratedWait(spec: { baseMs: number; start: number }, rate: number, guns: number): number {
  if (guns <= 0 || rate <= 0) return spec.baseMs
  return Math.max(1, Math.round(spec.baseMs * spec.start / rate / guns))
}

/** Guns that still have energy after the other parts have drawn. Each gun spends its own cost, in placement order. */
function poweredGuns(config: GameConfig, parts: PlacedPart[], mods: WeaponMods): { kind: GunId; range: number; splash: boolean }[] {
  const guns: { kind: GunId; energy: number; range: number; splash: boolean }[] = []
  let supply = 0
  let drain = 0
  for (const part of parts) {
    const spec = config.designer.components[part.component]
    const range = drawnRange(part.component, spec.range, mods)
    const energy = drawnEnergy(part.component, spec.energy, mods)
    if (range > 0 && isGunId(part.component)) {
      guns.push({ kind: part.component, energy, range, splash: part.component === 'missile' })
      continue
    }
    if (energy >= 0) supply += energy
    else drain += -energy
  }
  let spare = supply - drain
  const powered: { kind: GunId; range: number; splash: boolean }[] = []
  for (const gun of guns) {
    const cost = Math.max(0, -gun.energy)
    if (spare < cost) continue
    spare -= cost
    powered.push({ kind: gun.kind, range: gun.range, splash: gun.splash })
  }
  return powered
}
