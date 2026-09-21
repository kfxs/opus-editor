# Bravura's SMuFL metadata — build-time only

`Bravura.json` is Steinberg's own metadata for the Bravura font, taken **verbatim** — no edits, no
trimming — on 2026-08-16 from:

    https://raw.githubusercontent.com/steinbergmedia/bravura/master/redist/Bravura.json

⚠️ **The path matters**: it is `redist/Bravura.json` on branch **`master`**. `bravura_metadata.json`
does not exist, and neither does a `main` branch — both 404.

1,256,984 bytes · `fontName` Bravura · `fontVersion` **1.481** · `glyphBBoxes` 3,434 ·
`glyphsWithAnchors` 643 · `engravingDefaults` 30. **SIL OFL 1.1**, the same terms as the font it
describes (`public/fonts/OFL.txt`).

## ⛔ This file never ships and is never imported

It is read by `scripts/generate-font-metrics.mjs` **at generation time only**, and what ships is the
~60-glyph subset that script emits into `src/engine/fonts/bravuraMetrics.ts`. It lives under
`scripts/` and not under `public/` for exactly that reason: `public/` is served, and 1.26 MB of
build-time data has no business being downloadable.

⭐ It is vendored rather than fetched, following `public/smufl/PROVENANCE.md`: a regeneration must
not depend on the network, and a font upgrade should arrive as a **diff** in this file that anyone
can read next to the diff in the generated one.

## What we take from it, and what we do NOT

⭐⭐ **Not the bounding boxes.** Those are measured from `public/fonts/Bravura.otf` — the font file
we already ship, already outline for the PDF export, and therefore the one whose numbers can be
checked against what is actually drawn (`docs/plans/font-metrics-plan.md` §1.1). The generator reads
`glyphBBoxes` here only to **cross-check** the OTF and report any disagreement.

Taken from here, because a font file cannot carry them:

- `engravingDefaults` — the 30 line weights (F3).
- `glyphsWithAnchors` — `stemUpSE`, `cutOutNW`… (P3's prerequisite).

Re-download rather than hand-edit: any local change would be a silent fork of Steinberg's data.

---

# The other music faces' metadata — Leipzig and Sebastian (2026-09-21)

Build-time only, exactly like `Bravura.json` above: read by `scripts/generate-font-metrics.mjs`, which
emits `src/engine/fonts/leipzigMetrics.ts` / `sebastianMetrics.ts` (`docs/plans/music-font-switch-plan.md`
Phase B). Taken **verbatim**; from each, only `engravingDefaults` and `glyphsWithAnchors` are used, and
`glyphBBoxes` only to cross-check the boxes measured from the OTF in `public/fonts/`.

| file | from | version | licence |
|---|---|---|---|
| `Leipzig.json` | npm `@vexflow-fonts/leipzig` 1.0.1 → `metadata.json` (font: `leipzig.otf` → `public/fonts/Leipzig.otf`, `head.fontRevision` 5.2) | `fontVersion` 5.2.86 | SIL OFL 1.1, RFN "Leipzig" — `public/fonts/Leipzig-OFL.txt` |
| `Sebastian.json` | `https://raw.githubusercontent.com/fkretlow/sebastian/master/fonts/Sebastian.json` at `cb6a92e` (2026-03-19), with `Sebastian.otf` and `OFL.txt` from the same folder | `fontVersion` 1.35 (OTF 1.35) | SIL OFL 1.1, RFN "Sebastian" — `public/fonts/Sebastian-OFL.txt` |

🚨 **Sebastian is NOT taken from npm, and the reason is measured.** `@vexflow-fonts/sebastian` 1.0.1
ships an OTF at revision 1.01 beside metadata that says 1.1, and **38 of our 73 glyph boxes disagreed
with that metadata by up to 0.8 sp** (a repeat dot published as 1.0 sp tall). Upstream's 1.35 pair agrees
with itself on all but three dynamics letters (≤ 0.104 sp, written into the generated header). ⛔ Do not
"update" it back to the npm package.

⭐ Leipzig's npm OTF is the same revision (5.2) as Verovio's own `fonts/Leipzig/Leipzig.ttf`, and every
box we measure agrees with its metadata to 0.01 sp.

⚠️ Both faces carry a Reserved Font Name: ship them UNMODIFIED, or rename.
