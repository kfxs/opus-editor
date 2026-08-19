import type { Accidental, NoteDuration, BeamMode, Clef, TimeSignature, DynamicLevel, ArticulationType, Fraction, TupletFormat, TremoloMark } from '../types/music'
import { deriveTupletM } from '../utils/musicUtils'
import type { SelectionItem } from './selection'
import type { ViewMode } from '../engine/rendering/layoutConfig'

/** A value armed on the dynamics palette: an interpreted level, or the custom-text tool. */
export type DynamicTool = DynamicLevel | 'text'

/**
 * A tempo mark armed on the palette, ready to be placed by the next canvas click. The
 * palette's preset words pre-FILL this (they are not an enum of legal values — the word is
 * free text, see decision D2), and the metronome builder fills unit/dots/bpm. It carries
 * everything except the beat, which the click supplies.
 */
export type TempoTool = {
  text?: string
  unit?: NoteDuration
  dots?: number
  bpm?: number
  showMetronome?: boolean
}

export type ToolMode = 'entry' | 'selection'
export type PlaybackState = 'stopped' | 'playing' | 'paused'

/**
 * The tool armed for placement — ONE of eight, or none. Arming one switches to entry mode, hides the
 * keyboard cursor, previews itself as a ghost at the pointer, and makes the next canvas click place
 * or stamp rather than enter a note.
 *
 * WHY ONE FIELD. These were eight independent fields (`selectedClef`, `selectedTieTool`, …). They are
 * mutually exclusive, but nothing said so: the type could express "the tie and the dot are both
 * armed" — a sentence with no meaning — and the only thing preventing it was eight arm-sites each
 * remembering to clear the other seven, plus every press handler naming its siblings to switch. That
 * is N² edits to keep in sync, and a missed one is SILENT. It bit us: `dac5f42` fixed a press that
 * armed TWO tools, because the check had been written naming only the sibling that existed that day.
 *
 * Holding the armed tool in one value makes the illegal states unrepresentable rather than merely
 * unreached: arming IS clearing, so there is nothing to keep in sync. Dispatch by `switch (t.kind)`
 * with an exhaustiveness check ({@link assertNeverTool}) and a NINTH tool cannot be added without the
 * compiler naming every site that must handle it.
 *
 * The two "stamp value" kinds carry what they arm; the two valueless stamps carry nothing, because
 * there is nothing to carry (a note is tied, or it is not).
 */
