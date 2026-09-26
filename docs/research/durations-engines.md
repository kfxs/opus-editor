# The six new note values — 64th, 128th, 256th, 512th, BREVE, LONGA: what the engines do

> **2026-09-26.** One agent, for the planned widening of `NoteDuration` (`src/types/duration.ts`, the table in
> `src/utils/durations.ts`) from `w h q 8 16 32` to six more values. **Engines only** — MuseScore, Verovio,
> LilyPond, source READ on disk at `~/dev/engine-sources` (none is installed, nothing was rendered). No web
> source was needed. The treatises are **not** in this document: what Gould / Ross / Stone say about breves,
> longas and 64th+ stems is **UNKNOWN here** (a separate books pass, if wanted).
>
> Snapshots read: MuseScore `929d1e9`, Verovio `efff0bc`, LilyPond `beedbfa` (2.27.3), all 2026-08-18.
> Font facts come from the metadata the engines ship: `MuseScore/fonts/bravura/bravura_metadata.json`
> (Bravura, SMuFL) and `verovio/data/{Leipzig,Bravura}.xml` (Verovio's own bbox tables; 1 em = 1000 units =
> 4 sp, so **250 units = 1 sp**).
>
> All distances in staff spaces (sp) unless a source's own unit is named. MuseScore counts stems in
> **quarter-spaces** (qs); Verovio in **units** (½ sp) and **half-units** (¼ sp); LilyPond in sp (its
> `Stem` code in **half-spaces**).
>
> ⛔ This document proposes nothing and names no file of ours to edit. §4 lists what matters, and where the
> engines disagree it lists the options, not a pick.

---

## 0. Synthesis

### 0.1 What all three agree on

- **Exact rational time.** Every engine counts a value as an exact fraction of a whole note; dots multiply
  by (2 − 1/2ⁿ). None stores a float. (MuseScore `dom/durationtype.cpp:115-160`, `:357-400`; Verovio
  `src/fraction.cpp:35-43`, `src/durationinterface.cpp:75-93`; LilyPond `lily/duration.cc` `operator Rational`.)
- **The range reaches past ours at both ends.** Shortest: MuseScore 1024th, Verovio 2048th (enum; 1024th is
  the last with a flag/rest glyph), LilyPond any power of two (glyphs to 1024th). Longest: MuseScore longa,
  Verovio and LilyPond maxima.
- **A flag per value, SMuFL-named or equivalent**: 64th = 4 flags / 4 beams, 128th = 5, 256th = 6,
  512th = 7 (1024th = 8). Flag glyphs `flag64thUp` … `flag512thDown` (SMuFL E246–E24D), Feta `flags.u6`…`u9`
  / `d6`…`d9` in LilyPond.
- **Rest glyphs** `rest64th` … `rest512th`, `restDoubleWhole`, `restLonga` (SMuFL E4E9–E4EC, E4E2, E4E1);
  Feta `rests.6`…`9`, `rests.M1`, `rests.M2`.
