/**
 * THE BAR-WIDTH GESTURE'S ARITHMETIC — how much room a bar-width gesture has on one bar, and what a
 * pixel is worth in it. Extracted from {@link MusicEngine} (docs/refactor-plan-2026-07-27.md Phase
 * 6b): it was a 200-line method with a 130-line branch, and it is really a **pure function** of the
 * last render's casting-off, the bar's stored stretch, the view mode and one measured slack — none
 * of which is engine state once it has been read.
 *
 * Made pure deliberately, not incidentally: every claim in `docs/bar-width-plan.md` §4–§5 is about
 * this mapping, so it is worth being able to state one in a test without a renderer, a score and a
 * DOM. `MusicEngine.barWidthRoom` stays as the one-line reader that gathers the four inputs.
 *
 * This is LAYOUT, not the model — it lives outside the core fence (`engine/models/**`, `utils/**`)
 * because it reasons about a drawing (docs/DESIGN-PRINCIPLES.md principle 3).
 */
import { LAYOUT_CONFIG, type MeasureWidthInfo, type ViewMode } from '@/engine/rendering/layoutConfig'
import { authoredScales, growthPayerShares, squeezedWidth } from '@/engine/rendering/MeasureLayout'
import { BAR_STRETCH_MIN, BAR_STRETCH_MAX } from '@/engine/models/engravingOverrides'

/**
 * What a bar-width gesture may do to one bar, all read off the last render — the answer
 * {@link MusicEngine.barWidthRoom} gives, and what a drag captures ONCE at the grab
 * (docs/bar-width-plan.md §4–§5).
 */
export interface BarWidthRoom {
  /** The bar's stretch as stored right now. */
  stretch: number
  /** The bar's note space in px — the unit a stretch multiplies, and the px→ratio divisor. */
  noteSpace: number
  /** Px the bar's ENDING BARLINE moves per px added to its stretch space: `1 − P(m)/T`. **0 means
   *  pinned** — the bar ends its system, so justification holds its barline at the right margin.
   *  Not a refusal: the bar can still be resized, and doing so re-wraps (see `nudgeBarWidth`). */
  barlineSlope: number
  /** Px the bar's own WIDTH changes per px added to its stretch space. 1 while the line still has
   *  somebody who can pay for the growth (a transfer arrives whole), 0 once nobody has slack left.
   *  The one the measured shrink floor converts through. */
  widthSlope: number
  /**
   * The bar is the ONLY one on its system — so nothing about it can move (justification hands it
   * the whole line whatever its stretch) and a key press steps to the next casting-off threshold
   * instead of spending itself on an identical picture.
   *
   * ⚠️ Stated, not inferred. It used to be read off `widthSlope === 0`, which stopped being the
   * same question: a bar whose neighbours are all at their floors also has `widthSlope` 0, and
   * treating THAT as alone made the shrink step a fixed point — it stored the stretch it already
   * had, every press, and the bar stopped shrinking with the log claiming it was alone.
   */
  alone: boolean
  /** The tightest stretch this bar may take: the drawn music's own floor (`MIN_NOTE_SPACING` per
   *  column, measured) or the absolute `BAR_STRETCH_MIN`, whichever binds. */
  minStretch: number
  /** The roomiest: the stretch at which this bar's width becomes the WHOLE LINE — derived per bar,
   *  because that is the widest picture there is (past it the bar is alone on its system and
   *  justified back to exactly the line width, so nothing changes). Deliberately NOT a reflow
   *  limit: running out of line is what makes a bar move to the next system, not a wall. Linear
   *  view has no line to fill, so there it is the absolute `BAR_STRETCH_MAX`. */
  maxStretch: number
  /** The line's authored total has passed `USER_SPACE_LINE_FRACTION`, past which the authored space
   *  is scaled down and the closed form above stops describing the picture exactly. Reported rather
   *  than refused; a live drag (P2) may want to decline on it, a key press does not care. */
  capped: boolean
  /**
   * The stretch that moves this bar's ending barline by `deltaPx` — **before** clamping to
   * [{@link minStretch}, {@link maxStretch}]. Ask this rather than multiplying by a slope: for a
   * bar with music the two agree exactly (the model is linear in the authored term), but for a
   * share-scaling empty bar the mapping is a hyperbola, and stepping along its tangent is not
   * reversible — ←← then →→ would leave the bar narrower than it started.
   *
   * Captured with the rest of the room at grab time, so a drag can call it per frame. **Continuous
   * by contract** — it never jumps the layout, and where the barline cannot move it answers "no
   * change" rather than doing something else that can be seen. A key press wants
   * {@link stretchForStep} instead.
   */
  stretchForBarlineDelta(deltaPx: number): number
  /**
   * The same question asked by a KEY PRESS — discrete, and free to jump.
   *
   * Identical to {@link stretchForBarlineDelta} everywhere the picture responds continuously. It
   * differs only for a bar ALONE on its system, where no stretch moves anything until the line's
   * membership changes: there a press goes straight to that threshold, so crossing a bar onto the
   * next system and bringing it back costs one press each way instead of one out and ten back.
   *
   * ⚠️ **A drag must not call this.** Jumping the casting-off while the pointer holds a barline is
   * precisely the desync §4 exists to prevent. The two only diverge in a state where a drag cannot
   * track regardless (`barlineSlope === 0`), which is where P2 should decline the grab.
   */
  stretchForStep(deltaPx: number): number
}

