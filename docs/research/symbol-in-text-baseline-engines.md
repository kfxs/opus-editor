# A music SYMBOL inside a line of WORDS — where it stands and how big it is: the ENGINES and the FONTS

> ⭐⭐ **The question, his (2026-09-21):** *"the problem is that we have no research about this… one
> agent can check in verovio, musescore and lilypond to see how they manage."* — asked of the one
> place we set a symbol inside words today, the note of a metronome mark (`Allegro ♩ = 120`):
> **where does the symbol sit VERTICALLY against the words' baseline, and how big is it against the
> words?**
>
> ⛔ **This is a SURVEY, not a plan and not a decision.** It reads three engines' SOURCE, measures eight
> font files, and lists options **unranked** (§5). It chooses nothing.
>
> 📄 The engraving BOOKS' side of the same question is the sibling survey written in parallel,
> `symbol-in-text-baseline-books.md` (this folder, in progress) — ⛔ nothing here is a claim about what the books
> say. Read with `docs/research/music-text-fonts-research.md` (what a SMuFL "Text" font is, and
> MuseScore's / Verovio's FONT choice — its §3 is not repeated here, only extended to the vertical
> and the size) and `docs/research/score-text-roles-research.md` (the role table the sizes live in).
> `docs/research/tempo-marks-research.md` covers the mark's placement on the staff, not this.
>
> ⚠️ Everything below was read or measured on **2026-09-21**. §6 lists what was NOT established.

Sources: engine checkouts under `~/dev/engine-sources/` — MuseScore `929d1e9`, LilyPond `beedbfa`,
Verovio `efff0bc` (⚠️ all three are depth-1 clones: there is no `git log` to ask WHY a number is what
it is). Fonts: `~/dev/engine-sources/MuseScore/fonts/{bravura,leland,petaluma}/`, and ours in
`public/fonts/` (Leipzig, Sebastian, Academico, Edwin, Nepomuk). ⛔ No engine BINARY is installed
here — every engine number below is **derived from source + font measurement, not read off a
rendering**.

---

## 0. Questions

1. **MuseScore** — which font and size a tempo text's `<sym>metNoteQuarterUp</sym>` gets, whether the
   text layout shifts a symbol fragment vertically, and what happens when the font lacks the glyph.
2. **LilyPond** — how the metronome note is built, where its baseline is, how big it is against the words.
3. **Verovio** — how a SMuFL glyph inside `<tempo>` text is drawn: font, size, y.
4. **The fonts** — where `metNote…` sits against the baseline in each face, music cut against Text
   cut, and its height against a words face's capital at equal point size.
5. **Options** a house style could offer — unranked.

### The one-paragraph answer

⭐⭐ **No engine has a baseline rule for a symbol inside words except LilyPond — and LilyPond's rule
is exactly ours: the notehead's BOTTOM stands on the words' baseline**
(`make-general-align-markup Y DOWN`, `scm/translation-functions.scm:136`). MuseScore and Verovio put
the symbol's fragment on the SAME baseline as the words with **no shift at all** and let the FONT
decide: MuseScore's default face (Leland Text) hangs the head **57/1000 em** below the line — between
"centred" and "standing" — and Verovio's (Leipzig, the music font itself at staff scale) **centres the
head ON the words' baseline**, half of it below. On SIZE the three do not agree by a factor of two:
the note's top reaches **1.30 caps** in MuseScore, **≈ 1.65** in Verovio and **≈ 2.0** in LilyPond
(ours today: 1.26). In all three **the symbol's size is its own number, never the words' size**
(MuseScore `tempoMusicalSymbolSize` 20 pt beside 12 pt words; Verovio staff scale = 8 units beside
4.5; LilyPond staff scale one `\smaller` step = 0.891). The FONTS split three ways on registration:
head **centred** on the baseline (Bravura, Leland, Petaluma, Petaluma Text, Leipzig), head **standing**
on it (Bravura Text, Sebastian — what the SMuFL spec asks of a text font), and **Leland Text in
between**.

---

## 1. MuseScore (`929d1e9`)

