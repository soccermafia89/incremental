import type { CSSProperties } from 'react'
import { isEnginePart, isGunId } from '../../../data/designer'
import type { DesignerScene } from '../../../core/designer'

export type CatalogItem = DesignerScene['catalog'][number]

export function catalogRows(
  catalog: CatalogItem[],
  weaponsOpen: boolean,
  enginesOpen: boolean,
): ({ kind: 'group'; id: 'weapons' | 'engines'; items: CatalogItem[] } | { kind: 'part'; item: CatalogItem })[] {
  const rows: ({ kind: 'group'; id: 'weapons' | 'engines'; items: CatalogItem[] } | { kind: 'part'; item: CatalogItem })[] = []
  const guns = catalog.filter(item => isGunId(item.id))
  const engines = catalog.filter(item => isEnginePart(item.id))
  let gunsListed = false
  let enginesListed = false
  for (const item of catalog) {
    if (isGunId(item.id)) {
      if (!gunsListed) {
        rows.push({ kind: 'group', id: 'weapons', items: guns })
        gunsListed = true
      }
      if (weaponsOpen) rows.push({ kind: 'part', item })
      continue
    }
    if (isEnginePart(item.id)) {
      if (!enginesListed) {
        rows.push({ kind: 'group', id: 'engines', items: engines })
        enginesListed = true
      }
      if (enginesOpen) rows.push({ kind: 'part', item })
      continue
    }
    rows.push({ kind: 'part', item })
  }
  return rows
}

export function partButton(active: boolean, color: string): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    backgroundColor: active ? '#1e3a5f' : '#16213e',
    color: 'white',
    border: `1px solid ${active ? color : '#4a9eff'}`,
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
  }
}

export function partNote(item: { weight: number; thrust: number; energy: number; health: number; range: number; damage: number; interval: number }): string {
  const notes = [`${item.weight} weight`]
  if (item.health > 0) notes.push(`${item.health} health`)
  if (item.range > 0) {
    notes.push(`${item.damage} damage`)
    notes.push(`${item.interval} ms`)
    notes.push(`${item.range} range`)
  }
  if (item.thrust > 0) notes.push(`${item.thrust} thrust`)
  if (item.energy > 0) notes.push(`+${item.energy} energy`)
  if (item.energy < 0) notes.push(`${item.energy} energy`)
  return notes.join(' · ')
}

export function shownSpeed(speed: number): string {
  if (Number.isInteger(speed)) return String(speed)
  return speed.toFixed(2)
}

export function shownEnergy(energy: number): string {
  if (energy > 0) return `+${energy}`
  return String(energy)
}
