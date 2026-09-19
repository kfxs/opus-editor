# Score text fonts: why Academico, what the others use, and what we could ship

**Research only, 2026-09-14.** Nothing here is built and nothing is recommended. This is a map for a
future house-style option ("text face"). Every claim cites a file:line, a URL, or a printed page with
its PDF page. Anything that could not be confirmed is marked **UNKNOWN** and listed in §6.

Engine checkouts cited: MuseScore `main` @ `929d1e9`, LilyPond `master` @ `beedbfa`, Verovio
`develop` @ `efff0bc` (all under `~/dev/engine-sources/`, see `reference/README.md`). VexFlow is the
installed `node_modules/vexflow` 5.0.0 (MIT) — ⚠️ removed from the app 2026-09-19 (S14); the same npm build is
kept at `~/dev/engine-sources/vexflow-5.0.0-npm/package`, and its `node_modules/vexflow/…` paths below resolve there.

---

## 0. Questions

1. What is Academico: who made it, what it is based on, its licence, what VexFlow and this repo
   ship, and whether there is an italic?
2. What text faces do the main scorewriters use by default for tempo/expression, titles, lyrics,
   chord symbols, rehearsal marks, and the music-text companion font?
3. Why serif, and why Century Schoolbook? What do the engraving books say about text on a score?
4. Which of these faces could this project ship?

---

## 1. Academico

### 1.1 What it is

| fact | source |
|---|---|
| Copyright **Steinberg Media Technologies GmbH**, 2022, Reserved Font Name "Academico", **SIL OFL 1.1**, version 0.902 | the name table of `public/fonts/Academico.otf` (read with `strings`); `fc-query` gives foundry `SMTG`, family `Academico`, styles `Regular` and `Bold` (`AcademicoBold.otf`) |
| Dorico's default text font: *"The default font used for text in Dorico is Academico. This is the font that will be used by all paragraph styles that inherit from the default font, and also for text components of music items, such as tempo markings and playing techniques."* | Dorico blog (Steinberg), Anthony Hughes, 2019-06-25, <https://blog.dorico.com/2019/06/tip-set-the-default-text-font-for-new-projects/> |
| It is Bravura's paired text face: *"For the Bravura music font, the equivalent text font is Academico"*, and *"For the Petaluma music font, the equivalent text font is Petaluma Script"* | Dorico Pro 3 manual, Music Fonts dialog, <https://archive.steinberg.help/dorico_pro/v3/en/dorico/topics/engrave_mode/engrave_mode_music_fonts_dialog_r.html> |
| Bravura's own SMuFL metadata names it first: `"textFontFamily": ["Academico", "Century Schoolbook", "Edwin", "serif"]` | `scripts/vendor/Bravura.json:26-31` (also noted at `src/engine/fonts/bravuraMetrics.ts:337`) |
| OFL use is fine in any publication (Daniel Spreadbury, Steinberg staff, 2019-05-18). In 2018 the font *"doesn't have its own public repository"* (same poster, 2018-10-04) | Steinberg forum, <https://forums.steinberg.net/t/academico-open-font-license/114847> |
| No Cyrillic (Daniel Spreadbury, 2020-08-13) | <https://forums.steinberg.net/t/new-academico-font/154102> |
| **Based on New Century Schoolbook**: *reported by* a forum user (benwiggy, 2018-10-05: *"a 'clone' of New Century Schoolbook. There are small differences in the design and dimensions, but it's very close"*) and by Fontesk (*"based on New Century Schoolbook"*). Bravura's metadata listing `"Century Schoolbook"` as the second choice (row above) is primary evidence that the two are meant to be interchangeable. ⚠️ No Steinberg sentence saying "based on" was found. | forum URL above; <https://fontesk.com/academico-typeface/> |
| **Designer Daniel Spreadbury**: *reported by* Fontesk and a search summary of third-party pages. ⚠️ No Steinberg page was found saying it. | <https://fontesk.com/academico-typeface/> |

### 1.2 Italic

- **This repo ships no Academico italic.** `public/fonts/` holds `Academico.otf`, `AcademicoBold.otf`,
  `Bravura.otf`, `OFL.txt`. `FONT_FILES` registers only the normal and bold weights
  (`src/engine/fonts/fontFiles.ts:52-53`).