- **Where a breve rest sits**: on the **middle line**, filling the space above it up to the 4th line (the
  SMuFL glyph's box is y 0…1 sp). A longa rest is centred on the middle line (box −1…+1 sp, 2nd to 4th line).
- **A whole-bar rest in a long bar becomes a BREVE rest.** MuseScore and Verovio switch at **bar length ≥ a
  breve (2 wholes)**; LilyPond switches when the bar is **≥ 2 wholes** too (its default picks the longest
  usable value that does not exceed the bar) — and goes on to a longa rest at ≥ 4 wholes and a maxima rest
  at ≥ 8 (multi-measure rests only).
- **Stems grow for 64th+.** All three lengthen a stem as beams/flags are added — but by different rules
  (§0.2 row "stem").
- **The longa is a breve body with a stem**, stem direction following the normal stem rule, not a fixed
  side.

### 0.2 Where they disagree

| question | MuseScore | Verovio | LilyPond |
|---|---|---|---|
| **breve head, default** | ROUND, `noteheadDoubleWhole` (with side bars) | SQUARE, `noteheadDoubleWholeSquare` | ROUND, `noteheads.sM1` (ellipse, one bar each side) |
| breve head, alternative | head group "Alt. brevis" → `noteheadDoubleWholeSquare` | `@head.mod="fences"` → `noteheadDoubleWhole` | style `altdefault` → `sM1double` (two bars each side); `baroque`/`neomensural` → square |
| **longa drawing** | the breve glyph + an ordinary `Stem` (3.5 sp rules) on the right if up, left if down | a hand-drawn square body, stem **always on the RIGHT**, up or down, 3.5 sp from the note's centre | ONE glyph with the stem baked in (`uM2` / `dM2`): up = right bar extended, down = **left** bar extended, 3 sp past the head |
| **flagged stem, 64th+** | 3.5 sp + the flag's SMuFL `stemUpNW`/`stemDownSW` **anchor** (Bravura: +1.17 / +1.90 / +2.59 / +3.32 sp for 64th…512th) | 3.5 sp, **no** per-flag extension (anchor code commented out); the flag glyph itself overhangs the stem end (Leipzig 64th: +1.52 sp) | a TABLE: 3.5 · 3.5 · 3.5 · **4.25 · 5.0 · 6.0 · 7.0 · 8.0 · 9.0** (quarter … 1024th) |
| **beamed stem, 4–7 beams** | 3.5 sp, +0.5 at 3 beams, then +0.75 per beam over 3: 4.25 · 5.0 · 5.75 · 6.5 (4…7 beams) | a TABLE, +1 sp per beam from 32nd: 64th 5.5 / 5.0 · 128th 6.5 / 6.0 · 256th 7.5 / 7.0 · 512th 8.5 / 8.0 (odd/even variant) | ideal = max(3.6 sp − ½ beam, 1.25 free + beams' height): ≈ 4.1 · 5.0 · 5.9 · 6.7 (4…7 beams) |
| **beam pitch** (centre to centre) | 0.75 sp, constant (1.0 with "wide beams") | 0.75 sp; **0.83 sp when the group's shortest value is exactly a 64th** | ≈ 0.81 sp for < 4 beams, ≈ 0.87 sp for ≥ 4 (4 beams span 3 spaces) |
| **spacing law** | 3.5 sp × 1.5^log₂(d/♩) — one power law, no table | ∝ d^0.6 (×1.52 per doubling); optional mode squeezes a breve/longa to a whole's room | (2 + log₂(d/shortest)) × 1.2 sp, **linear** below the shortest |
| **auto-generated breve/longa** | YES — rest-fill and tie-splits may use V_LONG/V_BREVE, up to 4 dots | NO — a renderer; the encoding supplies every value | YES — completion engravers may emit any power of two ≥ … but anything shorter than a 64th is written as a **scaled 64th** |
| **dots limit** | 4, fewer below 128th (1024th: 0) | per MEI (see `multiple-dots-research.md`) | none |
| **MIDI resolution** | 480/♩ (256th = 7.5 ticks, not exact; positions stay `Fraction`) | 120/♩ (64th = 7.5, not exact) | 384/♩ (1024th = 1.5, truncated) |

---

## 1. MuseScore

### 1.1 Duration model

- `enum class DurationType : signed char { V_LONG, V_BREVE, V_WHOLE, V_HALF, V_QUARTER, V_EIGHTH, V_16TH,
  V_32ND, V_64TH, V_128TH, V_256TH, V_512TH, V_1024TH, V_ZERO, V_MEASURE, V_INVALID }` —
  `src/engraving/types/types.h:429-433`. **Longest: longa (4/1). Shortest: 1024th.** No maxima.
- Value → exact `Fraction` of a whole: `TDuration::fraction()` — longa `4/1`, breve `2/1`, … `1/1024`,
  dots as `(2^(n+1)−1)/2^n` (`dom/durationtype.cpp:357-400`; also `:115-160`).
- **Ticks**: `Constants::DIVISION = 480` per quarter (`types/constants.h:105`). Positions and lengths are
  stored as `Fraction` (`dom/segment.h:364-365`); `Fraction::ticks()` ROUNDS to 480/♩
  (`types/fraction.h:234-246`). ⚠️ So 256th (7.5), 512th (3.75), 1024th (1.875) are **not** whole ticks —
  exact in the model, rounded wherever integer ticks are asked for (e.g. `populateRhythmicList` compares
  `rtick.ticks()`, `dom/durationtype.cpp:553-555`).
- **Dots**: `MAX_DOTS = 4` (`dom/note.h:53`). `shiftType` refuses a dotted 1024th, a 2-dot 512th, a 3-dot
  256th and a 4-dot 128th (`dom/durationtype.cpp:272-276`) — i.e. no value whose last dot would be shorter
  than a 1024th.
- `V_MEASURE` is a separate value — the whole-bar rest (see 1.4).

### 1.2 Noteheads

- `headType()`: breve → `HEAD_BREVIS`, **longa → `HEAD_BREVIS` too** (`dom/durationtype.cpp:164-199`).
- The glyph table `noteHeads[dir][group][type]` (`dom/note.cpp:89-130`): group NORMAL, type BREVIS →
  **`noteheadDoubleWhole`** (the round one with side bars). The square **`noteheadDoubleWholeSquare`** is
  the head group `HEAD_BREVIS_ALT`, UI name *"Alt. brevis"* (`types/typesconv.cpp:1195`; table row
  `dom/note.cpp:123-125`). So: **round by default, square as a per-note head-group option.**
- **Longa** = breve head + an ordinary stem: `hasStem()` is true for `V_LONG` (and false for breve and
  whole) — `dom/durationtype.cpp:222-240`. No longa-specific code in stem or chord layout (the only other
  `V_LONG` in `rendering/` is a grace-after factor, `chordlayout.cpp:646`). Stem direction: the normal
  chord rule. Stem x: `noteheadDoubleWhole` has no SMuFL stem anchor in Bravura, so the fallback applies —
  right edge of the head if up, left edge (0) if down (`rendering/score/stemlayout.cpp`, `stemPosX`:
  `if (stemAttach.isNull()) return up ? noteHeadWidth() : 0.0`). Length: the normal 3.5 sp rules.
- Bravura sizes (metadata): `noteheadDoubleWhole` 2.396 × 1.24 sp, `noteheadOrigin` x 0.36 (the side bar
  sits LEFT of the origin); `noteheadDoubleWholeSquare` 1.664 × 1.552 sp; `noteheadWhole` 1.688 × 1.0 sp.

### 1.3 Stems, flags, beams

- **Flags**: `TDuration::hooks()` = 4, 5, 6, 7 (8) for 64th…512th (1024th) (`dom/durationtype.cpp:205-217`);
  glyphs `flag64thUp`…`flag1024thDown`, or the `…Straight` set when `useStraightNoteFlags`
  (`dom/hook.cpp:57-95`).
- **Flagged stem length** — ⭐ the FONT decides the extra: `layoutStem` adds the flag's SMuFL anchor to the
  stem end, `if (hook && !beam) y2 += hook->smuflAnchor().y()` (`rendering/score/tlayout.cpp:5376-5381`),
  anchor = `stemUpNW` / `stemDownSW` (`dom/hook.cpp:52-55`). No per-flag table:
  `stemLengthBeamAddition` returns 0 when there is a hook (`stemlayout.cpp:326-330`). Base
  `Sid::stemLength` = 3.5 (`style/styledef.cpp:258`).
  Bravura anchors (metadata), up: 8th −0.04, 16th −0.088, 32nd **+0.376**, 64th **+1.172**, 128th **+1.90**,
  256th **+2.592**, 512th **+3.324**, 1024th +4.064 sp; down: 64th −1.244, 512th −3.608. ⇒ roughly
  **+0.7–0.8 sp per flag from the 32nd on**, supplied by the font.
- **Beamed stem length** (all in qs; `stemlayout.cpp:42-160`, `:326-345`, `:415-490`):
  - default 14 qs (3.5 sp) + `stemLengthBeamAddition`: 0 for 1–2 beams, **+2 for 3**, **+(n−3)×3 for n ≥ 4**
    (×4 with wide beams). ⇒ 4 beams 4.25 sp, 5 → 5.0, 6 → 5.75, 7 → 6.5, 8 → 7.25.
  - minimum: inner stem `{10, 9, 8, 7}[min(n,3)]` + beams' height `n×3 − 1`, +1 for n ≥ 4 when the note is
    inside the staff (`:474-488`).
  - `minStaffOverlap`: for n ≥ 4 beams the beam must overlap the staff by `(n−4)×3 + 14` qs
    (`:162-178`); `calc4BeamsException` for exactly 4 beams outside the staff: ≥ 21 or 23 qs (`:493-512`).
  - shortening table `maxReductions[beams][extension]` stops at 3 beams; **≥ 4 beams are never shortened**
    (`:353-368`).
- **Beam geometry**: `beamWidth` 0.5 sp (`styledef.cpp:296`), beam spacing 3 qs = **0.75 sp** per level, 4 qs
  with `useWideBeams` (`beamlayout.cpp:331`) — constant however many beams.

### 1.4 Rests

- Glyphs: `Rest::getSymbol` — longa `restLonga`; breve `restDoubleWhole` (or `restDoubleWholeLegerLine` off
  the staff); 64th…1024th `rest64th`…`rest1024th` (`dom/rest.cpp:250-300`).
- **Whole-bar rest**: `V_MEASURE` draws **`restDoubleWhole` when the rest's ticks ≥ 2/1**, else the whole rest
  (`dom/rest.cpp:255-259`); `isBreveRest()` = breve, or a measure rest in a measure with `ticks() >= 2/1`
  (`:375-380`). ⇒ threshold **bar ≥ a breve**: 4/2, 8/4, 2/1 yes; 3/2, 6/4, 7/4 no. No longa for a
  bar rest.
- **Vertical**: every rest starts on `computeNaturalLine` = the middle line of a 5-line staff
  (`rendering/score/restlayout.cpp:690-694`), then a voice offset; only the WHOLE rest moves up a line
  (`computeWholeOrBreveRestOffset`, `:768-782`; the breve moves only on a 1-line staff). Where the ink lands
  is the glyph's box: Bravura `restDoubleWhole` y 0…1 sp (middle line → 4th line), `restLonga` −0.996…1.0,
  `rest64th` −3.012…1.72, `rest128th` −3.0…2.756, `rest256th` −4.0…2.784, `rest512th` −4.0…3.776.
- **Dot line** for rests: 32nd/64th → line −3, 128th…1024th → line −5, whole/measure → +1, others −1
  (`dom/rest.cpp:343-366`) — i.e. the dot climbs as the rest glyph grows upward.

### 1.5 Spacing

- One law for every value, no duration table: `durationStretchForTicks = pow(measureSpacing,
  log2(ticks / (1/4)))` (`rendering/score/horizontalspacing.cpp:809-816`), `measureSpacing` default **1.5**
  (`styledef.cpp:270`), × `DEFAULT_QUARTER_NOTE_SPACE = 3.5 sp` (`horizontalspacing.cpp:744-747`).
  ⇒ 64th 0.69 sp · 128th 0.46 · 256th 0.31 · 512th 0.20 · whole 7.9 · **breve 11.8 · longa 17.7**.
- Short values are then held apart by SHAPES: `minHorizontalDistance` with an absolute minimum padding of
  0.1 sp (`:1221-1224`), `minNoteDistance` 0.35 sp (`styledef.cpp:264`). So at 64th and below the ink,
  not the law, sets the width.

### 1.6 Auto rest-fill / tie-splitting

- `TDuration(const Fraction&, truncate, maxDots = 4, maxType = V_LONG)` — "longest TDuration that fits"
  (`dom/durationtype.h:42`, `.cpp:406-416`); `toDurationList` greedily peels those off
  (`.cpp:484-503`). ⇒ **a breve or longa, dotted up to 4 times, can be generated** wherever a gap is filled
  or a note is split, if it fits and no beat rule forces a split.
- `toRhythmicDurationList` (`.cpp:511-540`): a rest that fills its whole bar becomes `V_MEASURE` (so the
  bar rest of 1.4, never a written breve); otherwise `populateRhythmicList` splits at the strongest
  (sub)beat crossed, and **keeps a single value if one fits exactly** (`.cpp:596-602`) — which in 4/2 or 8/4
  can be a breve. No rule specific to dotted breves was found.

### 1.7 Input / UI

- Actions `note-longa`, `note-breve`, `pad-note-1` … `pad-note-1024`
  (`notationscene/internal/notationuiactions.cpp:2267-2355`, map `:3071-3086`).
- Default keys: **9 = longa, 8 = breve, 7 = whole, 6 = half, 5 = quarter, 4 = 8th, 3 = 16th, 2 = 32nd,
  1 = 64th** (also Num+n) — `app/configs/data/shortcuts.xml:666-708`. **128th…1024th have no default key.**
- Note-input toolbar default: 64th…whole shown; 128th, 256th, 512th, 1024th, breve, longa **present but
  hidden** (`notationuiactions.cpp:3176-3190`).

### 1.8 Playback

Nothing value-specific found: playback reads the chord's `Fraction` length. The only wrinkle is 1.1's
tick rounding for 256th and shorter.

---

## 2. Verovio

### 2.1 Duration model

- `enum data_DURATION { DURATION_NONE = −2, DURATION_maxima, DURATION_long (0), DURATION_breve,
  DURATION_1, DURATION_2, DURATION_4, …, DURATION_1024, DURATION_2048, DURATION_longa = 100, … }` —
  `libmei/addons/attdef.h:84-108` (the ≥ 100 block is MENSURAL). **Longest CMN: maxima. Shortest: 2048th
  (enum); 1024th is the last with flag and rest glyphs** (`src/elementpart.cpp:84-112`, `src/rest.cpp:260-320`).
- Value → `Fraction(8, 2^(d+1))` whole notes, clamped to maxima…2048 (`src/fraction.cpp:35-43`): long = 4,
  breve = 2, whole = 1. Dots: `duration × 2 − duration/2ⁿ` (`src/durationinterface.cpp:75-93`).
- Input is MEI `@dur` — `"maxima"`, `"long"`, `"breve"`, `"1"`, `"2"`, …, `"1024"`, `"2048"`.

### 2.2 Noteheads

- `Note::GetNoteheadGlyph`: **breve → `SMUFL_E0A1_noteheadDoubleWholeSquare`** (`src/note.cpp:734`);
  `@head.mod="fences"` → `SMUFL_E0A0_noteheadDoubleWhole` (`:720-722`). ⇒ **square by default, round as
  an encoding option** — the opposite of MuseScore and LilyPond.
- **Longa (and maxima)**: `drawingDur < DURATION_breve` → `DrawMaximaToBrevis` (`src/view_element.cpp:1558-1560`),
  a HAND-DRAWN shape, not a glyph (`src/view_mensural.cpp:210-280`): a square body 1 sp tall
  (`CalcBrevisPoints`, `:± 1 unit`), left side a serif, and the **right side a stem** — shape
  `LIGATURE_STEM_RIGHT_UP` or `…_RIGHT_DOWN` from the CMN stem direction (`:228-240`). Stem reach = **7 units
  = 3.5 sp from the note's centre** (`CalcBrevisPoints`, `stem *= 7`). So the longa's stem is **always on
  the right**, up or down.

### 2.3 Stems, flags, beams

- **Flags**: `m_drawingNbFlags = dur − DURATION_4` → 64th 4 … 512th 7 (`src/calcstemfunctor.cpp:417-427`);
  glyphs E246…E24F (`src/elementpart.cpp:84-112`).
- **Flagged stem**: base `STANDARD_STEMLENGTH = 7` units = 3.5 sp (`include/vrv/vrvdef.h:753`,
  `src/note.cpp:570-605`), shortened near the staff edge but, when flagged and unbeamed, by at most 4 (up)
  / 3 (down) third-units. ⚠️ **No extension per flag**: the anchor read is commented out —
  `// Commented since this is crashing` (`calcstemfunctor.cpp:448-461`), so `flagHeight = 0`. The flag
  glyph is placed at the stem end (`flag->SetDrawingYRel(-stemLen)`, `:431-433`) and its own outline
  overhangs: Leipzig `flag64thUp` y −779…+380 units ⇒ **+1.52 sp beyond the stem end**, 512th +950 units
  = +3.8 sp (`data/Leipzig.xml:314, :372`). Both Leipzig and Bravura outlines carry a vertical left edge
  at x ≈ 0 over their height (`data/Leipzig/E246.xml`, `data/Bravura/E246.xml`), which reads as the
  stem continuing.
- **Beamed stem**: a per-duration TABLE in half-units (¼ sp), `BeamElementCoord::CalculateStemLength`
  (`src/beam.cpp:1917-1957`):

  | value | odd (on a space / sloped) | even |
  |---|---|---|
  | 16th | 14 = 3.5 sp | 13 = 3.25 |
  | 32nd | 18 = 4.5 | 16 = 4.0 |
  | **64th** | **22 = 5.5** | **20 = 5.0** |
  | **128th** | **26 = 6.5** | **24 = 6.0** |
  | **256th** | **30 = 7.5** | **28 = 7.0** |
  | **512th** | **34 = 8.5** | **32 = 8.0** |
  | 1024th | 38 = 9.5 | 36 = 9.0 |

  ⇒ **+1 sp per added beam from the 32nd on.**
- **Beam pitch**: black = 1 unit (0.5 sp), white = ½ unit (0.25 sp) (`src/doc.cpp:2395-2396`) ⇒ 0.75 sp.
  ⚠️ When the group's shortest value is **exactly** a 64th, white × 4/3 ⇒ **0.83 sp** (`src/beam.cpp:594-599`);
  128th and shorter go back to 0.75. (No comment explains it.)

### 2.4 Rests

- Glyphs (`src/rest.cpp:260-320`): long `restLonga`, breve `restDoubleWhole`, … `rest64th` … `rest1024th`.
  Breve rests off the staff get two ledger lines (`view_element.cpp:1702-1714`).
- **Default loc** (`src/calcalignmentpitchposfunctor.cpp:178-186`): `staff lines − 1` = 4 = the **middle
  line**; the whole rest +2 (one line up); the breve −2 only on a < 2-line staff. Multi-layer offsets come
  from the `g_defaultRests` table, which is clamped to long…128th (`src/rest.cpp:603-615`) — so 256th+ use
  the 128th's rows.
- **Whole-bar rest (`mRest`)**: `isDouble = measure time ≥ Fraction(2)` → `restDoubleWhole`, drawn one space
  lower than the whole rest's line, i.e. on the middle line (`src/view_element.cpp:1243-1249`). Same
  threshold as MuseScore: **bar ≥ a breve**. No longa bar rest.

### 2.5 Spacing

- `HorizontalSpaceForDuration = (t × 1024)^spacingNonLinear × spacingLinear × 10`, defaults **0.6** and
  **0.25** (`src/horizontalaligner.cpp:759-768`, `src/options.cpp:1509-1513`). ⇒ ×2^0.6 = ×1.52 per
  doubling; relative to a quarter: 64th 0.44 · 128th 0.29 · 512th 0.13 · breve 3.48 · longa 5.28.
- ⭐ Option `spacingDurDetection` (default **false**, `options.cpp:1504-1506`): finds the longest value in
  the page and, if longer than a whole, divides every interval by 2^(whole − longest) so the **longest value
  gets a whole note's room** (`horizontalaligner.cpp:763-765`, `src/page.cpp:348-364`). A device aimed at
  breve/longa-heavy music (chant, early music).

### 2.6 Auto rest-fill / splitting

None — Verovio renders an encoding and generates no values. MusicXML import turns a `<rest measure="yes">`
(or a typeless rest) into an `mRest` (`src/iomusxml.cpp:3047-3060`). No rest-fill pass was found (grep for
fill/gap terms in `src/`).

### 2.7 Input

MEI `@dur` strings (2.1). Humdrum/ABC/PAE importers map their own syntaxes onto the same enum (not read).

### 2.8 Playback / MIDI

`MidiFile` default `m_ticksPerQuarterNote = 120` (`include/midi/MidiFile.h:280`); event ticks are
`time × TPQ` cast to int (`src/midifunctor.cpp:789`). ⇒ 64th = 7.5 ticks, 128th = 3.75 — **not exact**.
(Whether Verovio raises the TPQ elsewhere: not found.)

---

## 3. LilyPond

### 3.1 Duration model

- `Duration { int durlog_; int dots_; Rational factor_; }` (`lily/include/duration.hh:58-61`); value =
  2^−durlog with dots, × factor (`lily/duration.cc`, `operator Rational`). **durlog −1 = breve, −2 = longa,
  −3 = maxima**: `breve = #(ly:make-duration -1 0)`, `longa = …-2…`, `maxima = …-3…`
  (`ly/declarations-init.ly:26-28`).
- Parser: **any power of two** is a duration (`t > 0 && (t & (t-1)) == 0`, `lily/parser.yy:4728-4732`),
  any number of dots. Glyphs stop at 1024th (flags `u10`/`d10`, `mf/feta-flags.mf:1098`; rest `10`,
  `mf/feta-rests.mf:817`).
- ⚠️ **Rational → Duration clamps at the 64th**: `/* we only go up to 64th notes */ if (k > 6) { durlog_ = 6;
  dots_ = 0; } … factor_ = r / Rational (*this)` (`lily/duration.cc:98-106`). Anything shorter than a 64th
  that LilyPond has to *derive* from a length (completion engravers, `ly:number->duration`,
  `lily/duration-scheme.cc:100-108`) is written as a **scaled 64th**, not a 128th.

### 3.2 Noteheads

- `select-head-glyph` (`scm/output-lib.scm:707-745`): style `default` → `noteheads.sM1` (breve),
  `…M2` (longa); `altdefault` → the breve becomes `sM1double`; `baroque` takes breve/longa/maxima from the
  neo-mensural (square) set; `mensural`/`neomensural`/`petrucci` are whole mensural sets.
- **Breve** `sM1` (`mf/feta-noteheads.mf:170-248`): the whole-note ellipse with **one vertical bar each
  side** (`draw_brevis (1, 1)`); `sM1double` two bars each side, thinner (`draw_brevis (2, 0.8)`). Bar
  length 0.72 or ≥ 0.77 sp above/below centre, quantised so bars on notes a 4th apart neither touch nor
  nearly touch (`:190-200`). ⇒ **round by default**.
- **Longa** `uM2` / `dM2` (`mf/feta-noteheads.mf:81-165`): the same body with the **stem baked into the
  glyph** — up: the RIGHT bar runs to `h + 3.0 staff_space`; down: the LEFT bar runs to `−d − 3.0
  staff_space` (`:122-146`). Chosen by the head's direction (`lily/note-head.cc:84-91`); the `Stem` grob is
  invisible for durlog < 1 (`lily/stem.cc:360-376`). ⇒ longa stem **3 sp past the head**, right side up,
  left side down.

### 3.3 Stems, flags, beams

- **Flagged stem: a table**, `Stem.details.lengths = (3.5 3.5 3.5 4.25 5.0 6.0 7.0 8.0 9.0)` for quarter,
  8th, 16th, 32nd, **64th 5.0, 128th 6.0, 256th 7.0, 512th 8.0**, 1024th 9.0, commented *"32nd, 64th, …,
  1024th flagged stems should be longer"* (`scm/define-grobs.scm:3452-3454`; read by
  `robust_list_ref (durlog - 2, …)`, `lily/stem.cc:505-515`, so longer values clamp to the last entry).
  Forced-direction shortening `stem-shorten (1.0 0.5 0.25)` (`define-grobs.scm:3458`).
- Feta flag glyphs are designed per count with a total depth of 3 / 3.5 / 4.25 / **5.25 / 6.25 / 7.25 /
  8.25** / 9.25 sp (up, 8th…1024th) and flag spacing 0.8–0.93 sp (`mf/feta-flags.mf:151-596`).
- **Beamed stem** (`lily/stem.cc:1150-1215`): ideal = `beamed-lengths (3.26 3.5 3.6)[beams−1]` − ½ beam
  thickness, but at least `beamed-minimum-free-lengths (1.83 1.5 1.25)[beams−1]` + the beams' height
  (thickness + (n−1)·translation) − ½ thickness (`define-grobs.scm:3442-3451`). With thickness 0.48
  (`:479`) and translation from 3.3 ⇒ ≈ **4.1 sp (4 beams), 5.0 (5), 5.9 (6), 6.7 (7)** — the MINIMUM FREE
  length, not the table, governs from 4 beams on.
- **Beam translation** (`lily/beam.cc:130-145`): `(2·ss + line − thickness)/2` for < 4 beams,
  `(3·ss + line − thickness)/3` for ≥ 4 ⇒ ≈ 0.81 sp and ≈ 0.87 sp (line ≈ 0.1 sp assumed). I.e. 3 beams
  fill 2 spaces, 4+ beams are re-spread to fill 3.

### 3.4 Rests

- Feta glyphs `rests.M3` maxima, `M2` longa, `M1` breve (+ `M1o` ledgered), `6`…`10`
  (`mf/feta-rests.mf:94-124, 561-817`).
- **Position** (`lily/rest.cc:48-135`): half notes and longer align to staff lines; a whole rest hangs from
  the next line up; breve/longa **lie on the line at or below the neutral position**, i.e. the middle line;
  64th and shorter take the voiced position unaligned (`if (duration_log > 1) return pos`). Ledgered glyph
  for a breve rest that neither lies on nor hangs from a line (`:170-185`).
- **Whole-bar rests** (`MultiMeasureRest`): `usable-duration-logs = (iota 4 -3)` = maxima, longa, breve,
  whole (`define-grobs.scm:2382`); `calc_measure_duration_log` picks the **longest usable value ≤ the bar**
  (`lily/multi-measure-rest.cc:103-160`) ⇒ breve rest for bars ≥ 2 wholes, longa ≥ 4, maxima ≥ 8.
  `round-up-to-longer-rest` flips it to the shortest value ≥ the bar (*"displays a breve instead of a
  whole in a 3/2 measure"*, `scm/define-grob-properties.scm:1050-1053`), with per-meter
  `round-up-exceptions`. A plain `r1` stays whatever was written.

### 3.5 Spacing

`get_duration_space` (`lily/spacing-options.cc:72-106`): for d ≥ shortest,
`(shortest-duration-space + log2(d/shortest)) × spacing-increment` = **(2.0 + log₂ ratio) × 1.2 sp**
(`define-grobs.scm:3249-3250`); below the shortest, **linear** `(2 + ratio − 1) × 1.2` — so very short
notes do not stretch the long ones. "Shortest" = min(`base-shortest-duration` 3/16, the most common
per-measure shortest) (`lily/spacing-spanner.cc:95-176`). ⇒ Gourlay's log law: a breve is only ~1.2 sp ×
(one doubling) wider than a whole.

### 3.6 Auto generation

`Completion_heads_engraver` / `Completion_rest_engraver` split across bar lines with
`Duration (left_to_do_ / factor_, false)` (`lily/completion-note-heads-engraver.cc:185-212`), which may
yield **breve/longa** (negative durlog) and multi-dotted values — but, per 3.1, **nothing shorter than a
scaled 64th**. `completionUnit` can force splitting on a unit grid (`:117-152`). No dotted-breve rule.

### 3.7 Input

`c\breve`, `c\longa`, `c\maxima`, `c64`, `c128`, `c256`, `c512`, `c1024`; dots `c\breve.`
(`ly/declarations-init.ly:26-28`; `lily/parser.yy:3530-3540, 4716-4736`). Whole-bar rest `R\breve`,
`R1*4/2`.

### 3.8 MIDI

Header 384 ticks/quarter (`lily/performance.cc:79`); `int (moment × 384 × 4)` (`lily/audio-item.cc:129`)
⇒ 512th = 3 ticks exact, 1024th = 1.5 → truncated.

---

## 4. What matters for us

1. **Our model is already the engines' model.** `DURATION_INFO` holds exact `Fraction`s in quarter beats;
   breve = 8/1, longa = 16/1, 512th = 1/128 fit without a tick grid. The engines' tick grids (480, 120,
   384) are where THEY lose exactness — a reason not to introduce one.
2. **Breve head — the engines DISAGREE, so it is a house-style row.** Round `noteheadDoubleWhole`
   (MuseScore, LilyPond) vs square `noteheadDoubleWholeSquare` (Verovio). All three offer the other as an
   option. Options: (a) round default + square option; (b) square default + round option. (LilyPond's
   double-barred `sM1double` is a third look; in SMuFL `noteheadDoubleWhole` already has bars.)
3. **Longa — three shapes, none shared:**
   (a) breve glyph + an ordinary stem, stem side by the normal up/down rule (MuseScore);
   (b) square body, stem always RIGHT, 3.5 sp (Verovio);
   (c) one baked glyph, stem right-up / left-down, 3 sp past the head (LilyPond).
   ⚠️ Under (a) with Bravura, the breve glyph has no stem anchor and its bars stick out beyond
   `noteheadOrigin` (0.36 sp) — where the stem meets the head is a real question.
4. **Flagged stem growth — three rules:** (a) the flag's SMuFL anchor (MuseScore; font-dependent,
   ≈ +0.75 sp per flag in Bravura from the 32nd); (b) no growth, the glyph overhangs (Verovio);
   (c) a table 4.25 / 5.0 / 6.0 / 7.0 / 8.0 for 32nd…512th (LilyPond). (a) and (c) roughly agree in
   size: Bravura 64th = 3.5 + 1.17 = 4.67 vs LilyPond 5.0; 512th 6.82 vs 8.0. `docs/research/stem-length-research.md`
   §1 already notes our current flag-extension rule is still VexFlow's — this is the question it meets.
