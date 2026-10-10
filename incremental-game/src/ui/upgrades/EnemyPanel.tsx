import { useState } from 'react'
import type { EnemyStats } from '../../core/enemy/Upgrades'
import type { EnemyUpgradeId } from '../../data/enemy/upgrades'

function offer(value: number, cost: number | null): string {
  return cost === null ? `${value} · Max` : `${value} · $${cost}`
}

const FLEET: { id: EnemyUpgradeId; label: string }[] = [
  { id: 'spawnRate', label: 'Spawn rate' },
  { id: 'capacity', label: 'Capacity' },
]

const STATS: { id: EnemyUpgradeId; label: string }[] = [
  { id: 'health', label: 'Health' },
  { id: 'damage', label: 'Damage' },
  { id: 'attackRate', label: 'Attack rate' },
]

export function EnemyPanel({
  enemy,
  onUpgrade,
}: {
  enemy: EnemyStats
  onUpgrade: (upgrade: EnemyUpgradeId) => void
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <div data-enemy-upgrades style={{ color: 'white', width: 420 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Enemy</h2>
        <Bounty multiplier={enemy.bounty} />
        <button type="button" data-upgrade="fighter" onClick={() => setOpen(true)} style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>Fighter</div>
        </button>
      </div>
    )
  }

  return (
    <div data-enemy-upgrades data-enemy-fighter style={{ color: 'white', width: 420 }}>
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
      <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Fighter</h2>
      <Bounty multiplier={enemy.bounty} />
      <UpgradeList rows={FLEET} enemy={enemy} onUpgrade={onUpgrade} />
      <div style={{ marginTop: 28 }}>
        <UpgradeList rows={STATS} enemy={enemy} onUpgrade={onUpgrade} />
      </div>
    </div>
  )
}

function UpgradeList({
  rows,
  enemy,
  onUpgrade,
}: {
  rows: { id: EnemyUpgradeId; label: string }[]
  enemy: EnemyStats
  onUpgrade: (upgrade: EnemyUpgradeId) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(row => (
        <button key={row.id} type="button" data-upgrade={row.id} onClick={() => onUpgrade(row.id)} style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>{row.label}</div>
          <div style={{ marginTop: 6, color: '#93c5fd' }}>
            {offer(enemy.values[row.id], enemy.costs[row.id])}
          </div>
        </button>
      ))}
    </div>
  )
}

function Bounty({ multiplier }: { multiplier: number }) {
  return (
    <div data-bounty-multiplier={multiplier} style={{ marginBottom: 16, color: '#93c5fd', fontSize: 16 }}>
      Bounty ×{multiplier.toFixed(2)}
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
