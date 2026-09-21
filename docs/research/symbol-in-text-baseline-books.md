# A music SYMBOL inside a line of WORDS — where it stands and how big it is: the BOOKS

> ⭐⭐ **The question, his (2026-09-21):** when a music symbol sits inside a line of words — today only
> the note of a metronome mark, `Allegro ♩ = 120` — **where does it sit VERTICALLY against the words'
> baseline, and how big is it against the words?** *"we have no research about this… another can check
> the literature."*
>
> ⛔ **This is a SURVEY, not a plan and not a decision.** It quotes four treatises, MEASURES eighteen
> of their own printed metronome marks off the scans, and lists options **unranked** (§5). It chooses
> nothing.
>
> 📄 The ENGINES' side (MuseScore, LilyPond, Verovio, and the font files) is the sibling survey,
> `docs/research/symbol-in-text-baseline-engines.md` — ⛔ nothing here is a claim about what the
> engines do. `docs/research/tempo-marks-research.md` covers the mark's model and placement, and
> `docs/research/score-text-roles-research.md` §2–§3 the SIZE of the tempo words and of the
> metronome TYPE; neither is repeated here.
>
> ⚠️ Everything below was read or measured on **2026-09-21**. §6 lists what was NOT established.

Sources: the library indexed by `reference/README.md` — Gould *Behind Bars* (PDF page = printed + 20),
Ross *The Art of Music Engraving and Processing* (appendix pages `A-nn`; PDF 267 = A-45), Gerou & Lusk
*Essential Dictionary of Music Notation* (2-up scan; PDF 73 = pp. 142–143), Stone *Music Notation in
the Twentieth Century* (2-up scan, not a simple offset). Every quotation in §1 was read off the
rendered SCAN, not the OCR layer.

---

## 0. Questions

1. What do the books SAY about the metronome mark's note — size, vertical position, the space
   round `=`, the stem, parentheses, the type of the number? (§1)
2. What do they DRAW? In their own printed marks: where is the notehead against the words'
   baseline, how tall is the note against the capitals and the digits, how wide the head, how
   tall in staff spaces? (§2–§4)
3. Do the books agree with each other? (§4)
4. What does that leave as options for a house style? (§5 — unranked)

---

## 1. What the books SAY — verbatim

| # | source | printed p. / PDF p. | verbatim | what it settles |
|---|---|---|---|---|
| 1 | **Ross** | **A-45** / PDF 267 | *"These settings are listed in two ways. Sometimes they include the initials **M.M.** ♩ = 60, meaning 60 half notes per minute or without the initials ♩ = 100, meaning 100 quarter notes per minute. The initials are usually set in a bold Roman type about lyric size while the numbers are in a medium Roman type of the same size. **A cue size note to match the type is used. A regular size note is never used.**"* | the note is CUE size, chosen *"to match the type"*; the number is medium (not bold) roman, *"about lyric size"* |
| 2 | **Gerou & Lusk** | **p. 143** (entry *Tempo marks → With metronome marks*) / PDF 73, right half | *"The metronome mark may be **specific**, a tempo **range** or **general**. The type is slightly smaller than that of the tempo and is usually enclosed in parentheses. **The note is cue size or smaller.**"* | cue size **or smaller**; type a little under the tempo's; parentheses usual |
| 3 | **Gould** | **p. 183** / PDF 203 (*Metronome markings*) | *"A metronome marking may be given alone as a tempo indication. Otherwise it follows the tempo indication. It requires brackets only to confirm a current or previously stated tempo, e.g. **Tempo I** (♩ = 56), or to clarify a tempo equation"* | order (after the words); parentheses ONLY for a confirmation — ⚠️ disagrees with row 2's *"usually enclosed"* |
| 4 | **Gould** | **p. 185** / PDF 205 (*Tempo equations*) | *"Cue-sized notes above the stave indicate note-value equivalents between tempi. They must be carefully placed so as not to be ambiguous."* | her only SIZE word for a note set among tempo text — said of the EQUATION's notes. ⚠️ She says nothing of the metronome mark's own note; but the two are the same drawn glyph at the same size in her figures (§3, G6–G8) |
| 5 | **Gould** | **p. 182** / PDF 202 (*Tempo indications → Design*) | *"Tempo indications are printed in bold roman type and are usually larger than other text so as to be very conspicuous."* | the WORDS only (already in `score-text-roles-research.md` §2). ⚠️ No sentence gives the metronome number's type; her figures set it in REGULAR roman, smaller than the bold word (§3) |
| 6 | **Stone** | **p. 159** / PDF 90, right half (*Conductor's Signs → B. Metronome Marks → 1. In symbolic notation*) | *"The usual indications should be used, but large enough for easy reading."* | nothing about form; *"the usual"* is assumed known |
| 7 | **Stone** | **p. 128** / PDF 75 (*Durational Equivalents → C. Metronome Marks*) | *"It is often advisable to add metronome marks to the new note-value"* … *"(In complex music, repeat metronome in parentheses on each new page.)"* | usage only |
| 8 | **Ross** | **A-46** / PDF 268 (*Tempo marks*) | *"These types should never appear in a smaller size than the text — preferably in 10 to 12 point."* | the WORDS (already recorded). ⚠️ Our notes cited A-46 for the metronome; the metronome paragraph is **A-45** |

**What NO book we hold states in words:** the note's VERTICAL position against the text (baseline,
x-height, centring — not one sentence in any of the four); the space either side of `=`; whether the
stem or flag is shortened; whether the number is lining or old-style. Those are answered only by
what they drew — §3.

