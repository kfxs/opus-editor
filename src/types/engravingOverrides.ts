/**
 * ENGRAVING OVERRIDES — the user's hand-adjustments to the ink, one interface per kind, filed on
 * `Score.engravingOverrides`. ⛔ Not content: an override moves what is drawn, never what is played.
 *
 * One chapter of the score's types — import it through the barrel, `@/types/music`.
 */

/**
 * One authored engraving adjustment on a score element — an entry in the
 * **engraving-overrides compartment** (see docs/plans/engraving-overrides-plan.md).
 *
 * An override is *authored geometry*: continuous, measured, hand-positioned data
 * that is deliberately kept OUT of the musical content model, so transposition,
 * playback and re-barring never trip over pixels. Positional kinds store
 * **staff-spaces**, relative to the element's natural (auto) position — never raw
 * pixels, never an absolute canvas coordinate — so a tweak renders correctly at any
 * font/zoom/spacing and rides along when the music reflows.
 *
 * Open-ended by design: each entry is tagged by `kind`; adding a new kind later is
 * additive (a new tagged member), never a teardown. Phase 0 shipped the compartment
 * with no concrete kinds yet; the first, {@link CurveShapeOverride}, landed in Phase 1
 * and is where a hand-shaped slur is kept. Distinct from *semantic* side/direction flips
 * (`stemDirection`, `*.placement`, `tieDirection`), which are notational meaning and
 * stay on the content model above — only continuous geometry lives here.
 */
export interface EngravingOverride {
  /** Discriminator: which kind of adjustment this is. Concrete kinds are introduced
   *  incrementally; see docs/plans/engraving-overrides-plan.md §4. */
  kind: string
}

/**
 * Two cubic Bézier control-point **deltas** fed to `engrave/curves/curveInk` — the
 * editable "handle" data for a slur/curve shape. Each `{x,y}` is an offset on top of
 * the spacing-based base control point, so an edit rides along when the anchor notes
 * move. See docs/plans/slur-plan.md §6–§7 and {@link CurveShapeOverride}.
 */
export type CurveControlPointDeltas = [{ x: number; y: number }, { x: number; y: number }]

/**
 * Client #1 of the engraving-overrides compartment (Phase 1): a hand-edited curve
 * shape. The two control-point deltas are stored in **staff-spaces**, anchor-relative —
 * NOT pixels, which is why it lives here rather than inline on the slur: a pixel offset
 * would be tied to the current font/zoom/spacing. The renderer converts staff-spaces
 * → pixels at draw time against the live stave; absent = the auto arch.
 */
export interface CurveShapeOverride extends EngravingOverride {
  kind: 'curveShape'
  /** Control-point deltas in **staff-spaces**, anchor-relative. */
  cps: CurveControlPointDeltas
}

/**
 * Per-segment shape for a **cross-system** slur (one drawn as `BEGIN + k×MIDDLE + END`,
 * see docs/plans/multisystem-slur-segment-shape-plan.md). A same-line slur is a single arc and
 * uses {@link CurveShapeOverride} instead — this is a deliberately SEPARATE kind, so the
 * single↔multi boundary needs no special logic (a collapsed-to-one-line slur reads its
 * empty `curveShape` and draws the default).
 *
 * Unlike every other override, this one is **deliberately layout-ephemeral**: a MIDDLE
 * segment is anchored to nothing but its system's margins (a pure layout artifact), so its
 * shape is meaningful only while that middle exists. `begin`/`end` are tied to the real
 * start/end notes and are durable. The reset signature is {@link spanCount}: when the live
 * system count (`toLine − fromLine + 1`) differs from the authored `spanCount`, the
 * `middles` are stale and ignored at read time (begin/end still apply). See
 * `reconcileSegmentShape` for the read-only apply rule.
 */

/**
 * Addresses ONE segment of a cross-system slur for a shape edit: a role-keyed BEGIN/END
 * (durable, note-anchored) or an ordinal-keyed MIDDLE (layout-bound). Used by the handle
 * drag → `setSlurSegmentShape` write path. A same-line slur has no address (its whole arc
 * is the single-arc `curveShape`).
 */
export type SlurSegmentAddress =
  | { role: 'begin' | 'end' }
  | { role: 'middle'; ordinal: number }

export interface SegmentCurveShapeOverride extends EngravingOverride {
  kind: 'segmentCurveShape'
  /** System count this was authored against (`toLine − fromLine + 1`). The reset
   *  signature: a live count differing from this means the `middles` are stale. */
  spanCount: number
  /** BEGIN segment cps (staff-spaces, anchor-relative). Role-keyed → durable. */
  begin?: CurveControlPointDeltas
  /** END segment cps (staff-spaces, anchor-relative). Role-keyed → durable. */
  end?: CurveControlPointDeltas
  /** MIDDLE segment cps keyed by **ordinal** among middles (0-based, NOT lineNumber) —
   *  survives a same-count reflow, dropped on a count change via `spanCount`. */
  middles?: Record<number, CurveControlPointDeltas>
}

