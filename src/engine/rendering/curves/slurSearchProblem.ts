/**
 * ⭐⭐ **A DRAWN SLUR, STATED AS LILYPOND'S PROBLEM** — the adapter between the renderer and the pure search
 * (`engrave/curves/slurSearch`, docs/plans/slur-search-plan.md P3). It reads what the page already drew —
 * the notes' heads, stems and beams, their accidentals, dots and articulations, the staff — and hands the
 * search plain extents in LilyPond's space (staff spaces, y UP, the middle line at 0); {@link fromSearch}
 * turns the answer back into the pixels the slur is drawn in.
 *
 * ⭐ **Only what LilyPond would hand it.** LilyPond's slur engraver gives a slur the objects marked
 * `avoid-slur: inside` — accidentals, dots, staccato, tenuto — and MOVES the `around` ones (an accent)
 * outside the slur instead (`Slur::auxiliary_acknowledge_extra_object`). ⚠️ We move no articulation, so an
 * accent is handed over as an `around` object — the search's own branch for it, which keeps the curve
 * clear of it either way. That is OURS, not LilyPond's, and marked so in {@link ARTICULATION_AVOID}.
 *
 * ⭐ A BROKEN slur is stated one system's PIECE at a time ({@link slurSearchProblem}'s `brokenPx`, P6).
 *
 * ⏭️ **Not yet handed over** (named, not forgotten): a tie's ends (`tieEnds`), tuplet numbers, and a slur
 * NESTED under this one — the `house` nest lift does not apply under this preset, so two nested slurs may
 * touch until P4 reads them. A column's FLAG is not united into its stem's extent.
 *
 * @returns null when the slur cannot be stated — a fanned member or an undrawn note at an end, or no staff.
 *   The solver then answers with `house` (`./slurLilypondSolver`).
 */
import type { EngravedNote } from '../engraved/EngravedNote'
import { EngravedBeam } from '../engraved/EngravedBeam'
import { accidentalsOn } from '../engraved/EngravedAccidental'
import { dotsOn } from '../engraved/EngravedDot'
import { noteInkBox } from '../engraved/noteInkBox'
import { noteRuler } from '../engraved/noteRuler'
import { noteFrame } from '../staff/staveFrame'
import { STEM_THICKNESS_SPACES } from '@/engine/engrave/inheritedDefaults'
import { EMPTY, type Bezier, type Interval, type Offset } from '@/engine/engrave/curves/slurSearch/bezier'
import type { SearchColumn, SearchObject, SearchStem, SlurSearchInput } from '@/engine/engrave/curves/slurSearch/searchState'

type Point = { x: number; y: number }

/** Where LilyPond's space sits on the page: its origin and its unit. */
export interface SearchFrame {
  originX: number
  /** The middle line's y, in px — LilyPond's 0. */
  middleY: number
  spacePx: number
}

export interface SlurSearchProblem {
  input: SlurSearchInput
  frame: SearchFrame
}

/**
 * ⭐ Each of OUR articulation codes, as LilyPond marks it (`scm/script.scm`, `avoid-slur`): staccato and
 * tenuto are `inside`, the accent `around`. ⚠️ A row per code — a new mark must say which it is.
 */
export const ARTICULATION_AVOID: Readonly<Record<string, 'inside' | 'around'>> = {
  'a.': 'inside',
  'a-': 'inside',
  // ⚠️ LilyPond MOVES an accent outside the slur; we do not, so the curve keeps clear of it instead.
  'a>': 'around',
}

/** Our accidental codes → LilyPond's alterations; a double sharp has no row there and is checked at its middle. */
const ALTERATION: Readonly<Record<string, SearchObject['alteration']>> = {
  b: 'flat', bb: 'doubleFlat', '#': 'sharp', n: 'natural',
}

/** The categories that are OBJECTS to the search, not part of the note column's own extent. */
const NOT_THE_COLUMN: ReadonlySet<string> = new Set(['Accidental', 'Articulation', 'Dot', 'Annotation'])

/** A px box → LilyPond extents. */
function toExtents(frame: SearchFrame, box: { x: number; y: number; width: number; height: number }): { x: Interval; y: Interval } {
  const { originX, middleY, spacePx } = frame
  return {
    x: [(box.x - originX) / spacePx, (box.x + box.width - originX) / spacePx],
    y: [(middleY - (box.y + box.height)) / spacePx, (middleY - box.y) / spacePx],
  }
}

