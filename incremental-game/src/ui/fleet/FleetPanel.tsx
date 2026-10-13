import type { DesignerCell } from '../../core/designer'
import type { FleetChoice, FleetScene, ProductionDesign } from '../../core/game/state'

const CELL = 16
const GAP = 2

export function FleetPanel({
  fleet,
  onChoose,
  onUnlockBay,
  onUpgrade,
  onCapacity,
}: {
  fleet: FleetScene
  onChoose: (design: string, bay: number) => void
  onUnlockBay: () => void
  onUpgrade: (bay: number) => void
  onCapacity: (bay: number) => void
}) {
  return (
    <div data-fleet-design style={{ color: 'white', width: 420 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Fleet Design</h2>
      <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 14, lineHeight: 1.4 }}>
        Choose which ship the build bar produces. Capacity is how many ships that bay keeps. Production raises that bay by 50%.
      </p>
      <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Bay 1</h3>
      <Capacity bay={0} ships={fleet.capacity} cost={fleet.capacityCost} crystal={fleet.capacityCrystals} onCapacity={onCapacity} />
      <Production bay={0} rate={fleet.rate} level={fleet.production} cost={fleet.productionCost} onUpgrade={onUpgrade} />
      <Bay
        bay={0}
        selected={fleet.selected}
        choices={fleet.choices}
        onChoose={onChoose}
      />
      {fleet.bays.map(extra => (
        <div key={extra.index} style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Bay {extra.index + 1}</h3>
          {extra.owned ? (
            <>
              <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 14, lineHeight: 1.4 }}>
                This bay builds at the same time. Its capacity is separate from the other bays.
              </p>
              {extra.capacity !== null && (
                <Capacity bay={extra.index} ships={extra.capacity} cost={extra.capacityCost} onCapacity={onCapacity} />
              )}
              {extra.rate !== null && extra.production !== null && (
                <Production bay={extra.index} rate={extra.rate} level={extra.production} cost={extra.productionCost} onUpgrade={onUpgrade} />
              )}
              <Bay
                bay={extra.index}
                selected={extra.selected}
                choices={fleet.choices}
                onChoose={onChoose}
              />
            </>
          ) : (
            <button
              type="button"
              data-fleet-unlock={extra.index}
              onClick={onUnlockBay}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                backgroundColor: '#16213e',
                color: 'white',
                border: '1px solid #4a9eff',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Bay {extra.index + 1}</div>
              <div style={{ color: '#c4b5fd' }}>Off · {extra.crystal} crystals</div>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function shownRate(rate: number): string {
  return Number.isInteger(rate) ? String(rate) : rate.toFixed(2)
}

function Capacity({
  bay,
  ships,
  cost,
  crystal = false,
  onCapacity,
}: {
  bay: number
  ships: number
  cost: number | null
  crystal?: boolean
  onCapacity: (bay: number) => void
}) {
  const price = cost === null ? `${ships} · Max` : crystal ? `${ships} · ${cost} ${cost === 1 ? 'crystal' : 'crystals'}` : `${ships} · $${cost}`
  return (
    <button
      type="button"
      data-bay-capacity={bay}
      onClick={() => onCapacity(bay)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '12px 14px',
        marginBottom: 12,
        backgroundColor: '#16213e',
        color: 'white',
        border: '1px solid #4a9eff',
        borderRadius: 8,
        cursor: 'pointer',
      }}
    >
      <div style={{ fontWeight: 'bold' }}>Capacity</div>
      <div style={{ color: crystal ? '#c4b5fd' : '#93c5fd', marginTop: 4 }}>{price}</div>
    </button>
  )
}

function Production({
  bay,
  rate,
  level,
  cost,
  onUpgrade,
}: {
  bay: number
  rate: number
  level: number
  cost: number | null
  onUpgrade: (bay: number) => void
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div data-bay-rate={bay} style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
        {`${shownRate(rate)} units/s`}
      </div>
      <button
        type="button"
        data-bay-production={bay}
        onClick={() => onUpgrade(bay)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '12px 14px',
          backgroundColor: '#16213e',
          color: 'white',
          border: '1px solid #4a9eff',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        <div style={{ fontWeight: 'bold' }}>Production</div>
        <div style={{ color: '#93c5fd', marginTop: 4 }}>{cost === null ? `${level} · Max` : `${level} · $${cost}`}</div>
      </button>
    </div>
  )
}

function Bay({
  bay,
  selected,
  choices,
  onChoose,
}: {
  bay: number
  selected: ProductionDesign
  choices: FleetChoice[]
  onChoose: (design: string, bay: number) => void
}) {
  const choice = choices.find(item => item.id === selected) ?? choices[0]
  return (
    <div data-fleet-bay={bay}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {choices.map(item => {
          const active = item.id === selected
          return (
            <button
              key={item.id}
              type="button"
              data-fleet-choice={item.id}
              onClick={() => onChoose(item.id, bay)}
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
              {item.label}
            </button>
          )
        })}
      </div>
      {choice && (
        <div data-fleet-selected={bay === 0 ? choice.id : undefined} data-fleet-bay-selected={choice.id}>
          <div data-fleet-units={bay === 0 ? choice.units : undefined} style={{ margin: '0 0 12px', fontWeight: 'bold', fontSize: 16 }}>
            {choice.units} units
          </div>
          <Shape choice={choice.id} cells={choice.cells} />
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
