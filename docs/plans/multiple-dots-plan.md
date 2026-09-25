# Double and triple dots — the plan

> **Status (2026-09-25): P0 BUILT (`87df716`) · P1 BUILT (`998ddac`) · P2 BUILT (`2619c9e`) · P3 BUILT (`6676556`) · P4a BUILT (`dab58f5`) · P4b BUILT (`49808ed`) · P4c BUILT (`7317dda`) · P4d BUILT (3a, `d1eea16`) · P4e BUILT (`6ca9855`) · P4f BUILT (`8102b92`) · P4g BUILT; ALL DECISIONS TAKEN (D1–D7, R1–R7); ✅ EVERY PHASE BUILT — what is left is §3 Later.** The research is IN —
> `docs/research/multiple-dots-research.md` (the literature, the engines, the duration rule). ⛔ A number
> never blocks a phase (`CLAUDE.md`).
>
> ⚠️ **The UI is the dev shell's** (`src/dev/devToolbar.ts`): a `Dots:` group, like `Note:`'s `cue`. The
> Keypad already DRAWS "double dot" / "triple dot" keys on a page (`windows/keypad/keypadLayouts.ts`,
> `momentary` pictures); wiring them is a later step, his call.
>
> ⭐ **Durations will grow** (his words, 2026-09-25: *"we will have more durations, so we can do the
> implementation thinking that we will have shorter durations in the future"*). ⛔ No rule here is a list of
> today's values — every limit is DERIVED from the shortest duration the model has.

---

## 0. What we know

### 0.1 The duration rule — settled

Each dot adds half of the previous addition: **n dots = d × (2 − 1/2ⁿ)** — × 3/2, × 7/4, × 15/8, × 31/16.
Web check, 2026-09-25: Wikipedia *Dotted note* (*"the xth dot adds 1/2^x the length"*), Scoring Notes
*Deconstructing the rhythm dot* (7/4, 15/8). No modern standard defines it otherwise; the only exception is
historical (before the mid-18th c. a single dot could mean a double). Rests take any number of dots by the
same rule. Triple dots: rare (Wagner, Bruckner brass); quadruple: *"extremely rare"*. **MusicXML** — one
`<dot/>` per dot, no cap; **MEI** `@dots` — 0 to 4. Inside a tuplet: the dotted value × the ratio (what
`tupletOps` already does with `baseDots`).

### 0.2 The engraving numbers — the research is IN (2026-09-25)

⭐ The whole of it, with the quotations and the measurements: `docs/research/multiple-dots-research.md`.

Two agents: the LITERATURE (Gould pp. 38–39, 54–56, 63, 160–164; Ross pp. 169–171; Gerou & Lusk pp. 21–24;
Stone pp. 78–79, 124–127 — all read on 450-dpi scans, the plates MEASURED) and the ENGINES (source read, not
rendered — none is installed: LilyPond `beedbfa`, MuseScore `929d1e9`, Verovio `efff0bc`). ⛔ Unreached:
Gardner Read (borrow-only), Powell, Vinci, Heussenstamm, Chlapik, MOLA — UNKNOWN, not silent.

All in staff spaces, ink edge to ink edge.

| question | ours today | literature | engines | verdict |
|---|---|---|---|---|
| head → first dot | 0.5 (`house`) | Gould *stated* 0.5 (p. 54); every plate DRAWS less: Gould 0.37, Ross 0.39, G&L 0.39–0.42 | LilyPond 0.45 · MuseScore 0.5 · Verovio 0.3 | ✅ ours = Gould's sentence and MuseScore; → **R1** ✅ |
| dot → dot (2nd, 3rd) | 0.5 (`house`) | no book states a number (Ross's *"½ space beyond the single dot"* is closest; G&L *"equal to that of the first dot"*); plates: Gould **0.26**, Ross 0.35–0.51 (uneven), G&L 0.34–0.39 | LilyPond 0.45 · MuseScore 0.25 · Verovio 0.35 | ⚠️ ours is the WIDEST of every source — a triple dot reaches ≈2.7 sp past the head vs 2.2 (MuseScore, Verovio); → **R1** ✅ |
| the 3rd dot steps like the 2nd | yes | yes (every plate) | yes (all three) | ✅ |
| all a note's dots at ONE height | yes | yes | yes | ✅ |
| line note → dot in the space ABOVE (ledgers too) | yes (`dotStack`) | Gould pp. 54–55, Ross p. 169, G&L p. 21 | yes | ✅ |
| TWO voices: the space follows the STEM (up-stem above, down-stem below) | ❌ no voice rule | four books state it | all three (voice 2 / stem-down → below) | 🚨 ours breaks a unanimous rule → **R3** ✅ |
| two voices' dots at ONE x | ❌ each note's own | — | all three align | → **R3** ✅ (read from the code; P3 records it) |
| chord: one dot column, a grid for 2–3 dots | yes | Gould p. 54 (three rows of two) | all three | ✅ |
| chord with a SECOND: the lower line note's dot to the space below | `dotStack` (read) | Gould p. 55, G&L p. 23 | three different algorithms | P3 records ours |
| chord: drop a dot ≥ 2 spaces from its note | ❌ probably not | Gould p. 56 | — | → **R5** ✅ |
| stem-up FLAG: dots pushed past it | ALWAYS (`noteDotXs`, VexFlow's `forceFlagRight`) | — | only when the dot is LEVEL with the flag (all three) | → **R2** ✅ |
| RESTS: the same gaps as a note | ❌ VexFlow's 0.2 / 0.1 (`dotPlacement` skips rests, deliberately) | Gould pp. 38, 162 MEASURED ≈0.4 / 0.25 — the same as her notes; no book puts a rest's dot closer | all three: the note gaps (MuseScore 4 reads its `dotRestDistance` NOWHERE) | 🚨 the exclusion's reason does not survive → **R4** ✅ |
| double-dotted RESTS | allowed | Gould p. 162: *"may replace two or more rests within a beat"*, *"only at the beginning of a beat"*; longest dotted rest *"one value smaller than the beat"* | — | → **D3** ✅ |
| dot SIZE | Bravura 0.40 | Gould draws 0.49 (*"often twice"* a staccato); Ross ⅓; G&L ≈0.3 | Verovio a circle r = 0.2 | the books disagree → **R6** ✅ |
| dot and TIE | UNKNOWN — P3 records it | split: Gould p. 63 the dot INSIDE the tie; G&L p. 22 the tie after the dot; Ross p. 139 either | — | → **R7** ✅ |
| room per extra dot | `dotExtent` grows by width + gap | UNKNOWN (Gould p. 39 spaces dotted values only as single dots) | LilyPond +0.90 · MuseScore +0.65 · Verovio +0.75 | ✅ ours grows; its size follows R1 |
| usage | — | G&L p. 22 *"only in situations where they will be easily understood"*; Ross p. 171 marks `h..` INCORRECT against `h.` tied to `8` | MuseScore caps 4; LilyPond none; Verovio draws any | — |

⭐ **The R-decisions** (§1) are what the check found in how we draw the SINGLE dot too — all his calls,
2026-09-25: presets, `gould` the default unless he had decided otherwise.

🚨 Two corrections to our older docs, found on the way: `docs/research/accidental-dot-research.md`'s
"+0.07 sp anti-alias bias" does not reproduce (Gould measures 0.37 / 0.26 raw) and her dot is **0.49** sp,
not ≈0.41; `docs/research/dot-placement.md` still credits the equal gaps to Gould and MuseScore and cites
`dotRestDistance` for rests; and `docs/research/accidental-dot-engines.md` cites MuseScore's
`Rest::getDotline` at the wrong lines (it is `dom/rest.cpp:343-366`).

### 0.3 The code — what is already N-ready

- **Model:** `dots?: number` on `Chord` / `Rest` / `Note` is a COUNT (`types/notes.ts`). No new field, no
  JSON change.
- **Drawing:** `NoteBuilder` attaches one `EngravedDot` per count; the token (`qdd`) and
  `engrave/notes/noteDuration.parseNoteDuration` handle any count.
- **Placement and room:** `layout/noteDotXs` and `layout/spacingPadding.dotExtent(dots)` both step by the
  armed dot→dot gap per extra dot; `layout/dotGap` rows all carry a `dot` column.
- **Selection:** a slot's dots select and delete TOGETHER (`interactions/elements/dot.ts`) — still right
  for two or three.
- **Rebar / paste / tuplets** carry `dots` through by value.

### 0.4 The code — what assumes 0 or 1

1. 🚨 **BUG — `utils/durations.durationToFraction` caps at 2 dots** (`DOT_MULTIPLIERS[Math.min(dots, 2)]`):
   a triple-dotted note is TIMED as double-dotted (× 7/4, not × 15/8), and disagrees with the float
   `getDotMultiplier`, which is general. Reachable today only through a loaded JSON. → **P0.**
2. **The shortest value limits what can be dotted.** `utils/restFill` fills on a hard-coded **32nd grid**
   (`lenNum * 8`), and `decomposeSpan` silently STOPS on a remainder finer than that (`if (!chosen) break`).
   A double-dotted 16th leaves a 64th nothing can fill. → **P1.**
3. **The editor treats the dot as on/off:** `PaletteController.toggleDot` and `selectedDots` flip 0 ↔ 1;
   the dot stamp (`MouseController.stampDotAtClick`) writes `dots: 1` and ignores a dotted note;
   `keypadSync` lights the `.` key for 1 only. → **P2 / P3.**
4. **What the model does when a dot does not fit** — `durationChangeOps` coerces `dots` back to 0 (the
   stamp's comment says so). With more dots there is a middle answer. → **D4.**

---

## 1. The decisions

| # | decision | status | proposed | why |
|---|---|---|---|---|
| **D1** | **how many dots the model allows** | ✅ 2026-09-25, his call (*"a sounds good for me, but probably in the editor we will not have a tool for more that 3 dots, however having the model with no limits seems like a good idea like lilypond and musicxml does"*) | **no cap in the model** (LilyPond, MusicXML); a duration takes n dots iff its **last dot's value ≥ the shortest duration** (derived from `DURATION_INFO`). The editor's tools offer **1–3** | MEI and MuseScore stop at 4. Today: ×2 on an 8th or longer, ×3 on a quarter or longer — ⛔ written as the rule, never as that list |
| **D2** | **the rest-fill grid** | ✅ 2026-09-25, his rule (*"we will have more durations, so we can do the implementation thinking that we will have shorter durations in the future"*) | derived from the shortest duration, not the literal 32nd | the same rule, so a 64th arriving later needs no second edit |
| **D3** | **the automatic choices stay single-dotted** | ✅ 2026-09-25, his call (*"a"* — *"your recommendation i mean"*) | `LENGTHS_DESC` (`fitRestDuration`, `splitBeatsIntoDurations`) and `restFill`'s `CANDIDATES` keep 0 or 1 dot; double and triple dots appear only when the USER writes them | `durations.ts` already says why: guessing `h..` for someone is a bigger claim than `h.`. Gould p. 162 ALLOWS a double-dotted rest (at a beat's start, within a beat) — reviewing the rest fill against pp. 160–164 is a separate job (§3 Later, ⛔ not a queue) |
| **D4** | **a dot count that does not fit** | ✅ 2026-09-25, his call (*"a"*, then — once the first framing was found WRONG — *"a"* again, to the corrected one) | a **NOTE** dotted past the barline CROSSES it tied (unchanged: a dot lengthens like any lengthening, `splitChordWithTie`) · a **REST** dotted past the barline, and a **TUPLET member** dotted past what its group has left, are **REFUSED WHOLE** (they used to be clipped to an UNDOTTED value — the dots silently dropped) · more dots than the value takes (D1) → refused whole, whatever the slot. Only a DOT edit (dots raised, duration untouched) is refused; a DURATION change keeps today's clamp | 🚨 first asked as if today REFUSED everywhere — it did not: a note already tied across. The user's value is correct: never silently rewritten |
| **D5** | **the palette's behaviour** | ✅ 2026-09-25, his call (*"is a dev shell temporary button it should behave like the keypad dot button, but for double and for triple"*) | `..` / `...` = **the Keypad dot key (`PaletteController.toggleDot`) with a COUNT n**, branch for branch: (0a) a length-using tool armed (the rest stamp) → its armed dots become n, or 0 if already n · (0) the dot stamp armed with n → disarm (armed with another count → re-arm with n) · another marking tool armed → arm the dot stamp with n · (1) a slot's DOTS selected → already n ⇒ remove them; else ⇒ set n · (3) selection mode, nothing note-like selected → arm the dot STAMP with n · (2) a note selected → n, or 0 if it already has n · (4) note entry → arm n for the next note, or 0 if already n. **The stamp's click**: a note or rest that already has n → no change (today's `dots` stamp rule); otherwise → n. Lit: the count armed / selected. ⚠️ a temporary DEV button — the Keypad keys are the real door, later | one behaviour, three counts: the Keypad key IS the n = 1 case |
| **D6** | **the `.` key (and the Keypad dot key)** | ✅ 2026-09-25, his call (*"it is imposible to have 3 and 2 or 1 and 2 at the same time so the dots switch if any"*) | the counts are a RADIO: `.` / `..` / `...` each SWITCH the note to their count, and only a press of the count it ALREADY has turns the dots off. So `.` on a double-dotted note → **1**, ⛔ not 0. The `.` key is simply D5 with n = 1 | ⚠️ a CHANGE to today's key: `toggleDot` reads `selectedDots >= 1 ? 0 : 1`, which undots a double-dotted note. The dot key's other branches are unchanged |
| **D7** | **graces and fans** | ✅ 2026-09-25, his call (*"of course, grace note are also notes so it should have the same things normal notes have"*) | **a GRACE takes 1–3 dots exactly as a note does** — the same limit (D1), the same radio (D5/D6), the same presets (R1–R4) where they apply to its drawing (`layout/noteDotXs` is already shared with graces). A FAN draws no dots by design; a double-dotted fan unit is timed right and needs nothing here | a grace is a note: ⛔ no special case either way. ⚠️ check `GracePass` / `graceRoom` draw and space n dots, and `graceOps` / `graceKeyboard` carry the count |

| **R1** | **the note's two gaps (`dotGap`'s armed row)** | ✅ 2026-09-25, his rule (*"we will make presets, if we have not making explicit the decision before the default should be gould"*) | the table and `__dots.gap(…)` already exist; the DEFAULT becomes **`gould` — 0.5 / 0.26**. The head→dot 0.5 WAS his explicit call (2026-08, *"the dot is too close to the notehead"*) and is Gould's sentence (p. 54); the dot→dot 0.5 was NEVER his — `642c82f` derived it (*"the same gap twice"*), crediting Gould wrongly — so it takes her plate's 0.26. `house` stays as a row | ⭐ a SINGLE dot does not move: only the dot→dot gap changes, and it shows only with 2+ dots |
| **R2** | **dots and a stem-up FLAG** | ✅ 2026-09-25, his call (*"same thing, presets with gould as default and other books and engines as posibilitties (including what we have now)"*) | a PRESET table, console-armed. Each row = WHEN the dots are pushed + the white past the flag's box. **`gould` (default)**: only when the flag's tail meets the dot's height (p. 55 *"should the end of a tail coincide with the position of the dot"*), **0.30** past the flag (her eighth, measured) · `ross`: past the flag (p. 171 *"DO place the dot after the flag!"*), 0.20 measured · `gerouLusk`: *"further right, altogether avoiding the flag"* (p. 22), always, 0.03 (measured 0.00–0.05) · `lilypond` when level, 0.45 · `musescore` when level (top dot), ≈0 · `verovio` when level, ≈0.09 · `vexflow` = **what we draw now**: EVERY stem-up FLAGGED note, ≈0.35 past the flag (`noteDotXs`/`forceFlagRight`; measured, P3) | ⭐ a BEAMED note is NOT pushed today (P3 measured it; `642c82f`'s note that it was is stale) — and no book or engine pushes one |
| **R3** | **two voices** | ✅ 2026-09-25, his call (*"yes same thing, presets with gould as default"*) | TWO preset tables, console-armed. **3a — a line note's dot, UP or DOWN:** **`gould` (default)** follows the STEM (down-stem → the space below, p. 56; with p. 58's exception: overlapping parts force a down-stem dot UP) · `byVoice` (LilyPond, MuseScore: voice 2 down) · `vexflow` = **now**, always up. **3b — both voices dotted at one beat, the dots' x:** **`gould` (default)** aligned after both parts (p. 56 *"usually aligned … most compact"*) · `lilypond` always one x per staff · `musescore` aligned when the chords are within a second · `verovio` aligned only when they would collide · `own` = **now**, each note's own | four books + three engines. ⚠️ "now" is READ from `dotStack`, not seen — the first step is a scene test of what we draw today |
| **R4** | **a dotted REST's gaps** | ✅ 2026-09-25, his call (*"the idea is we use presets as we have we are using, default should be gould and we see what the other engines or other posibiblies are and make it to an instrument similar we have with other measures"*) | a PRESET table for the rest's two gaps, beside `dotGap`'s, armed from the console like `__dots.gap(…)`. **`gould` (default)**: her plates pp. 38 + 162, MEASURED — **0.4** rest ink → dot (quaver-family rests; her crotchet rests measure 0.50–0.55), **0.25** dot → dot. Other rows: `followNotes` (whatever note row is armed) · `lilypond` 0.45 / 0.45 · `musescore` 0.5 / 0.25 · `verovio` (x 1.25 sp for a half rest or longer, else the glyph's width; 0.35 between) · `vexflow` 0.2 / 0.1 (what we drew until now). ⛔ The dot's HEIGHT on a rest is unchanged (Gould p. 38, Ross p. 179 agree with ours) | never decided before: `642c82f` (2026-07-28) left rests on VexFlow's as a SCOPE choice, citing MuseScore's `dotRestDistance`, which MuseScore 4 never reads. Gould's plates, and all three engines, give a rest the note's spacing |
| **R5** | **a tall chord's dots** | ✅ 2026-09-25, his rule (*"presets, and if we have not maken explicit the decision before gould is default"*) — IN this plan | a PRESET table: **`gould` (default)** — centre the dots on the chord (p. 56 *"rather than placing them in one direction"*) and drop any forced two or more spaces away (*"use only as many dots as cover the number of stave-spaces taken up by the chord"*) · `lilypond` at most 3 rows (`chord-dots-limit`, trimmed from the ends inward) · `keepAll` (MuseScore, Verovio) = **now** (`dotStack` walks top-down, never drops) | one book; applies to single dots on a cluster as much as to double |
| **R6** | **the dot's SIZE** | ✅ 2026-09-25, his rule (*"presets, if we have not maken explicit decision before gould is default"*) — IN this plan | a PRESET table: **`gould` (default)** — scaled to **0.49 sp**, what her plates draw (p. 54; her words *"often twice the size"* of a staccato would be ≈0.67 in Bravura, bigger than anything she draws) · `font` = **now**: the face's `augmentationDot` unscaled (Bravura 0.40, Leipzig 0.52, Sebastian 0.50) · `ross` ⅓ (p. 169, stated) · `gerouLusk` ≈0.3 (drawn) | ⚠️ it moves EVERY dot on the page (≈+20% in Bravura), single ones included; and the dot's WIDTH feeds the room (`dotExtent`, `noteDotXs`) — one number for the ink AND the room |
| **R7** | **a dot and a TIE** | ✅ 2026-09-25, his rule (*"presets, if we have not maken explicit desicion before gould is default"*) | a PRESET table: **`gould` (default)** — the dot INSIDE the tie, the tie curved clear of it (p. 63 *"Place the dot within the tie – the tie does not follow the dot. Curve the tie sufficiently to avoid obscuring the dot"*; chords p. 64: between the dots if they fit, else after) · `gerouLusk` the tie starts after the last dot (p. 22 *"place the tie clearly to the right of the dot"*) · `now` = whatever we draw today (UNKNOWN until P2 records it). Ross p. 139 allows either — no row of his own | the books split; 2–3 dots take a large share of a tie's length |
---

