# Double and triple dots — the plan

> **Status (2026-09-25): PLAN, nothing built.** ⏳ The research is still coming in (three agents: the
> literature, the engines — Verovio · MuseScore · LilyPond — and a web check of the duration rule, which is
> IN, §0.1). When the other two land, §0.2's numbers are filled and this plan is updated — ⛔ a number never
> blocks a phase (`CLAUDE.md`).
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

### 0.2 The engraving numbers — ⏳ PENDING the two agents

What is already on disk (`engine/layout/dotGap.ts`, from `docs/research/accidental-dot-research.md` +
`docs/research/accidental-dot-engines.md`): every sourced row already has a **dot→dot** column, and the
armed `house` row is **0.5 sp head→dot, 0.5 sp dot→dot**, edge to edge. `gouldDrawn` (0.4 / 0.26) is
the one row that draws the dots closer to each other than to the head.

| question | ours today | literature | engines | verdict |
|---|---|---|---|---|
| head → first dot | 0.5 (`house`) | ⏳ | ⏳ | ⏳ |
| dot → dot (2nd, 3rd) | 0.5 (`house`) | ⏳ | ⏳ | ⏳ |
| line note: dot up / down | ⏳ read `dotStack` | ⏳ | ⏳ | ⏳ |
| chord: one dot column; 2- and 1-dotted aligned | ⏳ | ⏳ | ⏳ | ⏳ |
| stem-up flag: dots past the flag | yes (`noteDotXs`) | ⏳ | ⏳ | ⏳ |
| double-dotted RESTS — allowed / discouraged | allowed | ⏳ Gould pp. 160–164 (second-hand, unverified) | ⏳ | ⏳ |
| spacing: room per extra dot | `dotExtent(dots)` grows | ⏳ | ⏳ | ⏳ |

⭐ The single dot is being RE-CHECKED at the same time. ⛔ The aim is not to change the house style — it is to
confirm it is applied correctly, and to note any improvement as a decision for him.

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
| **D1** | **how many dots the model allows** | ⏳ proposed | no fixed cap in the model; a duration takes n dots iff its **last dot's value ≥ the shortest duration** (derived from `DURATION_INFO`). The palette offers 1–3 | MusicXML has no cap, MEI stops at 4; the real limit is what can be written and filled. Today: ×2 on an 8th or longer, ×3 on a quarter or longer — ⛔ written as the rule, never as that list |
| **D2** | **the rest-fill grid** | ⏳ proposed | derived from the shortest duration, not the literal 32nd | the same rule, so a 64th arriving later needs no second edit |
| **D3** | **the automatic choices stay single-dotted** | ⏳ proposed | `LENGTHS_DESC` (`fitRestDuration`, `splitBeatsIntoDurations`) and `restFill`'s `CANDIDATES` keep 0 or 1 dot | `durations.ts` already says why: guessing `h..` for someone is a bigger claim than `h.` |
| **D4** | **a dot count that does not fit the bar** | ⏳ open — his call | (a) refused whole (no change) · (b) the most dots that fit · (c) today's rule, back to 0 | (a) is what a stamp elsewhere does; (b) is what a user pressing `...` probably wants least |
| **D5** | **the palette's behaviour** | ⏳ proposed | three buttons `.` `..` `...`, a RADIO: press n → the selection gets n dots; pressing the count they already all have → 0. In entry → arms `selectedDots = n`. Nothing selected → the dot STAMP armed with n | the cue button's three branches (`stamps/cueTool`), and Sibelius's F7 radio (single / double / triple on the Keypad) |
| **D6** | **the `.` key** | ⏳ proposed | unchanged: toggles a single dot (0 ↔ 1). A double-dotted note + `.` → 0 | the key's meaning today is on/off; the counts live on the palette |
| **D7** | **graces and fans** | ⏸️ later | a grace keeps what it has (`graceOps` already writes `written.dots`); a fan draws no dots (by design) | not part of this feature |

---

## 2. The phases

### P0 — the duration bug (its own commit, before anything else)

`durationToFraction`: the multiplier computed, not tabulated — **(2ⁿ⁺¹ − 1) / 2ⁿ** — so it agrees with
`getDotMultiplier` for any n. Spec in `utils/durations.test.ts`: 0–4 dots, exact fractions, and the float
twin agreeing. ⛔ Nothing else in the commit.

### P1 — the limit, derived

- `utils/durations`: `maxDotsFor(duration)` (name tbd) — the most dots whose last addition is ≥ the
  shortest duration in `DURATION_INFO`. Spec: today's table, and a spec that a shorter duration added to a
  local table raises it (the "durations will grow" guard).
- `utils/restFill`: the grid from the shortest duration, ⛔ not `* 8`.
- The model refuses a count above the limit (`durationChangeOps`), per D4.

### P2 — the dev-shell palette

- **Module** `interactions/stamps/dotCountTool.ts` — `pressDots(host, n)` + `dotsLit(state, engine, n)`,
  the shape of `cueTool`. ⛔ No dot logic added to `PaletteController` / `MouseController`
  (`CLAUDE.md`: a new feature adds a MODULE).
- **One group** in `devToolbar`: `Dots:` with `.` `..` `...` (one line each, calling the module).
- **The stamp:** `{ kind: 'dot' }` gains its count (`{ kind: 'dot'; count: number }`), and its click moves
  OUT of `MouseController` (at its line ceiling) into `stamps/dotStamp.ts`, as the tremolo stamp did. A
  click sets the note's dots to the armed count.
- **Entry:** `selectedDots` becomes 0..n; the ghost already reads it.
- Specs beside each module.

### P3 — the rest of the editor learns the count

- `keypadSync`: the `.` key lit for exactly 1 (D6).
- `SelectionController` already copies `note.dots` into `selectedDots` — check it lights the right button.
- Properties report: the dot count shown (check what `selectionSnapshot` prints today).
- Clipboard / rebar / paste of a double-dotted note: a spec each that the count travels.

### P4 — the engraving check (after §0.2 is filled)

⭐ A SCENE test (`ScoreRenderer.recordScene`) per rule that can be asserted in jsdom, the browser suite for
what needs a glyph's ink: dot→dot steps equal the armed row; a chord's dots in one column; 2- and
1-dotted notes in one chord aligned; a line note's dots all in the same space; a stem-up flagged note's
dots past the flag; a double-dotted rest. Any rule our drawing breaks → a finding for him, ⛔ not a silent
change of the house style.

---

## 3. Later

- The Keypad's "double dot" / "triple dot" keys wired (today pictures).
- Tuplets whose unit is double-dotted (`baseDots` 2).
- A quadruple dot on the palette (the model will already allow it, D1).
