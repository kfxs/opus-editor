# Multi-voice rest placement — the plan

> ⭐ **The fault** (his, 2026-08-31): a rest in a multi-voice staff lands on the wrong line and the
> user has to drag it. `public/examples/prelude-bwv846.json` carried **67 hand-placed `restShift`
> overrides**, one per rest, in a piece with one repeating texture.
>
> 📄 **The evidence is in `docs/multi-voice-rest-position.md`** — Gould/Ross/Gerou & Lusk/Stone with
> printed pages, four engines with file:line, and the regression on his 67 placements. ⛔ **This plan
> does not restate it.** Every number below cites its section there.
>
> ✅ **SHIPPED 2026-08-31 — P0, P1 and P2 are done and P3 is CLOSED by his call (§5).** The feature
> is complete; what follows is the record of why it is shaped as it is, ⛔ not a work list.
>
> ⭐⭐ **The finding this plan implements, in one line:**
> **the SIGN is positional, the MAGNITUDE is DERIVED from surrounding content, and the RESULT is
> QUANTISED to whole staff spaces** (research §3.3). ⚠️ Written when the fixed lane table was still
> live, which could express the sign and nothing else; it is gone.
>
> ---
>
> ⚠️ **AMENDED 2026-08-31, after the plan was read back against the code.** Nothing in the research
> changed and nothing in the shape of the rule changed; what changed is that four claims did not
> survive the reading, and each is corrected **in place with its mistake left visible**, because
> three of the four are re-makeable:
>
> 1. 🚨 **§3's clearance formula was written backwards** — the lower voice's extreme *and* the lower
>    voice's ink edge, under the label *"upper voice"*.
> 2. 🚨 **§3.1 did not exist**, and without it a LOWER voice's whole rest lands **on the middle
>    line** — the commonest multi-voice rest there is, forbidden by Gould p. 36 and contradicted by
>    the plan's own measured research.
> 3. 🚨 **"one seam" was wrong** — `SelectionController` owns a second copy of this rule (§4.2), and
>    it has disagreed with the renderer since the ladder was written.
> 4. ⚠️ **`REST_HEIGHT` is not exported**; the ink comes from `restBand` (§2).
>
> ⭐ Two smaller ones: the redundant fourth candidate is gone (§3), and §8's stale-render worry is
> **checked and already covered** — restated as the constraint it actually is.

---

## 1. What this is, and what it is not

- It is **one pure function** in `engine/layout/` that answers *"which line does this rest sit on,
  given what else is in the staff?"* — replacing the fixed lane table in the renderer **and** the
  second, quietly disagreeing copy of it in `SelectionController` (§4.2).
- ⛔ It is **not** a rendering change. VexFlow keeps drawing the glyph; we keep deciding the line, as
  we already do (`restPlacement.ts`). Nothing in `docs/own-engraving-engine.md`'s P3 is started here,
  and its golden-image gate is not touched.
- ⭐ It is **not** *one* call site, which the first draft claimed. Two modules answer this question
  today and they have never agreed (§4.2); the point of the module is that afterwards only one does.
- ⛔ It is **not** a new override, a new field, or a new JSON key. It **removes** stored state.
- ⛔ It does not touch the single-voice case. Gould p. 34 already owns that and it is already right.
- ⚠️ It does not delete `restShift`. The manual override stays, as a deviation from the computed
  position — with a direct precedent: LilyPond skips collision entirely for a rest with an explicit
  `staff-position` (`rest-collision.cc:230-231`).

---

## 2. ⚠️ Units and axes — settled once, here

Research §1 records that three units are in play and that the digit "6" already misled one pass.
This plan uses **one** axis and converts at exactly two named points.

> ⭐ **The module's axis is VexFlow's LINE: `3` = the middle line, `+1` = one staff space UP,
> `1`/`5` = the bottom/top lines.** A diatonic step is `0.5`.

Chosen because both of its neighbours already speak it: `clefUtils.staffLineForSpelling()` **returns**
it, and `NoteBuilder`/`setKeyLine` **consume** it. The two conversions:

