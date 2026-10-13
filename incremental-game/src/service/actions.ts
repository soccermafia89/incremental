/**
 * One action the UI, curl, or MCP can send.
 * The real game fills this union in. Until then every act is refused.
 */
export interface GameAction {
  type: string
  /** Miner, mining, fighter, enemy, defense, or weapon upgrade id. */
  upgrade?: string
  component?: string
  x?: number
  y?: number
  rotation?: number
  id?: string
  /** `fighter`, or a saved design name such as `ship1`, for chooseProduction. */
  design?: string
  /** Bay index for chooseProduction, upgradeBay, and upgradeBayCapacity. Omitted on chooseProduction means the first bay. */
  bay?: number
  /** `laser` or `missile` for unlockWeapon. */
  weapon?: string
  /** `mediumEngine` or `largeEngine` for unlockEngine. */
  engine?: string
  /** A ship-design JSON file for importDesign. */
  blueprint?: unknown
  /** `ship1`, `ship2`, ... for loadDesign, rewriteDesign, and deleteDesign. */
  name?: string
}