| what | finding | where |
|---|---|---|
| the default mark | `<sym>metNoteQuarterUp</sym> = 80`; the dotted patterns are `<sym>metNoteQuarterUp</sym><sym>space</sym><sym>metAugmentationDot</sym>` — the dot is a SEPARATE symbol after a `space` symbol | `src/engraving/dom/tempotext.cpp:174–178`; `src/engraving/rw/read500/tread.cpp:710` |
| the fragment | a `<sym>` becomes a fragment whose family is the placeholder `"ScoreText"` | `src/engraving/dom/textbase.cpp:882` (and `:1504`, `:1754`) |
| **which font** | a tempo text is `hasSymbolSize()` (= not dynamics / ottava / tuplet / pedal / play-tech / harp diagram) ⇒ family = the style's **`musicalTextFont`** (default `"Leland Text"`), type `MusicSymbolText` | `textbase.cpp:900–907`, `:3403–3413`; `textbase.h:517`; `src/engraving/style/styledef.cpp:636` |
| **which size** | ⭐ the fragment's size is **NOT the words' size**: `m = getProperty(Pid::MUSIC_SYMBOL_SIZE)` (× the spatium scaling if the style is spatium-dependent, × `mag()`), which for a tempo resolves to **`tempoMusicalSymbolSize` = 20.0** against **`tempoFontSize` = 12.0** ⇒ **1.667 ×** | `textbase.cpp:903–907`; `styledef.cpp:1210`, `:2156`; `tempotext.cpp:72` resets the property to the style |
| …and only for `tempo` | the other tempo-ish rows are 1 : 1 — `tempoChangeMusicalSymbolSize` **12** (words 12), `metronomeMusicalSymbolSize` **12** (words 12); every other style's symbol size equals its words' size | `styledef.cpp:2155`, `:2130`, `:2099–2160` |
| the size is a STYLE number, not a font fact | loading a music font's defaults inserts only the FAMILY `"<family> Text"` — the 20 stays 20 whichever Text face is chosen | `src/engraving/internal/engravingfont.cpp:841` |
| **vertical: NONE** | ⭐ in `TextBlock` layout every fragment gets `f.pos.setY(0.0)` unless it is a sub/superscript; then `f.pos.ry() -= musicSymbolBaseLineAdjust(…)`, and that function **returns 0.0 unless the text is a MARKER** (coda / segno), where the symbol's ink middle is aligned to half the neighbour's cap height | `src/engraving/rendering/score/textlayout.cpp:353–374`, `:416–438` (the early return is `:422–425`) |
| the draw | `painter->drawText(textFragment.pos, textFragment.text)` with the fragment's own font — words and symbol share one baseline | `src/engraving/rendering/score/tdraw.cpp:1793–1797` |
| line spacing | a music(-text) fragment contributes `1.25 × its ink height above the baseline`, not its font's line spacing (*"SEMI-HACK"*) | `textlayout.cpp:388–393` |
| **missing glyph** | per FRAGMENT: if any character of the fragment is not in the chosen face but is in the fallback, the whole fragment's family becomes **`Bravura Text`** (`Bravura` for the music-font class). ⚠️ The SIZE is not re-chosen — a Bravura Text fragment is still 20 pt | `textbase.cpp:64–65`, `:910–914`, `:949–990` |

⇒ ⭐ **MuseScore has no baseline rule for a tempo's note. Where the head stands is whatever the Text
face's designer cut** — and its two faces disagree (§4): Leland Text's head hangs 57/1000 below the
line, Bravura Text's stands 7/1000 above it.

What that draws, by default (Leland Text 20 pt beside Edwin Bold 12 pt; method §4; all in **1/1000 of
the WORDS' em**, y up from the words' baseline):

| | head bottom | head centre | note top | top ÷ caps (Edwin Bold `H` = 722) | head height ÷ x-height (473) |
|---|---|---|---|---|---|
| **default — Leland Text @ 20/12** | **−95** | +78 | 942 | **1.30** | 0.73 |
| Bravura Text @ 20/12 (the fallback, or a Bravura score) | +12 | +200 | 1117 | 1.55 | 0.80 |
| `metronome` / `tempoChange` style — Leland Text @ 12/12 | −57 | +47 | 565 | 0.78 | 0.44 |

⚠️ **WHY 20** is not in the source: no comment at `styledef.cpp:2156`, and the clone has no history.
What the measurement shows is the likely reason — Leland Text's `metNote…` are cut SMALL (0.60 × Leland's;
top at 0.78 of a capital at the words' size), so 1 : 1 gives a note visibly shorter than the capitals,
and 1.667 × brings it to 1.30 caps. ⛔ That is an inference from numbers, not a stated intent (§6).

---

## 2. LilyPond (`beedbfa`)

