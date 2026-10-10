/** Deterministic 0..1 stream. The state is a uint32 saved with the game. */
export class Rng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  get value(): number {
    return this.state
  }

  next(): number {
    this.state = (this.state + 0x6D2B79F5) >>> 0
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
