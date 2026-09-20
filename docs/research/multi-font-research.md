# Setting the music in another SMuFL font — what VexFlow carries, and what a font without metadata costs

> ⛔ **A SURVEY, not a plan.** Nothing here is scheduled or recommended. It records what VexFlow does
> about fonts other than Bravura, what an engine needs from a SMuFL font, and how two other engines
> cope when a font ships no metadata JSON. Two purposes: a future house style that sets the music in
> another face, and, today, knowing what must not be lost when VexFlow is removed.
>
> 📄 Builds on `docs/research/smufl-fonts-research.md`, which is not repeated here. That document covers which
> free fonts exist, their licences, which of them ship metadata (§3), and how a font would arrive (§5).
> Read `docs/plans/font-metrics-plan.md` for how our metrics table is generated, and
> `docs/history/vexflow-removal-map.md` §8 for the font faces as a removal step.
>
> ⚠️ Read and measured on **2026-09-14**, against: `node_modules/vexflow` **5.0.0**
> (`package.json` `"version"`; ⚠️ 2026-09-19: the package is removed — the same build is kept at
> `~/dev/engine-sources/vexflow-5.0.0-npm/package`, and the citations below still hold there), MuseScore `929d1e99` (2026-08-18) and Verovio `efff0bc9` (2026-08-18),
> both in `~/dev/engine-sources`. Every number marked *measured* came from a throwaway opentype.js
> script run against the font files named in its row. The script is not kept in the repo. The method
> is described where the numbers are used, so it can be repeated.

---

## 0. The questions

1. **What does VexFlow carry to handle fonts other than Bravura?** Per-font metadata, tables, anchors,
   engraving defaults, scale factors, fallback chains? How does it measure a glyph in a non-Bravura
   font, and what happens when a font lacks one? What of that would a multi-font engine of ours need,
   and what is only VexFlow's workaround?
2. **How can an engine support a SMuFL font that ships no metadata JSON** (Finale Maestro, Gonville,
   Gootville)? For each thing the metadata provides: can it be derived from the font file, and how
   reliably? What does this repo already derive? How do MuseScore, Verovio and LilyPond handle it? How
   does anyone keep an estimated value from being believed?

---

## 1. ⭐ What VexFlow 5 carries per font: the font FILE and nothing else

**The answer in one line: VexFlow 5 has no per-font data at all.** It embeds font binaries, keeps a
list of CDN file names, and measures every glyph at run time with the browser's text measurement. The
font it measures is whatever family the CSS stack resolves to. It has no anchors, no bounding-box
tables, no engraving defaults and no per-font adjustments.

| what | where (`node_modules/vexflow/build/esm/…`) | per font? | what it is |
|---|---|---|---|
| The six embedded faces | `entry/vexflow.js:12–17` — `Font.load('Bravura', Bravura, block)`, Academico (+bold, `swap`), Gonville (`block`), Petaluma (`block`), Petaluma Script (`swap`) | binary only | Each `src/fonts/<name>.js` is **one line**, `export const Gonville = 'data:font/woff2;charset=utf-8;base64,…'` (`src/fonts/gonville.js:1`). There is no metadata beside it |
| Which entry we get | `package.json:9` maps `"."` to `entry/vexflow.js`; every `src/` import is bare `'vexflow'` | — | So the editor installs all six faces. `entry/vexflow-bravura.js` installs only Bravura + Academico, and `entry/vexflow-core.js` installs none |
| The default stack | `entry/vexflow.js:27` `VexFlow.setFonts('Bravura', 'Academico')` → `src/vexflow.js:105–108`, which is `MetricsDefaults.fontFamily = fontNames.join(',')` | — | A **CSS font-family string**, and nothing more. The default is already `'Bravura,Academico'` (`src/metrics.js:62`) |
| A catalogue of 27 families | `src/font.js:208–237` `Font.FILES` + `HOST_URL = 'https://cdn.jsdelivr.net/npm/@vexflow-fonts/'` (`:208`), loaded by `VexFlow.loadFonts` (`src/vexflow.js:93–104`) → `Font.load` (`src/font.js:166–190`) | file name only | Finale Maestro, Gootville, Leipzig, Leland, Sebastian… appear here as **woff2 paths and nothing else**. This is the only place in the package that names them (grep of `src/*.js` for the names finds `font.js:220–236` only) |
| `MetricsDefaults` | `src/metrics.js:61–222` | ⛔ **no** | Keyed by **element category** (`Accidental`, `Stave`, `StaveTempo`, `Tremolo`…), never by font: font sizes, paddings, text styles. `Metrics.get` walks a dotted category path (`:40–57`) |
| `Glyphs` | `src/glyphs.js` (2,936 lines) | ⛔ no | SMuFL name → codepoint string, one enum shared by every font |
| `Tables` constants | `src/tables.js:595` `STEM_WIDTH = 1.5`, `:596` `STEM_HEIGHT = 35`, `:616–639` `stemBeamExtension`, `:644` `NOTATION_FONT_SCALE = 39`, `:647` `STAVE_LINE_DISTANCE = 10` | ⛔ no | Pixel constants that apply to every font. Nothing in the package switches them by font |
| Anchors / engraving defaults | grep of `src/*.js` for `stemUpSE`, `stemDownNW`, `anchor`, `engravingDefaults`: **no hits** | ⛔ none | — |
| Gonville / Petaluma special cases | none in `src/`. The shipped `tests/flow.html:96,105–106` only pre-touches the families with empty `<span style="font-family: …">` | ⛔ none | — |

