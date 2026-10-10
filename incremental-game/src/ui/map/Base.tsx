export function Base({
  x,
  y,
  radius,
  fill,
  stroke,
  marker,
}: {
  x: number
  y: number
  radius: number
  fill: string
  stroke: string
  marker: 'base' | 'rival-base'
}) {
  const size = radius * 2
  return (
    <div
      data-base={marker === 'base' ? '' : undefined}
      data-rival-base={marker === 'rival-base' ? '' : undefined}
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
      <div
        data-cannon=""
        style={{
          position: 'absolute',
          left: marker === 'base' ? size - 8 : -10,
          top: radius - 4,
          width: 18,
          height: 8,
          borderRadius: 2,
          backgroundColor: '#e2e8f0',
        }}
      />
    </div>
  )
}