| what | finding | where |
|---|---|---|
| **built, not a glyph** — confirmed | `\note-by-number` takes the NOTEHEAD glyph from the music font (`font-encoding . fetaMusic`, `noteheads.u2`/`s2`…), draws the STEM as a `ly:round-filled-box`, adds a FLAG glyph (or a drawn straight flag) and DOT glyphs (`dots.dot`). There is no precomposed metronome note | `scm/define-markup-commands.scm:5534`, font `:5658–5660`, head `:5684–5698`, stem `:5730–5744`, dots `:5745–5752`, flag `:5766–5795` |
| raw registration | the head glyph is centred on y = 0 (its char box is `±noteheight/2`), so a bare `\note` has its head **CENTRED on the markup baseline**; the stem runs from the head's attachment to `dir × stem-length` measured from that centre | `mf/feta-params.mf:296`; `define-markup-commands.scm:5712–5716`, `:5742–5743` |
| stem length | `size-factor × (text-font-size ratio) × max(3, log − 1)` **staff spaces** — **3 sp** for everything down to the 16th, longer for shorter notes; thickness 0.13 sp | `define-markup-commands.scm:5704–5711` |
| **the metronome mark's size** | the note is wrapped in **`make-smaller-markup`** = `\fontsize #-1` ⇒ `magstep(−1)` = 2^(−1/6) = **0.891 × staff scale**. The words are `make-bold-markup`, at the grob's `font-size` 0 = `text-font-size` 11 pt @ 20 pt staff | `scm/translation-functions.scm:118–124`, `:140`; `define-markup-commands.scm:3636–3656`, `:3796–3803`; `scm/lily-library.scm:1718–1719`; `scm/paper.scm:78` |
| ⭐⭐ **the vertical rule** | `(make-general-align-markup Y DOWN note-mark)` — `general-align` is `ly:stencil-aligned-to m axis dir`: the note's stencil is moved so that its **BOTTOM edge is at y = 0**, i.e. **the notehead's bottom stands on the words' baseline**. The dot rides with it (it is part of the stencil, at the head's centre height — `dots-direction` 0) | `translation-functions.scm:134–138`; `define-markup-commands.scm:2880–2914`; dots `:5811–5821` |
| the grob | `MetronomeMark` declares no font property at all — size and boldness come from the markup above | `scm/define-grobs.scm:2336–2366` |

What that draws (derived: `noteheight = staff_space + (1 + overdone_heads) × stafflinethickness` with
`overdone_heads = −0.1` and a 0.5 pt line at the 20 pt design ⇒ **1.09 sp** — `mf/feta-params.mf:41`,
`:253–254`; × 0.891 = 0.971 sp head; stem top 2.673 sp above the head's centre; words em = 11 pt =
2.2 sp). In 1/1000 of the WORDS' em:

| | head bottom | head centre | note top | note height |
|---|---|---|---|---|
| **LilyPond `\tempo 4 = 120`** | **0** | +221 | **1436** | 1436 = **3.16 sp** = 15.8 pt beside 11 pt words |

⚠️ top ÷ caps needs the text face's cap height. LilyPond's default roman is C059 (→ Century
Schoolbook L → TeX Gyre Schola — `score-text-fonts-research.md` §2, `mf/00-lilypond-fonts.conf:11-22`),
which is not on disk; **Edwin is derived from C059** (same survey, §4) and measures `H` = 722, as does
Academico ⇒ the note reaches **≈ 1.99 caps**. ⛔ A proxy through a derived face, not a measurement of
C059 itself (§6).

⇒ ⭐ **LilyPond is the only one of the three with an explicit rule, and it is "bottom of the note on
the baseline".** It is also by far the TALLEST note: a staff-scale note one step down, not a
text-scaled one.

---

## 3. Verovio (`efff0bc`)

