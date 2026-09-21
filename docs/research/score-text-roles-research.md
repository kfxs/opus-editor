# Score text ROLES: the standard model of a score's words — roles, styles, sizes, inheritance

**Research only, 2026-09-21. A SURVEY, not a plan.** Nothing here is built, nothing is ranked, and
nothing is recommended. It builds on `docs/research/score-text-fonts-research.md` (2026-09-14) and
does not repeat it: that document answers *which FACE* (what Academico is, each scorewriter's default
family per role, the licences) and quotes the books' **roman / italic / bold system** with its pages
(its §3.1). This one answers the question underneath: **what are the BUILDING BLOCKS** — the list of
text roles, each role's style and SIZE, and the shape the mature engines give those rows so that a
user can change them.

Every claim cites a file:line, a URL, or a printed page with its PDF page. What could not be
established is **UNKNOWN** and listed in §7 — never a plausible rule.

Engine checkouts (under `~/dev/engine-sources/`, see `reference/README.md`): MuseScore `main` @
`929d1e9`, LilyPond `master` @ `beedbfa`, Verovio `develop` @ `efff0bc` (libmei inside it). MusicXML
is the **4.0 XSD** MuseScore vendors: `MuseScore/src/importexport/musicxml/schema/musicxml.xsd`.
Books: the four in `reference/` (Gould PDF page = printed + 20; Ross PDF = printed + 12 in the body,
appendix pages `A-n` found by search; Stone is 2-up).

⚠️ **A change was in progress in the working tree while this was written** (`src/engine/fonts/textFont.ts`
untracked; `tempoStyle`, `dynamicStyle`, the three line styles, `DynamicsLayout` modified). §5 records
what the files said at that moment and says so per row. No source file was edited.

---

## 0. Questions

1. **The role vocabulary.** Which text roles does each engine / interchange format define? What is
   the union, and which roles does everybody have?
2. **Sizes.** Each role's default size per engine, normalised to staff spaces; what the books state;
   who scales text with the staff and who keeps it absolute.
3. **Structure.** How is a role's row inherited, overridden per role and per item; how is the
   music-text font (symbols inside words) referenced; how is a music font tied to a text font?
4. **Our inventory.** Every place our score's text gets a family / size / weight / style today, and
   where that disagrees with the consensus.
5. **Options** for the building block — listed, not ranked, each with its risk.

### The normalisation used everywhere below

A size is stated as the **em (font size) in staff spaces** at the engine's own reference staff:

| engine | 1 staff space = | because | source |
|---|---|---|---|
| MuseScore | **4.961 pt** | `spatium` default 1.75 mm; 1.75 ÷ 25.4 × 72 = 4.9606 | `styledef.cpp:797`; spatium-dependent text is `size × spatium / defaultSpatium` (`dom/textbase.cpp:2557-2561`) |
| LilyPond | **5 pt** | default staff-height 20 pt ÷ 4; `text-font-size = 11 × staff-height/20pt` | `scm/paper.scm:68-82` (line 78); one `font-size` step = `2^(1/6)` (`scm/lily-library.scm:1718-1719`) |
| Verovio | **2 MEI units** | the unit is *"1⁄2 of the distance between the staff lines"* | `src/options.cpp:1202-1203` |
| Dorico | **5 pt — ⚠️ INFERRED** | its *Default music font* is reported as Bravura **20 pt**, and a SMuFL em is 4 staff spaces, so 20 pt ÷ 4. ⛔ No Steinberg page stating the reference staff was read | §2, third-party table |
| ours | **7.5 pt** | `STAFF_SPACE_PX` = 10 px, 1 pt = 4/3 px | `src/engine/rendering/painter/drawnFontSize.ts`; stated at `tempoStyle.ts:55` |

---

## 1. The role vocabulary

### 1.1 MuseScore — `TextStyleType`, ALL of it

The enum is `src/engraving/types/types.h:866-958` (grouped by its own comments: page- / measure- /
system- / staff- / note- / line-oriented, then 12 user styles). Each style is a complete row of
`Sid`s in `src/engraving/style/styledef.cpp`; the column below is that file's line of the row's
`…FontFace`. **Every face is `"Edwin"`** except where noted. `sp-dep` = `…FontSpatiumDependent`
(true ⇒ the size follows the staff size). Method: a script extracted every
`styleDef(<x>FontFace|FontSize|FontStyle|FontSpatiumDependent|FrameType, …)` from the file; em in
sp = pt ÷ 4.961. `FontStyle` is a bit set: Bold = 1, Italic = 2 (`types.h:965-972`) — so
`measureNumberFontStyle` `2` is italic and `pageNumberFontStyle` `1` is bold.

| group | style (`Sid` prefix) | line | pt | sp | style | sp-dep | frame |
|---|---|---|---|---|---|---|---|
| — | `default` | 852 | 10 | 2.02 | normal | ✅ | |
| page | `title` | 871 | 22 | 4.43 | normal | ⛔ | |
| page | `subTitle` | 888 | 14 | 2.82 | normal | ⛔ | |
| page | `composer` | 905 | 10 | 2.02 | normal | ⛔ | |
| page | `lyricist` | 922 | 10 | 2.02 | normal | ⛔ | |
| page | `translator` | 1335 | 10 | 2.02 | normal | ⛔ | |
| page | `frame` | 1513 | 10 | 2.02 | normal | ⛔ | |
| page | `partInstrument` (INSTRUMENT_EXCERPT) | 1141 | 14 | 2.82 | normal | ⛔ | |
| page | `longInstrument` / `shortInstrument` | 1109 / 1125 | 10 | 2.02 | normal | ✅ | |
| page | `instrumentChange` | 1694 | 10 | 2.02 | **bold** | ✅ | |
| page | `groupBracket` | 1157 | 10 | 2.02 | normal | ✅ | |
| page | `header` / `footer` / `copyright` | 1628 / 1644 / 1661 | 9 | 1.81 | normal | ⛔ | |
| page | `pageNumber` | 1678 | 11 | 2.22 | **bold** (`1`) | ⛔ | |
| measure | `measureNumber` | 1270 | 8 | 1.61 | *italic* (`2`) | ⛔ | |
| measure | `measureNumberAlternate` | 1294 | 10 | 2.02 | ***bold italic*** | ⛔ | rectangle |
| measure | `mmRestRange` | 1314 | 8 | 1.61 | *italic* | ⛔ | |
| system | `tempo` | 1209 | 12 | 2.42 | **bold** | ✅ | |
| system | `tempoChange` | 1229 | 12 | 2.42 | **bold** | ✅ | |
| system | `metronome` | 1253 | 12 | 2.42 | normal | ⛔ | |
| system | `repeatPlayCount` / `repeatLeft` / `repeatRight` | 1462 / 1481 / 1497 | 10 | 2.02 | normal | ✅ | |
| system | `rehearsalMark` | 1443 | 14 | 2.82 | **bold** | ✅ | rectangle |
| system | `systemText` | 1351 | 10 | 2.02 | normal | ✅ | |
| staff | `staffText` | 1371 | 10 | 2.02 | normal | ✅ | |
| staff | `staveSharingLabel` | 1391 | 10 | 2.02 | normal | ✅ | |
| staff | `expression` | 1189 | 10 | 2.02 | *italic* | ✅ | |
| staff | `dynamics` (the WORDS; the letters are `dynamicsFont` = music font, `:805-807`) | 1174 | 10 | 2.02 | *italic* | ✅ | |
| staff | `hairpin` (`cresc.` text) | 332 | 10 | 2.02 | *italic* | ✅ | |
| staff | `lyricsOdd` / `lyricsEven` | 136 / 151 | 10 | 2.02 | normal | ✅ | |
| staff | `chordSymbolA` / `chordSymbolB` | 425 / 439 | 10 | 2.02 | normal / *italic* | ✅ | |
| staff | `romanNumeral` (face **Campania**) | 453 | 12 | 2.42 | normal | ✅ | |
| staff | `nashvilleNumber` | 467 | 12 | 2.42 | normal | ✅ | |
| staff | `figuredBass` (face **MScoreBC**) | 1734 | 8 | 1.61 | normal | ✅ | |
| note | `tuplet` | 771 | 9 | 1.81 | *italic* | ✅ | |
| note | `articulation` | 1093 | 8 | 1.61 | normal | ✅ | |
| note | `sticking` | 1714 | 10 | 2.02 | normal | ✅ | |
| note | `fingering` / `lhGuitarFingering` | 939 / 970 | 8 | 1.61 | normal | ✅ | |
| note | `rhGuitarFingering` | 986 | 8 | 1.61 | *italic* | ✅ | |
| note | `hammerOnPullOffTapping` | 1002 | 8 | 1.61 | normal | ✅ | |
| note | `stringNumber` | 1034 | 8 | 1.61 | normal | ✅ | circle |
| note | `stringTunings` (size only; face row not in this pattern) | 1050 | 9 | 1.81 | — | — | |
| note | `tabFretNumber` (face **FreeSans**) | 955 | 9 | 1.81 | normal | ✅ | |
| note | `fretDiagramFingering` / `fretDiagramFretNumber` (**FreeSans**) | 1411 / 1427 | 6 | 1.21 | normal | ✅ | |
| note | `harpPedalDiagram` / `harpPedalTextDiagram` | 1052 / 1073 | 10 / 8 | 2.02 / 1.61 | normal | ✅ | |
| line | `textLine` / `systemTextLine` / `noteLine` | 824 / 840 / 1548 | 10 | 2.02 | normal | ✅ | |
| line | `volta` | 664 | 11 | 2.22 | **bold** | ✅ | |
| line | `ottava` | 725 | 10 | 2.02 | normal | ✅ | |
| line | `pedal` | 367 | 10 | 2.02 | normal | ✅ | |
| line | `glissando` | 1568 | 8 | 1.61 | *italic* | ✅ | |
| line | `bend` | 1593 | 8 | 1.61 | normal | ✅ | |
| line | `letRing` / `whammyBar` / `palmMute` | 1957 / 1983 / 2009 | 10 | 2.02 | normal | ✅ | |
| user | `user1` … `user12` | 1742 … 1940 | 10 | 2.02 | normal | ✅ | |

