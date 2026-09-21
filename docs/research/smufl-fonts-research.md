# SMuFL fonts that are FREE TO USE — what exists, what it costs, what we can actually load

> ⭐⭐ **The question, his (2026-09-13):** *"when our own engine is ready the user should be able to
> change the font… my idea is to use SMuFL that are free to use so we don't have right issues… i know
> there are leipzig, sebastian, versions of maestro and others… i want you to look for information to
> know what we have disposable, then we will have doc, so when planing in the future we don't have to
> make the research twice."*
>
> ⛔ **This is a SURVEY, not a plan and not a decision.** It says what exists, under what terms, and
> what each font would and would not give this engine. It chooses nothing, schedules nothing, and
> contains no TODOs — the font list is his to pick from when the time comes.
>
> 📄 Read with `docs/plans/font-metrics-plan.md` (P2 — how the ink table is generated from a font) and
> `docs/plans/own-engraving-engine.md` (why the drawing is moving to us at all). ⚠️ Everything below was
> fetched or measured on **2026-09-13**; a licence or a version can change, so re-check before
> shipping anything, and see §7 for what was NOT established.

---

## 1. ⭐⭐ THE GATE IS OURS, NOT SMuFL'S — three inputs, and a font must supply two of them

"SMuFL-compliant" is not the test. **This engine's generator needs three files**
(`scripts/generate-font-metrics.mjs`), and only one of them is the font:

| input | gives | can it be recovered otherwise? |
|---|---|---|
| the **OTF** | every glyph's BOXES and advances, measured from the outlines | — this is the font |
| the font's **SMuFL metadata JSON** | `engravingDefaults` (staff line thickness, beam thickness, hairpin weight…) and `glyphsWithAnchors` (`stemUpSE`, `cutOutNE`…) | ⛔ **NO.** *"A font file carries neither, and no amount of measuring recovers them."* A font without this JSON is a font we can draw with but cannot ENGRAVE with |
| `glyphnames.json` | SMuFL name → codepoint | ✅ ours already (`public/smufl/`), font-independent |

⇒ ⭐ **A candidate font has to ship a metadata JSON.** That single line disqualifies more of the free
field than licensing does — see the measured table in §3.

⚠️ **And one more, which is a LICENCE question rather than a technical one:** the PDF export
**outlines** the glyphs (`docs/how-it-works/pdf-export.md`), i.e. the font's shapes end up inside a document the
user distributes. Every licence in §4 permits that explicitly; ⛔ it is the first clause to check for
anything not on this list.

---

## 2. The specification itself

| | |
|---|---|
| current version | **SMuFL 1.5 (draft)**, W3C Music Notation Community Group |
| ✅ the route that serves | `smufl.formats.music/latest/` |
| ⛔ dead / redirect chains | `w3c.github.io/smufl/*` → `w3c-cg.github.io/smufl/*` → the above. Search engines and older tooling still hand you the first two |
| the three shared metadata files | `glyphnames.json`, `classes.json`, `ranges.json` — vendored here from `w3c/smufl@gh-pages/metadata/`, see `public/smufl/PROVENANCE.md` |

⚠️ **The spec repository carries no `LICENSE` file** — our own provenance note already flags this: the
metadata files are used unmodified and attributed, and *"if we ever redistribute these beyond the app,
check the group's current terms first rather than assuming."*

---

## 3. ⭐⭐ THE MEASURED TABLE — every free font, checked rather than described

**Method** (2026-09-13): each font pulled with `npm pack @vexflow-fonts/<name>`, its `metadata.json`
counted, and its OTF tested with `opentype.js` against **the 67 glyphs this editor actually draws**
(the list is `GLYPHS` in `scripts/generate-font-metrics.mjs`, read from the source rather than
retyped). ⭐ Both columns are measurements; ⛔ nothing here is quoted from a font's own marketing.