| what | finding | where |
|---|---|---|
| what the glyph IS | MusicXML import writes the beat unit as `<rend glyph.auth="smufl">` holding the **`metNote…` code points** (U+ECA0, ECA2, ECA3, **ECA5**, ECA7, ECA9…), and each dot as `" "` + U+ECB7 inside the same `<rend>`; a `<symbol>` child gets `glyph.auth="smufl"` too | `src/iomusxml.cpp:828–852`, `:4732–4742`, `:711–716` |
| the words' size | a `<tempo>` is set in the text font (`GetTextFont()`) at the **LYRIC font size** — `m_drawingLyricFontSize = unit × lyricSize`, default `lyricSize` **4.5** MEI units = **2.25 sp** | `src/view_control.cpp:2751–2781`; `src/doc.cpp:2130–2134`, `:2400`; `src/options.cpp:1403–1404` |
| **the symbol's font and size** | `<rend glyph.auth="smufl">` and `<symbol glyph.auth="smufl">`: face = **the MUSIC font itself** (`GetCurrentFont()` — Leipzig by default; there is no Text companion), `font-style: normal`, size = the words' size **× `GetMusicToLyricFontSizeRatio()`** = `m_drawingSmuflFontSize ÷ m_drawingLyricFontSize` = `(unit × 8) ÷ (unit × 4.5)` = **1.778** — i.e. the glyph is brought back to **STAFF SCALE** (em = 4 sp) whatever the words' size. ⚠️ A `@fontsize` on the `<rend>`/`<symbol>` is applied FIRST and then multiplied by the same ratio | `src/view_text.cpp:397–404` (rend), `:590–621` (symbol); `src/doc.cpp:2142–2145`, `:2399–2400`, `:2418–2421` |
| **vertical: NONE** | the symbol is drawn by the same `DrawTextString` at the running text position; `m_verticalShift` is set only by `rend@rend="sup"/"sub"`. The one y-adjustment in `DrawTempo` (− x-height/2) applies to the WHOLE mark, only for `@place="between"` | `view_text.cpp:428–449`, `:488–491`, `:622–624`; `view_control.cpp:2783–2788` |
| missing glyph | `<symbol>`: `IsSmuflFallbackNeeded` ⇒ the fallback face (Leipzig/Bravura) for that tspan; `<rend>`: *"fallback will not work for missing glyphs within `<rend>`"* | `view_text.cpp:616–617`, `:398–400` |

What that draws (Leipzig, §4, × 1.778; in 1/1000 of the WORDS' em):

| | head bottom | head centre | note top | note height |
|---|---|---|---|---|
| **Verovio, Leipzig @ 8/4.5** | **−224** | **0** | 1188 | 1412 = 3.18 sp |

With the Academico proxy for caps (Verovio's default text face is a Times metric table —
`music-text-fonts-research.md` §3.2; its cap height was not measured here): top **≈ 1.65 caps**.

⇒ ⭐ **Verovio centres the notehead ON the words' baseline — half a staff space of head hangs below
the line** — because it does nothing: a staff-registered glyph at staff scale, dropped on a text
baseline. It is what our tempo mark did before 2026-09-21.

---

## 4. ⭐⭐ THE FONTS — where `metNote…` sits, measured

**Method.** `opentype.js` on each file; `glyph.getBoundingBox()` for yMin / yMax / advance, in **1/1000
em** (all files are 1000 upm except Nepomuk, 1024, normalised). **Head top** of an up-stem note: the
outline is flattened (60 steps per curve, 1 unit per line step); the stem's left edge is the minimum x
in a band at 60 % of the glyph's height; the head's top is the highest point whose x is more than 4
units LEFT of that edge. **Head centre** = (yMin + head top) ÷ 2. Check: it returns 0 ± 1 for Bravura's,
Leland's and Leipzig's staff-registered `noteQuarterUp`, and 400 for Bravura Text's (the spec's middle
line). Words faces: the box of `H`, `x`, `1`. Script (throwaway):
`<scratchpad>/symtext/measure.mjs`. ⚠️ `Leipzig.otf` in `public/fonts/` and Verovio's own
`fonts/Leipzig/Leipzig.ttf` measured identical on every row.

### 4.1 `metNoteQuarterUp` (U+ECA5), y up from the font's baseline

| face | head bottom | head centre | head top | stem top | height | adv | registration |
|---|---|---|---|---|---|---|---|
| **Bravura** 1.392 | **−141** | 0 | 141 | 688 (= **2.75 sp**) | 829 | 332 | CENTRED on the baseline |
| **Bravura Text** | **+7** | 120 | 233 | 670 | 663 | 266 | STANDS on it (0.80 × Bravura, dy 120) |
| **Leland** 0.80 | **−172** | +1 | 173 | 863 (3.45 sp) | 1035 | 425 | centred |
| **Leland Text** | 🚨 **−57** | +47 | 150 | 565 | 622 | 256 | **neither** — the head hangs 28 % of its height below the line (0.60 × Leland) |
| **Petaluma** 1.065 | −148 | +1 | 149 | 553 (2.21 sp) | 701 | 310 | centred |
| **Petaluma Text** | −118 | +1 | 119 | 442 | 560 | 248 | **centred** (0.80 ×, not re-registered) |
| **Leipzig** | **−126** | 0 | 126 | 668 (2.67 sp) | 794 | 302 | centred — and has no Text companion |
| **Sebastian** 1.35 | **+7** | 120 | 233 | 690 | 683 | 261 | STANDS — a text cut inside the music font |