/**
 * Client #3 of the engraving-overrides compartment: a free positional nudge of a slur's
 * in/out endpoint(s), on top of its note anchor (see docs/plans/slur-endpoint-offset-plan.md).
 * Each offset is in **staff-spaces**, anchor-relative — added to the auto endpoint
 * position at render against that end's own stave. Both ends are note-anchored on same-line
 * AND cross-system slurs, so unlike {@link SegmentCurveShapeOverride} there is no `spanCount`
 * staleness and no reconcile rule — it is read straight through. ⚠️ It is nevertheless cleared
 * when its OWN end is re-anchored (`slurOps.setSlurEndpoint`, revised 2026-08-17): the nudge was
 * tuned against the ink of the note it sat on, and being anchor-relative makes it transferable,
 * not wanted. The other end's nudge is untouched, and both die with the slur.
 */
export interface SlurEndpointOffsetOverride extends EngravingOverride {
  kind: 'endpointOffset'
  /** Start (in) point offset in staff-spaces, relative to the start anchor. */
  start?: { x: number; y: number }
  /** End (out) point offset in staff-spaces, relative to the end anchor. */
  end?: { x: number; y: number }
}

/**
 * ⭐⭐ **THE WHOLE CURVE MOVED, SHAPE INTACT** — a slur's own offset, the arrows' answer when the slur
 * is selected and no handle is armed (his ask, 2026-08-18: *"what we dont have is total slur offset
 * (similar to the hairpin) the slur selected but no control point or endpoints so with arrow/ctr arrow
 * we offset it (and the arc conserve the same shape, so we dont recalculate)"*).
 *
 * ⭐ It completes a family: a hairpin, an octave line, a pedal and a trill all move whole when nothing
 * of theirs is armed, and the slur was the one kind left out.
 *
 * ## 🚨 Why it is NOT two {@link SlurEndpointOffsetOverride}s
 *
 * `setHairpinOffset` writes both of its ends and is done — a wedge has no shape to lose. Doing that
 * here would **recalculate the arc**: the arch is raised over whatever it covers, and that solve
 * (`slurArchClearance`, from the endpoints inward) re-runs from wherever the ends now are. A slur
 * lifted clear of the noteheads it was arched over FLATTENS as it rises, and pushed down it fights
 * back. The span and the slant survive an equal move; the obstacle lift does not.
 *
 * ⭐ So it is a **rigid translate applied after the shape is resolved**: the cubic's `cps` are
 * endpoint-relative deltas (`slurArchCps`), so adding this to both endpoints at the end moves the
 * drawn curve and nothing else — same arch, same hand-edited shape, same obstacle lift, no re-solve.
 * ⚠️ On a cross-system slur it is applied per FRAGMENT, after each one's own resolve, for the same
 * reason: a fragment's open end is margin-bound, and translating before the solve would restretch it.
 *
 * ## The numbers
 *
 * ⭐ **Screen-signed** (`x` right, `y` down), in staff-spaces — ⛔ deliberately NOT the `outward` of
 * {@link OttavaOffsetOverride} / {@link TrillOffsetOverride}, though a slur's side flips (`x`) which
 * is exactly what that rule is for. It **adds to `SlurEndpointOffsetOverride` on the same two points**,
 * and two offsets summed into one position must not disagree about which way is up: one screen-signed
 * and one outward-signed would move opposite ways after a flip, which is worse than either convention
 * alone. Changing the pair is a job for both kinds at once, not for this one.
 *
 * ⚠️ It SURVIVES a re-anchor of either end — {@link HairpinEndpointOffsetOverride}'s rule: the nudge
 * says *"the whole curve sits a space higher than wherever it lands"*, which is about the drawing and
 * not about one notehead's ink (the reason the per-end nudge is dropped instead). `Ctrl+Backspace` with
 * nothing armed drops it; it dies with the slur.
 */
export interface SlurOffsetOverride extends EngravingOverride {
  kind: 'slurOffset'
  /** The whole curve's horizontal nudge, staff-spaces (+ right). */
  x?: number
  /** The whole curve's vertical nudge, staff-spaces (+ DOWN, screen-signed — see above). */
  y?: number
}

/**
 * A free positional nudge of a HAIRPIN's drawn end(s) — the wedge's own reshape (his ask,
 * 2026-08-17: *"when an endpoint is selected and i ctrl+arrow i want to be able to offset, so is an
 * override, and that means the user is able to reshape the hairpin"*).
 *
 * ⭐⭐ **This is the line between the two edits on the same two squares, and it is the whole reason a
 * hairpin now has an override at all.** `Ctrl+Shift+←/→` (and a drag) change WHICH NOTES the wedge
 * covers — musical, so they write `beat`/`length` on the model. The arrows here change only where the
 * ink is drawn: how far the tip reaches, and how open or slanted the wedge looks. Nothing about the
 * music moves, playback cannot tell, and the span the model reports is unchanged
 * (docs/plans/dynamics-line-and-hairpins-plan.md §4 — the rule that used to say a hairpin had *nothing*
 * cosmetic, which was true only until there was a way to author it).
 *
 * ⭐ Per END, in **staff-spaces**, relative to the drawn position: `x` moves that end along the
 * wedge (± its reach), `y` moves it off the dynamics line — so a `y` on ONE end is what tilts the
 * wedge, and a `y` on both lifts it whole. Structurally the slur's {@link SlurEndpointOffsetOverride}
 * exactly; a separate kind because it hangs off a different element and answers to a different reset.
 *
 * ⚠️ It SURVIVES a resize or a drag of the extent, deliberately: the nudge says "two spaces further
 * out than wherever this end lands", which is a statement about the shape rather than about the note
 * it happened to be near. (The slur's is cleared on a re-anchor for the opposite reason — there the
 * nudge was tuned against one notehead's ink.) `Ctrl+Backspace` resets the armed end; both die with
 * the hairpin.
 */
