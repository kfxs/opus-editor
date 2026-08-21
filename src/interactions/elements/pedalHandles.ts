/**
 * ⭐ **A SELECTED PEDAL'S TWO ENDPOINT HANDLES** — one beyond the `Ped.`, one beyond the `✻`, and
 * how a press or Tab picks one. His ask, 2026-08-18: *"now i will want to add the square endpoints
 * to the pedal"*, the fourth span family to get them after the slur, the hairpin and the ottava.
 *
 * ⭐ **`./ottavaHandles`' twin, deliberately down to the shape of the file** — the same two squares
 * in the same blue at the same size, the same walk, the same registry-is-the-list rule. Four span
 * families with four different-looking answers to "where is my end" would be four things for the
 * hand to learn; one look and one gesture is the whole reason this is a copy rather than a
 * variation.
 *
 * ⭐ **What they ARM, they then EDIT** — `Ctrl+Shift+←/→` moves that end through the music (the
 * right square the LIFT, the left one the press, holding the other), and dragging a square does the
 * same thing with the mouse. Both roads write the MODEL: a pedal's extent is how long the notes
 * RING, so there is no cosmetic offset here and nothing for `Ctrl+Backspace` to reset.
 *
 * ## ⭐⭐ The one thing that is genuinely this family's own: THE GRAIN IS THE GLYPH
 *
 * Every other span here registers one box per drawn FRAGMENT, so its two ends are two coordinates of
 * one entry (or of two, across a system break). A pedal registers one box per drawn SIGN — there is
 * no ink at all between `Ped.` and `✻`, so a fragment-wide box would claim every press over the
 * music it merely passes over ({@link ElementInfo} `'pedal'`). So the two squares here come from
 * **two different MARKS**, named by {@link ElementInfo.pedalSign}.
 *
 * ⛔ **Never "the first entry and the last one".** That happens to be true today and is not a fact
 * about pedals: a `(Ped.)` resumption is registered too, and a final fragment can be dropped by the
 * cutter when a lift lands a hair inside a new system — which is exactly the case that would put the
 * end square on a sign that is not the release. The sign says what it is; nothing here counts.
 *
 * ⭐ **And no measured axis field, unlike the bracket's.** `ottavaAxis` exists because an ottava's
 * `points` are the numeral's ink box while its line rides that box's top or foot. A pedal's boxes
 * ARE its ink, one per glyph, so the square sits on the box's own middle and there is nothing to
 * re-derive.
 */
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { PedalSlotTarget, PedalDragWrite } from '../../engine/models/pedalOps'
import type { Score } from '../../types/music'
import type { EditorState } from '../EditorState'
import { selectedOf } from '../EditorState'
import { staffOf } from '../../utils/lanes'
import { fracCompare } from '../../utils/fraction'
import { dbg } from '../../utils/debug'

/** What finding a drag target needs off the engine — a Pick, so a test can stand up the four reads
 *  without a renderer. */
type DragEngine = Pick<MusicEngine, 'getPedalById' | 'getScore' | 'getElementRegistry' | 'getNote'>

/** One drawn handle: a point, and which end of the pedal it is. */
export interface PedalHandle {
  which: 'start' | 'end'
  x: number
  y: number
}

/**
 * ⭐ **THE AIR — how far outside the pedal's signs each square sits**, in px.
 *
 * The requirement that came with the handles themselves on the ottava (*"we need air … for avoiding
 * collision"*) and it is sharper here than anywhere: the two things a square could cover are the
 * `Ped.` and the `✻`, which is the ENTIRE mark. A pedal has no line, no hook and no wedge to fall
 * back on, so a square sitting on a sign hides one half of the statement outright.
 *
 * ⚠️ Its own constant rather than an import of the ottava's or the hairpin's, so the three can be
 * tuned apart. It STARTS at their 10 — the square's half-side, 6, plus a few px — because that is a
 * value his eye has already passed twice.
 *
 * ⚠️ PIXELS, like every other handle in the editor: the squares are drawn on the highlight layer at
 * a constant on-screen size, so one stays the same size to the hand at every zoom.
 */
