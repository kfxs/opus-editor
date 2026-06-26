# Multi-voice rebar plan — a time-signature change must not erase voice 2

## The bug (confirmed by reading the code)

Changing a time signature (or removing a TS change) erases every secondary
voice. A two-voice bar comes back single-voice after `setTimeSignature`.

Root cause: the rebar **pure core** (`src/utils/rebar.ts`) is already
voice-parameterised, but the **orchestration** in `ScoreModel` is hard-wired to
voice 0 while the materialise step destroys *all* voices.

Two facts collide:

1. **Flatten reads voice 0 only.** `ScoreModel.rebarRegion()` (and
   `pasteEvents()`) call `flattenRegion(regionMeasures, 0)`
   (`ScoreModel.ts:702`, `:796`). `flattenRegion` filters
   `slots.filter(s => (s.voice ?? 0) === voice)` (`rebar.ts:156`), so voice 1/2/3
   notes are never captured into the event stream.

2. **Materialise wipes every voice.** `materializeBar()` opens with
   `measure.slots = []` and `measure.tuplets = []` (`ScoreModel.ts:1147–1148`),
   then re-pushes only the voice-0 plan. New chords are minted with no `voice`
   field (= voice 0) at `:1165–1183`, and rests via `pushRestSlot(measure, …, 0)`
   (`:1162`).

Net sequence for a 2-voice measure: capture voice 0 → `slots = []` (**voice 2
gone here**) → rebuild from the voice-0-only plan. Voice 2 is silently dropped.

The same defect lives in `pasteEvents()` (also flattens voice 0, also calls the
destructive `materializeBar`).

## What is already in our favour

- `rebar.ts` needs **one small change** (the original plan said "no change" —
  that was wrong). `flattenRegion(measures, voice)` takes the voice and filters
  *slots* by it, and `relayEvents` is voice-agnostic — so we drive it once per
  voice and keep the plans separate (no `voice` on `RebarPiece`). BUT
  `flattenRegion`'s tuplet loop iterated `m.tuplets` unfiltered, emitting an
  atomic event for **every** tuplet regardless of voice — so a voice-0 triplet
  leaked a phantom atomic into voice 1's stream (and vice versa), corrupting the
  re-lay (phantom leading rests). Fixed by deriving each tuplet's voice from its
  member slots (`m.slots.find(s => s.tupletId === def.id)?.voice ?? 0`) and
  `continue`-ing when it isn't the voice being flattened — same rule
  `fillGapsWithRests` already uses. Latent before P1 (we only ever flattened
  voice 0, and the materialise wipe dropped voice 1 anyway).
- `fillGapsWithRests(measure)` (`:1487`) is **fully voice-aware**: it discovers
  the voices present, rest-fills each independently, always includes voice 0 so
  an empty bar still fills. We reuse it as the safety net for grown bars.
- `collapseEmptyVoices(measure)` (`:1933`) already drops a secondary voice that
  is rests-only in a bar, reverting it to a single stream. We reuse it to get
  the "voice 2 only exists where it has notes" behaviour for free.
- `pushRestSlot(measure, rest, voice)` already takes a voice.
- `materializeAtomicPiece` rebuilds a tuplet via `structuredClone(src)`
  (`:1198`), which preserves the source slot's `voice`. Tuplet voice survives as
  long as the slots fed in were the correct voice's slots (they are — flatten
  filters by voice at `rebar.ts:156` and stashes them in `payload.slots` at
  `:172`). **This means `materializeAtomicPiece` needs NO voice argument** — the
  clone already carries the right voice. (See the correction in §Design step 5.)
- `relayEvents` pads **every** voice's plan up to `targetBars` with measure-rest
  bars (`rebar.ts:348–352`). So each voice always relays to ≥ the original region
  length, and a secondary voice that re-lays to all-rests in a bar is the *normal*
  case, not an edge. Step 7 (`collapseEmptyVoices`) is therefore load-bearing on
  essentially every multi-voice rebar, not an occasional cleanup.

## Design — per-voice orchestration, destructive step made additive

