# The fonts we ship — what each is, where it came from, and whether we may use it

> Written 2026-09-21, the day the music face and the words face became choices
> (`docs/plans/music-font-switch-plan.md`, `docs/plans/text-font-switch-plan.md`), to answer his
> question plainly: *"are we allowed to use the fonts we are using?"*
>
> ⚠️ A reading of the licence texts, ⛔ not legal advice. Re-check a licence before shipping a product.

## The answer

**Yes. Every font file in `public/fonts/` is under the SIL Open Font License 1.1** — stated in each
file's own name table (read with opentype.js, 2026-09-21) and in the licence file beside it. The OFL
permits exactly what this editor does with a font:

| what we do | OFL 1.1 |
|---|---|
| bundle the file with the app and serve it to the browser | ✅ *"bundled, embedded, redistributed and/or sold with any software"* (clause 1 only forbids selling the font **by itself**) |
| draw the score with it | ✅ use is unrestricted |
| **outline its glyphs into a PDF the user distributes** (`docs/how-it-works/pdf-export.md`) | ✅ the licence's own preamble: documents created with the fonts are NOT covered by it |
| measure it and check numbers derived from it into the repo (`engine/fonts/*Metrics.ts`) | ✅ measurements are not the Font Software; the metadata JSONs in `scripts/vendor/` are build-time only |

**What the OFL asks of us, and whether we do it:**

1. **The copyright notice and the licence travel with the font** (clause 2) — ✅ one licence file per
   family beside the OTFs. ⚠️ Until 2026-09-21 Academico had none: `OFL.txt` carries **Bravura's**
   copyright line only. `Academico-OFL.txt` now holds Academico's own (from its name table).
2. **A Reserved Font Name may not be used for a MODIFIED version** (clause 3) — every family here has
   one. ✅ We ship every file **unmodified, under its own name**. ⛔ The day anyone edits a glyph,
   subsets a file or converts its format for distribution, that build must be renamed — ⚠️ whether a
   bare woff2 conversion or subset counts as "modified" is **UNKNOWN** here (the OFL FAQ was not
   consulted; `docs/research/music-text-fonts-research.md` §7).
3. **Don't use the authors' names to promote the product** (clause 4) — nothing does.
4. **Derivatives stay under the OFL** (clause 5) — we make none.

## The files

| family (role) | files | version | came from | copyright · Reserved Font Name | licence file |
|---|---|---|---|---|---|
| **Bravura** (music, default) | `Bravura.otf` | 1.392 | Steinberg | © 2021 Steinberg · "Bravura" | `OFL.txt` |
| **Academico** (words, default) | `Academico.otf`, `AcademicoBold.otf` | 0.902 | Steinberg | © 2022 / 2020 Steinberg · "Academico" | `Academico-OFL.txt` |
| **Leipzig** (music) | `Leipzig.otf` | 5.2 | npm `@vexflow-fonts/leipzig` 1.0.1 (same revision as Verovio's own copy) | Darbellay, Marti, Pugin (RISM) · "Leipzig" | `Leipzig-OFL.txt` |
| **Sebastian** (music) | `Sebastian.otf` | 1.35 | `fkretlow/sebastian` @ `cb6a92e` — ⛔ not npm's stale 1.01 (`scripts/vendor/PROVENANCE.md`) | © 2021 Kretlow & Byram-Wigfield · "Sebastian" | `Sebastian-OFL.txt` |
| **Edwin** (words) | `Edwin-Roman/Italic/Bold/BdIta.otf` | 0.54 | MuseScore's tree `fonts/edwin/` @ `929d1e9` | © 2022 MuseScore BVBA · "Edwin" | `Edwin-OFL.txt` |
| **Nepomuk** (words) | `Nepomuk-Regular/Italic.otf` | — | `fkretlow/nepomuk` `redist/otf` @ `c9681b3` | © 2014 Kretlow · "Nepomuk" | `Nepomuk-OFL.txt` |

`engine/fonts/fontFiles.ts` is the table the screen AND the PDF export read; a font not listed there
is not used.

## What we USE but do not SHIP

- **`Georgia, "Times New Roman", Times, serif`** — the system stack italic words fall to while the
  words face is Academico (it has no italic). These are the VIEWER's installed fonts: we name them in
  CSS, we do not distribute them, and the PDF export does not outline them (it leaves those words as
  text in a standard PDF serif). ✅ No licence question — and ⚠️ no control over what is drawn, which
  is the argument for a words face with a real italic (Edwin).
- **WebAudioFont** samples (playback) are fetched from a CDN at play time — not a font question.
- The SMuFL `glyphnames.json` / `classes.json` / `ranges.json` in `public/smufl/` — see
  `public/smufl/PROVENANCE.md` (⚠️ the spec repo carries no LICENSE file; used unmodified, attributed).

## Fonts researched and NOT shipped

`docs/research/smufl-fonts-research.md` §4 (music faces — the Finale faces are OFL with an RFN, Gonville
is freer than OFL, Emmentaler's terms are UNKNOWN, November / NorFonts / LS Iris / MTF are commercial) ·
`docs/research/score-text-fonts-research.md` §4 (words faces — Century Schoolbook, Times New Roman,
Plantin, Opus Text are proprietary ⛔) · `docs/research/music-text-fonts-research.md` §5 (the SMuFL
"Text" companions — Sebastian Text, Bravura Text, Leland Text: all OFL).
