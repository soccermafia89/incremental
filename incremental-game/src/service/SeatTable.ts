export interface ClaimedSeat {
  playerId: string
  token: string
}

/**
 * In-memory seats for one HTTP game. Tokens are not part of the save file.
 * New game and load clear the table. Clients join again after that.
 */
export class SeatTable {
  private readonly byToken = new Map<string, string>()

  reset(): void {
    this.byToken.clear()
  }

  playerIdFor(token: string): string | undefined {
    return this.byToken.get(token)
  }

  resume(token: string): ClaimedSeat | null {
    const playerId = this.byToken.get(token)
    return playerId ? { playerId, token } : null
  }

  claimNext(playerIds: readonly string[]): ClaimedSeat | { error: string; reason: string } {
    const taken = new Set(this.byToken.values())
    const playerId = playerIds.find(id => !taken.has(id))
    if (!playerId) {
      return { error: 'No seats left in this game', reason: 'no-seats' }
    }
    const token = crypto.randomUUID()
    this.byToken.set(token, playerId)
    return { playerId, token }
  }
}
