import type { Measure } from '@/types/music'

/**
 * **Read this before you add anything that gets engraved.**
 *
 * Two caches decide whether the renderer does any work for a measure, and they ask *different*
 * questions:
 *
 *  - **The width key** ({@link laneFingerprint}) — "how much horizontal space do this bar's notes
 *    need?" Feeds the VexFlow `Formatter` memo.
 *  - **The shape key** ({@link measureShapeKey}) — "does this bar's picture need re-engraving?"
 *    Decides whether P5 reuses the already-drawn `<g>` or throws it away and draws again.
 *
 * The shape key *embeds* the width key, so anything that takes width is automatically part of the
 * picture. The reverse is not true: a dynamic, a tempo mark, a hairpin are **drawn but weightless**.
 *
 * ## ⚠️ Every wrong answer here is SILENT
 *
 * Forget your new element in the shape key and it **never redraws**: you edit it, the screen does
 * not change, and you go hunting in the renderer for a bug that is not there. Forget it in the width
 * key and bars render at a stale width. Nothing throws. No test goes red. The score is just quietly
 * wrong.
 *
 * Putting something in a key where it does *not* belong is merely **slow** — that is how the
 * governing clef cost 47% of all layout time (see MeasureWidthCache) and nothing was ever
 * mis-drawn. So the rule when you are unsure:
 *
 * > **Include it. Correct-and-slow is recoverable; a stale picture is not.**
 *
 * ## The third question this map does NOT cover
 *
 * **Does your element SPAN bars?** (a slur, a tie, an 8va bracket, a hairpin, a trill extension.)
 * Then it also needs to be a **span anchor** in `VexFlowRenderer.spanAnchors` — otherwise culling
 * deletes the bar its endpoint lives in and your element draws detached, or vanishes when the user
 * scrolls. Spans live on `Score`, not on `Measure`, so the compiler cannot catch that one for you.
 */
export type MeasureRenderRole =
  /** Takes horizontal space. Must be in `laneFingerprint` (and is therefore in the shape key too). */
  | 'width'
  /** Drawn, but weightless. Must be in `measureShapeKey` ONLY — never in the width key. */
  | 'shape'
  /** In neither key: it decides *which drawn group* the bar owns (`measureGroupKey`). */
  | 'identity'
  /** Affects nothing that is drawn. */
  | 'ignored'

/**
 * Every field of {@link Measure}, and which render cache it belongs to.
 *
 * **This is enforced by the compiler.** `Record<keyof Measure, …>` means that adding a field to
 * `Measure` — `hairpins`, `trills`, `hidden`, whatever comes next — makes this file stop compiling
 * until you classify it. You cannot skip the question by forgetting it exists.
 *
 * **And it is enforced by a test.** `measureRenderRoles.test.ts` perturbs each field in turn and
 * asserts the keys actually respond the way you claimed here — so a *wrong* answer fails too, not
 * just a missing one.
 *
 * (Fields *inside* a slot — a new `NotePitch.foo` — need no entry: `laneFingerprint` serializes the
 * whole slot, so they are picked up by construction. That is the entire reason it was built as a
 * content fingerprint rather than a list of fields.)
 */
