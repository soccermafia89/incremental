import { mapping, read } from './number'

/** One upgrade row. `start` is the value before any purchase. It may be 0. */
export interface UpgradeSpec {
  start: number
  step: number
  max: number
  cost: number
}

const atLeastOne = { integer: true, min: 1 }
const atLeastZero = { integer: true, min: 0 }

export function parseUpgradeRows<Id extends string>(
  raw: unknown,
  ids: readonly Id[],
  label: string,
): Record<Id, UpgradeSpec> {
  const row = mapping(raw, label)
  const table = {} as Record<Id, UpgradeSpec>
  for (const id of ids) table[id] = parseSpec(row[id], `${label}.${id}`)
  return table
}

export function blankLevels<Id extends string>(ids: readonly Id[]): Record<Id, number> {
  const levels = {} as Record<Id, number>
  for (const id of ids) levels[id] = 0
  return levels
}

export function flattenLevels<Id extends string>(
  ids: readonly Id[],
  fields: Record<Id, string>,
  levels: Record<Id, number>,
): Record<string, number> {
  const saved: Record<string, number> = {}
  for (const id of ids) saved[fields[id]] = levels[id]
  return saved
}

export function upgradeValue(spec: UpgradeSpec, level: number): number {
  return spec.start + level * spec.step
}

export function upgradePrice(spec: UpgradeSpec, level: number): number {
  return spec.cost * 2 ** level
}

function parseSpec(raw: unknown, label: string): UpgradeSpec {
  const spec = read<UpgradeSpec>(raw, label, {
    start: atLeastZero,
    step: atLeastOne,
    max: atLeastOne,
    cost: atLeastOne,
  })
  if (spec.max < spec.start) throw new Error(`${label}.max must be at least its start`)
  if ((spec.max - spec.start) % spec.step !== 0) {
    throw new Error(`${label}.max must land on a step from its start`)
  }
  return spec
}
