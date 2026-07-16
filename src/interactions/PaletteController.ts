import type { ArticulationType, Accidental, NoteDuration, BeamMode, Clef, TimeSignature } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { ViewMode } from '../engine/rendering/layoutConfig'
import type { EditorState, DynamicTool, TempoTool } from './EditorState'
import { activeVoiceToModel } from './EditorState'
import { fracToNumber } from '../utils/fraction'
import { accidentalTypeToKey } from '../utils/pitchSpelling'
import { sameTimeSignature } from '../utils/meter'
import { tempoLabel } from '../utils/tempoMap'
import { selectedNoteIds, selectedArticulationNoteIds } from './selection'
import { articulationSelection } from './articulationSelection'
import { tieSelection } from './tieSelection'

/** Two armed tempo presets are "the same button" when every field matches — so clicking the
 *  active preset a second time disarms it (the toggle behaviour of the other palette tools). */
function sameTempoTool(a: TempoTool | null, b: TempoTool): boolean {
  if (!a) return false
  return a.text === b.text && a.unit === b.unit && a.dots === b.dots
    && a.bpm === b.bpm && a.showMetronome === b.showMetronome
}

/** Placeholder for a freshly placed custom-text dynamic (mirrors MouseController). */
const DEFAULT_DYNAMIC_TEXT = 'Text'

/**
 * Handles palette actions: duration, accidental, articulations, tie, dot, tuplet.
 * Framework-agnostic: reads/writes EditorState directly, no Vue/React/Angular imports.
 */
export class PaletteController {
  constructor(
    private getEngine: () => MusicEngine | null,
    private state: EditorState,
    private renderScore: () => void,
    /**
     * Draw the preview for whatever is armed at `coords` — RenderController.renderToolGhost, the
     * SAME function the mouse calls on every move. It dispatches: a marking tool previews its own
     * mark, and with none armed it falls back to the ghost note. Arming a tool therefore shows its
     * ghost AT ONCE, on the keypress, instead of waiting for the pointer to move — which is only
     * true while arming and hovering share this one function. It used to be `renderPreview`, which
     * draws a ghost NOTE and nothing else, so the arm paths could not call it at all.
     */
    private renderArmedGhost: (coords: { x: number; y: number }) => void,
    private getLastMousePosition: () => { x: number; y: number } | null,
    private selectNote: (id: string | null) => void,
    // Full deselect (the Esc / Select-arrow path). Optional so existing 6-arg constructions still
    // work, falling back to selectNote(null) which clears the note + scalar sub-selections.
    private deselectAll?: () => void,
  ) {}

  /**
   * Repaint, then show the armed tool's ghost at the last known pointer — what every `arm*Tool`
   * ends with. The repaint drops the keyboard cursor and the old selection highlight; the ghost
   * then goes on top as an overlay.
   *
   * The ghost has to be drawn HERE, on the keypress. These tools arm from the keyboard, and a ghost
   * that only appears on the next `mousemove` leaves the editor looking like nothing happened —
   * you have to jog the mouse to find out the tool is live. A duration press has always previewed
   * immediately; the marking tools could not, because the only preview wired in was `renderPreview`,
   * which draws a ghost NOTE — the wrong preview, so they drew nothing at all. Routing both through
   * {@link RenderController.renderToolGhost} removes that asymmetry: it dispatches on what is armed.
   *
   * No-op on the ghost when the pointer has never been over the canvas (nothing to draw it at) —
   * the next move picks it up.
   */
  private showArmedGhost(): void {
    this.renderScore()
    // Nothing is armed (the press DISARMED the tool and dropped us back to selection) → the repaint
    // above is the whole job. Guarding here rather than at each call site is what lets the swap /
    // toggle paths call this unconditionally: one branch arms, disarms and re-values.
    if (this.state.selectedTool !== 'entry') return
    const pos = this.getLastMousePosition()
    if (pos) this.renderArmedGhost(pos)
  }

  /** Returns the articulations currently armed for the next note entry. */
  getPendingArticulations(): ArticulationType[] | undefined {
    const arts: ArticulationType[] = []
    if (this.state.accent) arts.push('accent')
    if (this.state.staccato) arts.push('staccato')
    if (this.state.tenuto) arts.push('tenuto')
    return arts.length ? arts : undefined
  }

  /**
   * The measure span the "Add Measure" buttons act on: ONLY a Ctrl+Shift+click box span
   * (the DOUBLE box). A plain-click passage select (single box) is a content selection, not
   * a measure-structure context, so it does NOT count — and neither does a note selection.
   * Returns inclusive low/high bars, or null when no double box is selected.
   */
  private measureContext(): { lo: number; hi: number } | null {
    const range = this.state.selectedMeasureRange
    if (!range || this.state.selectedMeasureBoxStyle !== 'double') return null
    return { lo: Math.min(range.anchor, range.focus), hi: Math.max(range.anchor, range.focus) }
  }

  /** Add one empty measure immediately BEFORE the box-selected span. Keeps the box on
   *  the same musical bars (they shift up by one). No-op unless a measure is selected. */
  addMeasureBefore(): void {
    const engine = this.getEngine()
    const ctx = this.measureContext()
    if (!engine || !ctx) {
      console.log('Add measure before: no measure selected (Ctrl+Shift+click a bar first)')
      return
    }
    engine.insertMeasureAfter(ctx.lo - 1) // 0 = insert at the very front
    if (this.state.selectedMeasureRange) {
      // The selected bars moved forward by one; follow them so repeat clicks stack.
      this.state.selectedMeasureRange = {
        anchor: this.state.selectedMeasureRange.anchor + 1,
        focus: this.state.selectedMeasureRange.focus + 1,
      }
    }
    console.log(`✓ Added measure before ${ctx.lo}`)
    this.renderScore()
  }

  /** Add one empty measure immediately AFTER the box-selected span. The selected bars
   *  keep their numbers. No-op unless a measure is selected. */
  addMeasureAfter(): void {
    const engine = this.getEngine()
    const ctx = this.measureContext()
    if (!engine || !ctx) {
      console.log('Add measure after: no measure selected (Ctrl+Shift+click a bar first)')
      return
    }
    engine.insertMeasureAfter(ctx.hi)
    console.log(`✓ Added measure after ${ctx.hi}`)
    this.renderScore()
  }

  /**
   * The reference staff the "Staff:" buttons act on: the 0-based staff of a PLAIN-click
   * bar selection (the SINGLE box). Null otherwise — staff add is now driven by the plain-
   * click passage select, NOT the Ctrl+Shift measure-span box (which is reserved for the
   * "Add Measure" ops), so the two structure edits stay separate gestures.
   */
  private staffContext(): number | null {
    if (this.state.selectedMeasureRange === null || this.state.selectedMeasureBoxStyle !== 'single') return null
    return this.state.selectedMeasureStaff
  }

  // ==================== View mode (wrapped ↔ linear) ====================

  /** The layout mode in force, straight from its owner (the engine). */
  getViewMode(): ViewMode {
    return this.getEngine()?.getViewMode() ?? 'wrapped'
  }

