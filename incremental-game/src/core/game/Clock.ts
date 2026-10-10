const STEP_MS = 50

/** Breaks a real-time span into fixed sim steps. */
export class Clock {
  advance(dtMs: number, onStep: (stepMs: number) => void): void {
    if (!Number.isFinite(dtMs) || dtMs <= 0) return
    let left = dtMs
    while (left > 0) {
      const step = Math.min(left, STEP_MS)
      onStep(step)
      left -= step
    }
  }
}
