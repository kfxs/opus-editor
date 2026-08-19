# Copy/Paste — Staff-Aware & Full-Fidelity Plan

Status: **PLANNED 2026-07-07.** Turns copy/paste from a single-staff, notes-only
feature into a staff-relative, full-fidelity one (ties/articulations already travel;
this adds the staff axis, dynamics, and slurs).

**Sibling:** `docs/element-copy-paste-plan.md` — Ctrl+C/Ctrl+V of ONE selected element (an
expression). Same controller, same keys, a separate clip: it holds the music **or** one element,
never both.

## Goal (from the user)

1. Material copied on **any** staff can be pasted onto **any** staff, carrying its
   ties, articulations, **dynamics**, and **slurs** — not just bare notes.
2. A selection spanning **staves 1+2** can be pasted onto **staves 3+4** — the clip
   keeps the *relative* staff offsets of what was copied.

## What travels today (baseline)

The engine already has a position-independent event model (`RebarEvent`) and a
multi-voice payload, so the foundation is solid. Current coverage:

| Travels ✅ | Dropped ❌ |
|---|---|
| Notes / chords / rests | **Dynamics** (never captured) |
| Articulations + placement | **Slurs** (never captured) |
| Stem direction | **Clef changes** in window |
| Tuplets (atomic payload) | **Staff axis** — a clip is one staff |
| Ties within the clip (collapse + re-tie) | |
| ⭐ **Silence** — a rest selection copies as a span of it (2026-08-19) | |
| Manual rest shifts / hidden rests | |

Just-landed foundation (uncommitted, this session): copy is scoped to the **source
staff** and paste lands on a **target staff** (no more cross-staff wipe). This plan
generalizes that single-lane behavior to N staff lanes.

## ⭐⭐ SILENCE IS CONTENT (2026-08-19)

> *"i'm able to copy a note individual and pasted it, but i cannot doit with a rest"* — and then:
> *"also group rest selection should be able to copy and paste"*.

`flattenRegion` carried **no rests**: a rest is a GAP the relay regenerates, which is right for a
REBAR (a meter change must be free to re-shape the silence it inherits) and wrong for a CLIP. The
clip builder's usability test read the empty event list as *nothing was selected* and refused the
copy, so a rest — one or a group — could not be copied at all.

Two changes, and the second is the one that makes it visible:

1. **The usability test is the SPAN, not the event count.** A selection that resolved to a span
   covers real music, and silence is some of it.
2. **`FlattenOptions.keepRests`** — the clipboard is the one caller that asks for rests as EVENTS,
   so what pastes is the silence you selected, in the shape you were looking at. Without it, a
   pasted rest fell back to the relay's own tiling: two quarter rests arrived as one half rest, and
   pasting silence into an already-empty bar changed nothing at all (which is what "not working"
   looked like). ⚠️ A MEASURE REST is still skipped — it is the empty bar's own default fill.

## 🚨 …and the WRITTEN SHAPE travels with it

> *"the paste is not a dotted figure… that is not expected"*

A dotted quarter came back as a **quarter tied to an eighth**. The relay re-derived every written
shape with `decomposeSpan`, whose rule is the RESTS' — a value may not cross a beat stronger than
its own endpoints — and 1.5 beats at a downbeat tiles as q + ♪. A NOTE has no such rule: a dotted
quarter on a downbeat is ordinary notation.

`RebarEvent.written` now carries the authored shape, and `relayEvents` uses it **when the event
survives whole** (one fragment, no barline split). A split note re-derives both halves, because two
pieces of a dotted quarter are not dotted quarters.

⚠️ Only a shape that DESCRIBES the length may travel: a slot whose sounding length is not its
written length — a collapsed fan claiming 7/16 behind a dotted quarter, a measure rest whose `w`
stands for whatever the bar holds — carries none, or the music would quietly shorten
(`rebarOps.fan.test` caught exactly that).

⚠️ One consequence worth knowing: `pasteEvents` reports the CHORDS it created, so a silent clip
reports none. `ClipboardController` falls back to selecting the slots the window now holds
(`windowSlotIds`), or a successful paste would look like nothing happened.

## Decisions (locked with the user)

- **Overflow on paste → clamp + warn.** If a multi-staff clip would land past the
  bottom staff (target + relative staff ≥ staff count), drop the overflowing lane(s)
  and `console.warn`. A paste NEVER creates or reorders staves as a side effect.
- **Partial overlap → fully-enclosed only.** A slur travels only if BOTH endpoints
  are inside the copy window; a dynamic travels only if its position is inside it.
  Straddling items are left behind. (Boundary-clipping is a possible later refinement.)

  ⭐ **Amended 2026-08-19:** enclosure is now the ceiling, not the rule — a mark also has to be
  SELECTED to travel (`MarkFilter`, `docs/passage-selection-marks.md`). A box selects everything it
  encloses, so a passage copy is unchanged; a Ctrl-built selection carries exactly what it shows.

## Payload v3

