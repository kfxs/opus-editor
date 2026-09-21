# Setting the music in another SMuFL font — Leipzig and Sebastian first

> **Status: Phase A ✅ (his check passed, `6546887`) · Phase B BUILT 2026-09-21, awaiting his UI check.** His ask: *"include other SMuFL in the project… start
> with Leipzig and Sebastian… in the dev shell a dropdown to select the font so we see how it renders
> when it changes (still experimental, but worth to manage this from now)."* Decided the same day:
> **A first, then B.**
>
> 📄 The research is done and is not repeated here: `docs/research/smufl-fonts-research.md` (which free
> fonts, licences, coverage, how a font arrives) and `docs/research/multi-font-research.md` (VexFlow
> carries NO per-font data — a font there is a CSS family string plus run-time `measureText`; MuseScore
> bundles a metadata JSON per font, measures boxes from the font file, and takes a missing glyph WHOLE
> from Bravura). `docs/plans/font-metrics-plan.md` is how Bravura's table is generated today.

## 0. Rules this plan stands on

1. **EXPERIMENTAL, and scaffolding says so.** The dropdown is dev-shell scaffolding like the 🔧 DEV
   sound picker. ⛔ The choice is NOT in the score JSON and not persisted; it becomes a house-style
   row the day house styles exist.
2. **The MUSIC font and the TEXT font are two choices.** This plan switches the music face only;
   words stay in Academico. ⏭️ Multi-font TEXT is its own later plan — Sebastian Text is the first
   candidate (`docs/research/score-text-fonts-research.md`). ⛔ Do not couple them: no "Sebastian ⇒
   Sebastian Text" rule here.
3. **Bravura stays the default, and every spec stays pinned to it.** No number moves while Bravura is
   selected — A and B are both *no pixel moved* for the default font. A switched font is checked by
   his eye in the dev shell, not by the suites.
