import { read } from '../number'

export interface BankConfig {
  startingMoney: number
  /** First payout of the sidebar gift. Each click doubles the next one. */
  gift: number
}

export function parseBank(raw: unknown): BankConfig {
  return read<BankConfig>(raw, 'bank', {
    startingMoney: { integer: true, min: 0 },
    gift: { integer: true, min: 1 },
  })
}
