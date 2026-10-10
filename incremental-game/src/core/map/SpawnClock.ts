/** Counts real time toward the next asteroid. */
export class SpawnClock {
  private elapsedMs: number

  private constructor(elapsedMs: number) {
    this.elapsedMs = elapsedMs
  }

  static start(): SpawnClock {
    return new SpawnClock(0)
  }

  static restore(elapsedMs: number): SpawnClock {
    return new SpawnClock(elapsedMs)
  }

  tick(dtMs: number, intervalMs: number, spawn: () => void): void {
    this.elapsedMs += dtMs
    while (this.elapsedMs >= intervalMs) {
      this.elapsedMs -= intervalMs
      spawn()
    }
  }

  remaining(intervalMs: number): number {
    return Math.max(0, intervalMs - this.elapsedMs)
  }

  get elapsed(): number {
    return this.elapsedMs
  }
}