| at | conversion | why |
|---|---|---|
| entry | `neutral = 5 − restStaffLine(duration)` | `restPlacement.ts` counts spaces **below the top line** (top 0, middle 2) |
| the ink table | `restBand(duration)`'s `top`/`bottom` swap sense | `spacingPadding.ts` measures on the same downward axis |

⛔ **Nothing else converts**, and ⛔ no third axis is introduced. ⚠️ That two axes exist at all is a
wart; it is not this plan's job to fix, and a comment says so at each conversion.

> ⚠️ **The ink comes from `restBand`, not from `REST_HEIGHT`** — that record is a private `const` in
> `spacingPadding.ts` and only `restBand(d): { top, bottom }` is exported. The two quantities this
> plan needs are derived from it, on the entry axis, at the one conversion point above:
>
> ```ts
> restInkBelowAnchor(d) = restBand(d).bottom − restStaffLine(d)   // = REST_HEIGHT[d].down
> restInkAboveAnchor(d) = restStaffLine(d) − restBand(d).top      // = REST_HEIGHT[d].up
> ```
>
> ⛔ Do not widen `spacingPadding`'s exports for this. `restBand` is already the seam its own header
> names, and it is the one the font test holds against Bravura.

---

## 3. ⭐⭐ The rule

Verovio's **shape** (research §4.2) — take the OUTERMOST of a set of candidates — with LilyPond's
**ink** clearance (§4.1), which we can afford because our ink is a *measured data table*, not a
runtime measurement (§4 below).

Inputs, all from the model:

```ts
interface RestVoicePlacement {
  duration: NoteDuration
  dir: 1 | -1        // +1 this voice is the upper one on this staff, -1 the lower
  own: number[]      // lines of THIS voice's notes in the bar (its "surrounding pitches")
  others: number[]   // lines of the OTHER voices' notes SOUNDING during the rest's span
}
```

**Three** candidate lines, then the outermost, then the quantisation:

| candidate | what it is | source |
|---|---|---|
| `base` | `neutral + dir × 1` for `q`/`8`/`16`/`32`; **the outer staff line** for `w`/`h` (§3.1). ⭐ It is also the FLOOR: nothing may come nearer the middle | Gould p. 36 measured **±1 stave-space** (research §3.2); MuseScore **±1 space**; LilyPond ±2 sp is the outlier |
| `ownLevel` | the rest's ANCHOR placed so its ink *centre* sits at `mean(own)` (⛔ not for `w`/`h`, §3.1) | Gould p. 37 *"The space in which a rest centres… should be on the same level as surrounding pitches"*; Verovio's same-layer mean (`rest.cpp:503-509`) |
| `clearance` | the rest's near ink edge clears the other voice's extreme note by `GAP` | Gould p. 37 *"the rest moves further away from the stave"*; LilyPond `minimum-distance` |

> ⚠️ **The candidates are NAMED, and that is not decoration.** An earlier draft called them `c1`,
> `c2`, `c3` — and in a score editor `c3` reads as **the pitch C3** before it reads as "candidate 3",
> which is precisely the register this rule computes in. ⛔ No candidate, variable or test name in
> this work is a letter-plus-digit.

⛔ **There is no fourth candidate, and the earlier draft's was an illusion.** It read *"floor — never
nearer the middle than `base`"*, which under `max`/`min` **is** `base` — the same number twice.
Verovio can have both because its two differ in kind (a duration-keyed default table *and* a separate
`GetMarginLayerLocation` floor at `:586-601`); ours collapse, so the floor is stated as a property of
`base` and the row is gone. ⚠️ If a second, genuinely different floor is ever wanted, it needs its own
source — ⛔ not a re-listing of the base.

```
line = dir > 0 ? max(base, ownLevel, clearance)
                : min(base, ownLevel, clearance)   // Verovio: the outermost wins; base is the floor
displacement = dir * ceil(dir * (line − neutral))  // Gould p. 35: "an exact number of stave-spaces"
line = neutral + displacement
```