Confine all changes to `ScoreModel`. Keep the pure core untouched.

> **Ordering is the trap.** `flattenRegion` reads `m.timeSignature` per measure
> (`rebar.ts:154`) to compute offsets, so **every** voice must be flattened
> against the OLD meter — *before* the overwrite at `:711–714`. `relayEvents`
> takes the new meter as an explicit `getMeterInfo(ts)` arg and never reads
> `m.timeSignature`, so it can run after. If you write
> `for (v) { flatten(v); relay(v) }` while leaving the meter overwrite where it
> sits today (ahead of the loop), voice 1 flattens against the NEW meter → wrong
> offsets → the exact corruption this plan fixes, just relocated. So the overwrite
> must move to **after all per-voice flattens**. The fixed sequence:
>
> ```
> capture ties / slurs / beat-anchors    (OLD capacities)
> discover voices
> flatten EACH voice                     (OLD meter — before overwrite)
> overwrite m.timeSignature = ts; delete actualDurationOverride
> relay EACH voice                       (NEW meter) → Map<voice, plan>
> maxBars = max(plan_v.length); grow region in place
> clearMeasureForRebar each region measure
> materialize EACH voice additively + per-voice linkRebarTies
> fillGapsWithRests each measure          (voice-0 safety)
> collapseEmptyVoices each measure
> restore ties / slurs / beat-anchors
> ```

New `rebarRegion` recipe:

1. **Discover voices** present in the region (scan slots for distinct
   `voice ?? 0`). Always include voice 0.
2. **Per-voice flatten (OLD meter), then overwrite, then per-voice relay (NEW
   meter).** Flatten all voices first —
   `events_v = flattenRegion(regionMeasures, v)` — *before* the meter overwrite.
   Then overwrite `m.timeSignature` on every region measure (and clear
   `actualDurationOverride`), exactly as today's `:711–714`. Then relay each
   voice: `plan_v = relayEvents(events_v, meter, { targetBars: original, bounded:false })`,
   collecting into `Map<voice, BarPlan[]>`. Captures (ties/slurs/beat-anchors)
   still run before the overwrite, as today. Do **not** fold the overwrite into
   the per-voice loop (see the trap above).
3. **Region growth = max across voices.** `maxBars = max(plan_v.length)`. Grow
   the region in place to `maxBars` via `insertMeasureAfter` (today's single-plan
   growth, but driven by the longest voice).
4. **Clear each region measure once** — `slots = []`, `tuplets = []`,
   `delete clefs`, `delete dynamics` — extracted into a tiny
   `clearMeasureForRebar(measure)` helper, called once per region measure
   *before* any voice is materialised.
5. **Materialise per voice, additively.** Split `materializeBar` into:
   - `clearMeasureForRebar(measure)` (step 4), and
   - `materializeVoiceBar(measure, plan, voice, created)` — the current body
     **minus** the wipe, tagging each created chord/rest with `voice`. Gate the
     chord tag so voice 0 stays stored as `undefined`:
     `if (voice) chord.voice = voice as 0 | 1 | 2 | 3` (matches `pushRestSlot`'s
     convention at `:219` and the "voice 0 = undefined" data-model invariant — a
     blanket `chord.voice = 0` would diverge from every other slot). Rests:
     `pushRestSlot(…, voice)`. Tuplets: **leave `materializeAtomicPiece`
     unchanged** — `structuredClone(src)` already preserves the source slot's
     voice (see §"What is already in our favour"), so no voice argument is needed
     or wanted.
   Loop: for each voice, for each bar index, call `materializeVoiceBar` with a
   **per-voice `created` array**, then `linkRebarTies(created_v)`. The per-voice
   array is essential — `linkRebarTies` walks a single `pending` chain and would
   otherwise tie a voice-0 note tied-forward into a voice-1 same-pitch onset at
   the next entry.
6. **Voice-0 safety fill for grown bars.** If voice 0's plan is shorter than
   `maxBars` (another voice overflowed further), the extra grown bars have no
   voice-0 slot. Call `fillGapsWithRests(measure)` on each region measure — it
   adds the missing voice-0 measure rest and is a no-op where a voice is already
   complete.