export const PEDAL_HANDLE_GAP_PX = 10

/**
 * The endpoint handles of `pedalId`, from what the last render DREW (the registry is the list —
 * every handle family in the editor follows that rule).
 *
 * ⭐ The start square steps LEFT of the `Ped.`'s left edge and the end square RIGHT of the `✻`'s
 * right edge, so both step OUTWARD along the span and neither is over ink. ⚠️ The `✻` is
 * RIGHT-aligned on the lift x (`PedalRenderer` — that alignment is what keeps its ink inside the
 * barline), so the end square lands just past the lift itself: the same place the ottava's does, by
 * a different route.
 *
 * ⭐ **The start square rides the FIRST `Ped.`, never a `(Ped.)` resumption** — a resumed sign is a
 * reminder that the damper is still down, not a second beginning. That is the attachment guide's own
 * rule (`PedalRenderer`, first fragment only), and it comes out of the same reading.
 *
 * ⚠️ Returns ONE handle when the release was not drawn, and an empty array when nothing was — ⛔ it
 * never invents the missing end from the sign it does have. Two squares on one `Ped.` would say the
 * pedal both begins and ends there.
 */
export function pedalEndpointHandles(
  entries: readonly ElementInfo[],
  pedalId: string,
): PedalHandle[] {
  const signs = entries.filter(el => el.id === pedalId && el.pedalSign)
  // Registration order IS drawing order — the first `Ped.` is the press; every later one is a
  // resumption (see above). The release is named, not counted.
  const down = signs.find(el => el.pedalSign === 'down')
  const up = signs.find(el => el.pedalSign === 'up')

  const handles: PedalHandle[] = []
  if (down) {
    handles.push({
      which: 'start',
      x: down.bbox.x - PEDAL_HANDLE_GAP_PX,
      y: down.bbox.y + down.bbox.height / 2,
    })
  }
  if (up) {
    handles.push({
      which: 'end',
      x: up.bbox.x + up.bbox.width + PEDAL_HANDLE_GAP_PX,
      y: up.bbox.y + up.bbox.height / 2,
    })
  }
  return handles
}

/**
 * ⭐ **A PRESS ON A SQUARE ARMS THAT END** — run as a PRE-STEP in `MouseController`, before the
 * selection is cleared and before the hit chain, exactly where the hairpin's, the slur's and the
 * ottava's handle presses run.
 *
 * ⚠️ **Before the chain, not a row in it**, and the pedal has the strongest case of the four: it is
 * the OUTERMOST below-staff family, so its squares sit beyond everything the ladder placed inside it
 * — a square can land inside a dynamic's, a hairpin's, a trill's or an octave line's box, and every
 * one of those runs ahead of `PEDAL_ELEMENT` in {@link ELEMENT_HIT_ORDER}. A handle you can SEE has
 * to win the press over whatever it happens to overlap, and no ordering of the marks themselves
 * could promise that.
 *
 * The squares are only in the registry while their pedal is selected (the highlight pass puts them
 * there), so no "is this pedal selected" guard is needed — nothing else can be hit.
 *
 * @returns true if a square consumed the press (the caller then re-renders and stops).
 */
export function armPedalEndpointAt(
  state: EditorState,
  registry: ElementRegistry,
  x: number,
  y: number,
): boolean {
  const hit = registry.getByType('pedal-endpoint').find(el => {
    const b = el.bbox
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
  })
  if (!hit?.pedalId || !hit.endpoint) return false
  // ⚠️ Reassigned whole — the observable Proxy traps the SET, so mutating `.endpoint` in place would
  // change the value and tell nobody.
  state.selectedElement = { kind: 'pedal', id: hit.pedalId, endpoint: hit.endpoint }
  dbg(`✓ Pedal endpoint armed | id:${hit.pedalId} end:${hit.endpoint}`)
  return true
}