## 2. The phases

⭐ **Every preset table is the `dotGap` shape**: sourced ROWS (books, engines, and **what we draw now**, so the
change is visible rather than remembered), a default of **`gould`** (his rule, 2026-09-25), armed from ONE
console, `__dots` (`dev/dotGapConsole`, grown — ⛔ not one console per table). A row that changes a WIDTH
bumps a generation that goes in the layout key AND the width-cache fingerprint (`dotGapGeneration`'s
pattern). Each table is its own module in `engine/layout/` or `engine/engrave/notes/`, with its spec.
⭐ ONE STEP AT A TIME — each phase stops for his check in the browser.

### P0 — the duration bug ✅ `87df716`

`durationToFraction` computes (2ⁿ⁺¹ − 1) / 2ⁿ; specs for 0–4 dots.

### P1 — the limit (D1, D2, D4)

- `utils/durations`: the most dots a duration may take — its last dot's value ≥ the shortest duration in
  `DURATION_INFO`. Spec: today's answers, and a local table with a shorter duration raises them.
- `utils/restFill`: the grid from the shortest duration, ⛔ not the literal `* 8`.
- `durationChangeOps`: a count above the limit is refused whole; a REST or TUPLET member dotted past its room
  is refused whole; a NOTE still crosses the barline tied (D4) — ⛔ without changing what a DURATION change does.
