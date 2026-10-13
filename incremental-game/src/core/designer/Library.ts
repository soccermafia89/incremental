import type { NamedDesign, PlacedPart } from './types'

/**
 * The named ships. Names stay ship1, ship2, in order.
 * The last ship is the one the rest of the game treats as saved.
 */
export class DesignLibrary {
  private designs: NamedDesign[]
  private saved: PlacedPart[] | null

  private constructor(designs: NamedDesign[], saved: PlacedPart[] | null) {
    this.designs = designs
    this.saved = saved
  }

  static empty(): DesignLibrary {
    return new DesignLibrary([], null)
  }

  /** Checks names and that the last ship matches the saved layout. `check` replays each layout. */
  static accept(
    designs: NamedDesign[],
    saved: PlacedPart[] | null,
    check: (parts: PlacedPart[]) => void,
  ): DesignLibrary {
    if (saved === null) {
      if (designs.length > 0) throw new Error('designs require a saved design')
      return DesignLibrary.empty()
    }
    if (designs.length < 1) throw new Error('a saved design needs a name')
    const copied = designs.map((design, index) => {
      if (design.name !== `ship${index + 1}`) throw new Error('design names are ship1, ship2, ...')
      check(design.parts)
      return { name: design.name, parts: design.parts.map(part => ({ ...part })) }
    })
    const last = copied[copied.length - 1].parts
    if (last.length !== saved.length || last.some((part, index) => !samePart(part, saved[index]))) {
      throw new Error('the latest design is the saved ship')
    }
    return new DesignLibrary(copied, saved.map(part => ({ ...part })))
  }

  entries(): NamedDesign[] {
    return this.designs.map(copyNamed)
  }

  savedParts(): PlacedPart[] | null {
    return this.saved ? this.saved.map(part => ({ ...part })) : null
  }

  partsOf(name: string): PlacedPart[] | null {
    const found = this.designs.find(design => design.name === name)
    return found ? found.parts.map(part => ({ ...part })) : null
  }

  /** Stores the grid as the next ship and makes that the saved ship. */
  append(parts: PlacedPart[]): void {
    const copy = parts.map(part => ({ ...part }))
    this.saved = copy.map(part => ({ ...part }))
    this.designs.push({ name: `ship${this.designs.length + 1}`, parts: copy })
  }

  /** Replaces one ship. The saved ship changes only when that ship is the latest. */
  rewrite(name: string, parts: PlacedPart[]): 'ok' | 'unknown' {
    const index = this.designs.findIndex(design => design.name === name)
    if (index < 0) return 'unknown'
    const copy = parts.map(part => ({ ...part }))
    this.designs[index] = { name, parts: copy }
    if (index === this.designs.length - 1) this.saved = copy.map(part => ({ ...part }))
    return 'ok'
  }

  /** Removes one ship and renames the rest ship1, ship2, ... The saved ship is the new last, or none. */
  discard(name: string): 'ok' | 'unknown' {
    const index = this.designs.findIndex(design => design.name === name)
    if (index < 0) return 'unknown'
    const kept = this.designs.filter(design => design.name !== name)
    this.designs = kept.map((design, place) => ({ name: `ship${place + 1}`, parts: design.parts }))
    const last = this.designs[this.designs.length - 1]
    this.saved = last ? last.parts.map(part => ({ ...part })) : null
    return 'ok'
  }
}

/** Old name to the name it keeps after `removed` is dropped. The removed name is left out. */
export function renamesAfterDiscard(before: readonly string[], removed: string): Map<string, string> {
  const map = new Map<string, string>()
  let next = 1
  for (const name of before) {
    if (name === removed) continue
    map.set(name, `ship${next}`)
    next += 1
  }
  return map
}

function copyNamed(design: NamedDesign): NamedDesign {
  return { name: design.name, parts: design.parts.map(part => ({ ...part })) }
}

function samePart(left: PlacedPart, right: PlacedPart): boolean {
  return left.id === right.id
    && left.component === right.component
    && left.x === right.x
    && left.y === right.y
    && left.rotation === right.rotation
}
