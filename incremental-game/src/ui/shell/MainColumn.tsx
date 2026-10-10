import type { ReactNode } from 'react'
import { ShipMark } from '../map/ShipMark'
import { THEME } from '../sidebar/theme'
import { ErrorBoundary, ErrorFallback } from '../ErrorBoundary'

export function MainColumn({
  viewKey,
  money,
  remoteUrl,
  actionError,
  fit,
  nextMiner,
  nextFighter,
  children,
}: {
  viewKey: number
  money: number
  remoteUrl: string | null
  actionError: string | null
  fit: boolean
  nextMiner: { progress: number } | null
  nextFighter: { progress: number } | null
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
          flexDirection: fit ? 'column' : 'row',
          justifyContent: 'center',
          alignItems: fit ? 'stretch' : 'flex-start',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: fit ? 'hidden' : 'auto',
        }}>
          {fit ? children : (
            <div style={{
              padding: '20px',
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
        {nextMiner && <LaunchBar marker="miner" progress={nextMiner.progress} color="#e2e8f0" />}
        {nextFighter && <LaunchBar marker="fighter" progress={nextFighter.progress} color="#38bdf8" />}
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

function LaunchBar({ marker, progress, color }: { marker: 'miner' | 'fighter'; progress: number; color: string }) {
  const filled = `${Math.round(progress * 100)}%`
  return (
    <div data-miner-launch={marker === 'miner' ? true : undefined} data-fighter-launch={marker === 'fighter' ? true : undefined} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <ShipMark role={marker} color={color} marker={marker} />
      <div style={{
        width: 180,
        height: 10,
        backgroundColor: '#3f3f46',
        borderRadius: 5,
        overflow: 'hidden',
      }}>
        <div
          data-miner-launch-progress={marker === 'miner' ? progress : undefined}
          data-fighter-launch-progress={marker === 'fighter' ? progress : undefined}
          style={{
            width: filled,
            height: '100%',
            backgroundColor: '#93c5fd',
          }}
        />
      </div>
    </div>
  )
}
