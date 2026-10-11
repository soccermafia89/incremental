import { isComponentId } from '../../data/designer'
import { mapping, requireInt } from '../../data/number'
import { isRotation, type PlacedPart } from './types'

/** A parts list on a snapshot. Each entry is one bolted component. */
export function readParts(raw: unknown, label = 'parts'): PlacedPart[] {
  if (!Array.isArray(raw)) throw new Error(`${label} must be a list`)
  return raw.map((item, index) => readPart(item, index, label))
}

function readPart(raw: unknown, index: number, list: string): PlacedPart {
  const label = `${list}[${index}]`
  const row = mapping(raw, label)
  const component = text(row.component, `${label}.component`)
  if (!isComponentId(component)) throw new Error(`${label}.component is invalid`)
  const id = text(row.id, `${label}.id`)
  if (!/^part-[1-9]\d*$/.test(id)) throw new Error(`${label}.id is invalid`)
  const rotation = requireInt(row.rotation, `${label}.rotation`)
  if (!isRotation(rotation)) throw new Error(`${label}.rotation is invalid`)
  return {
    id,
    component,
    x: requireInt(row.x, `${label}.x`),
    y: requireInt(row.y, `${label}.y`),
    rotation,
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}