5. **Beamed stem growth** for 4–7 beams: MuseScore +0.75/beam (4.25…6.5), LilyPond ≈ +0.87/beam from a
   minimum-free rule (≈ 4.1…6.7), Verovio +1.0/beam (5.0/5.5…8.0/8.5). MuseScore and LilyPond agree within
   ~0.2 sp; Verovio runs ~1–1.5 sp longer. A row, not a constant (CLAUDE.md: a number never blocks).
6. **Beam pitch** 0.75 sp (MuseScore, Verovio) vs ≈ 0.81 → 0.87 sp (LilyPond, re-spread at 4+ beams).
   Verovio's 64th-only 0.83 looks accidental.
7. **Bar rest in long bars — AGREED**: a whole-bar rest in a bar ≥ 2 wholes draws `restDoubleWhole` (all
   three). Open only beyond that: LilyPond alone goes to a longa rest at ≥ 4 wholes (multi-measure rests),
   and offers round-up (3/2 → breve). This touches the voice bar-rest work: today's
   bar rest is always the whole-rest glyph.
8. **Rest placement — AGREED**: breve rest on the middle line filling the space above; longa rest centred
   on the middle line; 64th+ use the glyph's own box (they grow upward — MuseScore raises the dot with them).
9. **Spacing**: no engine keeps a duration TABLE; each applies its one law to the new values (MuseScore
   1.5^log₂, Verovio d^0.6, LilyPond Gourlay log + linear-below-shortest). Our law (Gould 3.5 × √t,
   `layout/spacing`) extends the same way — but note the breve/longa ROOM differs a lot by law (MuseScore
   breve 3.4 × ♩, Verovio 3.5 ×, LilyPond ~ +3.6 sp over a quarter); only Verovio has a switch to squeeze
   them (off by default).
10. **Auto-generation disagrees**: MuseScore's fill/split may emit (dotted) breves and longas; LilyPond's
    completion engravers too, but never below a scaled 64th; Verovio never generates. Our `clearOps` /
    `restFill` refill "by the METER" — whether the new long values join that pool (and whether a dotted
    breve may) is a decision, not a copy: options (a) never auto-generate breve/longa (only the bar rest's
    glyph changes), (b) allow them where the meter's beat structure permits (MuseScore), (c) allow any
    exact fit.
11. **Input**: MuseScore keys 1 = 64th … 7 = whole, 8 = breve, 9 = longa; 128th+ have no default key and
    are hidden in the toolbar. Verovio/LilyPond are textual (`@dur="breve"`, `\breve`, `128`).
12. **Dots**: MuseScore forbids any dot that would fall below a 1024th (1024th: none, 512th: ≤ 1, 256th:
    ≤ 2, 128th: ≤ 3). If our shortest is the 512th, the analogous rule would forbid a dot on a 512th unless
    a 1024th exists — a question for the multiple-dots rows (`docs/research/multiple-dots-research.md`).