export interface HairpinEndpointOffsetOverride extends EngravingOverride {
  kind: 'hairpinEndpointOffset'
  /** Left-hand end offset, staff-spaces (+x right, +y down). */
  start?: { x: number; y: number }
  /** Right-hand end offset, staff-spaces. */
  end?: { x: number; y: number }
}

/**
 * A hand-set MOUTH for one hairpin — how far the wedge opens, in **staff-spaces** (his ask,
 * 2026-08-17: *"in the property i also want to control the mouth aperture"*).
 *
 * ⭐ **A property of the WEDGE, not of an end**, which is why it is its own kind rather than a third
 * field on {@link HairpinEndpointOffsetOverride}: the aperture is one number for the whole span, and
 * a split wedge divides it among its fragments (`fragmentOpening`) rather than each piece having one.
 *
 * ⭐ It REPLACES the automatic, length-aware default (`automaticAperture` — flat, then a ramp, then
 * flat) rather than adding to it: a hand-set mouth is a human answering the question the default
 * exists to guess at. ⚠️ The STEEPNESS CAP still applies on top (`resolveHairpinShape`), so a very
 * short wedge cannot be authored into an arrowhead — Verovio caps an authored aperture too.
 *
 * ⛔ It carries no `startY`/`endY`, though `HairpinShapeOverrideLike` in the renderer has room for
 * them: the vertical belongs to {@link HairpinEndpointOffsetOverride}, which is per END and also
 * carries x. Two ways to say "this end sits half a space lower" is exactly the disagreement the
 * compartment exists to avoid.
 */
export interface HairpinApertureOverride extends EngravingOverride {
  kind: 'hairpinAperture'
  /** Staff-spaces, > 0. The mouth's full opening — each arm is half of it, mirrored about the axis. */
  aperture: number
}

/**
 * ⭐⭐ **A hand-set TRAILING GAP for one cautionary key signature** — how much bare staff is drawn
 * after it, in **staff-spaces** (his ask, 2026-08-28: *"lets make what we have now default but give
 * the user the freedom to change the number in properties"*).
 *
 * ⭐ **Why this number and not the other one.** A courtesy at a system break has two gaps: 0.75 sp
 * from the barline to its first sign, and the bare staff after its last. The first is a spacing rule
 * measured off Gould p. 93 and is not the author's to move any more than the gap after a clef is; the
 * second is the *tail of the system*, which is the part a reader can reasonably want longer or
 * shorter. ⛔ So this is deliberately ONE number, not a pair.
 *
 * ⚠️ **Keyed by the CHANGE's measure, never by the bar that happens to draw the courtesy** — which
 * bar ends a system moves on every reflow, and the author's decision must not move with it. That is
 * the rule the meter's and the clef's cautionary overrides already follow (`cautionaryKey`,
 * `cautionaryClefKey`), and this key is `cautionKeyGap:` + the same shape.
 *
 * ⭐ It REPLACES the default (`CAUTIONARY_KEY_TO_LINE_END`) rather than adding to it, like the
 * hairpin's aperture: a hand-set gap is a human answering the question the default guesses at.
 */
export interface CautionaryKeyGapOverride extends EngravingOverride {
  kind: 'cautionaryKeyGap'
  /** Staff-spaces of bare staff after the courtesy's last sign, ≥ 0. */
  gap: number
}

/**
 * A hand-nudged OCTAVE BRACKET — where its ink is drawn, in **staff-spaces**, reached from either of
 * its two endpoint squares (his ask, 2026-08-17: *"the square points offset"*).
 *
 * ⭐⭐ **THREE numbers, not two pairs, and the missing fourth IS the rule.** His words: *"take into
 * consideration that ottava is a straight line, so offset in y should result in offset the two points
 * in y."* An octave bracket is a horizontal rule with a hook — a `y` on one end and a different `y`
 * on the other would TILT it, which is not a shape this notation has. So the vertical is **one
 * number for the whole bracket** and there is nowhere to store a second: the illegal state is
 * unrepresentable rather than merely avoided by the code that writes it.
 *
 * ⛔ **This is the one place it differs from {@link HairpinEndpointOffsetOverride}**, whose per-end
 * `{x, y}` pairs are right for a wedge precisely because a `y` on ONE end tilting it is a legitimate
 * shape there. Copying that structure here and writing both `y`s together would be two numbers that
 * can disagree about a quantity the notation only has one of — the disagreement this whole
 * compartment exists to prevent.
 *
 * ⭐ The horizontal stays PER END, because the two ends do different jobs: `startX` pulls the numeral
 * (and the line that leaves it), `endX` pulls the closing hook. Shortening the drawn bracket without
 * changing which notes are displaced is exactly what an override is for.
 *
 * ⚠️ It SURVIVES a resize, a start-move or a drag of the extent, {@link HairpinEndpointOffsetOverride}'s
 * rule and for its reason: the nudge says "half a space higher than wherever this bracket lands",
 * which is a statement about the drawing rather than about the note it happened to be near.
 * `Ctrl+Backspace` on an armed square drops that end's `x` **and** the shared `y`; it all dies with
 * the ottava.
 */
