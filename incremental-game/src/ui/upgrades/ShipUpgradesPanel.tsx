import { useState } from 'react'
import type { MinerStats, MinerUpgradeId } from '../../core/miner'

function offer(value: number, cost: number | null): string {
  return cost === null ? `${value} · Max` : `${value} · $${cost}`
}

const SECTIONS: { name?: string; rows: { id: MinerUpgradeId; label: string }[] }[] = [
  {
    rows: [
      { id: 'speed', label: 'Speed' },
      { id: 'damage', label: 'Damage' },
      { id: 'fireRate', label: 'Rate of fire' },
    ],
  },
  {
    name: 'count',
    rows: [
      { id: 'carry', label: 'Carrying capacity' },
      { id: 'count', label: 'Number of miners' },
    ],
  },
  {
    name: 'production',
    rows: [
      { id: 'production', label: 'Production' },
    ],
  },
]

export function ShipUpgradesPanel({
  miner,
  miningUnlock,
  onUpgrade,
  onUnlockMining,
}: {
  miner: MinerStats
  miningUnlock: { owned: boolean; cost: number | null }
  onUpgrade: (upgrade: MinerUpgradeId) => void
  onUnlockMining: () => void
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <div data-ship-upgrades style={{ color: 'white', width: 420 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Ship Upgrades</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            data-upgrade="miner"
            onClick={() => setOpen(true)}
            style={cardStyle}
          >
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>Miner</div>
          </button>
          <button
            type="button"
            data-upgrade="unlock"
            onClick={onUnlockMining}
            style={cardStyle}
          >
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>Mining</div>
            <div style={{ marginTop: 6, color: '#93c5fd' }}>
              {miningUnlock.owned || miningUnlock.cost === null ? 'On · Max' : `Off · $${miningUnlock.cost}`}
            </div>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-ship-upgrades data-miner-upgrades style={{ color: 'white', width: 420 }}>
      <button
        type="button"
        data-upgrade-back
        onClick={() => setOpen(false)}
        style={{
          marginBottom: 12,
          padding: '6px 10px',
          backgroundColor: 'transparent',
          color: '#93c5fd',
          border: '1px solid #4a9eff',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Back
      </button>
      <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Miner</h2>
      {SECTIONS.map(section => (
        <div
          key={section.name ?? 'ship'}
          data-upgrade-section={section.name}
          style={{
            marginTop: section.name ? 28 : 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {section.rows.map(row => (
            <button
              key={row.id}
              type="button"
              data-upgrade={row.id}
              onClick={() => onUpgrade(row.id)}
              style={cardStyle}
            >
              <div style={{ fontSize: 16, fontWeight: 'bold' }}>{row.label}</div>
              <div style={{ marginTop: 6, color: '#93c5fd' }}>
                {offer(miner.values[row.id], miner.costs[row.id])}
              </div>
            </button>
          ))}
        </div>
      ))}
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