/**
 * How much room a bar-width gesture has on this bar, and what a pixel is worth in it — everything
 * needed to move a barline, measured off the **last render** (docs/bar-width-plan.md §4–§5).
 *
 * The trap it exists to solve: widening bar *m* also shrinks bar *m*'s own justified share, and
 * shrinks every bar *before* it on the line, so the barline you are holding does **not** move by
 * what you added. From `distributeLineWidths`, with `A` the available width, `I(k)` each bar's
 * intrinsic width and `T = Σ I` on the line, `finalWidth(m) = I(m)·(A − U)/T + u(m)` — linear in
 * the authored term, which is what makes the whole thing invertible in closed form:
 *
 *   d(bar m's width)   = e · (1 − I(m)/T)          ← {@link BarWidthRoom.widthSlope}
 *   d(barline after m) = e · (1 − P(m)/T)          ← {@link BarWidthRoom.barlineSlope}
 *
 * where `P(m) = Σ_{k≤m} I(k)`, the line's intrinsic up to **and including** the grabbed bar (the
 * barlines to its left slide left while you drag right, and carry the grabbed one back with them).
 *
 * Read once, legitimately rather than merely cheaply: none of these terms move during a gesture,
 * because a stretch changes no bar's *intrinsic* width.
 *
 * ⚠️ **A re-wrap is NOT a limit, and neither is a pinned barline.** The plan's §5 stopped the
 * gesture where the line would stop holding the same bars, to keep a dragged barline under the
 * cursor. Reported from use: it reads as the bar getting stuck for no visible reason, and it is
 * not what the field does — Sibelius, Finale and MuseScore all let the music re-wrap as you
 * spread it, which is the whole point of spreading it. So both reflow clamps are gone: stretching
 * far enough pushes a bar onto the next system, shrinking far enough pulls one up. The cursor
 * argument was only ever about a live drag (P2's problem, and it can re-add a guard for itself);
 * a key press has no cursor to lose.
 *
 * Same for the **last bar of a line**, where `P(m) = T` and `barlineSlope` is 0: its barline is
 * the right margin and genuinely cannot move — but the BAR can still be made wider or narrower,
 * and doing so is how music moves between systems. So a zero slope is reported, not declined, and
 * the caller steps in the bar's own note space instead (see {@link nudgeBarWidth}). Declining
 * there would also have been a trap once re-wrapping is allowed: stretch a bar until it is alone
 * on its system and there would be no key left that could bring it back.
 *
 * @returns null — "I don't know", decline rather than guess — only when the last render cannot
 * answer at all: the model is dirty (the picture and the numbers would come from different
 * moments), nothing is drawn for the bar yet, or it has no note space to multiply.
 */
