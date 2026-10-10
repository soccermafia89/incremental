import { useCallback, useEffect, useState } from 'react'
import type { GameClient } from '../../service/GameClient'
import { LocalGameClient } from '../../service/GameClient'
import { HttpGameClient } from '../../service/HttpGameClient'
import { parseServerUrl } from '../../service/httpApi'

function createClient(): GameClient {
  const serverUrl = parseServerUrl(window.location.search)
  if (serverUrl) return new HttpGameClient(serverUrl)
  const local = new LocalGameClient()
  void local.newGame()
  return local
}

/** Owns the game client: local animation frames, or a remote connection. */
export function useSession() {
  const [client] = useState(createClient)
  const [ready, setReady] = useState(client.kind === 'local')
  const [connectError, setConnectError] = useState<string | null>(null)
  const [frame, setFrame] = useState(0)
  const [viewKey, setViewKey] = useState(0)

  const bump = useCallback(() => setViewKey(value => value + 1), [])

  useEffect(() => {
    if (client.kind !== 'local') return
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const dt = now - last
      last = now
      if (dt > 0) client.advance(Math.min(dt, 60_000))
      setFrame(value => value + 1)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [client])

  useEffect(() => {
    if (client.kind !== 'remote') return
    const remote = client as HttpGameClient
    let cancelled = false
    remote.connect()
      .then(() => {
        if (cancelled) return
        setReady(true)
        remote.startPolling(() => bump())
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setConnectError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      cancelled = true
      remote.stopPolling()
    }
  }, [client, bump])

  const remoteUrl = client.kind === 'remote' ? (client as HttpGameClient).baseUrl : null
  return { client, ready, connectError, frame, setFrame, viewKey, bump, remoteUrl }
}