export const MEASURE_RENDER_ROLE: Record<keyof Measure, MeasureRenderRole> = {
  /** Anchors this bar's engraving overrides (`{measureId}:v{voice}:b{n}/{d}`), which are drawn. */
  id: 'shape',

  /** Not in either key: `(number, staffIndex)` is the group key — it says which `<g>` is this bar's. */
  number: 'identity',

  /** The notes. The formatter's entire input. */
  slots: 'width',

  /** Feeds the `Voice` and its mode, so it changes how the notes are spaced. */
  timeSignature: 'width',

  /** Draws a meter glyph — which takes width, but as *overhead*, computed outside the note-space
   *  cache (`calculateMeasureWidths`). For the keys it is a picture change only. */
  timeSignatureChange: 'shape',

  /** Suppresses that glyph. Same story. */
  timeSignatureHidden: 'shape',

  /** A pickup bar's real capacity → the `Voice`'s mode → the spacing. */
  actualDurationOverride: 'width',

  /** A mid-measure clef re-pitches the notes after it *within this bar*, and inline clefs are drawn.
   *  NOTE this is the bar's *own* clef changes. The **governing** (inherited) clef is deliberately
   *  NOT in the width key — see the long comment in MeasureWidthCache. */
  clefs: 'width',

  /** Drawn, weightless. The canonical "shape only" element — copy this row for a hairpin. */
  dynamics: 'shape',

  /** Drawn, weightless (and system-level, not per-staff). */
  tempos: 'shape',

  /** Drawn, weightless — the `dynamics` row above, as its comment invites. A wedge takes no
   *  horizontal space (this file's own example of one that does not), so it must never reach the
   *  width key; but it IS a picture change, so the bar it starts in re-engraves when it changes.
   *
   *  ⚠️ 'shape' is the *sufficient* answer, not the whole one: a hairpin SPANS bars, and the bar
   *  holding the far end is not named by any key here. Both endpoint bars must also be
   *  `VexFlowRenderer.spanAnchors` — the third question this file's header describes and the one
   *  the compiler cannot ask. */
  hairpins: 'shape',

  /**
   * ⭐ **The one row that answers "neither", and it needs its reasons out loud** — this file's
   * standing advice when unsure is *include it*, so declining both keys is a claim, not a shrug
   * (docs/ottava-plan.md §8 P3, which was written to satisfy exactly this file).
   *
   * NOT in the width key: an ottava changes what a note SOUNDS, never where its head sits — we
   * store WRITTEN pitch ({@link Ottava}) — so no bar gets wider or narrower for having one.
   *
   * NOT in the shape key: the bracket is drawn by a score-level pass OUTSIDE every measure group,
   * as the hairpin's, slur's and trill's ink is, and that pass is rebuilt from scratch on each
   * render. No measure's cached `<g>` can hold a stale octave line, because none of them ever
   * holds one at all. (Contrast the `hairpins` row above, which is 'shape' anyway: a wedge's
   * *dynamics-line* neighbours are drawn inside the group.)
   *
   * ⚠️ **Both halves are conditional, and this is where the condition is checked.** If any part of
   * the bracket is ever drawn inside a measure group, this becomes 'shape'; if an ottava is ever
   * allowed to move a notehead, it becomes 'width'. And 'ignored' does NOT excuse it from the third
   * question in this file's header — an octave line spans bars, so both endpoint bars must be
   * `VexFlowRenderer.spanAnchors` or culling will drop the ink.
   */
  ottavas: 'ignored',

  /**
   * ⭐ The SECOND row that answers "neither", on the ottava's reasoning above and for its two halves
   * (docs/pedal-plan.md §5.4, written to satisfy exactly this file).
   *
   * NOT in the width key: a pedal is drawn BELOW the staff and costs no horizontal room — the same
   * "drawn but weightless" this file's header opens with.
   *
   * NOT in the shape key: `Ped.` and `✻` are drawn by a score-level pass outside every measure
   * group (`PedalRenderer`, as the hairpin's, slur's, trill's and ottava's ink is), rebuilt from
   * scratch on each render. No measure's cached `<g>` can hold a stale pedal, because none of them
   * ever holds one. ⚠️ Contrast `dynamics` above, which IS 'shape' — a letter is drawn inside the
   * group, and copying that row here (the first draft of the pedal plan did) would be merely slow
   * rather than wrong.
   *
   * ⚠️ And 'ignored' does NOT excuse it from the third question in this file's header — a pedal
   * spans bars, so both endpoint bars must be `VexFlowRenderer.spanAnchors` or culling will drop the
   * ink. The end bar matters more here than for an ottava: the `✻`'s x is read from that bar.
   */
  pedals: 'ignored',

  /** Rewrites tick values *before* the formatter runs, and draws a bracket/number. */
  tuplets: 'width',
}
