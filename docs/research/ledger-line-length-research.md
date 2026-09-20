# HOW LONG IS A LEDGER LINE — the sourced options, for a house-style preset

> 📄 Research only, done **2026-09-14**. ⛔ **It recommends no value and changes no code.** Its job is
> the preset menu: every row in §5 is one sourced option a user could one day pick. Sibling of
> `docs/research/staff-line-research.md`, which settled the ledger's **thickness** — ⛔ not reopened here.
>
> Four treatises (Gould, Ross, Stone, Gerou & Lusk), **nine measured plates**, three engines + VexFlow,
> and the `legerLineExtension` of every SMuFL metadata file on disk.
>
> ⭐ **The one-line picture.** Everyone who gives a number lands a ledger line **0.2–0.5 sp past the
> head on each side**. The prose sources (Gould *"just over two spaces long"*, Ross *"less than a half
> space to each side"*) and Gould's and Ross's own plates (**≈0.40 sp a side, 2.1–2.2 sp long**) sit at
> the long end. The engines and fonts spread from **0.20** (MuseJazz) to **0.40** (Bravura, Petaluma).
> What this repo draws, **0.30**, is VexFlow's number.
>
> ⚠️ **The rows measure different things.** Some give an overhang past the head's ink, some a total
> length, one a fraction of the head's width. They only convert into each other once you know the head
> width, and that is a font metric running **1.18 → 1.34 sp** (§3.5). §5 says which quantity each row
> is.

---

## 0. The question

1. **The ordinary ledger line**: how far past the notehead does it reach on each side, or how long is
   it in total?
2. **Beside an accidental**: is it shortened, and by how much? ✅ **Already decided in this repo**
   (§4.2). Here it is recorded as the armed row, with its alternatives.
3. **A chord with a displaced head (a second)**: does one line span both heads, and how far past them?
4. **Two voices at the same level**: one shared line or two?
5. **Grace and cue notes**: are their ledgers shorter?

## 1. Sources, and how to reach each page again

| source | file | page rule | pages used |
|---|---|---|---|
| **Gould, *Behind Bars*** | `reference/Behind Bars … (Elaine Gould) … (2).pdf` | PDF = printed **+20** | *Ledger lines* **p. 26** (PDF 46), *Adjacent-note chords / Double-stemmed* **p. 27** (PDF 47), *On ledger lines* (dotted parts) **p. 60** (PDF 80), *Grace notes: Design* **p. 125** (PDF 145), *Cue notation: Size and spacing* **p. 569** (PDF 589) |
| **Ross, *The Art of Music Engraving*** | `reference/the art of music engraving … (ted ross) ….pdf` | PDF = printed **+12** | *LEGER LINES* **p. 182** (PDF 194) |
| **Stone, *Music Notation in the 20th Century*** | `reference/Music Notation in the Twentieth Century … (Kurt Stone) ….pdf` | ⚠️ **2-UP**: PDF 26 = printed 30 (left) / 31 (right) | *Leger Lines* **p. 30** (PDF 26, left half) |
| **Gerou & Lusk, *Essential Dictionary*** | `reference/gerou-lusk-essential-dictionary-of-music-notation.pdf` | ⚠️ **2-UP**: PDF n = printed 2n−4 (left) / 2n−3 (right) | *Grace notes: With leger lines* **p. 74** (PDF 39, left) · *Leger lines* **p. 83** (PDF 43, right) · *Overcrowding* figure **p. 84** (PDF 44, left) |
| LilyPond | `~/dev/engine-sources/lilypond` @ `beedbfa0` | | `scm/define-grobs.scm`, `lily/ledger-line-spanner.cc`, `Documentation/en/essay/engraving.itely` + `Documentation/pictures/baer-ledger.png` |
| MuseScore | `~/dev/engine-sources/MuseScore` @ `929d1e99` | | `src/engraving/style/styledef.cpp`, `rendering/score/chordlayout.cpp`, `internal/engravingfont.cpp` |
| Verovio | `~/dev/engine-sources/verovio` @ `efff0bc9` | unit = **½ sp** | `src/options.cpp`, `src/doc.cpp`, `src/calcledgerlinesfunctor.cpp`, `src/staff.cpp` |
| VexFlow 5.0.0 | `node_modules/vexflow/build/esm/src/` (⚠️ 2026-09-19: the package is removed — the same build is kept at `~/dev/engine-sources/vexflow-5.0.0-npm/package/build/esm/src/`) | 10 px = 1 sp (`tables.js:647`) | `stavenote.js`, `gracenote.js` |
| SMuFL metadata | `scripts/vendor/Bravura.json`, `~/dev/engine-sources/{verovio,MuseScore}/fonts/*/*.json` | | `engravingDefaults.legerLineExtension` |

⚠️ **Two page citations elsewhere in `docs/` are off by one half-spread**, found while rendering:
Stone's *Leger Lines* is printed **p. 30**, not 31 (`docs/research/staff-line-research.md` §1, §2.3). G&L's
grace-note ledger sentence is printed **p. 74**, not 75 (same doc, §1, §2.4). Both sit on the other
half of the PDF page that doc names. Not corrected there; recorded here.

### How the plates were measured

Pages were rendered with `pdftoppm` (Gould and Ross at 450 dpi, G&L and Stone at 600 dpi) and read
with PIL, threshold 140/255. The **staff space** is the mean spacing of the five detected staff lines
on the same crop (Gould 19.9–20.1 px, Ross 25.0, G&L 50.6–53.3). A ledger's **length** is the dark
run through its centre row. Its **overhang** is ledger end minus the outermost head ink on that side,
taken on rows ±0.2–0.8 sp off the line. ⚠️ Scan blur widens every ink edge by about a pixel, so
**lengths and head widths read ≈0.05–0.1 sp long, and overhangs do not** (both edges inflate
equally). Scripts: `/tmp/claude-1000/ledger-research/ledgers.py`, not kept in the repo.

## 2. What each book says

### 2.1 Gould — the only book that answers all five questions

> **p. 26, *Ledger lines***: *"The ledger line extends slightly beyond either side of the notehead and
> is **just over two spaces long** (a). Ledger lines of adjacent notes should not join up (c); the
> lines **may be slightly shortened in cramped conditions** (b)"* … *"Grace notes take ledger lines
> that are **shorter and thinner** than full-sized notes, **in proportion to their smaller
> noteheads**"*.
>
> **p. 27, *Adjacent-note chords***: *"Ledger lines extend beyond the noteheads on both sides of a stem,
> between the stave and the outermost pair of adjacent notes. When the displaced note … is on a line,
> the ledger line extends the full width of both notes; when the displaced note is in a space, the last
> ledger line is shortened to single notehead width"* · *"Notes further from the stem end than the
> adjacent pair take single-width ledger lines"*.
>
> **p. 27, *Double-stemmed adjacent notes and overlapping parts***: *"**The two parts may share ledger
> lines**, which should extend either side of all noteheads between the stave and the displaced part.
> When parts overlap, ledger lines that are not shared by the part whose pitch is closest to the stave
> should not cut through its stem"*.
>
> **p. 60, *On ledger lines***: *"when the part placed first is dotted, **separate the ledger lines**.
> The ledger lines are not separated when only the second part takes a dot"*.
>
> **p. 125**: *"The grace note is slightly smaller than a cue note, which is ¾ of a full-sized note"*.
> **p. 569**: *"Ledger lines for cue notes should be the same vertical distance apart as full-sized
> ledger lines (although they are thinner)"*. ⛔ No length is given for cue ledgers.

⛔ **The accidental case**: Gould does not discuss shortening a ledger for an accidental
(`docs/research/accidental-dot-research.md` row A5, searched). Her only licence to shorten is *"cramped
conditions"*.

#### The plates, measured

| plate | what it shows | length | overhang per side (past head ink) |
|---|---|---|---|
| **p. 26 (a)** — 4 sixteenths, 5 ledgers, full size | the normal line | **2.10–2.20 sp** | 0.45/0.25 · 0.40/0.40 · 0.40/0.50 · 0.45/0.35 ⇒ **0.25–0.50, mean ≈0.40** |
| **p. 26 (b)** — "cramped", head pitch 2.05 sp | the *shortened* line | **1.70–1.75 sp** (−0.4 sp) | **0.05–0.20**; gaps between neighbouring ledgers **0.30–0.40 sp** |
| **p. 26 (c)** — "but not", head pitch 1.89 sp | full-length lines that **join** | one 7.8 sp run | outer ends 0.35–0.40 |
| **p. 26** grace notes, 3 ledgers | grace ledgers | **1.29–1.39 sp** | **0.15–0.25**; head ink 0.89 sp vs full 1.25–1.40 ⇒ ledger ÷ full ≈ 0.64 ≈ head ÷ full ≈ 0.63 — ⭐ *"in proportion"*, drawn |
| **p. 27** *on a line* (black-head chords, above and below) | one line under both heads | **3.38 sp** at every level | heads span 2.48–2.63 ⇒ **0.35–0.45** |
| **p. 27** *in a space* | the outermost level single-width | inner levels 3.38; outermost **≈2.0 sp** | right end flush with the long lines (x 919); left end starts at x 879 before the displaced head's ink hides it |
| **p. 27** shared, "and" example | two parts sharing | shared levels **3.40 sp**, beyond the displaced part **2.15** | 0.35–0.45 |
| **p. 27** shared, "not" example | the rejected separate lines | two lines of **2.15–2.20**, gap **0.25 sp** | 0.40–0.45 |
| **p. 27** *overlapping parts*, accepted / rejected | the stem not cut | accepted **3.00–3.10** then 2.10 · rejected **2.60** at every level | — |
| **p. 60** dotted parts | separated vs not | separated: **2.11–2.67** each, gap **0.5–0.7 sp** · not separated: one **4.03 sp** line | 0.35–0.45 |

⭐ **Gould draws what she wrote.** *"Just over two spaces"* is 2.10–2.20 on her own plate, about
**0.40 sp a side** on a head ≈1.3 sp wide. Her shortened line (b) gives up **≈0.2 sp a side**
and keeps a visible 0.05–0.2 overhang. It never goes flush with the head.

### 2.2 Ross — a per-side ceiling, and a rule for the displaced head

> **p. 182, *LEGER LINES***: *"A leger line is somewhat thicker than the staff line; it **extends less
> than a half space to each side of the notehead** (under crowded conditions the length of the leger
> line may be shortened)."* Then, for *suspended* (displaced) notes: *"When the stem points downward,
> the leger line above the top suspended note should be long enough to create a slight 'bump' on the
> top curve of the note-head. The leger line below the top suspended note should be of normal length"*
> · *"When suspended notes are in thirds, only the top leger line is shortened"* · *"When two or more
> notes are suspended on the same stem only one leger line is shortened"*.

**Measured**, p. 182's eight-note figure (1 sp = 25.0 px): ledgers **2.16–2.40 sp** (seven of eight
at 2.20–2.24), overhang **L 0.36–0.60 / R 0.24–0.40**, i.e. ≈0.4 a side. His heads measure 1.40–1.56
because the 1970 photo-offset has ink gain (see `docs/research/staff-line-research.md` §3.4). The overhang
cancels that. The beamed four are not visibly shortened (gaps 0.32–0.40 sp).

