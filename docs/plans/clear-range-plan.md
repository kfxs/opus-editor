# Clearing a range — what silence a deleted passage leaves behind

**Status: BUILT (2026-08-31).** Module: `engine/models/clearOps.ts`. Command:
`MusicEngine.deleteNotes`. Caller: `shortcutWiring`'s `deleteSelected`.

## 1. The rule

> **The region you selected is emptied, and the METER decides the rests that fill it.**

His report, on bar 1 of the Prelude (4/4, two staves), clearing everything from beat 3:

| | was | should be |
|---|---|---|
| treble, v0 | `8 + 16×6` | `h` |
| bass, v0 | `16 + 8. + q` | `h` |
| bass, v1 | `h` | `h` |

*"The space deleted should be filled with the corresponding rest in a musical sense, taking into
account the meter and the beat."*

**A single note is a range of one** — his call, and there is no size branch anywhere. The rest that
replaces one deleted note is the one the meter puts in the hole it left, which is the same answer
its own length gave in every ordinary case and a better one where the two disagree.

**Only the region.** Rests already standing *outside* the selection are slots, so they bound the
hole and are never swallowed into it. Clearing a quarter beside an untouched quarter rest gives two
quarter rests, not a half. This is a clear, not a regroup of the bar.

## 2. Why it was wrong

Nothing about the rule was missing. `utils/restFill.fillRests` has always implemented it — Gould's
show-each-beat rule, *a rest may span `[p,q)` only when no metric boundary strictly inside it is
stronger than the weaker of its endpoints* — driven per staff and per voice by
`ScoreModel.fillGapsWithRests`. It answers `[2,4) → h` and, correctly, `[1,3) → q q`: a half rest
may not straddle the middle of a 4/4 bar.

Two things kept it from ever being asked:

1. **`MusicEngine.deleteNote` replaced each slot with a rest of that slot's own length**, so no hole
   was ever left. `ScoreModel.convertToRest`'s own doc had stated the intended division all along —
   *"Deleting instead leaves a gap for `repairAllMeasureGaps` to re-fill meter-aware, which is right
   for a HOLE"* — the delete path simply did not do it.
2. **Delete was a LOOP** over the selection, so even a per-note hole would have been filled per
   note. The freed span is never seen whole unless the fill runs **once, after every removal**.

That is the whole of the module: remove first, then fill each touched bar once.

## 3. What is NOT a hole

Three kinds of id keep the single-note behaviour exactly, routed back through
`MusicEngine.deleteNote`:

- a **tuplet** member — `fillRests` is tuplet-unaware by design and `fillGapsWithRests` skips gaps
  that start inside a tuplet's span; the group refills its own remainder;
- a **fanned** member — removing one changes the GROUP's size, not the bar's time;
- one head of a **chord** whose other heads are not selected — the slot survives, so no time is
  freed.

## 4. The hand-positioning goes with the content

His second report the same day: the fill landed the right half rest in the right lane, drawn six
steps high. That score lifts every bass-staff voice-0 rest by hand, and a `restShift` is filed under
a **position** (`{measureId}:s{staffId}:v0:b2/1`) because rest ids churn on every edit. The clear
refilled that position and the fresh rest inherited a nudge authored for a 16th rest that had had a
half note above it — *"we are clearing, that means the override should be cleared too"*.

`overrideOps.clearClearedSpanOverrides` drops them **before** the refill. It is the span-scoped
sibling of `clearRemovedContentOverrides` (which `clearMeasureStaff` has used since 2026-08-30 for
the identical failure one scale up), and the difference is §1's rule again: only positions **inside
the cleared span**, so a nudge the clear never reached is left standing. Id-keyed entries (a note
offset) of the removed slots go too — their anchors can never be reached again.

`engravingOverrides.parseRestPositionKey` is the inverse of `restPositionKey`, written beside it for
the reason `parseSpacingPositionKey` gives: an operation that must ask *which* positions an edit
reached cannot build the address it already knows. It declines column keys, cautionary keys and
id-keyed clients, so the compartment's other tenants are untouched.

See `docs/plans/rest-shift-plan.md` §4 for how this sits beside the accepted resurrect-on-return rule
(it does not retire it — nothing is *cleared* in a plain `rest → note → rest`).

## 5. Anchors

A slur or tie that pointed at a cleared head follows it onto whichever rest of the fill now covers
that beat, and is dropped when the fill put nothing there — the let-ring rule `deleteNote` already
followed, at range scale. Arcs *arriving* are scan-based, so a chord tied into a cleared slot keeps
every arc.

## 6. Files

| File | What |
|---|---|
| `engine/models/clearOps.ts` | The operation. Free functions over a `Score` + a `ClearRangeDeps` bundle (the `voiceOps` idiom). |
| `engine/models/clearOps.test.ts` | The rule, its exceptions, and the override reset. |
| `engine/models/overrideOps.ts` | `clearClearedSpanOverrides` + `ClearedSpan`. |
| `engine/models/engravingOverrides.ts` | `parseRestPositionKey`. |
| `engine/MusicEngine.ts` | `deleteNotes(ids)` — the command; `deleteNote` stays the per-slot primitive. |
| `interactions/shortcutWiring.ts` | `deleteSelected` calls it once instead of looping. |

## 7. Open

- **A whole-bar clear and a range clear that happens to cover a whole bar disagree.**
  `clearMeasureStaff` refills with one **measure rest**; a range covering `[0, barEnd)` gets
  `fillRests`, which returns a measure rest for exactly that span — so they agree today. Worth a
  test if either filler changes.
- **`MusicEngine.deleteNote` now has exactly one caller: this module's `deleteOne`** (plus its own
  specs). It is kept as the per-slot primitive because the three exceptions in §3 need it and
  because folding it into the clear would make that call recursive — but it is no longer reachable
  from the UI, so its replacement-rest behaviour is now an internal detail rather than a rule the
  user can see. Worth revisiting if a second caller ever appears.