- ⚠️ Side effect, by the rule: a DOTTED 32nd is now refused (its dot is a 64th, which nothing can close).

### P2 — the counts in the editor (D5, D6, D7) ✅

⭐ Built as planned, plus: an armed dot STAMP promotes its count on a duration press only if the pressed value
can take it (`stampPromotion`); an ARMED count the armed length cannot take is refused (`...` on a 16th).
`lint:hubs` ceilings lowered (MouseController 1057 → 1035 lines, PaletteController 424 → 422 kinds).
⚠️ A selected DOTS element still lights the Keypad's `.` whatever its count (`dotHighlight` has no engine).


- **Module** `interactions/stamps/dotCountTool.ts`: the Keypad dot key's branches with a COUNT n.
  `PaletteController.toggleDot` becomes the n = 1 call (the logic LEAVES the hub). The radio: a press
  switches to its count, only the count already held turns the dots off (D6 changes today's `.` on a
  double-dotted note: 0 → 1).
- **The stamp:** `{ kind: 'dot' }` gains its count; its click moves OUT of `MouseController` (at its line
  ceiling) into `stamps/dotStamp.ts`.
- **Dev shell:** a `Dots:` group, `..` and `...` (one line each, calling the module).
- `keypadSync`: the `.` key lit for exactly 1. `SelectionController` copies the count.
- **Graces** (D7): the count travels through `graceOps` / `graceKeyboard`; `GracePass` / `graceRoom` draw
  and space n dots.