⭐ **The pattern in the last column but one:** what belongs to the PAGE (title, credits, header,
footer, page number, measure number, metronome) is **absolute**; what belongs to the MUSIC is
**staff-relative**. ⚠️ `metronome` (absolute) beside `tempo` (relative) is MuseScore's own
inconsistency, recorded as found.

### 1.2 LilyPond — every grob with a `text-interface`, and what it declares

`scm/define-grobs.scm`. Method: a script listed each grob's `font-series` / `font-shape` /
`font-size` / `font-encoding` / `font-family` with its line. **A grob that declares nothing takes the
default: family serif (roman), series normal, shape upright, `font-size` 0** = 11 pt at a 20 pt staff
= **2.20 sp** (`paper.scm:78`). em at step *n* = 11 × 2^(n/6) pt; ÷ 5 for sp.

| grob | line | series / shape | `font-size` | pt @20 | sp | note |
|---|---|---|---|---|---|---|
| `TextScript` (expression, technique — all `^"…"` text) | 3806 | — | 0 | 11 | 2.20 | ⚠️ **upright**: italic is the user's `\markup \italic` |
| `MetronomeMark` (tempo) | 2336 | — (the words are wrapped `make-bold-markup`, the note `make-smaller-markup`: `scm/translation-functions.scm:115-137`) | 0 | 11 | 2.20 | bold by MARKUP, not by grob property |
| `DynamicText` | 1434 | bold italic, `font-encoding fetaText` (the music font's letters) | 0 | — | — | glyphs, not the text face |
| `DynamicTextSpanner` (`cresc.`) | 1463 | **bold italic** (1482-1483) | +1 (1485) | 12.35 | 2.47 | ⚠️ bold — Ross's side of the Gould/Ross split (§3) |
| `TextSpanner` | 3841 | italic (3853) | 0 | 11 | 2.20 | |
| `RehearsalMark` | 2880 | — | +2 (2889) | 13.86 | 2.77 | |
| `SegnoMark` / `CodaMark` | 3087 / 1002 | — | +2 | 13.86 | 2.77 | |
| `SectionLabel` | 3046 | — | +1.5 (3057) | 13.08 | 2.62 | |
| `TextMark` | 3765 | — | +0.5 (3776) | 11.65 | 2.33 | |
| `JumpScript` (D.C., D.S.) | 1899 | italic (1908) | 0 | 11 | 2.20 | |
| `BarNumber` | 319 | — | −2 (328) | 8.73 | 1.75 | ⚠️ upright; Gould asks italic |
| `CenteredBarNumber` | 766 | — | 0 (770) | 11 | 2.20 | |
| `LyricText` | 2214 | series normal (2220) | +1 (2221) | 12.35 | 2.47 | |
| `StanzaNumber` | 3416 | bold (3421) | 0 | 11 | 2.20 | |
| `LyricRepeatCount` | 2170 | italic (2179) | +1 | 12.35 | 2.47 | |
| `TupletNumber` | 4135 | italic (4140) | −2 (4141) | 8.73 | 1.75 | text-face italic digit |
| `Fingering` | 1541 | `fetaText` digits (1548) | −5 (1550) | 6.17 | 1.23 | music-font numerals |
| `StringNumber` / `StrokeFinger` | 3520 / 3550 | `fetaText` / italic | −5 / −4 | 6.17 / 6.93 | 1.23 / 1.39 | |
| `InstrumentName` / `InstrumentSwitch` | 1852 / 1871 | — | 0 | 11 | 2.20 | |
| `OttavaBracket` | 2712 | **bold italic** (2716-2717) | 0 | 11 | 2.20 | |
| `VoltaBracket` | 4301 | — (number via `\volta-number`, `define-markup-commands.scm:3734`) | −2 (4306) | 8.73 | 1.75 | |
| `SustainPedal` | 3579 | — ; its strings `"Ped." "*Ped." "*"` (`ly/engraver-init.ly:894`) print as music glyphs | — | — | — | not text-face |
| `SostenutoPedal` / `UnaCordaPedal` | 3194 / 4156 | italic (3198 / 4160) | 0 | 11 | 2.20 | |
| `ChordName` | 838 | `font-family sans` (843) | +1.5 (844) | 13.08 | 2.62 | the one **sans** role |
| `BassFigure` | 353 | features `tnum cv47 ss01` | 0 | — | — | |
| `MultiMeasureRestNumber` / `MeasureCounter` / `PercentRepeatCounter` | 2398 / 2243 / 2813 | `fetaText` | 0 / −2 / −2 | | | music-font numerals |
| `MultiMeasureRestText`, `CombineTextScript` (bold, 1084), `BalloonText`, `Footnote`, `NoteName`, `HorizontalBracketText` (−1), `BendSpanner` (italic, −2), `ClefModifier` (italic, −4), `TabNoteHead` (bold, −2) | | | | | | the rest of the list |
| **titles** — not grobs: `bookTitleMarkup` | `ly/titling-init.ly:68-99` | title `\huge \larger \larger \bold` = +4 bold; subtitle `\large \bold` = +1 bold; subsubtitle `\smaller \bold`; instrument `\large \bold`; dedication, poet, composer, meter, arranger, piece, opus: **default** | | title 17.46 | **3.49** | `\huge` = +2, `\large` = +1 (`define-markup-commands.scm:4027, 4041`) |

⭐ **Everything in LilyPond is staff-relative** — there is no absolute flag; `text-font-size` is
multiplied by `staff-height / 20pt` (`paper.scm:72-78`). An absolute size is a per-markup act
(`\abs-fontsize`).

### 1.3 Verovio — ONE size, and style per ELEMENT in code

Verovio has no style table. There is one base: option `lyricSize` = **4.5 MEI units = 2.25 sp**
(`src/options.cpp:1403-1405`; `m_drawingLyricFontSize = unit × lyricSize`, `src/doc.cpp:2400`), scaled
by the staff's size (`GetDrawingLyricFont(staffSize)`, `doc.cpp:2130-2134`) ⇒ **all staff-relative**.
Each MEI control element then hard-codes weight/shape, and the file's `<rend>` overrides per run:

| MEI element | face | weight / shape | size | source (`src/`) |
|---|---|---|---|---|
| `<tempo>` | text font | **bold** | base 2.25 sp | `view_control.cpp:2753-2754, 2779` |
| `<dir>` (expression AND technique — MEI has one element) | text font | *italic* | base | `view_control.cpp:1767-1768, 1794` |
| `<dynam>` (words; letter strings are swapped to SMuFL glyphs) | text font | *italic* | base | `view_control.cpp:1846-1847, 1875` |
| `<reh>` | text font | **bold** | base | `view_control.cpp:2601-2602, 2658` |
| `<harm>` | text font | normal | base | `view_control.cpp:2305, 2336` |
| `<fing>` | text font | normal | base × `fingeringScale` 0.75 = **1.69 sp** | `options.cpp:1302-1303`; `doc.cpp:2401`; `view_control.cpp:2108, 2130` |
| `<mNum>` | text font | *italic* | the base **at staff size 80** = **1.80 sp** | `view_page.cpp:1142-1143, 1172` |
| `<syl>` / `<verse>` | text font | from `@fontweight`/`@fontstyle` | base | `view_element.cpp:1893-1899` |
| `<label>` / `<labelAbbr>` (instrument names) | text font | normal | base | `view_page.cpp:513-515` |
| `<pgHead>` / `<pgFoot>` text | text font | from `<rend>` only | base at staff size 100 | `view_text.cpp:662-675` |
| a SMuFL symbol inside text | the MUSIC font, size × `GetMusicToLyricFontSizeRatio()` | upright | | `view_text.cpp:125-129, 401-403` |
| `<rend>` (any run) | `@fontname`; `@fontsize` numeric / percent / term; `@fontstyle`; `@fontweight` | | | `view_text.cpp:378-411` |

### 1.4 MusicXML 4.0 and MEI — the interchange vocabulary

**MusicXML** (`musicxml.xsd`). A `<direction-type>` is one of (`:3487-3536`): `rehearsal`, `segno`,
`coda`, **`words`**, `symbol`, `wedge`, `dynamics`, `dashes`, `bracket`, `pedal`, `metronome`,
`octave-shift`, `harp-pedals`, `damp`, `damp-all`, `eyeglasses`, `string-mute`, `scordatura`, `image`,
`principal-voice`, `percussion`, `accordion-registration`, `staff-divide`, `other-direction`.
🚨 **`<words>` is ONE role**: a tempo word, an expression word and a technique are all `<words>`,
told apart only by their font attributes (and a sibling `<sound tempo>`). Other text-bearing
elements: `<lyric><text>` (`:5063`), `<harmony>` (`:3641`), `<figured-bass>` (`:4849`), `<fingering>`
(`:3610`), `<ending>` (volta, `:3238`), `<tuplet-number>` (`:5772`), `<part-name>` /
`<part-name-display>` (`:6021, 4080`), `<measure-numbering>` (`:3754`), and `<credit>` with a free
`<credit-type>` whose *"Standard values include page number, title, subtitle, composer, arranger,
lyricist, rights, and part name"* (`:5828-5838`). The font vocabulary is the `font` attribute group
(`:2004-2012`): `font-family` (comma list), `font-style` **normal | italic** (`:149-155`),
`font-size` a CSS term **or a numeric POINT size** (`:142-146`), `font-weight` **normal | bold**
(`:159-165`) — *"The default is application-dependent, but is a text font vs. a music font."*
Document defaults: **`<music-font>`, `<word-font>`, `<lyric-font number name>`** (`:5878-5880`).
⛔ MusicXML has no staff-relative text size: sizes are points against `<scaling>`.

**MEI** (libmei in Verovio, `libmei/dist/`). Text-bearing elements are the ones in §1.3 (`tempo`,
`dir`, `dynam`, `reh`, `harm`, `fing`, `mNum`, `syl`/`verse`, `label`/`labelAbbr`, `pgHead`/`pgFoot`,
`<title>`), styled by `<rend>` with `att.typography`: `@fontfam`, `@fontname`, `@fontsize`,
`@fontstyle` **italic | normal | oblique** (`atttypes.h:737-743`), `@fontweight` **bold | normal**
(`:748-753`), size terms `xx-small … xx-large, smaller, larger` (`:720-731`), and `@rend` values incl.
`smcaps`, `box`, `circle`, `dbox`, `tbox`, underline/strike forms (`:1841-1861`). Document defaults on
`<scoreDef>`: **`@music.name/@music.size`** (`atts_shared.h:4455-4459`), **`@text.fam/.name/.size/
.style/.weight`** (`:7134-7152`), **`@lyric.fam/.name/.size/.style/.weight`** (`:3468-3486`).

⭐ **Both standards carry the same three-way default — MUSIC font · TEXT (word) font · LYRIC font —
and both reduce style to two booleans: italic?, bold?**

### 1.5 Dorico — font styles and paragraph styles

Primary (Steinberg manual): the **Edit Font Styles** dialog holds *"fonts … used for items that you
cannot edit using the text editor"*; each has Font family, Size, **Staff-relative / Absolute**
(*"whether the size of the font changes according to the staff size of the layout or whether it is
always the set size"*), Style (*Regular, Italic, Bold, Bold Italic*), Underlined; *"You must activate
options before you can change them. Activated options override the Default Text Font font style
settings."* —
<https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/engrave_mode/engrave_mode_font_styles_dialog_r.html>.
**Paragraph styles** have a *parent*; a style *"inherits its settings automatically for all options
with deactivated sliders"* —
<https://archive.steinberg.help/dorico/v3/en/dorico/topics/engrave_mode/engrave_mode_paragraph_styles_dialog_r.html>.
Changing the default family changes *Default Text Font* (font style) and *Default Text* (paragraph
style) and *"also affects the font family used by all other font and paragraph styles in the project
whose font family has not been overridden"* —
<https://archive.steinberg.help/dorico/v5/en/dorico/topics/library/library_text_default_font_family_changing_t.html>.

The per-style DEFAULTS are ⚠️ **reported by a third party, not read in Dorico**: Music Tech Solutions
(tarokoike, 2025-11-26, Dorico Pro 6; the style NAMES are that page's English, possibly
back-translated from the Japanese UI) — <https://www.music-tech-solutions.co.jp/en/post/dorico_fonts_en>.
sp = pt ÷ 5 (inferred, §0). ⛔ Which rows are staff-relative is **UNKNOWN** (the page does not say).

| kind | style | face | pt | sp | style |
|---|---|---|---|---|---|
| font | Default text font | Academico | 10 | 2.0 | regular |
| font | Default music text font | **Bravura Text** | 10 | 2.0 | regular |
| font | Default music font | Bravura | 20 | 4.0 | regular |
| font | Dynamic text font (`cresc.`, *dolce* beside a dynamic) | Academico | 10 | 2.0 | *italic* |
| font | Dynamic music text font | Bravura | 20 | 4.0 | — |
| font | Performance (playing) technique font | Academico | 11 | 2.2 | regular |
| font | Pedal line font | Academico | 10 | 2.0 | regular |
| font | Font for repeat brackets (volta) | Academico | 10 | 2.0 | regular |
| font | Tuplet font / Tuplet plain font | Bravura 20 / Academico 11 | | 4.0 / 2.2 | — / *italic* |
| font | Fingering font / fingering text / italic text | Bravura 20 / Academico 8 / 8 | | 4.0 / 1.6 / 1.6 | — / regular / *italic* |
| font | Chord symbol font / music text font | Academico 11 / Bravura Text 11 | | 2.2 | regular |
| font | Glissando line text · Trill interval | Academico | 8 | 1.6 | *italic* · regular |
| font | Page number font | Academico | 8 | 1.6 | **bold** |
| font | Multi-rest tacet font · Bar repeat counting | Academico | 11 | 2.2 | **bold** · regular |
| font | Time signature plain font | Academico | 14 | 2.8 | **bold** |
| font | Figured bass text font | Academico | 8 | 1.6 | regular |
| paragraph | Default Text | Academico | 12 | 2.4 | regular |
| paragraph | Title · Flow Title · Layout Name | Academico | 20 · 16 · 14 | 4.0 · 3.2 · 2.8 | regular |
| paragraph | Composer · Lyricist | Academico | 10 | 2.0 | regular |
| paragraph | Tempo (Instant) · Tempo (Stepped) | Academico | 11 | 2.2 | **bold** |
| paragraph | Tempo (Metronome Marks) | Academico | 9 | 1.8 | regular |
| paragraph | Rehearsal Marker | Academico | 14 | 2.8 | **bold** |
| paragraph | Repeat Marker Jump / Section · Number of Repeats | Academico | 11 | 2.2 | **bold** |
| paragraph | Bar Numbers (Score) / (Part) | Academico | 9 | 1.8 | *italic* |
| paragraph | Lyrics · Lyrics (Verse Numbers) | Academico | 11 | 2.2 | regular |
| paragraph | Lyrics (Chorus) / (Translation) / (Chorus Translation) | Academico | 11 | 2.2 | *italic* |
| paragraph | Staff Labels · Staff Labels (Inner) | Academico | 10 | 2.0 | regular |
| paragraph | Player Group Label · Player Label · Cue Label | Academico | 10 · 8 · 8 | 2.0 · 1.6 · 1.6 | regular |
| paragraph | Instrument Change Label / Notification | Academico | 12 | 2.4 | regular |
| paragraph | Header · Page Number · Copyright | Academico | 10 · 10 · 8 | 2.0 · 2.0 · 1.6 | regular |
| paragraph | Tacet · Harp Pedal Settings · Percussion Legend | Academico | 16 · 11 · 8 | | regular |

The same page reports that between Pro 5 and Pro 6 the tempo roles **moved from font styles to
paragraph styles** (*Immediate Tempo Text Font* → *Tempo (Instant)*; *Metronome Music Text Font* +
*Metronome Text Font* → *Tempo (Metronome Mark)*) — i.e. the two kinds are one table drawn in two
dialogs. Sibelius and Finale role lists: **not surveyed** (§7).

### 1.6 The UNION — which sources define each role (no proposal)

✅ = a named role/row; ◐ = exists but folded into a more general role; — = absent. "Books" names who
states a style rule for it (pages in §3 and in `score-text-fonts-research.md` §3.1).

| # | role | MuseScore | LilyPond | Verovio / MEI | MusicXML | Dorico | books |
|---|---|---|---|---|---|---|---|
| 1 | **default text** (the parent) | ✅ `default` | ✅ (the unset grob) | ✅ `@text.*` | ✅ `<word-font>` | ✅ Default Text Font | — |
| 2 | **tempo** (established) | ✅ `tempo` | ✅ `MetronomeMark` | ✅ `<tempo>` | ◐ `<words>` | ✅ Tempo (Instant) | Gould, Ross, G&L |
| 3 | **gradual tempo** (rit., accel.) | ✅ `tempoChange` | ◐ TextScript/TextSpanner | ◐ `<tempo>` | ◐ `<words>` | ✅ Tempo (Stepped)/Gradual | Gould, G&L |
| 4 | **metronome mark** | ✅ `metronome` | ◐ inside MetronomeMark | ◐ `<tempo>` | ✅ `<metronome>` | ✅ Tempo (Metronome Marks) | G&L |
| 5 | **expression** | ✅ `expression` | ◐ `TextScript` | ◐ `<dir>` | ◐ `<words>` | ◐ Dynamic text font | Gould, Stone |
| 6 | **dynamic words** (`cresc.`, *sempre*) | ✅ `dynamics` + `hairpin` | ✅ `DynamicTextSpanner` | ✅ `<dynam>` | ◐ `<words>` | ✅ Dynamic text font | Gould, Ross |
| 7 | **technique / staff text** | ✅ `staffText` | ◐ `TextScript` | ◐ `<dir>` | ◐ `<words>` | ✅ Playing technique font | Gould, Stone |
| 8 | **system text** | ✅ `systemText` | ✅ `TextMark` | ◐ `<dir>` | ◐ `<words>` | ◐ | — |
| 9 | **rehearsal mark** | ✅ | ✅ `RehearsalMark` | ✅ `<reh>` | ✅ `<rehearsal>` | ✅ Rehearsal Marker | Gould |
| 10 | **bar number** | ✅ `measureNumber` | ✅ `BarNumber` | ✅ `<mNum>` | ✅ `<measure-numbering>` | ✅ Bar Numbers | Gould |
| 11 | **lyrics** (+ verse number, translation) | ✅ odd/even | ✅ `LyricText`, `StanzaNumber` | ✅ `<syl>`, `@lyric.*` | ✅ `<lyric-font>` | ✅ Lyrics (5 styles) | Gould, Ross, Stone |
| 12 | **chord symbols** | ✅ A/B + roman + nashville | ✅ `ChordName` | ✅ `<harm>` | ✅ `<harmony>` | ✅ Chord Symbol Font | — |
| 13 | **figured bass** | ✅ | ✅ `BassFigure` | ◐ `<harm>`/`<fb>` | ✅ | ✅ | — |
| 14 | **fingering** | ✅ (+ guitar LH/RH, string no.) | ✅ `Fingering`, `StringNumber`, `StrokeFinger` | ✅ `<fing>` | ✅ `<fingering>` | ✅ | Gould |
| 15 | **tuplet numeral** | ✅ `tuplet` | ✅ `TupletNumber` | ◐ music glyphs | ✅ `<tuplet-number>` | ✅ Tuplet (plain) font | Gould, Ross |
| 16 | **instrument name** long / short | ✅ | ✅ `InstrumentName` | ✅ `<label>`/`<labelAbbr>` | ✅ `<part-name>` | ✅ Staff Labels | Gould |
| 17 | **instrument change** | ✅ | ✅ `InstrumentSwitch` | ◐ `<dir>` | ◐ | ✅ | Gould (roman) |
| 18 | **volta / ending** | ✅ `volta` | ✅ `VoltaBracket` | ◐ | ✅ `<ending>` | ✅ repeat brackets | — |
| 19 | **repeat / jump text** (D.C., Fine, Coda) | ✅ repeatLeft/Right | ✅ `JumpScript`, `CodaMark`, `SegnoMark` | ◐ `<dir>` | ✅ `<segno>`/`<coda>` + `<words>` | ✅ Repeat Marker Jump/Section | Gould |
| 20 | **ottava text** | ✅ `ottava` | ✅ `OttavaBracket` | ◐ | ✅ `<octave-shift>` | ◐ music glyphs | Gould, Ross |
| 21 | **pedal text** | ✅ `pedal` | ✅ Sostenuto/UnaCorda (Sustain = glyphs) | ◐ | ✅ `<pedal>` | ✅ Pedal line font | — |
| 22 | **text line / glissando / bend text** | ✅ | ✅ `TextSpanner`, `BendSpanner` | ◐ | ✅ `<dashes>`/`<bracket>` | ✅ Glissando line text | — |
| 23 | **title** | ✅ | ✅ header:title | ✅ `<pgHead>`/`<title>` | ✅ credit-type `title` | ✅ Title, Flow Title | Gould, Ross |
| 24 | **subtitle** | ✅ | ✅ | ◐ | ✅ `subtitle` | ◐ | — |
| 25 | **composer / arranger** | ✅ | ✅ | ◐ `<pgHead>` | ✅ `composer`, `arranger` | ✅ | Gould, G&L |
| 26 | **lyricist / poet / translator** | ✅ | ✅ | ◐ | ✅ `lyricist` | ✅ | Gould, G&L |
| 27 | **dedication** | — (frame text) | ✅ | ◐ | ◐ | ◐ | Gould (italic) |
| 28 | **copyright / rights** | ✅ | ✅ | ◐ `<pgFoot>` | ✅ `rights` | ✅ | — |
| 29 | **header / footer** | ✅ | ✅ odd/evenHeaderMarkup | ✅ | ◐ | ✅ | — |
| 30 | **page number** | ✅ | ✅ | ◐ | ✅ `page number` | ✅ | Gould (roman) |
| 31 | **part name** (on a part) | ✅ `partInstrument` | ✅ header:instrument | ◐ | ✅ `part name` | ✅ Layout Name | — |
| 32 | **multirest range / count, tacet** | ✅ `mmRestRange` | ✅ | ◐ | — | ✅ | — |
| 33 | **user-defined styles** | ✅ ×12 | (any markup) | (any `<rend>`) | ◐ `other-direction` | ✅ create paragraph style | — |

**The consensus set** — a NAMED role in at least four of the five columns: **default, tempo,
rehearsal mark, bar number, lyrics, chord symbols, fingering, tuplet numeral, instrument name,
volta, title, composer, lyricist, copyright, page number** — plus the group every source has but
splits differently: **the words on the staff** (expression · dynamic words · technique · system
text), which MuseScore and Dorico make 3–4 roles, LilyPond one upright `TextScript`, MEI one italic
`<dir>`, and MusicXML one `<words>`. ⭐ The books split exactly there (Gould p. 492: roman for
instructions, italic for expression), so the role split follows the BOOKS, not the file formats.

---

## 2. Sizes, in staff spaces (em)

Arithmetic per §0. `rel` = scales with the staff; `abs` = fixed points. Dorico's rel/abs per row is
UNKNOWN; its numbers are the third-party report of §1.5.

| role | MuseScore | LilyPond | Verovio | Dorico (reported) | the books |
|---|---|---|---|---|---|
| default / staff text | 2.02 rel | 2.20 rel | 2.25 rel | 2.0 (font) · 2.4 (paragraph) | Gould p. 492: *"sufficiently large to be conspicuous"* — no number |
| **tempo** | **2.42** rel, bold | 2.20 rel, bold | 2.25 rel, bold | **2.2**, bold | Gould p. 182: *"usually larger than other text"*; Ross p. A-46: *"10 to 12 point"*, never smaller than the text — ⚠️ at an unstated staff; at a 7 mm staff (4.96 pt/sp) that would be 2.0–2.4 sp, **conditional** |
| gradual tempo | 2.42 rel, bold | 2.20 | 2.25 | 2.2, bold | Gould p. 182: a single line's rubato takes *"small italic type"* |
| metronome mark | 2.42 **abs**, regular | note glyph `\smaller` inside the mark | 2.25 | **1.8**, regular | G&L pp. 142-143: *"slightly smaller than that of the tempo"* |
| **expression** | **2.02** rel, italic | 2.20 rel, upright | 2.25 rel, italic | **2.0**, italic | no number for expression words as such; Gould p. 182 calls an expression mark's type *"small italic"* relative to tempo. For `cresc.`-class words see the next row |
| dynamic words (`cresc.`) | 2.02 rel, italic | 2.47 rel, **bold** italic | 2.25 rel, italic | 2.0, italic | Gould p. 101 (PDF 121): *f* **2½** sp high, *p* **2** sp, *m s z* **one** stave-space; `cresc.` etc. *"is the same size and should use lower-case italic but never a bold typeface"*. Ross p. 186 agrees on 2½ / 2 / 1 |
| rehearsal mark | **2.82** rel, bold, boxed | 2.77 rel | 2.25 rel, bold | **2.8**, bold | Gould p. 484: *"conspicuous non-italic bold"*; many use *"the roman bold time-signature typeface"* — no size |
| **bar number** | **1.61 abs**, italic | 1.75 rel, upright | 1.80 rel, italic | **1.8**, italic | Gould p. 484: italic — no size |
| **lyrics** | 2.02 rel | 2.47 rel | 2.25 rel (it IS the base: `lyricSize`) | 2.2 | **Gould p. 438** (PDF 458): lower-case height (*'m'*) = **one stave-space** ⇒ em **≈ 2.14 sp** in Academico/Edwin (measured x-height 0.467 em, below). **Ross p. A-25** (PDF 247, read off the scan): *"usually 9 to 10 point … a type from **1½ spaces to 2¾ spaces tall**, (comparable to the staff size used)"* — ⚠️ the second fraction is read as ¾ from a 200 dpi render; "tall" is not defined (body or cap) |
| chord symbols | 2.02 rel | 2.62 rel, sans | 2.25 | 2.2 | — |
| fingering | 1.61 rel | 1.23 rel (music-font digits) | 1.69 rel | 1.6 | Gould p. 309 (PDF 329, OCR): *"a small bold roman font"* — no number |
| **tuplet numeral** | 1.81 rel, italic | 1.75 rel, italic | music glyph | 2.2 italic (plain) / music glyph | **Gould p. 193** (PDF 213, OCR): italic, *"The height of the numeral is 1½ stave-spaces"*. **Ross p. 159** (PDF 171): *"boldface italic numeral 3 approximately one and a third spaces high"* — ⚠️ these are DIGIT heights, not ems |
| ottava | 2.02 rel | 2.20 rel, bold italic | — | music glyph | **Gould p. 28** (PDF 48, OCR): *"written in italic, the numeral '8' is 1½ stave-spaces high"*. Ross (OCR l. 11986, page not located): *"always in italics, the word bassa matches the size of the 8"* |
| volta | 2.22 rel, bold | 1.75 rel | — | 2.0 | — |
| instrument name | 2.02 rel | 2.20 rel | 2.25 rel | 2.0 | Gould p. 508: same typeface as the text instructions — no size |
| **title** | **4.43 abs** | 3.49 rel, bold | — | **4.0** | Ross (PDF 229, OCR): *"a good point-size is one equivalent to the width of three staff-spaces"* = **3 sp** |
| subtitle | 2.82 abs | 2.47 rel, bold | — | — | — |
| composer / lyricist | 2.02 abs | 2.20 rel | — | 2.0 | Gould p. 504: small capitals — no size |
| copyright · header/footer | 1.81 abs | 2.20 | — | 1.6 · 2.0 | — |
| page number | 2.22 abs, bold | 2.20 | — | 1.6 bold (font) · 2.0 (paragraph) | Gould p. 484: roman — no size |

**Method for "x-height 0.467 em":** `opentype.js` on the repo's own `public/fonts/*.otf`, 2026-09-21 —
Academico: OS/2 `sxHeight` 464 / 1000 upm, the glyph `x` tops at 467; Edwin-Roman 466; Edwin-Italic
470; Academico Bold 475; Nepomuk 450 / 1024 = 0.439. Cap height 0.722 em for Academico and Edwin.
So Gould's one-space x-height is em = 1 ÷ 0.467 = **2.14 sp** in either, 2.28 sp in Nepomuk —
⭐ a size stated as an **x-height** is portable across faces; a size stated as an **em** is not.

**Headlines.** (a) The body of the score's words sits in a narrow band, **2.0–2.25 sp**, in every
engine, and Gould's lyric rule lands inside it (2.14). (b) **Tempo is the same or ~1.2× larger and
always bold** (2.2–2.42). (c) Rehearsal marks **≈2.8**, bar numbers **1.6–1.8**, fingering
**1.2–1.7**, tuplet digits **1.75–1.8 em** (books: a 1⅓–1½ sp tall digit), title **3–4.4**.
(d) **Who scales:** LilyPond and Verovio scale everything; MuseScore and Dorico carry a per-role
flag, and MuseScore's defaults draw the line between *music* (relative) and *page* (absolute).

---

## 3. Two real disagreements the rows will have to carry

| question | one side | the other |
|---|---|---|
| are `cresc.` / `dim.` words **bold**? | **No** — Gould p. 101 *"never a bold typeface"*; MuseScore, Verovio, Dorico (italic, regular weight) | **Yes** — Ross p. 186 (OCR) *"lowercase, boldface italic"*; LilyPond `DynamicTextSpanner` bold italic (`define-grobs.scm:1482-1483`) |
| is a **bar number** italic? | **Yes** — Gould p. 484; MuseScore, Verovio, Dorico | LilyPond `BarNumber` is upright (`:319-328` declares no shape) |
| is plain `^"text"` italic? | MEI `<dir>` draws italic by default (`view_control.cpp:1768`) | LilyPond `TextScript` and MusicXML `<words>` are upright until styled |
| is the **tuplet numeral** text or music? | text-face italic digit: MuseScore, LilyPond, Dorico "plain" | SMuFL tuplet glyphs: Verovio, Dorico default (Bravura), ours |

---

## 4. Structure — the inheritance shape

| | the default every role starts from | a ROLE's row | per-ITEM override | music symbols inside words | music font ⇄ text font |
|---|---|---|---|---|---|
| **MuseScore** | ⛔ **no parent.** `default` is just another style; every style owns all 16 properties (`style/textstyle.cpp:30-50` is the shape: FontFace, FontSize, LineSpacing, SizeSpatiumDependent, FontStyle, Color, Align, FrameType/Padding/Width/Round/colours, MusicalSymbolsScale, MusicalSymbolsSize, Position) as separate `Sid`s | a `TextStyle` = a list of `(property, Sid, Pid)` triples (`textstyle.cpp`); the values live in the score's `MStyle`, saved in the file / a `.mss` | each item property carries `PropertyFlags` **NOSTYLE / UNSTYLED / STYLED** (`dom/property.h:63-65`): STYLED follows the role, UNSTYLED is the item's own; plus per-run formatting inside the text | a run whose family is the pseudo-font `"ScoreText"` is drawn from `Sid::musicalTextFont` at the style's `MusicalSymbolSize`, or from `musicalSymbolFont` × `MusicalSymbolsScale` (`dom/textbase.cpp:882-908`); spatium scaling applied the same way | `musicalTextFont` is derived as `"<music family> Text"` (`internal/engravingfont.cpp:841`) and applied when the music font changes with *optimize style* ticked (`notationscene/widgets/editstyle.cpp:2362-2375`); `dynamicsFont` follows the music font unless `dynamicsOverrideFont`. ⛔ SMuFL's `textFontFamily` is **`// not supported`** (`engravingfont.cpp:777`) — the TEXT face never follows the music font |
| **Dorico** | ✅ **one parent each side**: font style *Default Text Font*, paragraph style *Default Text*; changing the default family reaches *"all other font and paragraph styles … whose font family has not been overridden"* (URL §1.5) | a style stores only its ACTIVATED options; the rest fall through to the parent (font styles → Default Text Font; paragraph styles → any chosen parent, so chains are possible) | text items: paragraph + character styles in the editor; font-style items: properties panel (not surveyed) | separate named font styles: *Default Music Text Font* (Bravura Text), *Chord Symbols Music Text Font*, *Metronome Music Text Font*, *Dynamic Music Text Font* (§1.5) | the Music Fonts dialog: *"For the Bravura music font, the equivalent text font is Academico"* (`score-text-fonts-research.md` §1.1) — offered as a pairing; whether it rewrites Default Text Font automatically is **UNKNOWN** |
| **LilyPond** | ✅ **the property chain**: `\paper` `property-defaults.fonts.{music, serif, sans, typewriter}` (`ly/paper-defaults-init.ly:169-178`) and `text-font-size` (`paper.scm:78`) → a grob's `font-family` / `font-series` / `font-shape` / `font-size` (relative STEPS) → unset = default | the grob definition (`define-grobs.scm`), changed by `\override Grob.font-size` at any context level (score, staff, voice) | `\tweak` / `\once \override`, and `\markup` commands per run (`\bold`, `\italic`, `\fontsize`, `\abs-fontsize`) | `font-encoding` `fetaText` / `fetaMusic` select the music font's letters and numerals (DynamicText `:1439`, Fingering `:1548`); `\musicglyph` in markup | none: `fonts.music` and `fonts.serif` are independent keys |
| **Verovio / MEI** | one text font (option) + one base size (`lyricSize`); MEI `@text.*` / `@lyric.*` / `@music.*` on `<scoreDef>` | hard-coded per element in `view_control.cpp` (§1.3) | `<rend>` per run | the music font at `GetMusicToLyricFontSizeRatio()` (`view_text.cpp:125-129`) | none |
| **MusicXML** | `<defaults>`: `<music-font>`, `<word-font>`, `<lyric-font>` | ⛔ none — a role is not a concept; every element may carry the `font` group | the `font` attributes on the element | `<symbol>` / `<credit-symbol>` (SMuFL names) beside `<words>` | none |
| **VexFlow 5** (what we transcribed) | the root of a dotted-path tree: `fontFamily`, `fontSize` 30, `fontWeight`, `fontStyle` | a category node overrides any of the four; the DEEPEST definition on the path wins (`src/engine/fonts/fontCategories.ts:41-93`) | `element.setFont(…)` | the same stack, music font first | one call: `setFonts('Bravura', 'Academico')` |

**The shape they share** (description, not a proposal):

1. **Three document-level faces, independent of one another**: MUSIC · TEXT · (optionally) LYRIC —
   plus, in the two engines with SMuFL-era design, a fourth: the **MUSIC-TEXT** companion for symbols
   inside words. Nobody ties the text face to the music font by force; Dorico and SMuFL metadata
   *suggest* a pairing, MuseScore ignores it.
2. **A flat table of ROLES**, each row = `{ face?, size, style ∈ {regular, italic, bold, bold-italic},
   follows-staff-size? }` + role extras (frame/enclosure, alignment, line spacing, colour, music-symbol
   size). Rows either **inherit the default's unset fields** (Dorico, LilyPond, VexFlow's tree) or
   **are complete and independent** (MuseScore) — the one structural fork.
3. **Item → role → default** resolution, with the item's override flagged per property (MuseScore's
   STYLED/UNSTYLED; Dorico's activated sliders; LilyPond's `\tweak`), and **run-level** markup
   beneath that (`<rend>`, `\markup`, character styles).
