/**
 * ONE PRESS OF A SPAN TOOL'S KEY OR PALETTE ROW, routed by context — what `PaletteController` spelled
 * five times, for the slur, the trill, the octave line, the pedal and the two hairpins
 * (docs/code-shape-plan-2026-09-19.md, Phase 5). The same split the tie key has, which is Sibelius's
 * gesture:
 *
 *  0. THIS tool's stamp is already armed → disarm it. A re-press of an armed tool turns it off, and
 *     falls back to selection mode like every other key-armed stamp.
 *  1. Notes are selected → put the mark over THEM. Create-only: removal is select-the-mark + Delete.
 *  2. Nothing note-like is selected → ARM THE STAMP, whichever mode we are in: the press can only
 *     mean "I meant the tool". Arming IS clearing, so whatever else was armed goes by construction.
 *
 * ⚠️ It is the SET that decides, not the anchor — `selectionHoldsNotes`' rule: after note entry,
 * Select/Esc leaves the cursor note in the anchor with an empty set, and that reads as "nothing
 * selected". The scalar anchor counts only in ENTRY mode, where it IS the cursor note.
 *
 * ⭐ **A re-press matches the whole TOOL, payload included** ({@link SpanToolPress.isArmed}): pressing
 * `8vb` while `8va` is armed, or `Shift+H` while cresc. is, SWAPS the tool rather than turning it
 * off — the other row's stamp falls through to (2), where arming replaces it.
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState, MarkingTool } from './EditorState'
import { armedTool } from './EditorState'
import { selectedNoteIds } from './selection'

/** What the press needs of the palette: the state it routes on and the four things it may do. */
export interface SpanToolHost {
  state: EditorState
  getEngine(): MusicEngine | null
  arm(tool: MarkingTool): void
  disarm(): void
  render(): void
}

/** One span tool's row: what it arms, when it counts as armed, and how it creates. */
export interface SpanToolPress {
  /** The log tag, e.g. `Slur`. */
  tag: string
  /** What step (2) arms. */
  tool: MarkingTool
  /** Is THIS tool — payload included — the armed one? */
  isArmed(state: EditorState): boolean
  /**
   * ⚠️ The slur and the trill ask for the engine BEFORE anything else, so without one they neither
   * arm nor disarm; the ottava, the pedal and the hairpins fetch it only in the CREATE branch —
   * arming and disarming are decisions about the editor's own state and touch no score. Kept as it
   * was found: which of the two is right is a decision, ⛔ not a tidy-up.
   */
  engineFirst?: true
  /** The stamp's name in the "arming the … stamp" log line. */
  stampName: string
  /** Put the mark over the notes. `null` when the model refuses. */
  create(engine: MusicEngine, noteIds: string[]): { id: string } | null
  /** The log line's words for a creation and for a refusal. */
  log: { method: string; made(id: string): string; refused: string }
}

export function pressSpanTool(host: SpanToolHost, row: SpanToolPress): void {
  const { state } = host
  if (row.engineFirst && !host.getEngine()) return
  // (0) a re-press of the armed stamp turns it off
  if (row.isArmed(state)) {
    dbg(`[${row.tag}] stamp disarmed (re-press)`)
    host.disarm()
    return
  }
  // (1) something note-like is selected → the press is about it
  const ids = selectedNoteIds(state.selectedItems.values())
  const noteIds = ids.length
    ? ids
    : (state.selectedTool === 'entry' && state.selectedNoteId ? [state.selectedNoteId] : [])
  if (noteIds.length === 0) {
    // (2) nothing to cover → arm the tool
    dbg(`[${row.tag}] nothing selected → arming the ${row.stampName} stamp`)
    host.arm(row.tool)
    return
  }
  const engine = host.getEngine()
  if (!engine) return
  const created = row.create(engine, noteIds)
  dbg(`[${row.tag}] ${row.log.method} on ${noteIds.length} note(s) → ${created ? row.log.made(created.id) : row.log.refused}`)
  host.render()
}

type OttavaShift = -3 | -2 | -1 | 1 | 2 | 3

/** The rows. ⭐ Two of them take the payload their palette rows differ by. */
export const SPAN_TOOL_PRESSES = {
  slur: (): SpanToolPress => ({
    tag: 'Slur', tool: { kind: 'slur' }, stampName: 'slur', engineFirst: true,
    isArmed: state => !!armedTool(state, 'slur'),
    create: (engine, noteIds) => engine.slur.createSlur(noteIds),
    log: { method: 'createSlur', made: id => `slur ${id}`, refused: 'no valid span' },
  }),
  trill: (): SpanToolPress => ({
    tag: 'Trill', tool: { kind: 'trill' }, stampName: 'trill', engineFirst: true,
    isArmed: state => !!armedTool(state, 'trill'),
    create: (engine, noteIds) => engine.trill.createTrill(noteIds),
    log: { method: 'createTrill', made: id => `trill ${id}`, refused: 'no valid anchor' },
  }),
  pedal: (): SpanToolPress => ({
    tag: 'Pedal', tool: { kind: 'pedal' }, stampName: 'pedal',
    isArmed: state => !!armedTool(state, 'pedal'),
    create: (engine, noteIds) => engine.pedal.createPedal(noteIds),
    log: { method: 'createPedal', made: id => `pedal ${id}`, refused: 'no valid anchor' },
  }),
  ottava: (shift: OttavaShift): SpanToolPress => ({
    tag: 'Ottava', tool: { kind: 'ottava', shift }, stampName: shift > 0 ? '8va' : '8vb',
    isArmed: state => armedTool(state, 'ottava')?.shift === shift,
    create: (engine, noteIds) => engine.ottava.createOttava(noteIds, shift),
    log: { method: 'createOttava', made: id => `ottava ${id}`, refused: 'no valid anchor' },
  }),
  hairpin: (type: 'cresc' | 'dim'): SpanToolPress => ({
    tag: type === 'cresc' ? 'Cresc' : 'Dim', tool: { kind: 'hairpin', type }, stampName: type,
    isArmed: state => armedTool(state, 'hairpin')?.type === type,
    create: (engine, noteIds) => engine.hairpin.createHairpin(noteIds, type),
    log: { method: 'createHairpin', made: id => id, refused: 'no valid span' },
  }),
}
