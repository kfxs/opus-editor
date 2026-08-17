/**
 * The seam the Properties panel's SLUR GEOMETRY inputs publish through — the typed twin of the
 * arrow-key nudges (`interactions/slurHandleNudge`, `shortcutWiring`). A command-only store in the
 * {@link NoteOffsetSelection} shape: the window writes "put THIS handle of THIS slur at THIS value",
 * and {@link SlurGeometryController} — the one place that holds the engine — applies it.
 *
 * ⭐ **The window addresses a HANDLE, not an override.** `curveShape` / `segmentCurveShape` /
 * `endpointOffset` are three different compartment entries with three different reset rules, and a
 * panel that had to know which one it was writing would be a second copy of that knowledge. It names
 * what the user can see instead — the blue square at each end, and the two amber arc dots — and the
 * controller resolves which override that is, exactly as the keyboard does.
 *
 * ⚠️ Which SEGMENT an arc dot belongs to is NOT in the request: on a cross-system slur that is the
 * armed handle's business, and the controller reads it from the selection. A window that guessed the
 * segment would be able to write a shape onto a system the user is not looking at.
 *
 * There is no mirror channel back, for {@link NoteOffsetSelection}'s reason: the inputs read their
 * current values from `selectionInspection`, which they already subscribe to.
 */

/** Which grabbable point of the slur the request addresses. */
export type SlurGeometryTarget =
  /** A TRUE end — the blue square. Writes that end's `endpointOffset`. */
  | { kind: 'endpoint'; which: 'start' | 'end' }
  /** An arc control point — an amber dot. Writes the (armed segment's) curve shape. */
  | { kind: 'controlPoint'; cpIndex: 0 | 1 }

export interface SlurGeometryRequest {
  /** The selected slur whose handle to move. */
  slurId: string
  target: SlurGeometryTarget
  /**
   * The desired ABSOLUTE position in **staff-spaces**, or `null` to reset the handle to the
   * automatic engraving.
   *
   * ⭐ **Either axis may be absent, and absent means "leave it as it is"** — not zero. The window
   * edits one box at a time and has no honest value for the other: an automatic handle has no
   * numbers at all, and an arc's automatic `y` is a whole arch rather than a zero. The controller
   * fills the unnamed axis from the model, which is where the real value is.
   *
   * ⚠️ These are the MODEL's numbers: an endpoint offset is screen-down positive, while an arc
   * control point's `y` bows the curve OUTWARD whichever side the slur sits on. The keyboard nudges
   * speak screen and convert; this seam does not.
   */
  value: { x?: number; y?: number } | null
}

export class SlurGeometrySelection {
  private listeners = new Set<(req: SlurGeometryRequest) => void>()

  /** Publish a geometry request. ALWAYS fires — re-typing the same number is a real event, and the
   *  controller decides it is a no-op (mirrors {@link NoteOffsetSelection.set}). */
  set(req: SlurGeometryRequest): void {
    for (const fn of this.listeners) fn(req)
  }

  /** Handle a request — {@link SlurGeometryController} runs the engine apply. */
  onSet(fn: (req: SlurGeometryRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createSlurGeometrySelection = () => new SlurGeometrySelection()