### 1.1 How VexFlow measures a glyph, whatever the font

- **At run time, through canvas `measureText`.** `Element.measureText()` (`src/element.js:339–352`)
  sets `context.font` to the element's CSS font string (`:346`) on a shared measuring canvas
  (`:16–28`). It then takes **`width` = the metrics' `width`**, which is the advance (`:349`), and
  **`height` = `actualBoundingBoxAscent + actualBoundingBoxDescent`**, which is the ink (`:348`). The
  SVG context does the same through a measuring element's bounding box (`src/svgcontext.js:329–334`).
- ⚠️ **So a glyph's width is its advance and its height is its ink.** These are two different
  quantities, which `fonts/fontMetrics.ts:59–62` keeps apart on purpose. `stavenote.js:55,58,416–417`
  read the ink ascent and descent for ledgers and flags.
- **Where the stem goes, with no anchor:** `StemmableNote.getStemX()` puts the stem at the notehead's
  left or right **measured width** (`src/stemmablenote.js:114–119`). Its vertical offsets
  `stemUpYOffset` / `stemDownYOffset` default to 0 (`src/stem.js:28–31,46–49`), and no other file in
  `src/` sets them (grep). A displaced head moves by `width − Stem.WIDTH/2` (`src/notehead.js:55–58`).
  ⇒ VexFlow's stem attachment is **"the advance edge, at the head's centre line"**. It is not the
  font's `stemUpSE`, which in Bravura sits **0.168 sp above** centre
  (`fonts/bravuraMetrics.ts:313`).

### 1.2 What happens when a glyph is missing: the BROWSER decides, VexFlow does not

VexFlow has no fallback logic. It hands the whole stack (`'Bravura,Academico'`) to the browser as
`font-family`, both for drawing and for measuring (`element.js:346`). Per-character font fallback is
CSS font matching.

⚠️ **The second family in the default stack cannot supply a music glyph.** *Measured:*
`public/fonts/Academico.otf` and `AcademicoBold.otf` map **0** codepoints in U+E000–F8FF, against
3,446 in `Bravura.otf`. A SMuFL glyph missing from the first family therefore falls through Academico
to whatever the browser has, or to a `.notdef` box, and that box is measured like any other glyph.
Which system face a given browser would pick is **UNKNOWN** (§7).

### 1.3 What a multi-font engine of ours would take from this

| VexFlow's | take it? | why |
|---|---|---|
| Registering faces with `block` for music and `swap` for words | ✅ **already taken** (`fonts/fontFiles.ts:40–47,50–54`, registered by `rendering/painter/musicFontFaces.ts`) | A `.notdef` box engraved as a notehead is wrong ink, so music waits for its font |
| The `Font.FILES` catalogue | ❌ not at run time | It only restates npm package paths, already in `smufl-fonts-research.md` §5 |
| Runtime `measureText` | ❌ **a workaround** | VexFlow measures because it carries no metadata. It gives an advance where ink was wanted, needs a canvas, and cannot run in jsdom (`fonts/fontMetrics.ts:7–15`) |
| A CSS stack as the fallback chain | ❌ **a workaround** | It is not a SMuFL fallback: the next family is a text font with no PUA glyphs (§1.2) |
| Per-font engraving data | — | ⭐ **There is none to take.** A multi-font engine gets nothing from VexFlow here, so it loses nothing either (§6) |

---

## 2. What the metadata gives, and what the outline gives

**Method for the measured cells:** opentype.js on each font file, with each glyph's box compared
against the `glyphBBoxes` of the metadata JSON beside it. The files are MuseScore's copies of Bravura,
Leland, Petaluma, MuseJazz, Gootville, Finale Maestro, Finale Broadway and Emmentaler, plus Verovio's
Leipzig. The staff space is `unitsPerEm / 4`.

