export interface Bound {
  integer?: boolean
  /** Inclusive lower bound. */
  min?: number
  /** Exclusive lower bound. */
  above?: number
}

export function mapping(raw: unknown, label: string): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${label} must be a mapping`)
  }
  return raw as Record<string, unknown>
}

export function requireNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`)
  }
  return value
}

export function requireInt(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`)
  }
  return value
}

/** Read a mapping of numbers. Each key is checked once, against its bound. */
export function read<T extends object>(
  raw: unknown,
  label: string,
  fields: { [K in keyof T]: Bound },
): T {
  const row = mapping(raw, label)
  const out: Record<string, number> = {}
  for (const key of Object.keys(fields)) {
    const name = `${label}.${key}`
    const bound = fields[key as keyof T]
    const value = bound.integer ? requireInt(row[key], name) : requireNumber(row[key], name)
    if (bound.min !== undefined && value < bound.min) {
      throw new Error(`${name} must be at least ${bound.min}`)
    }
    if (bound.above !== undefined && value <= bound.above) {
      throw new Error(`${name} must be greater than ${bound.above}`)
    }
    out[key] = value
  }
  return out as T
}