export type MarkingTool =
  /** `cautionary` rides along for the same reason the time signature's does: the dialog decides it
   *  and the target bar is not known until the click. */
  | { kind: 'clef'; clef: Clef; cautionary?: boolean }
  /** `cautionary` rides along because the decision is made in the DIALOG and the target bar is not
   *  known until the click — so it has nowhere else to wait. It is a property of the change that is
   *  about to be made, which is exactly what an armed stamp is. */
  | { kind: 'timeSignature'; timeSignature: TimeSignature; cautionary?: boolean; pickup?: Fraction | null }
  | { kind: 'dynamic'; dynamic: DynamicTool }
  | { kind: 'tempo'; tempo: TempoTool }
  /** ADDITIVE: pressing another articulation key grows the set; all get stamped together. Emptying
   *  it disarms. Distinct from the `accent`/`staccato`/`tenuto` flags, which arm for the next note
   *  ENTERED — this stamps notes that already exist. */
  | { kind: 'articulation'; types: ArticulationType[] }
  /** SINGLE-valued: a note has one accidental state, so a different key SWAPS rather than stacks.
   *  Distinct from `selectedAccidental`, which arms for the next note ENTERED. */
  | { kind: 'accidental'; sign: Accidental }
  /** SINGLE-valued for the accidental's reason: a note carries ONE tremolo, so pressing another
   *  mark swaps it. Marks notes that already have their length, like the accidental stamp.
   *  Distinct from {@link EditorState.selectedTremolo}, which arms the mark for the next note
   *  ENTERED — the same split the accidental has. See docs/tremolo-plan.md §2 and §10. */
  | { kind: 'tremolo'; tremolo: TremoloMark }
  /** VALUELESS — a note ties to the next slot or it does not. */
  | { kind: 'tie' }
  /** VALUELESS — the UI's dot is on or off. The one stamp that also applies to RESTS. */
  | { kind: 'dot' }
  /** VALUELESS, but not for the others' reason: a rest is nothing WITHOUT a length, so rather than
   *  carry its own it READS the armed one (`selectedDuration` + `selectedDots`) — the very fields the
   *  duration and dot keys already set. One source of truth: a `{ duration }` here would be a second
   *  copy to keep in step, which is the N² problem this union was built to delete. It is why this is
   *  the only tool the note-entry keys stay LIVE under — see {@link MARKING_TOOL_USES_ARMED_LENGTH}. */
  | { kind: 'rest' }
  /**
   * ⭐ The FEATHER stamp, armed by the Feathered Beam window's OK — a click places ONE note carrying
   * a fan of `attacks` attacks over that note's own written length.
   *
   * It carries its OWN length (`unit` + `dots`) where the rest stamp reads the armed one, and the
   * difference is not a style choice: a rest tool is armed by a KEY, beside the duration keys that
   * are still lit and still working, so reading them is reading what you can see. This tool is armed
   * by a DIALOG in which you have just said, in as many words, how long the gesture lasts. Taking
   * that from `selectedDuration` instead would make the dialog's own answer a suggestion the next
   * press of `3` could quietly overrule — hence `false` in {@link MARKING_TOOL_USES_ARMED_LENGTH}.
   *
   * `direction` is the model's own (`FanMark.direction`), so nothing between here and `setFan`
   * translates it.
   */
  | { kind: 'fan'; attacks: number; unit: NoteDuration; dots: number; direction: 'accel' | 'rit' }
  /** VALUELESS — Ctrl+E with nothing selected. The click-to-type expression tool: it places a
   *  custom-text dynamic and opens the inline editor BLANK (no placeholder to clear), rather than
   *  dropping a placeholder like `{ kind:'dynamic'; dynamic:'text' }`. It previews NO ghost — a blue
   *  cursor signals placement instead — so it is the one marking tool with nothing to draw at the
   *  pointer. Always the custom-text/inline flavour, so it carries nothing. See
   *  MouseController.placeDynamicEntryAtClick. */
  | { kind: 'dynamicEntry' }
  /**
   * VALUELESS — the SLUR stamp, armed by `s` (or the Lines palette) with no notes selected. A slur
   * is a relation between notes that already exist, so there is nothing to carry: WHICH notes it
   * spans is resolved at click time, exactly as the tie stamp's is.
   *
   * It previews NO ghost — the blue pointer says "click a note to place one" — because a slur is
   * drawn between two notes and there is no such pair until the click picks the first. See
   * {@link scoreCursorClass} and `interactions/slurStamp.ts`.
   */
  | { kind: 'slur' }
  /**
   * The HAIRPIN stamp, armed by `H` (cresc.) / `Shift+H` (dim.) — or the Lines palette — with
   * nothing selected. A click on a note places a wedge from it through the end of the next slot.
   *
   * ⭐ It CARRIES ITS TYPE, where the slur beside it carries nothing, and the difference is real:
   * `cresc` and `dim` are two tools with two keys and two palette rows, not one tool with a
   * setting. Arming the other one must replace this (which `armMarkingTool` does by reassigning the
   * field), and the palette's two buttons must be able to light independently.
   *
   * ⛔ NO ghost — the blue pointer, like the slur, and for the slur's reason: a wedge is drawn
   * BETWEEN two points and the click has only picked one, so a ghost wedge at the pointer would be
   * previewing a length the click is not going to make. See {@link scoreCursorClass} and
   * `interactions/hairpinStamp.ts`.
   */
  | { kind: 'hairpin'; type: 'cresc' | 'dim' }
  /**
   * The OTTAVA stamp, armed from the Lines palette with nothing selected. A click on a note puts an
   * octave line over that note.
   *
   * ⭐ **It CARRIES ITS SHIFT**, like the hairpin beside it and for the hairpin's reason: `8va` and
   * `8vb` are two tools with two palette rows that must light independently, not one tool with a
   * setting. ⚠️ Signed and ranged exactly as `Ottava.shift`, so `15ma` is a third row and not a
   * second field — the same "one signed number IS the statement" the model rests on.
   *
   * ⛔ It carries no LENGTH: a click's line covers the note it lands on, and a longer one takes its
   * extent from the notes it is placed over — never from the armed duration (`false` in
   * {@link MARKING_TOOL_USES_ARMED_LENGTH}).
   *
   * ⭐ It DOES ghost — the NUMERAL follows the pointer (`engine/rendering/OttavaGhost.ts`), so this
   * tool is NOT in {@link scoreCursorClass}'s blue-pointer list. His call, 2026-08-17, the day after
   * the trill's and in the same words (*"same thing"*), and this is the tool it helps most: two
   * palette rows differing in one signed number armed IDENTICALLY behind a blue caret. ⛔ The
   * BRACKET is not previewed — a dashed line has a length the click has not picked. See
   * {@link toolGhost} and `interactions/ottavaStamp.ts`.
   */
  | { kind: 'ottava'; shift: -3 | -2 | -1 | 1 | 2 | 3 }
  /**
   * VALUELESS — the TRILL stamp, armed from the Lines palette with nothing selected. A click on a
   * note trills that note.
   *
   * It carries nothing, unlike the hairpin beside it: `cresc` and `dim` are two tools, but there is
   * only one trill. And it carries no LENGTH either — a one-note trill is a finished ornament whose
   * extent comes from the ties, so there is nothing for a click to size (`false` in
   * {@link MARKING_TOOL_USES_ARMED_LENGTH}).
   *
   * ⭐ It DOES ghost — a `tr` follows the pointer (`engine/rendering/TrillGhost.ts`), and so it is
   * NOT in {@link scoreCursorClass}'s blue-pointer list. It was, until his call of 2026-08-17: the
   * old reading was that a trill is drawn ABOVE music the click has not picked, so a ghost would
   * preview a position nothing has chosen — but what the cursor has to say is WHAT the click makes.
   * See {@link toolGhost} and `interactions/trillStamp.ts`.
   *
   * ⛔ And no keyboard shortcut arms it — his call, 2026-08-13. See docs/trill-plan.md §6.
   */
  | { kind: 'trill' }
  /**
   * VALUELESS — the SUSTAIN PEDAL stamp, armed from the Lines palette with nothing selected. A click
   * on a note puts a pedal under it, held through that note.
   *
   * It carries nothing, like the trill above and unlike the two hairpin rows: `cresc` and `dim` are
   * two tools with two buttons, but there is only one sustain pedal — sostenuto and una corda, when
   * they come, are two more ROWS and a `type` on the model, not a field here.
   *
   * ⛔ It carries no LENGTH either: a click's pedal holds the note it lands on, and a longer one
   * takes its extent from the notes it is placed over — never from the armed duration (`false` in
   * {@link MARKING_TOOL_USES_ARMED_LENGTH}).
   *
   * ⭐ It DOES ghost — `Ped.` follows the pointer (`engine/rendering/PedalGhost.ts`), parked BELOW it
   * since that is the side of the staff the mark goes, so this tool is NOT in
   * {@link scoreCursorClass}'s blue-pointer list. His call, 2026-08-17, completing the ladder family
   * the trill and the ottava started that day. ⛔ The LIFT (`✻`) is not previewed — a pedalling has a
   * length the click has not picked. See {@link toolGhost} and `interactions/pedalStamp.ts`.
   *
   * ⛔ And no keyboard shortcut arms it — his call, the trill's and the ottava's. Sibelius spells it
   * `P`, and ours is taken: `p` is PLAY (docs/pedal-plan.md §7).
   */
  | { kind: 'pedal' }
  /** VALUELESS — Ctrl+Alt+T with nothing selected. The tempo twin of `dynamicEntry`: places a
   *  placeholder tempo mark and opens the edit box BLANK to type the whole mark. Same NO-ghost +
   *  blue-cursor treatment. See MouseController.placeTempoEntryAtClick. */
  | { kind: 'tempoEntry' }

/**
 * The length the editor starts from, and returns to. A quarter, undotted — the value
 * `createEditorState` mints, `PaletteController.resetToDefaults` restores, and a fresh rest stamp
 * arms with. It was written out at each of those sites; naming it is what makes "the default
 * duration" a thing the code can say rather than three `'q'`s that happen to agree.
 */
