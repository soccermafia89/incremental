/** Drawn size of each hull. The nose points up before heading is applied. */
export const SHIP_MARK = {
  miner: { width: 10, height: 12 },
  fighter: { width: 18, height: 18 },
} as const

/** Miners are a small triangle. Fighters are a wider winged dart. */
export function ShipMark({
  role,
  color,
  heading = -Math.PI / 2,
  marker,
}: {
  role: 'miner' | 'fighter'
  color: string
  /** Radians, 0 pointing right. Omitted marks point up, for the build bars. */
  heading?: number
  marker?: 'miner' | 'fighter'
}) {
  const turn = `rotate(${heading + Math.PI / 2}rad)`
  if (role === 'fighter') {
    const size = SHIP_MARK.fighter
    return (
      <div
        data-miner-icon={marker === 'miner' ? true : undefined}
        data-fighter-icon={marker === 'fighter' ? true : undefined}
        style={{
          width: size.width,
          height: size.height,
          backgroundColor: color,
          clipPath: 'polygon(50% 0%, 100% 42%, 68% 42%, 78% 100%, 50% 72%, 22% 100%, 32% 42%, 0% 42%)',
          transform: turn,
          transformOrigin: 'center',
        }}
      />
    )
  }
  return (
    <div
      data-miner-icon={marker === 'miner' ? true : undefined}
      data-fighter-icon={marker === 'fighter' ? true : undefined}
      style={{
        width: 0,
        height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderBottom: `12px solid ${color}`,
        transform: turn,
        transformOrigin: 'center',
      }}
    />
  )
}