| need | metadata key (`scripts/vendor/Bravura.json` count) | derivable from the font file? | how, and how reliably |
|---|---|---|---|
| **Ink box** per glyph | `glyphBBoxes` (3,434) | ✅ **yes, exactly** | CFF/glyf outline bounds (`glyph.getBoundingBox()`). *Measured* agreement with the published boxes within 0.01 sp: Leland 440/440, Petaluma 1,509/1,509, MuseJazz 398/398, Gootville 223/223, Finale Maestro 2,728/2,728, Finale Broadway 427/427, Emmentaler 333/333, Bravura 3,392/3,416 (24 differ, the worst `accSagittalFractionalTinaDown` by 0.736 sp). ⇒ **Published boxes are themselves outline measurements.** The outline is the source of truth, and the two can drift apart through version skew (our `brace`, `bravuraMetrics.ts:26–27`) |
| **Advance** | `glyphAdvanceWidths` (3,467) | ✅ yes, exactly | `hmtx` advance (`glyph.advanceWidth`) |
| **Coverage**: does the font draw glyph X | *(none: metadata is partial, `smufl-fonts-research.md` §3)* | ✅ yes, exactly | `cmap` lookup. ⚠️ `charToGlyph` returns glyph 0 (`.notdef`) instead of failing, so check the **index**, not the result (`scripts/generate-font-metrics.mjs:196–202`) |
| Font name / version | `fontName`, `fontVersion` | ✅ yes | `name` / `head.fontRevision` (`generate-font-metrics.mjs:316`). *Measured:* matches `fontVersion` for all eight MuseScore files except Gootville (OTF 1.000, JSON 1.3) and Leland (0.080 vs 0.80, the same number in a different format) |
| **`stemUpSE` / `stemDownNW` — x** | `glyphsWithAnchors` (643 glyphs) | ⚠️ **the x can be estimated** | *Measured* on `noteheadBlack` in the 7 authored files (Bravura, Leland, Petaluma, MuseJazz, Finale Maestro, Finale Broadway, Emmentaler): `stemUpSE.x` **equals the outline's right edge** in all 7 (1.18, 1.30, 1.336, 1.316, 1.272, 1.28, 1.3156 vs 1.316), and `stemDownNW.x` is 0 in all 7. ⚠️ That is 7 fonts and one glyph, not a law |
| **`stemUpSE` / `stemDownNW` — y** | same | ⛔ **no** | *Measured* `stemUpSE.y` on `noteheadBlack`: Finale Broadway 0.104, Finale Maestro 0.14, Leland 0.16, Bravura 0.168, MuseJazz 0.172, Emmentaler 0.235, Petaluma 0.288. The designer places it where the stem should meet the shape. No box encodes it, and no engine was found that computes it from an outline (§3) |
| `cutOutNE/NW/SE/SW` | same | ⛔ no | A statement about where another glyph may tuck in. It is a kerning judgement, not a geometric extreme. MuseScore's substitute when absent is the **bbox corner** (§3.1), which amounts to "no cut-out" |
| `opticalCenter` (dynamics) | same | ⛔ no | An optical judgement. The only derivable stand-in is the box centre, which is a different quantity |
| `graceNoteSlash*`, `splitStem*`, `noteheadOrigin`, `numeralBottom`, `repeatOffset`, `mark0–2` | same (these are the 23 anchor names in our vendored file) | ⛔ no | Design statements. No engine read here derives them |
| `stemThickness`, `staffLineThickness`, `thin/thickBarlineThickness`, `legerLineThickness/Extension` | `engravingDefaults` (30) | ⚠️ **only as a guess, and only if the font draws a proxy glyph** | Proxies: `stem` U+E210 width, `staff1Line` height, `barlineSingle`/`barlineHeavy` width, `legerLine` height and overhang. *Measured* against each font's own defaults. **Bravura** is close: stem 0.120 = 0.120, staff line 0.128 vs 0.13, thin barline 0.144 vs 0.16, ledger extension 0.394 vs 0.40. **Finale Maestro** is off: stem 0.080 vs 0.091, thin barline 0.080 vs 0.100, ledger 0.088 vs 0.110. **Petaluma** `barlineHeavy` 1.037 vs `thickBarlineThickness` 0.5. **Finale Broadway** stem 0.236 vs 0.15. **Leland, MuseJazz, Gootville and Emmentaler draw none of the proxies.** ⇒ Wrong by up to 2×, and unavailable for half the fonts |
| `beamThickness`, `beamSpacing`, slur/tie thicknesses, `hairpinThickness`, `tupletBracketThickness`, `textEnclosureThickness`, dashed barline lengths… | `engravingDefaults` | ⛔ **no** | No glyph carries them. They are the font's statement of how the *host* should draw lines |
| `textFontFamily` | `engravingDefaults` | ⛔ no | A list of names. Our generator already drops it (`generate-font-metrics.mjs:136–140,249–254`) |
| Alternates / optional glyph names | `glyphsWithAlternates` (226), `optionalGlyphs` (528), `ligatures` (201), `sets` (9) | ⚠️ partly | The glyphs exist in the font (reachable through GSUB / `ss01`, `smufl-fonts-research.md` §3), but **the SMuFL name of an optional glyph is only in the metadata**. `glyphnames.json` does not list it (`generate-font-metrics.mjs:180–186`). Whether a font's `post` glyph names carry SMuFL names is per font and **UNKNOWN** |