/**
 * ⭐⭐ **WHICH ADDRESS A DRAGGED SQUARE IS OVER** — the mouse twin of `Ctrl+Shift+←/→`, and the whole
 * of what a pedal drag has to decide (his ask, 2026-08-18: *"now lets make the ctr shift arrow also
 * be changed by mouse drag just like the ottava"*).
 *
 * ⭐ **It snaps to a SLOT of the pedal's own staff, never to a pixel** — the keyboard's rule, so a
 * drag cannot put a foot down between two onsets when the keys cannot. Every voice: one damper.
 *
 * ⭐⭐ **BOTH ENDS MEASURE AGAINST NOTEHEAD LEFT EDGES, and that is the pedal's own answer, ⛔ not a
 * simplification of the ottava's.** The bracket next door measures its END against RIGHT edges
 * because Gould's rule 2 draws its hook on the last covered notehead. A pedal's ends are both drawn
 * at a COLUMN's left edge — `PedalRenderer.slotXAtOrAfter` reads the same `noteLeftX` for the press
 * and for the lift — so measuring the lift against right edges would lag the cursor by a notehead.
 * Copying either neighbour's edge rule blind is the recorded way to reproduce the hairpin's *"it
 * jumps before x mouse reach the target"*.
 *
 * ⭐⭐ **…except that the END gets ONE EXTRA CANDIDATE: past the last onset.** The lift is a moment
 * in TIME, and the last note of a passage can be left ringing or cut off as it is struck — two
 * different pedallings that no onset can tell apart, because the address *after* the final slot is
 * the one no onset names ({@link setPedalEndAtSlot}). So the last onset offers its RIGHT edge as
 * well: cross the notehead and the pedal holds the note. ⚠️ On every earlier onset the same
 * candidate would be a duplicate — the end of a slot IS the next onset — so it is offered once.
 *
 * ## 🚨🚨 THE Y IS TRANSLATED BEFORE ANYTHING IS COMPARED, AND THAT IS THE WHOLE BUG THIS FIXES
 *
 * His report, 2026-08-18: *"the y of the mouse is not accurate — I'm dragging in the y of the pedal,
 * aligned to it, but it interprets I'm in the system below … to drag well I have to place the mouse
 * in the staff, and that is not good UX, because the user is aligned to where the `Ped.` is drawn."*
 *
 * ⭐⭐ **The hand rides the SIGN's line, and the sign's line is nowhere near the noteheads it
 * addresses.** A pedal is the OUTERMOST below-staff family — under the dynamics, the hairpins, the
 * trills and the octave lines — so its line can sit ten staff spaces under the music, which is
 * genuinely CLOSER to the next system's noteheads than to its own. Comparing the raw cursor y
 * against notehead y's therefore answers with the system below, and it is not a tolerance that can
 * be widened out of trouble: the wrong row is nearer.
 *
 * ⭐⭐ **So the offset is MEASURED and subtracted, ⛔ never a constant and never re-derived from the
 * ladder.** The dragged square is drawn on the pedal's own line, and the onset it was drawn under is
 * in the registry — the gap between them IS this system's "how far below the music does this pedal
 * sit", including whatever the dynamics and hairpins above it happened to claim. Subtracting it puts
 * the cursor back in notehead space, where every system is comparable again, and it keeps working
 * when the line moves because the number is re-read every frame.
 *
 * ⭐ **After the translation, the y CHOOSES THE SYSTEM and the x CHOOSES THE NOTE** ({@link
 * PEDAL_DRAG_ROW_PX}) — the two axes answer different questions, so mixing them into one hypotenuse
 * let a pitch difference within a row outvote a hundred pixels of x. Cross-system x's are not one
 * ruler, which is the only reason y is consulted at all.
 *
 * ⚠️ **The ottava had the same defect and no longer has the drag** — `ottavaDragTargetAt` was where
 * this was copied from, and on 2026-08-21 the bracket's squares stopped snapping and started WALKING
 * (`../ottavaWalk.dragOttavaEndpoint`), which reads no `y` at all: the ink follows the hand and the
 * SYSTEM is decided by the wrap. ⭐ That is the other way out of this trap, and the one to take when
 * the pedal's drag is next opened.
 *
 * @returns the write the drop should apply, or null when the cursor is on no system's music.
 */