  /**
   * Switch between wrapped systems and one endless linear system, and repaint. The ONLY write
   * path for the mode: it sets the engine (the owner) and `state.viewMode` (the palette's
   * reactive mirror) together, so they cannot drift apart.
   *
   * See docs/linear-view-plan.md — P2 also clears the armed slur-handle state here, so that
   * an orange join armed in wrapped view can't be nudged from inside linear view.
   */
  setViewMode(mode: ViewMode): void {
    const engine = this.getEngine()
    if (!engine || engine.getViewMode() === mode) return
    engine.setViewMode(mode)
    this.state.viewMode = mode
    // Disarm any armed slur point on the way through. Not rendering the handles (linear view
    // draws none) only stops NEW arming — it does not disarm what is already armed. Without
    // this: arm an orange join in wrapped view, switch to linear, press an arrow, and a segment
    // override gets written from inside linear view with a wrapped-captured span count.
    this.state.selectedSlurEndpoint = null
    this.state.selectedSlurSegmentEndpoint = null
    this.state.selectedSlurSegmentSpanCount = 0
    this.renderScore()
  }

  /** Flip to the other mode (the keyboard shortcut / the palette button both toggle). */
  toggleViewMode(): void {
    this.setViewMode(this.getViewMode() === 'linear' ? 'wrapped' : 'linear')
  }

  /** Add a new staff immediately ABOVE the plain-click-selected bar's staff. No-op unless a
   *  bar is plain-click-selected (click empty space in a bar first). */
  addStaffAbove(): void {
    this.addStaffRelative('above')
  }

  /** Add a new staff immediately BELOW the plain-click-selected bar's staff. No-op unless a
   *  bar is plain-click-selected (click empty space in a bar first). */
  addStaffBelow(): void {
    this.addStaffRelative('below')
  }

  /**
   * Insert a staff above/below the box-selected staff, keeping the box on the SAME staff the
   * user had selected. `selectedMeasureStaff` is a raw index into `score.staves`, and inserting
   * a staff shifts every index at/below the insertion point — so an "+ Above" would leave the
   * selection pointing at the freshly inserted staff instead of the one that was selected. Fix
   * generally: resolve the selected staff to its stable id before the insert, then restore its
   * (possibly shifted) index after. Index-free, so it survives future reorder/remove too.
   */
  private addStaffRelative(position: 'above' | 'below'): void {
    const engine = this.getEngine()
    const ref = this.staffContext()
    if (!engine || ref === null) {
      console.log(`Add staff ${position}: no bar selected (click empty space in a bar first)`)
      return
    }
    const selectedId = engine.getScore().staves?.[this.state.selectedMeasureStaff]?.id
    if (position === 'above') engine.addStaffAbove(ref)
    else engine.addStaffBelow(ref)
    // Re-anchor the box to the originally-selected staff by id (its index may have shifted).
    if (selectedId !== undefined) {
      const idx = engine.getScore().staves?.findIndex(s => s.id === selectedId) ?? -1
      if (idx >= 0) this.state.selectedMeasureStaff = idx
    }
    console.log(`✓ Added staff ${position} staff ${ref}`)
    this.renderScore()
  }

  setDuration(duration: NoteDuration): void {
    // Picking a duration while the articulation STAMP tool is armed promotes it into note entry:
    // the armed articulations become the arm-for-next-note flags, so this becomes "enter notes
    // carrying these articulations" (ghost NOTE with the articulation, clicks place notes) — the
    // "articulation + duration" mode. Must run before the branch below reads selectedTool.
    this.promoteArticulationStampToNoteEntry()
    // Same for an armed accidental stamp → "accidental + duration" note entry.
    this.promoteAccidentalStampToNoteEntry()
    // The TIE stamp has nothing to promote INTO — there is no armed entry-mode tie (see
    // {@link tieSelection}) — so a duration press just disarms it and this becomes plain note entry.
    // Must run before the branches below, or the tie ghost would fight the ghost note.
    this.state.selectedTieTool = false
    // The DOT stamp DOES have somewhere to go: `selectedDots` is the armed entry-mode dot. Promote
    // it — "dot then quarter" becomes dotted-quarter entry — instead of letting the reset below eat
    // it. A plain duration press still clears a stale dot, exactly as it clears a stale accidental:
    // an intentionally armed dot arms the STAMP (→ entry mode), so it can only arrive via this flag.
    const dotStampArmed = this.state.selectedDotTool
    this.state.selectedDotTool = false
    this.state.selectedDuration = duration
    this.state.selectedDots = dotStampArmed ? 1 : 0
    this.state.tupletMode = false
    this.state.selectedClef = null
    this.state.selectedTimeSignature = null
    this.state.selectedDynamic = null
    const engine = this.getEngine()
    if (this.state.selectedNoteId && engine && this.state.selectedTool === 'selection') {
      const before = engine.getNote(this.state.selectedNoteId)
      engine.updateNote(this.state.selectedNoteId, { duration, dots: 0 })
      if (before && !before.isRest) {
        const pitch = `${before.step}${before.alter === 1 ? '#' : before.alter === -1 ? 'b' : before.alter === 2 ? '##' : before.alter === -2 ? 'bb' : ''}${before.octave}`
        const oldDur = `${before.duration}${'.'.repeat(before.dots ?? 0)}`
        console.log(`[Duration] ${pitch} | ${oldDur} → ${duration}`)
      }
      this.renderScore()
    } else if (this.state.selectedTool === 'selection') {
      // Starting FRESH note entry from nothing-selected: a plain duration press must not carry a
      // stale accidental left over from a previous note (the "duration + sharp remembered" bug). An
      // intentionally-armed accidental — via the stamp or a duration+accidental gesture — arms the
      // stamp first, which switches to entry mode, so it lands in the entry branch below, never here;
      // so an accidental in THIS branch is always stale and safe to drop.
      this.state.selectedAccidental = null
      this.state.selectedTool = 'entry'
      const pos = this.getLastMousePosition()
      if (pos) this.renderArmedGhost(pos)
    } else if (this.state.selectedTool === 'entry') {
      // Already in entry mode: refresh the ghost note so it shows the new
      // duration immediately, without waiting for the next mouse move.
      const pos = this.getLastMousePosition()
      if (pos) this.renderArmedGhost(pos)
    }
  }

