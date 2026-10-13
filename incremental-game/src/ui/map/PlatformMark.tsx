/** A ring turret with a barrel and three lights. Not a hull of squares. */
export function PlatformMark() {
  return (
    <div
      data-defense-platform=""
      style={{ position: 'absolute', left: -20, top: -20, width: 40, height: 40 }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        border: '3px solid #67e8f9',
        background: 'radial-gradient(circle, #082f49 0 34%, #0e7490 35% 52%, #082f49 53% 70%, transparent 71%)',
        boxShadow: '0 0 12px #22d3ee',
      }} />
      <div style={{
        position: 'absolute',
        left: 18,
        top: 16,
        width: 24,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#e0f2fe',
        boxShadow: '0 0 8px #67e8f9',
      }} />
      {[0, 120, 240].map(deg => (
        <div
          key={deg}
          style={{
            position: 'absolute',
            left: 17,
            top: 2,
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: '#fde68a',
            transformOrigin: '3px 18px',
            transform: `rotate(${deg}deg)`,
          }}
        />
      ))}
    </div>
  )
}