4. **Size is a number in points at a reference staff, with a boolean for "scale with the staff"** —
   or, in LilyPond, a relative STEP from one base so that one number resizes all text.

---

## 5. Our inventory (as read 2026-09-21, working tree DIRTY — see the header)

1 sp = 7.5 pt. "via `textFamily`" = the in-progress `src/engine/fonts/textFont.ts` (untracked):
`textFamily(style)` returns the active face if it ships that style, else Academico if it does, else
`SYSTEM_SERIF_STACK` = `Georgia, "Times New Roman", Times, serif` (`textFont.ts:60, 89-94`). With the
default face (Academico: regular + bold only) every italic answer is still the Georgia stack.

| role | file:line | family | size | weight / style | unit | follows staff size? |
|---|---|---|---|---|---|---|
| tempo words | `src/engine/rendering/marks/tempo/tempoStyle.ts:65, 77-86`; drawn `TempoLayout.ts:138` | `textFamily('bold')` + music stack behind (mid-edit) | 18 pt = **2.40 sp** | bold, upright | pt | not surveyed |
| tempo's ♩ | `tempoStyle.ts:41`; `TempoLayout.ts:137` | music font | 20 pt | — | pt | |
| tempo edit box fallback | `src/interactions/text/TempoTextSource.ts:21` | `'Academico, serif'` | **14 pt** (stale: the mark is 18) | bold | pt | reads the drawn `<text>` first (`:141-161`) |
| expression words / dynamic prose | `src/engine/rendering/marks/dynamics/dynamicStyle.ts:39, 62-64, 71-78`; `DynamicsLayout.ts:219, 281-282` | `textFamily('italic')` (⇒ Georgia stack today) + music stack | 16 pt = **2.13 sp** | normal, italic | pt | yes — inside the staff's `scale(k)` group (`DynamicsLayout.ts:29, 160`) |
| dynamic letters (*p f m*) | `dynamicStyle.ts:15`; `DynamicsLayout.ts:264-272` | music font | 30 pt (the root size) | — | pt | yes |
| dynamic edit box | `src/interactions/text/DynamicTextSource.ts:264-268` | same as the annotation | 16 pt × zoom | italic | pt | |
| trill `( )` | `src/engine/rendering/marks/lines/trillStyle.ts:60, 103, 115`; `TrillRenderer.ts:885-889` | `textFamily('italic')` | 26 × 0.52 = 13.52 pt = **1.80 sp** | italic | pt | |
| ottava `( )` | `ottavaStyle.ts:79, 91, 105`; `OttavaRenderer.ts:628-632` | same | 13.52 pt = 1.80 sp | italic | pt | |
| pedal `( )` | `pedalStyle.ts:44-45, 51` | SMuFL E676/E677 (music font); the text family is named but **unused** | 26 pt glyph | — | pt | |
| `tr`, `8va`, `Ped.` themselves | `trillStyle.ts:115`, `ottavaStyle.ts:105`, `pedalStyle.ts:64` | music font glyphs | 26 pt | — | "px" in the comment, pt in use | |
| tuplet numeral | `src/engine/rendering/engraved/ScoreTuplet.ts:26` | music font (SMuFL tuplet digits) | 26 pt | — | pt | yes (scale group, `:20-21`) |
| annotation default | `src/engine/engrave/inheritedFonts.ts:50`; `engraved/EngravedAnnotation.ts:45-47` | **music stack** (`Bravura,Academico`) | 10 pt = 1.33 sp | normal | pt | every real caller overrides it |
| measure number (engraved) | `inheritedFonts.ts:106` (`MEASURE_NUMBER_SIZE_PT` = 8 ⇒ 1.07 sp) | music stack | 8 pt | normal | pt | ⛔ **NOT DRAWN**: `engraved/EngravedStave.ts:356-357` — *"VexFlow's measure NUMBER is not transcribed"*; the constant has no reader but its spec |
| gutter bar number (editor chrome, not the score) | `src/engine/rendering/GutterRenderer.ts:31-32, 174` | `Arial, Helvetica, sans-serif` | 11 **px** × staff size = 1.1 sp | normal | **px** | yes |
| title (🚧 sketch) | `src/engine/rendering/ScoreHeaderPass.ts:90, 128, 202-203` | `Georgia, "Times New Roman", Times, serif` — ⛔ not via `textFamily` | **4.44 sp** | normal | **staff spaces** | sp × `STAFF_SPACE_PX` (`:194`) |
| composer (🚧 sketch) | `ScoreHeaderPass.ts:93` | same | **2.8 sp** | normal | staff spaces | |
| menu specimens (UI, not score) | `src/menus/MenuLayer.ts:166-192` | Georgia stack, spelled in CSS | em-relative | italic / bold | CSS | — |
| the unused category rows | `src/engine/fonts/fontCategories.ts:41-71` | music stack | `Volta` 9 bold · `StaveSection` 10 bold · `Repetition.text` 12 bold · `PedalMarking.text` 12 italic · `TextBracket` 15 italic · `StaveText` 16 · `StaveTempo` 14 (+`name` bold) · `ChordSymbol` 12 · `FretHandFinger` 9 bold · `StringNumber` 10 bold · `Stave` 8 | | pt | a ROLE VOCABULARY we inherited and mostly do not draw |

