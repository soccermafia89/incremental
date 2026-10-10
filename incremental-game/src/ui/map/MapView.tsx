import type { MapScene } from '../../core/game/Game'
import { Base } from './Base'
import { SHIP_MARK, ShipMark } from './ShipMark'

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

      <Base x={scene.base.x} y={scene.base.y} radius={scene.base.radius} fill="#16324f" stroke="#4a9eff" marker="base" />
      <Base x={scene.rival.x} y={scene.rival.y} radius={scene.rival.radius} fill="#4a1520" stroke="#ef4444" marker="rival-base" />

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

      {scene.shots.map(shot => (
        <div
          key={shot.id}
          data-shot={shot.id}
          style={{
            position: 'absolute',
            left: shot.x - 2,
            top: shot.y - 2,
            width: 5,
            height: 5,
            borderRadius: 5,
            backgroundColor: shot.side === 'rival' ? '#fca5a5' : '#fef08a',
          }}
        />
      ))}

      {scene.ships.map(ship => {
        const mark = SHIP_MARK[ship.role]
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
            <div style={{
              position: 'absolute',
              left: -mark.width / 2,
              top: -mark.height / 2 - 6,
              width: mark.width,
              height: 3,
              backgroundColor: '#3f3f46',
              borderRadius: 2,
            }}>
              <div style={{
                width: `${(ship.health / ship.maxHealth) * 100}%`,
                height: '100%',
                backgroundColor: '#4ade80',
                borderRadius: 2,
              }} />
            </div>
            <div style={{
              position: 'absolute',
              left: -mark.width / 2,
              top: -mark.height / 2,
            }}>
              <ShipMark role={ship.role} color={hull(ship)} heading={ship.heading} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Laser({ laser }: { laser: { x0: number; y0: number; x1: number; y1: number; side: 'player' | 'rival' } }) {
  const color = laser.side === 'rival' ? '#fca5a5' : '#fef08a'
  const length = Math.hypot(laser.x1 - laser.x0, laser.y1 - laser.y0)
  const angle = Math.atan2(laser.y1 - laser.y0, laser.x1 - laser.x0) * 180 / Math.PI
  return (
    <div
      data-laser=""
      data-side={laser.side}
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

function hull(ship: { side: 'player' | 'rival'; role: 'miner' | 'fighter' }): string {
  if (ship.side === 'rival') return '#ef4444'
  if (ship.role === 'fighter') return '#38bdf8'
  return '#e2e8f0'
}
