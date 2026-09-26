# Other durations — 64th, 128th, 256th, 512th, breve, longa — the plan

> **Status (2026-09-26): P0 BUILT (glyphs measured) · P1 BUILT (the model) · P2 BUILT (the panel) · P3 BUILT (the short values drawn) · P4 BUILT (the breve and longa drawn).** Decisions a, b (convention), d taken (§1). The
> research: `docs/research/durations-standards.md` (MusicXML · MEI · SMuFL · MIDI · Sibelius · Finale ·
> Dorico), `docs/research/durations-literature.md` (Gould · Ross · Stone · Gerou & Lusk) and
> `docs/research/durations-engines.md` (MuseScore · Verovio · LilyPond, source read) are all IN. ⛔ A number never
> blocks a phase (`CLAUDE.md`): every engraving number below is a ROW with today's best-sourced value.
>
> ⚠️ **The UI is the dev shell's** — a new *Other durations* panel. The Keypad's Grace page already DRAWS
> these six keys (`windows/keypad/keypadLayouts.ts`, `momentary` pictures); wiring them is a later step,
> his call, the same way its other keys were wired (a key presses the panel's function).
>
> ⭐ **Durations will grow** (his words, 2026-09-22 and 2026-09-25): ⛔ no rule here is a list of today's
> values. Every site this plan touches ends up asking what a note HAS — its flag count, its row — so a
> 1024th or a maxima later is one row, not a sweep.

---

## 0. What we have today

### 0.1 The model is ready for more values

`NoteDuration` (`types/duration.ts`) = `'w' | 'h' | 'q' | '8' | '16' | '32'`; `DURATION_INFO`
(`utils/durations.ts`) is the source of truth, a non-`Partial` `Record` — a new member that is not filled
in does not compile. DERIVED from it, for free: `DURATIONS_DESC`, `durationFlags`, `doubleDuration`,
`SHORTEST_LENGTH`, `maxDots`, the rest-fill candidates (`utils/restFill`), `fitRestDuration`,
`splitBeatsIntoDurations` / `splitBeatsIntoLengths`. Timing is exact (`Fraction`) and `TICK_RESOLUTION`
= 16384 per whole (`layout/tickCount`), so a 512th is 32 ticks and a longa 65536. Playback is beat-based.

### 0.2 The TOTAL tables — the compiler will name them

`REST_GLYPHS` (`fonts/fontMetrics`) · `REST_LINE` (`layout/restPlacement`) · `REST_HEIGHT` / `REST_WIDTH`
(`layout/spacingPadding`) · `UNIT_GLYPH` / `MET_NOTE_GLYPH` (`utils/tempoText`) · `NOTE_KEYPAD`
(`menus/tempoMenu`) · `NOTE_DURATION_ROWS` (`engrave/inheritedDefaults` — ⚠️ its key type spells out the six
values by hand; it must be re-keyed on `NoteDuration`).

### 0.3 The SILENT sites — compile fine, answer wrong

| site | today | becomes |
|---|---|---|
| `fonts/fontMetrics.noteheadGlyph` | `if 'w' … if 'h' … else black` — a breve would get a BLACK head | a total `NOTEHEAD_GLYPHS` row per duration |
| `fonts/fontMetrics.flagGlyph` | `if '8' / '16' / '32'` | indexed by `durationFlags(d)` (1 → 8th … 7 → 512th) |
| `rendering/beams/CrossBarBeams.beamCountOf` | `32→3, 16→2, else 1` | `max(1, durationFlags)` |
| `utils/beaming.isBeamableDuration` | `'8' \|\| '16' \|\| '32'` | `durationFlags(d) > 0` |
| `windows/properties/panels/note.canCarryFractionalBeam` | `'16' \|\| '32'` | `durationFlags(d) >= 2` |
| `layout/slotBoundary` | a literal list of six | `Object.keys(DURATION_INFO)` |
| `rendering/engraved/EngravedBeam.VALID_BEAM_DURATIONS` | `['4' … '64']` — 5 levels | 7 levels (to a 512th) |
| `engrave/notes/noteDuration` | ticks for `'1/2'` … `'256'`; no longa, no 512th | + `'1/4'`, `'512'`, aliases `breve`/`longa` |
| `engrave/notes/graceBeam` (line 113) | its own `w/h/q/else Number()` tick sum | `DURATION_INFO` |
| `layout/measureColumns` (line 232) | `duration !== 'w'` = "has a stem" | `NOTE_DURATION_ROWS[d].stem` (a breve has none, a longa HAS one) |
| `restVoicePlacement.attachesToOuterLine` · `RestGhost` · `NoteBuilder` (line 106) | `'w' \|\| 'h'` = a rest hung on a line | a row on the rest (`lineAttached`) — breve + longa join |
| `models/durationChangeOps.findLargestFittingDuration` | its own literal list | `DURATIONS_DESC` |

### 0.4 The glyphs

`scripts/generate-font-metrics.mjs` writes the three `fonts/*Metrics.ts` from a glyph LIST; today only
`noteheadDoubleWhole` of the new ones is in it. To add: `noteheadDoubleWholeSquare`, `flag64thUp/Down` …
`flag512thUp/Down`, `rest64th` … `rest512th`, `restDoubleWhole`, `restLonga`, and the metronome
`metNote64thUp` … / `metNoteDoubleWhole(Square)`. The standards survey: all three fonts carry every one;
⚠️ Leipzig's metadata lacks stem ANCHORS for the 512th (and 1024th) flag — a fallback anchor, recorded.
SMuFL has **no modern longa notehead** — the longa is a breve head + a stem we draw (§2.3).

## 1. Decisions (his, 2026-09-26)

- **a. Names.** Keep `'w' 'h' 'q' '8' '16' '32'` (every saved score stores them; the `'qd'` token parse
  reads them). Add **`'64' '128' '256' '512' 'breve' 'longa'`** — numbers below the quarter, words above
  the whole (a breve has no clean number: `1/2`). What the UI shows and what an export writes are mapping
  tables, free to say anything. 1024th / maxima: out of scope, one row each later.
- **b. Convention: SIBELIUS is the default** — *"this can be the default but if there are other standards
  we can make it configurable for the user"*. Where the standards differ (breve head shape, stem length
  per flag, …) Sibelius's is the default row and the others are selectable rows. ⚠️ This overrides the
  usual Gould default, for this feature.
