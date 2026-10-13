import type { MapScene } from '../../core/game/Game'
import type { HullCell, ShipRole } from '../../core/miner'
import { Base } from './Base'
import { Hull } from './Hull'
import { PlatformMark } from './PlatformMark'
import { SHIP_MARK, ShipMark } from './ShipMark'

/** Longest side of a designed hull. Same span as the stock fighter dart. */
const HULL_EXTENT = SHIP_MARK.fighter.width
/** Longest side of a corvette. Two and a half times a fighter. */
const CORVETTE_EXTENT = HULL_EXTENT * 2.5

const STARS: readonly (readonly [number, number])[] = [
  [120, 48], [210, 140], [260, 520], [340, 80], [480, 200],
  [560, 40], [700, 160], [760, 480], [860, 90], [920, 300],
  [180, 400], [300, 260], [640, 560], [820, 220], [500, 600],
]

export function MapView({ scene }: { scene: MapScene }) {
  const blue = scene.ships.filter(ship => ship.side === 'player' && ship.role === 'miner').length
  return (
    <div
      data-map
      style={{
        position: 'relative',
        width: scene.width,
        height: scene.height,
        backgroundColor: '#070b14',
        overflow: 'hidden',
        color: 'white',
      }}
    >
      {STARS.map(([x, y]) => (
        <span
          key={`${x}-${y}`}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: 2,
            height: 2,
            borderRadius: 2,
            backgroundColor: 'rgba(255,255,255,0.45)',
          }}
        />
      ))}

      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        fontSize: 13,
        lineHeight: 1.4,
        textAlign: 'left',
        color: '#e7e5e4',
      }}>
        <div data-asteroid-count={scene.asteroids.length}>
          Asteroids {scene.asteroids.filter(asteroid => asteroid.kind === 'normal').length}/{scene.maxAsteroids}
        </div>
        <div data-miner-count={blue}>Blue {blue}</div>
      </div>

      <Base x={scene.base.x} y={scene.base.y} radius={scene.base.radius} fill="#16324f" stroke="#4a9eff" marker="base" combat={scene.baseCombat} />
      <Base x={scene.rival.x} y={scene.rival.y} radius={scene.rival.radius} fill="#4a1520" stroke="#ef4444" marker="rival-base" combat={scene.rivalCombat} />

      {scene.asteroids.map(asteroid => {
        const golden = asteroid.kind === 'golden'
        const rock = golden ? scene.goldenSize : scene.asteroidSize
        const box = rock + 6
        return (
        <div
          key={asteroid.id}
          data-asteroid={asteroid.id}
          data-kind={asteroid.kind}
          data-health={asteroid.health}
          style={{
            position: 'absolute',
            left: asteroid.x - box / 2,
            top: asteroid.y - (7 + rock / 2),
            width: box,
          }}
        >
          <div style={{
            height: 4,
            marginBottom: 3,
            backgroundColor: '#3f3f46',
            borderRadius: 2,
          }}>
            <div style={{
              width: `${(asteroid.health / asteroid.maxHealth) * 100}%`,
              height: '100%',
              backgroundColor: '#4ade80',
              borderRadius: 2,
            }} />
          </div>
          <div style={{
            width: rock,
            height: rock,
            marginLeft: 3,
            borderRadius: 6,
            backgroundColor: golden ? '#f5c542' : '#a8a29e',
            border: `2px solid ${golden ? '#a16207' : '#57534e'}`,
            transform: 'rotate(18deg)',
          }} />
        </div>
        )
      })}

      {scene.ores.map(ore => (
        <div
          key={ore.id}
          data-ore={ore.id}
          data-kind={ore.kind}
          style={{
            position: 'absolute',
            left: ore.x - 4,
            top: ore.y - 4,
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: ore.kind === 'golden' ? '#fde68a' : '#fbbf24',
            border: `1px solid ${ore.kind === 'golden' ? '#a16207' : '#b45309'}`,
          }}
        />
      ))}

      {scene.lasers.map(laser => (
        <Laser key={laser.id} laser={laser} />
      ))}

      {scene.blasts.map(blast => (
        <Blast key={blast.id} blast={blast} />
      ))}

      {scene.shots.map(shot => (
        <ShotGlyph key={shot.id} shot={shot} />
      ))}

      {scene.ships.map(ship => {
        const drawn = ship.hull && ship.hull.length > 0
          ? hullBox(ship.hull, ship.role === 'corvette' ? CORVETTE_EXTENT : HULL_EXTENT)
          : stockBox(ship.role)
        return (
          <div
            key={ship.id}
            data-ship={ship.id}
            data-side={ship.side}
            data-role={ship.role}
            data-carrying={ship.carrying ? 'true' : 'false'}
            data-health={ship.health}
            style={{
              position: 'absolute',
              left: ship.x,
              top: ship.y,
              width: 0,
              height: 0,
            }}
          >
            {ship.health < ship.maxHealth && (
              <div
                data-health-bar=""
                style={{
                  position: 'absolute',
                  left: drawn.left,
                  top: drawn.top - 6,
                  width: drawn.width,
                  height: 3,
                  backgroundColor: '#3f3f46',
                  borderRadius: 2,
                }}
              >
                <div style={{
                  width: `${(ship.health / ship.maxHealth) * 100}%`,
                  height: '100%',
                  backgroundColor: '#4ade80',
                  borderRadius: 2,
                }} />
              </div>
            )}
            {ship.role === 'platform' ? (
              <PlatformMark />
            ) : ship.hull && ship.hull.length > 0 ? (
              <Hull
                cells={ship.hull}
                heading={ship.heading}
                extent={ship.role === 'corvette' ? CORVETTE_EXTENT : HULL_EXTENT}
              />
            ) : ship.role === 'corvette' ? null : (
              <div style={{
                position: 'absolute',
                left: drawn.left,
                top: drawn.top,
              }}>
                <ShipMark role={ship.role} color={hullColor(ship)} heading={ship.heading} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ShotGlyph({ shot }: { shot: { id: string; x: number; y: number; side: 'player' | 'rival'; splash: boolean; mining: boolean; heavy: boolean; angle: number } }) {
  const color = shot.side === 'rival' ? '#fca5a5' : shot.splash ? '#e879f9' : '#fef08a'
  if (shot.mining) {
    const length = 18
    const beam = '#fef08a'
    return (
      <div
        data-shot={shot.id}
        data-shot-kind="mining"
        style={{
          position: 'absolute',
          left: shot.x - Math.cos(shot.angle) * length,
          top: shot.y - Math.sin(shot.angle) * length - 1,
          width: length,
          height: 2,
          backgroundColor: beam,
          boxShadow: `0 0 6px ${beam}`,
          transformOrigin: '0 50%',
          transform: `rotate(${shot.angle}rad)`,
        }}
      />
    )
  }
  if (shot.heavy) {
    return (
      <div
        data-shot={shot.id}
        data-shot-kind="platform"
        style={{
          position: 'absolute',
          left: shot.x - 6,
          top: shot.y - 6,
          width: 12,
          height: 12,
          borderRadius: 12,
          backgroundColor: '#e0f2fe',
          boxShadow: '0 0 6px #22d3ee',
        }}
      />
    )
  }
  if (shot.splash) {
    return (
      <div
        data-shot={shot.id}
        data-shot-kind="missile"
        style={{
          position: 'absolute',
          left: shot.x - 9,
          top: shot.y - 4,
          width: 18,
          height: 8,
          backgroundColor: color,
          clipPath: 'polygon(0% 25%, 62% 25%, 62% 0%, 100% 50%, 62% 100%, 62% 75%, 0% 75%)',
          transform: `rotate(${shot.angle}rad)`,
          transformOrigin: 'center',
        }}
      />
    )
  }
  const size = shot.side === 'player' ? 3 : 5
  return (
    <div
      data-shot={shot.id}
      data-shot-kind="gun"
      style={{
        position: 'absolute',
        left: shot.x - size / 2,
        top: shot.y - size / 2,
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: color,
      }}
    />
  )
}

function Blast({ blast }: { blast: { id: number; side: 'player' | 'rival'; size: number; bright: number; cells: { x: number; y: number }[] } }) {
  const color = blast.side === 'rival' ? '#fca5a5' : '#e879f9'
  const gap = 1
  return (
    <>
      {blast.cells.map(cell => (
        <div
          key={`${cell.x},${cell.y}`}
          data-blast={blast.id}
          data-blast-cell={`${cell.x},${cell.y}`}
          data-side={blast.side}
          style={{
            position: 'absolute',
            left: cell.x,
            top: cell.y,
            width: Math.max(1, blast.size - gap),
            height: Math.max(1, blast.size - gap),
            backgroundColor: color,
            opacity: Math.max(0, Math.min(1, blast.bright)) * 0.85,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      ))}
    </>
  )
}

function Laser({ laser }: { laser: { x0: number; y0: number; x1: number; y1: number; side: 'player' | 'rival'; source: 'cannon' | 'laser' } }) {
  const color = beamColor(laser)
  const length = Math.hypot(laser.x1 - laser.x0, laser.y1 - laser.y0)
  const angle = Math.atan2(laser.y1 - laser.y0, laser.x1 - laser.x0) * 180 / Math.PI
  return (
    <div
      data-laser=""
      data-side={laser.side}
      data-source={laser.source}
      style={{
        position: 'absolute',
        left: laser.x0,
        top: laser.y0 - 1,
        width: length,
        height: 2,
        backgroundColor: color,
        boxShadow: `0 0 6px ${color}`,
        transformOrigin: '0 50%',
        transform: `rotate(${angle}deg)`,
      }}
    />
  )
}

function beamColor(laser: { side: 'player' | 'rival'; source: 'cannon' | 'laser' }): string {
  if (laser.source === 'laser') return laser.side === 'rival' ? '#ef4444' : '#22d3ee'
  return laser.side === 'rival' ? '#fca5a5' : '#fef08a'
}

function stockBox(role: ShipRole): { left: number; top: number; width: number; height: number } {
  if (role === 'platform') return { left: -20, top: -20, width: 40, height: 40 }
  if (role === 'corvette') {
    return { left: -CORVETTE_EXTENT / 2, top: -CORVETTE_EXTENT / 2, width: CORVETTE_EXTENT, height: CORVETTE_EXTENT }
  }
  const mark = SHIP_MARK[role]
  return { left: -mark.width / 2, top: -mark.height / 2, width: mark.width, height: mark.height }
}

function hullBox(cells: HullCell[], extent: number = HULL_EXTENT): { left: number; top: number; width: number; height: number; size: number } {
  const minX = Math.min(...cells.map(cell => cell.x))
  const maxX = Math.max(...cells.map(cell => cell.x))
  const minY = Math.min(...cells.map(cell => cell.y))
  const maxY = Math.max(...cells.map(cell => cell.y))
  const size = extent / Math.max(maxX - minX + 1, maxY - minY + 1)
  return {
    left: minX * size - size / 2,
    top: minY * size - size / 2,
    width: (maxX - minX + 1) * size,
    height: (maxY - minY + 1) * size,
    size,
  }
}

function hullColor(ship: { side: 'player' | 'rival'; role: ShipRole }): string {
  if (ship.side === 'rival') return '#ef4444'
  if (ship.role === 'fighter') return '#38bdf8'
  return '#e2e8f0'
}
