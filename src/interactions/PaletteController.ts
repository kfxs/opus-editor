import { dbg } from '@/utils/debug'
import type { ArticulationType, Accidental, NoteDuration, BeamMode, Clef, TimeSignature, Fraction, TupletFormat, TremoloMark, FanMark } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { ViewMode } from '../engine/rendering/layoutConfig'
import type { EditorState, DynamicTool, TempoTool, MarkingTool } from './EditorState'
import { activeVoiceToModel, armedTool, armedToolUsesLength, selectedOf, DEFAULT_DURATION, DEFAULT_DOTS, DEFAULT_BEAM } from './EditorState'
import { durationHighlight, beamHighlight, beamRoleHighlight, secondaryBreakHighlight, beamOverHighlight, tremoloHighlight, tremoloPairHighlight, fanHighlight } from './keypadSync'
import { fracToNumber } from '../utils/fraction'
import { DEFAULT_FAN_BEAMS, DEFAULT_FAN_COUNT, fanIsJoined, fanJoinSubdivides } from '../utils/fannedBeam'
import { resolveTupletInTimeOf, type TupletResolution } from '../utils/musicUtils'
import { accidentalTypeToKey, formatPitch } from '../utils/pitchSpelling'
import { sameTimeSignature } from '../utils/meter'
import { tempoLabel } from '../utils/tempoMap'
import { dynamicTextFromTool } from '../utils/dynamics'
import { selectedNoteIds, selectedArticulationNoteIds, multipleNotesSelected } from './selection'
import { featherSelectedNote, featherContext } from './fanStamp'
import { bus } from '@/bus'
import type { ArmedFanStamp } from '@/bus'
import { staffOf } from '@/utils/lanes'
import { A4_NORMAL, SKETCH_CANVAS } from '@/engine/layout/surface'

/** Re-exported so the palette's callers keep one import — the type belongs with the rule. */
export type { TupletResolution }

/** Two armed tempo presets are "the same button" when every field matches — so clicking the
 *  active preset a second time disarms it (the toggle behaviour of the other palette tools). */
