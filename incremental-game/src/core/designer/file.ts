import { mapping, requireInt } from '../../data/number'
import { readParts } from './save'
import type { PlacedPart } from './types'

/** A ship-design JSON file. Separate from the game save. */
export const DESIGN_FILE_VERSION = 1

export interface DesignFile {
  version: number
  parts: PlacedPart[]
}

export function designFile(parts: PlacedPart[]): DesignFile {
  return { version: DESIGN_FILE_VERSION, parts: parts.map(part => ({ ...part })) }
}

/** The parts in a design file. Throws when the file is not this version or the list is malformed. */
export function readDesignFile(raw: unknown): PlacedPart[] {
  const row = mapping(raw, 'design')
  const version = requireInt(row.version, 'design.version')
  if (version !== DESIGN_FILE_VERSION) {
    throw new Error(`Design file ${String(version)} is not supported (expected ${String(DESIGN_FILE_VERSION)})`)
  }
  return readParts(row.parts)
}