export const DEFAULT_DURATION: NoteDuration = 'q'
export const DEFAULT_DOTS = 0
/** Beaming left to the engraver — the value `createEditorState` mints and `resetToDefaults` restores. */
export const DEFAULT_BEAM: BeamMode = 'auto'

/**
 * Does the armed tool USE the note-entry armed length (`selectedDuration` + `selectedDots`)?
 *
 * This is the ONE question that decides whether the duration and dot keys stay live while a tool is
 * armed. The answer used to be "never": every marking tool arms into entry mode but enters no note,
 * so a lit duration key would claim a quarter note was coming while what was really armed was a clef
 * (`92fbe3d`). The rest tool is the first counter-example — a rest IS a duration, so its keys must
 * keep working, and pressing one must retune the armed rest instead of ending it.
 *
 * A Record and not `kind === 'rest'`, for the reason `MEASURE_RENDER_ROLE` is one: a tenth tool
 * cannot be added without answering this, and the answer is not guessable from the outside. An
 * earlier list of "the stamp kinds" encoded no real distinction and rotted; this one encodes a real
 * property — does the tool have a length of its own to place?
 */
export const MARKING_TOOL_USES_ARMED_LENGTH: Record<MarkingTool['kind'], boolean> = {
  rest: true,        // a rest is nothing without a length
  fan: false,        // ALSO a length — but its OWN, typed in the dialog that armed it (see the member)
  clef: false,       // the four below place OBJECTS — a length means nothing to them
  timeSignature: false,
  dynamic: false,
  dynamicEntry: false, // places a text mark; a length means nothing to it (like `dynamic`)
  tempo: false,
  tempoEntry: false, // places a tempo mark; a length means nothing to it (like `tempo`)
  articulation: false, // the four stamps mark notes that ALREADY have their length
  accidental: false,
  tie: false,
  slur: false,        // a relation between notes that already have their lengths, like the tie
  trill: false,       // ⭐ a one-note trill is COMPLETE, and a longer one takes its extent from the
                      //    notes it is placed over — never from the armed duration
  ottava: false,      // ⭐ it HAS a length — the MUSIC's, taken from the notes it is placed over.
                      //    Identical to the hairpin below, and for exactly the same reason.
  pedal: false,       // ⭐ …and so does the pedal, on the same terms: how long the damper is down is
                      //    a fact about the music it is placed over, ⛔ never the lit duration keys.
  hairpin: false,     // ⭐ it HAS a length — but a MUSICAL one, taken from the notes it is placed
                      //    over, never from the armed duration. The rest stamp's `true` means "read
                      //    the lit duration keys"; a hairpin never does.
  dot: false,
  tremolo: false,     // marks a note that already has its length, like the accidental stamp
}

/**
 * The armed tuplet's NORMAL side, in the shape the creation calls take — or `undefined`, which is
 * both "nothing armed" and "both sides are the same note value" (they are the same instruction to
 * `createTuplet`, which is why one helper covers both).
 *
 * A free function so the two entry sites — mouse and keyboard — cannot spell the unwrapping
 * differently, which is how one of them ends up quietly dropping the field.
 */
export function armedNormalSide(
  armed: EditorState['armedTuplet'],
): { duration: NoteDuration; dots?: number; count?: number } | undefined {
  if (!armed?.normalDuration) return undefined
  return { duration: armed.normalDuration, dots: armed.normalDots, count: armed.normalCount }
}

/**
 * SPEND the armed tuplet: a tuplet that has just been created is no longer waiting to be created.
 *
 * A tuplet arms like a stamp but is not used like one. A stamp stays armed because you place several
 * — five staccatos, three clefs — and each press is a whole act. A tuplet's press builds a GROUP, and
 * what you do next is fill it: the notes after the first belong INSIDE the group you just made, and
 * they get there through the ordinary entry path (which joins the tuplet at that beat). Left armed,
 * the next click outside the group silently starts a SECOND tuplet — a ratio you set once and got
 * twice.
 *
 * Only on success. A refused placement has spent nothing, and disarming there would make a
 * mis-aimed click cost you the setting.
 *
 * Reassigned, never mutated — the observable Proxy traps the SET (see the note at the top of this
 * file). A free function for the same reason {@link armedNormalSide} is one: two entry sites, one
 * rule, spelled once.
 */
export function spendArmedTuplet(state: EditorState): void {
  state.armedTuplet = null
}

/**
 * The armed tuplet's M **for the bar it is about to land in** — derived from the meter when the
 * arming asked for that, and otherwise exactly what was armed.
 *
 * A free function for the same reason {@link armedNormalSide} is one: the mouse, the keyboard and the
 * ghost all have to answer it identically, and the ghost showing `5:4` over a bar that will get 5:3
 * is a preview of a different tuplet.
 *
 * The fallback is the point of `Ctrl+2` in 4/4: the meter has no duplet, so the rule declines, and
 * the preset's own 2:3 is armed instead — an unusual tuplet, deliberately chosen, and the mark says
 * so by printing the ratio (see `autoNumberStyle`).
 */
export function armedTupletM(
  armed: NonNullable<EditorState['armedTuplet']>,
  unit: NoteDuration,
  unitDots: number,
  meter: TimeSignature,
  beat: Fraction,
): number {
  if (!armed.deriveM) return armed.notesOccupied
  return deriveTupletM(armed.numNotes, unit, unitDots, meter, beat) ?? armed.notesOccupied
}

/** Whether the armed tool (if any) uses the armed length — see {@link MARKING_TOOL_USES_ARMED_LENGTH}.
 *  False with nothing armed: the keys are live then for the ordinary reason (note entry). */
export function armedToolUsesLength(state: EditorState): boolean {
  const tool = state.selectedMarkingTool
  return tool ? MARKING_TOOL_USES_ARMED_LENGTH[tool.kind] : false
}

/**
 * The armed tool IF it is of `kind`, else null — the read half of {@link MarkingTool}, typed so the
 * payload narrows: `armedTool(state, 'clef')?.clef` is a `Clef`. Prefer narrowing on `.kind`
 * directly inside a dispatch; this is for the one-kind-or-nothing reads (a palette button asking
 * "am I the armed one?").
 */
export function armedTool<K extends MarkingTool['kind']>(
  state: EditorState,
  kind: K,
): Extract<MarkingTool, { kind: K }> | null {
  const tool = state.selectedMarkingTool
  return tool?.kind === kind ? (tool as Extract<MarkingTool, { kind: K }>) : null
}