export function pedalDragTargetAt(
  engine: DragEngine,
  pedalId: string,
  which: 'start' | 'end',
  x: number,
  y: number,
): PedalDragWrite | null {
  const pedal = engine.getPedalById(pedalId)
  if (!pedal) return null
  const staff = staffIndexOf(engine.getScore(), pedal.staffId)

  // One candidate per ONSET of the staff. ⚠️ A chord registers one entry per notehead at one onset,
  // and a second interval displaces one of them sideways — so the column's left edge is the
  // LEFTMOST of them, which is the edge the sign is drawn against.
  const onsets: Array<{ left: number; right: number; y: number; target: PedalSlotTarget }> = []
  const registry = engine.getElementRegistry()
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (!el.id) continue
    const note = engine.getNote(el.id)
    if (!note) continue
    // ⛔ No voice filter — one damper serves the staff. `resizePedalBySlot` says why.
    if (staffOf(note) !== staff) continue
    const target = { measure: note.measure, beat: note.beat }
    const seen = onsets.find(o =>
      o.target.measure === target.measure && fracCompare(o.target.beat, target.beat) === 0)
    if (seen) {
      seen.left = Math.min(seen.left, el.bbox.x)
      seen.right = Math.max(seen.right, el.bbox.x + el.bbox.width)
      continue
    }
    onsets.push({
      left: el.bbox.x,
      right: el.bbox.x + el.bbox.width,
      y: el.bbox.y + el.bbox.height / 2,
      target,
    })
  }
  if (!onsets.length) return null

  // The candidates, each an (x, y, write) — the START has one per onset, the END has one more.
  const candidates: Array<{ x: number; y: number; write: PedalDragWrite }> = onsets.map(o => ({
    x: o.left,
    y: o.y,
    write: which === 'start'
      ? { at: 'start' as const, ...o.target }
      : { at: 'end' as const, after: false, ...o.target },
  }))
  if (which === 'end') {
    const last = onsets.reduce((a, b) => (b.left > a.left ? b : a))
    candidates.push({ x: last.right, y: last.y, write: { at: 'end', after: true, ...last.target } })
  }

  // 🚨 THE TRANSLATION — see the header. The cursor is where the HAND is, on the pedal's line; the
  // candidates are where the MUSIC is. This is the measured gap between the two.
  const inMusic = y - signToMusicOffset(registry, pedalId, which, onsets)

  // ⭐ The y picks the SYSTEM, the x picks the note. Two axes, two questions: one hypotenuse over
  // both let a pitch difference inside a row (a note four ledger lines up is 40px off its
  // neighbour) outweigh a hundred pixels of horizontal distance.
  const row = candidates.filter(c => Math.abs(inMusic - c.y) <= PEDAL_DRAG_ROW_PX)
  if (!row.length) return null

  let best: PedalDragWrite | null = null
  let bestDistance = PEDAL_DRAG_SNAP_PX
  for (const c of row) {
    const d = Math.abs(x - c.x)
    if (d < bestDistance) { bestDistance = d; best = c.write }
  }
  return best
}