| font | licence (as declared) | metadata JSON | `engravingDefaults` | `glyphsWithAnchors` | our 67 glyphs | style |
|---|---|---|---|---|---|---|
| **Bravura** 1.392 | OFL-1.1 | ✅ | 29 | 642 | **67/67** ✅ | the SMuFL reference — what we ship |
| **Leland** 0.77 | OFL-1.1 | ✅ | 28 | 128 | **67/67** ✅ | MuseScore's default since 3.6 |
| **Petaluma** 1.065 | OFL-1.1 | ✅ | 27 | 492 | **67/67** ✅ | Steinberg's handwritten/jazz |
| **MuseJazz** 1 | OFL-1.1 | ✅ | 27 | 131 | **67/67** ✅ | MuseScore's jazz face |
| **Finale Maestro** | OFL-1.1 (RFN) | ⛔ **not in the npm package** | — | — | **67/67** ✅ | the classic Finale look |
| **Sebastian** 1.1 | OFL-1.1 | ✅ | 29 | 53 | 66/67 (`bracket`) | Kretlow/Byram-Wigfield, 1200+ glyphs |
| **Leipzig** 5.2.86 | OFL-1.1 | ✅ | 28 | 50 | 64/67 (`bracket`, 2 reversed bracket tips) | Verovio's own; originally Darbellay/Marti's *Wolfgang* |
| **Finale Jazz / Broadway / Ash** | OFL-1.1 (RFN) | ⛔ not in the npm package | — | — | 59/67 (32nd flags, braces, brackets) | handwritten families |
| **Gootville** | OFL-1.1 | ⛔ none | — | — | 60/67 (ottavas, tremolos, braces) | MuseScore's SMuFL port of Gonville |
| **Gonville** 20240308 | ⚠️ **not OFL** — see §4 | ⛔ none | — | — | 58/67 | Simon Tatham's, LilyPond-adjacent |

🚨🚨 **`glyphBBoxes` in a metadata file is NOT the font's coverage, and confusing the two would send
us down a blind alley.** Leland's metadata declares **463** bounding boxes against Bravura's 3,416 —
yet Leland draws **all 67** of our glyphs. ⭐ The metadata is a partial publication; the OTF is the
truth, which is exactly why our generator measures boxes from the outlines and takes only
`engravingDefaults` + anchors from the JSON. ⛔ Never rank a font by its metadata's size.

⭐ **What the missing glyphs actually are** is worth reading before writing any font off: `brace` and
`bracket` (the system-start signs — a font may expect the host to draw them, as several engines do),
`reversedBracketTop/Bottom` (our winged-repeat tips), `tremolo1–3`, `ottavaAlta`/`ottavaBassaVb`, and
the 32nd flags. ⇒ these are **the modern periphery of SMuFL**, ⛔ not core notation, and a font
missing them is missing features rather than being unusable.

### ⭐ A worked example of why capability matters: the CHANGE CLEF

Measured the same day, and it is the sharpest argument in this document for *asking the font*
rather than picking a number. The three `*Change` codepoints (`U+E07A`/`E07B`/`E07C`) are what a
font uses to say *"here is my clef, drawn for a mid-score change"*:

- ✅ **8 of the 12** free faces ship all three — Bravura, Sebastian, Petaluma, Leland, Finale
  Maestro, Leipzig, Gonville, MuseJazz;
- ⛔ **4 do not** — Finale Ash, Finale Broadway, Finale Jazz, Gootville;
- 🚨 and among those that do, the **drawn ratio spans 0.65 → 0.81** (Sebastian 0.654 … MuseJazz
  0.805). Each is a type designer's optical judgement about their own outlines.

⇒ ⭐⭐ **A single house "small clef is ⅔" would override eight designers at once**, and would be the
only available answer for the other four. That is the shape every font-dependent decision in this
editor will have: **ask the font; fall back to our own rule when it is silent.** See `docs/how-it-works/clef.md`
§0.2a for the decision this produced.

⚠️ Note the two families are addressed differently: `*Change` is a SMuFL **codepoint** (portable,
one-line test), while a small-STAFF optical master is an OpenType **stylistic set** (`ss01`) — ⛔ not
a SMuFL name, present only in Bravura and partly Sebastian.

### Text companions

