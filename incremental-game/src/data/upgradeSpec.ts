import { mapping, requireInt, requireNumber } from './number'

/**
 * One row of an upgrade table. `value` is what that level gives.
 * `cost` is the price of the next purchase. The last row has no cost.
 * `crystal` means that purchase spends crystals.
 */
export interface UpgradeLevel {
  value: number
  cost?: number
  crystal?: boolean
}

/**
 * An upgrade the game indexes by the current level.
 * Timing and payout factors that are not themselves a level sit beside the rows.
 */
export interface UpgradeSpec {
  levels: UpgradeLevel[]
  /** Multiplied into the bounty once for each purchase of this upgrade. */
  bounty?: number
  /** Milliseconds at the first row's value. A higher value divides this wait. */
  baseMs?: number
}

export function parseUpgradeRows<Id extends string>(
  raw: unknown,
  ids: readonly Id[],
  label: string,
): Record<Id, UpgradeSpec> {
  const row = mapping(raw, label)
  const table = {} as Record<Id, UpgradeSpec>
  for (const id of ids) table[id] = parseUpgradeSpec(row[id], `${label}.${id}`)
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
  return upgradeRow(spec, level).value
}

export function upgradePrice(spec: UpgradeSpec, level: number): number {
  return upgradeRow(spec, level).cost ?? 0
}

export function upgradeMaxed(spec: UpgradeSpec, level: number): boolean {
  return level >= spec.levels.length - 1
}

export function upgradeCrystal(spec: UpgradeSpec, level: number): boolean {
  return upgradeRow(spec, level).crystal === true
}

function upgradeRow(spec: UpgradeSpec, level: number): UpgradeLevel {
  const index = Math.min(Math.max(level, 0), spec.levels.length - 1)
  return spec.levels[index]
}

/** A straight run of values. Each purchase doubles `cost`. Used to build test tables. */
export function linearTable(start: number, step: number, max: number, cost: number, bounty?: number): UpgradeSpec {
  return priced(sequence(start, value => value + step, max), cost, bounty)
}

/** Values that double until `max`. Each purchase also doubles `cost`. */
export function doublingTable(start: number, max: number, cost: number, bounty?: number): UpgradeSpec {
  return priced(sequence(start, value => value * 2, max), cost, bounty)
}

/** Production multipliers. Level n is `factor` to the n, and the price doubles. */
export function powerTable(purchases: number, factor: number, cost: number): UpgradeSpec {
  const values: number[] = []
  for (let level = 0; level <= purchases; level += 1) values.push(factor ** level)
  return priced(values, cost)
}

function sequence(start: number, next: (value: number) => number, max: number): number[] {
  const values = [start]
  let value = start
  while (value < max) {
    value = next(value)
    values.push(value)
  }
  return values
}

function priced(values: number[], cost: number, bounty?: number): UpgradeSpec {
  let price = cost
  const levels: UpgradeLevel[] = values.map((value, index) => {
    if (index === values.length - 1) return { value }
    const row = { value, cost: price }
    price *= 2
    return row
  })
  return bounty === undefined ? { levels } : { levels, bounty }
}

function parseUpgradeSpec(raw: unknown, label: string): UpgradeSpec {
  if (Array.isArray(raw)) return { levels: parseLevels(raw, label, false) }
  const row = mapping(raw, label)
  const crystal = row.crystal === true
  const levels = parseLevels(row.levels, `${label}.levels`, crystal)
  const spec: UpgradeSpec = { levels }
  if (row.bounty !== undefined) {
    const bounty = requireNumber(row.bounty, `${label}.bounty`)
    if (bounty < 1) throw new Error(`${label}.bounty must be at least 1`)
    spec.bounty = bounty
  }
  if (row.baseMs !== undefined) {
    const baseMs = requireInt(row.baseMs, `${label}.baseMs`)
    if (baseMs < 1) throw new Error(`${label}.baseMs must be at least 1`)
    spec.baseMs = baseMs
  }
  return spec
}

function parseLevels(raw: unknown, label: string, crystal: boolean): UpgradeLevel[] {
  if (!Array.isArray(raw) || raw.length < 1) throw new Error(`${label} must list at least one level`)
  return raw.map((item, index) => {
    const row = mapping(item, `${label}[${index}]`)
    const value = requireNumber(row.value, `${label}[${index}].value`)
    const last = index === raw.length - 1
    if (row.cost === undefined && !last) throw new Error(`${label}[${index}].cost is missing`)
    const level: UpgradeLevel = { value }
    if (row.cost !== undefined) {
      const price = requireInt(row.cost, `${label}[${index}].cost`)
      if (price < 0) throw new Error(`${label}[${index}].cost must be at least 0`)
      level.cost = price
    }
    if (crystal || row.crystal === true) level.crystal = true
    return level
  })
}
