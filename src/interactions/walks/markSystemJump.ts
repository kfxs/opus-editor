/**
 * ⭐⭐ **WHICH SYSTEM A DRAGGED MARK NOW BELONGS TO** — the one move the interpolating walk
 * (`./markWalk`) cannot make, extracted from `./dynamicLane` on 2026-08-19 when the tempo mark's drag
 * needed the same rule.
 *
 * ⭐ **Two rules, because there are two questions.** WITHIN a system, where a mark sits is
 * continuous — ink, with the anchor handed along at each stop. BETWEEN systems there is nothing
 * continuous to travel through: two systems' x's are not one ruler, so the walk refuses to cross a
 * break and always will. Coming down onto the staff below is therefore a JUMP.
 *
 * ## ⭐⭐ The limit is WHERE THE MARK WOULD LOOK AT HOME — ⛔ not the staff's five lines
 *
 * His call, 2026-08-19, after trying the obvious one: *"crossing the stave is not a good limit… a
 * more organic limit vertically"*. Crossing the pentagram is late (the mark must be dragged right
 * onto the next staff) and lopsided (a mark hangs to one side of its staff, so the staff on that side
 * is much nearer than the other). Instead: measure the mark's NATURAL distance from its own staff —
 * its drawn ink with its own lift taken back out — and read that same distance from every other staff
 * as *"where it would sit there"*. The mark belongs to the nearest of those, so **the switch falls
 * exactly halfway between where it sits and where it would sit**.
 *
 * 🚨 **The lift MUST come back out first.** Left in, the mark's "natural" home follows it down for
 * ever and the switch never arrives — his report that started this, a dynamic at `y: 44.86` with a
 * guide line stretching over three staves.
 *
 * ⭐ No constant anywhere in it: the gap is measured every frame (it contains whatever the ladder
 * granted this mark) and the staves are the painted ones. ⭐ It mirrors itself for a mark drawn ABOVE
 * by measuring off the staff's TOP line. ⭐ And it needs no travel history: a frame taller than a
 * whole system is judged by where it ENDED, so a fast hand cannot fly over a staff.
 */

/**
 * One painted (system, staff) — its five lines top to bottom, and the x its music occupies.
 * `ElementRegistry.staffRuns()`' shape.
 *
 * 🚨🚨 **THE X IS LOAD-BEARING, and it is why this is not `staffBands()`.** His report, 2026-08-30:
 * a dragged hairpin, then an octave line, vanished mid-drag. `PagePass` draws the sheets SIDE BY
 * SIDE, so page 2's third system shares page 1's third system's ROW; a band keyed by its y alone
 * folds the two into one, and the jump then landed the mark on whichever sheet happened to hold the
 * nearest candidate — measured, x 1382 while his cursor was at 334, a page away and off screen.
 */
import { runsOnSheetAt } from '@/engine/layout/systemBand'
import { dbg, debugEnabled } from '@/utils/debug'

interface StaffBand {
  top: number
  bottom: number
  /** The run's music, left to right. A cursor outside it is simply further away — ⛔ never excluded,
   *  since a mark may legitimately be dragged over a margin. */
  left: number
  right: number
  /**
   * ⚠️ **EXPLORATORY (2026-08-30) — how far this staff's own MUSIC reaches**, stems and beams
   * included (`ElementRegistry.staffRuns`). His call, on an 8va left sitting on the lower staff's
   * stems: *"as the ottava alta is more closer to the upper element of the down staff and we are
   * kind of the middle or more that the white space between, we should reanchor"*. So the white
   * space a mark is judged in is the one between the two staves' INK, ⛔ not between their lines.
   * Absent, the five lines answer, exactly as before.
   */
  inkTop?: number
  inkBottom?: number
}

