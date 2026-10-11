import type { ComponentId, EngineUnlockId, GridCell, GunId, Mount, Side, WeaponUnlockId } from '../../data/designer'

export const ROTATIONS = [0, 90, 180, 270] as const
export type Rotation = (typeof ROTATIONS)[number]

export type DesignResult = 'ok' | 'unknown' | 'attach' | 'overlap' | 'bounds' | 'disconnect' | 'layout'

export interface PlacedPart {
  id: string
  component: ComponentId
  x: number
  y: number
  rotation: Rotation
}

export interface DesignerCell {
  x: number
  y: number
  kind: 'empty' | 'core' | 'part'
  partId: string | null
  component: ComponentId | null
  color: string
  mounts: Side[]
}

/** The part under the cursor. legal is false when it cannot bolt on. */
export interface DesignGhost {
  cells: GridCell[]
  mounts: Mount[]
  legal: boolean
}

/** Placed parts plus the core. Speed is thrust divided by weight. */
export interface DesignStats {
  weight: number
  thrust: number
  speed: number
  /** Granted energy minus what the parts consume. */
  energy: number
  /** Core health plus every structural and armor block. */
  health: number
  /** Damage of one shot. Zero when no weapon has power. */
  damage: number
  /** One timer per gun type that has power. Extra guns of that type shorten its wait. */
  fires: { kind: GunId; label: string; damage: number; interval: number; range: number }[]
  /** Farthest powered gun. Zero when no weapon has power. */
  range: number
}

export interface DesignerScene {
  owned: boolean
  /** Unlock price. Null once the designer is owned. */
  cost: number | null
  /** Production units to build the parts on the ship. The core is free. */
  units: number
  stats: DesignStats
  /** The copy other parts of the game use. Null until Save design. */
  saved: { units: number; stats: DesignStats } | null
  half: number
  cells: DesignerCell[]
  /** Laser and missile, sold on Ship Upgrades once the designer is owned. */
  weapons: { id: WeaponUnlockId; label: string; cost: number | null; range: number; energy: number; units: number }[]
  /** Medium and large engines, sold on Ship Upgrades once the designer is owned. */
  engines: { id: EngineUnlockId; label: string; cost: number | null; thrust: number; energy: number; units: number; cells: number }[]
  catalog: { id: ComponentId; label: string; units: number; weight: number; thrust: number; energy: number; health: number; range: number; damage: number; interval: number; color: string; cells: GridCell[] }[]
}

/** Live cannon, laser, and missile purchases. Omitted calls use the part's own numbers. */
export interface WeaponMods {
  laserRange: number
  /** Energy the laser draws. Negative, or zero once the draw is gone. */
  laserEnergy: number
  /** 1 is the stock cannon interval. */
  cannonRate: number
  cannonDamage: number
  /** 1 is the stock missile interval. */
  missileRate: number
  missileDamage: number
}

export function isRotation(value: number): value is Rotation {
  return value === 0 || value === 90 || value === 180 || value === 270
}

const REFUSAL: Record<Exclude<DesignResult, 'ok' | 'unknown'>, string> = {
  attach: 'That piece does not attach to the ship.',
  overlap: 'That space is already taken.',
  bounds: 'That sits outside the grid.',
  disconnect: 'That would leave part of the ship unattached.',
  layout: 'That file is not a ship design.',
}

export function designError(result: Exclude<DesignResult, 'ok' | 'unknown'>): string {
  return REFUSAL[result]
}