/**
 * ⭐⭐ **How far below the music this pedal's line is drawn, MEASURED from the last render** — the
 * number {@link pedalDragTargetAt} subtracts from the cursor's y.
 *
 * The dragged square sits on the pedal's own line; the onset it was drawn over is in the same
 * registry. The gap between them is this system's answer and nobody else's: it already contains
 * whatever the dynamics, hairpins, trills and octave lines claimed under that music, which is
 * exactly why it may not be a constant and may not be recomputed from the ladder here.
 *
 * ⚠️ Only onsets ABOVE the square are considered, because a pedal is always drawn BELOW its staff
 * (`PedalRenderer` §3 — nothing to derive and nothing to flip). Without that, a sign near the end of
 * a system could measure itself against the next system's first note and report a gap of nothing.
 *
 * Returns 0 when the pedal is not on screen or nothing is above it — the honest "I don't know",
 * which leaves the raw cursor y in play rather than inventing a shift.
 */
function signToMusicOffset(
  registry: ElementRegistry,
  pedalId: string,
  which: 'start' | 'end',
  onsets: ReadonlyArray<{ left: number; y: number }>,
): number {
  const anchor = pedalEndpointHandles(registry.getByType('pedal'), pedalId)
    .find(h => h.which === which)
  if (!anchor) return 0
  let above: { left: number; y: number } | null = null
  let nearest = Infinity
  for (const o of onsets) {
    if (o.y >= anchor.y) continue
    const d = Math.hypot(anchor.x - o.left, anchor.y - o.y)
    if (d < nearest) { nearest = d; above = o }
  }
  return above ? anchor.y - above.y : 0
}

/** ⚠️ Generous on purpose — see {@link pedalDragTargetAt}: HORIZONTAL only, now that the row is
 *  chosen separately. The ottava's and the hairpin's number. */
const PEDAL_DRAG_SNAP_PX = 150

/**
 * How far off a system's noteheads the translated cursor may be and still be READING that system —
 * two staff heights at the default size.
 *
 * ⚠️ A tolerance, not a boundary: it has to swallow the pitch spread inside one system (a note high
 * above the staff is a staff-height off its neighbour) while staying well under the gap to the next
 * system, and both of those are properties of the LAYOUT rather than of this number. Outside it the
 * drag answers null — the cursor is between systems, and no change is the honest frame.
 */
const PEDAL_DRAG_ROW_PX = 80

/** The staff INDEX a pedal's `staffId` names (absent = the first staff), so a drawn element's own
 *  `staff` can be compared against it. `ottavaHandles`' helper, kept local for its reason: it is
 *  three lines and sharing it would put a `Score` import in whichever file lost. */
function staffIndexOf(score: Score, staffId: string | undefined): number {
  if (!staffId) return 0
  const at = score.staves?.findIndex(s => s.id === staffId) ?? -1
  return at === -1 ? 0 : at
}

/**
 * ⭐ **TAB WALKS THE SQUARES** — `+1` Tab, `−1` Shift+Tab — the keyboard route to the same
 * selection, and the pedal's share of what `slurHandleCycle`, `cycleHairpinEndpoint` and
 * `cycleOttavaEndpoint` do.
 *
 * The REGISTRY IS THE LIST: the walk visits what the last render actually DREW, so a pedal whose
 * squares are not on screen has none to visit and Tab stays the browser's. With none armed, Tab
 * takes the FIRST and Shift+Tab the LAST, so either key is a way in; the walk WRAPS.
 *
 * ⚠️ It walks ONE stop rather than two when the release was not drawn — {@link
 * pedalEndpointHandles}' case, and the wrap arithmetic already answers it.
 *
 * ⚠️ DECLINES (false) when no pedal is selected or its squares are not drawn — the caller chains
 * rather than repaints on a false.
 */
export function cyclePedalEndpoint(
  state: EditorState,
  registry: ElementRegistry,
  step: 1 | -1,
): boolean {
  const selected = selectedOf(state, 'pedal')
  if (!selected) return false
  const order = pedalEndpointHandles(registry.getByType('pedal'), selected.id)
  if (!order.length) return false

  const at = order.findIndex(h => h.which === selected.endpoint)
  const next = at === -1
    ? (step === 1 ? 0 : order.length - 1)
    : (at + step + order.length) % order.length
  state.selectedElement = { kind: 'pedal', id: selected.id, endpoint: order[next].which }
  return true
}
