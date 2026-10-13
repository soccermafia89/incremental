import { useState } from 'react'
import type { DesignerScene } from '../../core/designer'
import type { FighterStats } from '../../core/fighter/Upgrades'
import type { MinerStats, MinerUpgradeId } from '../../core/miner'
import type { WeaponStats } from '../../core/weapons/Upgrades'
import type { EngineUnlockId, WeaponUnlockId } from '../../data/designer'
import type { FighterUpgradeId } from '../../data/fighter/upgrades'
import type { WeaponUpgradeId } from '../../data/weapons/upgrades'

function offer(value: number, cost: number | null, crystal = false): string {
  if (cost === null) return `${value} · Max`
  if (!crystal) return `${value} · $${cost}`
  return `${value} · ${cost} ${cost === 1 ? 'crystal' : 'crystals'}`
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

const FIGHTER_ROWS: { id: FighterUpgradeId; label: string }[] = [
  { id: 'speed', label: 'Speed' },
  { id: 'attackRate', label: 'Attack rate' },
  { id: 'health', label: 'Health' },
  { id: 'damage', label: 'Damage' },
]
const CANNON_ROWS: { id: WeaponUpgradeId; label: string }[] = [
  { id: 'cannonFireRate', label: 'Rate of fire' },
  { id: 'cannonDamage', label: 'Damage' },
]
const LASER_ROWS: { id: WeaponUpgradeId; label: string }[] = [
  { id: 'laserRange', label: 'Range' },
  { id: 'laserEnergy', label: 'Energy reduction' },
]
const MISSILE_ROWS: { id: WeaponUpgradeId; label: string }[] = [
  { id: 'missileFireRate', label: 'Rate of fire' },
  { id: 'missileDamage', label: 'Damage' },
]

export function ShipUpgradesPanel({
  miner,
  showMiner,
  showFighter,
  fighter,
  designer,
  weapon,
  missileCorvetteKilled,
  onUpgrade,
  onUpgradeFighter,
  onUnlockDesigner,
  onUnlockWeapon,
  onUnlockEngine,
  onUpgradeWeapon,
}: {
  miner: MinerStats
  showMiner: boolean
  showFighter: boolean
  fighter: FighterStats
  designer: DesignerScene
  weapon: WeaponStats
  missileCorvetteKilled: boolean
  onUpgrade: (upgrade: MinerUpgradeId) => void
  onUpgradeFighter: (upgrade: FighterUpgradeId) => void
  onUnlockDesigner: () => void
  onUnlockWeapon: (weapon: WeaponUnlockId) => void
  onUnlockEngine: (engine: EngineUnlockId) => void
  onUpgradeWeapon: (upgrade: WeaponUpgradeId) => void
}) {
  const [page, setPage] = useState<'miner' | 'fighter' | 'weapons' | 'engines' | null>(null)

  if (page === 'engines' && designer.owned) {
    return (
      <div data-ship-upgrades data-engine-upgrades style={{ color: 'white', width: 420 }}>
        <Back onClick={() => setPage(null)} />
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Engines</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {designer.engines.map(engine => (
            <button
              key={engine.id}
              type="button"
              data-upgrade={engine.id}
              onClick={() => {
                if (engine.cost !== null) onUnlockEngine(engine.id)
              }}
              style={cardStyle}
            >
              <div style={{ fontSize: 16, fontWeight: 'bold' }}>{engine.label}</div>
              <div style={{ marginTop: 6, color: '#93c5fd' }}>
                {engine.cost === null ? 'On · Max' : `Off · $${engine.cost}`}
              </div>
              <div style={{ marginTop: 4, color: '#cbd5e1', fontSize: 13 }}>
                {engine.cells} cells · {engine.thrust} thrust · {engine.energy} energy · {engine.units} units
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (page === 'weapons' && designer.owned) {
    return (
      <div data-ship-upgrades data-weapon-upgrades style={{ color: 'white', width: 420 }}>
        <Back onClick={() => setPage(null)} />
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Weapons</h2>
        <div data-upgrade-section="cannon" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>Cannon</div>
          {CANNON_ROWS.map(row => (
            <button
              key={row.id}
              type="button"
              data-upgrade={row.id}
              onClick={() => onUpgradeWeapon(row.id)}
              style={cardStyle}
            >
              <div style={{ fontSize: 16, fontWeight: 'bold' }}>{row.label}</div>
              <div style={{ marginTop: 6, color: weapon.crystals[row.id] ? '#c4b5fd' : '#93c5fd' }}>
                {offer(weapon.values[row.id], weapon.costs[row.id], weapon.crystals[row.id])}
              </div>
            </button>
          ))}
        </div>
        <div style={{ height: 28 }} />
        <WeaponBlock
          offer={designer.weapons.find(item => item.id === 'laser')}
          rows={LASER_ROWS}
          stats={weapon}
          onUnlock={onUnlockWeapon}
          onUpgrade={onUpgradeWeapon}
        />
        {(missileCorvetteKilled || designer.weapons.find(item => item.id === 'missile')?.crystal === null) && (
          <>
            <div style={{ height: 28 }} />
            <WeaponBlock
              offer={designer.weapons.find(item => item.id === 'missile')}
              rows={MISSILE_ROWS}
              stats={weapon}
              onUnlock={onUnlockWeapon}
              onUpgrade={onUpgradeWeapon}
            />
          </>
        )}
      </div>
    )
  }

  if (page === 'fighter' && showFighter) {
    return (
      <div data-ship-upgrades data-fighter-stats style={{ color: 'white', width: 420 }}>
        <Back onClick={() => setPage(null)} />
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Default fighter</h2>
        <div data-upgrade-section="stats" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FIGHTER_ROWS.map(row => (
            <button
              key={row.id}
              type="button"
              data-upgrade={row.id}
              onClick={() => onUpgradeFighter(row.id)}
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

  if (page !== 'miner' || !showMiner) {
    return (
      <div data-ship-upgrades style={{ color: 'white', width: 420 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Ship Upgrades</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {showMiner && (
            <button
              type="button"
              data-upgrade="miner"
              onClick={() => setPage('miner')}
              style={cardStyle}
            >
              <div style={{ fontSize: 16, fontWeight: 'bold' }}>Miner</div>
            </button>
          )}
          {showFighter && (
            <button
              type="button"
              data-upgrade="fighter"
              onClick={() => setPage('fighter')}
              style={cardStyle}
            >
              <div style={{ fontSize: 16, fontWeight: 'bold' }}>Default fighter</div>
            </button>
          )}
          <button
            type="button"
            data-upgrade="designer"
            onClick={() => {
              if (!designer.owned) onUnlockDesigner()
            }}
            style={cardStyle}
          >
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>Ship designer</div>
            <div style={{ marginTop: 6, color: '#93c5fd' }}>
              {designer.owned || designer.cost === null ? 'On · Max' : `Off · $${designer.cost}`}
            </div>
          </button>
          {designer.owned && (
            <button
              type="button"
              data-upgrade="weapons"
              onClick={() => setPage('weapons')}
              style={cardStyle}
            >
              <div style={{ fontSize: 16, fontWeight: 'bold' }}>Weapons</div>
            </button>
          )}
          {designer.owned && (
            <button
              type="button"
              data-upgrade="engines"
              onClick={() => setPage('engines')}
              style={cardStyle}
            >
              <div style={{ fontSize: 16, fontWeight: 'bold' }}>Engines</div>
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div data-ship-upgrades data-miner-upgrades style={{ color: 'white', width: 420 }}>
      <button
        type="button"
        data-upgrade-back
        onClick={() => setPage(null)}
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

function WeaponBlock({
  offer: item,
  rows,
  stats,
  onUnlock,
  onUpgrade,
}: {
  offer: DesignerScene['weapons'][number] | undefined
  rows: { id: WeaponUpgradeId; label: string }[]
  stats: WeaponStats
  onUnlock: (weapon: WeaponUnlockId) => void
  onUpgrade: (upgrade: WeaponUpgradeId) => void
}) {
  if (!item) return null
  if (item.crystal !== null) {
    return (
      <button
        type="button"
        data-upgrade={item.id}
        onClick={() => onUnlock(item.id)}
        style={cardStyle}
      >
        <div style={{ fontSize: 16, fontWeight: 'bold' }}>{item.label}</div>
        <div style={{ marginTop: 6, color: '#c4b5fd' }}>
          Off · {item.crystal} {item.crystal === 1 ? 'crystal' : 'crystals'}
        </div>
        <div style={{ marginTop: 4, color: '#cbd5e1', fontSize: 13 }}>
          {item.range} range · {item.energy} energy · {item.units} units
        </div>
      </button>
    )
  }
  if (item.cost !== null) {
    return (
      <button
        type="button"
        data-upgrade={item.id}
        onClick={() => onUnlock(item.id)}
        style={cardStyle}
      >
        <div style={{ fontSize: 16, fontWeight: 'bold' }}>{item.label}</div>
        <div style={{ marginTop: 6, color: '#93c5fd' }}>Off · ${item.cost}</div>
        <div style={{ marginTop: 4, color: '#cbd5e1', fontSize: 13 }}>
          {item.range} range · {item.energy} energy · {item.units} units
        </div>
      </button>
    )
  }
  return (
    <div data-upgrade-section={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 'bold' }}>{item.label}</div>
      {rows.map(row => (
        <button
          key={row.id}
          type="button"
          data-upgrade={row.id}
          onClick={() => onUpgrade(row.id)}
          style={cardStyle}
        >
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>{row.label}</div>
          <div style={{ marginTop: 6, color: stats.crystals[row.id] ? '#c4b5fd' : '#93c5fd' }}>
            {offer(stats.values[row.id], stats.costs[row.id], stats.crystals[row.id])}
          </div>
        </button>
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