export interface OttavaOffsetOverride extends EngravingOverride {
  kind: 'ottavaOffset'
  /** The BEGINNING's horizontal nudge, staff-spaces (+ right). Moves the numeral and the line
   *  leaving it; the far end stays where it is. */
  startX?: number
  /** The END's horizontal nudge, staff-spaces (+ right). Moves the closing hook alone. */
  endX?: number
  /**
   * ⭐⭐ **The WHOLE bracket's vertical nudge, staff-spaces — `+` moves it FURTHER FROM THE STAFF**
   * (up for an 8va, down for an 8vb). ONE number, because the bracket is a straight line.
   *
   * 🚨 **Deliberately NOT a screen `y`, which every other override in this compartment is**, and the
   * exception is earned twice over:
   *
   * ⭐ **His hand found the first reason** (2026-08-17): *"the height is not intuitive… for 8vb it
   * works, because increasing makes it higher, but with 8va alta it does not. Better to use an
   * intuitive way that follows the real geometry."* A screen `y` means "further out" on one side of
   * the staff and "further in" on the other, so one control reads backwards half the time — and a
   * typed box, unlike an arrow key, has no direction on it to say which.
   *
   * ⭐⭐ **The second reason is a real bug and is why this lives in the MODEL rather than being fixed
   * in the panel**: an ottava's side is DERIVED from `shift`, and `x` flips it (`toggleOttavaDirection`).
   * With a screen `y`, flipping an 8va you had nudged clear of the music turns that nudge into a shove
   * toward it — the stored number stops meaning what it was written to mean. Stated as a distance from
   * the staff, the intent survives the flip.
   *
   * ⚠️ So exactly two places convert, and both are edges that genuinely speak screen: the RENDERER
   * (`OttavaRenderer`, which negates it above the staff) and the PAGE LIMIT (`MusicEngine`, which
   * needs a screen delta to predict where the ink lands). The keyboard converts on the way in, since
   * `↑` is a screen direction. Everything else reads it as written.
   */
  outward?: number
}

/**
 * The hand-nudged INK of a SUSTAIN PEDAL — the `Ped.` and the `✻` moved off where the engraver put
 * them, without changing when the damper goes down or comes up. {@link OttavaOffsetOverride}'s
 * shape, and the last thing docs/plans/pedal-plan.md §6.3 left for later (*"a hand-nudged `✻`"*).
 *
 * ⭐ The horizontal stays PER SIGN, because the two signs are two separate glyphs with two separate
 * jobs — and unlike the bracket's ends there is no line between them that a nudge could stretch.
 *
 * ⭐⭐ **The vertical is ONE number, and here that is an ENGRAVING RULE rather than a geometric
 * one.** Gould p. 333: *an individual pedal-and-release instruction should always align, for
 * clarity* — a pedal and its own release share one baseline (the bracket's shared `y` is merely
 * because a straight line cannot tilt; this is a convention about how the pair reads). So there is
 * nowhere to put a second height, and `Ctrl+Backspace` on either square gives back that one.
 *
 * 🚨 **Screen `y`, NOT the ottava's `outward` — and the difference is a fact about pedals, not an
 * inconsistency.** `outward` exists because an octave line's side is DERIVED from `shift` and `x`
 * flips it, so a screen number would invert a nudge the user had already made. A pedal has ONE side,
 * permanently (`PedalRenderer` §3 — always below, *nothing to derive and nothing to flip*), so the
 * two spellings would differ by a sign that never changes. ⚠️ Writing `outward` here would be a
 * distinction with no observable difference — untestable ceremony, and the ottava's own spec records
 * what those cost: every test there used an 8va, where the conversion is the identity, and they all
 * passed with it deleted.
 *
 * ⚠️ It SURVIVES a resize, a press-move or a drag of the extent, {@link OttavaOffsetOverride}'s rule:
 * the nudge says *half a space further from wherever this pedal lands*, which is a statement about
 * the drawing. It all dies with the pedal.
 */
export interface PedalOffsetOverride extends EngravingOverride {
  kind: 'pedalOffset'
  /** The `Ped.`'s horizontal nudge, staff-spaces (+ right). ⚠️ The FIRST one only — a `(Ped.)`
   *  resumption on a later system is a reminder, not the end the user grabbed. */
  startX?: number
  /** The release `✻`'s horizontal nudge, staff-spaces (+ right). */
  endX?: number
  /** ⭐ The WHOLE pedal's vertical nudge, staff-spaces, SCREEN-signed (+ down) — one number for both
   *  signs; see this interface's note for why it is screen where the bracket's is `outward`. */
  y?: number
}

