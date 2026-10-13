import { useState, type ReactNode } from 'react'
import type { DesignGhost, DesignerScene } from '../../core/designer'
import { DesignEditor } from './editor/DesignEditor'
import { DesignLibrary } from './library/DesignLibrary'

/** The library is the first screen. The editor is the grid for one new or existing ship. */
type DesignerScreen = { page: 'library' } | { page: 'editor'; name: string | null }

export function DesignerPanel({
  designer,
  preview,
  onPlace,
  onRemove,
  onSave,
  onRewrite,
  onLoad,
  onDelete,
  onExport,
  onImport,
  onReset,
}: {
  designer: DesignerScene
  preview: (component: string, x: number, y: number, rotation: number) => DesignGhost | null
  onPlace: (component: string, x: number, y: number, rotation: number) => void
  onRemove: (id: string) => void
  onSave: () => Promise<boolean>
  onRewrite: (name: string) => Promise<boolean>
  onLoad: (name: string) => Promise<boolean>
  onDelete: (name: string) => void
  onExport: () => void
  onImport: (file: File) => Promise<boolean>
  onReset: () => Promise<boolean>
}) {
  const [screen, setScreen] = useState<DesignerScreen>({ page: 'library' })
  return (
    <DesignerScreens
      screen={screen}
      library={(
        <DesignLibrary
          designer={designer}
          onNew={async () => {
            const ok = await onReset()
            if (ok) setScreen({ page: 'editor', name: null })
            return ok
          }}
          onEdit={async name => {
            const ok = await onLoad(name)
            if (ok) setScreen({ page: 'editor', name })
            return ok
          }}
          onDelete={onDelete}
          onImport={async file => {
            const ok = await onImport(file)
            if (ok) setScreen({ page: 'editor', name: null })
            return ok
          }}
        />
      )}
      editor={screen.page === 'editor' ? (
        <DesignEditor
          designer={designer}
          editing={screen.name}
          preview={preview}
          onPlace={onPlace}
          onRemove={onRemove}
          onExport={onExport}
          onReset={() => { void onReset() }}
          onBack={() => setScreen({ page: 'library' })}
          onSave={async () => {
            const ok = screen.name === null ? await onSave() : await onRewrite(screen.name)
            if (ok) setScreen({ page: 'library' })
            return ok
          }}
        />
      ) : null}
    />
  )
}

function DesignerScreens({
  screen,
  library,
  editor,
}: {
  screen: DesignerScreen
  library: ReactNode
  editor: ReactNode
}) {
  if (screen.page === 'library') return library
  return editor
}