  /**
   * One accidental-key press, routed like {@link pressArticulation} but SINGLE-valued (a note has
   * one accidental state, so a stamp swap replaces rather than stacks):
   *  0. The accidental STAMP tool is already armed → press the same key to disarm, a different one
   *     to swap which accidental is armed.
   *  1. Selection mode with a real selection → apply the accidental across it; pressing the sign
   *     every selected note already shows removes it (reverts to the prevailing alteration).
   *  2. Selection mode with NOTHING to apply to → arm the accidental STAMP tool (ghost accidental,
   *     clicks set it on existing notes). This replaces the old "flip to entry mode arming
   *     selectedAccidental" — that note-entry arming is now reached by pressing a duration after
   *     (see {@link promoteAccidentalStampToNoteEntry}), preserving the "accidental + duration" flow.
   *  3. Entry mode (note entry) → arm/toggle the accidental for the NEXT note entered.
   *
   * "Nothing to apply to" is decided by {@link applyAccidentalToSelection} returning false, NOT by
   * `selectedNoteId`: after note entry, Select/Esc leaves the cursor note in `selectedNoteId` while
   * the selection set is empty — that reads as "nothing selected", so a press there arms the stamp
   * (same rule as the articulation stamp). A NULL accidental is the palette's "remove" and only ever
   * meaningful on a real selection (1); with nothing selected it arms nothing (a no-op).
   */
  setAccidental(accidental: Accidental | null): void {
    // (0) Stamp already live: swap the armed accidental, or disarm when the same one is pressed.
    if (this.state.selectedAccidentalTool !== null) {
      if (accidental === null || accidental === this.state.selectedAccidentalTool) {
        this.state.selectedAccidentalTool = null
        this.state.selectedTool = 'selection'
      } else {
        this.state.selectedAccidentalTool = accidental
      }
      // Show the NEW sign at once — swapping ♯→♭ must change the ghost on the keypress, not on the
      // next mouse move, or the armed tool and what you see disagree. A disarm draws nothing
      // (showArmedGhost checks the mode).
      this.showArmedGhost()
      return
    }

    // A DIFFERENT marking tool (the articulation / tie stamp) is armed → switch to this accidental
    // stamp, so the marking tools stay mutually exclusive. Must cover EVERY other stamp: they arm
    // into entry mode, so anything missed here falls through to the entry-mode branch below and
    // arms a note-entry accidental while leaving the other tool armed.
    if (this.state.selectedArticulationTools.length > 0 || this.state.selectedTieTool
      || this.state.selectedDotTool) {
      this.armAccidentalTool(accidental)
      return
    }

    // A standalone accidental glyph is selected in the score → the press EDITS it: the same
    // accidental (or a null "remove") deletes it; a different one changes it.
    if (this.state.selectedAccidentalNoteId) {
      this.editSelectedAccidental(accidental)
      return
    }

    // Selection mode: (1) apply across a real selection, or (2) arm the stamp when there is none.
    if (this.state.selectedTool === 'selection') {
      if (!this.applyAccidentalToSelection(accidental)) this.armAccidentalTool(accidental)
      return
    }

    // (3) Entry mode: arm/toggle the accidental for the NEXT note entered.
    this.state.selectedAccidental = this.state.selectedAccidental === accidental ? null : accidental
    const pos = this.getLastMousePosition()
    if (pos) this.renderArmedGhost(pos)
  }

  /**
   * Edit the standalone accidental glyph currently selected in the score (see
   * {@link EditorState.selectedAccidentalNoteId}). Pressing the SAME accidental — or a null "remove"
   * — deletes it (reverts the note to the measure's prevailing alteration, exactly like the Delete
   * key); pressing a DIFFERENT accidental changes it. After a change the new accidental stays
   * selected so it can be changed again or removed; after a delete NOTHING stays selected — the
   * gesture is a Keypad switch-off, so (unlike the Delete key, which keeps the note selected to keep
   * editing) we clear the selection outright, or the Keypad would light a stray duration for a note
   * the user can't see selected.
   */
  private editSelectedAccidental(accidental: Accidental | null): void {
    const engine = this.getEngine()
    const noteId = this.state.selectedAccidentalNoteId
    if (!engine || !noteId) return

    const current = accidentalTypeToKey(this.state.selectedAccidentalType)
    if (accidental === null || accidental === current) {
      // Remove: revert to the prevailing alteration so the glyph disappears in every case.
      engine.runBatch('Remove accidental', () =>
        engine.updateNote(noteId, { alter: engine.getPrevailingAlter(noteId), forceAccidental: undefined }))
      this.state.selectedAccidentalNoteId = null
      this.state.selectedAccidentalType = null
      this.selectNote(null) // switch-off leaves nothing selected (clears the note anchor too)
      this.renderScore()
    } else {
      engine.runBatch(`Set ${accidental}`, () => engine.setNoteAccidental(noteId, accidental))
      this.state.selectedAccidentalType = accidental // keep the (now changed) accidental selected
      this.renderScore()
    }
  }

  /**
   * Apply an accidental across the whole selection as ONE undoable action. Returns false when there
   * is nothing to apply to (not in selection tool, or no non-rest note in the selection SET — see
   * the note-entry cursor caveat on {@link setAccidental}), so the caller arms the stamp instead.
   *
   * Mirrors {@link applyArticulationToSelection}'s group semantics: a null accidental (the palette
   * "remove") reverts every selected note to its prevailing alteration; otherwise the toggle
   * direction is decided for the selection as a whole — if EVERY selected note already shows the
   * sign it's removed from all, else it's set on all (a chord sharps/flats together).
   */
  private applyAccidentalToSelection(accidental: Accidental | null): boolean {
    const engine = this.getEngine()
    if (this.state.selectedTool !== 'selection' || !this.state.selectedNoteId || !engine) return false

    const ids = selectedNoteIds(this.state.selectedItems.values())
      .filter(id => {
        const note = engine.getNote(id)
        return note && !note.isRest
      })
    if (ids.length === 0) return false

    const revert = (id: string) =>
      engine.updateNote(id, { alter: engine.getPrevailingAlter(id), forceAccidental: undefined })

    if (accidental === null) {
      engine.runBatch('Remove accidental', () => { for (const id of ids) revert(id) })
    } else {
      const allHaveIt = ids.every(id => engine.noteDisplaysAccidental(id, accidental))
      engine.runBatch(allHaveIt ? `Remove ${accidental}` : `Set ${accidental}`, () => {
        for (const id of ids) {
          if (allHaveIt) revert(id)
          else engine.setNoteAccidental(id, accidental)
        }
      })
    }
    engine.updateUndoNoteId(this.state.selectedNoteId)
    this.renderScore()
    this.selectNote(this.state.selectedNoteId) // re-syncs the accidental highlight to the note
    return true
  }

  /**
   * Arm `accidental` as the accidental stamp tool and switch to entry mode. Mirrors
   * {@link armArticulationTool}: mutually exclusive with the other marking tools, clears the note
   * selection so the ghost reads as "the next click sets this accidental", and repaints. The ghost
   * appears on the next mouse move (via MouseController.renderToolGhost). A null accidental (a
   * "remove" with nothing selected) is a no-op — there is nothing to arm.
   */
  private armAccidentalTool(accidental: Accidental | null): void {
    if (accidental === null) return
    this.state.selectedAccidentalTool = accidental
    this.state.selectedArticulationTools = []
    this.state.selectedTieTool = false
    this.state.selectedDotTool = false
    this.state.selectedClef = null
    this.state.selectedTimeSignature = null
    this.state.selectedDynamic = null
    this.state.selectedTempo = null
    this.state.selectedNoteId = null
    this.state.selectedClefMeasure = null
    this.state.selectedClefBeat = null
    this.state.selectedTimeSignatureMeasure = null
    this.state.selectedDynamicId = null
    this.state.selectedTempoId = null
    this.state.selectedTool = 'entry'
    this.showArmedGhost()
  }

  /**
   * Promote an armed accidental stamp into the note-entry armed accidental. Called when a duration
   * press arrives while the stamp is armed: the armed accidental becomes `selectedAccidental` and the
   * stamp is cleared — flipping "click existing notes to set this accidental" into "enter new notes
   * carrying this accidental" (the "accidental + duration" mode). No-op when no stamp is armed.
   */
  private promoteAccidentalStampToNoteEntry(): void {
    const armed = this.state.selectedAccidentalTool
    if (armed === null) return
    this.state.selectedAccidental = armed
    this.state.selectedAccidentalTool = null
  }

  toggleAccent(): void {
    this.pressArticulation('accent')
  }

  toggleStaccato(): void {
    this.pressArticulation('staccato')
  }

  toggleTenuto(): void {
    this.pressArticulation('tenuto')
  }

