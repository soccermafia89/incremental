import { turnCell } from '../../../core/designer'

export function Mini({ cells, color, rotation }: { cells: { x: number; y: number }[]; color: string; rotation: number }) {
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