⚠️ **Ross's displaced-head rule is not Gould's.** She runs a line under the displaced head at full
double width, or at single width when it sits in a space. He shortens the line *beyond* a suspended
head so that it only makes a *"bump"* on the head's curve. ⛔ The size of the bump was not measured
(UNKNOWN, §6).

### 2.3 Stone — a displaced-chord rule, and no length

> **p. 30**: *"If intervals of a second are on leger lines, the line(s) between the second(s) and the
> staff **must be twice as wide as ordinary leger lines**"* — with a *correct / wrong* pair and a
> *"three long ledger lines"* example.

⛔ No length for an ordinary line, no shortening, nothing on grace, cue or voices in any `leger` hit.
⛔ The plate could not be measured reliably at 600 dpi: the lines merge with the heads. UNKNOWN.

### 2.4 Gerou & Lusk — shortening as the second choice

> **p. 83**: *"Leger lines **extend slightly past the notehead**. They will need to extend sufficiently
> enough to be seen."* · ***Overcrowding***: *"To avoid leger lines that touch, adjustments must be made
> either in the horizontal spacing of the music or **by shortening the leger line length. The first is
> preferred**, but is not always possible."* **p. 84**: *"Corrected by shortening the leger lines to
> create a slight amount of space between the lines."* **p. 74**: *"The grace-note leger lines can be
> the same thickness as staff lines, **but shorter**."*

