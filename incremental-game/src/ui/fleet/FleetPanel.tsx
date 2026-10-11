import type { DesignerCell } from '../../core/designer'
import type { FleetScene } from '../../core/game/state'

const CELL = 16
const GAP = 2

export function FleetPanel({
  fleet,
  onChoose,
}: {
  fleet: FleetScene
  onChoose: (design: string) => void
}) {
  const selected = fleet.choices.find(choice => choice.id === fleet.selected) ?? fleet.choices[0]
  return (
    <div data-fleet-design style={{ color: 'white', width: 420 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Fleet Design</h2>
      <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 14, lineHeight: 1.4 }}>
        Choose which ship the build bar produces.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {fleet.choices.map(choice => {
          const active = choice.id === fleet.selected
          return (
            <button
              key={choice.id}
              type="button"
              data-fleet-choice={choice.id}
              onClick={() => onChoose(choice.id)}
              style={{
                padding: '8px 12px',
                backgroundColor: active ? '#1e3a5f' : '#16213e',
                color: 'white',
                border: `1px solid ${active ? '#4ade80' : '#4a9eff'}`,
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              {choice.label}
            </button>
          )
        })}
      </div>
      {selected && (
        <div data-fleet-selected={selected.id}>
          <div data-fleet-units={selected.units} style={{ margin: '0 0 12px', fontWeight: 'bold', fontSize: 16 }}>
            {selected.units} units
          </div>
          <Shape choice={selected.id} cells={selected.cells} />
        </div>
      )}
    </div>
  )
}

function Shape({ choice, cells }: { choice: string; cells: DesignerCell[] }) {
  const minX = Math.min(...cells.map(cell => cell.x))
  const maxX = Math.max(...cells.map(cell => cell.x))
  const minY = Math.min(...cells.map(cell => cell.y))
  const maxY = Math.max(...cells.map(cell => cell.y))
  const boxes = []
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const cell = cells.find(item => item.x === x && item.y === y)
      boxes.push(
        <span
          key={`${x},${y}`}
          data-fleet-cell={cell ? `${x},${y}` : undefined}
          data-fleet-kind={cell?.kind}
          style={{
            width: CELL,
            height: CELL,
            backgroundColor: cell?.color ?? '#0f172a',
            border: '1px solid #334155',
            borderRadius: 2,
          }}
        />,
      )
    }
  }
  const span = maxX - minX + 1
  return (
    <div
      data-fleet-shape={choice}
      style={{ display: 'grid', gridTemplateColumns: `repeat(${span}, ${CELL}px)`, gap: GAP }}
    >
      {boxes}
    </div>
  )
}
