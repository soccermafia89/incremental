import type { Game } from '../../core/game/Game'
import { GameSerializer } from '../../core/persistence/GameSerializer'

export function DevGameStatePanel({ game }: { game: Game }) {
  const snapshot = GameSerializer.serialize(game)
  return (
    <pre style={{
      width: '1000px',
      height: '650px',
      margin: 0,
      padding: '20px',
      boxSizing: 'border-box',
      overflow: 'auto',
      textAlign: 'left',
      color: 'white',
      fontSize: '13px',
    }}>
      {JSON.stringify(snapshot, null, 2)}
    </pre>
  )
}
