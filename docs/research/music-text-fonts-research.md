# SMuFL "Text" fonts — what Sebastian Text IS, and how such a font is used

> ⭐⭐ **The question, his (2026-09-21):** *"what we have to know is how to use Sebastian Text."*
> Asked the moment it turned out that **Sebastian Text is not a words font**: 986 SMuFL private-use
> glyphs, one Regular style, and a "Latin alphabet" with no `D` and no `G`.
>
> ⛔ **This is a SURVEY, not a plan and not a decision.** It says what a SMuFL *text font* is, what
> Sebastian Text measures as, how three engines use such a font, and what it would touch here. It
> chooses nothing and schedules nothing; §6 lists options **unranked**.
>
> 📄 Read with `docs/research/smufl-fonts-research.md` (which free music faces exist),
> `docs/research/score-text-fonts-research.md` (the WORDS faces — Academico, Edwin…),
> `docs/research/multi-font-research.md` (how engines carry per-font data) and
> `docs/plans/music-font-switch-plan.md` (the music-face picker this follows). ⚠️ Everything below was
> fetched or measured on **2026-09-21**; §7 lists what was NOT established.

Sources used: the SMuFL specification (two routes that served today: `smufl.formats.music/latest/…`
and `www.w3.org/2021/03/smufl14/…` — ⛔ `w3c.github.io/smufl/latest/specification/…` **404**s);
`fkretlow/sebastian@cb6a92e` (2026-03-19, "v.1.35"); engine checkouts under `~/dev/engine-sources/`:
MuseScore `929d1e9`, Verovio `efff0bc`, LilyPond (as in `score-text-fonts-research.md`); the fonts in
`~/dev/engine-sources/MuseScore/fonts/`; and `opentype.js` measurements (method in §2).

---

## 0. Questions

1. What does SMuFL say a "text font" is, and how is that different from `textFontFamily`?
2. What does Sebastian Text measure as against Sebastian — and does it follow Bravura Text's convention?
3. How do MuseScore, Verovio, LilyPond and Dorico use such a font?
4. Where does OUR engine set a music glyph inside words today, and what would a Text font change there?
5. What are the ways to adopt it, and what does each risk?

### The one-paragraph answer

