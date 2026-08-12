import type { Clef, Measure, Score, TimeSignature } from '@/types/music'
import type { Fraction } from '@/utils/fraction'
import { laneFingerprint } from './MeasureWidthCache'

/**
 * **The shape key** (docs/render-performance-plan.md §7a) — "does this measure still *look* the
 * same?", answered without drawing it.
 *
 * ## Shape, deliberately NOT position
 *
 * The key covers everything about how a measure is *engraved* and nothing about *where it sits*.
 * That split is the whole of P5.4b, and it is what §7a's invariant is really saying:
 *
 * > A measure group can be moved by **transform alone** iff its **justified width** (and everything
 * > else it draws) is unchanged. Only then must it be **redrawn**.
 *
 * So `width` is in the key — the line's stretch changes the bar's internal note spacing, which is a
 * genuinely different picture. But `x` and `y` are **out**: a bar that merely slid sideways or
 * downwards draws exactly the same glyphs in the same relative places, and re-engraving it to move
 * it is pure waste. Keeping x/y in the key was measured, and it cost **53% of all render time** in
 * an ordinary session — a staff-spacing drag re-engraved 66% of the score per frame to change
 * nothing but a y-offset.
 *
 * ## It is NOT the width key either, and reusing THAT one is the classic way to get this wrong
 *
 * P2's {@link laneFingerprint} answers a third question — "is this measure's *width* still good?" —
 * and is deliberately **narrow**: only content that takes horizontal space, pointedly excluding
 * dynamics, because a `mf` costs no width. Reuse it here and a dynamic added, or a rest hidden,
 * would change nothing at all: the width did not move, so the memo says *clean*, so the group never
 * redraws. The picture silently rots.
 *
 * ```
 * shapeKey  = widthKey                        // P2's fingerprint — content that takes width
 *           + justifiedWidth                  // the line's stretch — NOT x, NOT y
 *           + linePosition                    // first-in-line clef? cautionary clef/meter?
 *           + engraving overrides anchored here
 *           + dynamics, tempo marks, the meter glyph — drawn, but weightless
 * ```
 *
 * ## It is computed on the casting-off's OUTPUT, not on the model
 *
 * The ordering constraint from §10e, and it is not optional. A measure's drawn shape depends on
 * things no amount of staring at the model can reveal — above all its **justified width**, which is
 * decided by *how many bars share its line*. Type a note into bar 3, and a re-wrap can push a bar
 * onto the last system, flip that system's fill past the ragged-last threshold, and re-justify every
 * bar on it — **with no change to any of their content.** A key hashed from `Measure` alone cannot
 * see that. So `width` below comes from the placement, and the placement comes from the casting-off.
 *
 * `JSON.stringify` rather than a hash: a collision here is a wrong picture that never repairs
 * itself, and the string is thrown away immediately. Correctness over cleverness.
 */
export interface ShapeKeyInputs {
  /** This staff's own lane of the measure (`staffMeasureView`). */
  view: Measure
  staffIndex: number
  /** The **justified** width: what the line's stretch actually gave this bar. From the casting-off,
   *  NOT from the model. Note there is no `x`/`y` here — that is the point. */
  width: number
  isFirstInLine: boolean
  /**
   * ⚠️ **How big this staff is DRAWN** (docs/staff-size-plan.md §7) — the one piece of a bar's
   * picture that lives on `score.staves` instead of in the measure, so nothing else in this key
   * can see it.
   *
   * It is not `x`/`y`: a scaled bar is not a bar that moved, it is a bar whose every glyph, stem
   * and beam is a different size, drawn inside a group carrying the scale. Leave it out and
   * shrinking a staff would reuse its drawn `<g>` verbatim — the transform never applied, the bar
   * looking exactly as it did, for a reason nowhere near the staff.
   */
  scale: number
  clef: Clef
  hasClefChange: boolean
  cautionaryEndClef?: Clef
  cautionaryEndTimeSig?: TimeSignature
  ghostClefBeat?: Fraction
  /**
   * ⚠️ What a **cross-barline beam** does to this bar's picture: which of its slots draw with no
   * flag and no stem, and at which stem direction (`CrossBarBeams.descriptorFor`).
   *
   * The one place a bar's shape is decided by its NEIGHBOUR's content, and it has to be stated —
   * `laneFingerprint` below hashes this bar's own slots and nothing else, so a `continue` typed at
   * the barline next door, or a pitch change that flips the joined group's stem, would leave this
   * key untouched: P5 reuses the drawn group and the flags rot in place.
   *
   * The descriptor, not the neighbour's fingerprint. The beam itself is drawn outside every measure
   * group and rebuilt from scratch each render, so its geometry never needs to be in a key; only
   * what it leaves *inside* this bar's `<g>` does.
   */
  crossBarBeams?: string
}