4. **A missing glyph comes WHOLE from Bravura** (MuseScore's rule): its drawing, its box and its
   anchors from the one font — ⛔ never a Bravura number on another font's outline. Every fallback is
   a DECLARED row, reported by the generator, never silent.
   🚨 **ONE EXCEPTION — the CHANGE CLEF** (his rule, 2026-09-21, `docs/how-it-works/clef.md` §0.2b): a
   face without `gClefChange`/`cClefChange`/`fClefChange` draws ITS OWN full clef reduced by the
   ratio, as today — ⛔ never Bravura's small clef in another face's score. When the `*Change` glyphs
   are adopted they must NOT join `FALLBACK_GLYPHS`, and the test asks the chosen face alone.
   ⚠️ **…and it is probably not the only one — BE AWARE, and write each down here when met** (his
   note, 2026-09-21). The automatic Bravura fallback is safe for a glyph that stands ALONE (a
   `bracket`). It is suspect for a glyph that is one of a FAMILY the eye reads together, where one
   borrowed member sits beside the face's own: the three noteheads, a flag against its stem and head,
   the meter's digits (one Bravura digit inside `12`), a dynamic's letters (`m` beside the face's
   `f`), an accidental beside its key signature, a brace alternate beside the face's `brace`. None
   of these is missing from Leipzig or Sebastian today (their borrowed glyphs are brackets and brace
   alternates); the rule when one turns up is the clef's — fall back as a FAMILY or to the face's own
   means, ⛔ not one glyph at a time. `FALLBACK_GLYPHS` and the dev picker's tooltip are where a new
   case becomes visible.
5. **The UI chrome keeps Bravura.** The Keypad (baked outlines), the windows' pictures and the menus
   name Bravura on purpose; they are the interface's face, not the score's.
6. A new feature adds a MODULE: the active font is `engine/fonts/musicFont.ts`, ⛔ not a field on
   `MusicEngine` / `ScoreRenderer` beyond a one-line delegation.

## 1. The two fonts

| | source | licence | metadata | missing of what we draw (measured 2026-09-13 on 67 glyphs — ⚠️ re-measure on today's 73) |
|---|---|---|---|---|
| **Leipzig** | `~/dev/engine-sources/verovio/fonts/Leipzig/` (`Leipzig.ttf` + `leipzig_metadata.json`) — or `rism-digital/verovio` | OFL-1.1 | 28 defaults · 50 anchors | `bracket`, `reversedBracketTop/Bottom` |
| **Sebastian** | npm `@vexflow-fonts/sebastian` or `fkretlow/sebastian` | OFL-1.1 | 29 defaults · 53 anchors | `bracket` |

Each arrives as Bravura did: the font file + its licence text in `public/fonts/`, the metadata JSON in
`scripts/vendor/` (build-time only) with a row in `scripts/vendor/PROVENANCE.md` (source URL, version,
date fetched). opentype.js reads TTF and OTF alike. ⚠️ No anchor has a consumer today
(`multi-font-research.md` §4), so 50 anchors costs nothing yet.

## 2. Phase A — swap the FACE (glyphs change; spacing and weights stay Bravura's)

What it gives: the dropdown, the plumbing, and a first look. ⚠️ What it knowingly leaves wrong for a
non-Bravura font: ink extents in `layout/spacingPadding`, and every line weight (stem, beam, barline,
ledger, slur) are still Bravura's. That is B.

- **A1 — the files.** Leipzig + Sebastian into `public/fonts/` with their licences; two rows in
  `FONT_FILES` (`role: 'music'`, `display: 'block'`). The PDF export reads the same table, so it
  follows.
- **A2 — `engine/fonts/musicFont.ts`: the active music font, ONE owner.** `MUSIC_FONTS` (a row per
  face: id, CSS family, label), `activeMusicFont()`, `setActiveMusicFont(id)`, and
  `musicFontStack()` = `'<family>,Bravura,Academico'` — Bravura behind the chosen face IS rule 4 for
  the drawing: the browser takes a glyph the face lacks from Bravura. No DOM (`fonts/` is fenced).
- **A3 — the two roots ask it.** `fontCategories.FONT_TREE`'s root `fontFamily` and
  `inheritedFonts.MUSIC_FONT_STACK` become reads of `musicFontStack()` (⚠️ `ROOT_FONT_FAMILY`,
  `NOTE_FONT`, `MUSIC_GLYPH_FONT` are module-level constants today ⇒ functions). The three strays that
  spell `Bravura` in the SCORE's drawing — `dynamicStyle.ts`, `DynamicsLayout.ts`'s tspan,
  `DynamicTextSource.ts` — ask the same module. ⛔ Not the windows / Keypad / menus (rule 5).
- **A4 — a switch re-engraves everything.** The font joins `ScoreRenderer.layoutStateKey` (and so
  `viewStateKey`): widths were memoised in the old face, so the width cache and the casting-off must
  go stale, and every bar redraws. ⚠️ Read `docs/ARCHITECTURE.md`'s width key / shape
  key section before touching the keys — a missed key fails silently (the bar never redraws). The switch waits for the face to load
  (`document.fonts.load`) before the render — a `.notdef` box engraved as a notehead is wrong ink.
- **A5 — the dropdown.** `dev/devToolbar`: a 🔧 DEV font `<select>` beside the sound picker, same
  dashed-amber scaffolding style, built from `MUSIC_FONTS`. It calls the setter and asks for a
  render; nothing else knows it exists.
- **A6 — PDF export** asks `activeMusicFont()` for which face to outline, with Bravura as the
  per-glyph fallback (rule 4: `charToGlyph` index 0 ⇒ take the glyph from Bravura).

> ✅ **As built (2026-09-21).** Files from npm `@vexflow-fonts/leipzig` / `sebastian` 1.0.1 (OTF rev
> 5.200 / 1.010; licences beside them as `public/fonts/<Family>-OFL.txt`). Coverage re-measured on
> today's 73 glyphs: **Sebastian lacks `bracket`; Leipzig lacks `bracket`, `reversedBracketTop/Bottom`
> and Bravura's four brace alternates** — all drawn in Bravura through the stack. ⭐ A music face
> nobody chose is NOT fetched at startup: `musicFontFaces.loadMusicFont` brings it in on the pick.
> A4 needed ONE line more than planned: the font's generation is in `laneFingerprint` (the width
> key) as well as `layoutStateKey` — the shape key embeds it, and without it every bar's old `<g>` is
> replayed (`e2e/musicFontSwitch.e2e.ts`, break-tested). A6 needed no code: the PDF outliner already
> walks the computed `font-family` stack per character with a coverage check. The picker is
> `dev/musicFontPicker.ts`; the frozen rows that became functions: `rootFontFamily`, `noteFont`,
> `musicGlyphFont`, `tempoTextFont`, `dynamicAnnotationFont`.

**Done when:** he picks Leipzig / Sebastian / Bravura in the dev shell and the score re-renders in it;
back on Bravura nothing has moved (unit + e2e green, unchanged). ⏸️ Stop for his UI check.

## 3. Phase B — the font's own METRICS

- **B1 — the generator takes a font.** `scripts/generate-font-metrics.mjs` gets a font table (file,
  metadata, out) instead of four constants, and writes `bravuraMetrics.ts` (⛔ byte-identical — the
  proof nothing moved), `leipzigMetrics.ts`, `sebastianMetrics.ts`, all of ONE shape. A glyph the
  font lacks is no longer a refusal: it is emitted **from Bravura, box and anchors together**, listed
  in a `FALLBACK_GLYPHS` export and in the generated header. ⛔ Still a refusal if BRAVURA lacks it.
  `engravingDefaults` a font does not state fall back the same way, declared the same way.
- **B2 — `fontMetrics` reads the ACTIVE table.** Same API (`glyphBox`, `anchor`, `engravingDefault`,
  the compositions), now through `activeMusicFont()`. `GlyphName` stays one union — every table is
  total over it (that is what B1's fallback buys).
- **B3 — the six frozen constants thaw.** `THIN_LINE_SPACES`, `HAIRPIN_LINE_SPACES`
  (`layout/thinLineWeight`), `THICK`, `DOT_SEPARATION`, `DOT_WIDTH` (`layout/barlineSign`),
  `CROSS_SYSTEM_BEAM_WIDTH` (`beams/beamInk`) are computed at import ⇒ they become functions, and
  their readers call them. ⚠️ Sweep for the same shape one level up (a module constant derived from
  one of these).
- **B4 — the ink table.** `layout/spacingPadding`'s literals are Bravura's, gated by
  `spacingPadding.font.test.ts`. They STAY the default's literals and the gate stays Bravura's; for
  another font the rows that are FACTS ABOUT THE FONT (notehead ink, rest widths/heights, accidental
  glyph widths, flag reach) are read from the active table, and the HOUSE-STYLE rows (paddings,
  floors, `MAY_KERN`) are shared. ⛔ An engraving number is never a blocker: where the split is not
  clean for a row, it keeps Bravura's value and is listed as a follow-up.
- **B5 — the fallback, seen.** The dev shell shows which glyphs the chosen font took from Bravura
  (the `FALLBACK_GLYPHS` row) — so a bracket that does not match is explained, not puzzling.

> ✅ **As built (2026-09-21).**
> - **B1** `bravuraMetrics.ts` regenerated BYTE-IDENTICAL; the generator's second half writes
>   `leipzigMetrics.ts` (66 measured · 7 from Bravura) and `sebastianMetrics.ts` (72 · 1: `bracket`),
>   one shape, total, `FALLBACK_GLYPHS` / `FALLBACK_DEFAULTS` declared (both lack only
>   `thinThickBarlineSeparation`). Codepoints are NOT per face. 🚨 **Sebastian is upstream's 1.35, not
>   npm's 1.01** — the npm OTF disagreed with its own metadata on 38 of 73 boxes
>   (`scripts/vendor/PROVENANCE.md`); ⚠️ this replaced the file Phase A shipped.
> - **B2** `fontMetrics` reads `FONT_TABLES[activeMusicFont().id]`; `fallbackGlyphs()` /
>   `fallbackDefaults()` are B5's readers. Spec: `fontMetrics.faces.test.ts`.
> - **B3** NINE frozen answers, not six: + `layoutConfig.LEDGER_LINE_STYLE` (→ `ledgerLineStyle()`) and
>   `curveStyle.CURVE.thickness/outline` (→ getters; `CURVE_PX` is live row by row; `curveArc`'s copy
>   thawed). The rest became `thinLineSpaces()` · `hairpinLineSpaces()` · `thinBarlineSpaces()` ·
>   `thinBarlinePx()` · `crossSystemBeamWidth()` and four locals in `barlineSign`.
> - **B4** ONE row follows the face — `restBand`, the only row that IS the font's box digit for digit.
>   Every other row keeps Bravura's literal for every face (follow-up 1).
> - **B5** the picker says "N from Bravura"; its tooltip names the glyphs and defaults.
>
> ⚠️ **What a face's own defaults DO, seen in the numbers** — Leipzig states `staffLineThickness` 0.08
> (Bravura 0.13): our hairpin is that weight, so it thins; and our ledger line is a RATIO
> (`leger/staff` × the 1 px staff line we draw) = 0.16/0.08 = **2×** in Leipzig against 1.23× — the
> rule is right only while the staff line itself is the font's, which it is not yet (follow-up 2).
>
> **Follow-ups — none blocks; each keeps today's value until decided:**
> 1. ✅ **BUILT 2026-09-21 (his word: "lets do 1").** `fontMetrics.differenceFromDefault(quantity)` —
>    exactly 0 on Bravura, the question not even asked — and `layout/spacingPadding`'s font-fact rows
>    are `literal + that difference`: `INK`/`INK_HEIGHT` rows are getters, `REST_WIDTH`/`REST_HEIGHT`/
>    `ACCIDENTAL_WIDTH`/`ACCIDENTAL_HEIGHT` shift inside their functions, and `MIN_COLUMN_GAP` /
>    `EMPTY_BAR_FLOOR_PX` thawed into `minColumnGap()` / `emptyBarFloorPx()`. ⛔ Judgement rows
>    (`accidentalToHead`, `pairPadding`, `STEM_REACH`) are one house style for every face. Measured:
>    notehead row 1.13 → Leipzig 1.206 · Sebastian 1.230; min column gap 1.43 → 1.506 · 1.530; flag
>    drop 3.3 → Leipzig 2.835. The proposal as written was: a DELTA — `literal + (this face's
>    glyph quantity − Bravura's)`, row by row (`INK.notehead` by `noteheadBlack.right`, `REST_WIDTH` by
>    the rest's `right`, `ACCIDENTAL_WIDTH`/`HEIGHT` by the sign's box, `flagReach`, `dotWidth`,
>    ledgers by `legerLineExtension`). Zero for Bravura by construction, keeps each row's house
>    rounding, and needs `INK` / `MIN_COLUMN_GAP` / `EMPTY_BAR_FLOOR_PX` thawed like B3.
> 2. ✅ **BUILT 2026-09-21.** `fontMetrics.ratioToDefault` (exactly 1 on Bravura) — a WEIGHT scales,
>    it does not shift. The staff line is `staveLineWidthPx()` = Gould's 0.11 × (face's
>    `staffLineThickness` ÷ Bravura's 0.13): Leipzig 0.068 sp, Sebastian 0.11. The stem is
>    `stemThicknessPx()` = 0.15 × (face's `stemThickness` ÷ 0.12): Leipzig 0.095, Sebastian 0.156.
>    ⭐ His house weights are kept as PROPORTIONS of the font's, never replaced by it. ⭐ And this is
>    what cured Leipzig's ledger line: the ledger is `leger/staff` × the DRAWN staff line, and with the
>    staff line now the face's too it comes out 0.135 sp in Leipzig — the same as Bravura's — where it
>    was 2× the staff line. The in-bar BEAM needed nothing: `EngravedBeam` already reads
>    `crossSystemBeamWidth()`, the face's `beamThickness`, since B3 (all three faces say 0.5).
>    ⏭️ Still not the face's: the hairpin is the face's RAW `staffLineThickness` (his eye set it
>    against Bravura's 0.13), stem LENGTH (3½ sp, a rule not a font fact), and the beam gap.
>    As the follow-up was written: what does NOT follow the face yet, because it never read the font: the staff line (1 px),
>    the stem (`STEM_WIDTH` 1.5 px, an inherited row — Leipzig says 0.076 sp, Bravura 0.12), beam
>    thickness in-bar, and every glyph the canvas measures (that already follows, by measurement).
> 3. The UI chrome and the Keypad's baked icons stay Bravura (rule 5).

**Done when:** with Leipzig/Sebastian selected, weights and ink extents are the font's own; with
Bravura selected every suite is green and unchanged. Specs: one jsdom test per generated table
(totality + declared fallbacks), and `fontMetrics` tested against a non-default table.

## 4. Not in this plan

- Text fonts (rule 2) · the choice in the score JSON / a house style (rule 1) · anchors at draw time
  (`stemUpSE` would move Bravura's stems 0.168 sp — a pixel change, its own decision) · the Finale
  faces, Gootville, Gonville (no metadata — `multi-font-research.md` §5) · Leland / Petaluma /
  MuseJazz (each is a row after B; ⛔ not scheduled) · the `ss01` small-staff masters.

## 4a. ⭐ Where this is heading — a CUSTOM GLYPH SET (his note, 2026-09-21)

After seeing A: *"in the future maybe the user can make more custom options, probably for the missing
glyph select instead of bravura one of another font, probably for some glyph even change the glyph
for another font (for example i see bravura glyph for whole note is the nicer one and probably in the
future i will like that glyph in my custom set font)."*

⇒ The real unit is not "a font" but **a glyph set: a base face plus, per glyph, WHICH FACE it is taken
from** — the fallback is just the rows the base face cannot fill, and a taste override (Bravura's
whole note inside Sebastian) is the same row chosen by hand. ⛔ Not built here, but B must not close
the door: B1's tables record **per glyph the face it came from** (that is what `FALLBACK_GLYPHS` is),
and rule 4 already says the box, anchors and drawing of a glyph travel TOGETHER from that one face —
which is exactly what a per-glyph override needs. ⚠️ The drawing half is the open part: a CSS stack
can only express "first face that HAS the glyph", never "prefer Bravura for U+E0A2", so a per-glyph
choice means `glyphPainter` resolving the family per glyph. Its own plan when he asks for it.

## 4b. ⭐ Where this is heading — the HOUSE STYLE owns these decisions (his note, 2026-09-21)

After seeing the weights follow the face: *"in the future we will have housestyle to let also make this
decisions we do now custom to the user (for example i will like to have a version of leipzig with more
thicker staff lines)."*

⇒ Everything this plan DECIDED for the user is a house-style row waiting for its owner, and must stay
shaped so that a user's value can replace ours without touching the code around it:

| what we decide today | where | what a house style would say instead |
|---|---|---|
| the music face | `fonts/musicFont` (dev picker) | a face — or a custom glyph set, §4a |
| a line weight = our proportion × the face's own | `staveLineWidthPx()` · `stemThicknessPx()` (`ratioToDefault`) | **its own weight for that face** — "Leipzig, staff line 0.11" — overriding the derived one |
| an ink row = Bravura's literal + the face's difference | `layout/spacingPadding` (`differenceFromDefault`) | its own row |
| the weights taken straight from the face | `engravingDefault(…)`: beam, barlines, slur, ledger ratio, hairpin | any of them, per style |
| what a missing glyph falls back to | the stack + `FALLBACK_GLYPHS` (Bravura) | another face, per glyph (§4a) |

⭐ The shape that keeps the door open is already the one in use: every one of these is a FUNCTION asked
per use (nothing frozen at import), so a house style is one more layer in front of the same question —
*style's value, else the face's derived one*. ⛔ Not built here; ⛔ and no number above is definitive
(`docs/plans/own-engraving-engine.md` §0.3 rule 13: a default the user will be able to change). A
"Leipzig with thicker staff lines" is then a style = { face: Leipzig, staffLine: 0.11 }, not a new font.

## 5. Open — his call, none blocks A

1. B4's split: which ink rows follow the font on day one, and which wait.
2. Whether the dropdown later graduates to a real surface (a Score ▸ Music Font row) or waits for
   house styles.