**`clearance`, written out** — ⭐ the UPPER voice's rest clears the LOWER voice's **highest** note,
**upward**; the lower voice is the mirror in both the extreme it takes and the ink edge it presents:

```
dir > 0:  clearance = max(others) + NOTEHEAD_HALF + GAP + restInkBelowAnchor(duration)
dir < 0:  clearance = min(others) − NOTEHEAD_HALF − GAP − restInkAboveAnchor(duration)
```

> 🚨 **This is the one line of this plan that was written backwards**, and it is recorded rather than
> quietly fixed because the mistake is re-makeable. The earlier draft read
> `min(others) − … − restInkBelowAnchor` under the label *"upper voice"* — the lower voice's
> extreme **and** the lower voice's ink edge, on a `+1 = up` axis, for the voice that goes up. Wrong
> twice, and each half looks right on its own. ⭐ The check that catches it: on the axis §2 declares,
> an upper-voice rest's line must be **larger** than every number in `others`, and only `max` and `+`
> can make it so.

`NOTEHEAD_HALF = 0.6` is `INK_HEIGHT.notehead` and the per-duration rest extents come from
`restBand` (§2), both in `engine/layout/spacingPadding.ts`, both measured data. ⭐⭐ **That is what
makes this rule both ink-aware and jsdom-testable**: LilyPond-quality clearance from a table rather
than from `getBBox()`, so the whole function stays pure (research §7).

⭐ **`others` is what SOUNDS, not what STARTS.** A held half note under a 16th rest is the prelude's
whole problem. LilyPond says it in a comment — *"Include notes that started any time"*
(`rest-collision-engraver.cc:75`) — and it is the one thing VexFlow structurally cannot see, since
its `ModifierContext` is keyed on the start tick.

> ⚠️ **The span is `slotLength`, ⛔ never `writtenLength`.** `utils/durations.ts` says so at the
> function itself — *"WRITTEN, not sounding. Inside a tuplet the two differ"* — and points at
> `slotLength`, which is the tuplet- **and** measure-rest-aware one. A held tuplet note or a
> whole-bar rest in the other voice otherwise reports a span it does not have, which is the exact
> failure *"what SOUNDS, not what STARTS"* is here to prevent.

### 3.1 ⭐⭐ Whole and half rests take a FIXED OUTER LINE — the row `base` cannot supply

⛔ **`neutral + dir × 1` is wrong for `w` and `h`, and wrong in the commonest bar there is.** A whole
rest's neutral is **not** the middle line: `restStaffLine('w') = 1`, so on §2's axis its neutral is
line **4**, already one space above centre. Candidate 1 then puts the LOWER voice's whole rest on
line **3 — the middle line itself**, and its half rest on line 2. An empty voice-2 bar is the first
thing anyone sees, and that is where it would land.

Two sources refuse it, and one of them is this plan's own research:

- **Gould p. 36**: *"Semibreve and minim rests must never stray across the centre stave-line"* —
  sitting **on** it is straying onto it.
- **Research §3.2, measured on three plates** (Ross p. 173-174, Gerou & Lusk p. 114, Stone p. 135):
  upper whole **+1 sp**, lower whole **−3 sp**; upper half **+2 sp**, lower half **−2 sp**.

⭐ **All four of those measurements are one sentence:** *a whole or half rest in a multi-voice staff
attaches to the OUTER staff line on its own side* — line **5** for the upper voice, line **1** for
the lower — which is System B exactly, and the arithmetic falls out:

| | neutral | upper → | lower → |
|---|---|---|---|
| `w` (hangs from) | 4 | **5** (`+1 sp`) | **1** (`−3 sp`) |
| `h` (sits on) | 3 | **5** (`+2 sp`) | **1** (`−2 sp`) |

Every displacement is a whole number of spaces, so §3's quantisation is satisfied by construction and
Gould p. 35 is not strained to reach it.