  /**
   * One articulation-key press, routed by context:
   *  0. A standalone articulation GROUP is selected in the score → additively toggle this
   *     articulation on it (see {@link editSelectedArticulation}).
   *  1. Selection mode with a real note selection → toggle the articulation across the selection.
   *  2. Selection mode with NOTHING to apply to → arm the articulation STAMP tool: switch to entry
   *     mode with a ghost articulation, then clicks add it to the notes clicked. A second press of
   *     the armed key (or a different articulation key) toggles it off / switches which one; Esc /
   *     Select disarms too.
   *  3. Entry mode (note entry) → arm/disarm the articulation for the NEXT note entered.
   *
   * "Nothing to apply to" is decided by {@link applyArticulationToSelection} returning false, NOT by
   * `selectedNoteId`: after note entry, Select/Esc leaves the cursor note in `selectedNoteId` while
   * the multi-select set is empty — that reads as "nothing selected" to the user, so a press there
   * arms the stamp (it used to fall through and draw a ghost NOTE, forcing a duration choice).
   */
  private pressArticulation(type: ArticulationType): void {
    // (2a) The stamp tool is already live (we are in entry mode): ADD this articulation to the
    // armed set, or REMOVE it if already armed; when the set empties, disarm back to selection.
    // Handled first so the entry-mode note-entry arm in (3) never swallows it.
    if (this.state.selectedArticulationTools.length > 0) {
      const armed = this.state.selectedArticulationTools
      const next = armed.includes(type) ? armed.filter(t => t !== type) : [...armed, type]
      if (next.length === 0) {
        this.state.selectedArticulationTools = []
        this.state.selectedTool = 'selection'
      } else {
        this.state.selectedArticulationTools = next
      }
      // Show the new armed SET at once — adding/removing an articulation must restack the ghost on
      // the keypress. A disarm (the set emptied) draws nothing (showArmedGhost checks the mode).
      this.showArmedGhost()
      this.refreshArticulationSelection()
      return
    }

    // A DIFFERENT marking tool (the accidental / tie stamp) is armed → switch to this articulation
    // stamp, so the marking tools stay mutually exclusive. Must cover EVERY other stamp, for the
    // same reason as in setAccidental: a miss falls through to the entry-mode arm below.
    if (this.state.selectedAccidentalTool !== null || this.state.selectedTieTool
      || this.state.selectedDotTool) {
      this.armArticulationTool([type])
      this.refreshArticulationSelection()
      return
    }

    // A standalone articulation GROUP is selected in the score → the press EDITS it: additively
    // toggle this articulation on the group (add if missing, remove if present). Mirrors the
    // accidental-glyph editing, but additive (a note can carry several articulations). Handled
    // before the branch below, whose applyArticulationToSelection would return false (no note
    // selected) and wrongly arm the stamp.
    if (this.state.selectedArticulationNoteId) {
      this.editSelectedArticulation(type)
      this.refreshArticulationSelection()
      return
    }

    // Selection mode: (1) apply across a real selection, or (2b) arm the stamp when there is none.
    if (this.state.selectedTool === 'selection') {
      if (!this.applyArticulationToSelection(type)) this.armArticulationTool([type])
      this.refreshArticulationSelection()
      return
    }

    // (3) Entry mode (note entry): arm/disarm for the next note entered.
    if (type === 'accent') this.state.accent = !this.state.accent
    else if (type === 'staccato') this.state.staccato = !this.state.staccato
    else this.state.tenuto = !this.state.tenuto
    const pos = this.getLastMousePosition()
    if (pos) this.renderArmedGhost(pos)
    this.refreshArticulationSelection()
  }

  /**
   * Arm `types` as the articulation stamp tool and switch to entry mode. Mirrors the clef/dynamic
   * arming: mutually exclusive with the other marking tools and clears the note selection, so the
   * ghost reads unambiguously as "the next click adds these articulations". Further articulation
   * presses grow/shrink the armed set (see {@link pressArticulation}). The ghost appears on the
   * next mouse move (via MouseController.renderToolGhost).
   */
  private armArticulationTool(types: ArticulationType[]): void {
    this.state.selectedArticulationTools = types
    this.state.selectedAccidentalTool = null
    this.state.selectedTieTool = false
    this.state.selectedDotTool = false
    this.state.selectedClef = null
    this.state.selectedTimeSignature = null
    this.state.selectedDynamic = null
    this.state.selectedTempo = null
    this.state.selectedNoteId = null
    this.state.selectedClefMeasure = null
    this.state.selectedClefBeat = null
    this.state.selectedTimeSignatureMeasure = null
    this.state.selectedDynamicId = null
    this.state.selectedTempoId = null
    this.state.selectedTool = 'entry'
    this.showArmedGhost()
  }

  /**
   * Promote an armed articulation stamp into the note-entry articulation flags. Called when a
   * note-entry action (a duration press) arrives while the stamp tool is armed: the armed set
   * becomes exactly the `accent`/`staccato`/`tenuto` arm-for-next-note flags and the stamp set is
   * cleared. Net effect — the tool flips from "click existing notes to add these articulations" to
   * "enter new notes carrying these articulations", with no articulation lost. No-op when the stamp
   * tool isn't armed (a normal duration press is untouched).
   */
  private promoteArticulationStampToNoteEntry(): void {
    const armed = this.state.selectedArticulationTools
    if (armed.length === 0) return
    this.state.accent = armed.includes('accent')
    this.state.staccato = armed.includes('staccato')
    this.state.tenuto = armed.includes('tenuto')
    this.state.selectedArticulationTools = []
  }

  /**
   * Apply an articulation across the whole selection as ONE undoable action.
   * Returns false when not applicable (not in selection tool, or nothing selected)
   * so the caller can fall back to arming the articulation for the next note entry.
   *
   * Toggle direction is decided for the selection as a whole: if EVERY applicable
   * (non-rest) selected note already has the articulation, it's removed from all;
   * otherwise it's added to all. For a single selected note this is identical to the
   * old per-note toggle.
   */
  private applyArticulationToSelection(type: ArticulationType): boolean {
    const engine = this.getEngine()
    if (this.state.selectedTool !== 'selection' || !this.state.selectedNoteId || !engine) return false

    const ids = selectedNoteIds(this.state.selectedItems.values())
      .filter(id => {
        const note = engine.getNote(id)
        return note && !note.isRest
      })
    if (ids.length === 0) return false

    const allHaveIt = ids.every(id => engine.getNote(id)?.articulations?.includes(type))
    // toggleArticulation flips presence, so only call it on notes whose current
    // state differs from the target (add → notes missing it; remove → notes with it).
    engine.runBatch(allHaveIt ? `Remove ${type}` : `Add ${type}`, () => {
      for (const id of ids) {
        const hasIt = engine.getNote(id)?.articulations?.includes(type) ?? false
        if (hasIt === allHaveIt) engine.toggleArticulation(id, type)
      }
    })
    engine.updateUndoNoteId(this.state.selectedNoteId)
    this.renderScore()
    return true
  }