/**
 * ⚠️⚠️ **EXPLORATORY (2026-08-30) — WHERE ONE STAFF'S TERRITORY ENDS AND THE NEXT BEGINS.** One line
 * between two staves, read the same in both directions, so a hand-over down and the hand-over back up
 * happen on the same pixel and there is no dead zone. ⛔ Which line it is, is the MARK's question and
 * has to be answered per family — his two answers, one afternoon apart:
 *
 * - **`'topLine'`** (the PEDAL): *"the reanchor y is the middle of the staff [below], i think it
 *   should be the upper line of the staff that is down"*. A pedal has ONE rung per staff — always
 *   below it — so a staff's territory runs from its own top line to the top line of the staff beneath.
 *   ⭐ It is `pedalTether.rowInkAt`'s rule, so the row a sign is DRAWN on and the staff it is FILED
 *   under cannot disagree.
 * - **`'betweenTheMusic'`** (the HAIRPIN): *"still here not reanchoring while i'm on the space of the
 *   elements of the staff"*, with the screenshot — the wedge sitting among the lower staff's notes,
 *   still filed under the upper one. ⭐⭐ A wedge has TWO rungs per staff (it has a `placement`), so
 *   *below staff 0* and *above staff 1* are the SAME strip of paper and only something INSIDE that
 *   strip can separate them: the middle of the white space between the two staves' own music.
 *
 * 🚨 **⛔ They may not be swapped.** A pedal judged by the music between would hand over on the first
 * pixel — it is engraved 52px below its staff where the musics are ~105px apart, so its home already
 * sits past the middle (his *"the pedal is completly crazy"*, eight hand-overs in one gesture). A
 * hairpin judged by the top line has to be dragged 97px, ⛔ past the rung it is actually going to land
 * on, which is what he reported here.
 */
type TerritoryRule = 'topLine' | 'betweenTheMusic'

/** One place the mark could be anchored, as the last render drew it. */
interface JumpCandidate<Stop> {
  x: number
  y: number
  stop: Stop
}

/** Everything the rule needs of one mark. Every reader answers off the LAST RENDER and may answer
 *  null — null meaning *"the picture cannot say"*, which is always answered with "no jump". */
export interface SystemJumpPort<Stop> {
  /** The painted (system, staff) runs — ⚠️ `staffRuns()`, ⛔ never `staffBands()`: a jump must be
   *  able to tell two sheets apart, and only the x can. */
  bands(): StaffBand[]
  /** Every place this mark could be anchored, drawn. */
  candidates(): JumpCandidate<Stop>[]
  /** Where the mark's OWN anchor is drawn — ⛔ not where its ink is, which is the whole point of a
   *  mark that has been carried away from home. Null when it is off screen. */
  anchor(): { x: number; y: number } | null
  /** Where the mark's ink was drawn last render. Null when it drew none. */
  inkY(): number | null
  /**
   * ⚠️ **EXPLORATORY (2026-08-30) — where the mark's ink BEGINS, left to right.** Supplied, the
   * landing is the candidate nearest THIS; absent, it is the one nearest the hand (every family but
   * the ottava, for now).
   *
   * His report, 2026-08-30: the guide line ran from the bracket to *"a space in the score where
   * there is nothing"* — measured, the hand at 290 while the bracket began at 205, so the landing
   * was eight spaces away and the offset had to hold the drawing back by that much.
   */
  inkX?(): number | null
  /**
   * ⚠️⚠️ **EXPLORATORY (2026-08-30), and OTTAVA-ONLY** — opt in to the white-space gate below
   * ({@link pastTheMusicBetween}). ⛔ Off for every other family: the octave line is the one being
   * explored by eye, and a shared rule changed underneath the other four is exactly what he
   * objected to — *"we were exploring ottava… does an ottava change the pedal?"*.
   */
  waitsForTheWhiteSpace?(): boolean
  /**
   * ⚠️⚠️ **EXPLORATORY (2026-08-30) — WHICH STAFF'S TERRITORY THE INK IS IN**, ⛔ instead of the
   * natural-home rule below, not as well as it. Two families, two landmarks, and ⛔ they are not
   * interchangeable — each is the one HE named for that mark ({@link TerritoryRule}).
   *
   * His call, on the pedal's drag: *"the reanchor y is the middle of the staff [below], i think it
   * should be the upper line of the staff that is down"* — and then, on a first cut that read the
   * NEAREST staff's near edge (its top going down, its bottom coming back up): *"is not the
   * neighboring staff… is the upper line of the staff that is down, that is completely another
   * thing"*. ⭐⭐ **Dead right, and the difference is the whole rule**: a near-edge test is two lines
   * and so has a dead zone between them — measured on his layout, hand over DOWN at 404 but back UP
   * only at 316, so the pedal had to be dragged inside the upper staff to be given back. **One line
   * between two staves**, read the same in both directions, has none.
   *
   * ⭐ It is a CHOOSER and cannot be written as a gate ({@link waitsForTheWhiteSpace}): a gate can
   * only postpone a hand-over, and this one arrives EARLIER than the natural rule's halfway line
   * (measured, 432 where the lower staff's lines are 404…444 — a third of the way INTO it, because a
   * pedal hangs 52px below its own staff and "where it would sit there" is 52px below that one).
   *
   * ⭐⭐ **It is `pedalTether.rowInkAt`'s rule arriving in the drag** — *a pedal is always drawn BELOW
   * its staff, so its row is the staff whose top line is the LAST one above the sign*. The same
   * sentence already decides which row a sign was DRAWN on, and now decides which staff it BELONGS
   * to; ⛔ two answers to that would be a mark drawn on one row and filed under another.
   *
   * ⭐⭐ **And it makes the band and the jump meet exactly**, which the natural rule never did: the
   * band floors a below-staff mark at the partner staff's top line, which is now the same line the
   * hand-over fires on. ⛔ Off for every other family, whose drags are not what is being looked at —
   * and ⛔ it assumes a mark drawn BELOW its staff, which is why it is not simply switched on for all.
   */
  belongsToTheStaffOverhead?(): TerritoryRule | null
  /** The mark's own stored vertical, in PIXELS and SCREEN-signed (+down), so it can be taken back
   *  out. ⚠️ A mark whose model stores it outward converts here and nowhere else. */
  liftPx(): number
  /** Which side of its staff the mark hangs on: true = above (measure from the TOP line). */
  above(): boolean
}