The other four glyphs, same method (bottom … top; the dot's and the whole note's CENTRE in brackets):

| face | `metNoteHalfUp` ECA3 | `metNote8thUp` ECA7 (adv) | `metNoteWhole` ECA2 | `metAugmentationDot` ECB7 |
|---|---|---|---|---|
| Bravura | −141…688 | −141…696 (534) | −125…148 (12) | −50…50 (**0**) |
| Bravura Text | 7…670 | 7…677 (426) | 20…238 (129) | 80…160 (**120**) |
| Leland | −172…863 | −172…901 (712) | −172…172 (0) | −78…78 (0) |
| Leland Text | −57…565 | −57…590 (428) | −57…149 (46) | −5…97 (**46**) |
| Petaluma | −147…552 | −145…579 (482) | −186…165 (−11) | −57…57 (0) |
| Petaluma Text | −118…442 | −116…463 (386) | −149…132 (−9) | −46…46 (0) |
| Leipzig | −130…668 | −122…672 (502) | −122…120 (−1) | −49…49 (0) |
| Sebastian | 7…690 | 7…700 (446) | 7…233 (120) | 80…166 (123) |

⭐ **In every face the dot's centre is the head's centre** (0 / 120 / 46 / 123) — so one vertical shift
for the whole glyph run keeps the dot beside the head, in all eight. ⚠️ A WHOLE note's bottom is not
the quarter's in Bravura (−125 vs −141) nor Bravura Text (20 vs 7): a raise read from
`metNoteQuarterUp` leaves a whole note 13–16/1000 above the line.

### 4.2 What the designers intended — against a words face AT THE SAME POINT SIZE

Academico `H` = 722, `x` = 467 · Academico Bold 730 / 475 · Edwin Roman 722 / 466 · Edwin Bold 722 / 473
· Nepomuk 664 / 439. Digits stand 0…704. Ratios below are against **Academico / Edwin = 722 and 467**
(the two agree to the unit).

| face | note HEIGHT ÷ caps | note TOP ÷ caps | head height ÷ x-height | reads as |
|---|---|---|---|---|
| Bravura | 1.15 | 0.95 | 0.60 | a small staff note: the *top* is at the capitals only because the head hangs below |
| **Bravura Text** | **0.92** | **0.93** | 0.48 | ⭐ made for 1 : 1 — the note is a capital tall, standing |
| Leland | 1.43 | 1.20 | 0.74 | a full staff note (3.45 sp stem) — not a text cut at all |
| **Leland Text** | 0.86 | **0.78** | 0.44 | SHORT of a capital at 1 : 1 ⇒ MuseScore's 1.667 × (§1) |
| Petaluma | 0.97 | 0.77 | 0.64 | |
| Petaluma Text | 0.78 | 0.61 | 0.51 | |
| Leipzig | 1.10 | 0.93 | 0.54 | like Bravura: top at the capitals, head through the line |
| **Sebastian** | **0.95** | **0.96** | 0.48 | ⭐ = Bravura Text's cut (same box to ± 20) |

Stated intent found in the fonts' own logs — the only two:

- **Bravura 1.17** (2015-04-29, Daniel Spreadbury): *"Added new 'Metronome marks' for notes with 2.75sp
  stems **to balance with text**"*; the ordinary precomposed notes were *"reverted … to have 3.5sp
  stems"* — `MuseScore/fonts/bravura/FONTLOG.txt:302–303`. Measured: 688 ÷ 250 = 2.75 ✔. ⇒ In the MUSIC
  font the `metNote…` range differs from a staff note ONLY in its stem — scale and registration are
  the staff's.
- **Leland Text**: *"Kerning added for metronome mark noteheads (ECA0-ECB6) followed by augmentation
  dot (ECB7)"* and *"Ligatures and contextual alternates for creating simple metric modulations and
  swing markings from metronome mark glyphs"* — `MuseScore/fonts/leland/FONTLOG.txt:63`, `:46`. ⛔ Says
  nothing about size or baseline.