⭐⭐ **This is not a defection from System A — it is what System A's own implementations do.** Both
engines this plan cites carry the same row: MuseScore has a **separate**
`computeWholeOrBreveRestOffset` beside `computeVoiceOffset` (`restlayout.h:57-59`), and LilyPond
returns `dir × voiced-position` for `duration_log > 1` and then **snaps whole and half to a staff
line** (`rest.cc:99-129`). ⛔ §7's decision 1 is amended accordingly.

⚠️ **`ownLevel` drops out for `w`/`h`.** The fixed line is the whole point of the practice — Gould
p. 37 reports it as done *"to avoid confusion"* — so a whole rest does not track its own voice's
mean. **`clearance` still applies**: it may push a whole rest FURTHER out, never back in, which is
the `max`/`min` doing its job with `base = the outer line`.

### 3.2 ⚠️ `ownLevel` measures the glyph's centre — and `restPlacement.ts` forbids exactly that, for a different question

That module's header is emphatic: the table gives each rest *"an ANCHOR, not a bounding box"*, and
⛔ *"an engine that centred those glyphs BY BOUNDING BOX would land several of them wrong."* Candidate
2 says the ink centre tracks `mean(own)`. The two are reconciled, and the reconciliation belongs in
the new module's header so no reader has to find it here:

⭐ **The prohibition is on deriving the NEUTRAL position from a box** — a crotchet rest is not
symmetric about the middle line and never was, so centring it there would move it off the line Gould
names. **Displacing an already-anchored rest to sit level with surrounding pitches is a different
question**, and it is the one Gould p. 37 asks. So `ownLevel` is written as an anchor, with the
asymmetry subtracted out of the measured band:

```
restInkCentre(d) = (restInkBelowAnchor(d) − restInkAboveAnchor(d)) / 2   // + = centre below anchor
ownLevel = mean(own) + restInkCentre(d)
```

⛔ The offset comes from `restBand`, ⛔ never from `getBBox()` — which is also what keeps the function
pure and jsdom-testable.

### 3.3 The one tunable, and it is sourced

> **`GAP = 0.75` staff spaces** — LilyPond's `minimum-distance` (`define-grobs.scm:2987`).

⚠️ MuseScore uses 0.35 (0.55 for whole/half) but measures a `Chord::shape()` that *includes the stem*,
so its smaller number is not comparable to ours. ⛔ **No book states a clearance number at all**
(research §8) — so this is an engine constant, honestly labelled as one, and it is the single knob to
turn if his eye disagrees. ⛔ It is not to be joined by a second knob.

---

## 4. The module and its TWO seams

**New:** `src/engine/layout/restVoicePlacement.ts` + `restVoicePlacement.test.ts`.