- Specs beside each module; clipboard / rebar / paste carry the count.

### P3 — record what we draw NOW ✅

`e2e/dots.e2e.ts` — seven pins, in the BROWSER: 🚨 jsdom cannot hold them (a head measures 0 wide there and
the scene's dots land INSIDE it — probed 2026-09-25), so the planned scene tests became a browser spec. Break
test: arming `gould` fails the triple-dot pin (0.26 read against 0.5). ⭐ What it MEASURED, and what that
changes in the rows:

| case | now (sp) | ⚠️ against what we had READ |
|---|---|---|
| triple-dotted quarter | head→dot 0.5, dot→dot 0.5, the 3rd like the 2nd, one height | as read (`house`) |
| double-dotted half REST | rest→dot **0.2**, dot→dot **0.1** | as read (VexFlow's) |
| stem-up flagged eighth | dot ≈**0.35** past the flag's box | the `vexflow` row of R2 is 0.35 past the flag |
| BEAMED dotted eighth | 0.5 off its head — **NOT pushed** | 🚨 `dot-placement.md` said a beamed eighth was pushed; it is not (any more). R2's `vexflow` row = pushed for every stem-up FLAG, ⛔ not beamed |
| two voices on lines | the stem-down voice's dot goes **UP**; both dots at **ONE x** | 3a as read; 🚨 3b: with the heads at one x the dots ARE aligned — `own` differs from `gould` only where the heads stand apart (to probe in P4d) |
| a cluster C5–F5 dotted | every dot kept, one column — 🚨 **two dots in ONE space** (D5's drops into C5's) | a COLLISION the research did not know: Gould p. 55 *"Each dot should always have a stave-space to itself"* — P4e's first case |
| a dotted note tied | the tie starts LEFT of the dot, under the head, and bows below it | R7's `now` ≈ `gould` here (the dot inside the arc) — a stem-down / chord case still to probe in P4g |

### P4 — the tables, one per step, each defaulting to `gould`

| step | table | decision | moves |
|---|---|---|---|
| P4a ✅ | note gaps — arm `gould` (0.5 / 0.26) in the EXISTING `dotGap` | R1 | only 2+ dots. 🚨 Found on the way: the ROOM (`spacingPadding.dotExtent`) never followed the armed row — only `house` had ever been armed — so a double dot drew 0.24 sp inside its room; it follows the row now (a spec over every row). And P2's ghost parked 70 px off (an em box read as the dot) — fixed, with a triple-dot case in `e2e/ghosts.e2e.ts` |
| P4b ✅ | a rest's gaps — new table `layout/restDotGap`, `__dots.restGap(…)` | R4 | every dotted rest: 0.2 / 0.1 → 0.4 / 0.25. 🚨 Found on the way: a rest's dots had NO room in the spacing model (its box was the glyph alone) — `spacingPadding.restDotExtent` now gives them one, from the same row |
| P4c ✅ | dots and a flag — new table `layout/dotFlag`, `__dots.flag(…)`; the dot's start asks with `ignoreFlag` and `placeDots` applies the row (`vexflow` = the old flag-width push) | R2 | stem-up FLAGGED dotted notes (a beamed one was never pushed — P3): a dot in a SPACE below the tail is no longer pushed; a level one clears the flag by 0.30. Graces follow (taken as level). 🚨 Found on the way: the spacing model reserved the UNPUSHED dot, ≈0.8 sp short — `measureColumns.flagDotPush` now reads the same row. G&L measured for their row: always, 0.00–0.05 |
| P4d ✅ (3a) | two voices — up/down: `layout/dotVoice`, `__dots.voice(…)`; the rule is an argument to `dotStack.stackDots` (VexFlow's own, unchanged without it) | R3 | a stem-down line note in a two-part column drops its dot BELOW; crossed parts lift it back (Gould p. 58). ⏸️ **3b (one x) NOT built**: two voices' heads always stand at ONE x in this editor (the multi-voice pass clears the head shift — measured), so their dots already share a column and every 3b row would draw the same. ⏸️ **No `byVoice` row**: a dot knows its note's stem, not its voice (differs from `verovio` only for a hand-flipped stem) |
| P4e ✅ | a colliding chord's dots — `layout/chordDots`, `__dots.chord(…)`: `gould` (a space each, centred; surplus DROPPED — `EngravedDot.setDropped`, no ink, no hit box), `verovio` (merge), `vexflow` (two in one space — what we drew) | R5 | only a chord whose dots COLLIDE (a cluster of seconds); every other chord unchanged. Rule read off Gould's p. 56 FIGURES. ⏸️ LilyPond + MuseScore rows: their algorithms are in `docs/research/multiple-dots-research.md` Part D, ⛔ not ported (his call) |
| P4f ✅ | the dot's size — `layout/dotSize`, `__dots.size(…)`: `gould` 0.49, `font` (what we drew), `ross` ⅓, `gerouLusk` 0.3. ONE scale feeds the stamp (`EngravedDot`, `drawGraceDots`) and the room (`spacingPadding.INK.dotWidth`, `noteDotXs`, `graceRoom`, `dotFlag`) | R6 | every dot, ≈+22% in Bravura. The specs that compare our ink table against the FONT now read the `font` row, and say so |
| P4g ✅ | a dot and a tie — `layout/dotTie`, `__dots.tie(…)`: `gould` (the dot within the tie — WHAT WE ALREADY DRAW, measured: a stem-down D5's tie clears its lifted dot by ≈0.31 sp) and `gerouLusk` (the tie after the last dot, through the bracket's door in `tieEndpoints`) | R7 | nothing by default. ⚠️ G&L's white after the dot is UNKNOWN: their figures (pp. 22, 144) draw NO dot — read as 0. ⏸️ Ross allows either, no row. ⏸️ A CHORD's ties between its dots (Gould p. 64) not probed |

Each step: the module + its rows (a SOURCE on every row) · its `__dots` command · its spec · the P3 scene
test updated for the new default, the `now` row still reproducing the old drawing · his eye.

## 3. Later

- PORT LilyPond's chord-dot collision rule (its `chord-dots-limit` a row) and MuseScore's as `layout/chordDots` rows — the pseudocode is `docs/research/multiple-dots-research.md` Part D.
- A review of the REST FILL against Gould pp. 160–164 (the longest dotted rest *"one value smaller than the beat"*; double-dotted rests at a beat's start) — D3.
- The Keypad's "double dot" / "triple dot" keys wired (today pictures).
- Tuplets whose unit is double-dotted (`baseDots` 2).
- A quadruple dot on the palette (the model will already allow it, D1).
- R3 3b (two voices' dots at ONE x) and a `byVoice` row — wait for voices that can stand apart, and for a dot
  that knows its voice (P4d). ⚠️ Found on the way: a SECOND between two voices draws OVERLAPPING heads today.
- A CHORD's ties between its dots (Gould p. 64: *"Ties may start … in between the duration dots, as long as they
  will fit … Otherwise inner ties should start after the dots"*) — not probed (P4g).
- Gerou & Lusk's white after a dot before a tie — UNKNOWN (their figures draw no dot); the row reads 0.
