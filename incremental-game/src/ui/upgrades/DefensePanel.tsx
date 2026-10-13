import type { DefenseUpgradeId } from '../../data/defense/upgrades'
import type { DefenseStats } from '../../core/defense/Upgrades'

function shownWait(seconds: number): string {
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(2)
}

function offer(value: number, cost: number | null, crystal = false): string {
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(2)
  if (cost === null) return `${shown} · Max`
  if (!crystal) return `${shown} · $${cost}`
  return `${shown} · ${cost} ${cost === 1 ? 'crystal' : 'crystals'}`
}

export function DefensePanel({
  defense,
  onUpgrade,
}: {
  defense: DefenseStats
  onUpgrade: (upgrade: DefenseUpgradeId) => void
}) {
  const owned = defense.values.capacity >= 1
  return (
    <div data-defense-upgrades style={{ color: 'white', width: 420 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Defense Platforms</h2>
      <p style={{ margin: '0 0 16px', color: '#94a3b8' }}>
        {`Capacity puts one platform on the map immediately. The next one keeps building, and waits if one is already out. One finished platform waits, and the build bar stays full until the slot is free. It drifts to just short of a third of the map, then holds. Range ${defense.range}. Its cannon shot is large and fires every ${shownWait(defense.shotSeconds)}s.`}
        {defense.building !== null ? ` Building ${Math.round(defense.building * 100)}%.` : ''}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" data-upgrade="capacity" onClick={() => onUpgrade('capacity')} style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>Capacity</div>
          <div style={{ marginTop: 6, color: defense.crystals.capacity ? '#c4b5fd' : '#93c5fd' }}>{offer(defense.values.capacity, defense.costs.capacity, defense.crystals.capacity)}</div>
        </button>
        {owned && (
          <>
            <button type="button" data-upgrade="health" onClick={() => onUpgrade('health')} style={cardStyle}>
              <div style={{ fontSize: 16, fontWeight: 'bold' }}>Health</div>
              <div style={{ marginTop: 6, color: defense.crystals.health ? '#c4b5fd' : '#93c5fd' }}>{offer(defense.values.health, defense.costs.health, defense.crystals.health)}</div>
            </button>
            <button type="button" data-upgrade="attackRate" onClick={() => onUpgrade('attackRate')} style={cardStyle}>
              <div style={{ fontSize: 16, fontWeight: 'bold' }}>Attack rate</div>
              <div style={{ marginTop: 6, color: defense.crystals.attackRate ? '#c4b5fd' : '#93c5fd' }}>{offer(defense.values.attackRate, defense.costs.attackRate, defense.crystals.attackRate)}</div>
            </button>
            <button type="button" data-upgrade="damage" onClick={() => onUpgrade('damage')} style={cardStyle}>
              <div style={{ fontSize: 16, fontWeight: 'bold' }}>Damage</div>
              <div style={{ marginTop: 6, color: defense.crystals.damage ? '#c4b5fd' : '#93c5fd' }}>{offer(defense.values.damage, defense.costs.damage, defense.crystals.damage)}</div>
            </button>
          </>
        )}
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