/** Compile-time exhaustiveness: a `switch` over {@link MarkingTool} that forgets a kind fails to
 *  build here, which is what makes adding a ninth tool safe instead of a memory test. */
export function assertNeverTool(tool: never): never {
  throw new Error(`Unhandled marking tool: ${JSON.stringify(tool)}`)
}

/** Which OPEN join of a cross-system slur is armed for keyboard nudging — set by clicking an
 *  orange segment-endpoint square (docs/multisystem-slur-segment-endpoint-offset-plan.md). */
export type SlurSegmentEndpoint =
  | { role: 'begin' }
  | { role: 'end' }
  | { role: 'middle'; ordinal: number; side: 'left' | 'right' }

/**
 * WHICH round (amber) shape handle is picked — the pair of Bézier control points that bend the arc.
 *
 * ⭐ Addressed by SEGMENT, not just by index: a cross-system slur draws its own pair of dots per
 * segment, so `cpIndex` alone would light up one dot on every system at once. `segmentRole` absent
 * means the single-arc case, which has exactly one pair. (Same address the drag already reads off
 * the handle — `MouseController.handleSlurHandleMouseDown` — so nothing new is being derived.)
 */
export interface SlurControlPointHandle {
  cpIndex: 0 | 1
  segmentRole?: 'begin' | 'middle' | 'end'
  segmentOrdinal?: number
}

/**
 * The ONE on-score element that is selected, or none — the single-select half of the selection.
 *
 * WHY ONE FIELD, the same argument as {@link MarkingTool} one axis over. These were twenty-odd
 * independent scalars (`selectedClefMeasure`, `selectedDynamicId`, `selectedSlurId`, …). They are
 * mutually exclusive — you have picked a clef, or a dynamic, or a barline, never two — but nothing
 * said so, and the only thing preventing "the dynamic and the tie are both selected" was FOUR
 * hand-maintained clear-lists covering different subsets of the fields, in four different files.
 *
 * They had already diverged, exactly as the marking tools did before their union: `selectNotes` →
 * `clearScalarSubSelections` named seventeen fields and missed the dynamic, the tempo mark and the
 * tuplet, so replacing the selection with notes left a picked dynamic selected — highlighted, and
 * still what Delete would act on. Nothing was wrong with any one of those lists; there were four.
 *
 * Holding it in one value makes that unrepresentable rather than merely unreached: **selecting IS
 * clearing**, so there is nothing to keep in sync, and the four lists collapse to `= null`. Dispatch
 * by `switch (el.kind)` with an exhaustiveness check ({@link assertNeverElement}) — a fifteenth kind
 * cannot be added without the compiler naming every site that must handle it.
 *
 * ⛔ **Notes are deliberately NOT here.** `selectedItems` / `selectedNoteId` / `selectionPivotId` /
 * `selectionBase` stay their own thing: notes are a genuine MULTI-selection with an anchor and a
 * pivot, and the kinds below are single-select. Folding them together would destroy that
 * distinction rather than clarify it. Two of the kinds below (`articulation` and `measureRange`)
 * ride ALONGSIDE the set — the union field is their anchor, exactly as `selectedNoteId` is the
 * note set's.
 *
 * ⚠️ Always REASSIGNED, never mutated in place: the observable Proxy traps the SET on
 * `selectedElement`, so `state.selectedElement.endpoint = 'start'` changes the value and tells
 * nobody. Read it by narrowing on `.kind`, or with {@link selectedOf} for one-kind-or-nothing.
 */