export function barWidthRoom(input: {
  measureNumber: number
  /** The last render's casting-off — which bar landed on which line, and how wide each came out. */
  layout: ReadonlyMap<number, MeasureWidthInfo>
  /** The bar's stretch as stored right now. */
  stretch: number
  viewMode: ViewMode
  /**
   * How many px the DRAWN bar can give back before its music is tighter than the engraver's floor
   * (`measuredBarShrinkPx`, its sibling in this directory). Resolved by the caller because it is the other half of the same
   * "measured off the last render" reading, and null there means the whole answer is null.
   */
  slackPx: number
}): BarWidthRoom | null {
  const { measureNumber, layout, stretch, viewMode, slackPx } = input
  const info = layout.get(measureNumber)
  if (!info?.noteSpace) return null

  // Linear view justifies nothing, so finalWidth IS minWidth and both slopes are exactly 1. It
  // must take this branch rather than the formula below: every bar there carries lineNumber 0, so
  // `T` would become the whole score and the slope would come out wrong by a little in a long
  // score and badly wrong in a short one.
  let barlineSlope = 1
  let widthSlope = 1
  let capped = false
  // How far the stretch must travel to move the barline by `d` px. Linear models answer with the
  // slope; the share model has to SOLVE, because its mapping is a hyperbola and a derivative does
  // not come back to where it started (press ←← then →→ and the bar ends up narrower than it
  // began). Assigned by whichever branch below applies.
  let solveForBarlineDelta = (d: number) => stretch + d / info.noteSpace!
  // The DISCRETE twin, for a key press. Identical to the above except where the picture cannot
  // respond continuously — see the alone-on-its-system block. Never call it from a drag.
  let stepFor: ((d: number) => number) | null = null
  let alone = false
  // The ceiling, DERIVED rather than picked: the stretch at which this bar's width reaches the
  // whole line. That is the largest one anybody can see — pass 1 puts an oversized bar alone on
  // its own line and justification then hands it exactly `availableWidth`, so every stretch past
  // this draws the identical picture. It is also, in one number, "make this bar the whole system",
  // which a fixed multiplier could never express: the same 8× is a third of a line for a sparse
  // bar and more than a line for a dense one.
  let maxStretch = BAR_STRETCH_MAX

  if (viewMode === 'linear') {
    // Nothing is justified: the bar's width IS its minWidth, so a px of stretch space is a px of
    // barline movement, whichever model the bar uses.
    solveForBarlineDelta = (d: number) => stretch + d / info.noteSpace!
  } else {
    const line = [...layout.values()].filter(i => i.lineNumber === info.lineNumber)

    // ⭐ Growth is a **TRANSFER** (MeasureLayout.distributeLineWidths): the bar is handed its
    // growth whole, and the same number of pixels is taken back from the others in tier order —
    // spare empty bars first, music only once the silence is spent. So the bar's own width tracks
    // the gesture 1:1, and the barline moves by whatever the payers SITTING BEFORE IT give up.
    //
    // Two things fall out, and both are simplifications of what stood here. Growth is
    // `noteSpace × (stretch − 1)` in BOTH width models — the empty bar's share model and the
    // reserved one — so ONE formula covers them where there used to be a branch. And it is
    // LINEAR, so the slope is the exact inverse: the hyperbola the share model needed (and the
    // "press ←← then →→ and the bar ends up narrower" problem it existed to solve) is gone.
    // ⚠️ **Is this line actually FULL?** Everything below about limits assumes a justified line —
    // a fixed page total, so what one bar gains another pays. The LAST system is ragged by
    // default (LilyPond's `ragged-last`), and a ragged line has no fixed total: a grown bar just
    // makes it longer and nobody pays. Reported — with the last system ragged, a bar alone on it
    // could not be widened at all, because the ceiling below read "alone ⇒ it already IS the
    // line" and refused every press. That reasoning is sound only when the line fills the page.
    //
    // Measured off the drawn picture rather than asked of the flag: the layout justifies a ragged
    // last line anyway when it over-asks (see `calculateMeasureWidths`), so the flag alone would
    // not tell the truth about THIS line. What is on screen does.
    const lineWidth = line.reduce((sum, m) => sum + m.finalWidth, 0)
    const lineFills = lineWidth >= LAYOUT_CONFIG.CONTAINER_WIDTH - LAYOUT_CONFIG.MARGIN * 2 - 0.5

    const shares = growthPayerShares(line, measureNumber)
    // Nobody left with anything to give: the line cannot absorb another pixel, so no stretch
    // changes the picture — the same state a bar alone on its system is in, and handled below.
    const canPay = shares.size > 0
    const upToShare = line
      .filter(m => m.measureNumber <= measureNumber)
      .reduce((sum, m) => sum + (shares.get(m.measureNumber) ?? 0), 0)
    // Snapped, not just clamped: `1 − Σshares` lands on 1.1e-16 rather than 0 for a bar whose
    // payers all sit before it (the system-ending barline), and "pinned" has to read as pinned.
    const slope = canPay ? 1 - upToShare : 0
    barlineSlope = Math.abs(slope) < 1e-9 ? 0 : Math.max(0, slope)
    widthSlope = canPay ? 1 : 0
    if (barlineSlope > 1e-6) {
      solveForBarlineDelta = (d: number) => stretch + d / barlineSlope / info.noteSpace!
    }

    // ⚠️ **A bar ALONE on its system: a KEY PRESS steps to the next casting-off threshold.**
    // Nothing about such a bar can move — justification hands it the whole line whatever its
    // stretch — so every intermediate value draws the identical picture and a per-pixel step is
    // spent on nothing. That is not merely wasteful, it is asymmetric: reported from use, one
    // press pushed a bar down onto the next system and **ten** were needed to bring it back,
    // because the press that crossed the boundary was scaled by the slope and the presses coming
    // back were not. The only stretches that change anything here are the two where the line's
    // membership changes, so a press goes straight to the one it is heading for. Crossing out and
    // back is then one press each way.
    //
    // ⚠️ **Only when the bar is GENUINELY ALONE — asked of the line, not inferred from a slope.**
    // This used to read `widthSlope <= 1e-6`, which was a fair proxy while justification handed a
    // lone bar the whole line and nothing else could pin it. Under the transfer model it is not:
    // `widthSlope` is also 0 when the bar has neighbours who are simply all at their floors, and a
    // bar with company then took this branch and asked it to pull a bar up from the next system.
    // The target it computes is a FIXED POINT there — the press stores the stretch it already had,
    // every time, so shrinking stopped dead with the log cheerfully reporting "alone on its
    // system" about a bar sitting next to seven others. Reported from use.
    //
    // A last-of-line bar that still has neighbours is pinned at the barline but its own width very
    // much moves — the neighbours take what it gives up — so its intermediate values are real and
    // it keeps stepping by pixels. Same for a bar whose neighbours are spent: it can still hand
    // room BACK to them, which needs no payer at all.
    //
    // 🖱️ **And only for the KEYBOARD.** A jump is exactly what a drag must not do: the pointer is
    // holding a barline, and teleporting the layout out from under it is the one failure the whole
    // §4 inversion exists to prevent. This is safe to separate rather than reconcile, because the
    // state it fires in is one where a drag cannot track anyway — the barline is pinned, so it
    // cannot follow the pointer by any amount. `stretchForBarlineDelta` stays continuous and
    // answers "nothing moves"; P2 should read `barlineSlope === 0` and decline the grab outright.
    alone = line.length === 1
    // ⚠️ **The two directions do not fire on the same condition, and that is the whole fix.**
    // GROWING is dead whenever nobody on the line can absorb another pixel (`!canPay`): every
    // intermediate stretch draws the identical picture, so the press should go straight to the
    // casting-off threshold it is heading for — that is the reported 1-press-out/10-presses-back
    // asymmetry. SHRINKING is never dead that way: handing room back needs no payer, so it moves
    // the picture immediately. It stops only when the bar is the ONLY one on its system, where
    // the sole thing a shrink can change is pulling a bar up from below.
    //
    // Collapsing the two (both gated on `widthSlope === 0`) is what froze the shrink: a bar with
    // seven neighbours at their floors took the alone-branch, whose shrink target is a fixed
    // point, and every press re-stored the stretch it already had.
    if (lineFills && (alone || !canPay)) {
      const available = LAYOUT_CONFIG.CONTAINER_WIDTH - LAYOUT_CONFIG.MARGIN * 2
      const nextLineFirst = [...layout.values()]
        .filter(i => i.lineNumber === info.lineNumber + 1)
        .sort((a, b) => a.measureNumber - b.measureNumber)[0]
      const HAIR = 0.5 // px past the threshold, so the comparison lands the intended side
      // ⚠️ The bar below is measured AS A LINE-OPENER, so its `minWidth` carries a full clef it
      // will stop paying the moment it moves up here (mid-line it pays nothing, or the smaller
      // change width). Aim at its width WITHOUT that premium or the jump lands short and the bar
      // never comes up — and a threshold press that changes nothing repeats forever, since it
      // returns the same target every time. Assume the worst case (it pays the change width), so
      // the jump always clears: the cost is that pushing the bar back down can take a second press.
      const clefPremium = LAYOUT_CONFIG.CLEF_WIDTH - LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
      const stretchForWidth = (target: number) => stretch + (target - info.minWidth) / info.noteSpace!
      // Smooth, and by the bar's own music rather than by its (immovable) barline.
      const continuous = (d: number) => stretch + d / info.noteSpace!
      stepFor = (d: number) => {
        if (d < 0) {
          // Handing room back always moves the picture, so a shrink steps by pixels like any
          // other — unless the bar is alone, where the only thing that can change is whether a
          // bar comes up from below.
          if (!alone) return continuous(d)
          if (!nextLineFirst) return stretch // nothing below to pull up
          // ⚠️ Its SQUEEZED width, not its `minWidth`. The bar below comes up if the line can be
          // made to hold it, and pass 1 asks that of `squeezedWidth` — so aiming at its full asked
          // width undershoots badly and the way back costs ~10 presses where the way out cost one.
          // Aiming accurately used to be unsafe (miss, and a threshold press that changes nothing
          // repeats forever); it is safe now that such a press falls back to a continuous step.
          return Math.min(stretch, stretchForWidth(available - (squeezedWidth(nextLineFirst) - clefPremium) - HAIR))
        }
        // Widen to the next casting-off threshold — **which is not the same target when the bar
        // has company.** Alone, the threshold is "worth more than the whole line". With
        // neighbours it is "worth more than the line minus what they can be squeezed to", which
        // is where the LAST bar on the line gets pushed off. Aiming at the whole line there sent
        // one press from ×4.75 straight to ×21.6 — reported from the log, and it is the same
        // mistake as the shrink direction: a rule written for a lone bar applied to one that
        // merely has nothing left to take from.
        const others = line
          .filter(m => m.measureNumber !== measureNumber)
          .reduce((sum, m) => sum + squeezedWidth(m), 0)
        return Math.max(stretch, stretchForWidth(available - others + HAIR))
      }
      // The MOUSE never jumps: teleporting the layout out from under a pointer is the one failure
      // the whole §4 inversion exists to prevent. It must not freeze either — a drag that reaches
      // this state mid-gesture would otherwise be dead in the hand.
      solveForBarlineDelta = continuous
    }

    const available = LAYOUT_CONFIG.CONTAINER_WIDTH - LAYOUT_CONFIG.MARGIN * 2
    // Asked of the layout, not re-derived here: the two must agree about the same line, or the
    // gesture inverts a formula the picture is no longer following.
    const scales = authoredScales(line, available)
    capped = scales.userScale < 1 || scales.stretchScale < 1
    // ⭐ **A bar ALONE on its system IS the line — that is its maximum, whatever it is.** Asked,
    // reported: "a measure has a max width, the width of the line, so after that we should not add
    // more". There was a ceiling already — `available − minWidth` over the note space, the stretch
    // at which the bar's width reaches the full line — but it is blind to the bar having become
    // the whole system EARLIER, by pushing its neighbours off. Measured on his score: bar 1 went
    // alone at ×17.1 and the ceiling still said ×21.6, so a press bought +4.5 that drew the
    // IDENTICAL picture, then seven more did nothing, and every one of those units had to be
    // walked back before anything moved. Dead range is worse than a wall: a wall you can see.
    //
    // So once alone, the bar is already as wide as anything can make it and the ceiling is where
    // it stands. Growth is refused — against a limit the picture explains.
    maxStretch = alone && lineFills
      ? stretch
      : Math.min(
          BAR_STRETCH_MAX,
          Math.max(stretch, stretch + (available - info.minWidth) / info.noteSpace),
        )
  }

  // The one limit that is real in BOTH directions: the bar keeps the room its music is actually
  // using, measured off the drawn picture (`slackPx`, read by the caller). A bar alone on its line
  // (widthSlope 0) is already exactly as wide as the line, so no stretch changes its drawn width and
  // the floor cannot bind.
  const shrinkRoom = widthSlope > 1e-6 ? slackPx / widthSlope : Infinity

  // A share-scaling (empty) bar has a second floor, and it is the layout's own: `measureWidthParts`
  // clamps its scalable area at one column's `MIN_NOTE_SPACING`. Below that the stored number keeps
  // falling while the picture stands still — a dead press, which is the thing every one of these
  // limits exists to avoid.
  const layoutFloor = info.stretchScalesShare ? LAYOUT_CONFIG.MIN_NOTE_SPACING / info.noteSpace : 0

  return {
    stretch,
    noteSpace: info.noteSpace,
    barlineSlope,
    widthSlope,
    capped,
    alone,
    stretchForBarlineDelta: solveForBarlineDelta,
    stretchForStep: stepFor ?? solveForBarlineDelta,
    minStretch: Math.max(BAR_STRETCH_MIN, layoutFloor, stretch - shrinkRoom / info.noteSpace),
    maxStretch,
  }
}
