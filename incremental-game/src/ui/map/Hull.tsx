import type { HullCell } from '../../core/miner'

/** Colored squares of a hull, the same marks the map uses. Nose is up when heading is north. */
export function Hull({ cells, heading, extent }: { cells: HullCell[]; heading: number; extent: number }) {
  const box = hullBox(cells, extent)
  return (
    <div
      data-ship-hull=""
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        transform: `rotate(${heading + Math.PI / 2}rad)`,
        transformOrigin: '0 0',
      }}
    >
      {cells.map(cell => (
        <span
          key={`${cell.x},${cell.y}`}
          data-hull-cell={`${cell.x},${cell.y}`}
          style={{
            position: 'absolute',
            left: cell.x * box.size - box.size / 2,
            top: cell.y * box.size - box.size / 2,
            width: box.size,
            height: box.size,
            backgroundColor: cell.color,
          }}
        />
      ))}
    </div>
  )
}

function hullBox(cells: HullCell[], extent: number): { size: number } {
  const minX = Math.min(...cells.map(cell => cell.x))
  const maxX = Math.max(...cells.map(cell => cell.x))
  const minY = Math.min(...cells.map(cell => cell.y))
  const maxY = Math.max(...cells.map(cell => cell.y))
  return { size: extent / Math.max(maxX - minX + 1, maxY - minY + 1) }
}