⭐ **The split:** everything that describes **what the outline is** can be derived from the font
exactly: boxes, advances, coverage and version. Everything that describes **how the designer meant it
to be used** cannot: stem-attachment y, cut-outs, optical centres, every line weight, and the names of
alternates. The only exception is the stem x, which every authored file measured here places at the
outline edge.

---

## 3. How the other engines handle a font with no metadata

### 3.1 MuseScore — **bundles a metadata file for every music font it ships, and skips an external font that has none**

- **Every internal music font has a JSON beside it, including the ones whose upstream packages have
  none.** `engravingmodule.cpp:182–197` registers Bravura, Leland, Emmentaler (as `MScore.otf`),
  **Gonville (as `Gootville.otf`, `:188`)**, MuseJazz, Petaluma, **Finale Maestro** and **Finale
  Broadway**. `EngravingFontsProvider::addInternalFont` always takes `<dir>/metadata.json`
  (`src/engraving/internal/engravingfontsprovider.cpp:39–46`). The `.qrc` files alias each JSON to
  that name: `src/engraving/data/fonts/fonts_FinaleMaestro.qrc` maps
  `fonts/finalemaestro/FinaleMaestro.json` → `metadata.json`, and there are matching files for
  Gootville and MScore. On disk:

  | file | `fontName` / `fontVersion` | `glyphBBoxes` | `glyphsWithAnchors` | `engravingDefaults` |
  |---|---|---|---|---|
  | `fonts/finalemaestro/FinaleMaestro.json` | Finale Maestro / 2.7 (OTF `head` 2.7) | 2,728 | 399 | 28 |
  | `fonts/finalebroadway/FinaleBroadway.json` | Finale Broadway / 1.4 | 427 | 54 | 28 |
  | `fonts/gootville/metadata.json` | Gootville / 1.3 | 313 | 590 | 27 |
  | `fonts/mscore/metadata.json` | **Emmentaler** / 2.003 | 334 | 188 | 27 |

  ⭐ **So a Finale Maestro metadata JSON exists**, even though the npm package lacks one
  (`smufl-fonts-research.md` §3). Who authored it, and on what terms it may be redistributed, is
  **UNKNOWN** (§7). The `OFL.txt` beside it (`fonts/finalemaestro/OFL.txt:1–5`) covers the *fonts*.
  The Emmentaler JSON is the clearest case of **an engine writing metadata for a font whose designers
  never did**.
- **An external (user) font without a JSON is skipped.** `EngravingFontsController::scanDirectory`
  (`src/notation/internal/engravingfontscontroller.cpp:106–128`) handles two directories:
  - the global SMuFL directory, where it requires `<name>.json` and otherwise `continue`s (`:108–110`);
  - its private directory, where it tries `<name>_metadata.json`, then `metadata.json`, then any
    `*.json`, and skips the font if none is found (`:112–127`).
- **Boxes and advances never come from the JSON.** `EngravingFont::ensureLoad` computes them from the
  font for every symbol **before** reading any metadata (`src/engraving/internal/engravingfont.cpp:114–121`
  → `computeMetrics`, `:844–856`: `fontProvider()->boundingRect` / `horizontalAdvance`). A grep of
  `src/` for `glyphBBoxes` finds no reader.
- **A JSON that fails to open or parse only logs.** `:123–138` logs and `return`s before anchors,
  alternates and defaults are loaded, so all three stay empty.
- **What it reads from the JSON:** 9 anchor names (`:726–736`, the rest silently ignored at `:740–742`),
  stylistic alternates (`:142`), and `engravingDefaults` through a mapping (`:776–807`) in which
  several keys are marked *"not supported"*. `beamSpacing` is collapsed to `useWideBeams = value > 0.75`
  (`:832–835`), and the text font is assumed to be `"<family> Text"` (`:841`).
- 🚨 **A missing anchor answers `(0, 0)`.** `smuflAnchor` returns `PointF()` (`:1078–1083`).
  `Note::stemUpSE()` passes it straight on (`src/engraving/dom/note.cpp:1283–1286`), and stem layout
  uses it as the attach point (`rendering/score/stemlayout.cpp:193`). **This is a plausible value with
  nothing marking it as a default.** Missing cut-outs fall back to bbox corners (`engravingfont.cpp:988–1000`).
