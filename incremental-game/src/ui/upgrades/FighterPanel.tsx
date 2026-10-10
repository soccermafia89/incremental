import type { FighterUpgradeId } from '../../data/fighter/upgrades'
import type { FighterStats } from '../../core/fighter/Upgrades'

function offer(value: number, cost: number | null): string {
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(2)
  return cost === null ? `${shown} · Max` : `${shown} · $${cost}`
}

const ROWS: { id: FighterUpgradeId; label: string }[] = [
  { id: 'speed', label: 'Speed' },
  { id: 'attackRate', label: 'Attack rate' },
  { id: 'health', label: 'Health' },
  { id: 'damage', label: 'Damage' },
]

export function FighterPanel({
  fighter,
  onUpgrade,
}: {
  fighter: FighterStats
  onUpgrade: (upgrade: FighterUpgradeId) => void
}) {
  return (
    <div data-fighter-upgrades style={{ color: 'white', width: 420 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Fighter</h2>
      <div data-upgrade-section="count" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          data-upgrade="count"
          onClick={() => onUpgrade('count')}
          style={cardStyle}
        >
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>Number of fighters</div>
          <div style={{ marginTop: 6, color: '#93c5fd' }}>
            {offer(fighter.values.count, fighter.costs.count)}
          </div>
        </button>
        <button
          type="button"
          data-upgrade="production"
          onClick={() => onUpgrade('production')}
          style={cardStyle}
        >
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>Production</div>
          <div style={{ marginTop: 6, color: '#93c5fd' }}>
            {offer(fighter.values.production, fighter.costs.production)}
          </div>
        </button>
      </div>
      <div
        data-upgrade-section="stats"
        style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {ROWS.map(row => (
          <button
            key={row.id}
            type="button"
            data-upgrade={row.id}
            onClick={() => onUpgrade(row.id)}
            style={cardStyle}
          >
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{row.label}</div>
            <div style={{ marginTop: 6, color: '#93c5fd' }}>
              {offer(fighter.values[row.id], fighter.costs[row.id])}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

const cardStyle = {
  width: '100%',
  textAlign: 'left' as const,
  padding: '16px',
  backgroundColor: '#16213e',
  color: 'white',
  border: '1px solid #4a9eff',
  borderRadius: 8,
  cursor: 'pointer',
}