export type SelectedElement =
  /** A clef change, addressed POSITIONALLY — there is no clef object to hold an id, so the
   *  (measure, beat, staff) triple IS the identity. `beat` 0 is the opening clef. */
  | { kind: 'clef'; measure: number; beat: number; staff: number }
  /** The on-score time-signature glyph in a measure. Distinct from the armed
   *  `{ kind: 'timeSignature' }` MARKING tool (the meter waiting to be placed). */
  | { kind: 'timeSignature'; measure: number }
  /**
   * The line that ENDS this measure.
   *
   * Positional, and with no staff, because a barline has no object in the model at all: the
   * `measures` array IS the barline spine, so what is selected is a BOUNDARY. And it is one line
   * per system, not per staff: a barline is a system-wide statement like the time signature (which
   * is why the highlight paints every staff of the measure), unlike a clef, which each staff
   * states for itself.
   */
  | { kind: 'barline'; measure: number }
  /** An on-score dynamic, selected for removal/edit. Distinct from the armed
   *  `{ kind: 'dynamic' }` marking tool. */
  | { kind: 'dynamic'; id: string }
  /** An on-score tempo mark, selected for removal/edit. Distinct from the armed
   *  `{ kind: 'tempo' }` marking tool. */
  | { kind: 'tempo'; id: string }
  | { kind: 'tuplet'; id: string }
  /**
   * An on-score slur, plus WHICH of its handles (if any) the arrows nudge.
   *
   * `endpoint` is a true end (a blue square); `segmentEndpoint` is an OPEN join of a cross-system
   * slur (an orange one); `controlPoint` is a round SHAPE handle. All three are mutually exclusive —
   * picking one drops the others — which is now one object's business rather than fields that had
   * to be cleared together at seven sites. `segmentSpanCount` is the live system count captured when
   * the join was armed, passed to `nudgeSlurSegmentEndpoint` as the override's reset signature.
   *
   * ⭐ `controlPoint` began as a field to be SEEN rather than nudged — grabbing a round handle
   * already disarmed whatever square was armed, and the only thing missing was that nothing on
   * screen said which dot you had picked (his ask, 2026-08-17). The arrows reached the curve dots
   * later the same day (`./slurHandleNudge`), and they read exactly this field.
   */
  | {
      kind: 'slur'
      id: string
      endpoint?: 'start' | 'end'
      segmentEndpoint?: SlurSegmentEndpoint
      segmentSpanCount?: number
      controlPoint?: SlurControlPointHandle
    }
  /**
   * A hairpin wedge, by id — plus WHICH END (if any) is armed.
   *
   * ⭐ `endpoint` arrived 2026-08-17 with the two blue squares a selected wedge now draws, reached by
   * clicking one or by Tab (`./elements/hairpinHandles`). ⛔ It arms NOTHING yet: a hairpin's extent
   * is MUSICAL — `Ctrl+←/→` rewrites `length` on the model rather than nudging a cosmetic offset
   * (docs/dynamics-line-and-hairpins-plan.md §4) — so unlike the slur's `endpoint` there is no
   * override behind it. It is the selection an edit would read when there is one to make.
   */
  | { kind: 'hairpin'; id: string; endpoint?: 'start' | 'end' }
  /**
   * A TRILL, by id — plus WHICH END (if any) is armed.
   *
   * ⭐ `endpoint` arrived 2026-08-18 with the two blue squares a selected trill now draws, reached by
   * clicking one or by Tab (`./elements/trillHandles`) — the fifth span to get the pair, after the
   * slur, the wedge, the bracket and the pedal. ⛔ It arms NOTHING yet.
   *
   * ⭐⭐ **And when it does, it will be the SLUR's road, not the pedal's**: a trill's two anchors are
   * NOTES (`startNoteId` and an optional `endNoteId`), where a hairpin's, an ottava's and a pedal's
   * are positions in time. So an edit off one of these squares re-anchors to a neighbouring note
   * (`setTrillEnd`), never to a beat.
   *
   * ⚠️ There is no `placement` here even though the model carries one: `x` flips it on the MODEL,
   * exactly as it flips a hairpin's type, so nothing about the side needs to live in the selection.
   */
  | { kind: 'trill'; id: string; endpoint?: 'start' | 'end' }
  /**
   * An OCTAVE LINE — the numeral and its dashed bracket — plus WHICH END (if any) is armed.
   *
   * The id is the whole address, the trill's and hairpin's shape: everything about the line (which
   * staff, how much music, which way) is on the stored object, and ⭐ unlike every other span here
   * it has no VOICE to carry — an ottava governs the whole staff (see `Ottava.staffId`).
   *
   * ⭐ `endpoint` arrived 2026-08-17 with the two blue squares a selected bracket now draws, reached
   * by clicking one or by Tab (`./elements/ottavaHandles`). ⛔ It arms NOTHING yet — the hairpin's
   * own first step, and the same reason to expect the same answer later: a bracket's extent is
   * MUSICAL (which notes are displaced), so an edit off one of these squares would rewrite
   * `beat`/`length` on the model rather than nudge a cosmetic offset.
   */
  | { kind: 'ottava'; id: string; endpoint?: 'start' | 'end' }
  /**
   * A SUSTAIN PEDAL — `Ped.` and its release `✻` — plus WHICH END (if any) is armed. Named by id,
   * the ottava's shape and for its reasons: everything about it (which staff, how much music) is on
   * the stored object, and it has no VOICE — one damper serves the whole staff.
   *
   * ⚠️ **The id names the PEDAL, not the sign that was clicked**, and that is deliberate: the two
   * glyphs register separately so a press can only land on ink (docs/pedal-plan.md §6.2), but they
   * are one statement, so pressing either selects the whole thing.
   *
   * ⭐ `endpoint` arrived 2026-08-18 with the two blue squares a selected pedal now draws, reached by
   * clicking one or by Tab (`./elements/pedalHandles`) — the ottava's row verbatim, and ⛔ it arms
   * NOTHING yet. ⚠️ It is not how the pedal is EDITED today either: `Ctrl+←/→` moves the LIFT
   * whichever glyph you picked and whether or not a square is armed (`resizeSelectedPedal`), which
   * predates these squares. So a selection with no `endpoint` is the ordinary one, not a degenerate
   * case.
   *
   * ⛔ And no `placement`, unlike the trill's row: a pedal is always below, so `x` has nothing to
   * flip.
   */
  | { kind: 'pedal'; id: string; endpoint?: 'start' | 'end' }
  /** A tie arc, named by the note it starts FROM (a tie is a property of that note). */
  | { kind: 'tie'; fromNoteId: string }
  /**
   * A whole articulation GROUP on one note (Sibelius-style: clicking one glyph picks them all).
   * `type` is the clicked glyph, carried for context; `null` means the group as a whole, which is
   * what every current selection path sets.
   *
   * Rides ALONGSIDE `selectedItems`, which holds the multi-selection of groups — this is its
   * ANCHOR, the last group added, exactly as `selectedNoteId` is the note set's.
   */
  | { kind: 'articulation'; noteId: string; type: string | null }
  /** An accidental glyph, named by its note plus which sign was drawn. */
  | { kind: 'accidental'; noteId: string; type: string | null }
  /**
   * A slot's augmentation DOTS. ONE id for ALL of them: `dots` is a single value on the
   * `Chord`/`Rest` (it modifies the duration), even though VexFlow draws one dot per notehead per
   * dot — so a chord's dots select and delete together, and "dot one head of a chord" has no
   * representation. Holds the chord's lowest pitch id (the anchor its dots register against, like
   * articulations) or a rest's own id — a rest IS its slot. No companion count: it is read live off
   * the note, exactly as the tie is read off `tiedTo`.
   */
  | { kind: 'dot'; noteId: string }
  /**
   * A slot's STEM — the anchor note id the stem registers against. A chord has ONE stem, anchored
   * on its lowest pitch, exactly as its dots and articulations are, so "the stem of one head of a
   * chord" has no representation.
   *
   * Selection ONLY, for now: nothing acts on a selected stem (no delete, no flip — `x` still flips
   * from the note). It is the pointer half of what already exists on the render side, where the
   * stem is a registered element with its own ink rect (ElementRegistry `'stem'`); a stem-length
   * drag is the obvious next thing to hang off it.
   */
  | { kind: 'stem'; noteId: string }
  /**
   * A slot's TREMOLO mark — the anchor note id, like the stem it rides. A slot carries ONE tremolo
   * (`setTremolo` replaces, never stacks), so there is one mark to select however many strokes it
   * draws. Its mutual exclusion with the stem used to be a comment on two fields; it is now the
   * union's doing (the marks overlap on screen and the click resolves which one you meant).
   */
  | { kind: 'tremolo'; noteId: string }
  /**
   * A contiguous run of MEASURES outlined by a blue box — a selection of bars, not of anything
   * inside them. `anchor`/`focus` hold the span's low/high bounds (every measure between them
   * inclusive). `staff` is the 0-based staff the box-select landed on — the reference staff the
   * "Staff: + Above / + Below" buttons insert relative to.
   *
   * `boxStyle` picks which box, and they are different gestures: `'double'` is the visual-only
   * Ctrl+Shift+click marker (two nested rectangles, NO objects selected), and a repeat
   * Ctrl+Shift+click GROWS the span — it only ever gets bigger. `'single'` is the Sibelius-style
   * plain-click passage selection: ONE rectangle around a single bar whose contents (notes/rests +
   * enclosed dynamics/slurs) ARE selected — so this one rides alongside a populated
   * `selectedItems`, like the articulation anchor above.
   */
  | { kind: 'measureRange'; anchor: number; focus: number; staff: number; boxStyle: 'single' | 'double' }