/** A px point → LilyPond's space. */
export function toSearch(frame: SearchFrame, p: Point): Offset {
  return { x: (p.x - frame.originX) / frame.spacePx, y: (frame.middleY - p.y) / frame.spacePx }
}

/** LilyPond's space → a px point. */
export function fromSearch(frame: SearchFrame, p: Offset): Point {
  return { x: frame.originX + p.x * frame.spacePx, y: frame.middleY - p.y * frame.spacePx }
}

/** One drawn note as a LilyPond note column. `slurUp` picks the head on the slur's side. */
function columnOf(
  note: EngravedNote, frame: SearchFrame, slurUp: boolean, slurEnds: readonly [EngravedNote, EngravedNote],
): SearchColumn | null {
  const ruler = noteRuler(note)
  const box = noteInkBox(note, NOT_THE_COLUMN)
  if (!box) return null
  const { x, y } = toExtents(frame, box)
  const ys = ruler.headYs
  if (!ys.length) return null
  const sp = frame.spacePx
  const headX: Interval = [(ruler.headLeftX - frame.originX) / sp, (ruler.headRightX - frame.originX) / sp]
  // The head on the slur's side — the HIGHEST when above (the smallest px y), and one space tall.
  const headPx = slurUp ? Math.min(...ys) : Math.max(...ys)
  const headC = (frame.middleY - headPx) / sp
  const slurHead = { x: headX, y: [headC - 0.5, headC + 0.5] as Interval }
  const column: SearchColumn = {
    x, y, refX: headX[0], firstHeadX: headX, slurHead, ...ownHeads(note, frame, slurUp),
    // Row `rests`: a rest as LilyPond reads its column — the rest glyph's whole extent (the column's box).
    ...(note.isRest() ? { restExtent: { x, y } } : {}),
  }
  // ⭐ A stemless note (a whole note) still HAS a stem in LilyPond — invisible, its extent empty — and that
  //   matters: `get_encompass_info` reads it at the head's CENTRE and `score_edges` asks its direction. With
  //   no stem at all it would be read as a REST, at the column's reference x (audit, 2026-09-27).
  if (!ruler.hasStem) {
    const headC0 = (frame.middleY - headPx) / sp
    column.stem = {
      dir: ruler.stemDirection > 0 ? 1 : -1, x: EMPTY, y: EMPTY, invisible: true,
      refX: (headX[0] + headX[1]) / 2, refY: headC0, beamsLeft: false, beamsRight: false,
    }
    return column
  }
  const stemX = (ruler.stemX - frame.originX) / sp
  const tip = (frame.middleY - ruler.stemTipY) / sp
  const base = (frame.middleY - ruler.stemBaseY) / sp
  const stem: SearchStem = {
    dir: ruler.stemDirection > 0 ? 1 : -1,
    x: [stemX - STEM_THICKNESS_SPACES / 2, stemX + STEM_THICKNESS_SPACES / 2],
    y: [Math.min(tip, base), Math.max(tip, base)],
    invisible: false, refX: stemX, refY: base, beamsLeft: false, beamsRight: false,
  }
  // The FLAG, as LilyPond's `Note_column::get_flag` — beside the stem, over its length (row G reads it).
  const flagW = note.getFlagWidthPx()
  if (flagW > 0) {
    stem.flag = { x: [stem.x[0], stemX + flagW / sp], y: stem.y }
  }
  const beam = note.getBeam()
  if (beam instanceof EngravedBeam) {
    const i = beam.notes.indexOf(note)
    const first = beam.notes[0], last = beam.notes[beam.notes.length - 1]
    const startX = noteRuler(slurEnds[0]).headLeftX
    const endX = noteRuler(slurEnds[1]).headLeftX
    const bFirst = noteRuler(first).headLeftX, bLast = noteRuler(last).headLeftX
    stem.beamsLeft = i > 0
    stem.beamsRight = i >= 0 && i < beam.notes.length - 1
    stem.beam = {
      // A beam is named by its first note — each note's id is its own.
      id: first.getAttribute('id') ?? '',
      thickness: beam.beamWidth / sp,
      // `spanner_less (slur, beam)`: the beam reaches at least as far both ways, and further one way.
      containsSlur: bFirst <= startX && bLast >= endX && (bFirst !== startX || bLast !== endX),
    }
  }
  column.stem = stem
  return column
}