**Measured** (1 sp = 50.6–53.3 px):
- **p. 83**: **1.61–1.65 sp** long, overhang 0.24/0.35 (above) and 0.43/0.24 (below). Their heads
  measure only 0.98–1.06 sp.
- **p. 84**: the "too crowded" lines merge into ≈5 sp runs. The *corrected* lines are **1.42–1.58 sp**
  (mostly 1.50–1.56), overhang L 0.16–0.47 / R 0.12–0.28, so ≈−0.1 sp against p. 83.
- **p. 74**: grace ledger **1.24 sp** against the principal note's **1.75 sp** on the same staff
  (ratio 0.71). Grace overhang 0.26–0.45. Stroke visibly the same weight.

## 3. What each engine and font does

### 3.1 LilyPond — a fraction of the head, and the one engine that shortens for an accidental

- **Length**: each head's ledger is the head's extent widened by **`length-fraction` 0.25 × the head's
  width** on each side (`scm/define-grobs.scm:2069`; `lily/ledger-line-spanner.cc:205-206`, `:230`).
  On a head of 1.316 sp that is **0.33 sp a side, 1.97 sp total**, i.e. 1.5 head widths. ⚠️ 1.316 is
  Emmentaler's `noteheadBlack` width as published in *MuseScore's* copy of its metadata
  (`MuseScore/fonts/mscore/metadata.json`). LilyPond's own `black_notehead_width` is `charwd` in the
  METAFONT source (`mf/feta-params.mf:320`) and was not evaluated.
