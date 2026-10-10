interface StoredSeat {
  token: string
  playerId: string
}

/** The seat this browser tab holds for one server. */
export class SeatMemory {
  private readonly key: string

  constructor(baseUrl: string) {
    this.key = `incremental.seat:${baseUrl}`
  }

  read(): StoredSeat | null {
    try {
      if (typeof sessionStorage === 'undefined') return null
      const raw = sessionStorage.getItem(this.key)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null) return null
      const seat = parsed as { token?: unknown; playerId?: unknown }
      if (typeof seat.token !== 'string' || typeof seat.playerId !== 'string') return null
      return { token: seat.token, playerId: seat.playerId }
    } catch {
      return null
    }
  }

  write(seat: StoredSeat): void {
    try {
      if (typeof sessionStorage === 'undefined') return
      sessionStorage.setItem(this.key, JSON.stringify(seat))
    } catch {
      // Private mode — resume will claim a new seat.
    }
  }
}
