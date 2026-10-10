import type { Game } from '../game/Game'
import type { GameSnapshot } from './GameSnapshot'
import { GameSerializer } from './GameSerializer'
import { GameDeserializer } from './GameDeserializer'

const STORAGE_KEY = 'incremental.devSave'
const EXPORT_FILE_NAME = 'incremental-save.json'

/**
 * Save/load for the dev tools. Two backends over the same snapshot format:
 * localStorage for one-click save/load, and a JSON file for export/import.
 */
export class SaveGameStorage {
  /** Write the game to localStorage. Returns the snapshot that was stored. */
  static saveToLocalStorage(game: Game): GameSnapshot {
    const snapshot = GameSerializer.serialize(game)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    return snapshot
  }

  /** Read the game back from localStorage, or null if nothing is saved. */
  static loadFromLocalStorage(): Game | null {
    const snapshot = this.readSnapshot()
    if (snapshot === null) return null
    return GameDeserializer.deserialize(snapshot)
  }

  /** Metadata about the stored save, or null if there is none or it is unreadable. */
  static peekLocalStorage(): { savedAt: string } | null {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    try {
      const snapshot = JSON.parse(raw) as GameSnapshot
      if (typeof snapshot.savedAt !== 'string') return null
      return { savedAt: snapshot.savedAt }
    } catch {
      return null
    }
  }

  /** Remove the stored save. */
  static clearLocalStorage(): void {
    localStorage.removeItem(STORAGE_KEY)
  }

  /** Write a snapshot to localStorage. */
  static writeSnapshot(snapshot: GameSnapshot): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }

  /** Read the stored snapshot without building a live Game. */
  static readSnapshot(): GameSnapshot | null {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    return JSON.parse(raw) as GameSnapshot
  }

  /** Download a snapshot as a JSON file. */
  static exportToFile(game: Game): GameSnapshot {
    const snapshot = GameSerializer.serialize(game)
    this.exportSnapshot(snapshot)
    return snapshot
  }

  static exportSnapshot(snapshot: GameSnapshot): void {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = EXPORT_FILE_NAME

    // The anchor has to be in the document for Firefox to honour a
    // programmatic click, and the blob URL has to outlive the current tick or
    // Firefox and Safari abort the download before it starts. Chrome tolerates
    // both mistakes, which is how this shipped broken.
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  /** Read a game out of a user-selected JSON file. */
  static async importFromFile(file: File): Promise<Game> {
    const snapshot = await this.importSnapshot(file)
    return GameDeserializer.deserialize(snapshot)
  }

  static async importSnapshot(file: File): Promise<GameSnapshot> {
    const text = await file.text()
    return JSON.parse(text) as GameSnapshot
  }
}