⭐⭐ **Sebastian Text is Sebastian redrawn at 0.8 × for the inside of a line of words — a SYMBOL font,
never a words font.** You use it by setting **only the SMuFL private-use characters** of a text run in
it, **at the same point size as the words around them**, with the words' own face doing the letters:
its staff is 0.8 em (caps-height) instead of 1 em, its dynamics letters are 1.65 × so that their
x-height matches a text face's, and its line metrics are a text font's (800/−200) so it does not blow
the line apart. 🚨 **It must never LEAD a font-family stack that also carries words**: its ASCII slots
are not letters but Finale's legacy 8-bit symbol layout (`q` = a quarter note, `&` = a G clef, `f` =
*forte*, digits = time-signature digits) — a word set in it turns into music. ⚠️ And for the ONE place
we set a note inside words today — the tempo mark's `♩` — **it changes nothing for Sebastian**: the
metronome range (U+ECA0–ECB7) is the SAME DRAWING in Sebastian and Sebastian Text (§2.3 #4). What it would
change is the dynamics letters inside expression text, and anything future (chord-symbol accidentals,
a `♩ = ♩.` equation, fingering/figured-bass/pedal symbols typed into text).

---

## 1. What SMuFL says — two DIFFERENT things share the word "text"

### 1.1 `textFontFamily` — a WORDS face, named by the music font's metadata

> *"An array containing the text font family (or families, in descending order of preference) that are
> ideally paired with this music font; this list may also use the generic font family values defined
> in CSS…"* — SMuFL, `specification/engravingdefaults.html`

It is a list of **words** faces. Measured in the metadata files on disk:

| music font | `engravingDefaults.textFontFamily` | source |
|---|---|---|
| Bravura 1.392 | `Academico, Century Schoolbook, Edwin, serif` | `MuseScore/fonts/bravura/bravura_metadata.json` |
| Leland 0.80 | `Edwin, serif` | `MuseScore/fonts/leland/leland_metadata.json` |
| **Sebastian 1.35** | **`Nepomuk, Libre Bodoni, Palatino, serif`** | upstream `fonts/Sebastian.json` |
| Petaluma 1.065 · Finale Maestro 2.7 | *(key absent)* | their JSONs, same folder |

⇒ ⭐ **Sebastian's words companion is Nepomuk, not Sebastian Text.** ⛔ No metadata key anywhere names
a font's *Text* twin — the pairing "X ⇒ X Text" is a NAMING convention (§1.2), which is exactly how
MuseScore finds it (§3.1).

### 1.2 A font named "… Text" — music SYMBOLS cut to sit inside words

> *"…it is helpful for scoring applications that all symbols in a font be scaled relative to each other
> as if drawn on a staff of a particular size, and conversely it is helpful for musical symbols to be
> drawn in-line with text to be scaled relative to the letterforms with which the musical symbols are
> paired, in general a single font cannot address these two use cases: the required metrics and
> relative scaling of glyphs are incompatible. Therefore, it is recommended that font developers make
> clear whether a given font is intended for use by scoring applications or by text-based applications
> by appending "Text" to the name… "Bravura Text" is intended for use by text-based applications (or
> indeed for mixing musical symbols with free text within a scoring application)."*
> — SMuFL, `specification/scoring-vs-text-applications.html`

The footnote gives the reason, and it is **line spacing**: applications derive a line's height from
ascender + descender + line gap and many clip beyond it, so a font whose G clef is twice its eighth
note needs a line so tall it *"would greatly distort the line spacing of the text"* (Bravura itself:
*"very large line spacing (1.75 times its em square)"*).

What the spec then asks of a text font (`specification/text-metrics-glyph-registration.html`), set
against the scoring font's rules (`…/scoring-metrics-glyph-registration.html`):

| | scoring font | **text font** |
|---|---|---|
| the staff | 1 em tall; **1 space = 0.25 em** | **0.8 em** tall (≈ a capital); **1 space = 0.2 em** ⇒ every staff-scale glyph is **× 0.8** |
| key metrics | — | *"the ascender, caps height and descender must be very similar"* to a regular text font's |
| y = 0 | the staff position the glyph applies to (a notehead is CENTRED on the baseline) | the **bottom staff line**; movable glyphs (`combiningStaffPositions`: noteheads, notes, accidentals…) **centred on the MIDDLE line, y = 0.4 em** |
| clefs | pitch line on the baseline | aligned to the `staff5Lines` glyph: G +0.2 em, F +0.6 em, C +0.4 em |
| staff / leger lines, time-signature digits | normal advance | **advance width 0** (so things stack on them; digits stack via the `timeSigCombNumerator/Denominator` ligatures) |
| moving a glyph to another staff position | the host does it | **OpenType ligatures** with the control characters U+EB90–EB9F |
| dynamics letters, octave numerals | caps ≈ 0.5 em, x-height ≈ 0.25 em | **x-height ≈ 0.5 em**, *"consistent with other typical text fonts"* |
| ornaments · pedal marks · figured-bass digits | staff scale | ≈ 0.5 em (**150 %**) · ≈ 0.75 em (**130 %**) · ≈ 0.5 em (**185 %**) |
| metronome-mark notes (U+ECA0…) | — | ***"positioned such that they sit on the font baseline"*** |

⭐ Steinberg's own note on Bravura Text says the same in user's words
(`MuseScore/fonts/bravura/bravura-text.md`, v1.1, 2015-10-30): *"scaled such that the height of a
five-line staff … is approximately the same as the height of an upper case letter in a regular text
font at the same point size. It is designed to be used both in-line, i.e. in the middle of a run of
text **at the same point size**, and on its own"*; dynamics letters *"approximately the same size as a
lower case letter"*; `Space` = ½ space, `-` = 1 space, `=` = 2 spaces.

⛔ The spec does **not** say a text font should carry letters, and does **not** list which ranges it
must carry.

---

## 2. ⭐⭐ THE MEASUREMENTS — Sebastian Text against Sebastian, and against the convention

**Method.** `opentype.js` on the OTF files: `glyph.getBoundingBox()` and `advanceWidth`, in **em/1000**
(all ten fonts are 1000 upm). For a pair *(music, text)*: **k** = text height ÷ music height;
**dy** = text box centre − k × music box centre, i.e. the baseline shift once scaled. Files:
`Sebastian.otf` / `SebastianText.otf` from upstream `fonts/` (both name-table "Version 1.350");
the other pairs from `~/dev/engine-sources/MuseScore/fonts/`. ⛔ Nothing here is quoted from a font's
documentation — Sebastian Text has none (§7).

### 2.1 The files

| | glyphs | PUA | hhea asc / desc / gap | OS/2 win asc / desc | GSUB features | GPOS |
|---|---|---|---|---|---|---|
| Sebastian 1.35 | 1330 | 1111 | 800 / −200 / 90 | 1514 / 1177 | `salt ss01 ss02 ss05 ss09` | `kern` |
| **Sebastian Text 1.35** | 1208 | **986** | **800 / −200 / 200** | 1000 / 300 | `aalt salt ss01 ss05` — ⛔ **no `liga`** | ⛔ none |
| Bravura 1.392 | 3693 | 3446 | 2012 / −2012 / 0 | 2012 / 2012 | `ccmp liga salt ss01–ss10` | `kern` |
| Bravura Text | 19183 | 4208 | **800 / −200 / 200** | 1130 / 330 | `ccmp liga salt ss01–ss10` (40 lookups) | `kern` |
| Leland Text | 182 | 124 | 800 / −200 / 90 | 800 / 381 | `calt liga ss01` | `kern` |
| Petaluma Text | 1524 | 1518 | 1000 / −200 / 0 | 1000 / 200 | none | none |
| Finale Maestro Text | 373 | 116 | 1270 / −530 / 45 | 1270 / 530 | none | `kern` |

⇒ Sebastian Text has **Bravura Text's line metrics to the unit** (800 / −200 / 200): at the words' point
size it asks for a text line, where Sebastian-the-music-font's `usWin` box (1514 + 1177) asks for 2.7 em.
⚠️ Oddly Sebastian itself also declares hhea 800/−200 (Bravura declares ±2012) — so the *hhea* line
is already text-like in both; the difference is in OS/2 `usWin*`, which is what clips on Windows.

### 2.2 Scale and baseline, glyph by glyph (em/1000)

| glyph | Sebastian yMin…yMax / adv | **Sebastian Text** yMin…yMax / adv | **k** | **dy** | Bravura Text k · dy |
|---|---|---|---|---|---|
| `staff5Lines` E014 | −16…1016 / 500 | −13…813 / **0** | 0.800 | 0 | 0.800 · 0 (−13…813 / 0 — identical box) |
| `gClef` E050 | −669…1159 / 654 | −281…929 / 428 | 🚨 **0.662** | 162 | 0.800 · 200 |
| `fClef` E062 | −614…253 / 686 | 109…802 / 545 | 0.799 | 600 | 0.800 · 600 |
| `cClef` E05C | −507…507 / 667 | −6…806 / 534 | 0.801 | 400 | 0.800 · 400 |
| `gClefChange` E07A | −422…773 / 433 | −208…748 / 352 | 0.800 | 130 | — |
| `timeSig4` E084 | −250…250 / 441 | **0…500 / 444** | 🚨 **1.000** | 250 | 0.800 · 0, **adv 0** |
| `noteheadBlack` E0A4 | −138…138 / 320 | 90…310 / 256 | 0.797 | 🚨 **200** | 0.800 · 400 |
| `noteheadHalf` · `Whole` | | 90…310 | 0.80 | 🚨 200 | 0.800 · 400 |
| `noteheadXBlack` E0A9 | −125…125 | 299…511 | 0.848 | 405 | — |
| `noteQuarterUp` E1D5 | −141…850 / 326 | **7…800** / 261 | 0.800 | 120 | 0.800 · 400 (287…1100) |
| `note8thUp` E1D7 | −141…850 / 326 | 7…800 / **460** | 0.800 | 120 | — |
| `augmentationDot` E1E7 | −61…61 / 124 | 351…449 / 99 | 0.803 | 400 | 0.800 · 400 |
| `flag8thUp` E240 | −818…0 | −254…400 | 0.800 | 400 | 0.799 · 400 |
| `accidentalFlat` E260 | −163…455 / 217 | 70…564 / 174 | 0.799 | 🚨 200 | 0.800 · 400 |
| `accidentalNatural` · `Sharp` | −340…340 | −72…472 | 0.800 | 🚨 200 | 0.80 · 400 |
| `restQuarter` E4E5 | −356…374 | 114…699 | 0.801 | 399 | 0.799 · 400 |
| `articAccentAbove` E4A0 | 0…220 / 401 | 400…600 / 258 | ⚠️ 0.91 × 0.64 (redrawn) | 400 | 0.799 · 400 |
| `fermataAbove` E4C0 | −51…318 | 359…654 | 0.799 | 400 | 0.798 · 400 |
| `dynamicPiano` E520 | −163…254 / 351 | −269…419 / 622 | **1.650** | 0 | **1.649** · 0 |
| `dynamicMezzo` E521 | −10…246 / 428 | −16…406 / 733 | 1.648 | 0 | 1.651 · 0 |
| `dynamicForte` E522 | −172…400 / 404 | −284…660 / 610 | 1.650 | 0 | 1.651 · 0 |
| `dynamicMF` E52D | −172…400 / 795 | −284…660 / 1284 | 1.650 | 0 | 1.649 · 0 |
| `tuplet3` E883 | −4…379 | −3…303 | 0.799 | 0 | — |
| **`metNoteQuarterUp` ECA5** | **7…690 / 261** | **7…690 / 261** | ⭐ **1.000** | **0** | 0.800 · 120 (−141…688 → 7…670) |
| `metNoteHalfUp` · `8thUp` · `Whole` · `metAugmentationDot` | 7…690 · 7…700 · 7…233 · 80…166 | the same boxes | 1.000 | 0 | 0.80 · 120 |
| `metNoteQuarterDown` ECA6 | −723…−10 (hangs) | 13…726 (sits) | 1.000 | 736 | — |
| `metNote16thDown` ECAA | ⛔ absent | −50…740 | — | — | — |

By SMuFL range, over **every** glyph both fonts carry (script `m3.mjs`, same method): staff-scale
ranges are **0.80** throughout (accidentals of every system, rests, flags, holds, tremolos, tuplets,
fingering, string/wind/brass/vocal/guitar/plucked techniques, brackets, arrows, lyrics, bar repeats);
`dynamics` + `octaves` **1.65**; `commonOrnaments`, `precomposedTrillsAndMordents` **1.45**;
`figuredBass` 1.72–2.29; `standardAccidentalsChordSymbols` and `metronomeMarks` and
`beatersPictograms` **1.00**; all 21 `staves` glyphs have advance **0**.

### 2.3 What that says

1. ⭐ **The scale convention IS Bravura Text's**: 0.80 for the staff world, 1.65 for dynamics, and the
   identical `staff5Lines` box and line metrics. Where the spec gives a number (ornaments 150 %) it is
   close (1.45); figured bass 185 % → 1.72–2.29.
2. 🚨 **The REGISTRATION is not uniform, and differs from the spec in four places:**
   - **noteheads and ALL accidentals are centred on y = 200 — the SECOND line — not the middle line
     (400)** the spec and Bravura Text use; rests, flags, dots, articulations and holds ARE at 400.
     ⇒ on Sebastian Text's own `staff5Lines`, a notehead and its augmentation dot do not share a line.
   - **`gClef` (and its 8/15 variants) is 0.66 ×, not 0.80 ×**, shifted 162 not 200 — it does not fit
     its own 0.8 em staff; F and C clefs do.
   - **time-signature digits are 1.0 ×, sit ON the baseline (0…500) and have real advances** — inline
     numerals, ⛔ not the zero-width stackable digits of the spec.
   - **precomposed notes (`noteQuarterUp`…) sit on the BASELINE** (7…800) where Bravura Text floats them
     on the middle line (287…1100); the up-flagged ones carry the flag in the advance (460 vs 261).
3. ⛔ **No ligatures at all**: neither font has U+EB90–EB9F (the staff-position controls), U+E09E/E09F
   (numerator/denominator) or a `liga` feature. ⇒ Sebastian Text **cannot** build music on a text
   line the way `bravura-text.md` describes. Its GSUB is single/alternate substitution only
   (`salt`/`ss01`/`ss05`/`aalt`, 10 lookups of type 1 or 3).
4. ⭐⭐ **The metronome range is the same drawing in both fonts** — of the 12 glyphs both carry, 7 are
   identical point for point and in advance (`metNoteQuarterUp`, `8thUp`, `16thUp`, `Whole`, both
   double wholes, the dot); `HalfUp` and `32ndUp` have the same box and one path command more; the
   three down-stem forms are re-registered (script `m8.mjs`). Sebastian-the-music-font already
   ships its `metNote*` glyphs at text scale and ON the baseline (7…690), which is what the spec asks
   of a *text* font; Sebastian Text adds only the down-stem forms turned to sit instead of hang, and
   `metNote16thDown`. Bravura does it the other way: its music-font ♩ is centred on the baseline
   (−141…688) and only Bravura Text's sits (7…670).

### 2.4 🚨 Its "Latin" is Finale's legacy symbol layout — NOT letters

Sebastian Text maps **243** non-PUA code points: ASCII 92/94 (`D`, `G` absent; `g` is EMPTY), all of
Latin-1, a few Greek, and U+266D–266F. Every one measured has a **24-unit left and right side
bearing** (PUA glyphs have 0), and **92 of 219** are point-for-point translated copies of the font's
own SMuFL glyphs (script `m5.mjs`, matching contour points relative to the box):

| typed | draws | typed | draws |
|---|---|---|---|
| `q` `h` `e` `x` `w` | `noteQuarterUp` · `noteHalfUp` · `note8thUp` · `note16thUp` · `noteWhole` | `Q` `H` `E` `X` | the same, stem down |
| `#` `b` `I` | `accidentalSharp` · `accidentalFlat` · sharp | `0`–`9` | **`timeSig0`–`timeSig9`** |
| `&` `B` | the G clef · the C clef (U+F472/F473 copies) | `U` `u` | `fermataAbove` · `fermataBelow` |
| `>` `^` `-` | `articAccentAbove` · `articMarcatoAbove` · `articTenutoAbove` | `!` `@` | `tremolo1` · `tremolo2` |
| `%` `~` `/` `d` | `segno` · a trill wiggle · `barlineDouble` · `barlineReverseFinal` | `(` `)` | accidental parentheses |
| `f` `p` | unmatched point-for-point, but their boxes are **0.87 ×** Sebastian's `dynamicForte` / `dynamicPiano` (`f` 419 × 498 against 482 × 572; `p` 400 × 363 against 461 × 417) — ⚠️ neither the staff-scale nor the 1.65 × letter | | |

The upstream README states the intent: *"The font also contains a set of glyphs in the 'old' 8-bit
character positions, for compatibility with old versions of Finale and other apps."* Sebastian.otf
carries the same 92 slots at staff scale (`q` = −141…850).

Against the other Text companions (ASCII slots present, of 94):

| Bravura | **Bravura Text** | **Leland Text** | Petaluma Text | **Sebastian Text** | Finale Maestro Text | Petaluma Script | Academico |
|---|---|---|---|---|---|---|---|
| 0 | **2** (`-` `=` — the spacers) | **0** | 0 | 🚨 **92 — symbols** | **94 — real Times-like letters** (cap 662, x 447) | 90 — real letters | 94 |

⇒ ⭐⭐ **Three different animals share the suffix "Text"**: a pure symbol font (Bravura/Leland/Petaluma
Text — safe anywhere in a CSS stack, because it has no letters to steal); a symbol font **with a
legacy keyboard layout** (Sebastian Text — 🚨 unsafe ahead of a words face); and a words font with
some symbols (Finale Maestro Text — 116 PUA glyphs, its clefs 0.95 ×, its accidentals 1.1–1.4 ×, its
`met*` 0.89–1.07 ×: no single convention). ⛔ "Has a Text companion" is therefore not one capability.

---

## 3. How the engines use such a font

### 3.1 MuseScore (`src/engraving/`, `929d1e9`)

| what | where |
|---|---|
| A style setting of its own, **`musicalTextFont`**, default `"Leland Text"` — beside `musicalSymbolFont` (`Leland`) and the words faces (Edwin) | `style/styledef.cpp:635–636` |
| ⚠️ The pairing is **not read from metadata**: loading a music font's defaults inserts `"<family> Text"` | `internal/engravingfont.cpp:841`; the style dialog builds its list the same way — *"musicalTextFont must be a font family name!"* `fontFamilyName + " Text"` — `notationscene/widgets/editstyle.cpp:804–811` |
| A symbol inside text is a `<sym>name</sym>` tag, stored as a fragment whose family is the placeholder **`"ScoreText"`** | `dom/textbase.cpp:1504`, `:882` |
| **Which font a `ScoreText` fragment gets** — two classes of element. `hasSymbolScale()` (dynamics, ottava/tuplet/pedal text, playing-technique annotations, harp diagrams): the **MUSIC font** at the staff's SMuFL size × a per-style scale (1.0). Everything else (`hasSymbolSize()` — tempo, staff/system text, expression, lyrics, titles…): **`musicalTextFont`** at the style's **`…MusicalSymbolSize`** | `dom/textbase.cpp:883–908`, `:3403–3413`; `style/styledef.h:2315–2321` |
| **The size is its own number per text style, NOT the words' size**: tempo words 12 pt, tempo symbols **20 pt** (1.67 ×); metronome 12; dynamics/expression/default 10 (= their words); fingering/articulation 8 | `style/styledef.cpp:1210`, `:2156`, `:2099–2132` |
| Line spacing ignores the symbol font's metrics: *"SEMI-HACK: Music fonts can have huge linespacing because of tall symbols, so instead of using the font linespacing value we just use the height of the individual fragment"* × 1.25 | `rendering/score/textlayout.cpp:389–393` |
| Text-cursor height and empty-fragment metrics: a music-font fragment is swapped for its `" Text"` twin at the words' size | `textlayout.cpp:405–413`, `dom/textbase.cpp:284–287` |
| One hand-tuned baseline: a coda/segno in a Marker is centred on half the neighbour's cap height | `textlayout.cpp:416–438` |
| **Chord symbols**: the accidentals and other symbols are drawn in `musicalTextFont` | `rendering/score/harmonylayout.cpp:676–677`; `dom/chordlist.cpp:2318`; `editing/editstyle.cpp:46` |
| **Fallback**: per FRAGMENT — if any character is missing, the whole fragment's family becomes **`Bravura Text`** (or `Bravura` for the music class) | `dom/textbase.cpp:64–65`, `:950–990`; registered `engravingmodule.cpp:217–218` |
| MusicXML export writes symbols with the `musicalTextFont` family | `importexport/musicxml/internal/export/exportmusicxml.cpp:1464` |

⚠️ Why MuseScore needs 20 pt against 12: **Leland Text's `metNote*` are 0.60 × Leland's** (−57…565 —
§2's method), smaller than Bravura Text's 0.80 × — at the words' size its ♩ reaches 0.77 of a capital.
The Text convention does not free a host from a size row; it depends on the font.

### 3.2 Verovio (`efff0bc`) — no Text companion at all

A SMuFL glyph inside text is set in **the music font itself** (`GetCurrentFont()`, Leipzig by
default), explicitly `font-style: normal`, at **the words' size × `GetMusicToLyricFontSizeRatio()`** =
`m_drawingSmuflFontSize ÷ m_drawingLyricFontSize`, i.e. brought back to staff scale
(`src/view_text.cpp:616–620`, also `:125`, `:193`, `:284`, `:403`; `src/doc.cpp:2142–2145`). The font
reaches the SVG as an embedded/linked woff2 (`smuflTextFont` option: `embedded` | `linked` | `none` —
`src/options.cpp:1156–1158`, `src/svgdevicecontext.cpp:128–146`, `:187–198`); a glyph the face lacks
switches the `<tspan>` to the fallback face, Leipzig (`svgdevicecontext.cpp:1125–1133`). ⚠️ Its
"text font" (`data/text/Times*.xml`, Liberation) is the WORDS' metrics table, unrelated.

### 3.3 LilyPond — not a font question

A metronome mark's note is a **markup drawn from Emmentaler's staff glyphs** —
`make-smaller-markup (make-note-by-number-markup …)` (`scm/translation-functions.scm:118–124`;
`note-by-number`, `scm/define-markup-commands.scm:5534`): notehead glyph + a drawn stem, one size step
smaller. There is no text-scaled companion face.

### 3.4 Dorico — documented only in part

- The Music Fonts dialog changes *"notations, glyphs, and other items that are not text, such as clefs,
  dynamics, and bold tuplet numbers/ratios"*, with an option *"Update text fonts when changing music
  fonts"* (Bravura → Academico, Petaluma → Petaluma Script) — Dorico Pro 3 manual,
  <https://archive.steinberg.help/dorico_pro/v3/en/dorico/topics/engrave_mode/engrave_mode_music_fonts_dialog_r.html>.
- A font STYLE **"Default Music Text Font"** exists, *"normally … set to 'Bravura Text' instead of
  'Academico'"* (forum user), and Daniel Spreadbury (Steinberg): *"because the Default Music Text Font
  font style has an overridden font family and style by default, changing the font family used for
  Default Text Font won't also update the font for Default Music Text Font"* —
  <https://forums.steinberg.net/t/changing-default-text-font-overrides-default-music-text-font/877243>.
  ⚠️ *Reported by* a forum thread; the manual page defining that style was not found (§7).
- `score-text-fonts-research.md` §2 already records *"Chord Symbols Music Text Font"*, which *must be
  SMuFL*.

⇒ ⭐ **Both commercial-grade engines that use a Text font make it a THIRD, independent setting** —
music font · words font · music-text font — and both leave **dynamics in the music font**.

---

## 4. What OUR engine does today where a symbol sits inside words

| site | today | source |
|---|---|---|
| **tempo mark's note** (`♩ = 120`) | the string is split into runs; a note run is stamped from the **music font** as SMuFL **`metNote*`** (U+ECA2–ECAB, dot U+ECB7) at **`TEMPO_GLYPH_FONT_SIZE` = 20 pt**, words at `TEMPO_TEXT_FONT_SIZE` = 18 pt bold; both at the SAME `y` | `src/engine/rendering/marks/tempo/TempoLayout.ts:131–140`; `tempoStyle.ts:41`, `:65`, `:77–85`; `src/utils/tempoText.ts:44–54` |
| its ink | `TEMPO_INK_ABOVE` = 0.75 × the glyph size, "first cut BY EYE" | `tempoStyle.ts:101` |
| **dynamics letters inside expression text** (`mp dolce`) | one `<text>` at `DYNAMIC_TEXT_SIZE` 16 pt, re-laid as `<tspan>`s: a glyph run in `musicOnlyStack()` at **16 × (30/16) = 30 pt** (staff scale, `font-style: normal`), words in the italic face | `marks/dynamics/DynamicsLayout.ts:252–286`; `dynamicStyle.ts:15`, `:39`, `:62–76` |
| the dynamics editor's chip | the same ratio as `font-size: 1.875em; line-height: 0` | `src/interactions/text/DynamicTextSource.ts:35`, `:51`, `:264–268` |
| the tempo editor | reads the engraved `<text>`'s computed font back off the DOM; fallback `Bravura,Academico` bold | `src/interactions/text/TempoTextSource.ts:16–21`, `:141–163` |
| PDF export | per CHARACTER, walks the computed `font-family` list and takes the first face we have a file for that **has the glyph** (`charToGlyphIndex > 0`) | `src/engine/export/outlineText.ts:168`, `:193–207` |

Measured, what each site would draw (em fractions of §2 × the point size; caps = AcademicoBold `H`
0.730 em × 18 pt = **13.14 pt**):

| the tempo ♩ | bottom | top | top ÷ caps |
|---|---|---|---|
| **today, Bravura @ 20 pt** | 🚨 **−2.82 pt** (hangs 0.28 sp under the words' baseline) | 13.76 | 1.05 |
| **today, Sebastian @ 20 pt** | +0.14 (sits) | 13.80 | 1.05 |
| Bravura Text @ 18 pt (the words' size) | +0.13 | 12.06 | 0.92 |
| Bravura Text @ 20 pt | +0.14 | 13.40 | 1.02 |
| Sebastian Text @ 18 pt | +0.13 | 12.42 | 0.95 |
| Leland Text @ 18 pt | −1.03 | 10.17 | 0.77 |

| `dynamicMezzo`'s height | pt | against an italic x-height @ 16 pt (Edwin Italic 0.470 em = 7.52 pt) |
|---|---|---|
| today, Bravura @ 30 pt | 8.52 | 1.13 × |
| today, Sebastian @ 30 pt | 7.68 | 1.02 × |
| Bravura Text @ 16 pt | **7.50** | **1.00 ×** — the spec's *"x-height around 0.5 em"* doing its job |
| Sebastian Text @ 16 pt | 6.75 | 0.90 × |

What a Text font would and would not replace:

1. **The tempo ♩.** A Text font at the words' size makes `TEMPO_GLYPH_FONT_SIZE` (20 against 18 — a
   1.11 ratio tuned by eye) unnecessary *for Bravura Text and Sebastian Text* (0.92–0.95 of the caps at
   1 : 1), and fixes a thing nobody tuned: 🚨 **Bravura's music-font ♩ is centred ON the baseline, so
   today it hangs 2.8 pt below the words**, while Sebastian's sits on them — the two faces already
   disagree by 0.28 sp at the same `y`. ⛔ Not so for every face: Leland Text needs MuseScore's 1.67 ×.
   ⭐ For **Sebastian specifically it replaces nothing**: same outlines (§2.3 #4).
2. **Dynamics inside expression text.** The 30/16 ratio is what makes `mp` in `mp dolce` equal a
   standalone `mp` — a deliberate rule (`dynamicStyle.ts:33–37`: ⛔ *"do not 'fix' that ratio into a
   constant"*). A Text font at the words' size gives the OTHER rule — the letters matched to the
   words' x-height, 12 % smaller than the staff-scale mark (16 × 1.65 = 26.4 against 30). ⚠️ That is a
   change of RULE, not a tidy-up, and neither MuseScore nor Dorico makes it (§3): both keep dynamics in
   the music font.
3. **Not replaced:** `TEMPO_INK_ABOVE/BELOW` and the dynamics ink fractions (they are ink extents, and
   would simply become other numbers); the run-splitting itself (a Text font with no letters still
   needs the words in another face — per run, or per character through a stack).
4. **Not yet existing here, and where a Text font is the designed tool:** chord-symbol accidentals
   (`standardAccidentalsChordSymbols`, U+ED60… — 1.00 × in Sebastian Text), a metric-modulation
   equation, symbols typed into staff/expression text (segno, pedal, fingering, figured bass), and —
   ⛔ not with Sebastian Text, which has no ligatures — a music example on a text line.

---

## 5. Licence

| | |
|---|---|
| Sebastian Text 1.35 | name table: *"Copyright (c) 2021, Florian Kretlow, and Ben Byram-Wigfield with **Reserved Font Name "Sebastian"**"*, SIL OFL 1.1 (full text in the `license` record); upstream `fonts/OFL.txt`. Same terms as `Sebastian.otf`, which we ship |
| what the RFN means | unmodified redistribution and PDF embedding/outlining are permitted; a MODIFIED file (subsetting to drop the ASCII layout — one way to make §6 option C safe — is a modification — OFL "Modified Version … by adding to, deleting") may not be named "Sebastian…". ⚠️ Converting to woff2 is widely treated as not a modification but the OFL-FAQ wording was not re-read today (§7) |
| Bravura Text · Leland Text · Petaluma Text · Finale Maestro Text | all OFL 1.1 — `score-text-fonts-research.md` §4 |
| obligation | the copyright notice + licence travel with the file, as `public/fonts/Sebastian-OFL.txt` does for Sebastian |

---

## 6. Ways to adopt it — listed, NOT ranked

| | the option | what it is | its risk |
|---|---|---|---|
| **A** | **A third choice** — `musicTextFont`, beside `fonts/musicFont` and `fonts/textFont` | what MuseScore and Dorico do (§3). Independent rows: `none (use the music face)` · Bravura Text · Sebastian Text · Leland Text… | a third picker and a third generation in the width/layout keys; ⚠️ most combinations are untested by anyone's eye; ⛔ must not be derived from the music face (plan rule 2) — though "X ⇒ X Text" is the only pairing convention that exists |
| **B** | **Where it applies — per RUN, by code point** | the tempo/dynamics layouts already split runs; a PUA run asks the music-text face instead of `musicOnlyStack()` | the choice of SIZE stays a row per site (§3.1: MuseScore's 20 vs 12), so the hand-tuned ratio becomes *per Text font* rather than disappearing — 1.0 for Bravura/Sebastian Text, ≈ 1.67 for Leland Text |
| **C** | **Where it applies — through the CSS stack** | put the Text face in the words' stack and let per-character font matching find it | 🚨 **Sebastian Text must come AFTER the words face** (§2.4) or every letter and digit becomes a symbol — and then a digit or `=` is NEVER taken from it (fine), but also U+266D–266F would come from whichever face is first. Safe first only for Bravura/Leland/Petaluma Text. ⚠️ A stack cannot change SIZE per character, so C only works at 1 : 1 |
| **D** | **Fallback when a face has no Text companion** (Leipzig has none on disk; Verovio ships none) | (i) the music face itself at a per-site ratio — today's behaviour, Verovio's rule; (ii) Bravura Text — MuseScore's rule, per fragment | (i) keeps two code paths and the tuned ratios forever; (ii) mixes faces inside one mark — the FAMILY problem of `music-font-switch-plan.md` rule 4 (one borrowed `m` beside the face's `f`); MuseScore avoids the mix only by switching the WHOLE fragment |
| **E** | **Do nothing for Sebastian now** | its `metNote*` are already text-cut in the music font; nothing we draw today differs | the Bravura ♩'s 2.8 pt hang (§4) stays as it is; the day chord symbols or typed symbols arrive the question returns |
| **F** | **PDF export** | `outlineText` needs only a `FONT_FILES` row (`role` — a new value or `'music'`) so `loadAllExportFonts` has the file; the per-character stack walk with its coverage check already handles a third face | with option C and a wrong stack order the PDF would faithfully outline the wrong glyphs — it copies the screen; ⚠️ `pdfBaseFont`'s "no file for this stack" path keeps such a run as TEXT in a standard PDF face, where a PUA character is a blank |
| **G** | **Metrics** | a Text face has NO metadata JSON (none upstream for Sebastian Text; Bravura Text ships none in MuseScore's tree; only `Finale Maestro Text.json` exists) ⇒ boxes can only be measured from the OTF, which `scripts/generate-font-metrics.mjs` already does | ink extents of text marks are fractions tuned by eye today (`TEMPO_INK_ABOVE`), so nothing consumes such a table yet |

⚠️ Two facts that cut across every row: (1) **dynamics stay in the music font in both engines that
have a music-text setting** — adopting a Text font does not imply moving them; (2) Sebastian Text's
four registration departures (§2.3 #2) only matter to someone composing notation ON a text line —
⛔ irrelevant to a ♩, a ♭ or an *mf* inside words.

---

## 7. ⛔ UNKNOWN — searched or not established

| | |
|---|---|
| **Any documentation of Sebastian Text by its authors** | the upstream README (fetched raw, 1 589 bytes) never mentions the Text font; no `SebastianText.json`, no usage note in `fonts/`. ⛔ Whether the y = 200 notehead/accidental registration and the 0.66 G clef are INTENDED is UNKNOWN — they are measured, not explained. The repo's issues/wiki were not read |
| **Which legacy layout the ASCII slots follow exactly** | the README says *"old versions of Finale"*; `q`/`h`/`e`/`w`/`&`/`#`/`b`/`U` agree with the Maestro/Sonata tradition, but no Maestro map was diffed against it. 127 of 219 Latin-1 slots were not matched to a SMuFL glyph by the script (they may be scaled or redrawn copies — e.g. the dynamics at `f`/`p`) |
| **Dorico's "Default Music Text Font"**: its default size relative to Default Text Font, and where Dorico applies it (tempo? chord symbols?) | one forum thread only; the manual page was not found. Dorico's tempo-mark note glyph source (music font vs Bravura Text) is UNKNOWN |
| **Whether MuseScore 4.6 reads a text pairing from metadata** | `smufl-fonts-research.md` §3 says it does; the checkout (`929d1e9`) only builds `"<family> Text"` (`engravingfont.cpp:841`). ⛔ Not reconciled — a press claim against source; the source is what was read |
| **How browsers clip or space a line with a 2012/−2012 music font in it vs an 800/−200 Text font** | the spec's reason for Text fonts is line spacing; our marks are single SVG `<text>` lines where line height does not act. Whether the DOM text editor overlay (`DomTextEdit`) is affected was NOT measured — it needs a browser |
| **Leipzig Text** | none in `verovio/fonts/Leipzig/`; whether `rism-digital/leipzig` has one was not checked |
| **Petaluma Text's registration** | measured k = 0.80, dy = 0 everywhere — i.e. scaled but NOT re-registered to a staff on the baseline, and its dynamics are 1.20 ×. Whether that is an old build in MuseScore's tree is UNKNOWN |
| **OFL-FAQ on format conversion (OTF → woff2) and on subsetting under an RFN** | not re-read today; check before shipping a converted or subset Sebastian Text |
| **The engraving books on the SIZE of a metronome note against its words** | not searched for this survey (`reference/README.md` was not consulted: the question here was the font's, not an engraving convention). Gerou & Lusk's *"slightly smaller than that of the tempo"* in `score-text-fonts-research.md` §3.1 is about the metronome mark's TYPE, not the note |

---

## 8. The one-line summary

⭐⭐ **A SMuFL "Text" font is the music font re-cut for the inside of a sentence — 0.8 × staff scale,
dynamics at 1.65 ×, text line metrics, metronome notes sitting on the baseline — to be set on the
PUA characters only, at the words' own size.** Sebastian Text follows that scale convention exactly
and the registration only loosely, has no ligatures, and hides Finale's legacy symbol layout under
its ASCII keys, so it may never lead a stack that carries words. And for the single inline glyph we
draw today, the tempo ♩, **Sebastian already carries the text-cut note in its music font** — the
face that would actually gain from a Text companion at that site is Bravura, whose ♩ hangs 2.8 pt
below the baseline it shares with the words.
