/**
 * One action the UI, curl, or MCP can send.
 * The real game fills this union in. Until then every act is refused.
 */
export interface GameAction {
  type: string
  /** Miner, mining, fighter, enemy, or weapon upgrade id. */
  upgrade?: string
  component?: string
  x?: number
  y?: number
  rotation?: number
  id?: string
  /** `fighter` or `saved` for chooseProduction. */
  design?: string
  /** `laser` or `missile` for unlockWeapon. */
  weapon?: string
  /** `mediumEngine` or `largeEngine` for unlockEngine. */
  engine?: string
  /** A ship-design JSON file for importDesign. */
  blueprint?: unknown
}