- **VexFlow ships no italic either.** Its entry file loads `academico.js` and `academicobold.js`,
  both under the family name `Academico` (`node_modules/vexflow/build/esm/entry/vexflow.js:3-4, 13-14`).
  It then calls `VexFlow.setFonts('Bravura', 'Academico')` (`:27`). The CDN table has one Academico
  file (`node_modules/vexflow/build/esm/src/font.js:210`).
- **Whether an Academico italic exists at all is UNKNOWN from a primary source.** Fontesk reports
  *"two weights with matching italics"*. Dorico's own install was not inspected.
- ⚠️ `public/fonts/OFL.txt` carries **Bravura's** copyright line (Steinberg 2019, Reserved Font Name
  "Bravura", lines 1-2), not Academico's. Academico's OFL notice is only inside the `.otf` name table.

### 1.3 What the repo does with text today (so the options have a baseline)

| role | face used now | source |
|---|---|---|
| tempo words | Academico **bold**, reached through VexFlow's stack `'Bravura,Academico'` (⚠️ since S13a our own row, `src/engine/fonts/fontCategories.ts:37`, ported from it) and re-ordered text-first | `node_modules/vexflow/build/esm/src/metrics.js:62`; `src/engine/rendering/TempoLayout.ts:155-160`; fallback `src/interactions/TempoTextSource.ts:21` |
| expression words (`dolce`), italic | **not Academico**: `DYNAMIC_TEXT_FONT = 'Georgia, "Times New Roman", Times, serif'`, chosen because it *"has a true italic face (the music font doesn't)"* | `src/engine/rendering/dynamicStyle.ts:54-56`; applied italic at `src/interactions/DynamicTextSource.ts:265-267` |
| italic parentheses (trill, ottava, pedal) | the same Georgia/Times stack | `trillStyle.ts:59`, `ottavaStyle.ts:78`, `pedalStyle.ts:50` (all `src/engine/rendering/`) |
| title and composer (the 🚧 sketch) | `Georgia, "Times New Roman", Times, serif` | `src/engine/rendering/ScoreHeaderPass.ts:125-128, 202` |
| menu specimens (italic expression, bold tempo) | Georgia/Times stack | `src/menus/MenuLayer.ts:171-172, 179` |
| lyrics, chord symbols, rehearsal marks | not implemented (no `lyric` in `src/types/music.ts`) | grep |
| VexFlow's own italic elements (not ours — ⚠️ and not in the app at all since VexFlow's removal) | `PedalMarking`, `Stroke`, `TabSlide`, `TextBracket` ask for `fontStyle: 'italic'` in a family with no italic file | `node_modules/vexflow/build/esm/src/metrics.js:111, 181, 192, 204` |

**So the score's text is already split across two families today.** Upright words (tempo) are
Academico. Italic words, parentheses and the title use a system serif stack, which depends on the
viewer's installed fonts.

### 1.4 Why Academico is here at all

VexFlow 5 makes it the default: `setFonts('Bravura', 'Academico')` (`vexflow.js:27`), with
`MetricsDefaults.fontFamily: 'Bravura,Academico'` (`metrics.js:62`). The repo kept VexFlow's pair and
copied the OTFs into `public/fonts/`. `fontFiles.ts:14-17` records that VexFlow's embedded build and
ours differ slightly in width. VexFlow in turn follows Bravura's SMuFL `textFontFamily`, which puts
Academico first (§1.1). **No document in this repo records a separate decision to choose Academico.**
It came with VexFlow, which followed Bravura's metadata.

---

## 2. Scorewriter × text role → font

"Default" means the default of a new document in the version cited.

