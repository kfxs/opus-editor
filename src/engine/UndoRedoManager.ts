import type { Score } from '@/types/music'

interface HistoryEntry {
  snapshot: Score
  description: string
  timestamp: number
  selectedNoteId?: string | null
}

/**
 * Manages undo/redo history using state snapshots.
 *
 * Each operation saves a complete copy of the score state.
 * This approach is simple and works automatically with any operation,
 * including complex multi-step operations like note splitting.
 */
export class UndoRedoManager {
  private history: HistoryEntry[] = []
  private currentIndex = -1
  private maxHistory: number
  private lastRestoredNoteId: string | null = null

  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory
  }

  /**
   * Save the current state to history.
   * Call this AFTER making changes to the score.
   * @param snapshot - Deep copy of the current score state
   * @param description - Human-readable description of the action
   */
  pushState(snapshot: Score, description: string): void {
    // Remove any "future" states if we're not at the end (after undo)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1)
    }

    // Deep copy the snapshot to prevent reference issues
    const snapshotCopy = JSON.parse(JSON.stringify(snapshot)) as Score

    // Add new state
    this.history.push({
      snapshot: snapshotCopy,
      description,
      timestamp: Date.now()
    })

    // Enforce max history limit
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    } else {
      this.currentIndex++
    }
  }

  /**
   * Save the initial state (before any user actions).
   * Should be called once when the score is first created or loaded.
   */
  saveInitialState(snapshot: Score): void {
    this.clear()
    this.pushState(snapshot, 'Initial state')
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex > 0
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1
  }

  /**
   * Update the selectedNoteId stored in the current history entry.
   * Call this after an operation updates selectedNoteId in the UI.
   */
  updateCurrentNoteId(id: string | null): void {
    if (this.currentIndex >= 0) {
      this.history[this.currentIndex].selectedNoteId = id
    }
  }

  /**
   * Returns the selectedNoteId that was stored in the state we just restored to.
   */
  getLastRestoredNoteId(): string | null {
    return this.lastRestoredNoteId
  }

  /**
   * Undo: Go back to the previous state
   * @returns The previous score state, or null if can't undo
   */
  undo(): Score | null {
    if (!this.canUndo()) return null
    this.currentIndex--
    this.lastRestoredNoteId = this.history[this.currentIndex].selectedNoteId ?? null
    return JSON.parse(JSON.stringify(this.history[this.currentIndex].snapshot)) as Score
  }

  /**
   * Redo: Go forward to the next state
   * @returns The next score state, or null if can't redo
   */
  redo(): Score | null {
    if (!this.canRedo()) return null
    this.currentIndex++
    this.lastRestoredNoteId = this.history[this.currentIndex].selectedNoteId ?? null
    return JSON.parse(JSON.stringify(this.history[this.currentIndex].snapshot)) as Score
  }

  /**
   * Get the description of the action that would be undone
   */
  getUndoDescription(): string | null {
    if (!this.canUndo()) return null
    return this.history[this.currentIndex].description
  }

  /**
   * Get the description of the action that would be redone
   */
  getRedoDescription(): string | null {
    if (!this.canRedo()) return null
    return this.history[this.currentIndex + 1].description
  }

  /**
   * Get history info for debugging or UI display
   */
  getHistoryInfo(): { total: number; current: number; descriptions: string[] } {
    return {
      total: this.history.length,
      current: this.currentIndex,
      descriptions: this.history.map(e => e.description)
    }
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = []
    this.currentIndex = -1
  }
}