- **Accidental**: a ledger inside the accidental glyph's per-glyph vertical band gets its **left end
  moved to the midpoint of (accidental right edge, head left edge)** (`ledger-line-spanner.cc:358-368`).
  Only the left end moves. Band values are in `docs/research/accidental-dot-engines.md` A5.
- **Crowding**: adjacent columns' ledgers are clamped to the midpoint between the two heads, less
  `gap` 0.1 split between them (`ledger-line-spanner.cc:278-327`, `gap` at `:282`). The spacing rods
  reserve `minimum-length-fraction` 0.25 × head width per ledger (`define-grobs.scm:2070`,
  `ledger-line-spanner.cc:40-58`, `:78-79`).
- **Displaced chord / two voices**: each head's extents at each ledger level are **unioned** into one
  stroke (`ledger-line-spanner.cc:396`). Same column and same level means one line, whichever voice.
- **Grace / cue**: nothing special. The 0.25 fraction rides the smaller head.
- **The essay's evidence**: *"an expert engraver will shorten a ledger line to allow closer spacing with
  accidentals"* (`Documentation/en/essay/engraving.itely:370-375`), shown with a Bärenreiter excerpt
  (`Documentation/pictures/baer-ledger.png`). Measured at its low resolution (222×341 px, 1 sp ≈
  41 px): the ledger beside the flat is **1.90–1.97 sp**, left overhang **≈0.32**, right **≈0.51**.
  ⚠️ So a left end shorter than the right, but on a thumbnail; treat the asymmetry as indicative.

### 3.2 MuseScore — 0.33 sp past the head, taken from the font

- **Length**: `Sid::ledgerLineLength` **0.33 sp**, added to each side of the head
  (`style/styledef.cpp:279`; read as an absolute distance at `rendering/score/chordlayout.cpp:1311`,
  applied `:1367-1390`). ⚠️ The trailing comment *"notehead width \* this value"* is stale: the code
  uses `styleAbsolute`, not a fraction.
- **From the font**: `legerLineExtension` maps onto `Sid::ledgerLineLength`
  (`internal/engravingfont.cpp:783`). With Leland (default, 0.33, head 1.30) that gives **1.96 sp**;
  with Bravura 0.40 on a 1.18 head, 1.98.
- **Accidental**: ⛔ no shortening. The code is written and commented out (`chordlayout.cpp:1361-1365`);
  the sign may overlap the ledger instead (`docs/research/accidental-dot-engines.md` A5).
- **Displaced chord**: `ChordLayout::updateLedgerLines` (`chordlayout.cpp:1280`) widens every line
  *between* a head and the staff to that head's min/max x (`:1367-1390`). Outer lines stay
  single-width, which is Gould's p. 27 rule.
- **Two voices**: ⛔ **not shared**. Ledger lines belong to a `Chord` (`dom/chord.h:170`, `:396`), so
  each voice draws its own. Two-voice collision offsets are paid in `ledgerLineLength + 0.15 sp`
  (`chordlayout.cpp:2034-2035`, `:2105-2125`). Ledger-to-ledger padding is 0.25 sp
  (`rendering/paddingtable.cpp:47`, `:67`).
- **Grace / small**: `extraLen × note->mag()` (`chordlayout.cpp:1368-1369`), with `graceNoteMag` and
  `smallNoteMag` both **0.7** (`styledef.cpp:515`, `:517`), so **0.23 sp**.

### 3.3 Verovio — 0.27 sp, shrinking against neighbours only