| scorewriter | tempo | expression | title / credits | lyrics | chord symbols | rehearsal marks | music-text companion | source |
|---|---|---|---|---|---|---|---|---|
| **Dorico** (Steinberg) | Academico | Academico (italic style **UNKNOWN**) | Academico (via the default paragraph style) | **UNKNOWN** (font style "Lyrics Font" exists) | **UNKNOWN** (styles "Chord Symbols Font" and "Chord Symbols Music Text Font", the latter must be SMuFL) | **UNKNOWN** | **UNKNOWN** by name (Bravura Text is not named in the pages read) | blog 2019-06-25 (§1.1); lyrics styles <https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_lyrics_font_styles_changing_t.html>; chord styles <https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_chord_symbols/notation_reference_chord_symbols_appearance_font_changing_t.html> |
| **Sibelius 7 to 2018.5** (Avid) | Plantin | Plantin | Plantin (*"display sizes (for titles, etc.)"*) | Plantin (*"smaller sizes (for lyrics, etc.)"*) | **UNKNOWN** | **UNKNOWN** | Opus Text (music font family Opus / Opus Std) | *What's New in Sibelius 7*, "New default text font": *"Plantin is now the default text font family in many of the supplied manuscript papers, including the default Blank manuscript paper"*, <https://resources.avid.com/SupportFiles/Sibelius/7/Whats_New.pdf> (extracted text lines 663-674) |
| **Sibelius ≤ 6.2 and ≥ 2018.6** | Times New Roman | Times New Roman | Times New Roman | Times New Roman | **UNKNOWN** | **UNKNOWN** | Opus Text | *reported by* Scoring Notes (Philip Rothman, 2018-11-12): Times New Roman *"is the default text font in Sibelius 6.2 and earlier and in 2018.6 and later"*, <https://www.scoringnotes.com/tips/use-the-tinos-font/>. ⛔ No Avid release note for 2018.6 was read. |
| **Finale** (MakeMusic, discontinued 2024) | Times New Roman | Times New Roman | Times New Roman | Times New Roman | **UNKNOWN** | **UNKNOWN** | Maestro Times (to v26): *"includes Times New Roman uppercase, lowercase, numeric, punctuation, and symbol characters"*; v27: Finale Maestro Text (on disk, §4) | *"One of the reasons that Finale uses Times New Roman as a default is that it is one of the few fonts that is available on all devices"*, Mark Adler, MakeMusic blog, 2015-11-11, <https://www.finalemusic.com/blog/creating-distinctive-music-notation-house-styles-fonts/>; <https://usermanuals.finalemusic.com/FinaleMac/Content/Finale/font-maestro.htm>. ⚠️ Per-role defaults beyond "Times New Roman is the default" are not stated in either page. |
| **MuseScore 4** (`main`) | Edwin **Bold** 12 pt | Edwin **Italic** 10 pt | Edwin 22 pt (title), Edwin (composer) | Edwin | Edwin | Edwin **Bold** 14 pt, boxed | Leland Text (`musicalTextFont`); dynamics glyphs from Leland | `src/engraving/style/styledef.cpp`: tempo `:1209, :1213`; expression `:1189, :1193`; default `:852`; title `:871-875`; composer `:905`; lyrics `:136`; chord symbols `:425`; rehearsal `:1443, :1447`; music/text fonts `:635-636`; dynamics `:806` |
| **MuseScore 2.x** (legacy) | FreeSerif | FreeSerif | FreeSerif | FreeSerif | — | — | MScore Text | `src/engraving/rw/read206/read206.cpp:185`: `String family = u"FreeSerif";` is the text style default when a 2.x file is read. Edwin arrived in 3.6 (`fonts/edwin/FONTLOG.txt`: v0.51 *"Packaged with MuseScore 3.6"*) |
| **LilyPond** | serif family | serif family | serif family | serif family (`LyricText` `font-series normal`, `define-grobs.scm:2220`) | serif family | serif family | Emmentaler (`fonts.music = "emmentaler"`) | `ly/paper-defaults-init.ly:169-173`: `fonts.serif` = `"LilyPond Serif"` (PDF/PS) or `"serif"` (SVG). `mf/00-lilypond-fonts.conf:11-22`: **LilyPond Serif = C059 → Century SchoolBook URW → Century Schoolbook L → TeX Gyre Schola → DejaVu Serif → … → serif**. Same table in `Documentation/en/notation/text.itely:1975-1982`. Dynamics are `font-series bold`, `font-shape italic` (`scm/define-grobs.scm:1439-1441`) |
| **Verovio** | Times | Times | Times | Times | Times | Times | the SMuFL font (Leipzig default), embedded as a text font by `smuflTextFont` | `include/vrv/resources.h:64`: `GetTextFont()` returns `"Liberation"` if the option is on, else `"Times"`. `src/svgdevicecontext.cpp:528` writes `font-family: <that>, serif`. Option `fontTextLiberation` defaults `false` (`src/options.cpp:1322-1324`). Metrics tables `data/text/Times*.xml`. `fonts/README.md`: the bundled text font is **Liberation**. Music font default `Leipzig` (`src/options.cpp:1307`). ⚠️ Verovio's weight/shape per role comes from the MEI `<rend>` of each file, not surveyed |
| **Flat** (flat.io) | URW Century Schoolbook L | same | same | same | same | same | Petaluma → Petaluma Script | Flat help, "Text styles": default changed March 2018 from **Noto Serif** to **URW Century Schoolbook L** (*"licensed under GNU GPL v2"*), <https://help.flat.io/en/music-notation-software/text-styles/> |
| **Noteflight** | **UNKNOWN** | **UNKNOWN** | **UNKNOWN** | **UNKNOWN** | **UNKNOWN** | **UNKNOWN** | **UNKNOWN** | support page 403, <https://support.noteflight.com/hc/en-us/articles/4408052003092-Changing-Fonts-and-Text-Size-in-Noteflight> |
| **Guitar Pro** | not researched | | | | | | | — |

