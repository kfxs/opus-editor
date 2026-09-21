# Setting the music in another SMuFL font — Leipzig and Sebastian first

> **Status: PLAN, 2026-09-21. Nothing built.** His ask: *"include other SMuFL in the project… start
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

**Done when:** with Leipzig/Sebastian selected, weights and ink extents are the font's own; with
Bravura selected every suite is green and unchanged. Specs: one jsdom test per generated table
(totality + declared fallbacks), and `fontMetrics` tested against a non-default table.

## 4. Not in this plan

- Text fonts (rule 2) · the choice in the score JSON / a house style (rule 1) · anchors at draw time
  (`stemUpSE` would move Bravura's stems 0.168 sp — a pixel change, its own decision) · the Finale
  faces, Gootville, Gonville (no metadata — `multi-font-research.md` §5) · Leland / Petaluma /
  MuseJazz (each is a row after B; ⛔ not scheduled) · the `ss01` small-staff masters.

## 5. Open — his call, none blocks A

1. B4's split: which ink rows follow the font on day one, and which wait.
2. Whether the dropdown later graduates to a real surface (a Score ▸ Music Font row) or waits for
   house styles.
