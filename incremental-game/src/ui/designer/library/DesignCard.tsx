import { Hull } from '../../map/Hull'

export function DesignCard({
  name,
  cells,
  onEdit,
  onDelete,
}: {
  name: string
  cells: { x: number; y: number; color: string }[]
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      data-saved-design={name}
      style={{
        width: 160,
        padding: 10,
        backgroundColor: '#16213e',
        border: '1px solid #4a9eff',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <button
        type="button"
        data-edit-design={name}
        onClick={onEdit}
        style={{
          padding: 0,
          backgroundColor: 'transparent',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
        }}
      >
        <span style={{ position: 'relative', display: 'block', width: 72, height: 72, margin: '0 auto' }}>
          <span style={{ position: 'absolute', left: 36, top: 36 }}>
            <Hull cells={cells} heading={-Math.PI / 2} extent={72} />
          </span>
        </span>
        <span style={{ display: 'block', marginTop: 6, fontWeight: 'bold' }}>{name}</span>
      </button>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" data-load-design={name} onClick={onEdit} style={cardButton}>
          Edit
        </button>
        <button type="button" data-delete-design={name} onClick={onDelete} style={deleteButton}>
          Delete
        </button>
      </div>
    </div>
  )
}

const cardButton = {
  flex: 1,
  padding: '6px 8px',
  backgroundColor: '#1e3a5f',
  color: 'white',
  border: '1px solid #4a9eff',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 'bold',
} as const

const deleteButton = {
  flex: 1,
  padding: '6px 8px',
  backgroundColor: '#7f1d1d',
  color: 'white',
  border: '1px solid #f87171',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 'bold',
} as const