/**
 * Every id in this lane that a *drawn* measure hands to the outside world: the ids the
 * ElementRegistry hit-tests on and the ids `staveNoteMap`/`tupletObjectMap` are keyed by.
 *
 * The width key erases these (it canonicalizes ids to ordinals, so a renumber is free); the shape
 * key must not. See the comment at the call site.
 */
function laneIds(lane: Measure): string {
  const ids: string[] = []
  for (const slot of lane.slots) {
    ids.push(slot.id)
    if (slot.type === 'chord') for (const pitch of slot.notes) ids.push(pitch.id)
  }
  for (const tuplet of lane.tuplets ?? []) ids.push(tuplet.id)
  return ids.join(',')
}

/**
 * The engraving overrides anchored inside this measure. Keys are `{measureId}:v{voice}:b{n}/{d}`
 * (see `restPositionKey`), so a measure owns exactly the keys carrying its own id — a rest shifted
 * up, a rest hidden, and whatever §10c adds next (a note offset, a manual break).
 *
 * Sorted, because object key order is an implementation detail and must not decide whether a measure
 * redraws.
 */
function overridesFor(score: Score, measureId: string): string {
  const all = score.engravingOverrides
  if (!all) return ''
  const prefix = `${measureId}:`
  const mine = Object.keys(all)
    .filter(key => key.startsWith(prefix))
    .sort()
    .map(key => `${key}=${JSON.stringify(all[key])}`)
  return mine.join('|')
}