/**
 * The stop the mark now belongs to, or **null** while it still belongs where it is (that is the
 * walk's business), when the picture cannot say, or when the system it now belongs to holds nothing
 * this mark could anchor to.
 *
 * @param inkY where the mark's ink will be after this frame — {@link SystemJumpPort.inkY} plus the
 *   frame's `dy`.
 * @param cursorX the hand's x, which picks the stop WITHIN the system it landed on. ⛔ Never one
 *   hypotenuse over both axes: a pitch difference inside a system would then outvote a hundred
 *   pixels of x.
 */
export function systemStopFor<Stop>(
  port: SystemJumpPort<Stop>,
  cursorX: number,
  inkY: number,
): Stop | null {
  const bands = port.bands()
  if (bands.length < 2) return null

  const candidates = port.candidates()
  if (!candidates.length) return null

  const drawn = port.inkY()
  const anchor = port.anchor()
  if (drawn === null || !anchor) return null

  const above = port.above()
  const home = nearestBand(bands, anchor.x, anchor.y)
  // Where the ENGRAVER put this mark, and how far that is from the edge of its own staff.
  const naturalGap = (drawn - port.liftPx()) - edgeOf(home, above)

  // ⭐⭐ **THE SHEET UNDER THE HAND, FIRST.** A drag is vertical travel on ONE sheet: the mark may
  // change system and staff, ⛔ never page. Sheets stand side by side, so choosing by y alone lets a
  // system on the next page win a row it merely shares — the mark then lands a page away, off
  // screen, which is exactly what he saw (2026-08-30, and again on the ottava).
  const here = runsOnSheetAt(bands, cursorX)
  const natural = here.reduce((a, b) =>
    Math.abs(inkY - (edgeOf(b, above) + naturalGap)) < Math.abs(inkY - (edgeOf(a, above) + naturalGap)) ? b : a)

  // ⚠️⚠️ **EXPLORATORY (2026-08-30) — AND NOT BEFORE THE MIDDLE OF THE WHITE SPACE.**
  //
  // His report on the octave line: *"the mark is still down the uppest element of the down staff and
  // on the other size have not even reach the middle of the white space, so this reanchor is not
  // correct"* — the rule above hands a mark over a third of the way across the gap when it hangs on
  // the far side of its own staff, because "where it would sit on the other staff" is then INSIDE
  // the gap. So the hand-over waits until the ink has crossed the middle of the white space between
  // the two staves' own MUSIC ({@link pastTheMusicBetween}).
  //
  // ⛔ **A GATE, never the chooser** — 🚨 his report minutes later, on the pedal: nearest-by-ink alone
  // walked it eight staves down the page in one gesture (*"the pedal is completly crazy"*). A pedal
  // is engraved 52 px below its staff where the staves' music is 105 px apart, so its own home IS
  // the middle and every staff below it is "nearer". A mark's own home distance therefore has to
  // stay in the decision, which is exactly what `natural` knows and a distance to the ink does not.
  // ⚠️⚠️ **EXPLORATORY (2026-08-30) — THE PEDAL PICKS ITS TARGET A DIFFERENT WAY ENTIRELY**: the
  // staff OVERHEAD ({@link SystemJumpPort.belongsToTheStaffOverhead}). ⛔ It REPLACES the natural
  // rule for that family rather than gating it: his line has to be reached EARLIER than halfway
  // between the two homes, and no gate can do that.
  const territory = port.belongsToTheStaffOverhead?.() ?? null
  const gated = port.waitsForTheWhiteSpace?.() === true
  const target = territory
    ? (bandOwning(here, inkY, territory) ?? home)
    : natural !== home && (!gated || pastTheMusicBetween(home, natural, inkY))
      ? natural : home
  if (debugEnabled() && territory) {
    dbg(`[jump] ink ${inkY.toFixed(0)} | home ${home.top.toFixed(0)}…${home.bottom.toFixed(0)}`
      + ` (its music ${musicTop(home).toFixed(0)}…${musicBottom(home).toFixed(0)})`
      + ` | the '${territory}' territory rule ${target === home
        ? 'holds it here' : `says GO to ${target.top.toFixed(0)}…${target.bottom.toFixed(0)}`}`)
  }
  if (debugEnabled() && !territory && natural !== home) {
    dbg(`[jump] ink ${inkY.toFixed(0)} | home ${home.top.toFixed(0)}…${home.bottom.toFixed(0)}`
      + ` (its music ${musicTop(home).toFixed(0)}…${musicBottom(home).toFixed(0)})`
      + ` | the natural-home rule (gap ${naturalGap.toFixed(0)}px) says GO to`
      + ` ${natural.top.toFixed(0)}…${natural.bottom.toFixed(0)}`
      + ` (music ${musicTop(natural).toFixed(0)}…${musicBottom(natural).toFixed(0)})`
      + ` | the white space between them ${!gated ? '(not asked — this family does not gate)'
        : target === home ? '⛔ REFUSES it — not past the middle yet' : 'allows it'}`)
  }
  if (target === home) return null

  // ⚠️ EXPLORATORY (2026-08-30): the mark's own BEGINNING chooses where it lands, falling back on the
  // hand for the families that cannot say where their ink begins. See {@link SystemJumpPort.inkX}.
  const from = port.inkX?.() ?? cursorX
  let best: Stop | null = null
  let bestDistance = Infinity
  for (const candidate of candidates) {
    // ⚠️ The candidate's OWN x as well as its y — the same reason the target was chosen that way. A
    // note on the next sheet sits in this row too, and would otherwise be "on" this system.
    if (nearestBand(bands, candidate.x, candidate.y) !== target) continue
    const d = Math.abs(from - candidate.x)
    if (d < bestDistance) { bestDistance = d; best = candidate.stop }
  }
  return best
}



