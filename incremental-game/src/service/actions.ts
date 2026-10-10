/**
 * One action the UI, curl, or MCP can send.
 * The real game fills this union in. Until then every act is refused.
 */
export interface GameAction {
  type: string
  upgrade?: string
  component?: string
  x?: number
  y?: number
  rotation?: number
  id?: string
}