**In brief:** every default found is a **serif**, and they fall into two families.

- **Century Schoolbook design:** Dorico (Academico), MuseScore 3.6+ (Edwin = renamed C059), LilyPond
  (C059 / Century Schoolbook L / TeX Gyre Schola), Flat (Century Schoolbook L).
- **Times / Plantin design:** Sibelius (Times New Roman, and Plantin in 7 to 2018.5), Finale (Times
  New Roman), Verovio (Times / Liberation Serif).

**Also a default: companion text faces per music font.** Bravura→Academico, Leland→Edwin,
Petaluma→Petaluma Script. Leland's SMuFL metadata declares `"textFontFamily": ["Edwin", "serif"]`
(`~/dev/engine-sources/MuseScore/fonts/leland/leland_metadata.json:26-29`).

---

## 3. What the books say

**The main finding: no book in the library names a typeface family, and none argues for serif over
sans.** They specify **style**: roman vs italic vs bold, and case, with some sizes.

Method. The OCR text of Gould, Ross, Stone and Gerou & Lusk was searched for
`typeface|font|italic|roman type|serif|schoolbook|times|bold`. Every Gould quotation below was read
off a rendered scan. Separately, Gould's OCR was searched for
`sans|times|baskerville|century|helvetica|garamond`. That search found no typeface-family sentence;
its hits were "century" as in *nineteenth-century*. ⚠️ This is a statement about the search, not proof
of absence: OCR can miss words.

### 3.1 The roman / italic / bold system (all four agree)

