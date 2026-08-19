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

/** A painted staff's five lines, top to bottom — `ElementRegistry.staffBands()`' shape. */
export interface StaffBand {
  top: number
  bottom: number
}

/** One place the mark could be anchored, as the last render drew it. */
export interface JumpCandidate<Stop> {
  x: number
  y: number
  stop: Stop
}

/** Everything the rule needs of one mark. Every reader answers off the LAST RENDER and may answer
 *  null — null meaning *"the picture cannot say"*, which is always answered with "no jump". */
export interface SystemJumpPort<Stop> {
  /** The painted staves, top and bottom line of each. */
  bands(): StaffBand[]
  /** Every place this mark could be anchored, drawn. */
  candidates(): JumpCandidate<Stop>[]
  /** Where the mark's OWN anchor is drawn — ⛔ not where its ink is, which is the whole point of a
   *  mark that has been carried away from home. Null when it is off screen. */
  anchor(): { x: number; y: number } | null
  /** Where the mark's ink was drawn last render. Null when it drew none. */
  inkY(): number | null
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
  const home = nearestBand(bands, anchor.y)
  // Where the ENGRAVER put this mark, and how far that is from the edge of its own staff.
  const naturalGap = (drawn - port.liftPx()) - edgeOf(home, above)

  const target = bands.reduce((a, b) =>
    Math.abs(inkY - (edgeOf(b, above) + naturalGap)) < Math.abs(inkY - (edgeOf(a, above) + naturalGap)) ? b : a)
  if (target === home) return null

  let best: Stop | null = null
  let bestDistance = Infinity
  for (const candidate of candidates) {
    if (nearestBand(bands, candidate.y) !== target) continue
    const d = Math.abs(cursorX - candidate.x)
    if (d < bestDistance) { bestDistance = d; best = candidate.stop }
  }
  return best
}

/** The staff line a mark of this placement hangs off: the TOP for one above, the BOTTOM for one
 *  below. What makes the rule read the same in both directions. */
function edgeOf(band: StaffBand, above: boolean): number {
  return above ? band.top : band.bottom
}

/** Which painted staff a y belongs to — the one whose five lines it is inside, or nearest to (a
 *  notehead on ledger lines is outside its own staff, and still that staff's). */
function nearestBand(bands: StaffBand[], y: number): StaffBand {
  return bands.reduce((a, b) => (bandDistance(b, y) < bandDistance(a, y) ? b : a))
}

/** 0 inside the band, else the gap to its nearer edge. `ElementRegistry.staffIndexAtY`'s arithmetic. */
function bandDistance(band: StaffBand, y: number): number {
  return y < band.top ? band.top - y : y > band.bottom ? y - band.bottom : 0
}