---

## 2. Method of measurement

- **Render:** `pdftoppm -r 600 -png` (Ross: `-r 720`), one page per example; crop; threshold to ink;
  8-connected components in plain PIL (no numpy here). Each glyph = one component → its bounding box.
  Scripts and crops: `<scratchpad>/books-baseline/{m.py,head.py,staff.py}` (not kept in the repo).
- **Baseline** = the bottom row of the mark's own DIGITS (flat-bottomed `1`, `4`, `7` where there is
  one; round digits overshoot by ≤ 1 px at these sizes). Where the tempo word is on the same line its
  capital's foot was checked against the digits' (they agree within 1 px in every Gould and G&L case;
  G&L's page is skewed ≈ 4 px per 1100 px, so the digits NEXT to the note are the baseline used).
- **Cap height** = a flat capital of the tempo word on the same line (`A`, `T`, `M`), else "—".
  **Digit height** = the mark's own digits. **x-height** = a flat lowercase (`r`, `n`) of the same line.
- **Notehead top** = the first row, in the lower 60 % of the note, whose ink width exceeds the stem's
  by 35 % of (max width − stem width); notehead height = from there to the note's bottom. It is the
  bounding height of the TILTED ellipse, comparable with a font's notehead bbox (1.0 sp at full size).
- **Staff space** = mean gap of the five staff-line centres (rows > 70 % ink over a wide x-window).
- ⚠️ **Error.** What limits it is the scan's NATIVE resolution, not the render: Gould **238 ppi** grey
  JPEG (1 native px = 2.5 px @600 ⇒ **±2–3 px ≈ ±0.05 cap-height**); G&L **300 ppi**, 1-bit JBIG2 mask
  (±2 px @600 ≈ ±0.03; ⚠️ JBIG2 may substitute look-alike glyph bitmaps); Ross **360 ppi**, 1-bit
  (±2 px @720 ≈ ±0.03); Stone **300 ppi** grey (±2 px ≈ ±0.04 of his 51 px digits). Moving the
  threshold 90 → 190 moved Gould's edges by ≤ 1 px and lengthened only the (grey, thin) stem; all
  Gould rows use threshold 190 so the stem's top is caught. Ratios of two lengths on the same glyph
  row carry roughly ±5 %.

Sign convention: **`bottom − baseline` > 0 means the notehead's bottom is BELOW the words' baseline**,
< 0 above it, as a fraction of the cap height (or of the digit height where no capital is present —
marked `d`). For scale: a head CENTRED on the baseline would read about **+0.20…+0.30**.

---

## 3. What the books DRAW — eighteen marks, four books (seventeen with a baseline to measure against)

Pixel values are at the render resolution of §2. `note h` = whole note (head bottom → stem top).

| id | where (so it can be re-measured) | cap h | digit h | x-h | note h | head h × w | **bottom − baseline** (px → ÷cap) | **note ÷ cap** | note ÷ digit | head w ÷ `0` w | staff sp → note / head in sp |
|---|---|---|---|---|---|---|---|---|---|---|---|
| G1 | **Gould p. 183**, 1st figure, `♩ = 100` over the 4/4 bar, same line as **Allegro** | 54 | 46 | 37 | 76 | 22 × 26 | 0 → **0.00** | **1.41** | 1.65 | 0.81 | 26.5 px → **2.87 / 0.83** |
| G2 | **Gould p. 183**, running text, *Tempo I (♩ = 56)* — the BOOK's text face | 56 | 48 | 39 | 76 | 22 × 27 | 0 → **0.00** | **1.36** | 1.58 | — | — |
| G3 | **Gould p. 183**, the equation line `←♪. = ♩ → (♩ = 100)`, the bracketed mark | — | 47 | — | 77 | 22 × 26 | 0 → **0.00** `d` | — | 1.64 | 0.80 | — |
| G4 | **Gould p. 177**, poly-tempo table, left column, `♩ = 60` | — | 47 | — | 76 | 22 × 26 | −1 → **−0.02** `d` | — | 1.62 | 0.79 | — |
| G5 | **Gould p. 177**, same table, right column *alternative notation*, `♩ = 60` | — | 47 | — | 77 | 22 × 26 | −1 → **−0.02** `d` | — | 1.64 | 0.79 | — |
| G6 | **Gould p. 185**, `♪ = 126 poco accel.` — an EIGHTH, with its flag | — | 46 | 38 | 74 | — | 0 → **0.00** `d` | — | 1.61 | — | — |
| G7 | **Gould p. 614**, *Score sample 1*, flute, **Con moto** `♩ = 60` | 49 | 46 | 35 | 73 | 21 × 25 | 0 → **0.00** | **1.49** | 1.59 | 0.81 | 23.75 px → **3.07 / 0.88** |
| G8 | **Gould p. 185**, last figure, the equation `𝅗𝅥 = ♩` over the 3/2–3/4 barline — *"cue-sized"* in her own words (§1 row 4); no words on the line | — | — | — | 75–76 | — | — | — | — | — | 26.5 px → **2.85** |
| L1 | **Gerou & Lusk p. 143**, **Allegro con moto** `(♩ = 144)` | 68 | 56 | 46 | 115 | 29 × 34 | +3 → **+0.04** | **1.69** | 2.05 | 0.89 (÷ `4`) | — |
| L2 | **G&L p. 143**, `(♩ = 132–144)` | 67 | 57 | 46 | 115 | 29 × 34 | +4 → **+0.06** | **1.72** | 2.02 | — | — |
| L3 | **G&L p. 143**, `(♩ = ca. 144)` | 68 | 58 | 46 | 115 | 28 × 36 | +2 → **+0.03** | **1.69** | 1.98 | — | — |
| R1 | **Ross p. A-45**, running text, **M.M.** `𝅗𝅥 = 60` (a HALF note) | 73 | 73 | 47 | 121 | 45 × 60 | −4 → **−0.05** | **1.66** | 1.66 | 1.25 (÷ `6`) | — |
| R2 | **Ross p. A-45**, running text, `♩ = 100` | 73 | 75 | 47 | 113 | 45 × 60 | −8 → **−0.11** | **1.55** | 1.51 | 1.20 | — |
| S1 | **Stone p. 92**, running text, *"at the rate of ♩ = 140"* | ≈52 (ascender) | 51 | 35 | 72 | 20 × 26 | −7 → **−0.14** `d` | 1.38 | 1.41 | 0.81 | — |
| S2 | **Stone p. 92**, next line, *"the ♩ = 175 of the…"* | ≈52 | 52 | 35 | 71 | 20 × 26 | −0.5 → **−0.01** `d` | 1.37 | 1.35 | — | — |
| S3 | **Stone p. 93**, *"beginning with ♩ = 101"* | ≈52 | 51 | 35 | 72 | 20 × 24 | +3.5 → **+0.07** `d` | 1.38 | 1.41 | — | — |
| S4 | **Stone p. 127**, *"Or, to make doubly sure"*, `←♪. = ♩ = 72→` over the 9/12–3/4 barline | — | 38 | — | 73 | 20 × 25 | +0.5 → **+0.01** `d` | — | 1.92 | — | 28.7 px → **2.55 / 0.70** |
| C1 | **Stone p. 92**, the quoted Carter quartet plate (AMP, © 1961), m. 584, `♩ = 101` — ⚠️ a small, blurred reproduction: ±3 px on a 41 px digit | — | 41 | — | 50 | 19 × 29 | −3 → **−0.07** `d` | — | 1.22 | — | ≈ 20 px → ≈ **2.5** (⚠️ staff lines barely resolved) |

**Other things read off the same crops**

| quantity | Gould | Gerou & Lusk | Ross | Stone |
|---|---|---|---|---|
| gap note → `=` and `=` → number, ÷ digit height | 0.52 / 0.54 (G1); 0.54 / 0.41 (G7) | 0.70 / 0.55 (L1) | 0.65 / 0.95 (R2 — letter-spaced text) | 0.67 / 0.65 (S1); 0.84 / 0.82 (S4) |
| whole note ÷ notehead height (a full-size quarter ≈ 4.0: 3½ sp stem + half a head) | **3.45** | **3.97** | **2.5** (quarter), 2.7 (half) — a visibly SHORT stem | **3.6**; Carter **2.6** |
| notehead height ÷ x-height of the words | 0.56–0.60 | 0.61–0.63 | **0.96** | 0.57 |
| the number's weight and size vs the tempo word | regular roman beside a BOLD word; digits ÷ word's cap = **0.85** (G1), **0.94** (G7) | BOLD, digits ÷ cap = **0.82–0.85** (*"slightly smaller"*, as written) | medium roman; digits = cap (*"the same size"*, as written) | running text only |
| the flag (G6) | an eighth is the same height as the quarter (74 vs 76 px): flag inside the stem's length | — | — | — |
| parentheses | span from above the digits' top to below the baseline (58 px on 48 px digits, G2) — the text face's own | bold, the text face's own | — | — |

---

## 4. What the measurements say

1. **Where the notehead sits.** In **0 of 17** is the head centred on the baseline (that would read
   ≈ +0.2…+0.3). In **0 of 17** does it hang clearly below. The whole population lies between
   **−0.14 and +0.07** of a cap height:
   - **on the baseline within the error (|Δ| ≤ 0.03): 10 of 17** — all seven of Gould's that have a
     baseline (G1–G7), G&L's L3, Stone's S2 and S4;
   - **a hair BELOW it (+0.04…+0.07): 3 of 17** — G&L's L1, L2 and Stone's S3; the size of a round
     letter's overshoot, and for G&L inside two error bars of zero;
   - **ABOVE it (−0.05…−0.14): 4 of 17** — both of Ross's, Stone's S1, the Carter plate.
2. ⚠️ **Stone's three running-text marks disagree with EACH OTHER** (−0.14, −0.01, +0.07 on one
   spread, same face, same note). That is a note stripped into phototypeset text by hand; the spread
   (≈ 10 px @600 ≈ 0.4 mm) is the paste-up's tolerance, not three rules. Ross's two differ the same way
   (−0.05, −0.11). Gould's seven and G&L's three — set by computer — repeat to the pixel.