function sameTempoTool(a: TempoTool | null, b: TempoTool): boolean {
  if (!a) return false
  return a.text === b.text && a.unit === b.unit && a.dots === b.dots
    && a.bpm === b.bpm && a.showMetronome === b.showMetronome
}

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

  /**
   * Arm `tool` — the ONE write path for every marking tool, and the point of {@link MarkingTool}.
   * Assigning the union IS the mutual exclusion: whatever was armed is gone by construction, so
   * there is no sibling list to keep in sync. That list, copied per tool, is what let a press arm
   * TWO tools (fixed in dac5f42) and what left `setClef` clearing only the three tools that existed
   * the day it was written.
   *
   * Also drops the note SELECTION and the on-score sub-selections, so the ghost reads unambiguously
   * as "the next click places/stamps this", switches to entry mode (the selection tool ignores
   * placement clicks), and previews the tool at once.
   *
   * …but only a selection. `selectedNoteId` is TWO things (see its own doc): the selection anchor in
   * selection mode, and the KEYBOARD CARET in entry mode. Clearing it unconditionally cleared both,
   * so arming a tool while typing took the caret down and dropped you out of keyboard entry —
   * collateral damage from a line aimed at the selection. Arming FROM entry mode keeps it: a caret
   * is not a selection, there is nothing ambiguous about it, and the ghost has nothing to do with
   * where the next typed note lands. You leave keyboard entry by placing something, not by picking
   * up a tool.
   *
   * In practice today this is the rest stamp: it is the only tool that arms from entry mode (the
   * other Keypad keys mean their note-entry value there — an accidental arms for the NEXT note
   * rather than stamping), plus the four positional tools when armed from a palette button mid-entry.
   */
  private armMarkingTool(tool: MarkingTool): void {
    this.state.selectedMarkingTool = tool
    if (this.state.selectedTool !== 'entry') this.state.selectedNoteId = null
    // ⭐ ONE assignment — the fourth of the four clear-lists, and the shortest: it named six fields
    // and so left a picked tie/slur/tuplet/dot/stem/tremolo selected under the new ghost.
    this.state.selectedElement = null
    this.state.selectedTool = 'entry'
    this.showArmedGhost()
  }

  /**
   * Disarm whatever is armed and fall back to SELECTION mode — what a re-press of an armed stamp
   * key does. The clef/TS/dynamic/tempo buttons disarm differently (they stay in entry mode); see
   * their own methods.
   */
  private disarmMarkingTool(): void {
    this.state.selectedMarkingTool = null
    this.state.selectedTool = 'selection'
    this.showArmedGhost() // repaints; the mode guard means no ghost is drawn
  }

  /**
   * Disarm but STAY in entry mode — what a re-press of the clef / TS / dynamic / tempo buttons does.
   * They predate the stamps and disarm differently: you fall back to note ENTRY (the old code only
   * ever set the mode inside its arm branch, so a disarm left it untouched), and the ghost note
   * returns. Preserved exactly; the difference from {@link disarmMarkingTool} is now stated in one
   * place instead of being implicit in eight copies of the same block.
   */
  private disarmToEntry(): void {
    this.state.selectedMarkingTool = null
    this.showArmedGhost()
  }

  /**
   * Ctrl+E with nothing selected: arm the click-to-type expression-entry tool. Routes through the
   * one arm path like every other tool, so it clears the others by construction. Unlike the
   * dynamics-palette custom-text button (`{ kind:'dynamic'; dynamic:'text' }`, which ghosts a
   * placeholder and drops it on click), this previews NO ghost — a blue cursor signals placement —
   * and the placing click opens the inline editor BLANK (MouseController.placeDynamicEntryAtClick).
   */
  armDynamicEntry(): void {
    this.armMarkingTool({ kind: 'dynamicEntry' })
  }

  /**
   * Ctrl+Alt+T with nothing selected: arm the click-to-type tempo-entry tool. The tempo twin of
   * {@link armDynamicEntry} — no ghost, blue cursor, and the placing click opens the tempo edit box
   * BLANK (MouseController.placeTempoEntryAtClick).
   */
  armTempoEntry(): void {
    this.armMarkingTool({ kind: 'tempoEntry' })
  }

  /**
   * Does the selection hold any note or rest?
   *
   * THE STAMP RULE: a stamp arms only when it does NOT — "we go to stamp mode when the selection is
   * not a note, a rest, or a group of notes". A stamp is for marking things you have not selected;
   * the moment you HAVE selected something note-like, the press is about that, and turning it into a
   * stamp throws your selection away to answer a question you did not ask.
   *
   * The subtle half is the REST. `applyAccidentalToSelection` / `applyArticulationToSelection`
   * return false for TWO different situations — nothing selected, and a selection of rests, which
   * take neither mark — and the callers used to read both as "arm the stamp". So selecting a rest
   * and pressing ♯ armed the stamp and dropped the rest, when what you were almost certainly doing
   * was building the note that rest is about to become (select a rest, press ♯, press a letter).
   *
   * Decided by the selection SET, not the `selectedNoteId` anchor: after note entry, Select/Esc
   * leaves the cursor note in the anchor with an EMPTY set, which reads as "nothing selected".
   */
  private selectionHoldsNotes(): boolean {
    return selectedNoteIds(this.state.selectedItems.values()).length > 0
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
    const range = selectedOf(this.state, 'measureRange')
    if (!range || range.boxStyle !== 'double') return null
    return { lo: Math.min(range.anchor, range.focus), hi: Math.max(range.anchor, range.focus) }
  }

  /** Add one empty measure immediately BEFORE the box-selected span. Keeps the box on
   *  the same musical bars (they shift up by one). No-op unless a measure is selected. */
  addMeasureBefore(): void {
    const engine = this.getEngine()
    const ctx = this.measureContext()
    if (!engine || !ctx) {
      dbg('Add measure before: no measure selected (Ctrl+Shift+click a bar first)')
      return
    }
    engine.insertMeasureAfter(ctx.lo - 1) // 0 = insert at the very front
    const box = selectedOf(this.state, 'measureRange')
    if (box) {
      // The selected bars moved forward by one; follow them so repeat clicks stack.
      this.state.selectedElement = { ...box, anchor: box.anchor + 1, focus: box.focus + 1 }
    }
    dbg(`✓ Added measure before ${ctx.lo}`)
    this.renderScore()
  }

  /** Add one empty measure immediately AFTER the box-selected span. The selected bars
   *  keep their numbers. No-op unless a measure is selected. */
  addMeasureAfter(): void {
    const engine = this.getEngine()
    const ctx = this.measureContext()
    if (!engine || !ctx) {
      dbg('Add measure after: no measure selected (Ctrl+Shift+click a bar first)')
      return
    }
    engine.insertMeasureAfter(ctx.hi)
    dbg(`✓ Added measure after ${ctx.hi}`)
    this.renderScore()
  }

  /**
   * The reference staff the "Staff:" buttons act on: the 0-based staff of a PLAIN-click
   * bar selection (the SINGLE box). Null otherwise — staff add is now driven by the plain-
   * click passage select, NOT the Ctrl+Shift measure-span box (which is reserved for the
   * "Add Measure" ops), so the two structure edits stay separate gestures.
   */
  private staffContext(): number | null {
    const box = selectedOf(this.state, 'measureRange')
    return box && box.boxStyle === 'single' ? box.staff : null
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
    const slur = selectedOf(this.state, 'slur')
    if (slur) this.state.selectedElement = { kind: 'slur', id: slur.id }
    this.renderScore()
  }

  /**
   * Stretch the last system to the page width, or leave it ragged (LilyPond's `ragged-last`).
   * A layout knob, so it goes through the same path as the view mode: engine first, state second,
   * one render — which is also the highlight pass.
   */
  setJustifyLastLine(justify: boolean): void {
    const engine = this.getEngine()
    if (!engine || engine.getJustifyLastLine() === justify) return
    engine.setJustifyLastLine(justify)
    this.state.justifyLastLine = justify
    this.renderScore()
  }

  /**
   * Draw on a PAGE (A4 at normal margins) or on the sketching canvas — docs/layout-plan.md.
   *
   * The same path as the two knobs above it, and the same reason: the engine holds the truth (a
   * `Surface`, not a boolean), the state carries the toolbar's mirror of it, and one render follows
   * — which is also the highlight pass. ⭐ The boolean is mapped to a surface HERE rather than
   * stored as one on the engine: two representations of the same fact, one of which can only say
   * "on or off", is how they drift.
   */
  setUseLayout(useLayout: boolean): void {
    const engine = this.getEngine()
    if (!engine) return
    if ((engine.getSurface().kind === 'page') === useLayout) return
    engine.setSurface(useLayout ? A4_NORMAL : SKETCH_CANVAS)
    this.state.useLayout = useLayout
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
   * user had selected. The box's `staff` is a raw index into `score.staves`, and inserting
   * a staff shifts every index at/below the insertion point — so an "+ Above" would leave the
   * selection pointing at the freshly inserted staff instead of the one that was selected. Fix
   * generally: resolve the selected staff to its stable id before the insert, then restore its
   * (possibly shifted) index after. Index-free, so it survives future reorder/remove too.
   */
  private addStaffRelative(position: 'above' | 'below'): void {
    const engine = this.getEngine()
    const ref = this.staffContext()
    if (!engine || ref === null) {
      dbg(`Add staff ${position}: no bar selected (click empty space in a bar first)`)
      return
    }
    const selectedId = engine.getScore().staves?.[ref]?.id
    if (position === 'above') engine.addStaffAbove(ref)
    else engine.addStaffBelow(ref)
    // Re-anchor the box to the originally-selected staff by id (its index may have shifted).
    const box = selectedOf(this.state, 'measureRange')
    if (selectedId !== undefined && box) {
      const idx = engine.getScore().staves?.findIndex(s => s.id === selectedId) ?? -1
      if (idx >= 0) this.state.selectedElement = { ...box, staff: idx }
    }
    dbg(`✓ Added staff ${position} staff ${ref}`)
    this.renderScore()
  }

  setDuration(duration: NoteDuration): void {
    // …unless the armed tool USES the length, in which case the press is not "enter notes", it is
    // "make the armed rest a different length". The tool stays armed and its ghost restacks — the
    // one tool a duration press does not end. Dots clear as they do on any fresh duration press, so
    // the dotted-rest flow is the dotted-note flow: press the duration, then the dot.
    if (armedToolUsesLength(this.state)) {
      this.state.selectedDuration = duration
      this.state.selectedDots = 0
      this.state.armedTuplet = null
      const pos = this.getLastMousePosition()
      if (pos) this.renderArmedGhost(pos)
      return
    }

    // A duration press means "enter notes", so whatever marking tool was armed gives way — after
    // any value it holds is carried into note entry. ONE call does both (and is the only clear):
    // this used to be four separate resets which between them still forgot the tempo tool.
    this.state.selectedDots = this.promoteStampToNoteEntry()
    this.state.selectedDuration = duration
    this.state.armedTuplet = null
    const engine = this.getEngine()
    if (this.state.selectedNoteId && engine && this.state.selectedTool === 'selection') {
      const before = engine.getNote(this.state.selectedNoteId)
      engine.updateNote(this.state.selectedNoteId, { duration, dots: 0 })
      if (before && !before.isRest) {
        const pitch = formatPitch(before)
        const oldDur = `${before.duration}${'.'.repeat(before.dots ?? 0)}`
        dbg(`[Duration] ${pitch} | ${oldDur} → ${duration}`)
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
    const armed = this.state.selectedMarkingTool

    // (0) THIS stamp is already live: swap the armed sign, or disarm on a re-press. The swap must
    // redraw the ghost on the KEYPRESS (♯→♭), not on the next mouse move, or the armed tool and
    // what you see disagree; a disarm draws nothing (showArmedGhost checks the mode).
    if (armed?.kind === 'accidental') {
      if (accidental === null || accidental === armed.sign) this.disarmMarkingTool()
      else {
        this.state.selectedMarkingTool = { kind: 'accidental', sign: accidental }
        this.showArmedGhost()
      }
      return
    }

    // A DIFFERENT marking tool is armed → switch to this one. ONE check: the union has no sibling
    // list to enumerate, so this cannot go stale when a ninth tool appears — which is exactly how
    // the old version let a press arm two tools at once.
    if (armed) {
      this.armAccidentalTool(accidental)
      return
    }

    // A standalone accidental glyph is selected in the score → the press EDITS it: the same
    // accidental (or a null "remove") deletes it; a different one changes it.
    if (selectedOf(this.state, 'accidental')) {
      this.editSelectedAccidental(accidental)
      return
    }

    // Selection mode: (1) apply across a real selection…
    if (this.state.selectedTool === 'selection') {
      if (this.applyAccidentalToSelection(accidental)) return
      // (2) …or arm the stamp — but ONLY with nothing note-like selected (see selectionHoldsNotes).
      if (!this.selectionHoldsNotes()) {
        this.armAccidentalTool(accidental)
        return
      }
      // (2b) A REST is selected: it takes no accidental, but it is about to become a note, so the
      // press arms for THAT and the rest stays selected. Falls through to the entry-mode arm below —
      // the same toggle, and the Keypad lights it either way (the accidental highlight reads
      // `selectedAccidental` whenever a note or rest is selected).
    }

    // (3) Entry mode — or a selected rest: arm/toggle the accidental for the NEXT note entered.
    this.state.selectedAccidental = this.state.selectedAccidental === accidental ? null : accidental
    // No ghost while a rest is selected: we are in SELECTION mode, and a ghost note at the pointer
    // would claim the next click enters one. renderArmedGhost is the entry-mode preview.
    if (this.state.selectedTool !== 'entry') return
    const pos = this.getLastMousePosition()
    if (pos) this.renderArmedGhost(pos)
  }

  /**
   * Edit the standalone accidental glyph currently selected in the score (see
   * {@link SelectedElement}'s `accidental`). Pressing the SAME accidental — or a null "remove"
   * — deletes it (reverts the note to the measure's prevailing alteration, exactly like the Delete
   * key); pressing a DIFFERENT accidental changes it. After a change the new accidental stays
   * selected so it can be changed again or removed; after a delete NOTHING stays selected — the
   * gesture is a Keypad switch-off, so (unlike the Delete key, which keeps the note selected to keep
   * editing) we clear the selection outright, or the Keypad would light a stray duration for a note
   * the user can't see selected.
   */
  private editSelectedAccidental(accidental: Accidental | null): void {
    const engine = this.getEngine()
    const selected = selectedOf(this.state, 'accidental')
    const noteId = selected?.noteId
    if (!engine || !noteId) return

    const current = accidentalTypeToKey(selected.type)
    if (accidental === null || accidental === current) {
      // Remove: revert to the prevailing alteration so the glyph disappears in every case.
      engine.runBatch('Remove accidental', () =>
        engine.updateNote(noteId, { alter: engine.getPrevailingAlter(noteId), forceAccidental: undefined }))
      this.state.selectedElement = null
      this.selectNote(null) // switch-off leaves nothing selected (clears the note anchor too)
      this.renderScore()
    } else {
      engine.runBatch(`Set ${accidental}`, () => engine.setNoteAccidental(noteId, accidental))
      // Keep the (now changed) accidental selected — REASSIGNED, never mutated in place.
      this.state.selectedElement = { kind: 'accidental', noteId, type: accidental }
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
   * Arm `accidental` as the accidental stamp tool. A null accidental (a palette "remove" with
   * nothing selected) is a no-op — there is nothing to arm.
   */
  private armAccidentalTool(accidental: Accidental | null): void {
    if (accidental === null) return
    this.armMarkingTool({ kind: 'accidental', sign: accidental })
  }

  /**
   * One tremolo-palette press — one to five strokes, or the Penderecki sign — routed by context,
   * exactly as {@link setAccidental} and {@link pressArticulation} are. ⭐ THE MARK IS FOUR
   * GESTURES on one button, and which one you get is decided by what you are doing:
   *
   *  0. THIS stamp is already armed → a re-press DISARMS, a different mark SWAPS it (single-valued:
   *     a note carries one tremolo). A DIFFERENT tool armed → switch to the tremolo stamp.
   *  1. A standalone MARK is selected in the score → the press EDITS it: a different mark changes
   *     it, the same mark removes it ({@link editSelectedTremolo}).
   *  2. Selection mode with notes selected → apply across the selection, add / change / remove, as
   *     ONE undoable action ({@link applyTremoloToSelection}).
   *  3. Selection mode with NOTHING to apply to → arm the STAMP, whose next click marks a note.
   *  4. Note entry → arm the mark for the notes you are about to WRITE: the ghost wears it and every
   *     click enters a note carrying it (docs/tremolo-plan.md §10). `selectedTremolo` is a note-entry
   *     value beside the accidental and the dots — NOT a marking tool, because a tool would replace
   *     note entry with stamping.
   *
   * The ghost is redrawn on the KEYPRESS, not on the next mouse move, or what is armed and what you
   * see disagree.
   *
   * ⚠️ The entry mark PERSISTS — entering a note does not clear it, and neither does a duration
   * press (see `promoteStampToNoteEntry`, which also carries an armed STAMP over when you pick a
   * duration: "mark, then length" and "length, then mark" arrive at the same place). Esc clears it
   * with the rest of the armed entry values.
   */
  pressTremolo(tremolo: TremoloMark): void {
    // The score-editing branches below change the MARK without changing the selection, so the
    // observable Proxy may never emit and `sync()` may never run — push the lights ourselves, the
    // way `setBeam` does. Cheap and idempotent, so it is done once here for every branch.
    try {
      this.pressTremoloRouted(tremolo)
    } finally {
      this.refreshTremoloSelection()
      this.refreshTremoloPairSelection()
    }
  }

  private pressTremoloRouted(tremolo: TremoloMark): void {
    const armed = this.state.selectedMarkingTool

    // (0) THIS stamp is live: swap the armed mark, or disarm on a re-press.
    if (armed?.kind === 'tremolo') {
      if (armed.tremolo === tremolo) this.disarmMarkingTool()
      else {
        this.state.selectedMarkingTool = { kind: 'tremolo', tremolo }
        this.showArmedGhost()
      }
      return
    }
    // A DIFFERENT marking tool is armed → switch to this one. ONE check (see setAccidental).
    if (armed) {
      this.armMarkingTool({ kind: 'tremolo', tremolo })
      return
    }

    // (1) The MARK itself is selected on the score → change or remove it. Ahead of (2), whose
    // applyTremoloToSelection would return false (clicking the strokes clears the note selection)
    // and wrongly arm the stamp.
    if (selectedOf(this.state, 'tremolo')) {
      this.editSelectedTremolo(tremolo)
      return
    }

    if (this.state.selectedTool === 'selection') {
      // (2) …apply across a real selection…
      if (this.applyTremoloToSelection(tremolo)) return
      // (3) …or arm the stamp, but ONLY with nothing note-like selected (see selectionHoldsNotes).
      if (!this.selectionHoldsNotes()) {
        this.armMarkingTool({ kind: 'tremolo', tremolo })
        return
      }
      // A REST is selected: it takes no tremolo, but it is about to become a note, so the press arms
      // for THAT and the rest stays selected. Falls through to the entry-mode arm below — the same
      // reasoning the accidental's (2b) and the articulation's (2c) branches use.
    }

    // (4) Entry mode — or a selected rest: arm/toggle the mark for the next note entered.
    this.state.selectedTremolo = this.state.selectedTremolo === tremolo ? null : tremolo
    // No ghost while a rest is selected: we are in SELECTION mode, and a ghost note at the pointer
    // would claim the next click enters one. renderArmedGhost is the entry-mode preview.
    if (this.state.selectedTool !== 'entry') return
    const pos = this.getLastMousePosition()
    if (pos) this.renderArmedGhost(pos)
  }

  /**
   * ⭐ The TWO-NOTE tremolo — one button, pressed on the FIRST note of the pair
   * (docs/two-note-tremolo-plan.md §0). The note and the one after it alternate, and both are drawn
   * at DOUBLE their written value.
   *
   * ONE note, not a selection: the mark is a RELATION between this note and its neighbour, so
   * "apply it across five notes" has no reading — which of them are pairs? The press acts on the
   * selected tremolo MARK if one is selected (pressing the pair on a note wearing stem strokes keeps
   * the count and moves the strokes between the stems — the same mark re-read), otherwise on the one
   * selected note. Anything else — nothing selected, several notes, a rest — is a no-op.
   *
   * A re-press REMOVES it, the toggle every other palette button has. Removal takes the stroke count
   * with it: the pair is ONE mark, and half of it is not a notation (§4).
   *
   * The press is REFUSED — nothing happens, and no undo entry is made — whenever the pair is not a
   * pair: no next note, a rest, a different value, a different tuplet/voice/staff/bar, two whole
   * notes, an authored beam on either, or either slot already in a pair. That list lives once, in
   * `pairIsValid`; this only reports what the model answered.
   */
  pressTremoloPair(): void {
    const engine = this.getEngine()
    if (!engine) return

    const noteId = selectedOf(this.state, 'tremolo')?.noteId ?? this.singleSelectedNoteId()
    if (!noteId) return
    const note = engine.getNote(noteId)
    if (!note || note.isRest) return

    const on = !note.tremoloPair
    const applied = engine.runBatch(on ? 'Two-note tremolo' : 'Remove two-note tremolo', () => {
      engine.setTremoloPair(noteId, on)
    })
    // Same reason as `pressTremolo`: the score changed, the selection did not.
    this.refreshTremoloSelection()
    this.refreshTremoloPairSelection()
    if (!applied) return
    // Taking the mark off leaves nothing to keep selected — the same shape editSelectedTremolo has.
    if (!on && selectedOf(this.state, 'tremolo')) {
      this.state.selectedElement = null
      this.selectNote(null)
    }
    this.renderScore()
  }

  /**
   * ⭐ The FANNED (feathered) beam — `accel.` / `rit.` (docs/fanned-beams-plan.md §3, P2).
   *
   * **The time is already entered.** The press acts on notes that exist: it turns each selected note
   * into a group that speeds up or slows down across exactly that note's own duration, so nothing
   * else in the bar moves, because nothing else in the bar changed. There is no armed stamp and no
   * note-entry form — with nothing selected the press is a no-op rather than arming a tool, because
   * a fan has nothing to be applied to until there is a note under it.
   *
   * ⭐⭐ **SEVERAL NOTES SELECTED MEANS ONE GESTURE, NOT SEVERAL** (his ask): type the seven notes
   * you want, select them, press `accel.`, and they COLLAPSE into one fanned slot spanning exactly
   * the time they spanned, with seven attacks at the pitches you typed
   * (`engine/models/fanCollapse.ts`). It used to mark each of them separately — seven one-note fans
   * — and that reading is gone rather than kept beside this one: a gesture means one thing, and
   * "fan these seven" is much more plainly a request for one group than for seven.
   *
   * ⚠️ So a selection the collapse REFUSES (a rest inside, a gap, two bars, two voices, an existing
   * fan — its list) does NOTHING here, rather than falling back to marking them one by one. A
   * fallback would answer a question nobody asked, in the shape the old reading had.
   *
   * The direction is decided for the selection AS A WHOLE, the rule {@link applyTremoloToSelection}
   * follows: if every selected note already carries a fan in this direction it comes off all of them,
   * otherwise the press applies. So `accel.` on plain notes fans them, `rit.` turns a fan round, and
   * `rit.` again clears it — and CLEARING stays per-note, because taking a mark off several notes is
   * not a gesture that needs them to be a passage. ⭐ **Turning one round KEEPS it** — see
   * {@link markFor} below; the collapse is likewise only offered when nothing selected is a fan
   * already, or "turn these two round" would be read as "make one group of them" and refused.
   *
   * Rests, tuplet members and FANNED MEMBERS are skipped rather than refused — a passage is a
   * mixture, and you meant the notes in it that can take one. `ScoreModel.setFan` owns that list;
   * this only reports what the model answered.
   *
   * ⚠️ The member has to be filtered OUT, not merely left to be refused, because it also votes in
   * the all-or-nothing read below: a selection of one fanned note plus one of its own members would
   * otherwise answer "not everything has it" (a member reports no fan — `getNote`) and the press
   * that should have CLEARED the fan would re-set it at the default shape instead.
   */
  pressFan(direction: 'accel' | 'rit'): void {
    const engine = this.getEngine()
    if (!engine || !this.state.selectedNoteId) return

    const ids = selectedNoteIds(this.state.selectedItems.values())
      .filter(id => {
        const note = engine.getNote(id)
        return note && !note.isRest && !engine.isFanMember(id)
      })
    if (ids.length === 0) return

    // Read every mark BEFORE anything is written: each press below rebuilds a fan FROM the one that
    // is there, and `setFan` replaces the object it reads.
    const marks = new Map(ids.map(id => [id, engine.getNote(id)?.fan]))
    const allHaveIt = ids.every(id => marks.get(id)?.direction === direction)

    // The passage case: several notes, NONE of them fanned at all ⇒ ONE group.
    //
    // ⚠️ `!anyFanned`, not merely `!allHaveIt`: two `accel` fans and a press of `rit` is a request to
    // turn them round, and the collapse would refuse it (a fan cannot be collapsed into a fan), so
    // the press would silently do nothing at all.
    if (!allHaveIt && ids.length > 1 && ![...marks.values()].some(Boolean)) {
      const survivorId: string[] = []
      const applied = engine.runBatch(`Fanned beam ${direction}`, () => {
        const note = engine.collapseIntoFan(ids, direction)
        if (note) survivorId.push(note.id)
      })
      if (!applied) return // refused — see the note above: the press does nothing at all
      // Nothing to select but the note that is left — the others are members of it now, and the
      // multi-selection they made up refers to slots the bar no longer has.
      if (survivorId[0]) this.selectNote(survivorId[0])
      this.renderScore()
      return
    }

    /**
     * ⭐⭐ **TURNING A FAN ROUND CHANGES ONE FIELD.** `rit` on an `accel` used to hand `setFan` a
     * freshly built default mark, which threw away everything the group had become: his report —
     * *"I create a fan with different notes, accidental alteration and everything… now if I change
     * to rit I lose all the fan data, it just makes a plain fan with plain notes."* The count, the
     * beams, the spread, the ramp range, the collapsed span and — since members carry their own
     * pitches, accidentals and articulations — the music itself.
     *
     * Direction is one field of the mark, so the press writes one field of the mark. The spread
     * keeps the member ARRAYS by identity through `normalizeFan`, which is what keeps every pitch
     * id alive: a selection, a slur anchored on a member, an authored offset all survive the turn.
     *
     * Only a note with NO fan gets the default shape — that press is a creation, not an edit. It is
     * the same distinction `FanEditController` already makes (it spreads too, after silently
     * dropping members on every typed count once).
     */
    const markFor = (id: string): FanMark | null => {
      if (allHaveIt) return null
      const current = marks.get(id)
      return current
        ? { ...current, direction }
        : { direction, count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS }
    }
    const applied = engine.runBatch(allHaveIt ? 'Remove fanned beam' : `Fanned beam ${direction}`, () => {
      for (const id of ids) engine.setFan(id, markFor(id))
    })
    if (!applied) return
    engine.updateUndoNoteId(this.state.selectedNoteId)
    this.renderScore()
  }

  /**
   * ⭐ THE KEYPAD'S BEAM KEYS RESTYLE A TWO-NOTE TREMOLO, and this is the router. Returns true when
   * the press was spent that way, so {@link setBeam} does nothing else with it.
   *
   * It is the same axis those keys already control, not a second meaning bolted on: a pair is never
   * in an automatic group, so on a pair the beam keys have never been about *which notes beam
   * together* — they say how the pair's own lines are DRAWN. `single` already meant "draw them apart,
   * flags and all" on a pair of sixteenths (§2). This adds the other end of the same question, on the
   * one value where it is open:
   *
   * | drawn value | `single` | `begin` |
   * |---|---|---|
   * | blanca (from quarters) | strokes OPEN, floating clear of the stems | strokes JOINED to both stem tips |
   * | corchea or shorter | drawn APART, each note keeping its flag | (nothing — it beams itself) |
   *
   * ⚠️ It writes `tremoloPairStyle`, NEVER `beam`. An authored beam role is inert on a paired slot
   * (the grouper breaks there) but would come alive the moment the mark came off — a note left
   * silently carrying `begin` from a tremolo it no longer has. Storing the choice where it belongs
   * means there is nothing to clean up on that side, and the one thing that DOES need clearing —
   * `tremoloPairStyle` itself — is cleared with the mark in `ScoreModel` (his catch).
   */
  private routeBeamToTremoloPairStyle(beam: BeamMode): boolean {
    if (beam !== 'begin' && beam !== 'single') return false
    const engine = this.getEngine()
    const noteId = this.tremoloPairStyleTarget()
    if (!engine || !noteId) return false

    const style = beam === 'begin' ? 'joined' : 'open'
    if (engine.runBatch(`Tremolo strokes ${style}`, () => { engine.setTremoloPairStyle(noteId, style) })) {
      this.renderScore()
    }
    this.refreshBeamSelection()
    return true
  }

  /**
   * The note whose two-note tremolo a style press would act on, or null when there is none — the
   * selected MARK, or the one selected note.
   *
   * Only answers for a pair that ACCEPTS the choice (a drawn BLANCA), so `begin`/`single` fall
   * through to ordinary beaming everywhere else rather than silently writing a setting that is not
   * read. Refusing where the choice would change the reading is the point of the restriction, not an
   * omission.
   */
  private tremoloPairStyleTarget(): string | null {
    const engine = this.getEngine()
    if (!engine) return null
    const noteId = selectedOf(this.state, 'tremolo')?.noteId ?? this.singleSelectedNoteId()
    if (!noteId) return null
    const note = engine.getNote(noteId)
    if (!note?.tremoloPair) return null
    // The model owns the eligibility rule; asking it with a no-op write would be an edit, so ask
    // through the same predicate it uses.
    return engine.tremoloPairAcceptsJoined(noteId) ? noteId : null
  }

  /** The one selected note, or null when nothing / a rest / more than one is selected. */
  private singleSelectedNoteId(): string | null {
    const engine = this.getEngine()
    if (!engine || !this.state.selectedNoteId) return null
    const ids = selectedNoteIds(this.state.selectedItems.values())
      .filter(id => {
        const note = engine.getNote(id)
        return note && !note.isRest
      })
    return ids.length === 1 ? ids[0] : null
  }

  /**
   * Edit the tremolo currently selected in the score (see {@link SelectedElement}'s `tremolo`):
   * a DIFFERENT mark changes it, the SAME mark removes it. The twin of
   * {@link editSelectedAccidental}, including what is left selected afterwards — a change keeps the
   * (now different) mark selected so it can be changed again or removed, while a removal leaves
   * nothing selected, because there is no longer a mark to select.
   */
  private editSelectedTremolo(tremolo: TremoloMark): void {
    const engine = this.getEngine()
    const noteId = selectedOf(this.state, 'tremolo')?.noteId
    if (!engine || !noteId) return

    if (engine.getNote(noteId)?.tremolo === tremolo) {
      engine.runBatch('Remove tremolo', () => engine.setTremolo(noteId, null))
      this.state.selectedElement = null
      this.selectNote(null)
    } else {
      engine.runBatch(`Set tremolo ${tremolo}`, () => engine.setTremolo(noteId, tremolo))
    }
    this.renderScore()
  }

  /**
   * Apply a tremolo across the whole selection as ONE undoable action — add, change, or remove.
   * Returns false when there is nothing to apply to (not in selection mode, or no non-rest note in
   * the selection SET — see the note-entry cursor caveat on {@link setAccidental}), so the caller
   * arms the stamp instead.
   *
   * Group semantics are {@link applyArticulationToSelection}'s, and the direction is decided for the
   * selection AS A WHOLE: if every selected note already carries this exact mark it is removed from
   * all of them, otherwise it is set on all of them. So one key adds, changes and removes — press 3
   * over plain notes to mark them, press 5 to change them, press 5 again to clear them. Rests are
   * skipped rather than refused: a passage is a mixture, and you meant the notes in it.
   */
  private applyTremoloToSelection(tremolo: TremoloMark): boolean {
    const engine = this.getEngine()
    if (this.state.selectedTool !== 'selection' || !this.state.selectedNoteId || !engine) return false

    const ids = selectedNoteIds(this.state.selectedItems.values())
      .filter(id => {
        const note = engine.getNote(id)
        return note && !note.isRest
      })
    if (ids.length === 0) return false

    const allHaveIt = ids.every(id => engine.getNote(id)?.tremolo === tremolo)
    engine.runBatch(allHaveIt ? 'Remove tremolo' : `Set tremolo ${tremolo}`, () => {
      for (const id of ids) engine.setTremolo(id, allHaveIt ? null : tremolo)
    })
    engine.updateUndoNoteId(this.state.selectedNoteId)
    this.renderScore()
    return true
  }

  /**
   * A duration press ends the armed marking tool — but two of the four stamps have somewhere to GO
   * first: their armed value becomes the NOTE-ENTRY armed value, which is the "accidental +
   * duration" and "dot + duration" (dotted quarter) flows. Returns the dots to arm, because
   * {@link setDuration}'s own reset would otherwise eat the dot promotion.
   *
   * Every kind is listed rather than defaulted, so a NINTH tool cannot be added without deciding
   * here whether it has an entry-mode home — the compiler asks.
   */
  private promoteStampToNoteEntry(): number {
    const armed = this.state.selectedMarkingTool
    this.state.selectedMarkingTool = null // whatever it was, a duration press disarms it
    switch (armed?.kind) {
      case 'articulation':
        this.state.accent = armed.types.includes('accent')
        this.state.staccato = armed.types.includes('staccato')
        this.state.tenuto = armed.types.includes('tenuto')
        return 0
      case 'accidental':
        this.state.selectedAccidental = armed.sign
        return 0
      case 'dot':
        return 1 // the ONLY promotion that carries dots; a plain press must still clear a stale one
      case 'rest':
        // UNREACHABLE: setDuration returns before this for any tool that uses the armed length —
        // a duration press retunes the armed rest rather than ending it. Listed because the switch
        // is exhaustive, and answering "no entry-mode home" is also the truth: the rest tool has
        // nowhere to be promoted TO. Placing rests with the mouse is not a property of a note.
        return this.state.selectedDots
      case 'tremolo':
        // The mark HAS an entry-mode home now (§10): pick a duration with a tremolo stamp armed and
        // you get note entry wearing that mark — "mark, then length" reaching the same place as
        // "length, then mark". Its own field, not `selectedDots`, so it returns 0 like the rest.
        this.state.selectedTremolo = armed.tremolo
        return 0
      case 'fan':
        // It HAS a length, unlike the four below — and still promotes nothing. The feather's length
        // is the GESTURE's, typed in the dialog that armed it; a duration press is a statement about
        // the next NOTE, and it already carries the value it wants. Retuning the feather from a key
        // would also make the dialog's answer overrulable from outside it, which is the thing the
        // tool carrying its own length exists to prevent (see MarkingTool's `fan` member).
        return 0
      case 'tie':          // valueless — there is no armed entry-mode tie to become
      case 'slur':         // valueless too: a slur is a span between notes, not a property of one
      case 'hairpin':      // a span as well — and its length is the MUSIC's, never the armed one
      case 'trill':        // an ornament ON a note, whose extent is the ties' — nothing to carry
      case 'clef':         // the four below place OBJECTS, not note properties: nothing to carry
      case 'timeSignature':
      case 'dynamic':
      case 'dynamicEntry': // places a text mark, not a note property — nothing to promote to
      case 'tempo':
      case 'tempoEntry':   // places a tempo mark — nothing to promote to (like `tempo`)
      case undefined:      // nothing was armed: a plain duration press, which clears a stale dot
        // Dropping a stale accidental here is deliberate: an INTENTIONAL one arms the stamp (and so
        // lands in the 'accidental' case above), meaning one that survives to here can only be left
        // over from an earlier note-entry session.
        this.state.selectedAccidental = null
        return 0
    }
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
    const armed = this.state.selectedMarkingTool

    // (2a) THIS stamp is already live (we are in entry mode): ADD this articulation to the armed
    // set, or REMOVE it if already armed; when the set empties, disarm back to selection. Handled
    // first so the entry-mode note-entry arm in (3) never swallows it. The ghost restacks on the
    // KEYPRESS; a disarm draws nothing (showArmedGhost checks the mode).
    if (armed?.kind === 'articulation') {
      const next = armed.types.includes(type)
        ? armed.types.filter(t => t !== type)
        : [...armed.types, type]
      if (next.length === 0) this.disarmMarkingTool()
      else {
        this.state.selectedMarkingTool = { kind: 'articulation', types: next }
        this.showArmedGhost()
      }
      this.refreshArticulationSelection()
      return
    }

    // A DIFFERENT marking tool is armed → switch to this one. ONE check (see setAccidental).
    if (armed) {
      this.armArticulationTool([type])
      this.refreshArticulationSelection()
      return
    }

    // A standalone articulation GROUP is selected in the score → the press EDITS it: additively
    // toggle this articulation on the group (add if missing, remove if present). Mirrors the
    // accidental-glyph editing, but additive (a note can carry several articulations). Handled
    // before the branch below, whose applyArticulationToSelection would return false (no note
    // selected) and wrongly arm the stamp.
    if (selectedOf(this.state, 'articulation')) {
      this.editSelectedArticulation(type)
      this.refreshArticulationSelection()
      return
    }

    // Selection mode: (1) apply across a real selection…
    if (this.state.selectedTool === 'selection') {
      if (this.applyArticulationToSelection(type)) {
        this.refreshArticulationSelection()
        return
      }
      // (2b) …or arm the stamp — but ONLY with nothing note-like selected (see selectionHoldsNotes).
      if (!this.selectionHoldsNotes()) {
        this.armArticulationTool([type])
        this.refreshArticulationSelection()
        return
      }
      // (2c) A REST is selected: it takes no articulation, but it is about to become a note, so the
      // press arms for THAT and the rest stays selected. Falls through to the entry-mode arm below.
    }

    // (3) Entry mode — or a selected rest: arm/disarm for the next note entered.
    if (type === 'accent') this.state.accent = !this.state.accent
    else if (type === 'staccato') this.state.staccato = !this.state.staccato
    else this.state.tenuto = !this.state.tenuto
    // No ghost while a rest is selected: we are in SELECTION mode, and a ghost note at the pointer
    // would claim the next click enters one. renderArmedGhost is the entry-mode preview.
    if (this.state.selectedTool === 'entry') {
      const pos = this.getLastMousePosition()
      if (pos) this.renderArmedGhost(pos)
    }
    this.refreshArticulationSelection()
  }

  /** Arm `types` as the articulation stamp tool. Further presses grow/shrink the armed set
   *  (see {@link pressArticulation}). */
  private armArticulationTool(types: ArticulationType[]): void {
    this.armMarkingTool({ kind: 'articulation', types })
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
   * {@link SelectedElement}'s `articulation`) from the Keypad: additively toggle `type` on
   * them. Group-toggle semantics like {@link applyArticulationToSelection} — if EVERY selected group
   * already has it, remove from all; else add to all. When a group is left with NO articulations it
   * has nothing to keep selected, so once ALL selected groups are empty the selection is cleared
   * (nothing highlighted), matching the accidental switch-off. (Del still clears a whole group.)
   */
  private editSelectedArticulation(type: ArticulationType): void {
    const engine = this.getEngine()
    if (!engine) return
    const ids = selectedArticulationNoteIds(this.state.selectedItems.values())
    const anchor = selectedOf(this.state, 'articulation')?.noteId
    const noteIds = ids.length ? ids : (anchor ? [anchor] : [])
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
      this.state.selectedElement = null
      this.selectNote(null)
    }
    this.renderScore()
  }

  /**
   * One tie-key press (the Keypad's Enter), routed by context — the same split as
   * {@link setAccidental} / {@link pressArticulation}, minus their entry-mode arm: there is no
   * armed entry-mode tie (see {@link bus.tie}), so entry mode keeps its old meaning.
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

    const armedTool_ = this.state.selectedMarkingTool

    // (0) The tie stamp is live → the key toggles it off, back to selection mode.
    if (armedTool_?.kind === 'tie') {
      this.disarmMarkingTool()
      this.refreshTieSelection()
      return
    }

    // A DIFFERENT marking tool is armed → switch to this one. ONE check (see setAccidental).
    if (armedTool_) {
      this.armTieTool()
      return
    }

    // (1) A tie is selected in the score → the press removes it.
    if (selectedOf(this.state, 'tie')) {
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
    // …and with nothing to tie, ARM THE STAMP — the same answer selection mode gives at (2)/(3).
    // In entry mode `selectedNoteId` IS the cursor, so an empty set here means a duration was armed
    // and no note entered yet: the press cannot be "tie this", and the only thing it can sensibly be
    // is "I meant the tie tool". It used to be nothing at all, which read as a dead key — you had to
    // press Esc first to get at a tool the panel was showing you.
    if (noteIds.length === 0) {
      this.armTieTool()
      return
    }
    this.tieNotes(noteIds)
  }

  /** Tie `noteIds` through the engine and resync — the shared body of every tie-key path. */
  private tieNotes(noteIds: string[]): void {
    const engine = this.getEngine()
    if (!engine) return
    dbg(`[Tie] toggleTie on ${noteIds.length} note(s) (tool:${this.state.selectedTool})`)
    const result = engine.tieSelection(noteIds)
    dbg(`[Tie] result:${result === null ? 'no candidate found' : result ? 'tie(s) added' : 'tie(s) removed'}`)
    this.renderScore()
    this.refreshTieSelection()
  }

  /**
   * Remove the tie currently selected in the score (see {@link SelectedElement}'s `tie`) —
   * the tie's sibling of {@link editSelectedAccidental}. A tie is VALUELESS, so unlike an accidental
   * there is no "press a different one to change it": the only edit the key can mean is remove,
   * which is also what Delete does to a selected tie. Mirrors the accidental switch-off in leaving
   * NOTHING selected (`selectNote(null)`), or the Keypad would light a stray duration for a note
   * with no visible highlight.
   */
  private editSelectedTie(): void {
    const engine = this.getEngine()
    const fromNoteId = selectedOf(this.state, 'tie')?.fromNoteId
    if (!engine || !fromNoteId) return

    dbg(`[Tie] removing selected tie | fromNoteId:${fromNoteId}`)
    engine.toggleTie(fromNoteId) // the tie exists, so this removes it
    this.state.selectedElement = null
    this.selectNote(null)
    this.renderScore()
    this.refreshTieSelection()
  }

  /** Arm the tie stamp tool. */
  private armTieTool(): void {
    this.armMarkingTool({ kind: 'tie' })
    this.refreshTieSelection()
  }

  /**
   * The slur key `s` (and the Lines palette's button), routed by context — the same split the tie
   * key has, and for the same reason:
   *
   *  0. The slur STAMP is already armed → disarm it. A re-press of an armed tool turns it off.
   *  1. Notes are selected → SLUR THEM. Reads the multi-select set (range) and falls back to the
   *     scalar anchor (single note); the engine resolves endpoints (single→next slot, range→
   *     first/last, voice 0). Create-only and idempotent — removal is select-the-arc + Delete.
   *  2. Nothing note-like is selected → ARM THE STAMP, whichever mode we are in. In selection mode
   *     the press cannot mean "slur this"; in ENTRY mode `selectedNoteId` is the cursor, so an empty
   *     set means a duration is armed and no note entered yet — the press cannot be about a note
   *     either. Arming goes through {@link armMarkingTool}, so whatever else was armed is cleared by
   *     construction (arming IS clearing) and the mode becomes `entry`.
   *
   * ⚠️ It is the SET that decides, not the anchor — `selectionHoldsNotes`, the rule the accidental
   * and articulation stamps use: after note entry, Select/Esc leaves the cursor note in the anchor
   * with an empty set, and that reads as "nothing selected".
   */
  createSlur(): void {
    const engine = this.getEngine()
    if (!engine) return
    // (0) A re-press of the armed stamp turns it off — and falls back to selection mode, the
    // `disarmMarkingTool` half of the split, like every other key-armed stamp.
    if (armedTool(this.state, 'slur')) {
      dbg('[Slur] stamp disarmed (re-press)')
      this.disarmMarkingTool()
      return
    }
    // (1) Something note-like is selected → the press is about it. The scalar anchor counts only in
    // ENTRY mode, where it IS the cursor note; in selection mode an empty set means empty selection
    // (the tie key's rule, `pressTie`).
    const ids = selectedNoteIds(this.state.selectedItems.values())
    const noteIds = ids.length
      ? ids
      : (this.state.selectedTool === 'entry' && this.state.selectedNoteId ? [this.state.selectedNoteId] : [])
    if (noteIds.length === 0) {
      // (2) Nothing to slur → the only thing the press can sensibly mean is "I meant the slur tool".
      dbg('[Slur] nothing selected → arming the slur stamp')
      this.armMarkingTool({ kind: 'slur' })
      return
    }
    const slur = engine.createSlur(noteIds)
    dbg(`[Slur] createSlur on ${noteIds.length} note(s) → ${slur ? `slur ${slur.id}` : 'no valid span'}`)
    this.renderScore()
  }

  /**
   * The Lines palette's *Trill* row — `createSlur`'s split exactly:
   *  0. the trill stamp is already armed → disarm it (a re-press toggles the tool off);
   *  1. notes selected → trill them;
   *  2. nothing selected → arm the stamp; a click then trills the note it lands on.
   *
   * ⛔ **No keyboard shortcut reaches this** — his call, 2026-08-13. The first draft proposed
   * `Shift+T`, which was never Sibelius's (Sibelius has no default trill key; its trill line lives
   * in the Lines gallery). A key invented for us is a key to remember, and the trill is not frequent
   * enough to earn one. So this row is the trill's whole entry surface, which is why it carries both
   * behaviours rather than half of them (docs/trill-plan.md §6).
   */
  createTrill(): void {
    const engine = this.getEngine()
    if (!engine) return
    if (armedTool(this.state, 'trill')) {
      dbg('[Trill] stamp disarmed (re-press)')
      this.disarmMarkingTool()
      return
    }
    // Something note-like is selected → the press is about it. The scalar anchor counts only in
    // ENTRY mode, where it IS the cursor note (the tie/slur/hairpin rule).
    const ids = selectedNoteIds(this.state.selectedItems.values())
    const noteIds = ids.length
      ? ids
      : (this.state.selectedTool === 'entry' && this.state.selectedNoteId ? [this.state.selectedNoteId] : [])
    if (noteIds.length === 0) {
      dbg('[Trill] nothing selected → arming the trill stamp')
      this.armMarkingTool({ kind: 'trill' })
      return
    }
    const trill = engine.createTrill(noteIds)
    dbg(`[Trill] createTrill on ${noteIds.length} note(s) → ${trill ? `trill ${trill.id}` : 'no valid anchor'}`)
    this.renderScore()
  }

  /** `H` / the Lines palette's *Cresc.* row — see {@link createHairpin}. */
  createCrescendo(): void {
    this.createHairpin('cresc')
  }

  /** `Shift+H` / the Lines palette's *Dim.* row — see {@link createHairpin}. */
  createDiminuendo(): void {
    this.createHairpin('dim')
  }

  /**
   * One hairpin-key press, routed by context — `createSlur`'s split exactly, which is Sibelius's
   * gesture (`H` = cresc., `Shift+H` = dim. over the selection):
   *  0. THIS wedge's stamp is already armed → disarm it (a re-press toggles the tool off).
   *  1. Notes selected → create the wedge over them.
   *  2. Nothing selected → arm the stamp; a click then places one.
   *
   * ⭐ **Two public methods over one private, not one method with a flag.** Each key and each
   * palette row is then a single call with no argument to get wrong, and — the part that matters —
   * pressing `H` while the DIM stamp is armed must ARM THE CRESC one rather than disarm, which is
   * what step 0's `tool.type === type` test buys and a shared `kind === 'hairpin'` test would lose.
   */
  private createHairpin(type: 'cresc' | 'dim'): void {
    // ⚠️ The engine is fetched in the CREATE branch, not here: arming and disarming are decisions
    // about the editor's own state and touch no score, so guarding on an engine up front would
    // make the tool unarmable in any context that has none — and would say, wrongly, that these
    // branches depend on one.
    const name = type === 'cresc' ? 'Cresc' : 'Dim'

    const armed = this.state.selectedMarkingTool
    // (0) A re-press of THIS wedge's stamp turns it off. The OTHER wedge's falls through to (2),
    // where `armMarkingTool` replaces it — pressing Shift+H with cresc. armed switches tools.
    if (armed?.kind === 'hairpin' && armed.type === type) {
      dbg(`[${name}] stamp disarmed (re-press)`)
      this.disarmMarkingTool()
      return
    }

    // (1) Something note-like is selected → the press is about it. The scalar anchor counts only in
    // ENTRY mode, where it IS the cursor note (the tie/slur rule).
    const ids = selectedNoteIds(this.state.selectedItems.values())
    const noteIds = ids.length
      ? ids
      : (this.state.selectedTool === 'entry' && this.state.selectedNoteId ? [this.state.selectedNoteId] : [])
    if (noteIds.length === 0) {
      // (2) Nothing to cover → the press can only mean "I meant the hairpin tool".
      dbg(`[${name}] nothing selected → arming the ${type} stamp`)
      this.armMarkingTool({ kind: 'hairpin', type })
      return
    }

    const engine = this.getEngine()
    if (!engine) return
    const hairpin = engine.createHairpin(noteIds, type)
    dbg(`[${name}] createHairpin on ${noteIds.length} note(s) → ${hairpin ? hairpin.id : 'no valid span'}`)
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

    const armed = this.state.selectedMarkingTool

    // (0a) A tool that uses the armed length is live → the dot belongs to IT: the armed rest becomes
    // dotted (or stops being), and the tool stays armed. Before the switch below, which would
    // otherwise trade a dotted-rest gesture for the dot stamp.
    if (armedToolUsesLength(this.state)) {
      this.state.selectedDots = this.state.selectedDots ? 0 : 1
      const pos = this.getLastMousePosition()
      if (pos) this.renderArmedGhost(pos)
      return
    }

    // (0) The dot stamp is live → the key toggles it off, back to selection mode.
    if (armed?.kind === 'dot') {
      this.disarmMarkingTool()
      return
    }

    // A DIFFERENT marking tool is armed → switch to this one. ONE check (see setAccidental).
    if (armed) {
      this.armDotTool()
      return
    }

    // (1) The dots are selected in the score → the press removes them.
    const selectedDot = selectedOf(this.state, 'dot')
    if (selectedDot && engine) {
      const noteId = selectedDot.noteId
      dbg(`[Dot] removing selected dot(s) | noteId:${noteId}`)
      engine.runBatch('Remove dot', () => engine.updateNote(noteId, { dots: 0 }))
      this.state.selectedElement = null
      this.state.selectedDots = 0
      this.selectNote(null)
      this.renderScore()
      return
    }

    // (3) Selection mode with nothing note-like selected → arm the stamp instead of flipping to
    // note entry. This rule is {@link selectionHoldsNotes}, which was written out here first; the
    // accidental and articulation keys now read it too, so there is one answer to "does a press
    // stamp?". (The dot needs no rest branch of its own: a rest TAKES a dot, so it applies above.)
    if (this.state.selectedTool === 'selection' && !this.selectionHoldsNotes()) {
      this.armDotTool()
      return
    }

    const newValue = this.state.selectedDots >= 1 ? 0 : 1
    this.state.selectedDots = newValue
    if (this.state.selectedNoteId && engine && this.state.selectedTool === 'selection') {
      const before = engine.getNote(this.state.selectedNoteId)
      engine.updateNote(this.state.selectedNoteId, { dots: newValue })
      if (before && !before.isRest) {
        const pitch = formatPitch(before)
        const oldDur = `${before.duration}${'.'.repeat(before.dots ?? 0)}`
        const newDur = `${before.duration}${'.'.repeat(newValue)}`
        dbg(`[Duration] ${pitch} | ${oldDur} → ${newDur}`)
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

  /** Arm the dot stamp tool. */
  private armDotTool(): void {
    this.armMarkingTool({ kind: 'dot' })
  }

  /**
   * Arm "N in the time of M" — or, with a note selected, turn THAT note into one (and a second press
   * on a note already in a tuplet removes it, as it always did).
   *
   * Both counts are passed IN. There is no `defaultNotesOccupied(n)` table here on purpose: M is not
   * a function of N — a quintuplet is 5:4 in simple meter and 5:3 in 6/8, because the normal side
   * comes from what is being divided. Callers that only know N (a preset button) state the M they
   * mean; the day we derive it, it is derived from the meter and the span, in one place.
   *
   * Pressing the ratio that is already armed disarms it — a palette button that cannot be turned off
   * is a mode you are stuck in.
   */
  armTuplet(
    numNotes: number,
    notesOccupied: number,
    /** What the user typed on the NORMAL side, when it was not simply the same note value. Omitted =
     *  both sides agree, which is every preset and every `Ctrl+`N. */
    normalDuration?: NoteDuration,
    normalDots?: number,
    normalCount?: number,
    /** How the group will be DRAWN — the Tuplet window's Format box. Omitted by every preset and
     *  every `Ctrl+`N, which is what "engrave it by the rules" looks like. */
    format?: TupletFormat,
    /** Work M out from the meter where the group LANDS, with `notesOccupied` as the fallback — see
     *  {@link armTupletPreset}, the only caller that sets it. */
    deriveM?: boolean,
  ): void {
    const engine = this.getEngine()
    if (this.state.selectedNoteId && engine && this.state.selectedTool === 'selection') {
      const note = engine.getNote(this.state.selectedNoteId)
      if (!note) return
      if (note.tupletId) {
        engine.deleteTuplet(note.tupletId)
      } else {
        const result = engine.applyTupletToNote(this.state.selectedNoteId, numNotes, notesOccupied)
        if (result) this.selectNote(result.note.id)
      }
      this.renderScore()
      return
    }
    const armed = this.state.armedTuplet
    const same =
      armed && armed.numNotes === numNotes && armed.notesOccupied === notesOccupied
      && armed.normalDuration === normalDuration && (armed.normalDots ?? 0) === (normalDots ?? 0)
      && armed.normalCount === normalCount
    // Reassigned, never mutated — the observable Proxy only traps the SET (see EditorState).
    this.state.armedTuplet = same
      ? null
      : {
          numNotes,
          notesOccupied,
          ...(normalDuration && { normalDuration, normalCount, ...(normalDots && { normalDots }) }),
          ...(format && { format }),
          ...(deriveM && { deriveM }),
        }
    if (this.state.armedTuplet) {
      this.state.selectedDots = 0
      // A tuplet is armed to be PLACED, so it goes to entry mode and puts its ghost up — the same
      // "armed ⇒ the next click enters" contract every stamp has. Without this the ratio was set and
      // the score still answered clicks as a selection: nothing to see, nothing to click.
      this.state.selectedMarkingTool = null // a stamp's ghost would hide the note's (reassign, not mutate)
      this.state.selectedTool = 'entry'
    } else if (this.state.selectedTool === 'entry' && !this.state.selectedMarkingTool) {
      // Disarming with nothing else armed drops back to selection, as a re-pressed stamp does.
      this.state.selectedTool = 'selection'
    }
    this.showArmedGhost()
  }

  /**
   * A PRESET key — `Ctrl+5`: "a 5, whatever a 5 is here."
   *
   * M is not decided now, because now is the wrong time: the key is pressed with no idea where the
   * click will land, and what a 5 replaces depends on the meter of the bar it lands in (5:4 in
   * simple, 5:3 in compound). So the ratio is armed as "derive me", and the fallback rides along for
   * the meters that have no tuplet of this N at all.
   *
   * The window does NOT come through here: "5 sixteenths in the time of 1 quarter" has already
   * answered the question this defers.
   */
  armTupletPreset(numNotes: number, fallbackM: number): void {
    this.armTuplet(numNotes, fallbackM, undefined, undefined, undefined, undefined, true)
  }

  /**
   * "N ♪ in the time of M ♪" → the shape, or the reason it is none. The RULE lives in
   * {@link resolveTupletInTimeOf} (utils/musicUtils) — the Tuplet window asks the same question
   * without a controller in reach, and one rule cannot have two implementations. This stays as the
   * palette's way in.
   */
  resolveTupletInTimeOf(
    numNotes: number,
    unit: NoteDuration,
    normalCount: number,
    normalUnit: NoteDuration,
    unitDots = 0,
    normalDots = 0,
  ): TupletResolution {
    return resolveTupletInTimeOf(numNotes, unit, normalCount, normalUnit, unitDots, normalDots)
  }

  /** Arm what {@link resolveTupletInTimeOf} works out; false when the boxes do not resolve. */
  armTupletInTimeOf(
    numNotes: number,
    unit: NoteDuration,
    normalCount: number,
    normalUnit: NoteDuration,
    unitDots = 0,
    normalDots = 0,
    /** How the group will be DRAWN — see {@link armTuplet}. */
    format?: TupletFormat,
  ): boolean {
    const resolved = this.resolveTupletInTimeOf(numNotes, unit, normalCount, normalUnit, unitDots, normalDots)
    if (!resolved.ok) return false
    const { shape } = resolved
    // The tuplet is written in `unit`, so arming it arms that duration too — the ACTUAL side lives in
    // `selectedDuration`/`selectedDots` and nowhere else, so this is the write that carries it.
    // Assigned rather than routed through `setDuration`, which disarms the tuplet and would retype a
    // selected NOTE on the way.
    this.state.selectedDuration = shape.baseDuration
    this.armTuplet(shape.numNotes, shape.notesOccupied, shape.normalDuration, shape.normalDots, shape.normalCount, format)
    // AFTER armTuplet, which zeroes the dots for the plain presets. The unit's dot is part of the
    // note value being armed, so here it must survive.
    this.state.selectedDots = shape.baseDots ?? 0
    return true
  }

  /**
   * ⭐ ARM THE FEATHER STAMP — the Feathered Beam window's OK, routed here through {@link bus.fanStamp}.
   *
   * It ARMS rather than applies, for the reason the Tuplet window's OK does: a feather is a gesture
   * you are about to WRITE, and until the note exists there is nothing to mark. That is also what
   * separates it from the Keypad's `accel.`/`rit.` keys ({@link pressFan}), which act on notes that
   * are already there and do nothing at all with an empty selection.
   *
   * ⚠️ It writes NO note-entry field — not `selectedDuration`, unlike {@link armTupletInTimeOf}. A
   * tuplet is a container the ordinary entry path then fills, so the value it is written in has to
   * BE the armed duration; a feather is placed whole by one click, so its value stays on the tool
   * where the dialog put it, and the duration keys are free to go on meaning the next note.
   */
  armFanStamp(armed: ArmedFanStamp): void {
    // ⭐⭐ A PASSAGE IS ALREADY THE GESTURE. Several notes selected means collapse them into one fan —
    // his rule for the dialog, and the same act `pressFan` performs from the Keypad, so there is one
    // collapse in the editor and one set of refusals (a rest inside, a gap, two bars, an existing
    // fan). The dialog contributes the DIRECTION and nothing else: how many attacks and how long the
    // gesture lasts are facts about what was selected, which is why the window greys those fields.
    if (multipleNotesSelected(this.state.selectedItems.values())) {
      this.pressFan(armed.direction)
      return
    }
    // ⭐ APPLY TO WHAT IS SELECTED, OTHERWISE ARM — the Time Signature window's shape, and his rule
    // for this one: one note selected means *"create the fan in the position of the note, with the
    // characteristics of the dialog and the pitch of the note"*. `featherSelectedNote` answers false
    // for anything that is not a single fannable note, and then the stamp arms as it always did.
    const engine = this.getEngine()
    if (engine && featherSelectedNote(this.state, engine, armed, () => this.renderScore())) {
      this.refreshFanSelection()
      return
    }
    this.armMarkingTool({
      kind: 'fan',
      attacks: armed.attacks,
      unit: armed.unit,
      dots: armed.dots,
      direction: armed.direction,
    })
    dbg(`[palette] feather stamp armed | ${armed.attacks} attacks in ${armed.unit}${'.'.repeat(armed.dots)} (${armed.direction})`)
  }

  /**
   * Set the beam mode: armed for the next note, and applied to EVERY selected note in one undo step.
   *
   * The whole selection, not just the anchor — beaming is a statement about a RUN of notes, so
   * "select the group, press begin" is the gesture, and applying it to `selectedNoteId` alone left
   * the other five notes of a selected six untouched. Same shape as every other multi-select action
   * here (`toggleArticulation`, `convertSelectionToRest`): `runBatch`, so one Ctrl+Z takes it back.
   *
   * Rests are filtered out rather than refused: you cannot beam silence, and a selection that sweeps
   * up a rest along with its neighbours should still beam the notes. Only if there is nothing but
   * rests does nothing happen. (The palette row is dark for a multi-selection — no single value can
   * stand for a set — but a PRESS is not a reading, and it still means "make them all this".)
   *
   * ⚠️ TODO — `beam: 'auto'` (reset a note's authored beam back to the meter's default) has NO UI.
   * The Keypad's Beams/Tremolos page wires `single`/`begin`/`continue`/`end` but has no `auto` key,
   * and the dev-toolbar beam row that used to expose it was removed when the Keypad took over the
   * cluster. The method still handles `'auto'` (updateNote clears the field), so the reset is one call
   * away — it just needs a home. Surface it as a "reset beaming" control in the Properties window when
   * that lands; until then a note's authored begin/continue/end/single cannot be cleared from any UI.
   */
  setBeam(beam: BeamMode): void {
    // ⭐ ON A TWO-NOTE TREMOLO, THE BEAM KEYS CHOOSE THE PAIR'S SPELLING — see
    // {@link routeBeamToTremoloPairStyle}. Ahead of everything below, including the armed
    // `selectedBeam`: this press is not arming a beam mode for the next note, it is restyling a mark.
    if (this.routeBeamToTremoloPairStyle(beam)) return

    this.state.selectedBeam = beam
    const engine = this.getEngine()
    if (!engine || this.state.selectedTool !== 'selection') return

    // A FANNED slot takes exactly ONE of the four, and it is `continue`: the JOIN to the group on
    // its left (docs/fan-beam-join-plan.md §0). Its own beam is the RAMP — one self-contained
    // feathered group that always has a beam going out — so `begin` has nothing left to say,
    // `end`/`single` are impossible, and only "a beam comes in as well" is a choice anyone can make.
    // The other three are skipped beside the rests, which also avoids the resurrection trap
    // `routeBeamToTremoloPairStyle` avoids by not writing here: a mark inert under the fan and alive
    // the moment it came off.
    //
    // ⚠️ And it TOGGLES, because `auto` has no key on the pad — without that there is no way to
    // unjoin. Per note, so a mixed selection each flips its own way.
    const edits: { id: string; beam: BeamMode }[] = []
    for (const id of selectedNoteIds(this.state.selectedItems.values())) {
      const note = engine.getNote(id)
      if (!note || note.isRest) continue
      if (note.fan) {
        if (beam !== 'continue') continue
        edits.push({ id, beam: note.beam === 'continue' ? 'auto' : 'continue' })
      } else {
        edits.push({ id, beam })
      }
    }
    if (!edits.length) return

    engine.runBatch(`Beam: ${beam}`, () => {
      for (const edit of edits) engine.updateNote(edit.id, { beam: edit.beam })
    })
    this.renderScore()
    // The note's authored beam and its role changed but `selectedBeam` may not have (pressing the mode
    // it already carries), so `sync()` might not fire — push the beam lights ourselves, like the toggles.
    this.refreshBeamSelection()
  }

  /**
   * Toggle the SECONDARY BEAM BREAK on every selected note: the notes keep their primary beam and
   * start a new group at the 16th level and below. Six sixteenths beamed as one group, subdivided
   * 3+3, is the standard case — one beam over all six, the second beam broken in the middle.
   *
   * A different axis from {@link setBeam}, not a sixth mode: the mode says which notes are beamed
   * together, this says how many lines join them, and they are set independently.
   *
   * SELECTION ONLY — no armed entry-mode value, unlike the beam mode. A subdivision is a statement
   * about a group that already exists (where does the second beam break *within* these six), which
   * is nothing a note you have not written yet can carry. Sibelius's own break-secondary is a
   * selection edit for the same reason.
   *
   * Toggles as a set, like the articulations: all of them have it → remove, otherwise add.
   */
  toggleSecondaryBreak(): boolean {
    const engine = this.getEngine()
    if (!engine || this.state.selectedTool !== 'selection') return false

    // ⭐ A JOINED FAN TAKES THIS KEY, and takes it first: the join IS an ordinary beam boundary, and
    // breaking it is what tells a run of 16ths from the fan beamed onto them (his report). It
    // subdivides by DEFAULT, so what the key does there is refuse — and the refusal lives on the
    // MARK ({@link FanMark.joinSubdivide}), because `updateNote` cannot store a false
    // `secondaryBreak` at all.
    if (this.toggleFanJoinSubdivision()) return true

    // Rests, and an UNJOINED fan with them (his call): a subdivision breaks the SECOND beam within a
    // group, and a fan's beam lines are its ramp — how many it feathers out to is `fan.beams`.
    const ids = selectedNoteIds(this.state.selectedItems.values())
      .filter(id => {
        const note = engine.getNote(id)
        return note && !note.isRest && !note.fan
      })
    if (!ids.length) return false

    const allHaveIt = ids.every(id => engine.getNote(id)?.secondaryBreak)
    engine.runBatch(allHaveIt ? 'Join secondary beams' : 'Break secondary beams', () => {
      for (const id of ids) engine.updateNote(id, { secondaryBreak: !allHaveIt })
    })
    this.renderScore()
    // secondaryBreak isn't a reactive field, so `sync()` won't fire — push the highlight ourselves.
    this.refreshSubdivideSelection()
    return true
  }

  /**
   * The subdivide key on a JOINED FAN: flip whether the beam breaks where the fan starts. Returns
   * whether the press was spent that way, so {@link toggleSecondaryBreak} does nothing else with it.
   *
   * SINGLE selection only, like the Properties fan inputs it shares a seam with — the request is
   * keyed by one note id, and a multi-selection has no single fan to speak for. The value published
   * is the NEGATION OF THE EFFECTIVE one, never of the stored flag: absent means subdivided, so a
   * first press on an untouched fan has to send `false` and not `true`.
   */
  private toggleFanJoinSubdivision(): boolean {
    const engine = this.getEngine()
    const noteId = this.state.selectedNoteId
    if (!engine || !noteId || multipleNotesSelected(this.state.selectedItems.values())) return false
    const note = engine.getNote(noteId)
    if (!note?.fan || !fanIsJoined(note)) return false

    // ⭐ ONE FIELD OF THE MARK, spread onto the mark that is there — {@link pressFan}'s own rule for
    // turning a fan round, and for its reason: rebuilding the mark would throw away the members, and
    // with them every member pitch, accidental and offset. `setFan` → `normalizeFan` then drops a
    // `true` again, so only the refusal is ever stored.
    const subdivide = !fanJoinSubdivides(note.fan)
    const applied = engine.runBatch(subdivide ? 'Subdivide fan join' : 'Unbroken fan join', () => {
      engine.setFan(noteId, { ...note.fan!, joinSubdivide: subdivide })
    })
    if (!applied) return true // the press was still ours; the model simply refused it
    engine.updateUndoNoteId(noteId)
    this.renderScore()
    // The mark changed, the selection did not — push the light ourselves, as every fan press does.
    this.refreshSubdivideSelection()
    return true
  }

  /**
   * Toggle BEAM-OVER on every selected REST: beam over it instead of breaking the beam at it (the
   * "beamed rest", `♪ 𝄾 ♪ ♪` → one beam). The exact inverse population of {@link toggleSecondaryBreak}
   * — it filters to KEEP rests and drops notes, because a rest is the only thing this applies to.
   * Whether a beam then runs over the rest depends on its neighbours (it must be interior to a group);
   * the flag is the authored intent either way.
   *
   * SELECTION ONLY, no armed entry-mode value — a statement about a rest that already exists, exactly
   * like the subdivide toggle. Toggles as a set: all of them have it → remove, otherwise add.
   */
  toggleBeamOver(): boolean {
    const engine = this.getEngine()
    if (!engine || this.state.selectedTool !== 'selection') return false

    const ids = selectedNoteIds(this.state.selectedItems.values())
      .filter(id => engine.getNote(id)?.isRest)
    if (!ids.length) return false

    const allHaveIt = ids.every(id => engine.getNote(id)?.beamOver)
    engine.runBatch(allHaveIt ? 'Beam over rest: off' : 'Beam over rest: on', () => {
      for (const id of ids) engine.updateNote(id, { beamOver: !allHaveIt })
    })
    this.renderScore()
    // beamOver isn't a reactive field, so `sync()` won't fire — push the highlight ourselves.
    this.refreshBeamOverSelection()
    return true
  }

  /**
   * Arm/disarm a clef for placement. Clicking the active clef again disarms it.
   * While armed, canvas clicks set/change a measure's clef (see MouseController)
   * and the ghost note is suppressed. Switches to the entry tool so canvas clicks
   * are handled (the selection tool ignores clicks for placement).
   *
   * ⚠️ NO PRODUCTION CALLER as of the Vue clef palette's deletion — the toolbar buttons that toggled
   * a clef were its only one, and the Clef window that replaced them uses {@link armClef} instead
   * (an OK confirms; it does not toggle). Kept, not deleted, because this is the BUTTON gesture and
   * the button is coming back on the editor side: a plain-TS clef palette lights its key from
   * `bus.clef`'s highlight channel — already pushed by keypadSync — and re-pressing the lit key
   * has to mean "off", which is exactly this method and nothing else in the class. Deleting it would
   * cost more to rediscover than it costs to keep. Covered by PaletteController.test.ts.
   */
  setClef(clef: Clef): void {
    if (armedTool(this.state, 'clef')?.clef === clef) {
      this.disarmToEntry() // re-press disarms
      return
    }
    this.armMarkingTool({ kind: 'clef', clef })
  }

  /**
   * Arm a clef outright — idempotent, and NOT a toggle.
   *
   * The difference from {@link setClef} is the gesture, not the clef. A palette BUTTON toggles:
   * pressing the lit one again means "off", because the button is also the indicator. An OK button
   * is not that — it answers a question the window asked, and answering "treble" twice cannot mean
   * "no clef". Routing the Clef window through `setClef` made confirming the already-armed clef
   * silently disarm it.
   */
  armClef(clef: Clef, cautionary?: boolean): void {
    this.armMarkingTool({ kind: 'clef', clef, cautionary })
  }

  /**
   * Arm a time signature outright — idempotent, and NOT a toggle. The twin of {@link armClef}, and
   * for the same reason: the Time Signature window's OK answers a question, and answering "4/4"
   * twice cannot mean "no meter". `cautionary` is the dialog's *Allow cautionary*, carried with the
   * meter because the target bar is not known until the click.
   */
  armTimeSignature(ts: TimeSignature, cautionary: boolean, pickup: Fraction | null = null): void {
    // A bar already chosen answers the question arming exists to ask. Arming means "I know WHAT, not
    // WHERE — the next click will say"; with a bar boxed, where is already said, and making the user
    // click it a second time is the dialog ignoring what it was given. Same bargain the dynamics and
    // articulation tools strike with a selected note.
    const target = this.selectedMeasureTarget()
    if (target !== null) {
      const engine = this.getEngine()
      if (!engine) return
      const changed = engine.applyTimeSignatureChange(target, { timeSignature: ts, cautionary, pickup })
      dbg(changed
        ? `✓ Time signature set on the selected bar | ${ts.numerator}/${ts.denominator} at measure ${target}`
        : `Time signature unchanged at the selected measure ${target}`)
      // The box STAYS: you are looking at the bar you just changed, and clearing it would make the
      // change hard to see and a second dialog need a second selection.
      this.renderScore()
      return
    }
    this.armMarkingTool({ kind: 'timeSignature', timeSignature: ts, cautionary, pickup })
  }

  /**
   * The bar a meter/clef-shaped choice should land on when one is already selected, or null to fall
   * back to arming.
   *
   * EITHER box counts, unlike {@link measureContext}: the double box (Ctrl+Shift+click) and the
   * single one (a plain click in an empty bar) differ in what they select *inside* the bars, and a
   * meter change does not care — both name a bar out loud.
   *
   * The LOWEST bar of a span, because a meter change is a point event: it takes effect there and
   * runs to the next change, so "apply 3/4 to bars 5-8" is 3/4 at bar 5. Applying it to each bar in
   * turn would write three redundant changes that say the same thing.
   */
  private selectedMeasureTarget(): number | null {
    const range = selectedOf(this.state, 'measureRange')
    if (!range || this.state.selectedTool !== 'selection') return null
    return Math.min(range.anchor, range.focus)
  }

  /**
   * Arm/disarm a time signature for placement. Clicking the active signature
   * again disarms it. While armed, canvas clicks set/change a measure's time
   * signature (see MouseController) and the ghost note is suppressed. Switches to
   * the entry tool so canvas clicks are handled for placement.
   *
   * ⚠️ NO PRODUCTION CALLER as of the old time palette's deletion — its preset buttons and its
   * custom-meter dialog were the only two, and the Time Signature window that replaced them uses
   * {@link armTimeSignature} instead (an OK confirms; it does not toggle). Kept, not deleted, for
   * the reason {@link setClef} is: this is the BUTTON gesture, and the button is coming back on the
   * editor side. A plain-TS meter palette would light its keys from `armedTool` — the state this
   * already drives — and re-pressing the lit one has to mean "off", which is this method and
   * nothing else in the class. Rediscovering that costs more than keeping eighteen lines.
   *
   * ⛔ It also carries NO cautionary and NO pickup, on purpose: a palette key is one value, and
   * those two are answers a DIALOG asks for. A future palette that wants them wants
   * {@link armTimeSignature}, not a wider version of this.
   */
  setTimeSignature(ts: TimeSignature): void {
    const armed = armedTool(this.state, 'timeSignature')
    if (armed && sameTimeSignature(armed.timeSignature, ts)) {
      this.disarmToEntry() // re-press disarms
      return
    }
    this.armMarkingTool({ kind: 'timeSignature', timeSignature: ts })
  }

  /**
   * Arm/disarm a dynamic for placement. Clicking the active value again disarms
   * it. A level (`p`/`mp`/`mf`/`f`) places that mark on the next canvas click;
   * `'text'` places a custom italic-text mark (MouseController prompts for the
   * text). Mutually exclusive with the clef/time-signature tools, and switches to
   * the entry tool so canvas clicks are handled for placement.
   */
  /**
   * ⚠️ NO UI CALLS THIS RIGHT NOW — only the tests. That is deliberate, not rot: the Vue dynamics
   * palette was deleted (it hardcoded four of the eight levels, so it could not reach pp/ppp/ff/fff
   * and presented `f` as the top of the range), and its successor — a dynamics page on the
   * framework-agnostic Keypad — is not built yet. Ctrl+E plus the Ctrl+<letter> glyph keys and the
   * expressions palette cover placement meanwhile.
   *
   * KEEP IT. This is the seam that palette will call, it is the tested half of the behaviour
   * (arming, disarm-on-re-press, replacement, mutual exclusion, place-on-selection), and none of it
   * is Vue-shaped. A future palette should derive its rows from DYNAMIC_VELOCITY rather than listing
   * levels by hand — the hardcoded list is exactly what made the old one wrong.
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

    if (armedTool(this.state, 'dynamic')?.dynamic === value) {
      this.disarmToEntry() // re-press disarms
      return
    }
    this.armMarkingTool({ kind: 'dynamic', dynamic: value })
  }

  /**
   * Arm/disarm a tempo mark for placement. Clicking the armed preset again disarms it.
   * Mutually exclusive with the clef/time-signature/dynamic tools, and switches to the
   * entry tool so canvas clicks are handled for placement.
   *
   * A tempo mark is SYSTEM-level, so — unlike a dynamic — it carries no staff and no
   * voice: whichever staff you click, one mark is placed governing the whole system.
   *
   * ⚠️ NO UI CALLS THIS RIGHT NOW — only the tests. The Vue tempo palette that drove it (a row of
   * word chips + bpm/unit/dots spinners that composed a preset) was deleted; placement and editing
   * now go through the plain-TS tempo editor — Ctrl+Alt+T to place a mark, then type it with the
   * word menu + shortcuts (the text-as-truth model, where the mark IS its text). What is dropped is
   * only the one-click *preset stamp* and the numeric spinners; nothing you can author is lost.
   *
   * KEEP IT (the same reason {@link setDynamic} / {@link setTimeSignature} are kept). This is the
   * intact seam a future framework-agnostic tempo palette on the editor side would call — the tested
   * half of the behaviour (arm, disarm-on-re-press, edit-selected-in-place, place-on-selection,
   * mutual exclusion), none of it Vue-shaped. When that palette lands its preset rows could come
   * from the word → bpm dictionary sketched in docs/tempo-marks-plan.md §9, rather than a hand list.
   * {@link placeTempoAtSelectedNote} / `placeTempoAtClick` and the `'tempo'` marking-tool variant
   * are the placement half of this same seam and are kept for the same reason.
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
    const selectedTempo = selectedOf(this.state, 'tempo')
    if (tool && selectedTempo) {
      const engine = this.getEngine()
      const updated = engine?.updateTempoMark(selectedTempo.id, tool)
      if (updated) dbg(`✓ Tempo mark → ${tempoLabel(updated)}`)
      this.renderScore()
      return
    }

    // Selection mode with a note/rest selected → place at that element's slot directly
    // (no arm-and-click), exactly like the dynamics tool.
    if (tool && this.state.selectedTool === 'selection' && this.state.selectedNoteId) {
      this.placeTempoAtSelectedNote(tool)
      return
    }

    const armed = armedTool(this.state, 'tempo')
    if (tool === null || (armed && sameTempoTool(armed.tempo, tool))) {
      this.disarmToEntry() // re-press (or an explicit null) disarms
      return
    }
    this.armMarkingTool({ kind: 'tempo', tempo: tool })
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
      dbg(`✓ Tempo ${tempoLabel(created)} at measure ${note.measure} beat ${fracToNumber(note.beat).toFixed(3)} (on selected note)`)
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
    const staffId = engine.staffIdForIndex(staffOf(note))
    const staffParam = staffId ? { staffId } : {}
    engine.addDynamic(note.measure, { beat: note.beat, text: dynamicTextFromTool(tool), voice: 0, placement: 'below', ...staffParam })
    dbg(`✓ Dynamic ${tool} at measure ${note.measure} beat ${beatStr} staff ${staffOf(note)} (on selected note ${this.state.selectedNoteId})`)
    this.renderScore()
  }

  /**
   * Choose the active voice (Sibelius-style; palette buttons + Alt+1..Alt+4).
   *
   * In selection mode with a selection, a voice press MOVES the selected note(s)
   * into that voice (Sibelius Alt+1/2-on-selection) — preserving their ids so
   * ties/slurs/selection survive, as one atomic undo. Otherwise it arms the voice
   * for note entry: with nothing selected, flip to entry mode (mirrors the
   * duration/accidental tools).
   */
  setActiveVoice(voice: 1 | 2 | 3 | 4): void {
    this.state.activeVoice = voice
    dbg(`[Voice] active voice → ${voice}`)

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
    this.state.selectedDuration = DEFAULT_DURATION
    this.state.selectedAccidental = null
    this.state.selectedDots = DEFAULT_DOTS
    this.state.accent = false
    this.state.staccato = false
    this.state.tenuto = false
    this.state.selectedBeam = DEFAULT_BEAM
    this.disarmPositionalTools()
    this.state.selectedElement = null
  }

  /**
   * Disarm the marking tool — all eight are entry-mode-only (arming one switches to entry mode and
   * a canvas click places/stamps it), so leaving entry mode makes any of them inert and the palette
   * should stop showing it as selected. Does NOT touch note-entry settings (duration, accidental) —
   * those carry over between modes. The articulations are the exception and Esc clears them: see
   * {@link clearArmedArticulations}.
   *
   * One line, and it cannot fall behind: it used to name all eight, and a ninth tool would have had
   * to remember to add itself here.
   */
  disarmPositionalTools(): void {
    this.state.selectedMarkingTool = null
  }

  /**
   * Drop the arm-for-next-note articulations AND the armed entry tremolo. Esc's job, and the Select
   * arrow's.
   *
   * They used to survive it, alongside the duration and the accidental — but they are not the same
   * kind of setting. A duration is a STANDING choice: a note has some length, always, so the armed
   * one is only ever "which", never "whether", and carrying it out of entry mode and back loses
   * nothing. An articulation is a decision about the NEXT NOTE — you arm an accent because the note
   * you are about to type wants one. Escape says you are not typing that note any more, so keeping
   * the accent armed means the next note you enter, whenever that is, silently gets a mark you asked
   * for in a session you abandoned.
   *
   * Reassigned one by one because the observable Proxy only traps top-level SETs (see EditorState) —
   * that is also what repaints the Keypad and the toolbar, through keypadSync's subscription.
   */
  clearArmedArticulations(): void {
    this.state.accent = false
    this.state.staccato = false
    this.state.tenuto = false
    // The tremolo is the same kind of setting, by the same argument: it is a decision about the
    // NEXT NOTE, not a standing choice like the duration. It persists across every note you enter —
    // Escape is the deliberate way out (docs/tremolo-plan.md §10).
    this.state.selectedTremolo = null
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
    // The arrow IS the Esc path, so it drops the armed articulations too — the two must not disagree
    // about what "stop what you were doing" means.
    this.clearArmedArticulations()
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
    // More than one note selected → no single note to reflect, so the key stays dark (see the Keypad
    // single-selection rule in keypadSync / selection.multipleNotesSelected).
    if (multipleNotesSelected(this.state.selectedItems.values())) return false
    const noteId = selectedOf(this.state, 'articulation')?.noteId ?? this.state.selectedNoteId
    if (!noteId) return false
    // A selected REST reports the ARMED flag, not its own articulations — it has none and can have
    // none. Pressing the key with a rest selected arms for the note it is about to become
    // (pressArticulation 2c), and an arm you cannot see is not an arm: the key has to light or the
    // gesture is invisible. Nothing is lost by not reading the rest's own — there is nothing there.
    const note = engine.getNote(noteId)
    if (note?.isRest) return this.state[type]
    return note?.articulations?.includes(type) ?? false
  }

  /**
   * True while ANY marking tool is armed. All eight arm into ENTRY mode but enter no note, so the
   * `accent`/`staccato`/`tenuto` arm-for-next-note flags must not light while one is live — they can
   * be stale from an earlier note-entry session, and the entry-mode fall-through in `noteHas*` would
   * otherwise report them.
   *
   * This used to test a list of the four STAMP kinds, which let a clef / TS / dynamic / tempo leak a
   * stale flag through. The list encoded no real distinction: "arms into entry mode, enters no note"
   * is true of every marking tool.
   */
  private markingToolArmed(): boolean {
    return this.state.selectedMarkingTool !== null
  }


  noteHasAccent(): boolean {
    // Stamp tool armed → ONLY the armed set lights; the leftover arm-for-next-note flags below must
    // not leak (they can be stale from an earlier note-entry session — hence the early return).
    const armed = armedTool(this.state, 'articulation')
    if (armed) return armed.types.includes('accent')
    if (this.markingToolArmed()) return false // an accidental/tie stamp: no articulation is in play
    if (this.state.selectedTool === 'selection') return this.selectedNoteHasArticulation('accent')
    return this.state.accent
  }

  noteHasStaccato(): boolean {
    const armed = armedTool(this.state, 'articulation')
    if (armed) return armed.types.includes('staccato')
    if (this.markingToolArmed()) return false
    if (this.state.selectedTool === 'selection') return this.selectedNoteHasArticulation('staccato')
    return this.state.staccato
  }

  noteHasTenuto(): boolean {
    const armed = armedTool(this.state, 'articulation')
    if (armed) return armed.types.includes('tenuto')
    if (this.markingToolArmed()) return false
    if (this.state.selectedTool === 'selection') return this.selectedNoteHasArticulation('tenuto')
    return this.state.tenuto
  }

  /**
   * Push which articulations are lit into the {@link bus.articulation} store, so the Keypad
   * reflects the note under the cursor (or the armed entry-mode flags). This is the RULE — the same
   * `noteHasX` the dev toolbar's buttons read — and it lives HERE, framework-agnostic, on purpose:
   * a caller only ever POKES it (on a selection/mode/arm change, which is not something it can
   * express as a store event) and holds no logic of its own. That is what made retiring the old
   * framework palette a non-event: this rule did not move, only the poke did — onto `keypadSync`'s
   * `sync()`, which runs on the state's own change-notification.
   *
   * `setActive` short-circuits on an unchanged set, and a relight is a handful of `setAttribute`s on
   * the panel's buttons — never a score re-render. Called after every toggle (all sources funnel
   * through toggleAccent/Staccato/Tenuto) and on that poke.
   */
  refreshArticulationSelection(): void {
    const active: ArticulationType[] = []
    if (this.noteHasAccent()) active.push('accent')
    if (this.noteHasStaccato()) active.push('staccato')
    if (this.noteHasTenuto()) active.push('tenuto')
    bus.articulation.setActive(active)
  }

  noteHasTie(): boolean {
    // While the tie stamp is armed the key lights because the TOOL is armed — the armed gesture is
    // what the Keypad shows, exactly as the armed articulation set lights during its stamp. Ahead
    // of the reads below, which would report the (cleared) note selection instead.
    if (armedTool(this.state, 'tie')) return true
    // A tie selected in the score lights the key too, so it reads as removable from the Keypad.
    if (selectedOf(this.state, 'tie')) return true
    // More than one note selected → nothing single to reflect (Keypad single-selection rule).
    if (multipleNotesSelected(this.state.selectedItems.values())) return false
    const engine = this.getEngine()
    if (!this.state.selectedNoteId || !engine) return false
    const note = engine.getNote(this.state.selectedNoteId)
    return !!note?.tiedTo
  }

  /**
   * Push whether the tie is lit into the {@link bus.tie} store, so the Keypad's Enter key reflects
   * the selected note. Like {@link refreshArticulationSelection}, the RULE ({@link noteHasTie}, reading
   * the engine's `tiedTo`) lives HERE, framework-agnostic — a note's tie is not a reactive field, so no
   * App.ts computed can mirror it. Called after every `toggleTie` (all sources funnel through it) and
   * on `keypadSync`'s selection-change poke. `setHighlight` short-circuits on no change.
   */
  refreshTieSelection(): void {
    bus.tie.setHighlight(this.noteHasTie() ? 'tie' : null)
  }

  /**
   * Is the selected slot a rest? The duration keys already say "quarter" for a selected quarter rest
   * — this is the half that says WHICH quarter (see {@link bus.rest}).
   *
   * Selection-mode only, and deliberately so. There is no armed "enter rests now" state to report in
   * entry mode: a rest is entered with `r` at the cursor, a one-shot action, not a mode — so nothing
   * about a rest is in play while a note is being armed. Same reason a marking tool darkens it: with
   * a clef waiting to be placed, the selection it would report has already been cleared.
   */
  selectionIsRest(): boolean {
    // The rest stamp is armed → the key lights because the TOOL is, exactly as every other stamp
    // lights its own key. Ahead of the reads below, which would see the (cleared) note selection.
    if (armedTool(this.state, 'rest')) return true
    if (this.state.selectedMarkingTool) return false
    // More than one note selected → nothing single to reflect (Keypad single-selection rule).
    if (multipleNotesSelected(this.state.selectedItems.values())) return false
    const engine = this.getEngine()
    if (this.state.selectedTool !== 'selection' || !this.state.selectedNoteId || !engine) return false
    return !!engine.getNote(this.state.selectedNoteId)?.isRest
  }

  /**
   * Push whether the rest key is lit into the {@link bus.rest} store. The tie's twin: the RULE
   * ({@link selectionIsRest}, reading the engine's `isRest`) lives HERE, framework-agnostic, because
   * `isRest` is not a reactive field and no mirror can compute it. Driven by keypadSync's `sync()`,
   * which runs on every state change — including every selection change, the only thing this reads.
   * `setHighlight` short-circuits on no change.
   */
  refreshRestSelection(): void {
    bus.rest.setHighlight(this.selectionIsRest() ? 'rest' : null)
  }

  /**
   * Push which beam MODE keys are lit into {@link bus.beam}, so the Keypad's `single`/`begin`/
   * `continue`/`end` keys reflect the selected note. A SET, like the articulations and for the same
   * reason the dev toolbar's Beam row lights two buttons: the authored beam ({@link beamHighlight}) and
   * the role it engraves ({@link beamRoleHighlight}) are independent and can disagree. `'auto'` is no key
   * on the pad, so it lights nothing. Same single-sourced rules the toolbar reads — the engine is the
   * {@link BeamSource} both take. Called on every state change and after {@link setBeam}.
   */
  refreshBeamSelection(): void {
    const engine = this.getEngine()
    const lit = new Set<BeamMode>()
    const armed = beamHighlight(this.state, engine)
    if (armed && armed !== 'auto') lit.add(armed)
    const role = beamRoleHighlight(this.state, engine)
    if (role) lit.add(role)
    bus.beam.setActive(lit)
  }

  /**
   * Push the lit TREMOLO mark into {@link bus.tremolo} — the Keypad's `1`–`6`, and the same
   * `tremoloHighlight` rule the dev toolbar's row reads, so a press from either lights both.
   *
   * Engine-read, so it cannot be mirrored from a reactive field: pushed on every state change AND
   * after {@link pressTremolo}, because changing a selected note's mark writes the SCORE and no
   * top-level state field — the Proxy would never emit and the key would keep lighting the old mark.
   */
  refreshTremoloSelection(): void {
    bus.tremolo.setHighlight(tremoloHighlight(this.state, this.getEngine()))
  }

  /**
   * The same for the TWO-NOTE pair key (`Enter`). A SECOND AXIS, so it is its own store and its own
   * push: the count key stays lit beside it.
   */
  refreshTremoloPairSelection(): void {
    bus.tremoloPair.setHighlight(
      tremoloPairHighlight(this.state, this.getEngine()) ? 'tremoloPair' : null,
    )
  }

  /**
   * Push the lit FEATHERED-BEAM direction into {@link bus.fan} — the Keypad's `0` / `.`, and the
   * same {@link fanHighlight} rule the dev toolbar's two buttons read.
   *
   * Engine-read like the tremolo's, and pushed after {@link pressFan} for the same reason: applying a
   * fan writes the SCORE and no top-level state field, so the Proxy never emits and the key would
   * keep lighting the previous answer.
   */
  refreshFanSelection(): void {
    bus.fan.setHighlight(fanHighlight(this.state, this.getEngine()))
  }

  /**
   * Push whether the SUBDIVIDE key is lit into {@link bus.subdivide}. The tie's twin: the rule
   * ({@link secondaryBreakHighlight}, engine-read) is single-sourced with the dev toolbar's `subdivide`
   * button. Called on every state change and after {@link toggleSecondaryBreak}.
   */
  refreshSubdivideSelection(): void {
    bus.subdivide.setHighlight(secondaryBreakHighlight(this.state, this.getEngine()) ? 'subdivide' : null)
  }

  /**
   * Push whether the BEAM-REST key is lit into {@link bus.beamOver} — the inverse of subdivide, it
   * lights for a rest carrying `beamOver` ({@link beamOverHighlight}). Called on every state change and
   * after {@link toggleBeamOver}.
   */
  refreshBeamOverSelection(): void {
    bus.beamOver.setHighlight(beamOverHighlight(this.state, this.getEngine()) ? 'beamOver' : null)
  }

  /**
   * The rest key's press (Keypad `0` / Numpad 0) — the fifth stamp's entry point, and the same
   * shape as its four siblings:
   *
   * 1. the rest stamp is live → the key toggles it OFF, back to selection mode;
   * 2. a DIFFERENT tool is armed → switch to this one (ONE check — see setAccidental);
   * 3. selection mode with something selected → SILENCE it ({@link convertSelectionToRest});
   * 4. selection mode with nothing selected → ARM the stamp;
   * 5. entry mode → arm the stamp too, which is what "place rests instead of notes" IS.
   *
   * (5) is where it parts from the others. They have an entry-mode meaning of their own (arm an
   * accidental for the next note); a rest has none — placing rests with the mouse is not a property
   * of the next note, it is a different thing to place. So the stamp is the answer in both modes.
   */
  pressRest(): void {
    // (1) / (2) — the armed-tool checks come first: they must not read the (cleared) selection.
    if (armedTool(this.state, 'rest')) {
      // Disarm back to where you came FROM. A caret still up means you were typing (arming kept it —
      // see armMarkingTool), and dropping to selection mode there would end keyboard entry, which
      // only PLACING should do. It also made the key look undisarmable: in selection mode a caret
      // note that happens to be a rest — likely, you have been typing rests — reads as "a rest is
      // selected", so `0` lit straight back up and the next press re-armed. It disarmed every time;
      // you could just never see it.
      if (this.state.selectedTool === 'entry' && this.state.selectedNoteId) this.disarmToEntry()
      else this.disarmMarkingTool()
      return
    }
    if (this.state.selectedMarkingTool) {
      this.armRestTool()
      return
    }
    // (3) — something is selected: silence it. Returns false when there was nothing to silence…
    if (this.convertSelectionToRest()) return
    // (4) / (5) — …so the key arms the stamp instead, in either mode.
    this.armRestTool()
  }

  /**
   * Push what the selection already answers about a FEATHER into {@link bus.fanStamp} — how many
   * attacks a collapse would give it, and how long it would last. The Feathered Beam window shows
   * those and refuses to let them be edited; only the direction stays live (his rule). Called on
   * every state change by `keypadSync`, and the store de-dupes.
   */
  refreshFeatherContext(): void {
    bus.fanStamp.setContext(featherContext(this.state, this.getEngine()))
  }

  /**
   * Arm the rest stamp. It carries no value: the armed LENGTH is `selectedDuration`/`selectedDots`,
   * which the duration and dot keys go on setting while it is live (see MARKING_TOOL_USES_ARMED_LENGTH).
   *
   * A FRESH stamp starts from the DEFAULT length. Because the tool reads the armed length rather
   * than carrying its own, it would otherwise inherit whatever happened to be left in those fields —
   * disarm a half-rest stamp, press `0` again, and you are holding a half rest you never asked for,
   * with nothing on screen having said so. The length has to come from somewhere; with nothing
   * selected, the honest somewhere is the default.
   *
   * INHERITED only when the Keypad is actually SHOWING a length — press `5` then `0` and you get the
   * half-rest stamp you just asked for. That is the whole rule, and `durationHighlight` already
   * decides it: a lit duration key means a length is genuinely in play; a dark one means the value in
   * the field is a leftover. Asking the RULE rather than re-deriving "is anything selected" is what
   * keeps the two answers from drifting — the key you can see and the length you get are one fact.
   *
   * READ BEFORE ARMING, deliberately: `armMarkingTool` makes `armedToolUsesLength` true, at which
   * point `durationHighlight` reports the field it is about to be asked to reset. The check would
   * pass every time and the reset would never fire.
   */
  private armRestTool(): void {
    const shownLength = durationHighlight(this.state)
    if (shownLength === null) {
      this.state.selectedDuration = DEFAULT_DURATION
      this.state.selectedDots = DEFAULT_DOTS
    }

    // A REST IS A LENGTH AND NOTHING ELSE. The note-entry extras — an armed accidental, an armed
    // accent/staccato/tenuto — describe a note, and a rest has no pitch to alter and nothing to
    // articulate. The Keypad already DARKENS those keys under this tool, but darkening them only
    // hid the values: they sat in the state, and the moment the tool went (typing a note disarms
    // it) the sharp and the accent came back and landed on a note you never armed them for. Clearing
    // makes the dark keys TRUE instead of a mask — what the panel shows and what the state holds are
    // the same thing.
    //
    // The tie needs no line here: it is a marking tool, so arming this one already replaced it.
    this.state.selectedAccidental = null
    this.state.accent = false
    this.state.staccato = false
    this.state.tenuto = false
    // The beam is the quiet one: a rest is never beamed, and `auto` is its default, so a stale
    // `flat`/`break` never showed on any key — it just waited for the next NOTE and joined it to a
    // group you set up before the rests. Same leak, no symptom until it had one.
    this.state.selectedBeam = DEFAULT_BEAM

    this.armMarkingTool({ kind: 'rest' })
    dbg(`[palette] rest stamp armed | ${this.state.selectedDuration}${'.'.repeat(this.state.selectedDots)}${shownLength === null ? ' (default — nothing was selected)' : ' (kept the selected length)'}`)
  }

  /**
   * Silence the selection — every selected note becomes a rest of its own duration — leaving the
   * resulting rest SELECTED, so the score keeps the place you were working in and the Keypad
   * immediately lights `0` + that duration. That last part is what separates it from Delete, which
   * leaves nothing selected. Returns whether anything was silenced, so {@link pressRest} can fall
   * back to arming the stamp when there was nothing to act on.
   *
   * ONE undo step for the whole selection (`runBatch`), like every other multi-select action.
   *
   * Note this converts at the SLOT's own duration, not the armed one: it is an edit of what is
   * already there. The armed length belongs to the STAMP, which places new rests.
   */
  convertSelectionToRest(): boolean {
    const engine = this.getEngine()
    if (!engine || this.state.selectedTool !== 'selection') return false

    const ids = selectedNoteIds(this.state.selectedItems.values())
      .filter(id => !engine.getNote(id)?.isRest)
    if (!ids.length) return false

    // Converting a CHORD silences the whole slot, so its heads all resolve to the same slot: convert
    // once, and skip any id whose slot a previous conversion already took. Without this, the second
    // head of a selected chord would find a rest (not a note) and quietly no-op — right answer, but
    // by luck; `converted` makes the intent explicit and keeps the count honest.
    const converted: string[] = []
    engine.runBatch(`Convert ${ids.length} note(s) to rest`, () => {
      for (const id of ids) {
        if (engine.getNote(id)?.isRest) continue // slot already silenced by a chord sibling
        const rest = engine.convertToRest(id)
        if (rest) converted.push(rest.id)
      }
    })
    if (!converted.length) return false

    // The LAST rest becomes the selection, matching how the anchor is the last note of a set.
    this.selectNote(converted[converted.length - 1])
    dbg(`[palette] converted ${converted.length} slot(s) to rest — selected ${converted[converted.length - 1]}`)
    this.refreshRestSelection()
    this.renderScore()
    return true
  }
}
