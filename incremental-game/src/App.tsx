import { useState } from 'react'
import { ComponentMenu } from './ui/sidebar/ComponentMenu'
import { SettingsPanel } from './ui/settings/SettingsPanel'
import { DevGameStatePanel } from './ui/settings/DevGameStatePanel'
import { DEFAULT_SETTINGS } from './ui/settings/GameSettings'
import type { GameSettings } from './ui/settings/GameSettings'
import { FitMap } from './ui/map/FitMap'
import { DefensePanel } from './ui/upgrades/DefensePanel'
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

  const actDesign = (action: Parameters<typeof session.client.act>[0]) => {
    return session.client.act(action).then(result => {
      setActionError(result.ok ? null : result.error)
      session.setFrame(value => value + 1)
      return result.ok
    })
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
          showMining={!scene.mining.moneyConverter.owned}
          showDesigner={scene.designer.owned}
          showFleet={scene.designer.owned}
          showFighter={scene.mining.tractorBeam.owned && (scene.fighter.costs.count !== null || scene.fighter.costs.production !== null)}
          showEnemy={scene.mining.tractorBeam.owned}
          gift={scene.gift}
          crystalGift={scene.crystalGift}
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
          onCrystalGift={() => {
            void session.client.act({ type: 'claimCrystalGift' }).then(result => {
              setActionError(result.ok ? null : result.error)
              session.setFrame(value => value + 1)
            })
          }}
        />
        <MainColumn
          viewKey={session.viewKey}
          money={scene.money}
          crystals={scene.crystals}
          remoteUrl={session.remoteUrl}
          actionError={actionError}
          fit={activeView === 'map'}
          fill={activeView === 'designer'}
          nextMiner={scene.nextMiner}
          nextFighter={scene.nextFighter}
          nextBays={scene.nextBays}
          nextDefense={scene.defense.building}
        >
          {activeView === 'map' && (
            <FitMap scene={scene} frame={session.frame} />
          )}
          {activeView === 'mining' && !scene.mining.moneyConverter.owned && (
            <MiningPanel
              mining={scene.mining}
              onUpgrade={upgrade => {
                void session.client.act({ type: 'upgradeMining', upgrade }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  if (result.ok && upgrade === 'moneyConverter') setActiveView('map')
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
              corvette={scene.corvette}
              onUpgrade={upgrade => {
                void session.client.act({ type: 'upgradeEnemy', upgrade }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
              onUnlockCorvette={() => {
                void session.client.act({ type: 'unlockCorvette' }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
              onUpgradeCorvette={upgrade => {
                void session.client.act({ type: 'upgradeCorvette', upgrade }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
            />
          )}
          {activeView === 'defense' && scene.mining.tractorBeam.owned && (
            <DefensePanel
              defense={scene.defense}
              onUpgrade={upgrade => {
                void session.client.act({ type: 'upgradeDefense', upgrade }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
            />
          )}
          {activeView === 'fleet' && scene.designer.owned && (
            <FleetPanel
              fleet={scene.fleet}
              onChoose={(design, bay) => {
                void session.client.act({ type: 'chooseProduction', design, ...(bay === 0 ? {} : { bay }) }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
              onUnlockBay={() => {
                void session.client.act({ type: 'unlockBay' }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
              onUpgrade={bay => {
                void session.client.act({ type: 'upgradeBay', bay }).then(result => {
                  setActionError(result.ok ? null : result.error)
                  session.setFrame(value => value + 1)
                })
              }}
              onCapacity={bay => {
                void session.client.act({ type: 'upgradeBayCapacity', bay }).then(result => {
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
              onSave={() => actDesign({ type: 'saveDesign' })}
              onRewrite={name => actDesign({ type: 'rewriteDesign', name })}
              onLoad={name => actDesign({ type: 'loadDesign', name })}
              onDelete={name => {
                void actDesign({ type: 'deleteDesign', name })
              }}
              onExport={() => {
                downloadDesign(designFile(game.exportState().parts))
              }}
              onReset={() => actDesign({ type: 'resetDesign' })}
              onImport={file => file.text().then(text => {
                let blueprint: unknown
                try {
                  blueprint = JSON.parse(text) as unknown
                } catch {
                  setActionError('That file is not JSON.')
                  return false
                }
                return actDesign({ type: 'importDesign', blueprint })
              })}
            />
          )}
          {activeView === 'upgrades' && (
            <ShipUpgradesPanel
              miner={scene.miner}
              showMiner={!scene.mining.automine.owned}
              showFighter={scene.mining.tractorBeam.owned && (scene.fighter.costs.speed !== null || scene.fighter.costs.attackRate !== null || scene.fighter.costs.health !== null || scene.fighter.costs.damage !== null)}
              fighter={scene.fighter}
              designer={scene.designer}
              weapon={scene.weapon}
              missileCorvetteKilled={scene.missileCorvetteKilled}
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
              onUpgradeFighter={upgrade => {
                void session.client.act({ type: 'upgradeFighter', upgrade }).then(result => {
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