3. **Ross's note is a different design**, not just a different position: a head as tall as the
   x-height (0.96) on a short stem (whole note 2.5 head-heights), floating 4–8 px above the baseline so
   that the head roughly fills the x-height band (its centre at 0.55–0.64 of the x-height). The other
   three books draw a head a little over HALF the x-height (0.56–0.63) on a nearly full-proportion stem.
4. **How tall the note is.** Note ÷ cap height of the accompanying words: **Gould 1.36–1.49**, **Stone
   ≈ 1.38**, **Ross 1.55–1.66**, **G&L 1.69–1.72**. Every one is TALLER than the capitals; none is below
   1.2 even against its digits (Carter 1.22, the lowest). Against the mark's own digits: Gould
   1.58–1.65, Ross 1.51–1.66, Stone 1.35–1.41 (1.92 over a staff, where his digits are small), G&L
   1.98–2.05.
5. **How tall in staff spaces** (only where a staff is in the figure): **Gould 2.85–3.07 sp**, head
   **0.83–0.88 sp** (0.75 sp at a stricter threshold); **Stone 2.55 sp**, head **0.70 sp**; Carter ≈ 2.5
   sp. For comparison Stone's own stem chapter (pp. 47–49, already in `reference/README.md`) gives a
   cue note's stem as ≈ 3 sp and a grace's ≈ 2½ — so what Gould and Stone DRAW is consistent with the
   word all three writers use, **"cue size"**.