- **Length**: `ledgerLineExtension` **0.54 units = 0.27 sp** each side (`src/options.cpp:1382-1385`,
  range 0.20–1.00 units). On Leipzig's 1.256 head that is **1.80 sp** total. ⭐ 0.27 is exactly
  Leipzig's own `legerLineExtension`. An `engravingDefaults` import multiplies by 2
  (`options.cpp:2104-2105`, `:2143-2145`), but it reads the engraving-defaults *option*; whether a
  loaded font's metadata is routed into it was not traced.
- **Cue / grace**: × `graceFactor` **0.75** (`doc.cpp:2097-2102`, `:2111-2119`; `options.cpp:1327`), so
  **0.20 sp**.
- **Crowding**: `CalcLedgerLinesFunctor::AdjustLedgerLines` shrinks both ends of a dash when the gap is
  under half an extension, to at most ⅔ of (gap share + extension), with a floor of the option's
  minimum 0.20 units = **0.10 sp** (`src/calcledgerlinesfunctor.cpp:120-203`, `doc.cpp:2104-2109`).
- **Accidental**: ⛔ the line is not shortened; the accidental moves out (`src/accid.cpp:141`, `:183`).
- **Displaced chord / two voices**: `LedgerLine::AddDash` **merges dashes overlapping by more than 1.5
  extensions** (`src/staff.cpp:393-408`). A chord's heads and two voices at the same x merge into one
  shared line; adjacent notes do not.

### 3.4 VexFlow 5.0.0 — 3 px, accidental-blind

`StaveNote.LEDGER_LINE_OFFSET` = **3 px = 0.30 sp** (`stavenote.js:34-36`, default at `:266`).
Width = glyph + 2×3 px (`:690`). A line under both heads of a second is
`2 × (glyph + 3) − Stem.WIDTH / 2` (`:691`, used `:701-714`). `GraceNote.LEDGER_LINE_OFFSET` = **2 px =
0.20 sp** (`gracenote.js:9-13`). Per note, so two voices draw two lines.

### 3.5 SMuFL fonts — `engravingDefaults.legerLineExtension` (sp past the head, each side)