7. **Collapse rests-only secondary voices.** Call
   `collapseEmptyVoices(measureNumber)` on each region measure so a secondary
   voice that re-lays to all-rests in a given bar disappears (single-voice
   render preserved; matches today's per-bar emptiness). Because `relayEvents`
   pads each voice to `targetBars`, this fires on essentially every multi-voice
   rebar. **Side effect to confirm (scope decision #1):** a *genuine* internal
   full-bar rest in a secondary voice — a V2 rest measure sitting between two V2
   note-bars — also disappears (that bar reverts to single-voice). Note
   `collapseEmptyVoices` keys on `type === 'chord'`, so a secondary voice whose
   only content is a rest-tuplet collapses too.
8. **Restore side channels** (ties / slurs / beat anchors) — see hardening
   below.

This reuses the existing voice-aware fill + collapse, so the "voice 2 exists in
some bars but not others" case falls out naturally without special-casing empty
bars.

## Side-channel hardening (voice scoping)

The restore lookups match by `(offset, pitch)` and are voice-blind. With two
voices a unison at the same beat in different voices makes the lookup ambiguous
and can re-attach a span to the wrong voice. Scope each by voice:

- **Boundary ties** (`captureBoundaryTies` / `restoreBoundaryTies` /
  `boundaryPitchId`, `:928–989`): ties never cross voices. Record the in-region
  partner's voice at capture (the external note's voice), and have
  `boundaryPitchId` search only that voice's chords. Edge case (unison across
  voices at the boundary); low frequency but cheap to make correct.
- **Slurs** (`captureSlurs` / `restoreSlurs`, `:1034–1119`): a `Slur` already
  carries `voice`. Record each endpoint's chord voice at capture and include
  voice in `slurAnchorKey` (build the new-region lookup keyed by
  `(offset, pitch, voice)`), resolving with the captured voice. Keeps a voice-2
  slur off a voice-0 note at the same offset.
- **Beat anchors** (`captureBeatAnchors` / `restoreBeatAnchors`, `:857–920`):
  **no change needed.** Clefs are global; dynamics carry their own `voice` and
  are re-pushed verbatim (`{ ...a.dyn }`), and the measure each offset maps to is
  voice-independent (bar capacity is the same for all voices). Capture once, not
  per voice.

## Paste path (`pasteEvents`, `:775`)

`pasteEvents` shares `materializeBar`, so it shares the wipe — and that makes the
"minimum" tempting framing **wrong**. `clearMeasureForRebar` wipes *all* voices,
but paste only re-materialises voice 0, so pasting into a two-voice bar **deletes
voice 2**. This is a pre-existing latent bug (paste predates multi-voice), but
"preserve today's behaviour exactly" is misleading: today's behaviour erases the
secondary voice. The rebar path is safe only because it re-materialises *every*
voice; paste does not.

The clip itself is still single-voice (the clipboard payload carries no voice —
multi-voice *paste content* stays out of scope). But the **non-target voices
already in the region must survive a paste**, and that is nearly free with the
per-voice machinery: the paste/overwrite happens in voice 0, while every other
voice in the region is re-laid verbatim (passthrough — same meter, no window
overwrite):

```
plans = new Map<voice, BarPlan[]>()
plans.set(0, relayEvents(merged, meter, { targetBars, bounded }))       // v0: paste window
for (v of otherVoicesInRegion)
  plans.set(v, relayEvents(flattenRegion(region, v), meter, { targetBars, bounded }))
```

Paste never changes the meter, so barlines don't move and growth only *appends*
bars — the passthrough voices are unaffected by the appended tail. Then run the
**same** clear → per-voice materialise → `fillGapsWithRests` → `collapseEmptyVoices`
loop as rebar.

**Refactor to enforce this once:** extract steps 4–7 (clear region → per-voice
materialise + per-voice `linkRebarTies` → fill → collapse) into a single private
`materializeRegion(regionNumbers, Map<voice, plan>)`, and have **both**
`rebarRegion` and `pasteEvents` call it. The voice-erase bug lived in two places
precisely because the materialise logic was duplicated across the two callers;
one shared helper closes both at once.

