import { UPGRADE_IDS, type UpgradeId, type UpgradeLevels } from '../../data/upgrades'

export const SHIP_MODES = ['wait', 'engage', 'shoot', 'collect', 'back', 'hunt', 'attack'] as const
export type ShipMode = (typeof SHIP_MODES)[number]
export const SHIP_ROLES = ['miner', 'fighter'] as const
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
  side: Side
  role: ShipRole
  health: number
  maxHealth: number
}

export function copyShip(ship: ShipState): ShipState {
  return { ...ship }
}
