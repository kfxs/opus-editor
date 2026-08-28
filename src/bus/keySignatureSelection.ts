import type { KeySignature } from '@/types/music'
import { keysEqual } from '@/utils/keySignature'

/**
 * The armed key signature, shared between the editor and the plain-TS Key Signature window
 * ({@link ../windows/keySignatureWindow}), over the two channels {@link ./clefSelection} has and for
 * the same reasons:
 *
 * - HIGHLIGHT: the signature currently armed, mirrored in by `keypadSync`, so re-opening the dialog
 *   steps from what the editor already has armed rather than resetting to C major.
 * - PRESS: the user chose one. Always fires — choosing the armed key again means "arm it again", and
 *   the palette's own re-press rule (`PaletteController.pressKeySignature` disarms) is a decision
 *   for the controller, never something swallowed here as "no change".
 *
 * ⚠️ The value is a `KeySignature` — an alteration LIST, not a `fifths` integer. The window steps
 * along the circle of fifths and that is a fact about its GESTURE; what it hands over is the
 * signature (`utils/keySignature.ts` on why the list is the storage), which is also the only shape a
 * mixed Bartók-style signature will fit through when the custom editor arrives.
 *
 * ⭐ Hence `keysEqual` for the highlight's short-circuit rather than `===`: two `keyFromFifths(1)`
 * results are two objects and one statement, so identity would re-notify on every sync.
 */
class KeySignatureSelection {
  private highlight: KeySignature | null = null
  private highlightListeners = new Set<(key: KeySignature | null) => void>()
  private pressListeners = new Set<(key: KeySignature) => void>()

  /** The armed signature, or null. */
  get(): KeySignature | null {
    return this.highlight
  }

  /** Mirror the editor's armed key in. Short-circuits on no change, so mirroring cannot loop. */
  setHighlight(key: KeySignature | null): void {
    if (key === this.highlight) return
    if (key && this.highlight && keysEqual(key, this.highlight)) return
    this.highlight = key
    for (const fn of this.highlightListeners) fn(key)
  }

  onHighlight(fn: (key: KeySignature | null) => void): () => void {
    this.highlightListeners.add(fn)
    return () => this.highlightListeners.delete(fn)
  }

  press(key: KeySignature): void {
    for (const fn of this.pressListeners) fn(key)
  }

  onPress(fn: (key: KeySignature) => void): () => void {
    this.pressListeners.add(fn)
    return () => this.pressListeners.delete(fn)
  }
}

export const createKeySignatureSelection = () => new KeySignatureSelection()