/**
 * The selected element IF it is of `kind`, else null — the read half of {@link SelectedElement},
 * typed so the payload narrows: `selectedOf(state, 'slur')?.endpoint` is a slur endpoint. Prefer
 * narrowing on `.kind` directly inside a dispatch; this is for the one-kind-or-nothing reads (a
 * command asking "is a barline what's selected?"). The twin of {@link armedTool}.
 */
export function selectedOf<K extends SelectedElement['kind']>(
  state: EditorState,
  kind: K,
): Extract<SelectedElement, { kind: K }> | null {
  const el = state.selectedElement
  return el?.kind === kind ? (el as Extract<SelectedElement, { kind: K }>) : null
}

/**
 * ⭐ **Every id of `kind` that is selected — from BOTH halves of the selection**: the single-click
 * `selectedElement` and the `selectedItems` set a passage box fills. The two are deliberately
 * separate ({@link SelectedElement}'s note), so a command that acts on "the selected hairpins" has
 * to ask both, and asking only one is a bug that hides until someone drags a box.
 *
 * ⚠️ Kinds addressed by something other than an `id` (a clef's triple, a tie's start note) are not
 * reachable here — `'id' in x` is the gate, and they have their own readers.
 *
 * Lifted out of `HighlightController`, where it was private, when `markVoiceScope` needed the same
 * question (docs/dynamic-voice-scope-plan.md P4). ⛔ Not copied: two answers to "what is selected"
 * is exactly the drift this file exists to prevent.
 */
export function selectedIdsOf(state: EditorState, kind: SelectionItem['kind']): Set<string> {
  const ids = new Set<string>()
  const element = state.selectedElement
  if (element?.kind === kind && 'id' in element) ids.add(element.id)
  for (const item of state.selectedItems.values()) {
    if (item.kind === kind && 'id' in item) ids.add(item.id)
  }
  return ids
}

/** Compile-time exhaustiveness: a `switch` over {@link SelectedElement} that forgets a kind fails
 *  to build here, which is what makes adding a fifteenth kind safe instead of a memory test. */
export function assertNeverElement(element: never): never {
  throw new Error(`Unhandled selected element: ${JSON.stringify(element)}`)
}

/**
 * The score canvas's cursor, DERIVED from state — the one place the cursor decision lives, so the
 * view only binds the result. Framework-agnostic on purpose: the class names are the layer contract
 * (the app applies them to the score box and supplies the matching styles), and the rule
 * — panning hides the pointer; a tool that places WITHOUT a ghost shows the blue pointer; otherwise
 * the default arrow — is not something the template should reimplement inline. Returns a class
 * name, not a boolean, so a fourth cursor never means touching the view again.
 *
 * ⭐ THE BLUE POINTER IS THE GHOSTLESS TOOL'S GHOST. Every other armed tool draws a preview at the
 * pointer and needs no cursor to say it is armed; these three have nothing to draw — the two
 * click-to-type entry tools (expression Ctrl+E, tempo Ctrl+Alt+T) because the mark is text you have
 * not typed yet, the slur stamp because a slur is drawn between two notes and the click has not
 * picked the first. So the TOOLS here are exactly {@link toolGhost}'s `null` cases, which is why the
 * class is no longer named for text. Keep the two in step: a tool with no ghost and no pointer is
 * armed invisibly.
 *
 * ⚠️ One entry below is NOT a tool: an armed PASTE (2026-08-19). It draws nothing at the pointer
 * either — the dashed caret it used to trail was dropped on his call — so it wants the same cursor
 * for the same reason, and `toolGhost` has nothing to say about it.
 */
export function scoreCursorClass(state: EditorState): 'cursor-none' | 'cursor-place' | 'cursor-default' {
  if (state.isPanning) return 'cursor-none'
  // ⭐ An armed PASTE is a ghostless placement too (2026-08-19), and the most ghostless of all: it
  // draws NOTHING at the pointer — *"we dont need the green carret, just the arrow"* — so the blue
  // cursor is its ONLY indicator. Ahead of the tools, because a paste can be armed while one is.
  if (state.pastePlacementArmed) return 'cursor-place'
  const kind = state.selectedMarkingTool?.kind
  // ⚠️ Every GHOSTLESS stamp must be listed here, and the list is why: these tools draw nothing at
  // the pointer, so the blue cursor is their ONLY indicator that something is armed. A tool added to
  // `toolGhost`'s `return null` arm and forgotten here arms invisibly.
  // ⚠️ The whole LADDER family left this list on 2026-08-17 — trill, ottava, pedal all grew ghosts
  // (see {@link toolGhost}) — and a tool that draws at the pointer must not ALSO take the
  // place-cursor: two indicators for one armed tool, the blue caret sitting on the very glyph it
  // stood in for. What is left are the tools with genuinely nothing to draw.
  if (kind === 'dynamicEntry' || kind === 'tempoEntry' || kind === 'slur' || kind === 'hairpin') {
    return 'cursor-place'
  }
  return 'cursor-default'
}

/**
 * All mutable UI state for the score editor.
 *
 * Framework-agnostic: no framework imports, and none needed — the editor's reactivity is this
 * object's own emitting Proxy (see {@link createObservableEditorState} below), which every
 * subscriber in the app reads through. A host framework, if one is ever wanted again, wraps it:
 * `reactive(state)` in Vue, `useSyncExternalStore(subscribe, …)` in React.
 */
export interface EditorState {
  // --- Tool ---
  selectedTool: ToolMode