- **A missing glyph is taken whole from Bravura, and consistently so.** The fallback font is Bravura
  (`engravingmodule.cpp:219`). `useFallbackFont(id)` is true when the symbol is invalid in the current
  font (`engravingfont.cpp:899–902`). The **box, advance, anchor and drawing** then all come from that
  one font (`:913–917`, `:1058–1062`, `:1072–1076`, `:1101–1102`), so no Bravura number is ever
  combined with another font's outline.
- ⚠️ **Where metadata did not say enough, MuseScore tests the font's name.** Four places, each
  commented as such:
  - `rendering/score/slurtielayout.cpp:403–410`: *"hack alert!! — fakeCutout … hooks don't have SMuFL
    cutouts"*, with a steeper slope for Gonville and MuseJazz;
  - `rendering/score/tlayout.cpp:1432–1434`: Emmentaler and Gonville braces are drawn as a path rather
    than a glyph;
  - `tlayout.cpp:5437–5441`: *"HACK: adjust slash angle for fonts with 'fat' hooks. In future, we must
    use smufl cutOut"* (Bravura, Finale Maestro, Gonville);
  - `dom/bracket.cpp:81–82`.

### 3.2 Verovio — **metadata is a build-time input; a font without it cannot be built**

- **The generator refuses to run without it.** `fonts/generate.py` `extract` opens
  `<font>/<font>_metadata.json` (`:131`) and returns `False` if it is unreadable (`:143–145`). The
  outlines are read from an **SVG font** made with FontForge (`fonts/README.md`, "Generate Script").
- **Boxes come from the outline; anchors are copied from the JSON.** `__write_bb_xml`
  (`generate.py:551–628`):
  - computes each box from the glyph's SVG path with `svgpathtools` (`:588–599`);
  - takes the advance from `horiz-adv-x` (`:602`);
  - copies anchors **verbatim** from `glyphsWithAnchors`, rounded to 2 decimals (`:564,615–623`).

  The result is `data/<Font>.xml`.
- **`engravingDefaults` are not taken from the font.** The C++ layout options carry Verovio's own
  values, which a user may override with an `engravingDefaults` JSON or file (`src/options.cpp:1288–1295`,
  `:2089–2140`).
- **Custom fonts come as a ZIP** of `<name>.xml` + glyph files + CSS (`src/resources.cpp:116–135`,
  `:326–338`, `:362–364`). That XML is what `generate.py` produces, which itself required a metadata
  JSON.
- **Missing glyph:** Bravura and Leipzig are the fallback fonts and must be complete (`resources.cpp:356–357`,
  `:416–419`). `GetGlyph` falls through to the fallback table (`:175–196`).
- **Missing anchor → an estimate, used silently.** Only 6 anchor names are kept (`src/glyph.cpp:111–138`,
  *"Silently ignore unused anchors"*):
  - **stems:** `Note::GetStemUpSE` starts from x = the head's glyph width, y = `GetDrawingUnit/4`
    (`src/note.cpp:507–511`), and replaces that only `if (glyph->HasAnchor(SMUFL_stemUpSE))`
    (`:529–533`). `GetStemDownNW` does the same with x = 0 (`:540–543`, `:561–565`). ⚠️ In staff spaces
    that y is ⅛ sp **if** a drawing unit is half a staff space, as the name `GetDrawingDoubleUnit`
    (`src/doc.cpp:2032`) suggests. Not verified further.
  - **cut-outs:** a missing cut-out falls back to the self bounding rectangle
    (`src/boundingbox.cpp:301–323`).
- **Gootville is the same file in both engines.** Verovio's `fonts/Gootville/gootville_metadata.json`
  is **byte-identical** to MuseScore's `fonts/gootville/metadata.json` (md5 `5572017c…`).

### 3.3 LilyPond — not applicable

LilyPond engraves in its own Emmentaler, generated from METAFONT sources that carry their own
attachment data. `lily/open-type-font.cc:324–332` reads `attachment` / `attachment-down`, and falls
back to rotating `attachment` about the head's centre for older fonts. `mf/gen-emmentaler.fontforge.py:106–111`
says the PUA codepoints are *"arbitrary … until we add support for SMuFL"*. It has no path for a
third-party SMuFL font without metadata.

### 3.4 🚨 An estimate that got believed, found in both engines' copy of Gootville

*Measured* by comparing `fonts/gootville/metadata.json` with MuseScore's `fonts/bravura/bravura_metadata.json`:

- **565 of Gootville's 590 anchor sets are identical to Bravura's**, value for value. So are **26 of
  its 27** `engravingDefaults`. Its `readme.txt` says *"The Gootville font templates based on SMuFL
  1.18 and Bravura 1.18"*.