6. **Head width** is 0.8 of the digit `0`'s width in Gould and Stone, 0.9 of a `4` in G&L, 1.2 in Ross.
7. **The gaps round `=`** are about **half to two-thirds of the digit height** each side and roughly
   equal (Gould ≈ 0.4–0.55, Stone and G&L ≈ 0.55–0.7; 0.8 against Stone's small over-staff digits); Ross's right-hand gap is wider because his text is
   letter-spaced.
8. **Agreement between books:** on the vertical — good (nobody centres the head on the baseline;
   computer-set examples put its bottom on the baseline to the pixel; hand-set ones scatter around
   and slightly above it). On the SIZE against the words — a real spread, 1.36 to 1.72 cap-heights,
   with the book that writes *"cue size or smaller"* (G&L) drawing the TALLEST note.

---

## 5. Options the evidence supports — listed, NOT ranked

Each is a house-style row a user could pick; the counts are out of the 18 marks of §3 (17 where a
baseline exists — G8 has no words).

**Vertical**

- **Notehead bottom ON the words' baseline** — 10 of 17 within the error, 15 of 17 within ±0.07 cap;
  every computer-set example (Gould ×7, G&L ×3). This is what runs today (2026-09-21).
- **Notehead bottom a round-letter overshoot below the baseline (+0.03…+0.07 cap)** — 3 of 17 (G&L ×2,
  Stone ×1); indistinguishable from the first within two error bars.
- **Notehead raised off the baseline (−0.05…−0.14 cap), a head about one x-height tall filling the
  x-height band** — 4 of 17, and the ONLY form in Ross (×2), the one hand-engraver's book of the four.
- ⛔ *Head centred on the baseline* (the SMuFL music-font cut described in the engines survey) —
  **0 of 17**.

**Size**

- **Note ≈ 1.35–1.5 × the words' cap height** — Gould ×3 with a capital (1.36, 1.41, 1.49), Stone ×3 (≈ 1.38).
- **Note ≈ 1.55–1.7 × cap height** — Ross ×2 (1.55, 1.66), G&L ×3 (1.69–1.72).
- **Note stated in STAFF SPACES, as a cue note: ≈ 2.5–3.1 sp whole, head ≈ 0.7–0.88 sp** — Gould ×3
  (2.85, 2.87, 3.07), Stone ×1 (2.55), Carter ×1 (≈ 2.5); and it is the only size the books state in
  WORDS (Ross, G&L, Gould: *"cue size"*; G&L: *"or smaller"*; Ross: *"to match the type"*).
- **Note sized to the TYPE, not the staff** — Ross's sentence (*"a cue size note to match the type"*)
  and G2/S1–S3/R1–R2, which sit in running text with no staff at all.

**Stem**

- **Near-full proportion (whole ÷ head ≈ 3.5–4.0)** — Gould ×8, G&L ×3, Stone ×4: 15 of 18.
- **Short stem (≈ 2.5–2.7)** — Ross ×2, Carter ×1.

**The number's type**

- **Regular roman, a step under the bold tempo word (digits ÷ cap 0.85–0.94)** — Gould ×2.
- **Bold like the word, a step under it (0.82–0.85)** — G&L ×3, and its sentence.
- **Medium roman, "about lyric size", same size as any initials** — Ross, in words.

**Parentheses**

- **Only to CONFIRM a tempo or clarify an equation** — Gould p. 183. **"Usually enclosed"** — G&L p. 143.

For placing today's numbers on the same scale (⚠️ arithmetic from the figures given with the
question, not a measurement of our output): an 18 pt word in a face with cap height 0.722 em
(`score-text-roles-research.md` §2) has a 13.0 pt capital; at a 7.5 pt staff space Gould's drawn
2.85–3.07 sp note would be 21.4–23.0 pt tall (1.65–1.77 × that capital) and her 1.36–1.49 × cap would be
17.7–19.4 pt. Her figures' tempo word is itself ≈ 2.05 sp in cap height, larger than ours (1.73 sp),
which is why the two readings of "Gould's size" differ.