```ts
ClipboardPayload = {
  format: 'opus-editor/clipboard'
  version: 3
  spanBeats: Fraction
  spanStaves: number                 // # staves the selection covered (for clamp math/UX)
  lanes: ClipboardLane[]             // was `voices[]` — now (staff, voice)-keyed
  dynamics: ClipDynamic[]            // Phase 2
  slurs: ClipSlur[]                  // Phase 3
}

ClipboardLane = {
  staff: number                      // RELATIVE index, 0 = topmost copied staff
  voice: number
  events: RebarEvent[]
  restShifts?, restHidden?           // as today, per lane
}
ClipDynamic = { staff, voice, offset: Fraction, kind, level|text, placement }
ClipSlur    = { startStaff, startVoice, startOffset, startPitch,
                endStaff,   endVoice,   endOffset,   endPitch, side, … }
```

No migration needed (no persisted clips) — bump `version`, keep round-trip.

## Mapping rules (paste)

- **Staff:** `absoluteStaff = targetStaff + lane.staff`, clamped to `[0, staffCount)`;
  lanes past the end are dropped + warned. So relStaff 0 → targetStaff (a single-staff
  clip is the degenerate case). No "re-staffing to one target" ambiguity.
- **Voice:** keep today's contract — a clip with exactly ONE distinct voice re-voices
  into `targetVoice`; a multi-voice clip preserves each event's voice.
- Every non-destination `(staff, voice)` lane in the region **passes through** verbatim
  (this is what keeps other staves/voices intact — the rebar-lane pattern).

## Phasing (each independently shippable)

- [x] **Phase 1 — staff-relative lanes (the headline "1+2 → 3+4"). DONE.**
      Payload v3 `lanes[]` (was `voices[]`) + `spanStaves`; `buildClipboardFromSelection`
      captures one `(relStaff, voice)` lane per selected staff×voice (staff re-based to the
      topmost copied staff); `pasteEvents` maps `targetStaff + relStaff` (clamp+warn via
      `destByStaff`) and overwrites each mapped lane, passthrough the rest. Re-voicing is
      keyed on the clip's distinct-voice count across ALL lanes. Rest-shift/hidden lanes
      carry the relative staff too (though the override key still lacks a staff axis — same
      pre-existing limitation as direct multi-staff editing). Supersedes the single-staff
      fix as its general case. Tests: `1+2 → 3+4` round-trip + clamp+warn overflow.
- [x] **Phase 2 — dynamics travel. DONE.** `buildClipboardFromSelection` captures
      fully-enclosed dynamics (`dynamicsInWindow`) as `ClipDynamic{staff(rel),voice,offset,
      kind,level|text,placement}` on `payload.dynamics`; `pasteEvents` re-bases each offset by
      the paste start, maps rel→abs staff (clamp/drop overflow) + re-voices single-voice clips,
      and re-anchors via the existing `restoreBeatAnchors` path. Overwrite semantics: a
      destination dynamic inside the paste window on a destination `(staff,voice)` lane is
      dropped (`survivingAnchors` filter) so the clip's replaces it (no stacking). *(The engine's own
      `ClipDynamicInput` copy is gone — since Phase 4 of docs/refactor-plan-2026-07-27.md the one
      `ClipDynamic` lives in the CORE, `utils/clip.ts`, so there is nothing to import inward.)* Tests: capture+paste, offset re-base,
      fully-enclosed-only, overwrite-no-stack, cross-staff 1+2→3+4.
- [x] **Phase 3 — slurs travel. DONE.** `buildClipboardFromSelection` captures slurs with BOTH
      endpoints inside the window (`slursInWindow`) as `ClipSlur{start/end Staff(rel),Voice,Offset,
      Pitch, placement}` on `payload.slurs`; `pasteEvents` re-anchors via new `restoreClipSlurs` —
      a STAFF-AWARE `(staff|voice|offset|pitch)→pitchId` lookup over the pasted region (the
      existing `restoreSlurs` is staff-blind), rel→abs staff (drop overflow) + single-voice
      re-voice + offset re-base, then `addSlur` on the re-found ids (skips if an endpoint is
      unrecoverable or collapses to a point). `ClipSlurInput` declared in ScoreModel (boundary).
      Carries endpoints + placement; the hand-tuned curveShape override does NOT travel yet
      (deferred — pasted slurs get the auto arch). Tests: capture+re-anchor, offset re-base,
      fully-enclosed-only, cross-staff 1+2→3+4.
- [ ] **Phase 4 (optional) — clef changes travel; OS-clipboard JSON.**
      ⚠️ When they do, a clef's **cautionary flag must travel with it** — the `cautionaryClef`
      override (client #9, keyed `(measureId, staffId)` with the first staff ABSENT from the key).
      A clef that arrives without it silently loses its courtesy at a line break, which is the kind
      of loss nobody notices until a part is printed. Note the key is POSITION-based, so it cannot
      be copied verbatim: it is re-keyed to the pasted measure, the way `rebarOps` already re-keys
      the rest overrides. The same applies to a meter's `cautionary` override if time signatures
      ever travel.

## Reuse notes

- `staffMeasureView(m, staffId, score)` is the per-staff narrowing seam (copy + paste).
- `captureSlurs`/`restoreSlurs` (ScoreModel) already re-anchor slurs across a rebar by
  pitch+offset — Phase 3 calls the same idea at paste time for clip slurs.
- `resolveChordLevels` / `measureDynamics` already model dynamics as (voice) step
  functions — Phase 2 extends capture with the staff axis.