/**
 * The hand-nudged INK of a TRILL — the `tr` and the end of its wavy line moved off where the
 * engraver put them, without changing which notes are trilled. {@link PedalOffsetOverride}'s shape,
 * with one field spelled the OTHER way for a reason worth stating.
 *
 * ⭐ The horizontal stays PER END: `startX` pulls the sign (and the wiggle that leaves it, since the
 * line starts where the sign ends), `endX` pulls only where the line stops.
 *
 * ⭐⭐ **The vertical is ONE number**, because the sign and the wiggle are drawn on one baseline —
 * the pedal's reason rather than the bracket's: there is no straight rule here that a second height
 * could tilt, there is a pair of marks that read as one.
 *
 * 🚨 **…but it is `outward`, NOT the pedal's screen `y`, and that is the whole of what the two
 * disagree about.** A pedal has one side permanently. A trill's side is stored ({@link
 * Trill.placement}) and **`x` flips it** — so a screen-signed number would turn a nudge that meant
 * *clear of the music* into a shove toward it the moment the ornament moved under the staff. The
 * bracket's field exists for exactly that reason ({@link OttavaOffsetOverride}), and the rule
 * generalises: ⭐ **store `outward` iff the mark can change sides.**
 *
 * ⚠️ So the RENDERER negates it above the staff, and so does the page limit; the keyboard converts on
 * the way in, since `↑` is a screen direction. Everything else reads it as written.
 *
 * ⚠️ It SURVIVES a re-anchor of either end — the nudge says *half a space further from wherever this
 * ornament lands*, which is a statement about the drawing. It all dies with the trill.
 */
export interface TrillOffsetOverride extends EngravingOverride {
  kind: 'trillOffset'
  /** The SIGN's horizontal nudge, staff-spaces (+ right). ⚠️ The piece carrying the trill's true
   *  start only — a continuation `(tr)` is a reminder, not the end the user grabbed. */
  startX?: number
  /** Where the WAVY LINE stops, staff-spaces (+ right). The sign stays put. */
  endX?: number
  /** ⭐ The whole ornament's vertical nudge, staff-spaces — `+` moves it FURTHER FROM THE STAFF (up
   *  above it, down below it). See this interface's note for why it is not a screen `y`. */
  outward?: number
}

/**
 * Addresses ONE open join of a cross-system slur for an endpoint-offset nudge (the
 * point where the slur leaves one system and resumes on the next). BEGIN has only an
 * open RIGHT end and END only an open LEFT end (so no `side`); a MIDDLE has both.
 * Distinct from {@link SlurSegmentAddress} (shape edits never carry a side). The two
 * TRUE note-anchored ends are addressed by `'start'`/`'end'` (see
 * {@link SlurEndpointOffsetOverride}), not here.
 */
export type SlurSegmentEndpointAddress =
  | { role: 'begin' }
  | { role: 'end' }
  | { role: 'middle'; ordinal: number; side: 'left' | 'right' }

/**
 * Client #4 of the engraving-overrides compartment: free positional nudges of the OPEN
 * join points of a cross-system slur (see docs/plans/multisystem-slur-segment-endpoint-offset-plan.md).
 * Each offset is in **staff-spaces**, margin-relative — added to the auto open-end position
 * at render against that segment's own stave. Structurally parallel to
 * {@link SegmentCurveShapeOverride}: `begin`/`end` are durable (their system margins are
 * stable references), `middles` reset on a `spanCount` change. The two TRUE note-anchored
 * ends use {@link SlurEndpointOffsetOverride} instead — deliberately a SEPARATE kind, just
 * as `curveShape` (single arc) is separate from `segmentCurveShape` (per segment).
 */
export interface SegmentEndpointOffsetOverride extends EngravingOverride {
  kind: 'segmentEndpointOffset'
  /** System count this was authored against (`toLine − fromLine + 1`). Reset signature:
   *  a live count differing from this means the `middles` are stale. */
  spanCount: number
  /** BEGIN segment's open RIGHT end offset (staff-spaces). Role-keyed → durable. */
  begin?: { x: number; y: number }
  /** END segment's open LEFT end offset (staff-spaces). Role-keyed → durable. */
  end?: { x: number; y: number }
  /** MIDDLE open-end offsets keyed by **ordinal** among middles (0-based, NOT lineNumber):
   *  `left` and/or `right`. Survives a same-count reflow, dropped on a count change. */
  middles?: Record<number, { left?: { x: number; y: number }; right?: { x: number; y: number } }>
}

/**
 * Client #5 of the engraving-overrides compartment: a manual vertical shift of a rest,
 * in whole **staff SPACES** (signed, +up), added on top of the automatic multi-voice
 * placement (see docs/plans/rest-shift-plan.md). A rest is pitchless, so its vertical position
 * carries no musical meaning — this is pure engraving/clarity geometry, not content, and
 * staff spaces keep it resolution-independent (no pixels in the model, principle 3).
 *
 * ⚠️ **A SPACE, not a "staff-step".** This doc and `docs/plans/rest-shift-plan.md` both said *step*
 * while every consumer treated it as a SPACE — the arithmetic is `getLineForRest() + steps` and a
 * VexFlow line IS a space — so a `steps: 6` here is **6 staff spaces = 12 diatonic steps**, twice
 * what the word suggests. That ambiguity cost a research pass: a stored 6 was read as matching
 * Gould's measured ±3 spaces when it is double it (docs/research/multi-voice-rest-position.md §1), and it is
 * what let the voice hop add a space count to a diatonic scale unconverted. ⛔ A COMMENT fix only:
 * the arithmetic is already spaces and must not change.
 *
 * Unlike every other client, this one is **position-keyed, not element-id-keyed**: rests
 * are regenerated (fresh ids) on every edit, so the override hangs off the rest's
 * position address (`restPositionKey`, `{measureId}:v{voice}:b{num}/{den}`) instead. The
 * shift travels with the music across paste/rebar via `captureRestShifts`/`restoreRestShifts`.
 */
