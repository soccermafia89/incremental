import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import type { Side } from '../../../data/designer'
import type { DesignGhost, DesignerScene } from '../../../core/designer'

const CELL = 16
const GAP = 2
const BLOCKED = '#64748b'

export function DesignGrid({
  designer,
  ghost,
  ghostColor,
  onEmpty,
  onPart,
  onHover,
}: {
  designer: DesignerScene
  ghost: DesignGhost | null
  ghostColor: string | null
  onEmpty: (x: number, y: number) => void
  onPart: (id: string) => void
  onHover: (cell: { x: number; y: number } | null) => void
}) {
  const stage = useRef<HTMLDivElement>(null)
  const span = designer.half * 2 + 1
  const cell = useFitCell(stage, span)
  const mark = mountMark(cell)
  const ghostKeys = new Set((ghost?.cells ?? []).map(spot => `${spot.x},${spot.y}`))

  return (
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
        onMouseLeave={() => onHover(null)}
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
              onMouseEnter={() => onHover({ x: placed.x, y: placed.y })}
              onClick={() => {
                if (placed.kind === 'part' && placed.partId) onPart(placed.partId)
                else if (placed.kind === 'empty') onEmpty(placed.x, placed.y)
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
                    backgroundColor: legal && ghostColor ? ghostColor : BLOCKED,
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
