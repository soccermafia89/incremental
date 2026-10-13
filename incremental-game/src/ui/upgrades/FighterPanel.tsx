import type { FighterUpgradeId } from '../../data/fighter/upgrades'
import type { FighterStats } from '../../core/fighter/Upgrades'

function offer(value: number, cost: number | null, crystal = false): string {
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(2)
  if (cost === null) return `${shown} · Max`
  if (!crystal) return `${shown} · $${cost}`
  return `${shown} · ${cost} ${cost === 1 ? 'crystal' : 'crystals'}`
}

export function FighterPanel({
  fighter,
  onUpgrade,
}: {
  fighter: FighterStats
  onUpgrade: (upgrade: FighterUpgradeId) => void
}) {
  return (
    <div data-fighter-upgrades style={{ color: 'white', width: 420 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Default fighter</h2>
      <div data-upgrade-section="count" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          data-upgrade="count"
          onClick={() => onUpgrade('count')}
          style={cardStyle}
        >
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>Number of fighters</div>
          <div style={{ marginTop: 6, color: fighter.countCrystals ? '#c4b5fd' : '#93c5fd' }}>
            {offer(fighter.values.count, fighter.costs.count, fighter.countCrystals)}
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