/**
 * ⚠️⚠️ **EXPLORATORY (2026-08-30) — WHOSE TERRITORY IS THIS INK IN?** The two rules
 * {@link TerritoryRule} names, which is where the reports and the reasons are.
 *
 * ⭐ Both are ⛔ NOT "the nearest staff": a pedal is engraved 52px under its staff where the staves
 * are 88px apart, so it begins life nearer its neighbour, and nearest-wins hands it down the page on
 * the first pixel of a drag (his *"the pedal is completly crazy"*).
 *
 * ⛔ Null when no staff owns it — a below-staff mark dragged over the FIRST staff of the sheet has
 * nothing overhead — and the caller then leaves it where it is.
 */
function bandOwning(bands: StaffBand[], inkY: number, rule: TerritoryRule): StaffBand | null {
  const rows = [...bands].sort((a, b) => a.top - b.top)
  if (rule === 'topLine') {
    // The last TOP LINE above the ink: a staff's territory reaches down to the next staff's top line.
    let best: StaffBand | null = null
    for (const band of rows) {
      if (band.top <= inkY) best = band
    }
    return best
  }
  // 'betweenTheMusic': the middle of the white space between each pair's own MUSIC divides them, so a
  // mark's territory is symmetric about its staff and covers BOTH of a wedge's rungs.
  for (let i = 0; i < rows.length; i++) {
    const ceiling = i === 0 ? -Infinity : (musicBottom(rows[i - 1]) + musicTop(rows[i])) / 2
    const floor = i === rows.length - 1
      ? Infinity : (musicBottom(rows[i]) + musicTop(rows[i + 1])) / 2
    if (inkY >= ceiling && inkY < floor) return rows[i]
  }
  return null
}