  /**
   * Edit the standalone articulation GROUP(s) selected in the score (see
   * {@link EditorState.selectedArticulationNoteId}) from the Keypad: additively toggle `type` on
   * them. Group-toggle semantics like {@link applyArticulationToSelection} — if EVERY selected group
   * already has it, remove from all; else add to all. When a group is left with NO articulations it
   * has nothing to keep selected, so once ALL selected groups are empty the selection is cleared
   * (nothing highlighted), matching the accidental switch-off. (Del still clears a whole group.)
   */
  private editSelectedArticulation(type: ArticulationType): void {
    const engine = this.getEngine()
    if (!engine) return
    const ids = selectedArticulationNoteIds(this.state.selectedItems.values())
    const noteIds = ids.length ? ids : (this.state.selectedArticulationNoteId ? [this.state.selectedArticulationNoteId] : [])
    if (noteIds.length === 0) return

    const allHaveIt = noteIds.every(id => engine.getNote(id)?.articulations?.includes(type))
    engine.runBatch(allHaveIt ? `Remove ${type}` : `Add ${type}`, () => {
      for (const id of noteIds) {
        const hasIt = engine.getNote(id)?.articulations?.includes(type) ?? false
        if (hasIt === allHaveIt) engine.toggleArticulation(id, type)
      }
    })

    // If every selected group is now empty, there's nothing left to select → clear it (like the
    // accidental switch-off leaving nothing selected).
    const anyRemain = noteIds.some(id => (engine.getNote(id)?.articulations?.length ?? 0) > 0)
    if (!anyRemain) {
      this.state.selectedArticulationNoteId = null
      this.state.selectedArticulationType = null
      this.selectNote(null)
    }
    this.renderScore()
  }

  /**
   * One tie-key press (the Keypad's Enter), routed by context — the same split as
   * {@link setAccidental} / {@link pressArticulation}, minus their entry-mode arm: there is no
   * armed entry-mode tie (see {@link tieSelection}), so entry mode keeps its old meaning.
   *
   *  0. The tie STAMP is already armed → disarm it (a re-press toggles the tool off, like a
   *     re-pressed accidental).
   *  1. A TIE is selected in the score → remove it ({@link editSelectedTie}). Routed AHEAD of the
   *     branches below: clicking a tie clears the note selection outright (MouseController), so
   *     they would see nothing selected and wrongly arm the stamp — the trap
   *     {@link editSelectedAccidental} is ordered around too.
   *  2. Selection mode with a real note selection → tie it (pre-existing behaviour).
   *  3. Selection mode with NOTHING selected → arm the tie STAMP tool.
   *  4. Entry mode → tie the cursor note (pre-existing: Enter straight after entering a note ties
   *     it). Nothing competes for the key here, so it is left alone.
   *
   * (2) vs (3) is decided by the selection SET, never the `selectedNoteId` anchor — the stamps'
   * shared rule: after note entry, Select/Esc leaves the cursor note in the anchor with an empty
   * set, which reads as "nothing selected" to the user.
   */
  toggleTie(): void {
    const engine = this.getEngine()
    if (!engine) return

    // (0) The stamp is live → the key toggles it off, back to selection mode.
    if (this.state.selectedTieTool) {
      this.state.selectedTieTool = false
      this.state.selectedTool = 'selection'
      this.renderScore()
      this.refreshTieSelection()
      return
    }

    // A DIFFERENT marking tool (the articulation / accidental stamp) is armed → switch to the tie
    // stamp, so the marking tools stay mutually exclusive.
    if (this.state.selectedArticulationTools.length > 0 || this.state.selectedAccidentalTool !== null
      || this.state.selectedDotTool) {
      this.armTieTool()
      return
    }

    // (1) A tie is selected in the score → the press removes it.
    if (this.state.selectedTieFromNoteId) {
      this.editSelectedTie()
      return
    }

    // (2) / (3) Selection mode: tie the selection, or arm the stamp when there is none.
    if (this.state.selectedTool === 'selection') {
      const ids = selectedNoteIds(this.state.selectedItems.values())
      if (ids.length === 0) this.armTieTool()
      else this.tieNotes(ids)
      return
    }

    // (4) Entry mode: tie the multi-select set, falling back to the scalar cursor note. The engine
    // ties each note to the same pitch in the next slot, so chords tie pitch-for-pitch.
    const ids = selectedNoteIds(this.state.selectedItems.values())
    const noteIds = ids.length ? ids : (this.state.selectedNoteId ? [this.state.selectedNoteId] : [])
    if (noteIds.length === 0) return
    this.tieNotes(noteIds)
  }

  /** Tie `noteIds` through the engine and resync — the shared body of every tie-key path. */
  private tieNotes(noteIds: string[]): void {
    const engine = this.getEngine()
    if (!engine) return
    console.log(`[Tie] toggleTie on ${noteIds.length} note(s) (tool:${this.state.selectedTool})`)
    const result = engine.tieSelection(noteIds)
    console.log(`[Tie] result:${result === null ? 'no candidate found' : result ? 'tie(s) added' : 'tie(s) removed'}`)
    this.renderScore()
    this.refreshTieSelection()
  }

  /**
   * Remove the tie currently selected in the score (see {@link EditorState.selectedTieFromNoteId}) —
   * the tie's sibling of {@link editSelectedAccidental}. A tie is VALUELESS, so unlike an accidental
   * there is no "press a different one to change it": the only edit the key can mean is remove,
   * which is also what Delete does to a selected tie. Mirrors the accidental switch-off in leaving
   * NOTHING selected (`selectNote(null)`), or the Keypad would light a stray duration for a note
   * with no visible highlight.
   */
  private editSelectedTie(): void {
    const engine = this.getEngine()
    const fromNoteId = this.state.selectedTieFromNoteId
    if (!engine || !fromNoteId) return

    console.log(`[Tie] removing selected tie | fromNoteId:${fromNoteId}`)
    engine.toggleTie(fromNoteId) // the tie exists, so this removes it
    this.state.selectedTieFromNoteId = null
    this.selectNote(null)
    this.renderScore()
    this.refreshTieSelection()
  }

  /**
   * Arm the tie stamp tool and switch to entry mode. Mirrors {@link armAccidentalTool} /
   * {@link armArticulationTool}: mutually exclusive with the other marking tools, clears the note
   * selection so the ghost reads as "the next click ties the note clicked", and repaints. The ghost
   * arc appears on the next mouse move (via MouseController.renderToolGhost).
   */
  private armTieTool(): void {
    this.state.selectedTieTool = true
    this.state.selectedArticulationTools = []
    this.state.selectedAccidentalTool = null
    this.state.selectedDotTool = false
    this.state.selectedClef = null
    this.state.selectedTimeSignature = null
    this.state.selectedDynamic = null
    this.state.selectedTempo = null
    this.state.selectedNoteId = null
    this.state.selectedClefMeasure = null
    this.state.selectedClefBeat = null
    this.state.selectedTimeSignatureMeasure = null
    this.state.selectedDynamicId = null
    this.state.selectedTempoId = null
    this.state.selectedTool = 'entry'
    this.showArmedGhost()
    this.refreshTieSelection()
  }

  /**
   * Add a phrasing slur over the current selection (key `s`). Reads the
   * multi-select set (range) and falls back to the scalar anchor (single note);
   * the engine resolves endpoints (single→next slot, range→first/last, voice 0).
   * Create-only and idempotent — removal is select-the-arc + Delete.
   */
  createSlur(): void {
    const engine = this.getEngine()
    if (!engine) return
    const ids = selectedNoteIds(this.state.selectedItems.values())
    const noteIds = ids.length ? ids : (this.state.selectedNoteId ? [this.state.selectedNoteId] : [])
    if (noteIds.length === 0) return
    const slur = engine.createSlur(noteIds)
    console.log(`[Slur] createSlur on ${noteIds.length} note(s) → ${slur ? `slur ${slur.id}` : 'no valid span'}`)
    this.renderScore()
  }