- **d. Automatic breve/longa: YES where the bar can carry it.** Rest fill and note splitting may write a
  breve / longa wherever the span fits one — which falls out of `DURATIONS_DESC` — and never otherwise.
- **c. The full-bar rest — the CONVENTION by default, and the user's choice** (his, 2026-09-26: *"lets do
  the convention then as default but lets make it also custom for the user"*). The research is unanimous —
  Sibelius (default, can be turned off), Gould p. 160, Ross p. 173, Stone p. 136, Gerou & Lusk p. 113,
  MuseScore, Verovio, LilyPond: a whole-bar rest is drawn as a **breve** rest from 4/2 (= 8/4) up.
  ⭐ So it is a row, `BAR_REST_STYLE`, armed like `__dots`:
  - `'convention'` (**default**) — whole rest below 8 quarters, breve rest from 8 up;
  - `'whole'` — today's: the whole rest in every meter;
  - `'lilypond'` — as `'convention'`, plus a longa rest from 16 quarters.
  ⚠️ The MODEL does not change: a bar rest stays the nominal `'w'` + `isMeasureRest` (every saved score,
  rest fill's `restFill.ts:99`, `barRestOps`). Only which GLYPH is drawn — and where it hangs, and how
  wide it is for spacing — is chosen from the bar's length and the row. An empty bar, a cleared bar and a
  stamped bar rest all follow it alike (d's automatic breves are real `'breve'` slots — a different thing).

## 2. The rules each new value needs

### 2.1 The short values (64th … 512th)

- **Flags:** SMuFL's own flag glyph per count (the font's, ⛔ never stacked 8th flags).
- **Beams:** one per flag, ½ sp thick, ¼ sp apart (Gould p. 19). With 4+ beams inside the staff Gould
  spreads them to ≈ 0.9 sp pitch so each touches a line (p. 18) — a later row, not P3.
- **Stem length grows with the flag / beam count.** Today: `stemBeamExtension` 7.5 px for a 32nd
  (`NOTE_DURATION_ROWS`). Sources: Ross p. 127 +1 sp per flag past two; Gould p. 16 up-stems 3.5 / 3.6 /
  4.3 / 4.8 sp (8th → 64th), p. 19 beamed 3¾ / 4½ sp (3 / 4 beams, note in a space). The books stop at
  the 64th — past it, SMuFL's per-flag stem extensions. Engines DISAGREE: unbeamed, MuseScore adds the
  font's extension (≈ +0.75 sp per flag in Bravura), LilyPond a table 5 / 6 / 7 / 8 sp (64th → 512th),
  Verovio none; beamed (4–7 beams) MuseScore 4.25 → 6.5 sp, LilyPond ≈ 4.1 → 6.7, Verovio 5.0 → 8.5.
  ⭐ One row per duration, default = Sibelius's where known (UNKNOWN today — MuseScore's until then),
  the others selectable. Beam pitch: 0.75 sp (MuseScore, Verovio; Gould's ½ + ¼) vs LilyPond ≈ 0.81.
- **Rests:** the font's glyph; one hook per halving, each in its own space (Gould p. 35) — the glyph
  already does this. Vertical placement: today's `MIDDLE_LINE` row, checked against the measured 64th
  (≈ 0.9 sp below the staff) in the browser.
- **Dots:** `maxDots` stays derived — a 512th takes none; a 256th one; and so on up.

### 2.2 The breve

- **Head:** a house-style row — round with two lines (`noteheadDoubleWhole`), round with one line, or
  square (`noteheadDoubleWholeSquare`); Gould p. 10 gives all three as equal. Default = Sibelius's
  (UNKNOWN — MuseScore + LilyPond default ROUND, Verovio SQUARE; `noteheadDoubleWhole` until checked).
- **No stem, no flag, no beam.** Rest: `restDoubleWhole`, filling the space between the middle line and
  the second line from the top (Gould p. 35, Ross p. 177) — hangs on a line like the whole rest.

### 2.3 The longa

- **The STEM is part of the note** — it is what tells a longa from a breve (every source: MuseScore
  `hasStem()` true for a longa only, Verovio, LilyPond, SMuFL's mensural longas, Sibelius's icon). ⚠️ The
  Keypad's stem DOWN is only its picture: its DIRECTION is the open question, not its presence.
- **Shape — the engines give THREE:** MuseScore = breve head + an ordinary stem, up or down by the normal
  stem rule, right when up / left when down (like a half note); LilyPond = the same rule, baked into one
  glyph, 3 sp past the head; Verovio = square body, stem ALWAYS on the RIGHT (the mensural shape), 3.5 sp.
  No treatise covers it (UNKNOWN); Sibelius's own behaviour UNKNOWN.
- ⭐ **DECIDED (his, 2026-09-26): VEROVIO's shape is the default, the other is the user's choice.**
  Row `LONGA_STEM_SIDE`:
  - `'right'` (**default**, Verovio / mensural) — UP or DOWN by the normal stem rule (pitch), but the stem
    ALWAYS stands on the head's RIGHT side, down included;
  - `'normal'` (MuseScore, LilyPond) — like a half note: right when up, left when down.
  Direction is the existing stem rule in both (`NOTE_DURATION_ROWS.longa.stem = true`); only the SIDE a
  down-stem stands on differs — ⛔ no longa-specific direction logic. Head (round/square) and length stay
  rows; length default = 3½ sp (Verovio's, and our normal stem). ⚠️ The breve glyph has no stem anchor
  and its bars stick out past the head, so WHERE the stem meets it is checked in the browser at P4.
- **Rest:** `restLonga`, filling two spaces (Ross p. 177).

### 2.4 Spacing

The spacing law is a function of time (`layout/spacing`, 3.5 × √t) — no table to extend. Gould's p. 39
table stops at the 16th and the whole. The reference `shortest` (the census, `shortest-duration-plan.md`)
may now go down to a 512th: a dense 256th passage widens, by the law. The INK rows (`REST_WIDTH`, …) come
from the font metrics.

## 3. The phases

⭐ ONE STEP AT A TIME; each phase ends with his UI check where there is something to see.

- **P0 — glyphs.** Add the §0.4 glyphs to `generate-font-metrics.mjs`, regenerate the three metrics files.
  No behaviour change (nothing asks for them yet).
- **P1 — the model.** Widen `NoteDuration`; `DURATION_INFO` rows; `noteDuration` ticks + aliases; fill
  every TOTAL table (§0.2) with sourced / provisional rows; re-key `NOTE_DURATION_ROWS` on `NoteDuration`.
  Specs: `maxDots` per value; rest fill + note split in **4/2, 8/4, 4/1** write breves / longas where they
  fit (d); **4/4, 3/4, 6/8, 7/8 fills UNCHANGED** (a before/after table); an empty bar is still the
  nominal-`'w'` measure rest in every meter (c). ⚠️ The finer grid (512th) makes a dotted 32nd rest a fill
  candidate — pinned by the unchanged-fills spec.
- **P2 — the panel.** `dev/otherDurationsPanel.ts` — a group `Other:` of six buttons, each
  `palette.setDuration(d)`, lit by `durationHighlight(state) === d` (the Duration group's exact recipe),
  mounted from `devToolbar` by ONE line (⛔ not a slice: `lint:hubs`). From here he can ENTER each value;
  what is drawn is P3/P4's.
- **P3 — the short values drawn.** The §0.3 silent sites turned into rules (flags, beam counts, beamable,
  fractional beam, `VALID_BEAM_DURATIONS`, `slotBoundary`, `graceBeam`); stem extension rows (§2.1); rests.
  Scene specs (jsdom-safe: counts — beams per note, flag glyph name); an e2e for stem length + rest
  position. **His UI check.**
  ✅ **Measured in Chromium (P3, `e2e/shortValues.e2e.ts`)** — today's defaults, from the font's own
  flag heights (unbeamed) and the P1 rows (beamed):

  | | unbeamed stem | beamed stem (≈) | rest foot below the staff |
  |---|---|---|---|
  | 32nd | 3.6 sp | — | 0.0 sp |
  | 64th | 4.4 | 4.5 | 1.0 (Gould ≈ 0.9) |
  | 128th | 5.1 | 5.0 | 1.0 |
  | 256th | 5.8 | 5.7 | 2.0 |
  | 512th | 6.6 | 6.7 | 2.0 |

  The innermost beam stands 1.24 sp above the head at every count. Beamed: LilyPond ≈ 4.1 → 6.7,
  MuseScore 4.25 → 6.5 — ours sits between. Unbeamed: shorter than LilyPond's 5 / 6 / 7 / 8 and
  Gould's 4.8 for a 64th — a ROW for the house-style menu, ⛔ not changed here.
- **P4 — the breve and the longa drawn.** `NOTEHEAD_GLYPHS` row table; the breve head as a style row;
  the BAR REST's glyph from the bar's length + `BAR_REST_STYLE` (§1 c) — ONE function asked by the drawing
  (`NoteBuilder`'s measure rest), the placement (`restVoicePlacement`) and the ink rows alike, ⛔ never a
  second `'w'` assumed anywhere; a dev console `__barRest.style(…)`;
  the longa's stem (§2.3); `lineAttached` rest row; the stem question in `measureColumns`. E2e: head ink,
  rest in its space. **His UI check.**
  ✅ **Built as (P4):** three rows, each with a console setter `__durations.…` — `fonts/longHeads` (breve
  ROUND, longa SQUARE by default), `layout/longaStem` (`'right'` default | `'normal'`), `layout/barRestStyle`
  (`'convention'` default | `'whole'` | `'lilypond'`) — all in `widthRowGenerations`. The bar rest's glyph is
  ONE answer, `restVoicePlacement.restDrawnDuration`, asked by `NoteBuilder`, the placement and
  `measureColumns`. `restPlacement.restHangsOnLine` (a half and longer) replaced three `'w' || 'h'`s.
  Measured in Chromium (`e2e/longValues.e2e.ts`): a longa's stem 3.5 sp, on the right edge (0.04 sp) by
  default and the left (0.07 sp) under `'normal'`; the 4/2 bar rest's ink exactly fills the space
  between the middle and fourth lines.
  ⚠️ **+ the two-voice collision rule** (`engrave/notes/voiceStack.ts`, ported from VexFlow): when one of
  two colliding notes has no stem, it moves the one whose duration CODE sorts first AS TEXT. With the
  old values only a whole note was stemless, and every code sorts before `'w'`, so the whole note always
  stayed — correct. The breve's `'1/2'` and longa's `'1/4'` sort FIRST, so a breve (or a longa against
  a whole) would be the one moved. Fix: compare the notes' LENGTHS (the shorter moves; equal → the lower,
  as now) — identical to today for every pair the old values could make, so no existing ink moves.
- **P5 — the surfaces around.** Tempo / metronome units (`UNIT_GLYPH`, `MET_NOTE_GLYPH`, the aliases) —
  ⚠️ `NOTE_KEYPAD` is Ctrl+Num 1–6 and has no key for the new values: it stops being a total `Record`
  (a list of the bound ones, `lint:tables` is fine with an ORDER list); `durationChangeOps`' literal list;
  the Properties note panel's duration display; playback of a 512th at a fast tempo (a note of a few ms —
  check the scheduler takes it).
- **P6 — sweep.** `grep` for any remaining literal duration list; `audit:tests`; docs (`CLAUDE.md`'s
  "Duration values" line, ARCHITECTURE glossary).

## 3b. Found while building (reported — ⛔ not fixed inside a phase)

- **P2 — the METER stopped at the 32nd** (`utils/meter.ts`, a literal `SMALLEST`): a rest fill below it
  saw no beat boundaries and wrote a dotted 64th rest after a 128th, where 4/4 writes plain ones.
  FIXED in P2 — derived from `SHORTEST_LENGTH`; the 16× more boundaries made every fill 7–10× slower,
  so `getMeterInfo` is memoised (frozen) and `restFill` asks an index — now FASTER than before P1.
  All 23 000 fills of the probe on the 32nd grid are unchanged.
- **P2 — ⚠️ NOTE ENTRY across MORE THAN ONE barline was wrong, and was before P1.** ✅ FIXED after P4 (his
  call, 2026-09-26), in `models/spanningNoteOps.placeSpanningNote` — the one primitive behind entry AND a
  duration change. It put the WHOLE overflow into the NEXT bar however long it was: a whole note from beat 1
  of 2/4 wrote a dotted half into a 2-beat bar, a longa in 4/4 a dotted breve. It now walks bar by bar, each
  bar taking what its OWN capacity holds (a meter change, a pickup), clearing what the chain covers in its
  voice in every bar, the chain tied throughout — a longa in 4/4 is four tied wholes. One barline: exactly
  as before. Specs in `spanningNoteOps.test.ts` (7 fail on the old code).
  ⚠️ **Corrected diagnosis:** the P2 probe also reported a breve at beat 0 of 4/4 "clipped to a whole" and a
  half in 1/4 "refused" — both were the PROBE's doing (a second entry inside the first one's tail overwrote
  it; a beat 1 in a 1-beat bar is not a beat). Left over, ⛔ not fixed: `addNoteAtBeat` called with a beat
  PAST the bar's end evicts before it refuses, so it trips the undo invariant — an API misuse no click makes.

## 4. Later (his call — ⛔ not a queue)

- Wire the Keypad Grace page's six keys to the panel's function.
- A real UI for the bar-rest style (and the breve head, the longa's stem) — a house-style window.
- Beam pitch spread with 4+ beams inside the staff (Gould p. 18).
- Tuplet / feathered-beam windows' unit lists (`tupletWindow`, `featherWindow`).
- 1024th, maxima — one row each.
- MusicXML / MIDI export: `long` is MusicXML's longa; a 512th needs PPQ divisible by 128 (480 is not).
