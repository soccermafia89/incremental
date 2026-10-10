import { useRef, useState, type ChangeEvent } from 'react'
import type { GameSettings } from './GameSettings'
import type { GameClient } from '../../service/GameClient'
import { SaveGameStorage } from '../../core/persistence/SaveGameStorage'
import { THEME } from '../sidebar/theme'

interface SettingsPanelProps {
  settings: GameSettings
  onSettingsChange: (settings: GameSettings) => void
  client: GameClient
  onGameChanged: () => void
}

interface StatusMessage {
  text: string
  tone: 'ok' | 'error'
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '15px',
      backgroundColor: '#16213e',
      border: '1px solid #0f3460',
      borderRadius: '6px',
      cursor: 'pointer',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{
          width: '18px',
          height: '18px',
          marginTop: '2px',
          cursor: 'pointer',
          accentColor: '#7e57c2',
        }}
      />
      <div>
        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{label}</div>
        <div style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>{description}</div>
      </div>
    </label>
  )
}

function ActionButton({
  label,
  onClick,
  disabled = false,
  disabledTitle,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  disabledTitle?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
      style={{
        padding: '12px 20px',
        minWidth: '140px',
        backgroundColor: disabled ? '#1b1b2f' : THEME.settings,
        color: 'white',
        border: `1px solid ${disabled ? '#2a2a45' : THEME.settingsBorder}`,
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        fontSize: '14px',
        fontWeight: 'bold',
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={(event) => {
        if (!disabled) event.currentTarget.style.backgroundColor = THEME.settingsHighlight
      }}
      onMouseLeave={(event) => {
        if (!disabled) event.currentTarget.style.backgroundColor = THEME.settings
      }}
    >
      {label}
    </button>
  )
}

export function SettingsPanel({
  settings,
  onSettingsChange,
  client,
  onGameChanged,
}: SettingsPanelProps) {
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [starting, setStarting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const disabled = !settings.devMode
  const saveDisabledTitle = 'Enable Dev Mode to use save and load'

  const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

  const handleNewGame = async () => {
    setStarting(true)
    try {
      const result = await client.newGame()
      if (!result.ok) {
        setStatus({ text: result.error, tone: 'error' })
        return
      }
      onGameChanged()
      setStatus({
        text: client.kind === 'remote' ? 'Started a new game on the shared server' : 'Started a new game',
        tone: 'ok',
      })
    } catch (error) {
      setStatus({ text: `New game failed: ${errorText(error)}`, tone: 'error' })
    } finally {
      setStarting(false)
    }
  }

  const handleSave = async () => {
    try {
      const result = await client.save()
      if (!result.ok) {
        setStatus({ text: result.error, tone: 'error' })
        return
      }
      SaveGameStorage.writeSnapshot(result.data)
      setStatus({ text: `Saved ${new Date(result.data.savedAt).toLocaleString()}`, tone: 'ok' })
    } catch (error) {
      setStatus({ text: `Save failed: ${errorText(error)}`, tone: 'error' })
    }
  }

  const handleLoad = async () => {
    try {
      const snapshot = SaveGameStorage.readSnapshot()
      if (snapshot === null) {
        setStatus({ text: 'No saved game found', tone: 'error' })
        return
      }
      const result = await client.load(snapshot)
      if (!result.ok) {
        setStatus({ text: result.error, tone: 'error' })
        return
      }
      onGameChanged()
      setStatus({ text: 'Loaded game', tone: 'ok' })
    } catch (error) {
      setStatus({ text: `Load failed: ${errorText(error)}`, tone: 'error' })
    }
  }

  const handleExport = async () => {
    try {
      const result = await client.save()
      if (!result.ok) {
        setStatus({ text: result.error, tone: 'error' })
        return
      }
      SaveGameStorage.exportSnapshot(result.data)
      setStatus({ text: 'Exported incremental-save.json', tone: 'ok' })
    } catch (error) {
      setStatus({ text: `Export failed: ${errorText(error)}`, tone: 'error' })
    }
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const snapshot = await SaveGameStorage.importSnapshot(file)
      const result = await client.load(snapshot)
      if (!result.ok) {
        setStatus({ text: result.error, tone: 'error' })
        return
      }
      onGameChanged()
      setStatus({ text: `Imported ${file.name}`, tone: 'ok' })
    } catch (error) {
      setStatus({ text: `Import failed: ${errorText(error)}`, tone: 'error' })
    }
  }

  const existingSave = settings.devMode ? SaveGameStorage.peekLocalStorage() : null

  return (
    <div style={{
      width: '1000px',
      height: '650px',
      color: 'white',
      overflowY: 'auto',
      padding: '20px',
      textAlign: 'left',
    }}>
      <div style={{
        marginBottom: '30px',
        borderBottom: '2px solid #16213e',
        paddingBottom: '20px',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '32px',
          color: '#b39ddb',
          fontWeight: 'bold',
        }}>
          Settings
        </h1>
      </div>

      <h2 style={{ fontSize: '18px', margin: '0 0 5px 0', opacity: 0.8 }}>New Game</h2>
      <div style={{ fontSize: '13px', opacity: 0.6, marginBottom: '15px', maxWidth: '600px' }}>
        Replaces the current game{client.kind === 'remote' ? ' on the shared server' : ''}.
      </div>
      <ActionButton
        label={starting ? 'Starting…' : 'New Game'}
        onClick={() => { void handleNewGame() }}
        disabled={starting}
      />

      {client.kind === 'remote' && client.seatPlayerId && (
        <>
          <h2 style={{ fontSize: '18px', margin: '30px 0 5px 0', opacity: 0.8 }}>This tab</h2>
          <div style={{ fontSize: '13px', opacity: 0.6, marginBottom: '15px', maxWidth: '600px' }}>
            The server assigned this browser a seat. Refresh keeps it.
            New Game and Load clear seats and sit this tab again.
          </div>
        </>
      )}

      <h2 style={{ fontSize: '18px', margin: '30px 0 15px 0', opacity: 0.8 }}>Developer</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '600px' }}>
        <SettingToggle
          label="Dev Mode"
          description="This tab only. Exposes the game-state view and save/load."
          checked={settings.devMode}
          onChange={(devMode) => onSettingsChange({ ...settings, devMode })}
        />
      </div>

      <h2 style={{ fontSize: '18px', margin: '30px 0 5px 0', opacity: 0.8 }}>Save &amp; Load</h2>
      <div style={{ fontSize: '13px', opacity: 0.6, marginBottom: '15px', maxWidth: '600px' }}>
        Save and Load use browser storage for one-click round trips. Export and Import
        read and write an <code>incremental-save.json</code> file.
        The file is the game only — seats are not saved.
        {disabled && ' Enable Dev Mode above to use them.'}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', maxWidth: '600px' }}>
        <ActionButton label="Save Game" onClick={() => { void handleSave() }} disabled={disabled} disabledTitle={saveDisabledTitle} />
        <ActionButton label="Load Game" onClick={() => { void handleLoad() }} disabled={disabled} disabledTitle={saveDisabledTitle} />
        <ActionButton label="Export JSON" onClick={() => { void handleExport() }} disabled={disabled} disabledTitle={saveDisabledTitle} />
        <ActionButton
          label="Import JSON"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          disabledTitle={saveDisabledTitle}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={(event) => { void handleImportFile(event) }}
        style={{ display: 'none' }}
      />

      {existingSave && (
        <div style={{ fontSize: '13px', opacity: 0.6, marginTop: '15px' }}>
          Stored save: {new Date(existingSave.savedAt).toLocaleString()}
        </div>
      )}

      {status && (
        <div style={{
          marginTop: '15px',
          padding: '10px 15px',
          maxWidth: '600px',
          borderRadius: '6px',
          fontSize: '14px',
          backgroundColor: status.tone === 'ok' ? '#1b3a2a' : '#3a1b1b',
          border: `1px solid ${status.tone === 'ok' ? '#2e7d32' : '#a13636'}`,
        }}>
          {status.text}
        </div>
      )}
    </div>
  )
}