- `noteheadBlack` / `noteheadHalf` carry `stemUpSE [1.18, 0.168]`. That is Bravura's value, but
  **Gootville's own outline is 1.264 sp wide**. The JSON publishes no box for either head to reveal
  the mismatch, while the whole head does get a box (`[1.816, 0.54]`).
- Verovio carries it through: `data/Gootville.xml:136–144` has `w="316"` (1.264 sp at 1000 upm)
  beside `stemUpSE x="1.18"`.

⇒ An up-stem in Gootville is attached **0.084 sp inside the head's right edge** in both engines.
Whether that is deliberate or a Bravura value never re-measured is **UNKNOWN**. What is established:
nothing in the file or either engine marks the value as borrowed. For comparison, the authored files
are far less alike: Petaluma shares 39 of 491 anchor sets with Bravura, Finale Maestro 27 of 348,
Leland 0 of 125. (Petaluma does share all 27 of Bravura's `engravingDefaults` — same foundry.)

### 3.5 How engines mark an estimated value: **they do not**

None of the three engines distinguishes a value the font stated from one the engine assumed.
MuseScore returns `(0,0)` or a bbox corner, Verovio returns its default point, and in both cases the
caller cannot tell. The metadata format has no such field either: the top-level keys of our vendored
`Bravura.json` are `engravingDefaults, fontName, fontVersion, glyphAdvanceWidths, glyphBBoxes,
glyphsWithAlternates, glyphsWithAnchors, ligatures, optionalGlyphs, sets`. Whether the SMuFL
specification defines a provenance field anywhere is **UNKNOWN**, since the spec was not consulted
for this.

⭐ **The only explicit refusals to guess found in this survey are this repo's.** They are listed in §4.

---

## 4. What this repo already covers

**From the outline alone** (`scripts/generate-font-metrics.mjs`, reading `public/fonts/Bravura.otf`):

| what | where |
|---|---|
| Staff space = `unitsPerEm / 4`, read and not hardcoded | `:166–169` |
| Ink box `left/right/up/down` + `advance`, in staff spaces | `:203–216` |
| Coverage: a missing glyph is detected by index 0, not by the returned glyph | `:195–202` |
| A glyph that exists but draws no ink is reported | `:204–207` |
| ⛔ **A partial table is refused**: any missing glyph exits non-zero and writes nothing | `:242–247` |
| Font revision stamped into the output | `:316`, `:348` |

**From the metadata** (`scripts/vendor/Bravura.json`):

| what | where | anything outline-derivable in it? |
|---|---|---|
| Anchors, copied for the glyphs we draw | `:234–239` → `bravuraMetrics.ts:309–331` | no |
| `engravingDefaults`, numbers only | `:249–254` → `bravuraMetrics.ts:339–369` | no (§2) |
| Codepoints of optional glyphs (the four brace alternates) | `:186` | no |
| Cross-check of our boxes against `glyphBBoxes`, **with disagreements written into the generated header** | `:219–232`, `:257–273` → `bravuraMetrics.ts:26–27` (`brace`, 0.051 sp) | the check's reference is |
| Font name, metadata version | `:346,350` | — |

**What the engine reads today.** `fonts/fontMetrics.ts` is the only reader of the generated tables,
and 18 non-test files import it.

- **Boxes:** `glyphBox` / `glyphNameOf` are called from 14 files outside `engine/fonts/`, e.g.
  `rendering/staff/KeySignaturePass.ts`, `scene/sceneBox.ts`, `layout/barlineSign.ts`. `glyphNameOf` answers
  `null` for a character we did not measure (`fontMetrics.ts:96–110`).
- **Engraving defaults:** `engravingDefault(...)` is called by:
  - `layout/barlineSign.ts:60,84`
  - `rendering/thinLineWeight.ts:60,146`
  - `rendering/curves/curveStyle.ts:280,284`
  - `rendering/layoutConfig.ts:265`
  - `rendering/beams/beamInk.ts:48`
  - the compositions `secondDisplacement`, `flagInkRight` and `ledgerExtension` (`fontMetrics.ts:248–250,271–278,301–303`)
- ⭐ **Anchors: `anchor()` has no caller outside its own test** (`fontMetrics.test.ts:152–166`; grep of
  `src/` for `anchor(` outside `engine/fonts/`). Stems are still placed by VexFlow's advance-edge rule
  (§1.1) — ⚠️ since the removal (2026-09-19) as OUR transcription of it, `engrave/notes/noteGeometry.stemX`. ⇒ This answers the open question in `smufl-fonts-research.md` §7 (*"which anchors this engine
  actually reads at draw time"*): **none, today.** P3 names them as a prerequisite
  (`docs/plans/font-metrics-plan.md:50,588`).
- `anchor()` answers `null` for a missing anchor, not `[0,0]` (`fontMetrics.ts:118–127`). That is
  exactly the opposite of MuseScore's `PointF()` (§3.1).

**What is hardwired to one font:**

- `OTF`, `METADATA` and `OUT` paths: `generate-font-metrics.mjs:33–36`.
- The `BRAVURA` constant and the `GlyphName` union: `bravuraMetrics.ts:33–45`.
- `fontMetrics.ts` imports `./bravuraMetrics` directly: `:37–44`.
- `FONT_FILES` lists only Bravura + Academico ×2: `fontFiles.ts:50–54`.
- The ink table in `layout/spacingPadding.ts` was measured in Chrome and is now checked against
  Bravura's metrics (`spacingPadding.ts:12,22,158`). Whether it would be re-derived per font is
  already open in `smufl-fonts-research.md` §7.

⇒ **For a metadata-less font, our outline half already covers every box, advance and coverage need.**
What it would lack is the 29 defaults, which have 7 consumer sites today, and the anchors, which have
no consumer today but are P3's prerequisite.

---

## 5. Options for a font that ships no metadata — each with its risk

⛔ Listed, not ranked. They can be combined.

| # | option | what it takes | 🚨 risk |
|---|---|---|---|
| A | **Refuse the font** — MuseScore's rule for external fonts (§3.1) | nothing | Excludes Gonville and Gootville outright, and Finale Maestro unless a JSON is obtained |
| B | **Use another engine's bundled JSON** (MuseScore's `FinaleMaestro.json`, `gootville/metadata.json`) | vendor it like `scripts/vendor/Bravura.json` | ① Authorship and redistribution terms **UNKNOWN** (§7). ② **The Gootville file is mostly Bravura's template** (§3.4), so it arrives full of values that look authored and were not. A JSON's presence is not evidence its anchors were measured |
| C | **Author our own JSON by hand**, as MuseScore did for Emmentaler (`fonts/mscore/metadata.json`) | one person's judgement per anchor and per weight, checked by eye against the drawing | Cost, and a house judgement standing in for the designer's. It is honest only if the file says it was authored here |
| D | **Derive what is derivable at build time** — boxes, advances and coverage exactly, as `generate-font-metrics.mjs` already does | the existing generator pointed at another OTF, minus the metadata inputs | **Nothing** for the derived half (§2 measured it exact). ⚠️ It leaves anchors and defaults empty, so it is only complete together with E, F or C |
| E | **Estimate anchors and defaults from the outline** — `stemUpSE.x` = right edge (held in 7/7 measured files), weights from the `stem` / `staff1Line` / `barline*` / `legerLine` glyphs | heuristics in the generator | 🚨 **The standing lesson: a guessing fallback gets believed.** Stem y has no derivation at all (0.104–0.288 sp across fonts). Weight proxies measured wrong by up to 2×, and are absent from half the fonts (§2). Unless every estimated value is typed or tagged apart from a stated one, a reader cannot tell them apart. No engine surveyed does that (§3.5) |
| F | **Borrow a reference font's numbers** (Bravura's) for what is missing | a merge step | This is exactly how Gootville's metadata was produced (§3.4). **An anchor borrowed onto a different outline lands in the wrong place** (0.084 sp inside the head). MuseScore's *glyph* fallback avoids this only because box, anchor and drawing all come from the same font (§3.1) |
| G | **No value, and a named house rule per consumer** — keep `anchor()` null and let each caller state its own rule when the font is silent (`smufl-fonts-research.md` §3: *"ask the font; fall back to our own rule when it is silent"*) | a fallback written, and sourced, at every call site | Every consumer needs one, so it scales with call sites. The house rule may not suit that font's shapes, and MuseScore's four font-name hacks (§3.1) show that gap staying open for years |
| H | **Measure at run time, as VexFlow does** (§1.1) | canvas `measureText` | Yields advances, not ink or anchors, so it does not supply what is missing. It also cannot run in jsdom (`fontMetrics.ts:7–15`) |

