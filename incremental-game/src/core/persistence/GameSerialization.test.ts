import { describe, expect, it } from 'vitest'
import { GameImpl } from '../game/Game'
import { tuned } from '../game/fixture'
import { SAVE_FORMAT_VERSION } from './GameSnapshot'
import { GameDeserializer } from './GameDeserializer'
import { GameSerializer } from './GameSerializer'

const config = tuned({ ships: { speed: 0 } })

describe('save format', () => {
  it('round-trips miners, asteroids, and the spawn clock', () => {
    const game = GameImpl.create(config, 1)
    game.advance(config.asteroids.spawnMs)
    const snapshot = GameSerializer.serialize(game, '2026-01-01T00:00:00.000Z')
    expect(snapshot.version).toBe(SAVE_FORMAT_VERSION)
    const restored = GameDeserializer.deserialize(snapshot, config)
    expect(restored.exportState()).toEqual(game.exportState())
  })

  it('rejects a different save format', () => {
    expect(() => GameDeserializer.deserialize({ version: 1, savedAt: '' }, config)).toThrow(
      /not supported/,
    )
  })

  it('rejects a file that is not a snapshot', () => {
    expect(() => GameDeserializer.deserialize(null, config)).toThrow(/not a game snapshot/)
  })
})