---

## 6. UNKNOWN — not established here

- ⛔ **Gardner Read, *Music Notation*** — not on disk (`reference/README.md` §*Still missing*).
  **UNKNOWN**, not silent. Likewise **Chlapik**, **Wanske**, the Boosey & Hawkes house manual.
- **WHY** Gould's and G&L's notes stand on the baseline — a rule of theirs or the default of the
  text font / notation program that set them — is UNKNOWN; no sentence in either book says. Gould's
  note is one identical glyph at one size in every figure measured (76 ± 1 px), in the music
  examples AND in the book's running text, which points at one font, not at per-figure decisions.
- **A hand-engraved SCORE page** with a metronome mark at readable resolution: only the Carter
  quotation (C1), too small to trust beyond ±0.07. Ross's book has NO metronome mark in any music
  plate (searched its whole text layer); his two are in running text.
- **Dotted** beat units (`♩. = 60`): where the dot stands against the baseline was not measured
  (Gould p. 183's equation and p. 177 have dotted notes; Stone p. 127 too).
- **Half-note** marks: one only (R1). Whether an open head is sized or placed differently is not
  established from one example.
- **Beat units with a DOWN stem**, or any other symbol inside words (a fermata, a segno in
  *"D.S. al 𝄋"*, a dynamic inside an expression — *"poco **f**"*): not looked at. The question was
  asked of the metronome note only.
- Whether the digits are lining or old-style, stated in words: no book says. Every measured mark
  uses LINING digits (all digits one height, on the baseline).
- The JBIG2 caveat on G&L (§2) was not tested; its three notes are pixel-identical in height
  (115 px), which a symbol-substituting encoder would also produce.

---

## 7. For `reference/README.md` — what this run learned (NOT written there; this agent may touch no other file)

- **Ross's metronome paragraph is p. A-45 (PDF 267), not A-46.** A-46 (PDF 268) is *Tempo marks*.
  The appendix does not follow the body's `+12` offset.
- **Gerou & Lusk's PDF is 2-up**: PDF 73 = printed pp. 142–143.
- **Stone's *Metronome Marks* are printed pp. 128 (PDF 75) and 159 (PDF 90, right half)**; his
  running-text marks `♩ = 140 / 175 / 101` are on pp. 92–93 (PDF 57), with a quoted Carter plate.
- **Native scan resolutions** (from `pdfimages -list`): Gould 238 ppi grey JPEG · G&L 300 ppi 1-bit
  JBIG2 + 100 ppi background · Ross 360 ppi 1-bit JBIG2 + 120 ppi background · Stone 300 ppi grey.
  ⇒ rendering Gould above ≈ 480 dpi adds no information; the README's "450 dpi, 1 sp = 20 px" is right.
- **Where Gould's metronome marks are, for re-measuring** (PDF pages, from a regex over the text
  layer): 197, 203–206, 306, 313, 319, 324, 346, 385, 402, 428, 570, 580, 584, 598, 613, 622, 626,
  630–636, 638–639, 644, 647, 655 (has a half-note unit), 666, 668.
- What this question was asked, and what came back: **no book states the note's vertical position
  in words; all four say or draw "cue size"; the scans put the notehead's bottom on the baseline
  (Gould, G&L) or slightly above it (Ross, hand-set Stone), never centred on it.**