| font (version, file) | `legerLineExtension` | `noteheadBlack` width | ⇒ total |
|---|---|---|---|
| **Bravura** 1.481 (`scripts/vendor/Bravura.json`; also 1.392 in both engines) | **0.40** | 1.18 | 1.98 |
| **Petaluma** 1.065 (`MuseScore/fonts/petaluma/`; 1.04 in Verovio) | **0.40** | 1.336 | 2.14 |
| **Gootville** 1.3 (`verovio/fonts/Gootville/`, `MuseScore/fonts/gootville/`) | **0.40** | — (no bbox in its metadata) | — |
| **Emmentaler** 2.003 (MuseScore's, `MuseScore/fonts/mscore/metadata.json`) | **0.38** | 1.316 | 2.08 |
| **Leland** 0.80 (`MuseScore/fonts/leland/`, `verovio/fonts/Leland/`) | **0.33** | 1.30 | 1.96 |
| **Leipzig** 5.2.101 (`verovio/fonts/Leipzig/`) | **0.27** | 1.256 | 1.80 |
| **Finale Maestro** 2.7 (`MuseScore/fonts/finalemaestro/FinaleMaestro.json`) | **0.25** | 1.272 | 1.77 |
| **Finale Broadway** 1.4 (`MuseScore/fonts/finalebroadway/FinaleBroadway.json`) | **0.25** | 1.28 | 1.78 |
| **MuseJazz** 1.0 (`MuseScore/fonts/musejazz/metadata.json`) | **0.20** | 1.316 | 1.72 |
| Sebastian, Finale Jazz, Finale Ash | ⛔ UNKNOWN — no metadata on disk | | |
| Gonville | ⛔ ships no metadata (`docs/research/smufl-fonts-research.md` §3) | | |

⛔ The SMuFL specification's own definition text for `legerLineExtension` is not on disk (UNKNOWN).

### 3.6 Side section — MuseScore's `Sid::ledgerLineWidth` (fills `staff-line-research.md` §5.4's UNKNOWN)

⭐ **`Sid::ledgerLineWidth` = 0.16 sp** (`style/styledef.cpp:278`, trailing comment `// 0.1875`),
against `staffLineWidth` **0.11 sp** (`:277`), so **1.45×**. It is overwritten by the font's
`legerLineThickness` (`internal/engravingfont.cpp:782`) and scaled by the chord's mag
(`rendering/score/tlayout.cpp:3808`). Every font in §3.5 publishes 0.16 except Finale Maestro 0.11,
Finale Broadway 0.19 and MuseJazz 0.20. ⛔ Thickness stays decided; this only fills the gap.

## 4. What this repo draws today

### 4.1 The ordinary line

- **Overhang 3 px = 0.30 sp a side**, VexFlow's constant kept on purpose:
  `EngravedNote.ledgerOverhang = StaveNote.LEDGER_LINE_OFFSET` (`src/engine/rendering/EngravedNote.ts:124-128`)
  — ⭐ since S1b (2026-09-14) the attributed row `LEDGER_OVERHANG_PX` in `src/engine/engrave/inheritedDefaults.ts`,
  same 3 px,
  drawn at `:162-178`. On Bravura's 1.18 head that is **1.78 sp** total
  (`src/engine/engrave/notes/ledgerLines.ts:37-42`).
- **The rule**: `ledgerLineRuns` (`ledgerLines.ts:105-129`) reaches from the leftmost head at that level
  to the rightmost head's right edge, ± overhang. That covers Gould p. 27's full-width and
  single-width cases in one sentence.
- **Fans**: `FAN_LEDGER_OVERHANG = 3` px (`src/engine/rendering/FanPass.ts:120`, chosen at `:165-169`).
- **Rests**: `PAD = 2` px = **0.20 sp** past the rest glyph (`src/engine/rendering/ScoreRenderer.ts:2390`).
- **Ghost preview**: a plain VexFlow `StaveNote`, so 3 px (`src/engine/rendering/GhostRenderer.ts:162-164`).
  (⚠️ 2026-09-19: VexFlow is removed — the ghost is our `EngravedNote`, whose overhang is the same
  `LEDGER_OVERHANG_PX` row, still 3 px.)
- **Spacing reserve**: `INK.ledgerLeft` **0.30**, `INK.ledgerRight` **1.50** from the head anchor, 1.80 sp
  wide (`src/engine/layout/spacingPadding.ts:86-96`, used `layout/measureColumns.ts:151`, `:168`).
  Held as a recorded override against the font's 0.40 / 1.58 in
  `layout/spacingPadding.font.test.ts:77-88`, `:252-253`, pending *"HIS EYE (§3.6 #5)"*
  (`docs/plans/font-metrics-plan.md:356-357`).
  🚨 `docs/plans/note-engraving-plan.md:688` and §3.1 (`:706-710`) say the ink table *"already reserve[s]
  0.40"*. The code says **0.30 left and 1.50 right** (0.32 past a 1.18 head), so that sentence is
  stale. The drawing and the reserve agree to within 0.02 sp.

### 4.2 ✅ Beside an accidental — DECIDED, the armed row

After his report of accidentals colliding with ledger lines (`docs/research/accidental-ledger-clearance.md`), the
repo adopted LilyPond's direction: *"an expert engraver will shorten a ledger line to allow closer
spacing with accidentals"*. It is implemented as a **symmetric trim**:

- on a note whose accidental stands beside one of its ledgers (`ACCIDENTAL_REACH_LINES` 1.4,
  `ledgerAccidentalClearance.ts:66`, `:128-130`), the overhang drops **3 px → 2 px = 0.30 → 0.20 sp at
  both ends** (`LEDGER_OVERHANG_BESIDE_ACCIDENTAL`, `:75`; applied `:150-169` through `trimLedgers`,
  `EngravedNote.ts:361-364`);
- the signs then step out `overhang + gap − standoff`, leaving **`LEDGER_ACCIDENTAL_GAP` = 0.20 sp** of air
  (`:57`, `:114-122`);
- why this shape (`ledgerAccidentalClearance.ts:21-47`): the room may not be *reserved*, because bar
  width is clef-independent; so the sign moves at draw time, can only move a little, and the line
  gives up the rest.

Recorded as A5 in `docs/research/accidental-dot-research.md:244`. ⏭️ **The asymmetric version** (LilyPond: left
end only, to the midpoint) is listed as a possible future row, *not taken*
(`docs/plans/note-engraving-plan.md` §4, `:855-857`).

### 4.3 Not done

- **Shared lines between voices**: every voice draws its own (`ledgerLines.ts:54-57`;
  `note-engraving-plan.md` §4, `:850-854`).
- **Grace/cue ledgers**: no grace notes yet (`note-engraving-plan.md:669`).
- **Crowded-line shortening**: none. Neighbours are kept apart by spacing instead (`spacingPadding.ts:417-419`,
  the `ledger` padding row 0.35 sp), which is G&L p. 83's *preferred* remedy.

## 5. ⭐ PRESET ROWS

**Quantities**, and ⚠️ rows with different letters are **not directly comparable**:
- **O** = overhang past the head's ink edge, each side
- **T** = total length of a single-head line
- **F** = fraction of the head's width, each side
- **M** = measured on a plate, ink to ink (overhang, blur-neutral), with total length alongside

Converting T ↔ O needs a head width, which runs 1.18 (Bravura) → 1.34 (Petaluma); Gould's plate head is ≈1.3.

### 5.1 The ordinary line

| # | source | value | qty | citation | status |
|---|---|---|---|---|---|
| L1 | **VexFlow** | **0.30 sp** (1.78 total on Bravura) | O | `stavenote.js:34-36`; ours `EngravedNote.ts:124-128` | ✅ **ARMED** |
| L2 | Gould, prose | *"just over two spaces long"* | T | p. 26 (PDF 46) | |
| L3 | Gould, plate | **≈0.40** (0.25–0.50); 2.10–2.20 total | M | p. 26 (a) | |
| L4 | Ross, prose | *"less than a half space to each side"* | O (upper bound) | p. 182 (PDF 194) | |
| L5 | Ross, plate | **≈0.40** (L 0.36–0.60, R 0.24–0.40); 2.16–2.40 total | M | p. 182 | |
| L6 | Gerou & Lusk, prose | *"slightly past the notehead"* | — (no number) | p. 83 (PDF 43) | |
| L7 | Gerou & Lusk, plate | **≈0.3** (0.24–0.43); 1.61–1.65 total on a ≈1.0 head | M | p. 83 | |
| L8 | LilyPond | **0.25 × head** (≈0.33 on 1.316) | F | `define-grobs.scm:2069`, `ledger-line-spanner.cc:230` | |
| L9 | MuseScore | **0.33** (or the font's value) | O | `styledef.cpp:279`, `engravingfont.cpp:783` | |
| L10 | Verovio | **0.27** | O | `options.cpp:1384` | |
| L11 | Bravura / Petaluma / Gootville | **0.40** | O | §3.5 | the font we ship says 0.40 |
| L12 | Emmentaler (MuseScore's) | **0.38** | O | §3.5 | |
| L13 | Leland | **0.33** | O | §3.5 | |
| L14 | Leipzig | **0.27** | O | §3.5 | |
| L15 | Finale Maestro / Broadway | **0.25** | O | §3.5 | |
| L16 | MuseJazz | **0.20** | O | §3.5 | |

### 5.2 Beside an accidental

| # | source | rule | qty | citation | status |
|---|---|---|---|---|---|
| A1 | **ours, LilyPond-derived** | **symmetric** trim to **0.20 sp** both ends, sign steps out to 0.20 sp air | O | `ledgerAccidentalClearance.ts:57`, `:75`, `:150-169` | ✅ **ARMED** |
| A2 | LilyPond | **left end only**, to the midpoint of (accidental right, head left), within a per-glyph band | position, not a length | `ledger-line-spanner.cc:358-368` | ⏭️ listed, not taken (`note-engraving-plan.md` §4) |
| A3 | Bärenreiter plate (LilyPond essay) | left ≈0.32 / right ≈0.51 | M, low-res | `Documentation/pictures/baer-ledger.png` | |
| A4 | MuseScore | no trim; sign may overlap the line | — | `chordlayout.cpp:1361-1365` | |
| A5 | Verovio | no trim; sign moves out | — | `accid.cpp:141`, `:183` | |
| A6 | VexFlow (bare) | no trim; the tip touches the sign | — | `stavenote.js:686-729` | |
| A7 | Gould / Ross / G&L / Stone | not discussed for accidentals; shortening allowed only when *crowded* | — | Gould p. 26, Ross p. 182, G&L p. 83 | |

### 5.3 Crowded neighbours

| # | source | rule | qty | citation |
|---|---|---|---|---|
| C1 | ours | never shortened; spacing keeps ledgers 0.35 sp apart | spacing | `spacingPadding.ts:417-419` |
| C2 | Gould, plate | shortened to **1.70–1.75 sp** (overhang 0.05–0.20), gaps 0.30–0.40 | M | p. 26 (b) |
| C3 | Gerou & Lusk | respace first, shorten second; plate **1.42–1.58** vs 1.61–1.65 | M | pp. 83–84 |
| C4 | Ross | *"may be shortened"*, no amount | — | p. 182 |
| C5 | LilyPond | clamp at the midpoint between heads less `gap` 0.1 | position | `ledger-line-spanner.cc:278-327` |
| C6 | Verovio | shrink to ≤⅔(gap share + ext), floor **0.10 sp** | O | `calcledgerlinesfunctor.cpp:120-203` |
| C7 | MuseScore | padding 0.25 sp between ledgers | spacing | `paddingtable.cpp:67` |

### 5.4 A chord with a displaced head

| # | source | rule | citation | status |
|---|---|---|---|---|
| D1 | **ours** = Gould = MuseScore = LilyPond (by union) = Verovio (by merge) = VexFlow | levels between the staff and the outer adjacent pair span **both heads** + overhang; outer levels **single head** | `ledgerLines.ts:105-129`; Gould p. 27 (plate **3.38 sp**, overhang 0.35–0.45; in-a-space outer level ≈2.0) | ✅ ARMED |
| D2 | Stone | *"twice as wide as ordinary"* for lines between the seconds and the staff | p. 30 |
| D3 | Ross | line beyond a *suspended* head shortened to make a *"bump"* on its curve | p. 182 |

### 5.5 Two voices at the same level

| # | source | rule | citation | status |
|---|---|---|---|---|
| V1 | **ours**, MuseScore, VexFlow | **separate**, one set per voice | `ledgerLines.ts:54-57`; `chord.h:170` | ✅ ARMED (by default, not by decision) |
| V2 | Gould | **shared**, spanning all heads between the staff and the displaced part (plate **3.40 sp**); rejected version = two lines 2.15 with 0.25 gap; not through the nearer part's stem | p. 27 | |
| V3 | Gould | **separate** when the first-placed part is dotted (gap 0.5–0.7); shared (**4.03**) when only the second is | p. 60 | |
| V4 | LilyPond | shared when extents overlap (union) | `ledger-line-spanner.cc:396` | |
| V5 | Verovio | shared when dashes overlap > 1.5 extensions | `staff.cpp:393-408` | |

### 5.6 Grace and cue notes

| # | source | rule | qty | citation |
|---|---|---|---|---|
| G1 | ours | — (no grace notes) | | `note-engraving-plan.md:669` |
| G2 | Gould | *"shorter … in proportion to their smaller noteheads"*; plate grace **0.15–0.25** a side, 1.29–1.39 total (≈0.64× full) | M | p. 26 |
| G3 | Gould | cue = ¾ of full size (grace slightly smaller); cue ledger **length** not stated | — | pp. 125, 569 |
| G4 | Gerou & Lusk | *"shorter"*; plate 1.24 vs 1.75 (0.71×) | M | p. 74 |
| G5 | LilyPond | 0.25 × the smaller head | F | §3.1 |
| G6 | MuseScore | × mag 0.7 ⇒ **0.23** | O | `chordlayout.cpp:1368`, `styledef.cpp:517` |
| G7 | Verovio | × 0.75 ⇒ **0.20** | O | `doc.cpp:2097-2102`, `options.cpp:1327` |
| G8 | VexFlow | **2 px = 0.20** | O | `gracenote.js:9-13` |

## 6. ⛔ UNKNOWN

- **Stone's plate** (p. 30): not measurable at the scan's resolution; his *"twice as wide"* is prose only here.
- **Ross's "bump"** (p. 182): how short the line beyond a suspended head is, not measured.
- **Ross, Stone and G&L on two voices sharing a ledger**: no passage found in their `leger` hits; not read page by page.
- **Ross and Stone on grace/cue ledger length**: no `leger` hit in Ross's cue/grace chapter (text lines 11306–11421) beyond slur avoidance, and no hit in Stone; pages not rendered.
- **Gould's cue-note ledger length**: p. 569 gives spacing and thickness only.
- **The SMuFL specification's own wording** for `legerLineExtension`: not on disk.
- **Sebastian, Finale Jazz, Finale Ash**: metadata not on disk. Gootville's head width is not in its metadata.
- **LilyPond's own black notehead width**: `charwd` in METAFONT, not evaluated. L8's 0.33 uses MuseScore's Emmentaler metadata as a proxy.
- **Verovio**: whether a loaded font's `legerLineExtension` reaches `m_ledgerLineExtension` automatically, or only through the engraving-defaults option.
- **MuseScore**: whether the font's engraving defaults are applied by default or only when a "load font style" setting is on; only the mapping table was read.
- **The Bärenreiter asymmetry** (A3): measured on a 222×341 thumbnail; the true plate is not held.
