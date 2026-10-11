export function Base({
  x,
  y,
  radius,
  fill,
  stroke,
  marker,
  combat,
}: {
  x: number
  y: number
  radius: number
  fill: string
  stroke: string
  marker: 'base' | 'rival-base'
  combat: boolean
}) {
  const size = radius * 2
  return (
    <div
      data-base={marker === 'base' ? '' : undefined}
      data-rival-base={marker === 'rival-base' ? '' : undefined}
      data-mode={combat ? 'combat' : 'stasis'}
      style={{
        position: 'absolute',
        left: x - radius,
        top: y - radius,
        width: size,
        height: size,
        borderRadius: 8,
        backgroundColor: fill,
        border: `2px solid ${stroke}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 'bold',
        lineHeight: 1.2,
      }}
    >
      <span>Base</span>
      <span style={{ fontSize: 10, fontWeight: 'normal', color: '#cbd5e1' }}>{combat ? 'Combat' : 'Stasis'}</span>
    </div>
  )
}