---

## 6. What must not be lost when VexFlow is removed

> ⚠️ **2026-09-19: VexFlow IS removed** (`docs/history/vexflow-removal-map.md` §9). This section is kept as
> the checklist it was: the faces are ours (`fonts/fontFiles` + `rendering/painter/musicFontFaces`), every glyph
> is resolved, measured and stamped by `rendering/painter/glyphPainter` with faces from `fonts/fontCategories`
> (the same `'Bravura,Academico'` stack), and the numbers below are rows in `engrave/inheritedDefaults`.

⭐ **There is no multi-font engraving knowledge in VexFlow 5 to lose** (§1). What is at stake is
behaviour:

1. **The faces themselves.** VexFlow's import installs six faces (`entry/vexflow.js:12–17`). Ours now
   installs three from `public/fonts/` (`fonts/fontFiles.ts:50–54`, `rendering/painter/musicFontFaces.ts`).
   **Gonville, Petaluma and Petaluma Script will leave the page with the package.** (⚠️ They have.) A grep of `src/`,
   `e2e/` and `index.html` finds those names only in comments (`fontFiles.ts:14–15,23`,
   `BarlineRenderer.ts:132`, `e2e/musicFontFaces.e2e.ts:8`), so nothing draws with them today. A future
   house style needing one needs its own row.
