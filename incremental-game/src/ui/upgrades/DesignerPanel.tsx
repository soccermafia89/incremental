import { useState } from 'react'
import type { ComponentId, Side } from '../../data/designer'
import type { DesignerScene, Rotation } from '../../core/designer/Design'
import { turnCell } from '../../core/designer/Design'

const MARK: Record<Side, { top?: number; right?: number; bottom?: number; left?: number; width?: number; height?: number }> = {
  n: { top: 2, left: 8, right: 8, height: 3 },
  s: { bottom: 2, left: 8, right: 8, height: 3 },
  w: { left: 2, top: 8, bottom: 8, width: 3 },
  e: { right: 2, top: 8, bottom: 8, width: 3 },
}

export function DesignerPanel({
  designer,
  preview,
  onPlace,
  onRemove,
}: {
  designer: DesignerScene
  preview: (component: string, x: number, y: number, rotation: number) => { x: number; y: number }[] | null
  onPlace: (component: string, x: number, y: number, rotation: number) => void
  onRemove: (id: string) => void
}) {
  const [selected, setSelected] = useState<ComponentId>('structural')
  const [rotation, setRotation] = useState<Rotation>(0)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const ghost = hover ? preview(selected, hover.x, hover.y, rotation) : null
  const ghostKeys = new Set((ghost ?? []).map(cell => `${cell.x},${cell.y}`))
  const span = designer.half * 2 + 1
  const picked = designer.catalog.find(item => item.id === selected)

  return (
    <div data-ship-designer style={{ color: 'white', width: span * 38 + 8 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Ship Designer</h2>
      <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 14, lineHeight: 1.4 }}>
        Select a part and click an empty square. It has to bolt onto the ship. Click a placed part to take it off.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {designer.catalog.map(item => {
          const active = item.id === selected
          return (
            <button
              key={item.id}
              type="button"
              data-part={item.id}
              onClick={() => {
                setSelected(item.id)
                setRotation(0)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                backgroundColor: active ? '#1e3a5f' : '#16213e',
                color: 'white',
                border: `1px solid ${active ? item.color : '#4a9eff'}`,
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <Mini cells={item.cells} color={item.color} rotation={active ? rotation : 0} />
              <span style={{ fontWeight: 'bold' }}>{item.label}</span>
            </button>
          )
        })}
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
      <div
        data-design-grid
        onMouseLeave={() => setHover(null)}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${span}, 36px)`,
          gap: 2,
        }}
      >
        {designer.cells.map(cell => {
          const ghosted = ghostKeys.has(`${cell.x},${cell.y}`)
          const color = ghosted && picked ? picked.color : cell.color
          return (
            <button
              key={`${cell.x},${cell.y}`}
              type="button"
              data-cell={`${cell.x},${cell.y}`}
              data-cell-kind={cell.kind}
              data-placed={cell.partId ?? undefined}
              onMouseEnter={() => setHover({ x: cell.x, y: cell.y })}
              onClick={() => {
                if (cell.kind === 'part' && cell.partId) onRemove(cell.partId)
                else if (cell.kind === 'empty') onPlace(selected, cell.x, cell.y, rotation)
              }}
              style={{
                position: 'relative',
                width: 36,
                height: 36,
                padding: 0,
                backgroundColor: color,
                opacity: ghosted ? 0.55 : 1,
                border: '1px solid #334155',
                borderRadius: 4,
                cursor: cell.kind === 'core' ? 'default' : 'pointer',
              }}
            >
              {cell.mounts.map(side => (
                <span
                  key={side}
                  style={{
                    position: 'absolute',
                    backgroundColor: '#0f172a',
                    ...MARK[side],
                  }}
                />
              ))}
            </button>
          )
        })}
      </div>
    </div>
  )
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
