import { useState, type CSSProperties } from 'react'
import { isEnginePart, isGunId, type ComponentId } from '../../../data/designer'
import type { DesignGhost, DesignerScene, Rotation } from '../../../core/designer'
import { catalogRows, partButton, partNote, shownEnergy, shownSpeed } from './catalog'
import { Mini } from './Mini'
import { DesignGrid } from './DesignGrid'

export function DesignEditor({
  designer,
  editing,
  preview,
  onPlace,
  onRemove,
  onSave,
  onExport,
  onReset,
  onBack,
}: {
  designer: DesignerScene
  /** The ship this grid will replace. Null means Save design adds the next ship. */
  editing: string | null
  preview: (component: string, x: number, y: number, rotation: number) => DesignGhost | null
  onPlace: (component: string, x: number, y: number, rotation: number) => void
  onRemove: (id: string) => void
  onSave: () => Promise<boolean>
  onExport: () => void
  onReset: () => void
  onBack: () => void
}) {
  const [selected, setSelected] = useState<ComponentId | 'delete'>('structural')
  const [weaponsOpen, setWeaponsOpen] = useState(false)
  const [enginesOpen, setEnginesOpen] = useState(false)
  const [rotation, setRotation] = useState<Rotation>(0)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const deleting = selected === 'delete'
  const ghost = hover && !deleting ? preview(selected, hover.x, hover.y, rotation) : null
  const picked = designer.catalog.find(item => item.id === selected)

  return (
    <div
      data-ship-designer
      data-design-editor={editing ?? 'new'}
      style={{ color: 'white', width: '100%', height: '100%', minHeight: 0, display: 'flex', gap: 20 }}
    >
      <div style={{ width: 300, flex: '0 0 300px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>{editing ? `Edit ${editing}` : 'New design'}</h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, lineHeight: 1.4 }}>
            {editing
              ? `Save design replaces ${editing}. A ship with negative energy cannot be saved.`
              : 'Save design stores this ship as the next name. A ship with negative energy cannot be saved.'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {catalogRows(designer.catalog, weaponsOpen, enginesOpen).map(row => {
            if (row.kind === 'group') {
              const open = row.id === 'weapons' ? weaponsOpen : enginesOpen
              return (
                <button
                  key={row.id}
                  type="button"
                  data-part={row.id}
                  {...(row.id === 'weapons'
                    ? { 'data-weapons-open': open ? 'yes' : 'no' }
                    : { 'data-engines-open': open ? 'yes' : 'no' })}
                  onClick={() => {
                    if (row.id === 'weapons') setWeaponsOpen(true)
                    else setEnginesOpen(true)
                  }}
                  style={partButton(open, row.id === 'weapons' ? '#f87171' : '#fb923c')}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 'bold' }}>{row.id === 'weapons' ? 'Weapons' : 'Engines'}</span>
                    <span style={{ color: '#93c5fd', fontSize: 12 }}>{row.items.map(item => item.label).join(' · ')}</span>
                  </span>
                </button>
              )
            }
            const item = row.item
            const active = item.id === selected
            return (
              <button
                key={item.id}
                type="button"
                data-part={item.id}
                onClick={() => {
                  setSelected(item.id)
                  setRotation(0)
                  if (!isGunId(item.id)) setWeaponsOpen(false)
                  if (!isEnginePart(item.id)) setEnginesOpen(false)
                }}
                style={{ ...partButton(active, item.color), marginLeft: isGunId(item.id) || isEnginePart(item.id) ? 16 : 0 }}
              >
                <Mini cells={item.cells} color={item.color} rotation={active ? rotation : 0} />
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 'bold' }}>{item.label}</span>
                  <span style={{ color: '#93c5fd', fontSize: 12 }}>{item.units} units · {partNote(item)}</span>
                </span>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            data-delete-part={deleting ? 'on' : 'off'}
            onClick={() => {
              setSelected('delete')
              setWeaponsOpen(false)
              setEnginesOpen(false)
            }}
            style={toolButton(deleting)}
          >
            Delete
          </button>
          <button
            type="button"
            data-rotate={rotation}
            onClick={() => setRotation(current => (current === 270 ? 0 : current + 90) as Rotation)}
            style={fileButton}
          >
            Rotate
          </button>
        </div>
        <div data-design-units={designer.units} style={{ fontWeight: 'bold', fontSize: 16 }}>
          {designer.units} units
        </div>
        <div data-design-stats style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', color: '#cbd5e1', fontSize: 14 }}>
          <div data-design-health={designer.stats.health}>Health {designer.stats.health}</div>
          <div data-design-weight={designer.stats.weight}>Weight {designer.stats.weight}</div>
          <div data-design-thrust={designer.stats.thrust}>Thrust {designer.stats.thrust}</div>
          <div data-design-speed={designer.stats.speed}>Speed {shownSpeed(designer.stats.speed)}</div>
          <div data-design-energy={designer.stats.energy}>Energy {shownEnergy(designer.stats.energy)}</div>
          <div data-design-range={designer.stats.range}>Range {designer.stats.range > 0 ? designer.stats.range : '—'}</div>
          <div data-design-damage={designer.stats.damage}>Damage {designer.stats.damage}</div>
          {designer.stats.fires.length === 0
            ? <div data-design-fire="none">Fire —</div>
            : designer.stats.fires.map(row => (
              <div key={row.kind} data-design-fire={row.kind}>
                {`${row.label} ${row.damage} dmg · ${row.interval} ms · ${row.range} range`}
              </div>
            ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <button type="button" data-designer-back onClick={onBack} style={fileButton}>
            Back
          </button>
          <button type="button" data-save-design onClick={() => { void onSave() }} style={saveButton}>
            Save design
          </button>
          <button type="button" data-reset-design onClick={onReset} style={fileButton}>
            Reset
          </button>
          <button type="button" data-export-design onClick={onExport} style={fileButton}>
            Export
          </button>
        </div>
      </div>
      <DesignGrid
        designer={designer}
        ghost={ghost}
        ghostColor={picked?.color ?? null}
        onEmpty={(x, y) => {
          if (!deleting) onPlace(selected, x, y, rotation)
        }}
        onPart={id => {
          if (deleting) onRemove(id)
        }}
        onHover={setHover}
      />
    </div>
  )
}

function toolButton(active: boolean): CSSProperties {
  return {
    padding: '8px 12px',
    backgroundColor: active ? '#7f1d1d' : '#16213e',
    color: 'white',
    border: `1px solid ${active ? '#f87171' : '#4a9eff'}`,
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 'bold',
  }
}

const fileButton = {
  padding: '8px 12px',
  backgroundColor: '#16213e',
  color: '#93c5fd',
  border: '1px solid #4a9eff',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 'bold',
} as const

const saveButton = {
  padding: '8px 12px',
  backgroundColor: '#14532d',
  color: 'white',
  border: '1px solid #4ade80',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 'bold',
} as const
