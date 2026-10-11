import type { MiningId, MiningPurchase } from '../../data/mining'
import type { MiningStats } from '../../core/mining/Mining'

function offer(value: number, cost: number | null): string {
  return cost === null ? `${value} · Max` : `${value} · $${cost}`
}

const ROWS: { id: MiningId; label: string }[] = [
  { id: 'size', label: 'Asteroid size' },
  { id: 'spawnRate', label: 'Asteroid spawn rate' },
]

export function MiningPanel({
  mining,
  onUpgrade,
}: {
  mining: MiningStats
  onUpgrade: (upgrade: MiningPurchase) => void
}) {
  const beam = mining.tractorBeam
  if (!mining.unlock.owned) {
    return (
      <div data-mining-upgrades style={{ color: 'white', width: 420 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Mining</h2>
        <button
          type="button"
          data-upgrade="unlock"
          onClick={() => onUpgrade('unlock')}
          style={cardStyle}
        >
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>Unlock mining</div>
          <div style={{ marginTop: 6, color: '#93c5fd' }}>
            {mining.unlock.cost === null ? 'On · Max' : `Off · $${mining.unlock.cost}`}
          </div>
        </button>
      </div>
    )
  }
  return (
    <div data-mining-upgrades style={{ color: 'white', width: 420 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Mining</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
              {offer(mining.values[row.id], mining.costs[row.id])}
            </div>
          </button>
        ))}
      </div>
      <div
        data-upgrade-section="golden"
        style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <button
          type="button"
          data-upgrade="golden"
          onClick={() => onUpgrade('golden')}
          style={cardStyle}
        >
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>Golden asteroids</div>
          <div style={{ marginTop: 6, color: '#93c5fd' }}>
            {mining.golden.owned || mining.golden.cost === null ? 'On · Max' : `Off · $${mining.golden.cost}`}
          </div>
        </button>
        {mining.golden.owned && (
          <button
            type="button"
            data-upgrade="goldenSpawnRate"
            onClick={() => onUpgrade('goldenSpawnRate')}
            style={cardStyle}
          >
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>Golden spawn rate</div>
            <div style={{ marginTop: 6, color: '#93c5fd' }}>
              {offer(mining.values.goldenSpawnRate, mining.costs.goldenSpawnRate)}
            </div>
          </button>
        )}
      </div>
      <div
        data-upgrade-section="tractor"
        style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <button
          type="button"
          data-upgrade="tractorBeam"
          onClick={() => onUpgrade('tractorBeam')}
          style={cardStyle}
        >
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>Tractor beam</div>
          <div style={{ marginTop: 6, color: '#93c5fd' }}>
            {beam.owned || beam.cost === null ? 'On · Max' : `Off · $${beam.cost}`}
          </div>
        </button>
      </div>
      {beam.owned && !mining.automine.owned && (
        <div
          data-upgrade-section="automine"
          style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <button
            type="button"
            data-upgrade="automine"
            onClick={() => onUpgrade('automine')}
            style={cardStyle}
          >
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>Automine</div>
            <div style={{ marginTop: 6, color: '#93c5fd' }}>
              ${mining.automine.perSecond}/s · ${mining.automine.cost}
            </div>
          </button>
        </div>
      )}
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
