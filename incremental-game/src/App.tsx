import { useState } from 'react'
import { ComponentMenu } from './ui/sidebar/ComponentMenu'
import { SettingsPanel } from './ui/settings/SettingsPanel'
import { DevGameStatePanel } from './ui/settings/DevGameStatePanel'
import { DEFAULT_SETTINGS } from './ui/settings/GameSettings'
import type { GameSettings } from './ui/settings/GameSettings'
import { FitMap } from './ui/map/FitMap'
import { EnemyPanel } from './ui/upgrades/EnemyPanel'
import { FighterPanel } from './ui/upgrades/FighterPanel'
import { designFile } from './core/designer'
import { DesignerPanel } from './ui/designer/DesignerPanel'
import { downloadDesign } from './ui/designer/download'
import { FleetPanel } from './ui/fleet/FleetPanel'
import { MiningPanel } from './ui/upgrades/MiningPanel'
import { ShipUpgradesPanel } from './ui/upgrades/ShipUpgradesPanel'
import { FullScreen } from './ui/shell/FullScreen'
import { MainColumn } from './ui/shell/MainColumn'
import { useSession } from './ui/shell/useSession'
import { THEME } from './ui/sidebar/theme'
import './App.css'

const DEV_VIEWS = ['devGameState']

function App() {
  const session = useSession()
  const [activeView, setActiveView] = useState('map')
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleViewChange = (view: string) => {
    if (DEV_VIEWS.includes(view) && !settings.devMode) return
    setActiveView(view)
  }

  const handleSettingsChange = (next: GameSettings) => {
    setSettings(next)
    if (!next.devMode && DEV_VIEWS.includes(activeView)) setActiveView('home')
  }

  const handleGameChanged = () => {
    setActionError(null)
    session.bump()
    setActiveView('map')
  }

  if (session.connectError) return <FullScreen>{session.connectError}</FullScreen>
  if (!session.ready || !session.client.getGame()) {
    return <FullScreen>Connecting{session.remoteUrl ? ` to ${session.remoteUrl}` : ''}…</FullScreen>
  }

  const game = session.client.getGame()
  if (!game) return null
  const scene = game.scene()

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: THEME.page,
    }}>
      <h1 style={{
        margin: '5px 0',
        textAlign: 'center',
        fontSize: '1.5rem',
        color: 'white',
      }}>
        Incremental
      </h1>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ComponentMenu
          activeView={activeView}
          onViewChange={handleViewChange}
          devMode={settings.devMode}
          showMining={!scene.mining.automine.owned}
          showDesigner={scene.designer.owned}
          showFleet={scene.designer.owned}
          showFighter={scene.mining.tractorBeam.owned}
          showEnemy={scene.mining.tractorBeam.owned}
          gift={scene.gift}
          onBuyUpgrades={() => {
            void session.client.act({ type: 'upgradesToShipDesign' }).then(result => {
              setActionError(result.ok ? null : result.error)
              session.setFrame(value => value + 1)
            })
          }}
          onSkipLevelOne={() => {
            void session.client.act({ type: 'skipLevelOne' }).then(result => {
              setActionError(result.ok ? null : result.error)
              session.setFrame(value => value + 1)
            })
          }}
          onGift={() => {
            void session.client.act({ type: 'claimGift' }).then(result => {
              setActionError(result.ok ? null : result.error)
              session.setFrame(value => value + 1)
            })
          }}
        />
        <MainColumn
          viewKey={session.viewKey}
          money={scene.money}
          remoteUrl={session.remoteUrl}
          actionError={actionError}
          fit={activeView === 'map'}
          fill={activeView === 'designer'}
          nextMiner={scene.nextMiner}
          nextFighter={scene.nextFighter}
        >
          {activeView === 'map' && (
            <FitMap scene={scene} frame={session.frame} />
          )}
          {activeView === 'mining' && !scene.mining.automine.owned && (
            <MiningPanel
              mining={scene.mining}
              onUpgrade={upgrade => {
                void session.client.act({ type: 'upgradeMining', upgrade }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  if (result.ok && upgrade === 'automine') setActiveView('map')
                  session.setFrame(value => value + 1)
                })
              }}
            />
          )}
          {activeView === 'fighter' && scene.mining.tractorBeam.owned && (
            <FighterPanel
              fighter={scene.fighter}
              onUpgrade={upgrade => {
                void session.client.act({ type: 'upgradeFighter', upgrade }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
            />
          )}
          {activeView === 'enemy' && scene.mining.tractorBeam.owned && (
            <EnemyPanel
              enemy={scene.enemy}
              onUpgrade={upgrade => {
                void session.client.act({ type: 'upgradeEnemy', upgrade }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
            />
          )}
          {activeView === 'fleet' && scene.designer.owned && (
            <FleetPanel
              fleet={scene.fleet}
              onChoose={design => {
                void session.client.act({ type: 'chooseProduction', design }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
            />
          )}
          {activeView === 'designer' && scene.designer.owned && (
            <DesignerPanel
              designer={scene.designer}
              preview={(component, x, y, rotation) => game.designPreview(component, x, y, rotation)}
              onPlace={(component, x, y, rotation) => {
                void session.client.act({ type: 'placeComponent', component, x, y, rotation }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
              onRemove={id => {
                void session.client.act({ type: 'removeComponent', id }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
              onSave={() => {
                void session.client.act({ type: 'saveDesign' }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
              onExport={() => {
                downloadDesign(designFile(game.exportState().parts))
              }}
              onReset={() => {
                void session.client.act({ type: 'resetDesign' }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
              onImport={file => {
                void file.text().then(text => {
                  let blueprint: unknown
                  try {
                    blueprint = JSON.parse(text) as unknown
                  } catch {
                    setActionError('That file is not JSON.')
                    return
                  }
                  return session.client.act({ type: 'importDesign', blueprint }).then(result => {
                    setActionError(result.ok ? null : result.error)
                    session.setFrame(value => value + 1)
                  })
                })
              }}
            />
          )}
          {activeView === 'upgrades' && (
            <ShipUpgradesPanel
              miner={scene.miner}
              showMiner={!scene.mining.automine.owned}
              designer={scene.designer}
              weapon={scene.weapon}
              onUnlockDesigner={() => {
                void session.client.act({ type: 'unlockDesigner' }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
              onUnlockWeapon={weapon => {
                void session.client.act({ type: 'unlockWeapon', weapon }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
              onUnlockEngine={engine => {
                void session.client.act({ type: 'unlockEngine', engine }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
              onUpgradeWeapon={upgrade => {
                void session.client.act({ type: 'upgradeWeapon', upgrade }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
              onUpgrade={upgrade => {
                void session.client.act({ type: 'upgradeMiner', upgrade }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
            />
          )}
          {activeView === 'settings' && (
            <SettingsPanel
              settings={settings}
              onSettingsChange={handleSettingsChange}
              client={session.client}
              onGameChanged={handleGameChanged}
            />
          )}
          {activeView === 'devGameState' && settings.devMode && (
            <DevGameStatePanel game={game} />
          )}
        </MainColumn>
      </div>
    </div>
  )
}

export default App
