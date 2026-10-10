/**
 * User-facing settings that control the shell of the game UI rather than
 * game state itself. Settings are not part of the Game model and are not
 * persisted across reloads.
 */
export interface GameSettings {
  /**
   * When enabled, developer-only views and save/load are exposed.
   */
  devMode: boolean
}

export const DEFAULT_SETTINGS: GameSettings = {
  devMode: false,
}