  // --- Note selection ---
  /**
   * The multi-selection set, keyed by `itemKey(item)` (ordered: insertion = click
   * order). Holds `note` items and `articulation` groups (plus the `dynamic`/`slur`
   * items a box drags along); every other element kind is single-select through
   * {@link selectedElement}.
   */
  selectedItems: Map<string, SelectionItem>
  /**
   * The selection ANCHOR: the id of the last-added note (or null when no note is
   * selected). Single-target operations — keyboard nav, the entry cursor, drag,
   * palette-sync — act on the anchor, so with exactly one selected note this is
   * identical to the pre-multi-select behavior. Kept in sync with `selectedItems`
   * by SelectionController.
   */
  selectedNoteId: string | null
  /**
   * The Shift-range PIVOT: the id of the last plainly/Ctrl-clicked note. Shift-click
   * selects the temporal range pivot→target. Stays fixed across consecutive
   * Shift-clicks so the range endpoint can be re-flowed from the same point.
   */
  selectionPivotId: string | null
  /**
   * The selection snapshot a Shift-range is unioned onto — captured at the last
   * plain/Ctrl click. Lets Shift-click keep the already-selected (e.g. Ctrl-clicked)
   * notes while re-flowing the new range, instead of piling range on range.
   */
  selectionBase: SelectionItem[]
  /**
   * The ONE on-score element that is selected, or null. See {@link SelectedElement}: the fourteen
   * kinds are mutually exclusive, and holding them in ONE field is what makes "the dynamic and the
   * tie are both selected" impossible to write, rather than something four clear-lists in four
   * files have to remember to prevent.
   *
   * Always REASSIGNED (never mutated in place) so the observable state emits a change. Read it by
   * narrowing on `.kind`, or with {@link selectedOf} when you want one kind or nothing.
   */
  selectedElement: SelectedElement | null
  /**
   * The tremolo NOTE ENTRY is armed with (null = none) — the mark every note entered from here on
   * is born wearing, and what the ghost note shows.
   *
   * A note-entry value like {@link selectedAccidental} and {@link selectedDots}, NOT a marking tool:
   * the stamp (`selectedMarkingTool.kind === 'tremolo'`) puts a mark on a note that already exists,
   * while this one enters notes that have one. Which of the two a palette press means is decided by
   * the CONTEXT — entry mode arms this, a selection is edited in place, and only with nothing to
   * apply to does the press arm the stamp (PaletteController.pressTremolo).
   *
   * ⚠️ It PERSISTS: entering a note does not clear it, and neither does a duration press (which
   * clears the accidental and the dots). Writing five tremolo notes should be five clicks, not five
   * clicks and five re-arms. Esc / leaving entry mode is the deliberate way out, like the armed
   * articulations it sits beside.
   */
  selectedTremolo: TremoloMark | null
  // --- Palette ---
  /**
   * The voice notes are entered into (Sibelius-style). Voice 1 is the default and
   * always present in every bar; voices 2–4 are the optional extra streams. Resets
   * to `1` on selection-clear / fresh entry. Voices follow the cross-program
   * convention: 1 blue / 2 green / 3 orange / 4 purple, odd voices stems-up and
   * even voices stems-down.
   */
  activeVoice: 1 | 2 | 3 | 4
  /**
   * The staff (0-based index into `Score.staves`) that entry/nav target — the multi-staff
   * analogue of {@link activeVoice}, but a raw model index (staff 0 is the default, always
   * present). A click sets it to the clicked staff; selecting a note syncs it to that note's
   * staff; it resets to 0 on selection-clear. Keyboard entry stays on the cursor note's staff.
   */
  activeStaff: number
  selectedDuration: NoteDuration
  selectedAccidental: Accidental | null
  selectedDots: number
  accent: boolean
  staccato: boolean
  tenuto: boolean
  /**
   * The ONE marking tool armed for placement, or null. See {@link MarkingTool}: the eight tools are
   * mutually exclusive, and holding them in ONE field is what makes "two armed at once" impossible
   * to write, rather than something eight arm-sites have to remember to prevent.
   *
   * Always REASSIGNED (never mutated in place) so the observable state emits a change. Read it by
   * narrowing on `.kind`, or with {@link armedTool} when you want one kind or nothing. */
  selectedMarkingTool: MarkingTool | null
  /**
   * The tuplet ARMED for the next note, or null — a {@link TupletShape} minus its ACTUAL note value,
   * because that value is `selectedDuration` + `selectedDots`, already armed, and a second copy
   * could disagree with the first. It replaced a `tupletMode: boolean`, which could only ever have
   * meant a triplet; the engine below has always taken any N:M.
   *
   * The NORMAL side's value is here, because nothing else holds it: "5 sixteenths in the time of one
   * QUARTER" is armable, and absent still means "the same value as the actual side".
   *
   * ⚠️ REASSIGN, never mutate a field of it: the observable Proxy traps the SET on `armedTuplet`,
   * so `state.armedTuplet.numNotes = 5` changes the value and tells nobody.
   */
  armedTuplet: {
    numNotes: number
    /**
     * M — with {@link deriveM} set, only the FALLBACK: a preset key says "a 5", and what a 5 is in
     * the time of depends on the bar it lands in, which nobody knows when the key is pressed.
     */
    notesOccupied: number
    /**
     * Work M out from the METER where the group lands, and use `notesOccupied` only if that meter
     * has no tuplet of N (`Ctrl+2` in 4/4 — there is no duplet in simple meter).
     *
     * Set by the preset keys, never by the window: "5" is a request the position answers, while
     * "5 sixteenths in the time of 1 quarter" has already answered it.
     */
    deriveM?: boolean
    normalDuration?: NoteDuration
    normalDots?: number
    normalCount?: number
    /** How the group will be DRAWN when it lands — the Tuplet window's *Format* box, riding along
     *  because it is decided before the notes exist. Absent = engrave by the renderer's rules. */
    format?: TupletFormat
  } | null
  selectedBeam: BeamMode

  /**
   * Is the LAST system stretched to the page width? True (the default) is Finale/Sibelius; false is
   * LilyPond's `ragged-last`, where a short final system keeps its natural width.
   *
   * ⚠️ **View state, mirrored here for the toolbar — NOT a `Score` field.** How the page is cast off
   * is not part of the music, the same reason `viewMode` is not (docs/linear-view-plan.md §5). The
   * renderer owns the truth; this is what the UI reads, exactly as `viewMode` does.
   */
  justifyLastLine: boolean