> 🚨 **CORRECTED 2026-09-21 — the paragraph below mixes TWO kinds of font, and the difference is the
> whole point.** A WORDS face (Academico, Edwin, Nepomuk) sets `Allegro` and `dolce`. A SMuFL **"… Text"**
> font (Bravura Text, Leland Text, **Sebastian Text**) is *music symbols cut to sit inside a line of
> words* — measured: Sebastian Text is 986 SMuFL glyphs in one style, and its ASCII slots hold Finale's
> legacy symbol layout (`q` is a quarter note), ⛔ not letters. See
> `docs/research/music-text-fonts-research.md`. ⚠️ And Nepomuk ships TWO files upstream (regular,
> italic), not the six weights reported below.

A SMuFL font is normally a **pair** — the music font and a text font for dynamics, tempo and
expression. Free ones, all OFL-1.1: **Academico** (Bravura's, ✅ we already ship it), **Bravura Text**,
**Leland Text**, **Petaluma Text** + **Petaluma Script**, **MuseJazz Text**, **Sebastian Text**,
**Edwin** (MuseScore's, a New Century Schoolbook derivative), **Nepomuk** (Kretlow, 6 weights incl.
small caps), **Gootville Text**, and each Finale face's text twin. ⚠️ MuseScore 4.6 reads the pairing
**out of the music font's metadata**, so a JSON can name its own text font.

---

## 4. ⭐ THE LICENCE LANDSCAPE — the part that answers *"so we don't have right issues"*

**Almost the entire free field is SIL Open Font License 1.1**, which is the good outcome: OFL
permits use, modification, redistribution and **embedding in documents** without conditions on the
document. Three details are worth knowing rather than assuming:

1. ⚠️ **Reserved Font Name (RFN).** Fedora declares the Finale fonts `OFL-1.1-RFN`. An RFN means the
   font's NAME may not be used for a modified version — ⛔ irrelevant if we ship it unmodified,
   ⭐ decisive the day anyone edits a glyph. (Sebastian states the same rule in prose: *"modified
   versions must use a different name"*.)
2. ⭐ **We must ship the licence file with the font.** OFL requires the copyright notice and licence
   to travel with the software — which is why `public/fonts/OFL.txt` exists beside `Bravura.otf`, and
   the pattern any added font follows.
3. ⚠️ **Gonville is NOT OFL and is arguably freer.** Simon Tatham's own LICENCE reads: *"Use of the
   output font files is UNRESTRICTED. I, Simon Tatham, hereby disclaim any copyright I may hold in
   those files… In particular, typesetting with Gonville font files in a way that embeds portions of
   the font data in the output document (e.g. PDF) imposes no constraint whatsoever."* 🚨 The
   **source code** that generates them is a separate, restricted matter — so the font files are safe
   and the build system is not ours to take.

⚠️ **Emmentaler** (LilyPond's, MuseScore's default before 3.6) is the one free face whose terms are
reported inconsistently — SIL OFL in some places, **GPL with font exception** in others. ⛔ Treated as
UNKNOWN here (§7); it also has no npm package and was not measured.

⛔ **Commercial, listed so nobody spends time on them**: November 2 (Robert Piéchaud), the **NorFonts**
family (16 faces, Nor Eddine Bahha), **LS Iris**, and the **Music Type Foundry** faces (Abraham Lee,
Dan Kreider, Nor Eddine Bahha) — the last two sold through Notation Central. ⭐ These are the fonts
MuseScore 4.6's press showcased, so they will come up in any search; they are not free.

---

## 5. ⭐⭐ HOW A FONT WOULD ARRIVE — three routes, and one of them is already how we build

| route | what you get | ⚠️ |
|---|---|---|
| ⭐ **npm `@vexflow-fonts/<name>`** — **27 packages** covering every free face above | `<name>.otf`, `<name>.woff2`, `metadata.json` (where it exists), `LICENSE.txt`, an `index.css` with the `@font-face` | ⛔ **the Finale faces and Gootville/Gonville ship no metadata.json** · ⚠️ version skew: its Bravura is **1.392**, our vendored metadata is **1.481** and only the newer has `thinThickBarlineSeparation` |
| **upstream repos** — `steinbergmedia/bravura`, `steinbergmedia/petaluma`, `MuseScoreFonts/Leland`, `fkretlow/sebastian`, `rism-digital/verovio` (Leipzig), `tr-igem/ekmelos` | the authoritative, newest files; Steinberg ships `redist/` with OTF + WOFF + `*_metadata.json` | ⚠️ ⛔ `bravura_metadata.json` **404s** — the real path is `redist/Bravura.json` on branch `master`, a trap already recorded in `reference/README.md` |
| **MakeMusic's installers** (`MMFonts.msi` / `MakeMusicFontsTT.pkg`) | the Finale SMuFL faces **with** their JSON metadata — *"the corresponding JSON metadata files are also installed in the correct location"* | ⚠️ an installer, not a package · ⛔ the **legacy** (non-SMuFL) Finale fonts are NOT OFL and *"you are not permitted to redistribute them"* |

⭐ **The npm route matches how this repo already works** — `public/fonts/Bravura.otf` plus a
build-time `scripts/vendor/Bravura.json`, with the big metadata file kept out of `public/` because
1.26 MB of build-time data has no business being downloadable.

---

## 6. What the other engines let a user do, for reference

- **MuseScore Studio 4.6** — *any* SMuFL font, taken from the platform SMuFL directory or its own
  `MusicFonts` folder; it reads the metadata's recommended style settings and can pick up the paired
  text font automatically. Fonts installed by Dorico or Finale are picked up too.
- **Verovio** — bundles Leipzig, Bravura, Gootville, Leland; a custom font is a ZIP of the SFD, an
  SVG font and *"the JSON SMuFL metadata"*, preprocessed into glyph snippets and bounding boxes.
- **Dorico** — Bravura and Petaluma ship with it; the platform SMuFL font directory is the mechanism.

⭐ **All three take the same two things we would**: the outlines, and the metadata JSON. The
convention is settled; nothing here would be inventing an interface.

---

## 7. ⛔ UNKNOWN — searched or not established, so nobody repeats it

| | |
|---|---|
| **Emmentaler's exact licence** | reported as both SIL OFL and *GPL with font exception*. ⛔ Not resolved; no npm package, not measured here |
| **Whether the Finale JSONs are redistributable separately** | the installers place them, and the OFL covers the *fonts* — ⚠️ a JSON is not a font, and MakeMusic's own licensing page **403s to automated fetches**. ⛔ Check by hand before shipping one |
| **Ekmelos** (`tr-igem/ekmelos`, OFL-1.1, 3000+ glyphs, microtonal — 12/24/72-EDO variants) | ⛔ metadata JSON presence and our-67 coverage NOT measured: no npm package, so it was outside the method above. ⭐ The obvious candidate the day microtonal accidentals matter |
| **Eugene** (Mikko Patama, OFL, `mikkopatama.com/eugenefont`) | listed by smufl.org, ⛔ not fetched or measured |
| **Haydn / LilyJAZZ** (OpenLilyPondFonts, OFL) | LilyPond-oriented; ⛔ SMuFL compliance not verified |
| **How complete `glyphsWithAnchors` needs to be for US** | Bravura 642 vs Leipzig 50 — ⛔ we have not established which anchors this engine actually reads at draw time, so *"is 50 enough?"* is open. `fontMetrics.anchor()` returns null for a missing one by design, so the failure would be graceful, ⛔ not silent-wrong |
| **Whether a font swap survives our INK TABLE** | `layout/spacingPadding`'s extents are Bravura measurements held against the font by a test. ⛔ Whether they are re-derived per font or re-measured is not a question this survey answers |

---

## 8. The one-line summary

⭐⭐ **The free field is real and it is almost entirely SIL OFL 1.1**: five faces (Bravura, Leland,
Petaluma, MuseJazz, Sebastian) ship both the outlines and the metadata this engine needs, four of
them draw every glyph we currently draw, and all of them can be pulled as npm packages beside the
build we already have. ⛔ The gap is not licensing and not availability — it is that **Finale
Maestro, the best-known free face after Bravura, has no metadata JSON in its package**, and metadata
is the half a font cannot be measured for.