export interface RestShiftOverride extends EngravingOverride {
  kind: 'restShift'
  /** Whole staff SPACES, signed, +up. Added on top of the DERIVED multi-voice placement. */
  steps: number
}

/**
 * Client #6 of the engraving-overrides compartment: a hidden rest (Sibelius-style
 * Ctrl+Shift+H — see docs/plans/rest-hide-plan.md). The rest is still real content (an empty
 * beat stays filled); this only suppresses its normal engraving. The override carries no
 * payload — **presence = hidden, absence = visible** — so JSON stays clean and absent
 * degrades to the default (drawn) just like every other client.
 *
 * Like {@link RestShiftOverride}, it is **position-keyed, not element-id-keyed** (rests get
 * fresh ids on every edit): the key is the rest's position address (`restPositionKey`). It
 * travels with the music across paste/rebar via `captureRestShifts`/`restoreRestShifts`.
 */
export interface RestHiddenOverride extends EngravingOverride {
  kind: 'restHidden'
}

/**
 * Client #8 of the engraving-overrides compartment: this meter change ALLOWS a courtesy
 * (cautionary) time signature. Payloadless — presence alone means allowed. Keyed by the id of the
 * measure the change starts at ({@link cautionaryKey}), because a meter change has no id of its own.
 *
 * A property of the CHANGE, and there is no score-wide default to reconcile it with: a cautionary
 * can only ever exist where a meter changes, so every one of them has a change to belong to. The
 * rule is one condition in two halves — this flag, and then whether the change happens to open a
 * system (`MeasureLayout`). Nothing is ever drawn and then hidden; a courtesy that is not allowed is
 * simply never produced.
 *
 * It lives in the compartment rather than beside `Measure.timeSignatureHidden` because it is an
 * authored engraving decision about a position, not part of what the music says — the meter, the
 * bars and the playback are identical either way (docs/plans/time-signature-window-plan.md §1).
 */
export interface CautionaryOverride extends EngravingOverride {
  kind: 'cautionary'
}

/**
 * Client #9: the same decision for a CLEF change — this change allows a courtesy clef at the end of
 * the previous system. Payloadless; presence = allowed. Keyed by {@link cautionaryClefKey}, which is
 * (measure, staff) and NOT a beat: a courtesy only ever warns about the clef that OPENS the next
 * system, so a mid-measure change has nothing to warn about.
 *
 * Its own kind rather than sharing the meter's, so the two can never be read for one another and a
 * Properties dump names which is which.
 */
export interface CautionaryClefOverride extends EngravingOverride {
  kind: 'cautionaryClef'
}

/**
 * Client #7 of the engraving-overrides compartment: extra vertical space ABOVE a staff
 * (Sibelius "space above staff" — see docs/plans/staff-spacing-plan.md). Stored in STAFF-SPACES,
 * signed (+ = push the staff and everything below it in its system downward). Absent =
 * default spacing.
 *
 * Unlike the position-keyed rest clients, this is **element-id-keyed** in the usual way —
 * the key is the durable `staffId`, so single-staff is just the N=1 case (its "space above"
 * is the top-margin gap). Phase 1 is global-per-staff (applies on every system); a future
 * per-system refinement anchors to the system's opening measure and falls back to this value.
 */
export interface StaffSpacingOverride extends EngravingOverride {
  kind: 'staffSpacing'
  /** Extra space above the staff, in staff-spaces. Signed; + pushes down. */
  above: number
}

/**
 * Client #8 of the engraving-overrides compartment: a free positional nudge of a dynamic
 * off its note anchor (the ←→↑↓ / Ctrl+arrow keyboard fine-positioning — see
 * docs/plans/dynamic-offset-plan.md). Each component is in **staff-spaces**, anchor-relative —
 * added to the dynamic's auto placement (below/above the staff, under its anchor note) at
 * render. `x` is +right, `y` is +down (screen), matching {@link SlurEndpointOffsetOverride}.
 *
 * **Element-id-keyed** in the usual way — a dynamic has a durable id, so this reads straight
 * through (no position-key or `spanCount` staleness, unlike the rest clients / segment
 * offsets). Returning to (0,0) clears the entry so "absent = default" holds. Does not yet
 * travel across paste (a pasted dynamic mints a fresh id); deferred, like slur `curveShape`.
 */
export interface DynamicOffsetOverride extends EngravingOverride {
  kind: 'dynamicOffset'
  /** Horizontal offset in staff-spaces, relative to the anchor. +right. */
  x: number
  /** Vertical offset in staff-spaces, relative to the anchor. +down (screen). */
  y: number
}

