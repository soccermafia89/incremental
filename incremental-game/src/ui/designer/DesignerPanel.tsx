import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type RefObject } from 'react'
import { isEnginePart, isGunId, type ComponentId, type Side } from '../../data/designer'
import type { DesignGhost, DesignerScene, Rotation } from '../../core/designer'
import { turnCell } from '../../core/designer'

const CELL = 16
const GAP = 2
const BLOCKED = '#64748b'

export function DesignerPanel({
  designer,
  preview,
  onPlace,
  onRemove,
  onSave,
  onExport,
  onImport,
  onReset,
}: {
  designer: DesignerScene
  preview: (component: string, x: number, y: number, rotation: number) => DesignGhost | null
  onPlace: (component: string, x: number, y: number, rotation: number) => void
  onRemove: (id: string) => void
  onSave: () => void
  onExport: () => void
  onImport: (file: File) => void
  onReset: () => void
}) {
  const [selected, setSelected] = useState<ComponentId | 'delete'>('structural')
  const [weaponsOpen, setWeaponsOpen] = useState(false)
  const [enginesOpen, setEnginesOpen] = useState(false)
  const [rotation, setRotation] = useState<Rotation>(0)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const deleting = selected === 'delete'
  const ghost = hover && !deleting ? preview(selected, hover.x, hover.y, rotation) : null
  const ghostKeys = new Set((ghost?.cells ?? []).map(cell => `${cell.x},${cell.y}`))
  const span = designer.half * 2 + 1
  const picked = designer.catalog.find(item => item.id === selected)
  const cell = useFitCell(stage, span)
  const mark = mountMark(cell)

  return (
    <div data-ship-designer style={{ color: 'white', width: '100%', height: '100%', minHeight: 0, display: 'flex', gap: 20 }}>
      <div style={{ width: 300, flex: '0 0 300px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Ship Designer</h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, lineHeight: 1.4 }}>
            Select a part and click an empty square. The shape stays grey until it can bolt on. Select Delete, then click a part to take it off. Reset clears the grid. Save design stores this ship in the game. The grid can keep changing after that.
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
            style={{
              padding: '8px 12px',
              backgroundColor: deleting ? '#7f1d1d' : '#16213e',
              color: 'white',
              border: `1px solid ${deleting ? '#f87171' : '#4a9eff'}`,
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Delete
          </button>
          <button
            type="button"
            data-rotate={rotation}
            onClick={() => setRotation(current => (current === 270 ? 0 : current + 90) as Rotation)}
            style={{
              padding: '8px 12px',
              backgroundColor: '#16213e',
              color: '#93c5fd',
              border: '1px solid #4a9eff',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
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
          <button
            type="button"
            data-save-design
            onClick={onSave}
            style={{
              padding: '8px 12px',
              backgroundColor: '#14532d',
              color: 'white',
              border: '1px solid #4ade80',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Save design
          </button>
          <button type="button" data-reset-design onClick={onReset} style={fileButton}>
            Reset
          </button>
          <button type="button" data-export-design onClick={onExport} style={fileButton}>
            Export
          </button>
          <button type="button" data-import-design onClick={() => fileInput.current?.click()} style={fileButton}>
            Import
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            data-import-design-file
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) onImport(file)
            }}
            style={{ display: 'none' }}
          />
        </div>
        <span data-saved-design={designer.saved ? 'yes' : 'no'} style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.4 }}>
          {designer.saved
            ? `In the game · ${designer.saved.units} units · speed ${shownSpeed(designer.saved.stats.speed)}`
            : 'Not in the game yet'}
        </span>
      </div>
      <div
        ref={stage}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          data-design-grid
          onMouseLeave={() => setHover(null)}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${span}, ${cell}px)`,
            gap: GAP,
          }}
        >
          {designer.cells.map(placed => {
            const key = `${placed.x},${placed.y}`
            const ghosted = ghostKeys.has(key)
            const legal = ghost?.legal === true
            const ghostMounts = ghost?.mounts.filter(mount => mount.x === placed.x && mount.y === placed.y).map(mount => mount.side) ?? []
            const mounts = ghosted ? ghostMounts : placed.mounts
            return (
              <button
                key={key}
                type="button"
                data-cell={`${placed.x},${placed.y}`}
                data-cell-kind={placed.kind}
                data-placed={placed.partId ?? undefined}
                data-ghost={ghosted ? (legal ? 'legal' : 'blocked') : undefined}
                onMouseEnter={() => setHover({ x: placed.x, y: placed.y })}
                onClick={() => {
                  if (deleting) {
                    if (placed.kind === 'part' && placed.partId) onRemove(placed.partId)
                    return
                  }
                  if (placed.kind === 'empty') onPlace(selected, placed.x, placed.y, rotation)
                }}
                style={{
                  position: 'relative',
                  width: cell,
                  height: cell,
                  padding: 0,
                  backgroundColor: placed.color,
                  border: '1px solid #334155',
                  borderRadius: 2,
                  cursor: placed.kind === 'core' ? 'default' : 'pointer',
                }}
              >
                {ghosted && (
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: legal && picked ? picked.color : BLOCKED,
                      opacity: legal ? 0.55 : 1,
                      borderRadius: 2,
                    }}
                  />
                )}
                {mounts.map(side => (
                  <span
                    key={side}
                    style={{
                      position: 'absolute',
                      zIndex: 1,
                      backgroundColor: ghosted ? '#f8fafc' : '#0f172a',
                      ...mark[side],
                    }}
                  />
                ))}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function useFitCell(stage: RefObject<HTMLDivElement | null>, span: number): number {
  const [cell, setCell] = useState(CELL)
  useEffect(() => {
    const node = stage.current
    if (!node) return
    const measure = () => {
      const bounds = node.getBoundingClientRect()
      const room = Math.floor(Math.min(bounds.width, bounds.height)) - 8
      const fitted = Math.floor((room - GAP * (span - 1)) / span)
      const next = Math.max(CELL, fitted)
      setCell(current => (current === next ? current : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [stage, span])
  return cell
}

function mountMark(cell: number): Record<Side, CSSProperties> {
  const inset = Math.max(2, Math.round(cell * 0.2))
  const thick = Math.max(2, Math.round(cell * 0.14))
  return {
    n: { top: 1, left: inset, right: inset, height: thick },
    s: { bottom: 1, left: inset, right: inset, height: thick },
    w: { left: 1, top: inset, bottom: inset, width: thick },
    e: { right: 1, top: inset, bottom: inset, width: thick },
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

type CatalogItem = DesignerScene['catalog'][number]

function catalogRows(
  catalog: CatalogItem[],
  weaponsOpen: boolean,
  enginesOpen: boolean,
): ({ kind: 'group'; id: 'weapons' | 'engines'; items: CatalogItem[] } | { kind: 'part'; item: CatalogItem })[] {
  const rows: ({ kind: 'group'; id: 'weapons' | 'engines'; items: CatalogItem[] } | { kind: 'part'; item: CatalogItem })[] = []
  const guns = catalog.filter(item => isGunId(item.id))
  const engines = catalog.filter(item => isEnginePart(item.id))
  let gunsListed = false
  let enginesListed = false
  for (const item of catalog) {
    if (isGunId(item.id)) {
      if (!gunsListed) {
        rows.push({ kind: 'group', id: 'weapons', items: guns })
        gunsListed = true
      }
      if (weaponsOpen) rows.push({ kind: 'part', item })
      continue
    }
    if (isEnginePart(item.id)) {
      if (!enginesListed) {
        rows.push({ kind: 'group', id: 'engines', items: engines })
        enginesListed = true
      }
      if (enginesOpen) rows.push({ kind: 'part', item })
      continue
    }
    rows.push({ kind: 'part', item })
  }
  return rows
}

function partButton(active: boolean, color: string): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    backgroundColor: active ? '#1e3a5f' : '#16213e',
    color: 'white',
    border: `1px solid ${active ? color : '#4a9eff'}`,
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
  }
}

function partNote(item: { weight: number; thrust: number; energy: number; health: number; range: number; damage: number; interval: number }): string {
  const notes = [`${item.weight} weight`]
  if (item.health > 0) notes.push(`${item.health} health`)
  if (item.range > 0) {
    notes.push(`${item.damage} damage`)
    notes.push(`${item.interval} ms`)
    notes.push(`${item.range} range`)
  }
  if (item.thrust > 0) notes.push(`${item.thrust} thrust`)
  if (item.energy > 0) notes.push(`+${item.energy} energy`)
  if (item.energy < 0) notes.push(`${item.energy} energy`)
  return notes.join(' · ')
}

function shownSpeed(speed: number): string {
  if (Number.isInteger(speed)) return String(speed)
  return speed.toFixed(2)
}

function shownEnergy(energy: number): string {
  if (energy > 0) return `+${energy}`
  return String(energy)
}

function Mini({ cells, color, rotation }: { cells: { x: number; y: number }[]; color: string; rotation: number }) {
  const turned = cells.map(cell => turnCell(cell.x, cell.y, rotation / 90))
  const minX = Math.min(...turned.map(cell => cell.x))
  const maxX = Math.max(...turned.map(cell => cell.x))
  const minY = Math.min(...turned.map(cell => cell.y))
  const maxY = Math.max(...turned.map(cell => cell.y))
  const boxes = []
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const on = turned.some(cell => cell.x === x && cell.y === y)
      boxes.push(
        <span
          key={`${x},${y}`}
          style={{
            width: 10,
            height: 10,
            backgroundColor: on ? color : 'transparent',
          }}
        />,
      )
    }
  }
  return (
    <span style={{ display: 'grid', gridTemplateColumns: `repeat(${maxX - minX + 1}, 10px)`, gap: 1 }}>
      {boxes}
    </span>
  )
}