- **Future:** multi-voice paste *content* — flatten/relay the clip per voice.
  Still out of scope (the clipboard payload would need to carry voice, which it
  does not today); note it in the multi-voice plan doc.

## Scope decisions to confirm with the user

1. **Empty secondary voice in extra bars** — recommended: rely on
   `collapseEmptyVoices` so a secondary voice shows only where it has notes (no
   invented voice-2 measure-rests in bars it never occupied). This is the
   Sibelius-ish behaviour and reuses existing code. (Alternative — keep voice 2
   as explicit measure-rests across the whole region — is more code and probably
   not wanted.)
2. **Paste clip content stays single-voice** for now (recommended) — but the
   non-target voices already in the paste region **must survive** (passthrough
   re-lay, see Paste path §). Confirm we are not erasing voice 2 on paste; only
   multi-voice *clip content* is deferred.

## Phases

- **P1 — Make materialise additive (the core fix).** Split `materializeBar` into
  `clearMeasureForRebar` + `materializeVoiceBar(voice)`; thread `voice` into the
  minted chord (gated, `if (voice)`) and `pushRestSlot`. Leave
  `materializeAtomicPiece` unchanged (clone already preserves voice). Extract the
  shared `materializeRegion(regionNumbers, Map<voice, plan>)` helper (clear →
  per-voice materialise + per-voice `linkRebarTies` → fill → collapse). Rewrite
  `rebarRegion` to the per-voice recipe with the corrected flatten→overwrite→relay
  ordering (steps 1–7), calling `materializeRegion`. Route `pasteEvents` through
  the **same** helper, building its `Map` with voice 0 = the paste/overwrite plan
  and every other region voice = a passthrough re-lay. This stops voice 2 being
  erased on *both* a TS change and a paste.
- **P2 — Voice-scope ties + slurs** (hardening §). Boundary-tie voice filter +
  slur anchor key voice. Beat anchors unchanged.
- **P3 — Tests.** See below. Run `npm run test`, `npm run build:check`,
  `npm run lint:boundary`.

P1 + P3 deliver the user-visible fix; P2 closes the unison edge case.

## Tests to add

Current rebar tests (`ScoreModel.test.ts` ~`:1016+`, `rebar.test.ts`) are
**all single-voice** — that is exactly why this regressed silently. Add:

- Two voices in 4/4 (V1 quarters, V2 half notes) → `setTimeSignature(1, 3/4)`:
  **both** voices survive, each re-barred and tied across the moved barline;
  voice tags intact.
- `removeTimeSignatureChange` with a 2-voice region → both voices survive.
- Voice 1 overflows further than voice 0 → region grows to the longer voice;
  voice 0 gets measure-rests in the grown bars (step 6).
- A bar where voice 2 re-lays to all-rests → voice 2 collapses there (step 7),
  other bars keep voice 2.
- Voice 2 tuplet through a rebar stays atomic **and** voice-2 tagged.
- A voice-2 slur and a voice-2 cross-barline tie survive with correct voice
  (P2 regression guard; include a unison-across-voices case at the boundary).
- **Paste into a two-voice region** (`pasteEvents`): paste a clip into voice 0 of
  a bar that also has voice 2 → voice 2 survives untouched (regression guard for
  the paste-erase hole). Include a paste that overflows and grows the region →
  voice 2 still intact in the original bars.

## Files touched

- `src/engine/models/ScoreModel.ts` — `rebarRegion`, `pasteEvents`,
  `materializeBar`→split (`clearMeasureForRebar` + `materializeVoiceBar`), new
  shared `materializeRegion` helper, `captureBoundaryTies`/`restoreBoundaryTies`/
  `boundaryPitchId`, `captureSlurs`/`restoreSlurs`/`slurAnchorKey`.
  (`materializeAtomicPiece` — **unchanged**.)
- `src/engine/models/ScoreModel.test.ts` — new multi-voice rebar suite.
- `src/utils/rebar.ts` — **none.**