/**
 * Client #13: the same free positional nudge for a **TEMPO MARK** (his ask, 2026-08-19) — the
 * ←→↑↓ / Ctrl+arrow fine-positioning, in **staff-spaces**, anchor-relative, `x` +right and `y`
 * +down (screen). {@link DynamicOffsetOverride}'s twin, element-id-keyed the same way.
 *
 * ⭐ **What it is measured FROM is the ladder's answer, not a constant**: the mark is drawn on the
 * row `rendering/tempoLinePass` gives it (above whatever its own music, a trill or an 8va bracket
 * claimed), and this rides on top of that — so a nudged mark still moves when the music beneath it
 * does. ⛔ Which is why it is stored here and not as a y in the model: it is an adjustment to an
 * engraved position, not a position.
 */
export interface TempoOffsetOverride extends EngravingOverride {
  kind: 'tempoOffset'
  /** Horizontal offset in staff-spaces, relative to the anchor. +right. */
  x: number
  /**
   * Vertical offset in staff-spaces, relative to the row the ladder gave the mark.
   *
   * 🚨 **+UP — OUTWARD, away from the staff — and ⛔ NOT the screen-down `y` of every other offset
   * in this compartment.** His report, 2026-08-19: *"the y is inverted, a high value makes the text
   * down and a less value makes the text up"*.
   *
   * ⭐ The reason it differs is the reason `TrillOffsetOverride.outward` differs: a number a human
   * types about a mark means *how far from the staff*, and for a mark that is always drawn ABOVE
   * the staff that direction is up. A dynamic hangs BELOW, so its screen-down `y` already reads as
   * "further away" and needs no such rule. ⚠️ The two are converted at exactly two places — the
   * render (`rendering/TempoLayout`) and the page limit (`MusicEngine.tempo.nudgeTempoOffset`) — and
   * nothing else may assume a sign.
   */
  y: number
}

/**
 * Client #10 of the engraving-overrides compartment: user-authored horizontal space before a
 * rhythmic column (Sibelius's *note spacing* — see docs/plans/note-spacing-plan.md).
 *
 * ⚠️ **The first override in this compartment that HAS WIDTH.** Every other client is an
 * *offset*: it moves a glyph and nothing else in the score notices — weightless, invisible to
 * the width key, present only in the shape key. This one makes the bar grow, can re-wrap the
 * system, and moves every later column with it. That difference decides everything below.
 *
 * **It is not a property of the note; it is a property of the COLUMN the note sits in.** Hence
 * the key ({@link spacingPositionKey}) carries neither a `voice` nor a `staffId`, unlike
 * {@link RestShiftOverride}'s. Dropping `voice` is what makes one space shared by every voice at
 * that beat instead of two that can disagree; dropping `staffId` makes it a property of the
 * system-wide column, so a grand staff cannot drift apart. Both syncs are consequences of the
 * key, not features implemented on top of it.
 *
 * `space` is in **staff-spaces**, signed (+ = more room before this column), never pixels
 * (principle 3). Zero clears the entry, so "absent = the engraver's own spacing" holds.
 */
export interface LeadingSpaceOverride extends EngravingOverride {
  kind: 'leadingSpace'
  /** Staff-spaces of extra room before this column, signed. + = more room, − = tighter. */
  space: number
}

/**
 * The **space before the BARLINE** — how far the bar's last element stands off the line that ends
 * it (LilyPond calls the rule `space-to-barline`; our default is 1.0 staff space, set by eye in
 * `layout/spacingPadding`). Authored per bar, on top of that default.
 *
 * ⭐ **The same quantity as {@link LeadingSpaceOverride}, at the one address it cannot name.** A
 * leading space is keyed by the *column* it opens a gap before, and the barline is not a column —
 * it is the bar's end. So this is its own key (`{measureId}:barlinespace`) rather than a beat, and
 * it is id-keyed for the reason a bar width is: it names the bar itself, so a rebar carries it
 * forward, where a beat address would move under a meter change.
 *
 * ⚠️ **Not a note offset and not a bar width**, though all three widen the same picture. A bar
 * width multiplies the bar's whole note space and re-spaces the music inside it proportionally; an
 * offset moves one note off its column and leaves the bar alone; this adds a fixed distance at one
 * end and moves nothing at all — the music keeps its spacing and the barline steps away from it.
 *
 * In **staff-spaces**, signed (principle 3, never pixels). Zero clears the entry, so "absent = the
 * engraver's own gap" holds. The negative side is clamped by the caller against the *measured*
 * run-out, because only the last render knows how close the final glyph already is to the line.
 */
export interface BarlineSpaceOverride extends EngravingOverride {
  kind: 'barlineSpace'
  /** Staff-spaces of extra room before the barline, signed. + = further off, − = tighter. */
  space: number
}