| role | rule | source |
|---|---|---|
| **the system itself** | *"Roman and italic typefaces differentiate directives: roman type is used for player allocation, instrument changes and technical instructions, with bold roman for tempi; italic type is used for expression marks, with stylised bold italic for dynamics. The reader is accustomed to this text differentiation, and information can thus be assimilated more quickly."* | **Gould p. 492** (PDF 512), *Text typefaces in the music* |
| why italic for expression | *"This typeface is inherited from nineteenth- and twentieth-century precedents in which italic was generally used for all Italian markings"* … *"The most important consideration is to use whichever typeface is most legible in the context"* | Gould p. 492 (PDF 512) |
| technical instructions | *"use lower-case letters. They should be sufficiently large to be conspicuous, but not use bold type – which is reserved for tempi and dynamics."* | Gould p. 492 (PDF 512) |
| the same system, second source | *"all these terms customarily appear in roman type in the music, italics being reserved for expression marks and dynamics"* … *"It is strongly suggested that these two different typefaces be maintained, because musicians have become accustomed to them and quick reactions are essential for good musical performances."* | **Stone p. 176** (2-up PDF 35, left half) |
| **tempo** | *"Tempo indications are printed in bold roman type and are usually larger than other text so as to be very conspicuous."* A rubato marking for a single line takes *"small italic type, as an expression mark would"*. *"italic should be reserved for expression marks"*. *"New (established) tempi have initial capitals; temporary indications (allargando, accel., rall., etc.) do not."* | **Gould p. 182** (PDF 202) |
| tempo, second source | *"Tempo marks are always in a bold Roman type (upper and lower case) so they will be readily seen"*; companion expression words *"may be in Roman type or italic, quite often in parenthesis"*; *"These types should never appear in a smaller size than the text – preferably in 10 to 12 point."* | **Ross p. A-46** (PDF 268) |
| tempo, third source | *"The type is bold Roman."* `a tempo` after rit./accel.: *"The type will be bold italic."* `Tempo I`: *"bold Roman"*. Metronome mark type *"slightly smaller than that of the tempo"* | **Gerou & Lusk pp. 142-143** (PDF 73) |
| **dynamics wording** | *"All wording referring to dynamics uses an italic typeface. A stylized bold italic gives symbols p, f, m, s and z an individual and weighty appearance. No other text with the music should be as conspicuous."* `cresc., dim., sempre` *"should use lower-case italic but never a bold typeface."* | **Gould p. 101** (PDF 121) |
| dynamics, Ross | marks *"printed in boldface italic type designed exclusively for dynamics marks and are part of no other set or font of type"*. ⚠️ Terms like `cresc.` are *"engraved in lowercase, boldface italic type"* (p. 186, PDF 198 per the OCR), which **contradicts Gould's "never a bold typeface"** | **Ross p. 185** (PDF 197, scan read); p. 186 OCR only |
| **rehearsal marks** | *"Place rehearsal letters or figures in conspicuous non-italic bold type, to differentiate them from bar numbers. Many editions use the roman bold time-signature typeface."* | **Gould p. 484** (PDF 504) |
| **bar numbers** | *"It is best to use italic to differentiate bar numbers from roman-type page numbers"* | Gould p. 484 (PDF 504) |
| **lyrics** | *"Place the text below the vocal line, in roman type. Italic may be used to differentiate sounds that are not part of the literary text"*. Size: *"A good proportion for the height of a lower-case letter (such as 'm') is one stave-space."* | **Gould p. 438** (PDF 458) |
| second language in underlay | *"the upper language should be in roman type and the language of the lower line in italic type"* | Stone (OCR line 20617, page not rendered: **UNKNOWN** printed page) |
| **title page** | *"Centre the title at the top of the page, with dedication (if required) above it, in italic."* … composer/arranger right, author/translator left; *"These proper names usually appear in small capitals."* | **Gould p. 504** (PDF 524) |
| credits, Gerou | *"The typeface for all three credits is usually Roman."* | **Gerou & Lusk p. 53** (PDF 28) |
| title size, Ross | *"The size and style of type are determined by the individual engraver or publisher (a good point-size is one equivalent to the width of three staff-spaces)."* | Ross, title-page section (PDF 229, OCR; printed page **UNKNOWN**, appendix numbering) |
| instrument names | *"The typeface allocated to instrument names placed in a score margin should match the one chosen for text instructions within the score."* | Gould p. 508 (PDF 528, OCR) |
| tuplet numerals | Ross: *"Italic type is always used … (A tilted roman type should not be substituted for the italic.)"* | Ross OCR lines 9726-9729, page **UNKNOWN** |

### 3.2 What this means for a text face (inference, labelled as such)