export function measureShapeKey(
  score: Score,
  input: ShapeKeyInputs,
  suppressedDynamicId: string | null,
  suppressedTempoId: string | null,
): string {
  const { view, clef } = input

  // A dynamic or tempo mark whose text is being edited is SUPPRESSED — the engraved glyph is not
  // drawn, so the DOM input isn't sitting on top of it. That is a difference in the picture, so it
  // has to be in the key; but only for the measure that actually holds the mark, or opening one text
  // editor would redraw the entire score.
  const suppressed = [
    view.dynamics?.some(d => d.id === suppressedDynamicId) ? suppressedDynamicId : null,
    view.tempos?.some(t => t.id === suppressedTempoId) ? suppressedTempoId : null,
  ]

  return JSON.stringify([
    // ── content that takes width (P2's key, reused wholesale — never re-derived) ──
    laneFingerprint(view),

    // ⚠️ THE GOVERNING CLEF, and it must be here even though it is NOT in the width key.
    //
    // Those two facts look contradictory and are not. A clef does not change how *wide* a bar is —
    // it moves every notehead the same distance vertically, and spacing is driven by durations and
    // glyphs (proven in clefWidthIndependence.test.ts, which is why it left the width key). But it
    // absolutely changes how a bar *looks*: the noteheads sit on different lines. WIDTH and PICTURE
    // are different questions, and this key asks the second one.
    //
    // Take this away and the bug is silent and horrible: an alto clef at bar 40 would leave every
    // later bar's key unchanged, so P5 would reuse their drawn groups — the new clef on the stave,
    // the old noteheads underneath it, at the wrong pitches, forever.
    clef,

    // ⚠️ THE RAW IDS, and they too must be here even though the width key deliberately erases them.
    //
    // The width key canonicalizes ids to ordinals, so a rebar that renumbers a bar while leaving its
    // music untouched keeps its cached width — that is the whole point, and it is sound, because
    // width does not know what a note is called.
    //
    // A DRAWN measure does. Reusing a measure reuses its `<g>` *and replays its ElementRegistry
    // entries and staveNoteMap* (VexFlowRenderer.replaySnapshot), both keyed by note id. Let a
    // renumbered-but-identical bar reuse its group and every hit-test in it resolves to ids the model
    // no longer contains: the notes are visibly right there and unclickable.
    //
    // Cheap, too — ids only, not the slots again. The bars that pay for it are exactly the bars a
    // renumber touched, which had to be re-engraved regardless.
    laneIds(view),

    // ── drawn, but weightless: invisible to the width key, and that is exactly why they are here ──
    view.dynamics ?? null,
    // ⚠️ A dynamic's hand-nudged OFFSET (client #8) is **id-keyed** (by the dynamic's uuid), so
    // `overridesFor` below — which only matches the position-keyed `{measureId}:…` rest overrides —
    // never sees it, and the dynamics array itself is unchanged by a nudge. Leave this out and a
    // nudge changes nothing in the key: the bar never redraws, so `applyDynamicOffsets`' transform
    // never re-runs and the mark sits still while the model moves. WIDTH≠PICTURE, silently. See
    // docs/dynamic-offset-plan.md.
    view.dynamics?.map(d => score.engravingOverrides?.[d.id] ?? null) ?? null,
    // ⚠️ A note's hand-nudged horizontal OFFSET (client #12) is **slot-id-keyed** (by the slot's
    // uuid), the same trap as the dynamic offset above: `overridesFor` matches only the
    // position-keyed `{measureId}:…` overrides, never a bare slot id, and the slots themselves are
    // unchanged by a nudge. Leave this out and a nudge changes nothing in the key — the bar never
    // redraws, so `applyNoteOffsets`' setXShift never re-runs and the note sits still while the
    // model moves. WIDTH≠PICTURE, silently. See docs/note-offset-plan.md.
    view.slots.map(s => score.engravingOverrides?.[s.id] ?? null),
    // ⚠️ …and a FANNED MEMBER's offset is keyed by the member's own first pitch id
    // (`ScoreModel.offsetTargetOf`), which is in neither of the two lines above: not a slot id, not a
    // position key. Leave it out and nudging a member changes nothing in the key, so the bar keeps
    // its drawn group and the head never moves — the same silent WIDTH≠PICTURE trap, one level in.
    view.slots.map(s => (s.type === 'chord' && s.fan?.members
      ? s.fan.members.map(m => (m.pitches[0] ? score.engravingOverrides?.[m.pitches[0].id] ?? null : null))
      : null)),
    view.tempos ?? null,
    // A hairpin is drawn and weightless, exactly like a dynamic — and this covers only the bar the
    // wedge STARTS in, which is all a per-measure key can cover. The bar holding the far end is
    // pulled in by `VexFlowRenderer.spanAnchors` instead: a span's other end is not a fact about
    // this bar's content, so no key here can ask about it (see measureRenderRoles' header).
    view.hairpins ?? null,
    view.timeSignatureChange ?? false,
    view.timeSignatureHidden ?? false,

    // ── the casting-off's output. The line's stretch, NOT the bar's position: a bar that only
    //    moved is translated, not re-engraved (P5.4b). ──
    input.width,
    input.isFirstInLine,
    // The staff's drawn size — see ShapeKeyInputs.scale. A different size is a different picture.
    input.scale,
    input.hasClefChange,
    input.cautionaryEndClef ?? null,
    input.cautionaryEndTimeSig ?? null,
    input.ghostClefBeat ?? null,
    input.staffIndex,

    // ── what a beam through the barline leaves inside this bar ──
    input.crossBarBeams ?? '',

    // ── authored engraving adjustments anchored in this bar ──
    overridesFor(score, view.id),

    // ── being text-edited right now ──
    suppressed,
  ])
}