  /**
   * One dot-key press, routed by context — the same split as the other stamps:
   *  0. The dot STAMP is already armed → disarm it (a re-press toggles the tool off).
   *  1. A slot's DOTS are selected in the score → REMOVE them (the only edit the key can mean: the
   *     dot is on or off, so there is no "change it to a different dot"). Routed ahead of the arm
   *     branch — clicking a dot clears the note selection, so (3) would otherwise read as "nothing
   *     selected" and arm the stamp. Switch-off leaves NOTHING selected, like the accidental's.
   *  2. Selection mode with a note selected → dot it (pre-existing behaviour).
   *  3. Selection mode with NOTHING selected → arm the dot STAMP. This replaces the old "flip to
   *     entry mode with the dot armed", which drew a ghost NOTE and forced a duration choice; that
   *     flow is now reached by pressing a duration after (see {@link promoteDotStampToNoteEntry}).
   *  4. Entry mode → arm/disarm the dot for the NEXT note entered.
   */
  toggleDot(): void {
    const engine = this.getEngine()

    // (0) The stamp is live → the key toggles it off, back to selection mode.
    if (this.state.selectedDotTool) {
      this.state.selectedDotTool = false
      this.state.selectedTool = 'selection'
      this.renderScore()
      return
    }

    // A DIFFERENT marking tool is armed → switch to the dot stamp (they stay mutually exclusive).
    if (this.state.selectedArticulationTools.length > 0 || this.state.selectedAccidentalTool !== null
      || this.state.selectedTieTool) {
      this.armDotTool()
      return
    }

    // (1) The dots are selected in the score → the press removes them.
    if (this.state.selectedDotNoteId && engine) {
      const noteId = this.state.selectedDotNoteId
      console.log(`[Dot] removing selected dot(s) | noteId:${noteId}`)
      engine.runBatch('Remove dot', () => engine.updateNote(noteId, { dots: 0 }))
      this.state.selectedDotNoteId = null
      this.state.selectedDots = 0
      this.selectNote(null)
      this.renderScore()
      return
    }

    // (3) Selection mode with nothing selected → arm the stamp instead of flipping to note entry.
    // Decided by the selection SET, not the `selectedNoteId` anchor: after note entry, Select/Esc
    // leaves the cursor note in the anchor with an empty set, which reads as "nothing selected".
    if (this.state.selectedTool === 'selection'
      && selectedNoteIds(this.state.selectedItems.values()).length === 0) {
      this.armDotTool()
      return
    }

    const newValue = this.state.selectedDots >= 1 ? 0 : 1
    this.state.selectedDots = newValue
    if (this.state.selectedNoteId && engine && this.state.selectedTool === 'selection') {
      const before = engine.getNote(this.state.selectedNoteId)
      engine.updateNote(this.state.selectedNoteId, { dots: newValue })
      if (before && !before.isRest) {
        const pitch = `${before.step}${before.alter === 1 ? '#' : before.alter === -1 ? 'b' : before.alter === 2 ? '##' : before.alter === -2 ? 'bb' : ''}${before.octave}`
        const oldDur = `${before.duration}${'.'.repeat(before.dots ?? 0)}`
        const newDur = `${before.duration}${'.'.repeat(newValue)}`
        console.log(`[Duration] ${pitch} | ${oldDur} → ${newDur}`)
      }
      this.renderScore()
    } else if (this.state.selectedTool === 'entry') {
      // (4) Entry mode: the dot is armed for the next note; refresh the ghost note to show it.
      // There is no "selection mode" arm left here — branch (3) above claims that case for the
      // stamp, which is what used to flip to entry mode and draw a ghost note.
      const pos = this.getLastMousePosition()
      if (pos) this.renderArmedGhost(pos)
    }
  }

  /**
   * Arm the dot stamp tool and switch to entry mode. Mirrors {@link armTieTool} /
   * {@link armAccidentalTool}: mutually exclusive with the other marking tools, clears the note
   * selection so the ghost reads as "the next click dots the note clicked", and repaints. The ghost
   * appears on the next mouse move (via MouseController.renderToolGhost).
   */
  private armDotTool(): void {
    this.state.selectedDotTool = true
    this.state.selectedArticulationTools = []
    this.state.selectedAccidentalTool = null
    this.state.selectedTieTool = false
    this.state.selectedClef = null
    this.state.selectedTimeSignature = null
    this.state.selectedDynamic = null
    this.state.selectedTempo = null
    this.state.selectedNoteId = null
    this.state.selectedClefMeasure = null
    this.state.selectedClefBeat = null
    this.state.selectedTimeSignatureMeasure = null
    this.state.selectedDynamicId = null
    this.state.selectedTempoId = null
    this.state.selectedTool = 'entry'
    this.showArmedGhost()
  }

  toggleTuplet(): void {
    const engine = this.getEngine()
    if (this.state.selectedNoteId && engine && this.state.selectedTool === 'selection') {
      const note = engine.getNote(this.state.selectedNoteId)
      if (!note) return
      if (note.tupletId) {
        engine.deleteTuplet(note.tupletId)
      } else {
        const result = engine.applyTupletToNote(this.state.selectedNoteId)
        if (result) this.selectNote(result.note.id)
      }
      this.renderScore()
      return
    }
    this.state.tupletMode = !this.state.tupletMode
    if (this.state.tupletMode) {
      this.state.selectedDots = 0
    }
  }

  setBeam(beam: BeamMode): void {
    this.state.selectedBeam = beam
    const engine = this.getEngine()
    if (this.state.selectedNoteId && engine && this.state.selectedTool === 'selection') {
      const note = engine.getNote(this.state.selectedNoteId)
      if (note && !note.isRest) {
        engine.updateNote(this.state.selectedNoteId, { beam })
        this.renderScore()
      }
    }
  }

  /**
   * Arm/disarm a clef for placement. Clicking the active clef again disarms it.
   * While armed, canvas clicks set/change a measure's clef (see MouseController)
   * and the ghost note is suppressed. Switches to the entry tool so canvas clicks
   * are handled (the selection tool ignores clicks for placement).
   */
  setClef(clef: Clef): void {
    const newValue = this.state.selectedClef === clef ? null : clef
    this.state.selectedClef = newValue
    if (newValue) {
      this.state.selectedTimeSignature = null
      this.state.selectedDynamic = null
      this.state.selectedTool = 'entry'
      this.state.selectedNoteId = null
      this.state.selectedClefMeasure = null
      this.state.selectedClefBeat = null
      this.state.selectedTimeSignatureMeasure = null
      this.state.selectedDynamicId = null
      this.state.selectedTempo = null
      this.state.selectedTempoId = null
    }
    this.renderScore()
  }

  /**
   * Arm/disarm a time signature for placement. Clicking the active signature
   * again disarms it. While armed, canvas clicks set/change a measure's time
   * signature (see MouseController) and the ghost note is suppressed. Switches to
   * the entry tool so canvas clicks are handled for placement.
   */
  setTimeSignature(ts: TimeSignature): void {
    const current = this.state.selectedTimeSignature
    const newValue = current && sameTimeSignature(current, ts) ? null : ts
    this.state.selectedTimeSignature = newValue
    if (newValue) {
      this.state.selectedClef = null
      this.state.selectedDynamic = null
      this.state.selectedTool = 'entry'
      this.state.selectedNoteId = null
      this.state.selectedClefMeasure = null
      this.state.selectedClefBeat = null
      this.state.selectedTimeSignatureMeasure = null
      this.state.selectedDynamicId = null
      this.state.selectedTempo = null
      this.state.selectedTempoId = null
    }
    this.renderScore()
  }