/** The staff line a mark of this placement hangs off: the TOP for one above, the BOTTOM for one
 *  below. What makes the rule read the same in both directions. */
function edgeOf(band: StaffBand, above: boolean): number {
  return above ? band.top : band.bottom
}

/** Which painted staff a y belongs to — the one whose five lines it is inside, or nearest to (a
 *  notehead on ledger lines is outside its own staff, and still that staff's). */
function nearestBand(bands: StaffBand[], x: number, y: number): StaffBand {
  // ⭐ The sheet decides first, then the row within it — two sheets' rows are not one ruler, so a
  // point 1000px to the right is not "nearly" in this system however well its y lines up.
  return runsOnSheetAt(bands, x).reduce((a, b) => (bandDistance(b, y) < bandDistance(a, y) ? b : a))
}

/** 0 inside the band, else the gap to its nearer edge. `ElementRegistry.staffIndexAtY`'s arithmetic.
 *  ⛔ The five LINES, not the ink: this answers *"which staff is this point on"* for an anchor and
 *  for a candidate, both of which are staff-resident. The ink has one job, below. */
function bandDistance(band: StaffBand, y: number): number {
  return spanDistance(band.top, band.bottom, y)
}

/**
 * ⚠️ **EXPLORATORY (2026-08-30) — has the mark crossed the middle of the white space between these
 * two staves?** Measured between their MUSIC (stems and beams included), which is the white space a
 * reader sees; their five lines answer for a run that drew none.
 *
 * ⭐ Directional, so it reads the same both ways: a hand-over DOWN needs the ink below the middle,
 * a hand-over UP needs it above.
 */
function pastTheMusicBetween(home: StaffBand, target: StaffBand, inkY: number): boolean {
  const down = musicTop(target) > musicTop(home)
  const middle = down
    ? (musicBottom(home) + musicTop(target)) / 2
    : (musicBottom(target) + musicTop(home)) / 2
  return down ? inkY > middle : inkY < middle
}

/** How far up this run's own music reaches — its top line when the run drew none. */
function musicTop(band: StaffBand): number {
  return Math.min(band.inkTop ?? band.top, band.top)
}

/** …and how far down. */
function musicBottom(band: StaffBand): number {
  return Math.max(band.inkBottom ?? band.bottom, band.bottom)
}

/** 0 inside [lo, hi], else the gap to its nearer end — the one shape both axes are measured with. */
function spanDistance(lo: number, hi: number, v: number): number {
  return v < lo ? lo - v : v > hi ? v - hi : 0
}
