import type { GunId } from '../../data/designer'
import { UPGRADE_IDS, type UpgradeId, type UpgradeLevels } from '../../data/upgrades'

export const SHIP_MODES = ['wait', 'engage', 'shoot', 'collect', 'back', 'hunt', 'attack'] as const
export type ShipMode = (typeof SHIP_MODES)[number]
export const SHIP_ROLES = ['miner', 'fighter', 'corvette', 'platform'] as const
export type ShipRole = (typeof SHIP_ROLES)[number]
export type Side = 'player' | 'rival'
export const MINER_UPGRADES = UPGRADE_IDS
export type MinerUpgradeId = UpgradeId
export type UpgradeResult = 'ok' | 'broke' | 'maxed'

export interface MinerStats {
  values: UpgradeLevels
  costs: Record<UpgradeId, number | null>
}

export interface ShipState {
  id: string
  x: number
  y: number
  cargo: number
  /** Money already in the hold. Each nugget adds its own worth. */
  cargoValue: number
  mode: ShipMode
  targetId: string | null
  fireCooldownMs: number
  /** True once this corvette carries a missile. Other ships leave it false. */
  missiles: boolean
  /** Milliseconds until that missile can fire. Other ships leave it at 0. */
  missileCooldownMs: number
  /** The next corvette cannon shot. 0 is port, 1 is starboard. Other ships leave it at 0. */
  cannonSide: 0 | 1
  /** Which production bay built this fighter. Null on every other ship. A null fighter counts as bay 0. */
  bay: number | null
  side: Side
  role: ShipRole
  health: number
  maxHealth: number
  /** Speed, shot damage, each powered gun, and colored squares copied from a saved design. Null uses the fighter upgrades and the stock dart. */
  craft: {
    speed: number
    damage: number
    weapons: { kind: GunId; range: number; splash: boolean }[]
    /** Milliseconds until that gun type can fire. Each type waits on its own. */
    cooldown: Record<GunId, number>
    cells: HullCell[]
  } | null
}

/** One square of a designed ship, in designer-grid coordinates. */
export interface HullCell {
  x: number
  y: number
  color: string
}

export function copyShip(ship: ShipState): ShipState {
  if (ship.craft === null) return { ...ship }
  return {
    ...ship,
    craft: {
      ...ship.craft,
      weapons: ship.craft.weapons.map(gun => ({ ...gun })),
      cooldown: { ...ship.craft.cooldown },
      cells: ship.craft.cells.map(cell => ({ ...cell })),
    },
  }
}