  /**
   * Arm/disarm a dynamic for placement. Clicking the active value again disarms
   * it. A level (`p`/`mp`/`mf`/`f`) places that mark on the next canvas click;
   * `'text'` places a custom italic-text mark (MouseController prompts for the
   * text). Mutually exclusive with the clef/time-signature tools, and switches to
   * the entry tool so canvas clicks are handled for placement.
   */
  setDynamic(value: DynamicTool): void {
    // Selection mode with a note/rest selected → place the dynamic directly at that
    // element's slot (no arm-and-click), the same way articulations/accidentals apply
    // to the current selection. Only when nothing is selected do we fall back to the
    // arm-then-click placement flow below.
    if (this.state.selectedTool === 'selection' && this.state.selectedNoteId) {
      this.placeDynamicAtSelectedNote(value)
      return
    }

    const newValue = this.state.selectedDynamic === value ? null : value
    this.state.selectedDynamic = newValue
    if (newValue) {
      this.state.selectedClef = null
      this.state.selectedTimeSignature = null
      this.state.selectedTool = 'entry'
      this.state.selectedNoteId = null
      this.state.selectedClefMeasure = null
      this.state.selectedClefBeat = null
      this.state.selectedTimeSignatureMeasure = null
      this.state.selectedDynamicId = null
      this.state.selectedTempo = null
      this.state.selectedTempoId = null
    }
    this.renderScore()
  }

  /**
   * Arm/disarm a tempo mark for placement. Clicking the armed preset again disarms it.
   * Mutually exclusive with the clef/time-signature/dynamic tools, and switches to the
   * entry tool so canvas clicks are handled for placement.
   *
   * A tempo mark is SYSTEM-level, so — unlike a dynamic — it carries no staff and no
   * voice: whichever staff you click, one mark is placed governing the whole system.
   */
  setTempo(tool: TempoTool | null): void {
    // A tempo mark is SELECTED → the palette edits it in place instead of arming a new
    // one (a Sibelius-style inspector). This is the only way to change a placed mark's
    // NUMBER without deleting it: select it, set the bpm, press the metronome button.
    //
    // The update is PARTIAL, which is what makes it safe: the metronome button's tool
    // carries no `text`, so re-numbering leaves the word alone; a word preset carries no
    // `dots`, so re-wording leaves a dotted unit alone. Renaming never moves the tempo and
    // re-numbering never rewrites the word (decision D2).
    if (tool && this.state.selectedTempoId) {
      const engine = this.getEngine()
      const updated = engine?.updateTempoMark(this.state.selectedTempoId, tool)
      if (updated) console.log(`✓ Tempo mark → ${tempoLabel(updated)}`)
      this.renderScore()
      return
    }

    // Selection mode with a note/rest selected → place at that element's slot directly
    // (no arm-and-click), exactly like the dynamics tool.
    if (tool && this.state.selectedTool === 'selection' && this.state.selectedNoteId) {
      this.placeTempoAtSelectedNote(tool)
      return
    }

    const same = tool !== null && sameTempoTool(this.state.selectedTempo, tool)
    const newValue = same ? null : tool
    this.state.selectedTempo = newValue
    if (newValue) {
      this.state.selectedClef = null
      this.state.selectedTimeSignature = null
      this.state.selectedDynamic = null
      this.state.selectedTool = 'entry'
      this.state.selectedNoteId = null
      this.state.selectedClefMeasure = null
      this.state.selectedClefBeat = null
      this.state.selectedTimeSignatureMeasure = null
      this.state.selectedDynamicId = null
      this.state.selectedTempoId = null
    }
    this.renderScore()
  }

  /** Place the armed tempo mark at the currently selected note/rest's (measure, beat). */
  private placeTempoAtSelectedNote(tool: TempoTool): void {
    const engine = this.getEngine()
    if (!engine || !this.state.selectedNoteId) return
    const note = engine.getNote(this.state.selectedNoteId)
    if (!note) return
    // No staffId, no voice — the mark governs the clock, not the staff it was placed from.
    const created = engine.addTempoMark(note.measure, { beat: note.beat, ...tool })
    if (created) {
      console.log(`✓ Tempo ${tempoLabel(created)} at measure ${note.measure} beat ${fracToNumber(note.beat).toFixed(3)} (on selected note)`)
    }
    this.renderScore()
  }

  /**
   * Place the dynamic for `tool` directly at the currently selected note/rest's slot
   * (selection mode). The mark anchors to the element's (measure, beat); a level tool
   * drops its glyph, `'text'` drops the editable placeholder (double-click to edit,
   * matching canvas placement). Voice 0 — see the VOICE SEAM note in MouseController.
   */
  private placeDynamicAtSelectedNote(tool: DynamicTool): void {
    const engine = this.getEngine()
    if (!engine || !this.state.selectedNoteId) return
    const note = engine.getNote(this.state.selectedNoteId)
    if (!note) return
    const beatStr = fracToNumber(note.beat).toFixed(3)
    // The mark anchors to the selected note's STAFF (else it renders on staff 0). Absent
    // staffId = staff 0 keeps single-staff output byte-identical.
    const staffId = engine.staffIdForIndex(note.staff ?? 0)
    const staffParam = staffId ? { staffId } : {}
    if (tool === 'text') {
      engine.addDynamic(note.measure, { beat: note.beat, kind: 'text', text: DEFAULT_DYNAMIC_TEXT, voice: 0, placement: 'below', ...staffParam })
      console.log(`✓ Dynamic text at measure ${note.measure} beat ${beatStr} staff ${note.staff ?? 0} (on selected note ${this.state.selectedNoteId})`)
    } else {
      engine.addDynamic(note.measure, { beat: note.beat, kind: 'level', level: tool, voice: 0, placement: 'below', ...staffParam })
      console.log(`✓ Dynamic ${tool} at measure ${note.measure} beat ${beatStr} staff ${note.staff ?? 0} (on selected note ${this.state.selectedNoteId})`)
    }
    this.renderScore()
  }

  /**
   * Choose the active voice (Sibelius-style; palette buttons + Alt+1/Alt+2).
   *
   * In selection mode with a selection, a voice press MOVES the selected note(s)
   * into that voice (Sibelius Alt+1/2-on-selection) — preserving their ids so
   * ties/slurs/selection survive, as one atomic undo. Otherwise it arms the voice
   * for note entry: with nothing selected, flip to entry mode (mirrors the
   * duration/accidental tools).
   */
  setActiveVoice(voice: 1 | 2): void {
    this.state.activeVoice = voice
    console.log(`[Voice] active voice → ${voice}`)

    // Selection-mode + a selection → reassign voice instead of arming entry.
    const engine = this.getEngine()
    if (engine && this.state.selectedTool === 'selection') {
      const ids = selectedNoteIds(this.state.selectedItems.values())
      if (ids.length === 0 && this.state.selectedNoteId) ids.push(this.state.selectedNoteId)
      if (ids.length > 0) {
        const moved = engine.moveSelectionToVoice(ids, activeVoiceToModel(voice))
        if (moved) {
          // Ids are unchanged, so the selection Map stays valid — just re-render
          // (notes recolour to their new voice).
          this.renderScore()
          return
        }
        // Nothing moved (all already in the target voice, or rests) — leave the
        // selection as-is and fall through to the entry-arming refresh below.
      }
    }

    // Entry-arming behaviour (no selection, or nothing actually moved).
    if (this.state.selectedTool === 'selection' && !this.state.selectedNoteId) {
      this.state.selectedTool = 'entry'
    }
    const pos = this.getLastMousePosition()
    if (pos) this.renderArmedGhost(pos)
  }