/**
 * Row G — the ties that END while the slur runs (LilyPond END-acknowledges a tie, so one ending on the slur's
 * first note counts and one starting on its last does not): a tie whose right end falls between the slur's
 * first head (or its line-break edge) and its last. Each as its drawn extent and its two ends.
 */
function tiesUnder(
  drawnTies: readonly { points: readonly Point[] }[], notes: readonly EngravedNote[], frame: SearchFrame,
  brokenPx: readonly [number | undefined, number | undefined],
): { ties?: NonNullable<SlurSearchInput['ties']> } {
  if (!drawnTies.length || !notes.length) return {}
  const from = brokenPx[0] ?? noteRuler(notes[0]).headLeftX
  const to = brokenPx[1] ?? noteRuler(notes[notes.length - 1]).headRightX
  const ties = drawnTies.flatMap(t => {
    if (t.points.length < 2) return []
    const xs = t.points.map(p => p.x), ys = t.points.map(p => p.y)
    const endX = Math.max(...xs)
    if (endX < from || endX > to) return []
    const box = toExtents(frame, {
      x: Math.min(...xs), y: Math.min(...ys), width: endX - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
    })
    const first = t.points[0], last = t.points[t.points.length - 1]
    return [{ ...box, ends: [toSearch(frame, first), toSearch(frame, last)] as const }]
  })
  return ties.length ? { ties } : {}
}

/**
 * Row G — the slurs NESTED under this one: a drawn slur lying wholly within this slur's span (LilyPond's slur
 * engraver hands an outer slur the slurs that start and end while it runs). Its cubic in LilyPond's space.
 */
function slursUnder(
  drawnSlurs: readonly { cubic: readonly [Point, Point, Point, Point]; sharesLeft: boolean; sharesRight: boolean }[],
  notes: readonly EngravedNote[], frame: SearchFrame, brokenPx: readonly [number | undefined, number | undefined],
): { nested?: NonNullable<SlurSearchInput['nested']> } {
  if (!drawnSlurs.length || !notes.length) return {}
  // A hair of slack: an inner slur sharing an end note starts where this one does.
  const slack = frame.spacePx
  const from = (brokenPx[0] ?? noteRuler(notes[0]).headLeftX) - slack
  const to = (brokenPx[1] ?? noteRuler(notes[notes.length - 1]).headRightX) + slack
  const nested = drawnSlurs.flatMap(s => {
    const xs = [s.cubic[0].x, s.cubic[3].x]
    if (Math.min(...xs) < from || Math.max(...xs) > to) return []
    return [{
      curve: s.cubic.map(p => toSearch(frame, p)) as unknown as Bezier,
      sharesLeft: s.sharesLeft, sharesRight: s.sharesRight,
    }]
  })
  return nested.length ? { nested } : {}
}

/** Row G — a tuplet's MARK over any of this slur's notes (LilyPond's `TupletNumber`, `avoid-slur: inside`). */
function marksOver(
  tupletMarks: readonly { box: { x: number; y: number; width: number; height: number }; notes: readonly EngravedNote[] }[],
  notes: readonly EngravedNote[], frame: SearchFrame,
): { tupletNumbers?: NonNullable<SlurSearchInput['tupletNumbers']> } {
  const mine = new Set(notes)
  const marks = tupletMarks
    .filter(m => m.notes.some(n => mine.has(n)))
    .map(m => toExtents(frame, m.box))
    .filter(e => [e.x[0], e.x[1], e.y[0], e.y[1]].every(Number.isFinite))
  return marks.length ? { tupletNumbers: marks } : {}
}

/**
 * Row G — the clef / key / meter changes standing INSIDE the slur: a sign whose middle lies between the slur's
 * first head (or its line-break edge) and its last. ⭐ A system's own opening signs stand left of the break edge,
 * so they drop out by position.
 */