/**
 * Client #11 of the engraving-overrides compartment: user-authored **bar stretch** — the bar's
 * music gets `stretch ×` the room the engraver gave it, re-spaced proportionally (see
 * docs/plans/bar-width-plan.md).
 *
 * **The second override that has width**, and the opposite gesture to {@link LeadingSpaceOverride}:
 * a leading space opens a *dead gap* before one column and is subtracted before formatting, so it
 * fights the formatter on purpose. A stretch just hands the formatter a bigger box — VexFlow
 * redistributes the columns by duration on its own, which IS the proportional recalculation.
 *
 * ⚠️ **A multiplier, not a distance, and on the NOTE SPACE only** (not on the bar's clef/meter
 * overhead, which is reflow-dependent — a bar pays for a full clef only while it opens a line, so
 * folding the overhead in would make the same stored `stretch` buy a different number of pixels
 * after a re-wrap). A stored distance would rot: widen a 4-note bar by 120px, add four more notes,
 * and the bar is no longer as roomy as it was left. A multiplier keeps the *intent* through edits.
 *
 * Keyed by {@link barWidthKey} (`{measureId}:barwidth`) — the bar, not a column, and by **id** so a
 * rebar (which keeps measure ids) carries the stretch with no capture/restore at all. `1` clears the
 * entry, so "absent = the engraver's own width" holds. Clamped on the way in, at the write site.
 */
export interface BarWidthOverride extends EngravingOverride {
  kind: 'barWidth'
  /** Multiplier on the bar's own note space. 1 = the engraver's own width. */
  stretch: number
}

/**
 * ⭐ A free horizontal nudge of ONE inline clef off where the engraver put it (his ask, 2026-08-28:
 * *"when the clef is not in the beguining of a line (i mean a header clef) i want to be able to
 * offset it horizontally either by keys in the keyboard or be the property"*). `x` is in
 * **staff-spaces**, +right — added at render via the clef's own `setXShift`
 * (`rendering/clefOffsetPass`), which moves its reported geometry so the hit box and the clef's
 * pixel↔pitch region follow it.
 *
 * ⚠️ **An OFFSET, not a space** — {@link NoteOffsetOverride}'s rule and for its reason: applied
 * post-format / pre-draw, after the column's width is already reserved at the un-shifted position, so
 * nudging a clef never re-spaces the bar or moves anything else's ink.
 *
 * ⛔ **A HEADER clef cannot carry one.** The clef standing at the head of a system belongs to the
 * line, not to a moment in the music, and its x is the header layout's — which is exactly the clef he
 * excluded. Structurally this is free rather than guarded: only a clef drawn as an inline glyph is
 * reachable by the gesture at all.
 *
 * **Keyed by the CLEF CHANGE's own id** ({@link ClefChange.id}), which an upsert preserves — so
 * changing treble→bass at the same spot keeps the nudge, while a clef DRAGGED to another slot drops
 * it (the re-anchor rule every offset client follows). Returning to `x = 0` clears the entry, so
 * "absent = default" holds.
 */
export interface ClefOffsetOverride extends EngravingOverride {
  kind: 'clefOffset'
  /** Horizontal offset in staff-spaces, relative to where the engraver put the clef. +right. */
  x: number
}

/**
 * Client #12 of the engraving-overrides compartment: a free horizontal nudge of a single note off
 * its natural (formatted) column, on top of the automatic spacing (see docs/plans/note-offset-plan.md).
 * `x` is in **staff-spaces**, +right — added to the note's own X at render via
 * `StaveNote.setXShift`, so the note's beam, stem, ties, slurs, dots and hit-testing all recompute
 * around the moved position (an SVG translate would leave the beam and tie anchors behind).
 *
 * ⚠️ **An OFFSET, not a space** — it must NOT change the bar's width. Applied post-format /
 * pre-draw, after the column's width is already reserved at the un-shifted position (unlike
 * {@link LeadingSpaceOverride}, which fights the formatter to open a real gap).
 *
 * **Keyed by SLOT id**, not pitch id. One `StaveNote` is one slot; VexFlow cannot x-shift a single
 * notehead of a chord independently, so a chord (and a rest, which is a slot too) moves as a unit.
 * Element-id-keyed like {@link DynamicOffsetOverride}, but with **weaker durability**: a slot id is
 * re-minted by rebar/paste, so this orphans more readily than a dynamic offset (whose id is durable).
 * Returning to `x = 0` clears the entry, so "absent = default" holds. Horizontal only for now — `y`
 * is a trivial later addition, deferred to keep scope honest.
 */
export interface NoteOffsetOverride extends EngravingOverride {
  kind: 'noteOffset'
  /** Horizontal offset in staff-spaces, relative to the note's natural column. +right. */
  x: number
}

/**
 * The engraving-overrides compartment: a keyed table of authored geometry held
 * as a sub-tree of {@link Score} (so it clones / serializes / undoes with the score
 * value — principle 1). Usually keyed by the *element id* an override hangs off (a note /
 * chord-pitch / slur / dynamic id…), each value an open-ended list of
 * {@link EngravingOverride} (an element may be nudged *and* reshaped).
 *
 * **Not every key is an element id.** {@link RestShiftOverride} (client #5) is
 * position-keyed (`restPositionKey`) because rests have no durable id — a future reader
 * must not assume a key resolves to an element. Safe to mix: position keys contain `:`/`/`
 * so they can never collide with a uuid; nothing enumerates the table assuming id-keys.
 *
 * Absent/empty = no overrides (backward-compatible JSON); every kind degrades to its
 * render-time default when no entry exists. Stored as a plain object — NOT a Map — so
 * it round-trips through `JSON.stringify` (undo snapshots, export) unchanged.
 */
export type EngravingOverrides = Record<string, EngravingOverride[]>