⭐ A **new module**, not a function bolted onto `restPlacement.ts`: that module is the *neutral
position table* and stays one job (`CLAUDE.md`'s standing rule; and a spec moves with its module).
The new one imports `restStaffLine` and the two ink tables, and exports:

```ts
/** The line a rest sits on when its staff carries more than one voice. */
export function restLineForVoice(input: RestVoicePlacement): number

/** Gather `own` / `others` from a measure's slots — the only score-shaped part. */
export function restVoiceContext(
  slots: ChordRest[], voice: number, staffId: string | undefined,
  beat: Fraction, length: Fraction, clef: Clef,
): { dir: 1 | -1; own: number[]; others: number[] }
```

`restVoiceContext` uses `voiceOf`/`staffOf` (`utils/lanes`), `staffLineForSpelling`
(`utils/clefUtils`), `slotLength` (`utils/durations`, §3) and `fracLt` overlap arithmetic
(`utils/fraction`) — all existing, all pure.

### 4.1 Seam ONE — the drawing

`VexFlowRenderer.ts:1993`, one line:

```ts
-  const restShift = multiVoice ? (REST_LANE[v] ?? 0) * REST_LINE_STEP : 0
+  // Multi-voice rest line, derived (docs/multi-voice-rest-position-plan.md). Single voice: 0.
```

with `restShiftFor(slot)` returning `derivedLine − neutralLine + override.steps`, so the manual
override composes exactly as it does now. ⛔ `REST_LANE` and `REST_LINE_STEP` are **deleted**, not
kept as a fallback — a guessing fallback gets believed.

⭐ `drawMeasureContent`'s `measure` is **this staff's LANE** (`placement.view`, a `staffMeasureView`
copy), so its `slots` already hold every voice of this staff and nothing else — which is exactly
`restVoiceContext`'s input and the reason `others` needs no cross-staff lookup.

⚠️ `intendedRestLine` re-assertion after `format()` (`:1979-1990`) stays untouched and still matters:
it is what stops VexFlow's own ±1 nudge from moving what we decided.

⭐ The PDF export is carried by this same seam and needs no second one: `export/scoreSvg.ts:66`
constructs a `VexFlowRenderer` of its own, which is what research §7 demands of a rule that is layout
rather than paint.

### 4.2 🚨 Seam TWO — voice navigation, and it was never in lockstep

⛔ **"One seam" was wrong.** `SelectionController.elementVerticalPos`
(`interactions/SelectionController.ts:589-597`) computes a rest's vertical position a **second**
time, for the Alt+Shift+↑/↓ voice hop:

```ts
const lane = voice === 0 ? 2 : -2
// Mirror VexFlowRenderer.restShiftFor: voice lane + the rest's own manual shift.
const shift = restShiftOverrideOf(...)?.steps ?? 0
return middleLineDiatonicPos(clef) + lane + shift + voiceRank
```

Its own comment claims the two *"stay in lockstep by construction"*. ⚠️ **They do not, and have not
since the ladder was written** — two separate disagreements, both live today:

1. That scale is **diatonic** (2 units = 1 staff space), so `lane = 2` is **+1 space** for voice 0
   where the renderer gives **0**, and `−2` is **−1 space** for voice 1 where the renderer gives
   **−3**.
2. `steps` is in staff **spaces** and is added to a **diatonic** scale unconverted — so the user's
   own manual shift moves the voice hop at **half strength**.

⭐ It is the same class of fault as the one this plan exists to fix: a second owner of one rule,
drifting silently because nothing compares them. Seam two reads `restLineForVoice` and converts once:

```ts
diatonicPos = middleLineDiatonicPos(clef) + (line − 3) * 2
```

⛔ Not a copy of the rule, and ⛔ not a comment promising lockstep — the import IS the lockstep.

---

## 5. Phases

**P0 — the module, pure. ✅ DONE 2026-08-31.** `restLineForVoice` + `restVoiceContext` + a 23-case
spec, all line numbers, all jsdom. No renderer change; nothing observable.
⭐ Both re-makeable mistakes were BREAK-TESTED against the spec before it was called done: the
backwards `clearance` fails 5 cases, and a `neutral ± 1` base for `w`/`h` fails 4.
⚠️ **One deviation from §4's signature**: `restVoiceContext` does **not** take `staffId`. Resolving
*"absent means the first staff"* needs the `score` (`staffContent.matchesStaff`), and a
half-resolution would silently drop every staff-0 note that stores no id — a guessing fallback that
gets believed. §4.1 already says the input is one staff's LANE, so the filter was redundant.

**P1 — BOTH seams. ✅ DONE 2026-08-31 — ⏳ awaiting HIS EYE on the prelude.** §4.1 wired in
`VexFlowRenderer` (`REST_LANE`/`REST_LINE_STEP` deleted); §4.2 wired in `SelectionController` (its
private lane deleted). Gates run: `npm run build:check` green, `npx vitest run` **5881 green**,
`npm run test:e2e` **271 green** (a renderer change, so the browser net was run either side).
⭐ **The §4.2 conversion became a named inverse** — `clefUtils.diatonicPosForStaffLine`, written
beside `staffLineForSpelling` so the two `3`s and the two `2`s cannot drift apart again. The
half-strength shift is pinned by a `SelectionController` case whose boundary (4 spaces short, 5
clear) fails under the old arithmetic, and the inverse by a `clefUtils` round-trip over four clefs.
⭐ The three doc corrections are in, and §3.1's question **and** answer are folded into
`docs/own-engraving-engine.md` §3.1 — with the LAYOUT-vs-ENGRAVE question it raised recorded as an
**open** one in its new §7.2.1 (his call, ⛔ not decided there).

⚠️ **The prelude's 402 cleared lines are UNCOMMITTED working tree** (`git diff --stat
public/examples/prelude-bwv846.json`). P1's whole verification rests on that file being the cleared
one — ⛔ check it is still cleared before reading anything into what renders.

P1 also carries **three doc corrections**, because each is a place a reader is currently told the old
rule in the present tense:

- `docs/multi-voice-plan.md` §13 (`:284-292`) states the four-lane ladder as *the* rule.
- `types/music.ts:1341` calls `RestShiftOverride.steps` *"whole staff-steps"* where every consumer
  treats it as staff **SPACES** — research §1's "digit 6" trap, still uncorrected in the type that
  causes it. ⛔ A comment fix only: the arithmetic is already spaces and ⛔ must not change.
- `GhostRenderer.ts:435`'s *"the ghost lands where the real rest will"* — see §8.

**P2 — the browser assertion. ✅ DONE 2026-08-31.** `e2e/restVoicePlacement.e2e.ts` — the prelude's
bar built by hand (bass clef, a held C4 under an upper voice's 16th rest), asserting the rest's
drawn y is above the held notehead's AND clear of it by more than a staff space, plus ⭐ **the
CONTROL**: the identical bar with ONE voice keeps its rest on the middle line. The control is what
makes the first case mean anything — it says the displacement is caused by the other VOICE and not
by the rule having moved every rest in the app. Break-tested: neutralising the renderer seam fails
the multi-voice case and leaves the control green.
⚠️ **One claim was withdrawn after checking it.** The spec's header first said this also guards the
`intendedRestLine` re-assertion after `format()`. It does not: disabling that line leaves both cases
GREEN, because VexFlow's nudge does not fire on this texture and is one line where it does. The
header now says so — ⛔ a net that claims coverage it has not got is worse than no net.

⚠️ **⛔ It cannot "load the prelude".** `e2e/harness.ts` has no `loadJSON` and no fixture loader, and
the example lives in `public/`. What it exposes is `engine`, so the texture is **built by hand**
through `addNoteAtBeat`. The readers the assertion needs — `rests()` and `noteheads()`, told apart by
SMuFL range — already exist (`harness.ts:289-290`). This is the first geometry net any of the rest
work has ever had.

**P3 — ⛔ CLOSED 2026-08-31, HIS CALL. NOT TO BE REOPENED without him asking.** The consistency pass
(MuseScore's `alignRests`, `restlayout.cpp:417-451`, which snaps a per-(staff, measure, voice) group
to its outermost line) **is not being built.** His words, after seeing P0–P2 on his own score:

> *"i think we should not do p3, it makes no sense for me at the moment and i still dont see how it
> brings value"*

⭐ **The feature is therefore COMPLETE at P2.** This phase was conditional from the day it was
written — *"ONLY if his eye asks for it"* — and the condition has been answered, not merely left
unmet: he has looked and does not want it. ⛔ The evidence was already against it (Gould p. 37
engraves rests at six different heights on ONE page precisely *because* the context changes, and
MuseScore is the only one of four engines that aligns), so nothing here is a compromise.
⛔ **A later session must not read this section as remaining work** — `feedback_a_decision_list_is_not_a_queue`,
and ⛔ an idea with a source is still not a task. Reopening it needs a NEW report of visible wobble,
from him.

---

## 6. Tests

Unit (`restVoicePlacement.test.ts`) — every case is a line number, so all of it runs in jsdom:

- single voice ⇒ `restStaffLine()` unchanged, for all six durations.
- two voices, nothing sounding ⇒ the base `±1` space, both directions.
- ⭐ **the prelude's bar**: 16th rest, upper voice, a held C4 half note underneath in bass clef ⇒
  clears it. **The regression fixture** — his 67 placements fit `round(own + 2)` (research §2), so
  the rule's answer is checked against a range, not a single magic number.
- a held note that **starts before** the rest still counts (the sounding-vs-starting case), and its
  span comes from `slotLength` — a tuplet member and a measure rest each get a case (§3).
- ⭐ **the empty voice-2 bar** (§3.1's regression, and the one the first draft got wrong): a LOWER
  voice's whole rest hangs from the **bottom** line (`−3` sp) and its half rest sits on it (`−2` sp);
  the upper voice's are on the **top** line (`+1` / `+2` sp). ⛔ Never the middle line, either
  duration, either direction (Gould p. 36).
- `clearance` pushes a `w`/`h` rest FURTHER out but never back in, and `ownLevel` does not move it
  at all (§3.1).
- the result is always a whole number of spaces from neutral (Gould p. 35).
- the manual override composes: derived + `steps` = the sum, and `steps: 0` clears.
- ⭐ **the two seams agree**: for the same rest, §4.2's diatonic conversion of `restLineForVoice`
  equals `2 × (line − 3)` off the clef's middle — the assertion that would have caught the drift
  §4.2 documents, had it existed.

Browser (P2): the one geometry case above.

⛔ No test asserts a pixel; ⛔ no unit test asserts a drawn position.

---

## 7. The decisions this plan MAKES — and what each one rejects

⚠️ Research §7 left three calls open. This plan takes them so the work can start; each records what
it rejected, so overruling one is a one-line change and not an archaeology exercise.

1. ⭐ **System A for `q`/`8`/`16`/`32`, System B for `w`/`h` — ⛔ NOT "A, not B".**
   ⚠️ **An earlier draft posed this as an either/or and chose A outright.** That was a false
   dilemma, and it produced a lower voice's whole rest sitting on the middle line (§3.1). The
   question the two systems answer is not the same question: B pins **whole and half rests only** to
   a fixed outer line, and is silent on everything shorter; A is what displaces the shorter rests,
   and **every rest in the prelude is a 16th**. Neither alone covers the score.
   ⭐⭐ **Both engines this plan follows carry both rows** — MuseScore's separate
   `computeWholeOrBreveRestOffset`, LilyPond's line-snap for `duration_log ≤ 1` — so taking both is
   the *majority* reading of the sources, not a compromise between them. ⛔ The remaining taste call
   is narrower and is still his: whether the shorter rests' base is 1 space (Gould/MuseScore) or 2
   (LilyPond). Reversing that is one number in `base`.
2. ⭐ **`GAP = 0.75` sp**, LilyPond's, labelled an engine constant because no book states one (§3.3).
3. ⛔ **No consistency pass — CLOSED, not deferred** (P3). It was taken as *"not yet, the evidence
   cuts both ways"*; he closed it outright on 2026-08-31 having seen the result. The research's
   third open call (§7) is answered.

**And one consequence that is NOT a free choice** (research §7): moving the base changes the meaning
of every `restShift` already saved — a stored `+6` means "+6 from centred" today and would become
"+6 from wherever the rule now puts it". ⭐ **No migration**, per the project's standing rule that
JSON is never migrated: the prelude is already cleared, and any other file with hand-placed rests
will need its shifts re-nudged once. ⚠️ This is
`feedback_a_shared_rule_changed_is_five_families_changed` in its exact form, and it is the reason P1
is a single visible commit rather than a quiet refactor.

---

## 8. What could go wrong

- ⚠️ **The prelude's bass material sits on ledger lines above the staff** (research §2), so it
  exercises `clearance` hard and `base` not at all. ⛔ Do not tune `GAP` on this file alone —
  a normal two-voice staff is the other half of the test.
- ⚠️ **`own` for a rest at the start of a bar** has no preceding note in that bar. Use the bar's
  notes in that voice; if the voice has none, `ownLevel` drops out and `base` carries it.
- 🚨 **Three and four voices are UNKNOWN in every source** (research §8), and `dir` is voice PARITY,
  so V1 and V3 take the same direction with nothing to tell them apart. The first version of P1
  shipped that as a stated regression — V1 and V3 on one line, LilyPond-style — and ⛔ **HE REFUSED
  IT** (2026-08-31): *"i dont like this regression i think we agreed before we will use this
  conventions from down to top v4-v2-v1-v3 right?"* He is right, and `docs/multi-voice-plan.md` §13
  records the order as *"the values the user picked"* on 2026-07-23.
  ⭐⭐ **A settled convention of his is not a casualty of a rule that did not think about it**
  (`feedback_dont_invent_rules_that_predate_you`), and *"no source covers it"* argues for keeping
  his call, not for dropping it — where nothing is derivable, taste is the only input there is.
  ⭐ **The ORDER is restored, the MAGNITUDES are not.** `REST_LINE_STEP = 3` was the unsourced
  number this rule replaced; reinstating it as a lane gap would reinstate the measured mistake. So
  the order rides a FOURTH candidate, `laneOrder`, in the same shape as `clearance` with the inner
  voice's REST in place of a notehead: measured ink + the same `GAP`, ⛔ **no second knob**. Two
  16th rests come out ~4 spaces apart and two whole rests ~2, because that is what their ink needs.
  ⚠️ It binds only where two rests actually SOUND together — where the inner voice has a note,
  `clearance` already did the work, and a lane that separated a rest from silence would be the old
  fixed ladder under a new name.
- ✅ **Only a stale render runs — CHECKED, and it is already covered.** `measureShapeKey` takes
  `view: Measure` = *this staff's lane*, and `laneFingerprint` (`MeasureWidthCache.ts:107-139`)
  `JSON.stringify`s `lane.slots` **whole** — every voice on the staff, pitches included. So editing
  voice 2 already invalidates voice 1's bar, and the clef is in the key beside it. ⛔ No key change
  is needed, and ⛔ none should be added.
  ⭐⭐ **But that is a CONSTRAINT, not a free pass**: it holds only because the rule reads the SAME
  measure and the SAME staff. The moment `others` reaches the neighbouring bar or the other staff of
  a grand system, the key stops covering it and the picture rots silently
  (`reference_only_a_stale_render_runs`, `reference_render_width_key_vs_shape_key`).
- ⚠️ **The rest GHOST will lie.** `GhostRenderer.ts:435` places the rest-stamp preview by `restKey`
  alone and says so — *"the ghost lands where the real rest will"*. It is already false in
  multi-voice (the ghost never knew about `REST_LANE` either), and a derived rule widens the gap from
  three spaces to whatever the content says. ⛔ Not fixed here (§9), but the comment's claim is
  withdrawn in P1: a preview that lies about where the mark lands is the same family of fault as a
  rest the user has to drag.

---

## 9. Not in scope

Crossing voices · rest **merging** when two voices rest together (VexFlow hides one; nobody else
does) · the horizontal alignment Gould p. 37 requires (*"Rests that are part of a beat should align
horizontally"*) — we already share one column x per beat (`spacingPass`), so it is satisfied by
construction, but nothing asserts it.

⚠️ **Whole-bar (measure) rests take §3.1's outer line like any other whole rest** — `NoteBuilder`
already places them by the same `restKey('w')` and applies the same shift — but ⛔ nothing beyond
that: MuseScore's separate measure-wide 0.75 sp pass and Verovio's `MRest` floor are out of scope
here, as is any centring interaction with `alignCenter`.

⚠️ **A displaced rest's KERNING BAND stays wrong, and it is named here rather than left silent.**
`restBand` (`spacingPadding.ts:216`) prices every rest at its **neutral** line, so a rest this rule
lifts three spaces still claims the band it would have had in the middle of the staff. ⭐ It moves no
width today — `MAY_KERN` has no rest row, as that function's own comment says — so this is a latent
disagreement, not a bug. ⛔ But it becomes one the day a rest row is added, and the fix then is to
pass the derived line into `restBand`, ⛔ never to re-derive the placement inside the spacing layer.
