import type { ShellTheme } from './theme'
import { THEME } from './theme'

interface ComponentMenuProps {
  activeView: string
  onViewChange: (view: string) => void
  devMode: boolean
  /** Hidden once the money converter is bought. */
  showMining: boolean
  /** Shown once the ship designer has been bought. */
  showDesigner: boolean
  /** Shown once a ship design can be chosen for production. */
  showFleet: boolean
  /** Shown once the tractor beam has been bought. The purchase is permanent. */
  showFighter: boolean
  /** Shown once rival ships start attacking, which is the tractor beam purchase. */
  showEnemy: boolean
  /** What the next click of the gift button pays. */
  gift: number
  /** What the next click of the crystal button pays. */
  crystalGift: number
  onGift: () => void
  onCrystalGift: () => void
  onBuyUpgrades: () => void
  onSkipLevelOne: () => void
}

type Tone = 'nav' | 'settings' | 'dev'

const PRIMARY: { label: string; view: string; tone: Tone }[] = [
  { label: 'Settings', view: 'settings', tone: 'settings' },
  { label: 'Map', view: 'map', tone: 'nav' },
  { label: 'Ship Upgrades', view: 'upgrades', tone: 'nav' },
  { label: 'Ship Designer', view: 'designer', tone: 'nav' },
  { label: 'Fleet Design', view: 'fleet', tone: 'nav' },
  { label: 'Mining', view: 'mining', tone: 'nav' },
  { label: 'Default fighter', view: 'fighter', tone: 'nav' },
  { label: 'Enemy', view: 'enemy', tone: 'nav' },
  { label: 'Defense Platforms', view: 'defense', tone: 'nav' },
  { label: 'Game', view: 'home', tone: 'nav' },
]

const DEV: { label: string; view: string; tone: Tone }[] = [
  { label: 'Game State', view: 'devGameState', tone: 'dev' },
]

function colors(theme: ShellTheme, tone: Tone): { color: string; highlight: string; border: string } {
  if (tone === 'settings') {
    return { color: theme.settings, highlight: theme.settingsHighlight, border: theme.settingsBorder }
  }
  if (tone === 'dev') {
    return { color: theme.nav, highlight: theme.settings, border: theme.settingsBorder }
  }
  return { color: theme.nav, highlight: theme.navHighlight, border: theme.navBorder }
}

export function ComponentMenu({ activeView, onViewChange, devMode, showMining, showDesigner, showFleet, showFighter, showEnemy, gift, crystalGift, onGift, onCrystalGift, onBuyUpgrades, onSkipLevelOne }: ComponentMenuProps) {
  return (
    <div
      style={{
        width: '200px',
        height: '100%',
        backgroundColor: THEME.sidebar,
        borderRight: `2px solid ${THEME.sidebarBorder}`,
        padding: '20px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        overflow: 'hidden',
      }}
    >
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        {PRIMARY.filter(item => (item.view !== 'mining' || showMining) && (item.view !== 'designer' || showDesigner) && (item.view !== 'fleet' || showFleet) && (item.view !== 'fighter' || showFighter) && (item.view !== 'enemy' || showEnemy) && (item.view !== 'defense' || showEnemy)).map(item => (
          <NavButton key={item.view} item={item} activeView={activeView} onViewChange={onViewChange} />
        ))}
        {devMode && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginTop: '10px',
            paddingTop: '15px',
            borderTop: `2px solid ${THEME.settingsBorder}`,
          }}>
            <div style={{
              color: THEME.tech,
              fontSize: '11px',
              fontWeight: 'bold',
              letterSpacing: '1px',
              textAlign: 'center',
            }}>
              DEV
            </div>
            {DEV.map(item => (
              <NavButton key={item.view} item={item} activeView={activeView} onViewChange={onViewChange} />
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        data-upgrades-to-ship-design
        onClick={onBuyUpgrades}
        style={{
          width: '100%',
          padding: '14px 12px',
          backgroundColor: THEME.accent,
          color: 'white',
          border: `2px solid ${THEME.navBorder}`,
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          flexShrink: 0,
        }}
      >
        Upgrades to ship design
      </button>
      <button
        type="button"
        data-skip-level-one
        onClick={onSkipLevelOne}
        style={{
          width: '100%',
          padding: '14px 12px',
          backgroundColor: THEME.accent,
          color: 'white',
          border: `2px solid ${THEME.navBorder}`,
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          flexShrink: 0,
        }}
      >
        All miner & mining
      </button>
      <button
        type="button"
        data-crystal-gift={crystalGift}
        onClick={onCrystalGift}
        style={{
          width: '100%',
          padding: '14px 12px',
          backgroundColor: THEME.accentStrong,
          color: 'white',
          border: `2px solid ${THEME.accentBorder}`,
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          flexShrink: 0,
        }}
      >
        +{crystalGift} crystals
      </button>
      <button
        type="button"
        data-gift={gift}
        onClick={onGift}
        style={{
          width: '100%',
          padding: '14px 12px',
          backgroundColor: THEME.accentStrong,
          color: 'white',
          border: `2px solid ${THEME.accentBorder}`,
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          flexShrink: 0,
        }}
      >
        +${gift}
      </button>
    </div>
  )
}

function NavButton({
  item,
  activeView,
  onViewChange,
}: {
  item: { label: string; view: string; tone: Tone }
  activeView: string
  onViewChange: (view: string) => void
}) {
  const active = activeView === item.view
  const paint = colors(THEME, item.tone)
  return (
    <button
      type="button"
      onClick={() => onViewChange(item.view)}
      data-nav={item.tone === 'nav' ? item.view : undefined}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: active ? paint.highlight : paint.color,
        color: 'white',
        border: `1px solid ${paint.border}`,
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={(event) => {
        if (!active) event.currentTarget.style.backgroundColor = paint.highlight
      }}
      onMouseLeave={(event) => {
        if (!active) event.currentTarget.style.backgroundColor = paint.color
      }}
    >
      {item.label}
    </button>
  )
}