2. **`block` for music, `swap` for words** — `entry/vexflow.js:9–11`. Already kept (`fontFiles.ts:40–47`).
3. **The fallback stack.** Today every VexFlow-drawn glyph is set in `'Bravura,Academico'`
   (`metrics.js:62`), and a glyph Bravura lacks falls through a text face that has no PUA glyphs to the
   browser's choice (§1.2). Our generator guarantees the 71 glyphs we measure exist in Bravura
   (`generate-font-metrics.mjs:242–247`). Whether any glyph VexFlow draws outside that list relies on
   the stack is **UNKNOWN**.
4. **Today's numbers that come from runtime measurement, which a port must reproduce or record:**
   - glyph width = `measureText` advance (`element.js:339–352`), against `glyphBox().advance`.
     `vexflow-removal-map.md` §4 already files this under rule 13.
   - **stem x at the advance edge with a y offset of 0** (`stemmablenote.js:114–119`, `stem.js:28–31`).
     Adopting the font's `stemUpSE` would move the stem **0.168 sp** vertically in Bravura, and by a
     different amount in every other font (§2). This is a *pixel change*, not a port.
   - the font-independent pixel constants `STEM_WIDTH` 1.5, `STEM_HEIGHT` 35, `NOTATION_FONT_SCALE` 39,
     `STAVE_LINE_DISTANCE` 10 (`tables.js:595–596,644,647`). These are S1 of `vexflow-removal-map.md` §8.2.
5. **Not needed:** `Font.FILES` and `loadFonts` (the CDN catalogue, `font.js:208–237`, `vexflow.js:93–104`),
   `MetricsDefaults`' per-category text sizes as a *font* mechanism, and `Glyphs` (we have
   `glyphnames.json`).

---

## 7. ⛔ UNKNOWN

| | |
|---|---|
| **Who authored MuseScore's `FinaleMaestro.json` / `FinaleBroadway.json`, and on what terms** | The file name pattern matches MuseScore's global-SMuFL-directory convention (`engravingfontscontroller.cpp:106`), and `fontVersion` 2.7 matches the OTF. ⛔ Neither establishes MakeMusic authorship, and a JSON is not a font under the OFL (`smufl-fonts-research.md` §7). No git history (shallow clone) |
| **Who authored `fonts/mscore/metadata.json` (Emmentaler) and `gootville/metadata.json`**, and whether any Gootville anchor was re-measured | Only the counts in §3.4 are known |
| **Whether Gootville's `stemUpSE` 1.18 on a 1.264-wide head is intentional** | measured, not explained |
| **Gonville** | ⛔ Not measured here. Its only copy on disk is VexFlow's embedded woff2, and no woff2 decoder is installed. MuseScore's "Gonville" is Gootville (`engravingmodule.cpp:188`) |
| **Which system face a browser picks for a SMuFL codepoint** missing from Bravura and Academico | browser- and OS-dependent, not tested |
| **Whether any glyph VexFlow draws outside our 71 relies on the CSS stack** | not audited. ⚠️ 2026-09-19: VexFlow draws nothing now — the question passes to `glyphPainter`, which sets glyphs in the same stack |
| **Whether VexFlow 4 carried per-font metrics files** (e.g. glyph tables for Gonville and Petaluma) | ⛔ Only 5.0.0 is on disk. Not verified, so nothing here claims VexFlow ever had them |
| **Whether the SMuFL specification defines a provenance or "estimated" field** | the spec was not consulted for this document |
| **Whether an outline-based derivation of `stemUpSE.y` or cut-outs exists anywhere** | none in MuseScore, Verovio or LilyPond as read. Other engines (Dorico, Finale, Sibelius) are closed source |
| **Whether `stemUpSE.x` = outline right edge holds beyond `noteheadBlack` in 7 fonts** | measured on one glyph only |
| **Whether a font's `post` table names its optional glyphs with SMuFL names** | per font, not measured |
| **Verovio's drawing unit in staff spaces** | `GetDrawingDoubleUnit` (`doc.cpp:2032`) suggests unit = ½ sp. Not confirmed |
| **Whether the vendored `Bravura.json` 1.481 and VexFlow's embedded Bravura agree** | still open in `vexflow-removal-map.md` §8.1 (⚠️ answered there since, 2026-09-14 S1a; the embedded face is no longer loaded) |