- The books require a family with **four real styles**: roman, italic, bold roman, and bold italic
  (for `a tempo` in Gerou, and for Ross's dynamics terms). Ross's *"A tilted roman type should not be
  substituted for the italic"* rules out a synthesised oblique. That matters here, because Academico
  as shipped has no italic (§1.2).
- Gould wants small capitals for proper names (p. 504). Whether Academico or Edwin has true small
  caps is **UNKNOWN** (not inspected).
- **Why Century Schoolbook specifically?** No book says. The only stated reasons found are the
  vendors':
  - Sibelius chose Plantin because it is *"a classic font used in music publishing … the text font
    family of choice for Oxford University Press's music publications"*, and because Plantin's
    *"larger than normal x-height … improves legibility at small point sizes"* (Sibelius 7 PDF).
  - Finale chose Times New Roman for availability (Adler 2015).
  - A reason for Century Schoolbook from Steinberg, MuseScore or LilyPond was **not found**.
    Century Schoolbook's own commission "for maximum legibility" (Ginn & Company textbooks) is
    *reported by* a search summary only, not a primary source. **UNKNOWN.**

---

## 4. Licences: can we ship it?

"Ship" = redistribute the font file with the app and embed it in exported PDFs.

| face | licence | ship? | source |
|---|---|---|---|
| **Academico** (regular, bold) | SIL OFL 1.1, RFN "Academico", © 2022 Steinberg | ✅ already shipped; needs its OFL notice (currently only in the `.otf` metadata) | `public/fonts/Academico.otf` name table |
| **Edwin** (Roman, Italic, Bold, Bold Italic, v0.54) | SIL OFL 1.1, RFN "Edwin", © MuseScore. Derived from URW **C059** (Core 35 v2.0, which URW also released under OFL in 2017, *"without a 'Reserved Font Name' clause"*) | ✅ all **four** styles | `~/dev/engine-sources/MuseScore/fonts/edwin/README.md`, `LICENSE.txt:1-4`, `FONTLOG.txt` |
| **C059** (URW Core 35 v2.0) | AGPL-3 with font exception (Debian's copy). Per Edwin's README, also LPPL 1.3c and OFL 1.1 (2017) | ✅ under the OFL grant. ⚠️ The OFL-licensed distribution itself was not located | `/usr/share/doc/fonts-urw-base35/copyright`; Edwin README |
| **Century Schoolbook L** (URW, old Ghostscript) | GPL (Flat: *"GNU GPL v2"*); Edwin README: Core 35 1999-2000 under GPL and AFPL, later LPPL | ⚠️ GPL font; the font exception is **UNKNOWN** for this build | Flat help page; Edwin README |
| **TeX Gyre Schola** | GUST Font License (legally equivalent to LPPL 1.3c) | ✅ free; requests renaming derived fonts | *reported by* <https://www.fontsquirrel.com/license/TeX-Gyre-Schola>; official page <https://www.gust.org.pl/projects/e-foundry/tex-gyre/schola> (not fetched) |
| **FreeSerif** (GNU FreeFont) | GPLv3+ **with font-embedding exception** | ✅ (embedding in a document does not make it GPL) | `~/dev/engine-sources/MuseScore/fonts/FreeSerif.sfd` (LangName licence string) |
| **Liberation Serif** (Verovio's option; metric match for Times New Roman) | SIL OFL 1.1 (Liberation 2.x) | ✅ | `/usr/share/doc/fonts-liberation2/copyright`; `verovio/fonts/README.md` |
| **Century Schoolbook / New Century Schoolbook** (Monotype / Linotype) | proprietary commercial | ⛔ | *reported by* <https://www.myfonts.com/collections/new-century-schoolbook-font-linotype/> |
| **Times New Roman** (Monotype) | proprietary | ⛔ | **UNKNOWN** from a primary source (only a Wikipedia search hit) |
| **Plantin** (Monotype) | proprietary; Sibelius ships it *"under license from Monotype Imaging Ltd."* | ⛔ | Sibelius 7 PDF |
| **Opus Text** (Avid) | not published under a free licence as far as found | ⛔ assumed; **UNKNOWN** | no licence page found |
| **Maestro / Maestro Times** (legacy Finale) | **UNKNOWN** (MakeMusic licensing page returned 403) | **UNKNOWN** | <https://makemusic.zendesk.com/hc/en-us/articles/1500013053461-MakeMusic-Fonts-and-Licensing-Information> (403) |
| **Finale Maestro Text** | SIL OFL 1.1, © 2021 MakeMusic, RFNs "Finale", "Maestro", "Broadway", "Engraver", "Jazz" | ✅ | `~/dev/engine-sources/MuseScore/fonts/finalemaestro/OFL.txt:1-5` |
| **Bravura Text** | SIL OFL 1.1, © 2015 Steinberg | ✅ | `MuseScore/fonts/bravura/OFL.txt`; `bravura-text.md` |
| **Leland Text** | SIL OFL 1.1, RFN "Leland", © MuseScore | ✅ | `MuseScore/fonts/leland/LICENSE.txt:1-4`, `README.md` |
| **Petaluma Text / Petaluma Script** | SIL OFL 1.1, © 2018 Steinberg; the family is *"Petaluma, Petaluma Text, and Petaluma Script"* | ✅ (VexFlow already bundles Petaluma Script, `vexflow.js:8`) | `MuseScore/fonts/petaluma/OFL.txt:1-4`, `FONTLOG.txt` |
| Georgia (used today for italic, §1.3) | proprietary (Microsoft); not shipped, only named in a CSS stack | ⛔ as a file. Today it is whatever the viewer has installed | **UNKNOWN** licence citation |

---

## 5. Possible future preset rows (no recommendation)

Each row is a text face whose **source default** is cited above, with the styles the books ask for
(§3.1). "Styles available" means files that exist under a licence we could ship.

| preset (named after its source) | music font it pairs with | tempo (bold roman) | expression (italic) | titles | lyrics (roman) | rehearsal (bold) | styles available to ship | source of the pairing |
|---|---|---|---|---|---|---|---|---|
| **Dorico / Bravura** (current) | Bravura | Academico Bold | Academico Italic (**not available here**) | Academico | Academico | Academico Bold | regular, bold | Bravura `textFontFamily[0]`; Dorico Music Fonts dialog |
| **MuseScore / Leland** | Leland | Edwin Bold | Edwin Italic | Edwin | Edwin | Edwin Bold | R, I, B, BI | `styledef.cpp` §2; `leland_metadata.json:26-29` |
| **Edwin with Bravura** | Bravura | Edwin Bold | Edwin Italic | Edwin | Edwin | Edwin Bold | R, I, B, BI | Bravura `textFontFamily[2]` = `"Edwin"` (`scripts/vendor/Bravura.json:29`) |
| **LilyPond** | Emmentaler (or any) | C059 / TeX Gyre Schola Bold | … Italic | … | … | … Bold | C059 R/I/B/BI under OFL; TeX Gyre Schola R/I/B/BI under GFL | `00-lilypond-fonts.conf:11-22` |
| **Times-metric** (Finale / Sibelius / Verovio look) | any | Liberation Serif Bold | Liberation Serif Italic | Liberation Serif | Liberation Serif | Liberation Serif Bold | R, I, B, BI | Verovio `fontTextLiberation`; Finale/Sibelius Times New Roman defaults |
| **Petaluma** (handwritten) | Petaluma | Petaluma Script | **UNKNOWN** (no italic style inspected) | Petaluma Script | Petaluma Script | Petaluma Script | per `FONTLOG.txt` (styles not inspected) | Dorico dialog; Flat help |
| **GNU FreeSerif** (MuseScore 2 look) | any | FreeSerif Bold | FreeSerif Italic | FreeSerif | FreeSerif | FreeSerif Bold | R, I, B, BI (`MuseScore/fonts/FreeSerif*.ttf`) | `read206.cpp:185` |

The music-text companion (for ♩ in a tempo mark, ♭ in a chord symbol) is a separate column: Bravura
Text, Leland Text, Petaluma Text or Finale Maestro Text, all OFL (§4). Today the repo draws the tempo
glyph from Bravura itself (`TempoLayout.ts:155-160`).

---

## 6. UNKNOWN

1. **Whether Academico has an italic** (primary source). Only Fontesk reports "matching italics";
   neither VexFlow nor this repo has one.
2. **Academico's designer and its basis** stated by Steinberg. Both are *reported* (Fontesk, a forum
   user). The primary evidence is only Bravura's `textFontFamily` listing Century Schoolbook second.
3. **Which Dorico version introduced Academico.** It existed by 2018-10-04 (forum).
4. **Dorico's per-role defaults**: lyrics, chord symbols, rehearsal marks, the italic style of
   expression text, and the name of its default music-text font.
5. **Sibelius** chord-symbol and rehearsal-mark fonts. The 2018.6 switch back to Times New Roman is
   *reported* only (Scoring Notes).
6. **Finale** per-role defaults, and the licence of legacy Maestro / Maestro Times (MakeMusic page 403).
7. **Noteflight**: all defaults (support page 403). **Guitar Pro**: not researched.
8. **Opus Text**, **Times New Roman** and **Georgia** licences from a primary source.
9. **Century Schoolbook L's font exception**, and the location of URW's OFL release of C059.
10. **Why Century Schoolbook** was chosen by Steinberg, MuseScore or LilyPond. No stated reason found.
11. **Small capitals** (Gould p. 504) in Academico or Edwin: not inspected.
12. Printed page numbers for Ross's title-page (PDF 229) and tuplet passages, and for Stone's
    underlay sentence. Ross p. 186's "boldface italic" for `cresc.` was read from OCR, not the scan.
13. LilyPond's per-grob weight/shape for `MetronomeMark`, `RehearsalMark` and `TextScript`, and
    Verovio's per-role styling: not surveyed.