  resetToDefaults(): void {
    this.state.activeVoice = 1
    this.state.selectedDuration = 'q'
    this.state.selectedAccidental = null
    this.state.selectedDots = 0
    this.state.accent = false
    this.state.staccato = false
    this.state.tenuto = false
    this.state.selectedBeam = 'auto'
    this.disarmPositionalTools()
    this.state.selectedTimeSignatureMeasure = null
    this.state.selectedDynamicId = null
  }

  /**
   * Disarm the positional palette tools — clef, time signature, dynamic, tempo, and the
   * articulation stamp tool. These are entry-mode-only (arming one switches to entry mode and a
   * canvas click places/stamps it); leaving entry mode makes them inert, so the palette should
   * stop showing them as selected. Does NOT touch note-entry settings (duration, accidental, and
   * the accent/staccato/tenuto arm-for-next-note flags) which carry over between modes.
   */
  disarmPositionalTools(): void {
    this.state.selectedClef = null
    this.state.selectedTimeSignature = null
    this.state.selectedDynamic = null
    this.state.selectedTempo = null
    // The articulation stamp tool is entry-only too (arming it switches to entry mode; a click
    // stamps the hovered note) — so leaving entry mode makes it inert and it disarms with the rest.
    this.state.selectedArticulationTools = []
    // The accidental stamp tool is the same kind of entry-only marking tool → disarm it too.
    this.state.selectedAccidentalTool = null
    // ...and so are the tie and dot stamps.
    this.state.selectedTieTool = false
    this.state.selectedDotTool = false
  }

  /**
   * The Keypad's Select arrow: CLEAR the whole selection and enter selection mode. Deselects
   * everything (the Esc path — notes, accidental/articulation/tie/… sub-selections, dynamics,
   * tuplets), disarms any positional tool, flips the mode, and repaints so the blue keyboard cursor
   * comes down. Unlike before, it is NOT a no-op when already in selection mode — pressing the arrow
   * with something selected clears it (its whole point now).
   */
  enterSelectionMode(): void {
    if (this.deselectAll) this.deselectAll()
    else this.selectNote(null)
    this.disarmPositionalTools()
    this.state.selectedTool = 'selection'
    this.renderScore()
  }

  // --- Toolbar button active-state helpers ---
  // In selection mode: reflect the selected note's actual state.
  // In entry mode: reflect the pending palette state.

  /** True if the articulation-relevant selection (a note, or a group-selected
   *  articulation set) carries the given articulation. Group selection reflects the
   *  note's real articulations — every one shows active in the palette. */
  private selectedNoteHasArticulation(type: ArticulationType): boolean {
    const engine = this.getEngine()
    if (this.state.selectedTool !== 'selection' || !engine) return false
    const noteId = this.state.selectedArticulationNoteId ?? this.state.selectedNoteId
    if (!noteId) return false
    return engine.getNote(noteId)?.articulations?.includes(type) ?? false
  }

  /**
   * True while ANY marking stamp is armed (articulation / accidental / tie). All three arm into
   * ENTRY mode but enter no note, so the `accent`/`staccato`/`tenuto` arm-for-next-note flags must
   * not light while one is live — they can be stale from an earlier note-entry session, and the
   * entry-mode fall-through in `noteHas*` would otherwise report them.
   */
  private markingStampArmed(): boolean {
    return this.state.selectedArticulationTools.length > 0
      || this.state.selectedAccidentalTool !== null
      || this.state.selectedTieTool
      || this.state.selectedDotTool
  }

  noteHasAccent(): boolean {
    // Stamp tool armed → ONLY the armed set lights; the leftover arm-for-next-note flags below must
    // not leak (they can be stale from an earlier note-entry session — hence the early return).
    if (this.state.selectedArticulationTools.length > 0) return this.state.selectedArticulationTools.includes('accent')
    if (this.markingStampArmed()) return false // an accidental/tie stamp: no articulation is in play
    if (this.state.selectedTool === 'selection') return this.selectedNoteHasArticulation('accent')
    return this.state.accent
  }

  noteHasStaccato(): boolean {
    if (this.state.selectedArticulationTools.length > 0) return this.state.selectedArticulationTools.includes('staccato')
    if (this.markingStampArmed()) return false
    if (this.state.selectedTool === 'selection') return this.selectedNoteHasArticulation('staccato')
    return this.state.staccato
  }

  noteHasTenuto(): boolean {
    if (this.state.selectedArticulationTools.length > 0) return this.state.selectedArticulationTools.includes('tenuto')
    if (this.markingStampArmed()) return false
    if (this.state.selectedTool === 'selection') return this.selectedNoteHasArticulation('tenuto')
    return this.state.tenuto
  }

  /**
   * Push which articulations are lit into the {@link articulationSelection} store, so the Keypad
   * reflects the note under the cursor (or the armed entry-mode flags). This is the RULE — the same
   * `noteHasX` the Vue palette buttons read — and it lives HERE, framework-agnostic, on purpose: the
   * Vue side only ever POKES this (on a selection/mode/arm change it cannot express as a store event);
   * it holds no logic of its own. So when the Vue palette is retired, this rule does not move — only
   * the poke does, onto a framework-agnostic selection observer.
   *
   * `setActive` short-circuits on an unchanged set, and a relight is a handful of `setAttribute`s on
   * the panel's buttons — never a score re-render. Called after every toggle (all sources funnel
   * through toggleAccent/Staccato/Tenuto) and on the Vue poke.
   */
  refreshArticulationSelection(): void {
    const active: ArticulationType[] = []
    if (this.noteHasAccent()) active.push('accent')
    if (this.noteHasStaccato()) active.push('staccato')
    if (this.noteHasTenuto()) active.push('tenuto')
    articulationSelection.setActive(active)
  }

  noteHasTie(): boolean {
    // While the tie stamp is armed the key lights because the TOOL is armed — the armed gesture is
    // what the Keypad shows, exactly as the armed articulation set lights during its stamp. Ahead
    // of the reads below, which would report the (cleared) note selection instead.
    if (this.state.selectedTieTool) return true
    // A tie selected in the score lights the key too, so it reads as removable from the Keypad.
    if (this.state.selectedTieFromNoteId) return true
    const engine = this.getEngine()
    if (!this.state.selectedNoteId || !engine) return false
    const note = engine.getNote(this.state.selectedNoteId)
    return !!note?.tiedTo
  }

  /**
   * Push whether the tie is lit into the {@link tieSelection} store, so the Keypad's Enter key reflects
   * the selected note. Like {@link refreshArticulationSelection}, the RULE ({@link noteHasTie}, reading
   * the engine's `tiedTo`) lives HERE, framework-agnostic — a note's tie is not a reactive field, so no
   * App.vue computed can mirror it. Called after every `toggleTie` (all sources funnel through it) and
   * on the Vue selection-change poke. `setHighlight` short-circuits on no change.
   */
  refreshTieSelection(): void {
    tieSelection.setHighlight(this.noteHasTie() ? 'tie' : null)
  }
}