  /**
   * Is the music being drawn on a PAGE (A4) rather than the sketching canvas?
   *
   * ⚠️ Same standing as {@link justifyLastLine}: view state mirrored here for the toolbar, NOT a
   * `Score` field and not the truth — the truth is the `Surface` the engine holds
   * (`engine/layout/surface.ts`), of which this is the two-valued shadow the dev toolbar can
   * toggle. A canvas has no physical size, so "which of the two" is all a boolean can carry; the
   * day there are three surfaces this becomes the surface itself.
   *
   * Defaults **true**, matching the engine's own default surface — you are writing music for a
   * page. ⚠️ The two defaults must agree: this is a mirror, and a mirror that starts out lying
   * makes the first click a no-op (the toggle would ask for the state the engine is already in).
   */
  useLayout: boolean

  // --- In-canvas text editing ---
  /** Set while a seamless DOM-overlay text editor is open over a mark; null when
   *  not editing. While non-null, the canvas mouse handlers (click / move) bail so
   *  the edit is modal-ish and a commit-click can't plant a stray mark. `kind` is a
   *  discriminator for future text types (lyric/technique/…); `isNew` carries the
   *  empty-text rule's "just placed vs existing" signal to the source. */
  editingText: { targetId: string; kind: 'dynamic' | 'tempo'; isNew: boolean } | null

  // --- Clipboard ---
  /** True while a paste is waiting for the user to click the insertion point —
   *  entered when Ctrl+V is pressed with an empty selection. A colored caret
   *  follows the pointer; the next canvas click commits the paste origin, Esc
   *  cancels. (With a non-empty selection, paste lands at the selection start and
   *  this stays false.) */
  pastePlacementArmed: boolean

  // --- UI ---
  showCursor: boolean
  /** True while a hand/grab pan is actively moving the view (set once the drag crosses
   *  the movement threshold, cleared on release). Bound in the template to hide the OS
   *  mouse pointer via `cursor: none`. Distinct from `showCursor`, which toggles the
   *  in-score keyboard caret, not the OS pointer. */
  isPanning: boolean
  playbackState: PlaybackState
  /** MIRROR of the engine's view mode (wrapped ↔ linear), for the toolbar button's lit state and
   *  the gutter's presence — the engine OWNS it (docs/linear-view-plan.md §5), and a MusicEngine
   *  emits nothing, so no subscriber can follow `engine.getViewMode()` directly. Written only by
   *  `PaletteController.setViewMode`, alongside the engine itself, so the two cannot diverge:
   *  never assign this field from anywhere else, and never read it to DECIDE anything — the
   *  gestures and the renderer ask the engine (the owner). */
  viewMode: ViewMode
}

/**
 * Map the 1-based UI active voice (`1`–`4`, Sibelius display convention) to the
 * 0-based model voice (`0`–`3`). The model's primary/default stream is voice 0 —
 * every existing note is voice 0 — so UI "Voice 1" is model voice 0, "Voice 2" is
 * model voice 1, and so on.
 */
export function activeVoiceToModel(activeVoice: 1 | 2 | 3 | 4): 0 | 1 | 2 | 3 {
  return (activeVoice - 1) as 0 | 1 | 2 | 3
}

/**
 * Inverse of {@link activeVoiceToModel}: map a 0-based model voice back to the
 * 1-based UI active voice. Voices 0–3 are editable; anything outside clamps into
 * that range (voice 0 → UI "Voice 1", voice ≥3 → UI "Voice 4").
 */
export function modelVoiceToActive(voice: number | undefined): 1 | 2 | 3 | 4 {
  const clamped = Math.min(Math.max(voice ?? 0, 0), 3)
  return (clamped + 1) as 1 | 2 | 3 | 4
}

export function createEditorState(): EditorState {
  return {
    selectedTool: 'selection',
    activeVoice: 1,
    activeStaff: 0,
    selectedItems: new Map(),
    selectedNoteId: null,
    selectionPivotId: null,
    selectionBase: [],
    selectedElement: null,
    selectedTremolo: null,
    selectedDuration: DEFAULT_DURATION,
    selectedAccidental: null,
    selectedDots: DEFAULT_DOTS,
    accent: false,
    staccato: false,
    tenuto: false,
    selectedMarkingTool: null,
    armedTuplet: null,
    selectedBeam: DEFAULT_BEAM,
    justifyLastLine: false,
    useLayout: true,
    editingText: null,
    pastePlacementArmed: false,
    showCursor: true,
    isPanning: false,
    playbackState: 'stopped',
    viewMode: 'wrapped',
  }
}

/** A framework-agnostic change-notification: fired with the top-level key that was written. */
export type StateListener = (key: keyof EditorState) => void

/**
 * An {@link EditorState} that carries its OWN change-notification, independent of any
 * framework. Read and write `state` exactly as a plain object; `subscribe(fn)` registers a
 * listener called with the key on every top-level write.
 *
 * The whole mechanism is a Proxy `set` trap (see docs/observable-editorstate-plan.md). This
 * `subscribe` IS the editor's reactivity now — the plan called it the end state while Vue was still
 * wrapping it, and since Vue left there is nothing else. Everything that follows state follows it:
 * the Keypad, the Properties window, the dev toolbar, the score cursor, the linear-view gutter.
 *
 * Contract for subscribers (emits are synchronous, one per write — never batched):
 *   1. Idempotent — called several times per gesture; the last call settles it.
 *   2. Torn-state tolerant — early emits run against mid-transition state.
 *   3. Never a state writer — a write from inside a callback is a re-entrant emit.
 *
 * Limit: only TOP-LEVEL writes emit. Mutating a nested value in place
 * (`state.selectedItems.set(…)`) does not — the trap never sees it. Every current writer
 * ends by assigning a top-level scalar, so coverage is complete; keep it that way.
 */
export interface ObservableEditorState {
  /** Read & write exactly as a plain EditorState; every top-level write notifies subscribers. */
  state: EditorState
  /** Register a change listener; returns an unsubscribe fn. */
  subscribe(fn: StateListener): () => void
}

export function createObservableEditorState(): ObservableEditorState {
  const raw = createEditorState()
  const listeners = new Set<StateListener>()
  const state = new Proxy(raw, {
    set(target, key, value) {
      const changed = target[key as keyof EditorState] !== value
      Reflect.set(target, key, value)
      // The write has already landed, so a throwing subscriber must not starve the others.
      if (changed) {
        for (const fn of listeners) {
          try {
            fn(key as keyof EditorState)
          } catch (e) {
            console.error('[EditorState] listener failed:', e)
          }
        }
      }
      return true
    },
  })
  return {
    state,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}