**Four units are in play for the same kind of number**: pt (marks), px (gutter), staff spaces
(header sketch), and a unitless scale of another constant (the parens). The comments in
`tempoStyle.ts:44-63` and `dynamicStyle.ts:19-29` already state the staff-space form as *"the
portable unit"* and derive the pt value from it.

### 5.1 Mapped onto the consensus roles

| consensus role | ours | vs the consensus |
|---|---|---|
| default text | ⛔ **none** — no row a role inherits from; the nearest things are `textFamily('regular')` (family only) and the inherited `Annotation` 10 pt in the MUSIC stack | every engine has one (§4) |
| tempo | ✅ 2.40 sp bold | agrees (2.2–2.42, bold) |
| gradual tempo · metronome mark | ◐ inside the tempo mark; ♩ = 20 pt glyph | metronome smaller/regular elsewhere (G&L; Dorico 1.8; LilyPond `\smaller`) — ours is one bold run |
| expression | ✅ 2.13 sp italic — but in a **system** face unless the active face ships an italic | size agrees (2.0–2.25); face is the known gap (`score-text-fonts-research.md` §1.3) |
| dynamic words | ◐ the same row as expression | agrees with Gould/MuseScore/Dorico (italic, not bold) |
| technique / staff text (roman) | ⛔ missing — every word we can write is italic or bold | Gould p. 492's first category has no home |
| rehearsal mark · lyrics · chord symbols · fingering · instrument names · volta · repeat/jump text | ⛔ missing (no model) | — |
| bar number | ⛔ not engraved; the gutter's is **sans, upright, 1.1 sp** | consensus: text face, **italic**, 1.6–1.8 sp |
| tuplet numeral | ✅ SMuFL glyphs at 26 pt (em 3.47 sp — a music-font em, not comparable to a text em) | a legitimate side of the §3 fork; the digit's drawn height vs Gould's 1½ sp is **UNKNOWN** (not measured here) |
| ottava / trill / pedal parens | ✅ 1.80 sp italic text (pedal: glyph) | no engine has this role; it is ours |
| title | 🚧 4.44 sp, regular | MuseScore's number exactly; LilyPond 3.49 **bold**; Ross 3 sp |
| composer | 🚧 2.8 sp (his eye, 2026-08-27) | above every engine (2.0–2.2) — a recorded taste call, not an error |
| subtitle · lyricist · copyright · header/footer · page number | ⛔ missing | — |

