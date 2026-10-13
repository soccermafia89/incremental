import { useRef, type ChangeEvent } from 'react'
import type { DesignerScene } from '../../../core/designer'
import { DesignCard } from './DesignCard'

export function DesignLibrary({
  designer,
  onNew,
  onEdit,
  onDelete,
  onImport,
}: {
  designer: DesignerScene
  onNew: () => Promise<boolean>
  onEdit: (name: string) => Promise<boolean>
  onDelete: (name: string) => void
  onImport: (file: File) => Promise<boolean>
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  return (
    <div data-design-library style={{ color: 'white', width: '100%', height: '100%', minHeight: 0, overflow: 'auto' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Ship Designer</h2>
      <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 14, lineHeight: 1.4, maxWidth: 560 }}>
        Make a new ship, edit one you have saved, or delete it. Import loads a design file onto a new ship.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          data-new-design
          onClick={() => { void onNew() }}
          style={actionButton}
        >
          New design
        </button>
        <button type="button" data-import-design onClick={() => fileInput.current?.click()} style={quietButton}>
          Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          data-import-design-file
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void onImport(file)
          }}
          style={{ display: 'none' }}
        />
      </div>
      {designer.designs.length === 0 ? (
        <p data-saved-designs style={{ margin: 0, color: '#94a3b8' }}>No saved ships yet.</p>
      ) : (
        <div data-saved-designs style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {designer.designs.map(design => (
            <DesignCard
              key={design.name}
              name={design.name}
              cells={design.cells}
              onEdit={() => { void onEdit(design.name) }}
              onDelete={() => onDelete(design.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const actionButton = {
  padding: '10px 14px',
  backgroundColor: '#14532d',
  color: 'white',
  border: '1px solid #4ade80',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 'bold',
} as const

const quietButton = {
  padding: '10px 14px',
  backgroundColor: '#16213e',
  color: '#93c5fd',
  border: '1px solid #4a9eff',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 'bold',
} as const