function signsWithin(
  signBoxes: readonly { x: number; y: number; width: number; height: number }[], notes: readonly EngravedNote[],
  frame: SearchFrame, brokenPx: readonly [number | undefined, number | undefined],
): { headerSigns?: NonNullable<SlurSearchInput['headerSigns']> } {
  if (!signBoxes.length || !notes.length) return {}
  const from = brokenPx[0] ?? noteRuler(notes[0]).headRightX
  const to = brokenPx[1] ?? noteRuler(notes[notes.length - 1]).headLeftX
  const signs = signBoxes
    .filter(b => b.x + b.width / 2 > from && b.x + b.width / 2 < to)
    .map(b => toExtents(frame, b))
    .filter(e => [e.x[0], e.x[1], e.y[0], e.y[1]].every(Number.isFinite))
  return signs.length ? { headerSigns: signs } : {}
}

/**
 * Row `endHead`: the heads' OWN boxes, as LilyPond reads them — the slur-side head's glyph (`Stem::extremal_heads`,
 * displacement included) and the column's first head's x (`Note_column::first_head` — our first key, the lowest).
 * ⚠️ Measured 2026-09-27: it differs from the chord span only for a DISPLACED slur-side head (a second, the slur on
 * the stem side), and the search reads that head's x only where an end falls back to the head centre (a short or
 * steep slur) — the ruler's span is the main column already, and a head glyph is ±½ sp tall. So the row rarely
 * changes a picture.
 */
function ownHeads(note: EngravedNote, frame: SearchFrame, slurUp: boolean): Pick<SearchColumn, 'ownSlurHead' | 'ownFirstHeadX'> {
  const heads = note.noteHeads
  if (!heads.length) return {}
  // ⚠️ A head's own x / y are in the frame the note was DRAWN in, which may be placed elsewhere on the page — so
  //   only their DIFFERENCES are read (a head's offset from the leftmost one; its glyph around its own centre),
  //   and the page position comes from the ruler, as every other column fact does.
  const ruler = noteRuler(note)
  // ⚠️ The box's x, ⛔ not `getAbsoluteX()`: a displaced head's x already carries its displacement, and
  //   `getAbsoluteX` adds it AGAIN (it answers where the head meets the stem — measured: 2.25 sp, drawn 1.12).
  const minX = Math.min(...heads.map(h => h.getBoundingBox().x))
  const ys = ruler.headYs
  const slurY = slurUp ? Math.min(...ys) : Math.max(...ys)
  const boxOf = (h: (typeof heads)[number], centreY: number) => {
    const b = h.getBoundingBox()
    return toExtents(frame, {
      x: ruler.headLeftX + (b.x - minX), y: centreY + (b.y - h.getY()), width: b.w, height: b.h,
    })
  }
  const outer = heads.reduce((a, h) => (slurUp ? (h.getY() < a.getY() ? h : a) : (h.getY() > a.getY() ? h : a)))
  const own = boxOf(outer, slurY)
  const first = boxOf(heads[0], slurY)
  const finite = (i: Interval) => Number.isFinite(i[0]) && Number.isFinite(i[1]) && i[1] > i[0]
  // ⚠️ An unmeasured glyph (no font) has no box — then there is nothing to hand over, and the chord's stands.
  if (!finite(own.x) || !finite(own.y) || !finite(first.x)) return {}
  return { ownSlurHead: own, ownFirstHeadX: first.x }
}

/** A note's accidentals, dots and articulations, as the search's objects. */
function objectsOn(note: EngravedNote, frame: SearchFrame, onEnd: boolean): SearchObject[] {
  const out: SearchObject[] = []
  for (const acc of accidentalsOn(note)) {
    const ink = acc.drawnInk()
    if (!ink) continue
    out.push({ ...toExtents(frame, ink), avoid: 'inside', sign: 'accidental', alteration: ALTERATION[acc.type] })
  }
  for (const dot of dotsOn(note)) {
    const b = dot.getBoundingBox()
    out.push({ ...toExtents(frame, { x: b.x, y: b.y, width: b.w, height: b.h }), avoid: 'inside', sign: 'dots' })
  }
  for (const m of note.getModifiers() as Array<{ getCategory?(): string; type?: string; getBoundingBox?(): { x: number; y: number; w: number; h: number } }>) {
    if (m.getCategory?.() !== 'Articulation' || !m.type || !m.getBoundingBox) continue
    const avoid = ARTICULATION_AVOID[m.type]
    if (!avoid) continue
    const b = m.getBoundingBox()
    out.push({
      ...toExtents(frame, { x: b.x, y: b.y, width: b.w, height: b.h }), avoid,
      ...(m.type === 'a>' ? { accent: { onEnd } } : {}),
    })
  }
  return out.filter(o => [o.x[0], o.x[1], o.y[0], o.y[1]].every(Number.isFinite))
}

