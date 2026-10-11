import { describe, expect, it } from 'vitest'
import { SAVE_FORMAT_VERSION } from '../core/persistence/GameSnapshot'
import { GameService } from './GameService'

describe('GameService', () => {
  it('starts empty, saves, and loads', () => {
    const service = new GameService()
    expect(service.state().ok).toBe(false)
    expect(service.newGame().ok).toBe(true)
    const saved = service.save()
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.data.version).toBe(SAVE_FORMAT_VERSION)
    expect(service.load(saved.data).ok).toBe(true)
  })

  it('upgrades the player miner and refuses anything else', () => {
    const service = new GameService()
    service.newGame()
    expect(service.options()).toEqual({
      ok: true,
      data: [
        { type: 'upgradeMiner', upgrade: 'speed' },
        { type: 'upgradeMiner', upgrade: 'damage' },
        { type: 'upgradeMiner', upgrade: 'fireRate' },
        { type: 'upgradeMiner', upgrade: 'carry' },
        { type: 'upgradeMiner', upgrade: 'count' },
        { type: 'upgradeMiner', upgrade: 'production' },
        { type: 'upgradeMining', upgrade: 'unlock' },
        { type: 'unlockDesigner' },
        { type: 'upgradesToShipDesign' },
        { type: 'skipLevelOne' },
        { type: 'claimGift' },
      ],
    })
    expect(service.act({ type: 'upgradeEnemy', upgrade: 'spawnRate' })).toMatchObject({ ok: false, reason: 'unknown-action' })
    expect(service.act({ type: 'upgradeEnemy', upgrade: 'capacity' })).toMatchObject({ ok: false, reason: 'unknown-action' })
    expect(service.act({ type: 'upgradeMiner', upgrade: 'damage' })).toMatchObject({ ok: false, reason: 'cant-afford' })
    expect(service.act({ type: 'upgradeMiner', upgrade: 'count' })).toMatchObject({ ok: false, reason: 'cant-afford' })
    expect(service.act({ type: 'upgradeMining', upgrade: 'unlock' })).toMatchObject({ ok: false, reason: 'cant-afford' })
    expect(service.act({ type: 'upgradeMining', upgrade: 'size' })).toMatchObject({ ok: false, reason: 'unknown-action' })
    expect(service.act({ type: 'upgradeMining', upgrade: 'golden' })).toMatchObject({ ok: false, reason: 'unknown-action' })
    expect(service.getGame()?.exportState().minerLevels.damage).toBe(0)
    expect(service.getGame()?.exportState().miningLevels.size).toBe(0)
    expect(service.getGame()?.exportState().tractorBeam).toBe(false)
    expect(service.getGame()?.exportState().golden).toBe(false)
    expect(service.getGame()?.exportState().miningUnlocked).toBe(false)
    expect(service.act({ type: 'upgradeFighter' })).toMatchObject({ ok: false, reason: 'unknown-action' })
    expect(service.act({ type: 'upgradeFighter', upgrade: 'speed' })).toMatchObject({ ok: false, reason: 'unknown-action' })
    expect(service.act({ type: 'upgradeMiner' })).toMatchObject({ ok: false, reason: 'unknown-action' })
    expect(service.act({ type: 'anything' })).toMatchObject({ ok: false, reason: 'unknown-action' })
  })

  it('retires miner and mining actions once automine is bought', () => {
    const service = new GameService()
    service.newGame()
    service.act({ type: 'claimGift' })
    service.act({ type: 'claimGift' })
    expect(service.act({ type: 'upgradeMining', upgrade: 'automine' })).toMatchObject({ ok: false, reason: 'unknown-action' })
    expect(service.act({ type: 'upgradeMining', upgrade: 'unlock' })).toMatchObject({ ok: true })
    const locked = service.options()
    expect(locked.ok).toBe(true)
    if (!locked.ok) return
    expect(locked.data).not.toContainEqual({ type: 'upgradeMining', upgrade: 'automine' })
    expect(service.act({ type: 'upgradeMining', upgrade: 'tractorBeam' })).toMatchObject({ ok: true })
    const offered = service.options()
    expect(offered.ok).toBe(true)
    if (!offered.ok) return
    expect(offered.data).toContainEqual({ type: 'upgradeMining', upgrade: 'automine' })
    expect(service.act({ type: 'upgradeMining', upgrade: 'automine' })).toMatchObject({ ok: true })
    const after = service.options()
    expect(after.ok).toBe(true)
    if (!after.ok) return
    expect(after.data.some(action => action.type === 'upgradeMiner' || action.type === 'upgradeMining')).toBe(false)
    expect(service.act({ type: 'upgradeMiner', upgrade: 'speed' })).toMatchObject({ ok: false, reason: 'unknown-action' })
    const game = service.getGame()
    expect(game?.exportState().asteroids).toEqual([])
    expect(game?.exportState().ships.filter(ship => ship.side === 'player')).toEqual([])
    const before = game?.scene().money ?? 0
    service.advance(1_000)
    expect(service.getGame()?.scene().money).toBe(before + 200)
  })

  it('copies the designer grid into the game', () => {
    const service = new GameService()
    service.newGame()
    expect(service.act({ type: 'saveDesign' })).toMatchObject({ ok: false, reason: 'unknown-action' })
    expect(service.act({ type: 'unlockEngine', engine: 'mediumEngine' })).toMatchObject({ ok: false, reason: 'unknown-action' })
    service.act({ type: 'claimGift' })
    expect(service.act({ type: 'unlockDesigner' })).toMatchObject({ ok: true })
    const offered = service.options()
    expect(offered.ok).toBe(true)
    if (!offered.ok) return
    expect(offered.data).toContainEqual({ type: 'saveDesign' })
    expect(offered.data).toContainEqual({ type: 'chooseProduction', design: 'fighter' })
    expect(offered.data).not.toContainEqual({ type: 'chooseProduction', design: 'saved' })
    expect(offered.data).not.toContainEqual({ type: 'unlockDesigner' })
    expect(offered.data).toContainEqual({ type: 'unlockWeapon', weapon: 'laser' })
    expect(offered.data).toContainEqual({ type: 'unlockWeapon', weapon: 'missile' })
    expect(offered.data).toContainEqual({ type: 'unlockEngine', engine: 'mediumEngine' })
    expect(offered.data).toContainEqual({ type: 'unlockEngine', engine: 'largeEngine' })
    expect(offered.data).toContainEqual({ type: 'upgradeWeapon', upgrade: 'cannonFireRate' })
    expect(offered.data).toContainEqual({ type: 'upgradeWeapon', upgrade: 'cannonDamage' })
    expect(offered.data.some(action => action.upgrade === 'laserRange' || action.upgrade === 'missileDamage')).toBe(false)
    expect(service.act({ type: 'placeComponent', component: 'laser', x: 0, y: -1, rotation: 0 })).toMatchObject({ ok: false, reason: 'unknown-action' })
    expect(service.act({ type: 'placeComponent', component: 'mediumEngine', x: 0, y: 1, rotation: 0 })).toMatchObject({ ok: false, reason: 'unknown-action' })
    expect(service.act({ type: 'unlockWeapon', weapon: 'laser' })).toMatchObject({ ok: true })
    expect(service.act({ type: 'placeComponent', component: 'structural', x: 1, y: 0, rotation: 0 })).toMatchObject({ ok: true })
    expect(service.act({ type: 'saveDesign' })).toMatchObject({ ok: true })
    const game = service.getGame()
    expect(game?.exportState().savedDesign).toEqual(game?.exportState().parts)
    expect(service.act({ type: 'chooseProduction', design: 'saved' })).toMatchObject({ ok: true })
    expect(game?.exportState().productionDesign).toBe('saved')
    const producing = service.options()
    expect(producing.ok).toBe(true)
    if (!producing.ok) return
    expect(producing.data).toContainEqual({ type: 'chooseProduction', design: 'saved' })
    expect(service.act({ type: 'removeComponent', id: 'part-1' })).toMatchObject({ ok: true })
    expect(game?.exportState().parts).toEqual([])
    expect(game?.exportState().savedDesign).toHaveLength(1)
    expect(service.act({
      type: 'importDesign',
      blueprint: { version: 1, parts: [{ id: 'part-4', component: 'structural', x: 1, y: 0, rotation: 0 }] },
    })).toMatchObject({ ok: true })
    expect(game?.exportState().parts).toEqual([{ id: 'part-4', component: 'structural', x: 1, y: 0, rotation: 0 }])
    expect(game?.exportState().savedDesign).toHaveLength(1)
    expect(service.act({ type: 'importDesign', blueprint: { version: 4, parts: [] } })).toMatchObject({ ok: false, reason: 'layout' })
    expect(service.act({ type: 'resetDesign' })).toMatchObject({ ok: true })
    expect(game?.exportState().parts).toEqual([])
    expect(game?.exportState().savedDesign).toHaveLength(1)
    expect(service.act({ type: 'placeComponent', component: 'laser', x: 0, y: -1, rotation: 0 })).toMatchObject({ ok: true })
    expect(game?.exportState().parts).toEqual([{ id: 'part-5', component: 'laser', x: 0, y: -1, rotation: 0 }])
    const afterLaser = service.options()
    expect(afterLaser.ok).toBe(true)
    if (!afterLaser.ok) return
    expect(afterLaser.data).not.toContainEqual({ type: 'unlockWeapon', weapon: 'laser' })
    expect(afterLaser.data).toContainEqual({ type: 'unlockWeapon', weapon: 'missile' })
    expect(afterLaser.data).toContainEqual({ type: 'upgradeWeapon', upgrade: 'laserRange' })
    expect(afterLaser.data).toContainEqual({ type: 'upgradeWeapon', upgrade: 'laserEnergy' })
    expect(afterLaser.data.some(action => action.upgrade === 'missileDamage')).toBe(false)
  })

  it('rejects a save from another format', () => {
    const service = new GameService()
    const loaded = service.load({ version: 999, savedAt: '2026-01-01T00:00:00.000Z' })
    expect(loaded.ok).toBe(false)
  })

  it('issues one seat token and resumes it', () => {
    const service = new GameService()
    const missing = service.join()
    expect(missing.ok).toBe(false)
    if (missing.ok) return
    expect(missing.reason).toBe('no-game')
    service.newGame()
    const joined = service.join()
    expect(joined.ok).toBe(true)
    if (!joined.ok) return
    expect(service.join(joined.data.token).ok).toBe(true)
    expect(service.join()).toMatchObject({ ok: false, reason: 'no-seats' })
  })
})
