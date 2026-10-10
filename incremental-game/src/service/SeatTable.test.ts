import { describe, expect, it } from 'vitest'
import { SeatTable } from './SeatTable'

describe('SeatTable', () => {
  it('claims each id once and resumes the token', () => {
    const seats = new SeatTable()
    const first = seats.claimNext(['a', 'b'])
    expect(first).toMatchObject({ playerId: 'a' })
    if (!('token' in first)) return
    expect(seats.resume(first.token)).toEqual({ playerId: 'a', token: first.token })
    expect(seats.claimNext(['a', 'b'])).toMatchObject({ playerId: 'b' })
    expect(seats.claimNext(['a', 'b'])).toMatchObject({ reason: 'no-seats' })
    seats.reset()
    expect(seats.resume(first.token)).toBeNull()
  })
})
