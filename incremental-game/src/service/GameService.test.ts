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