**Where ours disagrees most** (facts, in the order the numbers make them):

1. **There is no parent and no table.** Sizes, styles and families are constants beside each mark, in
   four units; the family has (as of today's in-progress edit) one owner for three of the draw sites
   and none for the header sketch, the gutter, the annotation default and `FONT_TREE`.
2. **The roman (regular) role does not exist**, and the italic role is not set in a face we ship —
   so of the books' four styles the score can reliably draw one (bold).
3. **The bar number** is the only role where ours contradicts the consensus on family *and* style
   *and* size at once (sans / upright / 1.1 sp vs serif / italic / 1.6–1.8 sp) — with the caveat that
   ours is the editor's gutter, and the engraved one is simply absent.

---

## 6. Options for the building block — listed, NOT ranked

Each is a shape this repo already uses somewhere. Any number in any of them is a sourced DEFAULT row,
changeable, never a blocker (CLAUDE.md, *"An engraving NUMBER is never a blocker"*); §2 is the preset
menu.

| # | option | what it is | risk |
|---|---|---|---|
| A | **One `TEXT_ROLES` table, total over a `TextRole` union** — row = `{ style, sizeSpaces, followsStaffSize }` (+ source), every draw site asks `textRole(role)` and gets a resolved face via `textFamily(style)` | MuseScore's shape: flat, complete rows. The pattern of `ELEMENT_SPECS` / `TEXT_FONTS` | complete rows mean a "make all text bigger" is N edits (MuseScore's known weakness); and the union must include roles we do not draw yet or it is not total over the vocabulary — a row nobody reads rots (`MEASURE_NUMBER_SIZE_PT` is the example on disk) |
| B | **A default row + role rows that state only what differs** | Dorico's / LilyPond's / `FONT_TREE`'s shape: `resolve(role) = { ...DEFAULT, ...ROLE[role] }` | an unset field is a claim ("same as default") that silently changes when the default does — e.g. enlarging the default would enlarge the title; needs the per-field question "relative to default, or its own?" answered per role |
| C | **Size as a RATIO / step of one base** (LilyPond's `font-size` steps; tempo = base × 1.2) rather than an absolute sp number | one knob scales all the words | the books and three of four engines state sizes as independent numbers; a ratio invents a coupling (title ↔ lyrics) that no source states; presets from §2 would have to be converted |
| D | **Size stated as an X-HEIGHT in staff spaces**, em derived from the active face's metrics | the only form in which Gould's lyric rule (p. 438) and her digit heights (pp. 28, 193) can be written down exactly, and the only form that survives a face switch (Academico 0.467 vs Nepomuk 0.439, §2) | needs each text face's x-height/cap-height at layout time (a generated metrics row per face, like the music faces'); every engine's default is an em, so the preset menu needs converting; digits and caps need a second anchor (cap height) |
| E | **Keep per-mark style modules, add only the vocabulary**: a `TextRole` union + `textFamily(style)`; each `…Style.ts` keeps its own size constant but NAMES its role | smallest step; no draw site moves; matches "a row owns its body" | leaves the four units and the scattered sizes in place — the inventory of §5 stays the only table, and it lives in a research doc |
| F | **Adopt the interchange vocabulary as the union** (MEI's element list or MusicXML's direction types) so import/export is a lookup | free mapping to the standards | both collapse the books' key distinction — `<words>` and `<dir>` do not separate roman technique from italic expression (§1.4, §1.6) — so the union would be coarser than the house style needs |
| G | **Follows-staff-size as a per-role boolean** (MuseScore, Dorico) vs **always relative** (LilyPond, Verovio) vs **by placement** (inside a staff's `scale(k)` group ⇒ relative; on the page ⇒ absolute) | orthogonal to A–F; the third is what our code does today by construction (`DynamicsLayout.ts:29`, `ScoreTuplet.ts:20-21`) | a boolean per role is one more field to keep total; "by placement" makes system-level text (tempo over a small top staff) ambiguous — MuseScore's `tempo` relative / `metronome` absolute split is that ambiguity, shipped |

Orthogonal to all of them, and already visible in §4: the **music-text** face (symbols inside words)
is a separate document-level choice in every SMuFL-era engine, and the in-progress `textFont.ts`
header says the same (*"a THIRD choice"*).

---

## 7. UNKNOWN

1. **Dorico's per-style defaults from a primary source**, and **which of its styles are
   staff-relative**. §1.5's table is a third-party report (names possibly back-translated). Its
   reference staff (the 5 pt/sp used to normalise) is an INFERENCE from the reported 20 pt music font.
2. **Sibelius's and Finale's text-style lists and default sizes** — not surveyed; no source on disk.
3. **Ross's reference staff size** for *"10 to 12 point"* tempo type (p. A-46) and *"9 to 10 point"*
   lyrics (p. A-25) — so neither can be normalised unconditionally. And whether A-25's second
   fraction is **2¾** (as read at 200 dpi) or 2¼; and what *"tall"* measures.
4. **Gould's numbers for**: tempo size (only *"larger than other text"*), bar numbers, rehearsal
   marks, fingering, instrument names, title — searched in the OCR (`type size`, `text size`,
   `point`, `smaller type`, `conspicuous`), no number found. ⚠️ A statement about the search: OCR can
   miss. The quotations from pp. 28, 193, 309 were read from the **OCR layer**, not a rendered scan;
   printed page numbers were confirmed from each PDF page's running head.
5. **Stone and Gerou & Lusk on text SIZE**: G&L's only hit is *"in a smaller type"* (cue/ossia
   context, OCR l. 579) and *"A number the size and font of a time-signature number"* for multirests;
   Stone: no size statement found. Not proof of absence.
6. **The printed page of Ross's ottava sentence** (*"the word bassa matches the size of the 8"*, OCR
   l. 11986).
7. **Whether MuseScore has any "change every text style's face" command** — not searched; the style
   table itself has no parent (§4).
8. **Whether Dorico's Music Fonts dialog rewrites Default Text Font** when the music font changes, or
   only offers the pairing.
9. **Our tuplet digit's drawn height** against Gould's 1½ sp / Ross's 1⅓ sp — needs a browser
   measurement (jsdom cannot measure a glyph).
10. **Whether our tempo / line-mark text follows a small staff's size** — dynamics and tuplets do (by
    their scale group); the tempo and the parens were not traced.
11. **SMuFL's own text-related `engravingDefaults`** beyond `textFontFamily` (e.g.
    `textEnclosureThickness`) — not re-read for this survey.
