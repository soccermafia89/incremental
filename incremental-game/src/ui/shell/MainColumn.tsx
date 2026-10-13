import type { ReactNode } from 'react'
import { PlatformMark } from '../map/PlatformMark'
import { ShipMark } from '../map/ShipMark'
import { THEME } from '../sidebar/theme'
import { ErrorBoundary, ErrorFallback } from '../ErrorBoundary'

const BAY_COLORS = ['#c4b5fd', '#f0abfc', '#86efac', '#fcd34d']

export function MainColumn({
  viewKey,
  money,
  crystals,
  remoteUrl,
  actionError,
  fit,
  fill = false,
  nextMiner,
  nextFighter,
  nextBays,
  nextDefense,
  children,
}: {
  viewKey: number
  money: number
  crystals: number
  remoteUrl: string | null
  actionError: string | null
  fit: boolean
  /** Stretch the panel across the main column instead of hugging its content. */
  fill?: boolean
  nextMiner: { progress: number; cells: { x: number; y: number; color: string }[] } | null
  nextFighter: { progress: number; cells: { x: number; y: number; color: string }[] } | null
  nextBays: { index: number; progress: number; cells: { x: number; y: number; color: string }[] }[]
  /** 0 to 1 while a defense platform is building. Null until capacity is owned. */
  nextDefense: number | null
  children: ReactNode
}) {
  return (
    <div key={viewKey} style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    }}>
      <div
        data-resources
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 16,
          padding: '8px 20px',
          color: 'white',
          backgroundColor: THEME.sidebar,
          borderBottom: `1px solid ${THEME.sidebarBorder}`,
          fontSize: 14,
          fontWeight: 'bold',
        }}
      >
        <span style={{ color: '#e7e5e4', fontWeight: 600 }}>Money</span>
        <span data-money={money} style={{ color: '#93c5fd' }}>${money}</span>
        <span style={{ color: '#e7e5e4', fontWeight: 600 }}>Crystals</span>
        <span data-crystals={crystals} style={{ color: '#c4b5fd' }}>{crystals}</span>
      </div>
      <ErrorBoundary
        label="Main"
        fallback={<ErrorFallback
          title="This view failed"
          detail="Something went wrong while rendering. The rest of the shell is still there."
        />}
      >
        <div style={{
          display: 'flex',
          flexDirection: fit || fill ? 'column' : 'row',
          justifyContent: fit || fill ? 'flex-start' : 'center',
          alignItems: fit || fill ? 'stretch' : 'flex-start',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: fit ? 'hidden' : 'auto',
          padding: fill ? 16 : 0,
          boxSizing: 'border-box',
        }}>
          {fit ? children : (
            <div style={{
              padding: '16px 20px',
              width: fill ? '100%' : undefined,
              height: fill ? '100%' : undefined,
              flex: fill ? 1 : undefined,
              minHeight: fill ? 0 : undefined,
              display: fill ? 'flex' : undefined,
              flexDirection: fill ? 'column' : undefined,
              boxSizing: 'border-box',
              backgroundColor: THEME.page,
              borderRadius: '8px',
              border: `1px solid ${THEME.sidebarBorder}`,
            }}>
              {children}
            </div>
          )}
        </div>
      </ErrorBoundary>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        padding: '10px',
        color: 'white',
        backgroundColor: THEME.sidebar,
        borderTop: `1px solid ${THEME.sidebarBorder}`,
        minHeight: 18,
      }}>
        {nextMiner && <LaunchBar marker="miner" progress={nextMiner.progress} color="#e2e8f0" cells={nextMiner.cells} />}
        {nextFighter && <LaunchBar marker="fighter" progress={nextFighter.progress} color="#38bdf8" cells={nextFighter.cells} />}
        {nextBays.map(bay => (
          <LaunchBar key={bay.index} marker="bay" bay={bay.index} progress={bay.progress} color={BAY_COLORS[(bay.index - 1) % BAY_COLORS.length]} cells={bay.cells} />
        ))}
        {nextDefense !== null && <DefenseBar progress={nextDefense} />}
        {(remoteUrl || actionError) && (
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {remoteUrl && <span>Server: {remoteUrl.replace(/^https?:\/\//, '')}</span>}
            {actionError && (
              <span data-action-error style={{ color: '#f87171' }}>{actionError}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function LaunchBar({
  marker,
  bay,
  progress,
  color,
  cells,
}: {
  marker: 'miner' | 'fighter' | 'bay'
  bay?: number
  progress: number
  color: string
  cells: { x: number; y: number; color: string }[]
}) {
  const filled = `${Math.round(progress * 100)}%`
  const mark = marker === 'miner' ? 'miner' : 'fighter'
  return (
    <div
      data-miner-launch={marker === 'miner' ? true : undefined}
      data-fighter-launch={marker === 'fighter' ? true : undefined}
      data-bay-launch={marker === 'bay' ? bay : undefined}
      style={{
        position: 'relative',
        width: 180,
        height: 28,
        backgroundColor: '#27272a',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <div
        data-miner-launch-progress={marker === 'miner' ? progress : undefined}
        data-fighter-launch-progress={marker === 'fighter' ? progress : undefined}
        data-bay-launch-progress={marker === 'bay' ? progress : undefined}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: filled,
          backgroundColor: '#1e3a5f',
        }}
      />
      <div style={{
        position: 'absolute',
        left: 8,
        top: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
      }}>
        {cells.length > 0 ? <HullIcon cells={cells} /> : <ShipMark role={mark} color={color} marker={mark} />}
      </div>
    </div>
  )
}

function DefenseBar({ progress }: { progress: number }) {
  const filled = `${Math.round(progress * 100)}%`
  return (
    <div
      data-defense-launch=""
      style={{
        position: 'relative',
        width: 180,
        height: 28,
        backgroundColor: '#27272a',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <div
        data-defense-launch-progress={progress}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: filled,
          backgroundColor: '#1e3a5f',
        }}
      />
      <div style={{ position: 'absolute', left: 18, top: 14, width: 0, height: 0 }}>
        <div style={{ position: 'absolute', transform: 'scale(0.45)' }}>
          <PlatformMark />
        </div>
      </div>
    </div>
  )
}

function HullIcon({ cells }: { cells: { x: number; y: number; color: string }[] }) {
  const minX = Math.min(...cells.map(cell => cell.x))
  const maxX = Math.max(...cells.map(cell => cell.x))
  const minY = Math.min(...cells.map(cell => cell.y))
  const maxY = Math.max(...cells.map(cell => cell.y))
  const span = Math.max(maxX - minX + 1, maxY - minY + 1)
  const size = Math.max(2, Math.floor(22 / span))
  return (
    <div style={{ position: 'relative', width: (maxX - minX + 1) * size, height: (maxY - minY + 1) * size }}>
      {cells.map(cell => (
        <span
          key={`${cell.x},${cell.y}`}
          style={{
            position: 'absolute',
            left: (cell.x - minX) * size,
            top: (cell.y - minY) * size,
            width: size - 1,
            height: size - 1,
            backgroundColor: cell.color,
          }}
        />
      ))}
    </div>
  )
}
