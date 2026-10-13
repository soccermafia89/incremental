import { useState } from 'react'
import type { CorvetteStats } from '../../core/corvette/Upgrades'
import type { EnemyStats } from '../../core/enemy/Upgrades'
import type { CorvetteUpgradeId } from '../../data/corvette/upgrades'
import type { EnemyUpgradeId } from '../../data/enemy/upgrades'

function offer(value: number, cost: number | null, crystal = false): string {
  if (cost === null) return `${value} · Max`
  if (!crystal) return `${value} · $${cost}`
  return `${value} · ${cost} ${cost === 1 ? 'crystal' : 'crystals'}`
}

function missileOffer(corvette: CorvetteStats): string {
  if (corvette.values.missiles > 0) return 'On'
  const cost = corvette.costs.missiles
  if (cost === null) return 'On'
  return `Off · ${cost} ${cost === 1 ? 'crystal' : 'crystals'}`
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

const CORVETTE: { id: CorvetteUpgradeId; label: string }[] = [
  { id: 'spawnRate', label: 'Spawn rate' },
  { id: 'capacity', label: 'Capacity' },
  { id: 'health', label: 'Health' },
  { id: 'damage', label: 'Damage' },
  { id: 'attackRate', label: 'Attack rate' },
  { id: 'speed', label: 'Speed' },
  { id: 'missiles', label: 'Missiles' },
]

type Page = 'menu' | 'fighter' | 'corvette'

export function EnemyPanel({
  enemy,
  corvette,
  onUpgrade,
  onUnlockCorvette,
  onUpgradeCorvette,
}: {
  enemy: EnemyStats
  corvette: CorvetteStats
  onUpgrade: (upgrade: EnemyUpgradeId) => void
  onUnlockCorvette: () => void
  onUpgradeCorvette: (upgrade: CorvetteUpgradeId) => void
}) {
  const [page, setPage] = useState<Page>('menu')

  if (page === 'fighter') {
    return (
      <div data-enemy-upgrades data-enemy-fighter style={{ color: 'white', width: 420 }}>
        <Back onClick={() => setPage('menu')} />
        <ShipTitle name="Fighter" ship="fighter" multiplier={enemy.bounty} />
        <UpgradeList rows={FLEET} enemy={enemy} onUpgrade={onUpgrade} />
        <div style={{ marginTop: 28 }}>
          <UpgradeList rows={STATS} enemy={enemy} onUpgrade={onUpgrade} />
        </div>
      </div>
    )
  }

  if (page === 'corvette') {
    return (
      <div data-enemy-upgrades data-enemy-corvette style={{ color: 'white', width: 420 }}>
        <Back onClick={() => setPage('menu')} />
        <ShipTitle name="Corvette" ship="corvette" multiplier={CORVETTE_BOUNTY} />
        {corvette.owned ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CORVETTE.map(row => (
              <button
                key={row.id}
                type="button"
                data-upgrade={row.id}
                onClick={() => onUpgradeCorvette(row.id)}
                style={cardStyle}
              >
                <div style={{ fontSize: 16, fontWeight: 'bold' }}>{row.label}</div>
                <div style={{ marginTop: 6, color: corvette.crystals[row.id] ? '#c4b5fd' : '#93c5fd' }}>
                  {row.id === 'missiles' ? missileOffer(corvette) : offer(corvette.values[row.id], corvette.costs[row.id], corvette.crystals[row.id])}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" data-upgrade="unlock" onClick={onUnlockCorvette} style={cardStyle}>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>Unlock</div>
            <div style={{ marginTop: 6, color: '#93c5fd' }}>
              {corvette.cost === null ? 'On · Max' : `Off · $${corvette.cost}`}
            </div>
          </button>
        )}
      </div>
    )
  }

  return (
    <div data-enemy-upgrades style={{ color: 'white', width: 420 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Enemy</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" data-upgrade="fighter" onClick={() => setPage('fighter')} style={cardStyle}>
          <NameRow name="Fighter" ship="fighter" multiplier={enemy.bounty} />
        </button>
        <button type="button" data-upgrade="corvette" onClick={() => setPage('corvette')} style={cardStyle}>
          <NameRow name="Corvette" ship="corvette" multiplier={CORVETTE_BOUNTY} />
          <div style={{ marginTop: 6, color: '#93c5fd' }}>
            {corvette.owned ? 'On' : `Off · $${corvette.cost}`}
          </div>
        </button>
      </div>
    </div>
  )
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-upgrade-back
      onClick={onClick}
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

/** Corvette kills pay a flat bounty, so this factor does not change. */
const CORVETTE_BOUNTY = 1

function ShipTitle({ name, ship, multiplier }: { name: string; ship: 'fighter' | 'corvette'; multiplier: number }) {
  return (
    <h2 style={{ margin: '0 0 16px', fontSize: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span>{name}</span>
      <Multiplier ship={ship} multiplier={multiplier} />
    </h2>
  )
}

function NameRow({ name, ship, multiplier }: { name: string; ship: 'fighter' | 'corvette'; multiplier: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold' }}>{name}</div>
      <Multiplier ship={ship} multiplier={multiplier} />
    </div>
  )
}

function Multiplier({ ship, multiplier }: { ship: 'fighter' | 'corvette'; multiplier: number }) {
  return (
    <span data-bounty-ship={ship} data-bounty-multiplier={multiplier} style={{ color: '#93c5fd', fontWeight: 'bold' }}>
      ×{multiplier.toFixed(2)}
    </span>
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