/**
 * State the slur. `notes` are its drawn columns in order, the ends first and last; `direction` is ours
 * (−1 above, +1 below). ⭐ For one system's PIECE of a broken slur (P6), `brokenPx` gives the x of each end
 * that is a line break — `notes` are then this system's columns only, and a broken side's nearest column is
 * not an end.
 */
export function slurSearchProblem(
  notes: readonly EngravedNote[], direction: number,
  brokenPx: readonly [number | undefined, number | undefined] = [undefined, undefined],
  /** `house`'s lean of each open end, px outward from the note end (`./brokenSlurTilt`) — for row D. */
  openRisePx: readonly [number | undefined, number | undefined] = [undefined, undefined],
  /** Row G: the ties DRAWN on this slur's staff and system (`RenderPass.drawnCurves`, kind `'tie'`). */
  drawnTies: readonly { points: readonly Point[] }[] = [],
  /** Row G: the slurs already DRAWN on this staff and system, with whether each shares this slur's end notes. */
  drawnSlurs: readonly { cubic: readonly [Point, Point, Point, Point]; sharesLeft: boolean; sharesRight: boolean }[] = [],
  /** Row G: every drawn tuplet MARK with its notes (`ScoreTuplet.markBox`) — kept when it is over this slur's notes. */
  tupletMarks: readonly { box: { x: number; y: number; width: number; height: number }; notes: readonly EngravedNote[] }[] = [],
  /** Row G: the clef / key / meter signs DRAWN on this staff and system (their registry boxes). */
  signBoxes: readonly { x: number; y: number; width: number; height: number }[] = [],
): SlurSearchProblem | null {
  // Each end on a note needs its note; a piece with no column at all (a system the slur only passes over,
  // holding none of its lane's notes) has nothing to state.
  const onNotes = brokenPx.filter(x => x === undefined).length
  if (notes.length < onNotes || notes.length === 0) return null
  const staff = noteFrame(notes[0])
  if (!staff || staff.lineCount < 1) return null
  const lines = staff.lineCount
  const frame: SearchFrame = {
    originX: noteRuler(notes[0]).headLeftX,
    middleY: staff.topLineY + ((lines - 1) / 2) * staff.spacePx,
    spacePx: staff.spacePx,
  }
  const slurUp = direction < 0
  const ends = [notes[0], notes[notes.length - 1]] as const
  const columns: SearchColumn[] = []
  for (const note of notes) {
    const column = columnOf(note, frame, slurUp, ends)
    if (!column) return null
    columns.push(column)
  }
  const first = columns[0].slurHead!.y, last = columns[columns.length - 1].slurHead!.y
  const edge = (x: number | undefined) => (x === undefined ? undefined : (x - frame.originX) / frame.spacePx)
  const broken = brokenPx.some(x => x !== undefined)
  return {
    frame,
    input: {
      dir: slurUp ? 1 : -1,
      columns,
      // An END note is a bound — ⚠️ not the column nearest a line break, which is a middle one to T1.
      objects: notes.flatMap((n, i) => objectsOn(n, frame,
        (i === 0 && brokenPx[0] === undefined) || (i === notes.length - 1 && brokenPx[1] === undefined))),
      nestedSlurs: [],
      tieEnds: [],
      staff: {
        middleY: 0,
        // LilyPond's line positions, in half-spaces from the middle: 5 lines are −4 … 4.
        linePositions: Array.from({ length: lines }, (_, i) => (lines - 1) - 2 * i),
      },
      endHeadY: [(first[0] + first[1]) / 2, (last[0] + last[1]) / 2],
      ...(broken ? { brokenX: [edge(brokenPx[0]), edge(brokenPx[1])] as const } : {}),
      ...tiesUnder(drawnTies, notes, frame, brokenPx),
      ...slursUnder(drawnSlurs, notes, frame, brokenPx),
      ...marksOver(tupletMarks, notes, frame),
      ...signsWithin(signBoxes, notes, frame, brokenPx),
      ...(openRisePx.some(r => r !== undefined)
        ? { openRise: openRisePx.map(r => (r === undefined ? undefined : r / frame.spacePx)) as [number | undefined, number | undefined] }
        : {}),
    },
  }
}