- The SMuFL spec's sentence for a TEXT font — *"positioned such that they sit on the font baseline"* —
  is quoted with its page in `music-text-fonts-research.md` §1.2.

### 4.3 The four outcomes side by side (1/1000 of the WORDS' em; caps = the words' own `H`)

| | head bottom | head centre | note top | top ÷ caps | symbol em ÷ words em |
|---|---|---|---|---|---|
| **MuseScore** default (Leland Text, Edwin Bold) | −95 | +78 | 942 | **1.30** | 1.667 |
| MuseScore, Bravura Text | +12 | +200 | 1117 | 1.55 | 1.667 |
| **LilyPond** (caps: Edwin ≈ C059 proxy) | **0** | +221 | 1436 | ≈ 1.99 | 0.891 × staff scale (= 1.62 × the words' em in sp: 3.56 ÷ 2.2) |
| **Verovio** (Leipzig; caps: proxy) | −224 | **0** | 1188 | ≈ 1.65 | 1.778 (staff scale) |
| **ours, 2026-09-21** — Bravura 20 / 18, raised 141 | 0 | +157 | 921 | 1.26 | 1.111 |
| ours — Leipzig 20 / 18, raised 126 | 0 | +140 | 882 | 1.21 | 1.111 |
| ours — Sebastian 20 / 18, not raised | +8 | +133 | 767 | 1.05 | 1.111 |
| ours BEFORE the raise — Bravura 20 / 18 | −157 | 0 | 764 | 1.05 | 1.111 |

(ours: `src/engine/rendering/marks/tempo/tempoStyle.ts:127–130`, `TempoLayout.ts:137–138`,
`src/engine/engrave/textRoles.ts:68`, `:75`; caps = Academico Bold 730.)

⇒ Three things the table shows, none of them a recommendation:

1. **"Bottom of the head on the baseline" is LilyPond's rule and Bravura Text's / Sebastian's cut**; it
   is NOT what MuseScore's default face nor Verovio draws.
2. ⚠️ **One raise, three different note heights**: after the raise our Bravura note tops out at 1.26
   caps and our Sebastian note at 1.05, from the SAME 20 pt row — because Bravura's cut is 829 tall
   and Sebastian's 683. A size row in points of the FONT'S EM does not give equal notes across faces.
3. The engines' note heights span **1.30 → 2.0 caps**; ours is at or under the bottom of that range.

---

## 5. What a house style could offer — listed, NOT ranked

### 5.1 The vertical

| | the option | who does it | what it needs / its risk |
|---|---|---|---|
| **V1** | **the head's BOTTOM stands on the words' baseline** | LilyPond (by rule, `general-align Y DOWN`); Bravura Text and Sebastian (by cut); the SMuFL spec for text fonts; ours since 2026-09-21 | needs the glyph's ink bottom per face (we read `glyphBox('metNoteQuarterUp').down`). ⚠️ read from the QUARTER it is 13–16/1000 off for a whole note (§4.1); LilyPond aligns each note's own stencil |
| **V2** | **as the font cut it — no shift** | MuseScore (every text style but Marker), Verovio | nothing to compute; the result is the face's: standing (Bravura Text, Sebastian), hanging a quarter-head (Leland Text), or centred on the line (any music cut, Petaluma Text) — so it MOVES when the face changes |
| **V3** | **the head CENTRED on the baseline** | what V2 gives with Bravura / Leland / Petaluma / Leipzig; Verovio's actual output | ⛔ no engine CHOOSES it — it is the absence of a rule |
| **V4** | **the symbol's ink MIDDLE on half the words' cap height** | MuseScore, for coda / segno in a Marker only (`textlayout.cpp:416–438`) | a rule for a symbol that is its own word, not for a note beside `= 120`; needs the words face's cap height at the draw |
| **V5** | **the head centred on the x-height's middle / on the `=` sign's middle** | ⛔ nobody surveyed here. (For scale: the `=` of Academico Bold is centred at 254/1000, Edwin's at 253; a standing Bravura Text head is centred at 120 × its size ratio) | named because the task asked; no engine or font does it |
| **V6** | **a free vertical offset** (staff spaces, or a fraction of the words' em) on top of any of the above | LilyPond per use (`\raise`, `\general-align #Y #n` takes any number — `define-markup-commands.scm:2905–2908`); MuseScore only as sub/superscript (`textlayout.cpp:353–361`); Verovio none | a row, in the unit the role table already uses |

### 5.2 The size

| | the option | who does it | note |
|---|---|---|---|
| **S1** | **the symbol's own size row per text role** — a number independent of the words | MuseScore (`…MusicalSymbolSize`, one per text style; tempo 20 / 12); ours (`tempoSymbol` 20 / `tempoWords` 18) | the number only means something for ONE face: 1.667 suits Leland Text's 0.60 × cut, and gives 1.55 caps with Bravura Text |
| **S2** | **STAFF SCALE, whatever the words' size** (optionally one step down) | Verovio (× 8 / 4.5); LilyPond (× 0.891 of staff scale) | the note is a small staff note, 1.65–2.0 caps; resizing the words does not resize the note |
| **S3** | **the words' size, 1 : 1, in a TEXT cut** | the SMuFL Text convention (Bravura Text: *"at the same point size"*); MuseScore's `metronome` and `tempoChange` styles (12 / 12) | works only where the face has a text cut of the right scale: Bravura Text / Sebastian 0.92–0.96 caps; Leland Text 0.78; a music cut at 1 : 1 hangs below the line |
| **S4** | **a RATIO of the words' size** | ours in effect (20 / 18 = 1.11); Verovio's `rend@fontsize` percent, applied before its staff-scale ratio | same face-dependence as S1 |
| **S5** | **a target stated in the WORDS' terms — "note top = n × caps"** — and the size derived per face from its measured box | ⛔ nobody surveyed here; it is what §4.3 #2 would need for equal notes across faces | needs the words face's cap height and the symbol face's box — both are in generated tables today |

---

## 6. ⛔ UNKNOWN — not established

| | |
|---|---|
| **WHY MuseScore's `tempoMusicalSymbolSize` is 20** (and only the `tempo` style's) | no comment in `styledef.cpp`; the clone is depth-1, so no commit message or PR was read. §1's explanation (Leland Text's 0.60 × cut) is an INFERENCE from measurement. ⛔ The MuseScore GitHub history / PRs were not searched |
| **Whether Leland Text's −57 head is intended** | its FONTLOG says nothing on registration (§4.2). Measured, not explained |
| **Any of the three, RENDERED** | no `lilypond`, `mscore` or `verovio` binary here. Every engine row is source + font arithmetic. In particular LilyPond's 1436 assumes `noteheight` = 1.09 sp from the METAFONT parameters, not a measured Emmentaler outline (no built Emmentaler on disk) |
| **LilyPond's and Verovio's note against THEIR OWN words face's capitals** | C059 and Verovio's Times tables were not measured; "≈ 1.99" uses Edwin (derived from C059) = 722, "≈ 1.65" uses the same 722 as a plain proxy |
| **LilyPond's `\rhythm` markup and the newer `\tempo`-with-markup paths** | `define-markup-commands.scm:1921` was not read; only `format-metronome-markup` (the default `metronomeMarkFormatter`) was |
| **WHY LilyPond chose `Y DOWN`** | the line carries no comment; no history to ask |
| **Dorico, Sibelius, Finale** | not in scope (no source). Dorico's tempo note source is already UNKNOWN in `music-text-fonts-research.md` §7 |
| **What the BOOKS say** | ⛔ deliberately not searched here — `symbol-in-text-baseline-books.md` (this folder, in progress) |
| **Down-stem and beamed/equation forms** (`metNoteQuarterDown`, `♩ = ♩.`) | not measured; MuseScore's tempo patterns and Verovio's import use the up-stem forms only (`tempotext.cpp:174–178`, `iomusxml.cpp:4735–4742`) |
| **How a browser's text layout treats a 2012/−2012 music font inside a words line** | irrelevant to our single-baseline SVG runs; still open for the DOM text editor (same row in `music-text-fonts-research.md` §7) |

---

## 7. The one-line summary

⭐⭐ **Only LilyPond states a vertical rule for a note inside words, and it is "the bottom of the note on
the words' baseline" — the rule we built on 2026-09-21; MuseScore and Verovio shift nothing and draw
whatever the face cut (Leland Text: a quarter of the head below the line; Leipzig: half of it).** The
size is everywhere a number of its own, never the words' — and the three engines' notes stand 1.30,
≈ 1.65 and ≈ 2.0 capitals tall, against our 1.05–1.26 depending on the face.
