# The new durations — what the STANDARDS and the COMMERCIAL APPS say (64th … 512th, breve, longa)

> ⭐⭐ **The question (2026-09-26):** today the editor has `'w' | 'h' | 'q' | '8' | '16' | '32'`
> (`src/types/duration.ts`). We plan to add **64th, 128th, 256th, 512th, BREVE (double whole) and
> LONGA (quadruple whole)**. This file is the INDUSTRY half of the research: the file-format
> standards (MusicXML, MEI, SMuFL, MIDI, ABC) and the commercial apps (Sibelius, Finale, Dorico).
>
> ⛔ **This is a SURVEY, not a plan and not a decision.** Two sibling surveys cover what this one
> deliberately does not: the open-source engines' SOURCE (MuseScore / Verovio / LilyPond) and the
> engraving BOOKS. Nothing here chooses anything; §8 lists where sources agree, where they disagree,
> and the options — never a recommendation where they disagree.
>
> **Confidence markers, meant literally:**
> **✅** — read on the cited page (or in the cited file) during this research.
> **🔶** — secondhand (a forum post, a third-party guide, a search snippet) or our own arithmetic;
> marked at each use.
> **⛔ UNKNOWN** — not established; nothing is guessed in its place (`CLAUDE.md`).
>
> Everything below was fetched on **2026-09-26**.

---

## 1. MusicXML (W3C Music Notation CG, 4.0)

### 1.1 `<type>` — the GRAPHIC note value

- ✅ `note-type-value` enumerates exactly: **`1024th`, `512th`, `256th`, `128th`, `64th`, `32nd`,
  `16th`, `eighth`, `quarter`, `half`, `whole`, `breve`, `long`, `maxima`** — *"the graphic note
  type, from 1024th (shortest) to maxima (longest)"*.
  <https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/note-type-value/>
- ✅ The longa is spelled **`long`**, not `longa`. (Same page.)
- ✅ `1024th`, `512th` and `maxima` arrived in **MusicXML 3.0**: *"Added 1024th, 512th, and maxima
  values to the <type> element."* <https://www.w3.org/2021/06/musicxml40/version-history/30/>
  ⇒ 🔶 before 3.0 the range was 256th … long (inferred from that sentence — the 2.0 list itself was
  not read).
- ✅ `<type>` is *"the graphic note type. Values range from 1024th to maxima"*; its `size` attribute
  (full / cue / grace-cue / large) is separate.
  <https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/type/>
- ✅ `<type>` is **optional** in `<note>`'s content model.
  <https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/note/> — the page does not say
  WHEN it may be omitted (⛔ UNKNOWN from the spec text).
- 🔶 Finale goes shorter than MusicXML can name — to the **4096th** — and Finale's own exporter (and
  the `denigma` converter following it) writes such notes with a `<duration>` but **no `<type>`**:
  *"MusicXML's note-type-value stops at 1024th, but Finale goes to 4096th"*.
  <https://github.com/openmusx/denigma/pull/145>

### 1.2 `<divisions>` / `<duration>` — the SOUNDING length

- ✅ *"The <divisions> element indicates how many divisions per quarter note are used to indicate a
  note's duration."* and *"If maximum compatibility with Standard MIDI 1.0 files is important, do not
  have the divisions value exceed 16383."*
  <https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/divisions/>
- 🔶 Arithmetic (ours): a `<duration>` is an integer count of divisions, so the shortest value a file
  contains sets a floor on `divisions`: a 512th = ¼ ÷ 128 of a quarter ⇒ `divisions` must be a
  multiple of **128** (256 for a dotted 512th, 256 for a 1024th). A longa at `divisions = 128` is
  16 × 128 = 2048 — nowhere near the 16383 ceiling. **Nothing in the standard stops a 512th.**

### 1.3 Square vs round breve — NOT a note-type distinction

- ✅ There is ONE `breve` type value; the note type does not say square or round (list above).
- ✅ `notehead-value` has both **`square`** and **`rectangle`** among its values, but the
  reference text does not explain either, nor tie them to breve or long.
  <https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/notehead-value/>
  ⇒ ⛔ UNKNOWN whether the CG intends `<notehead>square</notehead>` on a `breve` to mean the square
  breve. The standard leaves the breve's SHAPE to the reader (a house-style choice).

### 1.4 Whole-measure rests

- ✅ `<rest measure="yes">`: *"If yes, this indicates this is a complete measure rest."* Optional
  `<display-step>`/`<display-octave>` place it. Added in **3.0** (*"Added measure attribute to the
  <rest> element."*).
  <https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/rest/> ·
  <https://www.w3.org/2021/06/musicxml40/version-history/30/>
- ⇒ The standard separates "this bar is silent" (a FLAG) from the glyph drawn; whether that glyph is
  a whole rest or a breve rest in 4/2 is the reader's. (Sibelius' behaviour, §4.1, is a concrete
  instance.)

---

## 2. MEI (Music Encoding Initiative, v5)

- ✅ `data.DURATION.cmn` (common music notation) allows: **`long`, `breve`, `1`, `2`, `4`, `8`, `16`,
  `32`, `64`, `128`, `256`, `512`, `1024`, `2048`** — *"Logical, that is, written, duration attribute
  values for the CMN repertoire"*.
  <https://music-encoding.org/guidelines/v5/data-types/data.DURATION.cmn.html>
  - ⚠️ MEI goes one step SHORTER than MusicXML (**2048**) and one step less LONG: there is **no
    `maxima` in CMN**.
- ✅ `maxima` lives only in the MENSURAL list — `maxima, longa, brevis, semibrevis, minima,
  semiminima, fusa, semifusa`, each *"two or three times"* the next (perfection), i.e. a DIFFERENT
  duration system, not a longer CMN value.
  <https://music-encoding.org/guidelines/v5/data-types/data.DURATION.mensural.html>
- ⇒ MEI's split is the cleanest statement found of a line worth knowing: **breve and long are CMN
  values; maxima is early-music**.

---

## 3. SMuFL (glyphs)

Code points below are read from **our own copy of the SMuFL metadata**, `public/smufl/glyphnames.json`
(verbatim from the spec repo, 2026-07-22 — `public/smufl/PROVENANCE.md`), and cross-checked against
the spec's range pages, which now live at `smufl.formats.music` (⚠️ `w3c.github.io/smufl` →
`w3c-cg.github.io/smufl` → `smufl.formats.music`, two 301s).

### 3.1 Noteheads — ✅ <https://smufl.formats.music/latest/tables/noteheads.html>

| glyph | cp | description |
|---|---|---|
| `noteheadDoubleWhole` | U+E0A0 | Double whole (breve) notehead |
| `noteheadDoubleWholeSquare` | U+E0A1 | Double whole (breve) notehead (square) |
| `noteheadWhole` | U+E0A2 | Whole (semibreve) notehead |

- ✅ **SMuFL has NO longa notehead and NO longa note in CMN.** The only longa noteheads are mensural
  (`mensuralNoteheadLongaBlack` E934 … `mensuralNoteheadLongaWhite` E937, `mensuralWhiteLonga` E95D);
  `individualNotes` (U+E1D0–E1EF) runs `noteDoubleWhole` E1D0 / `noteDoubleWholeSquare` E1D1 down to
  `note1024thUp` E1E5 and stops. (`glyphnames.json`.) ⇒ a CMN longa is necessarily a **stack**:
  a breve head (either shape) + a stem drawn by the app. `docs/research/sibelius-keypad.md` §6 already
  draws the Keypad's longa that way (`noteheadDoubleWholeSquare` + `stem`).
- ✅ SMuFL's own advice for every notehead: *"combined with stems and flags as necessary"*, and
  applications should *"draw stems using primitives, rather than using stem"* (noteheads page above).
- ✅ **Bravura** ships an optional `noteheadDoubleWholeAlt` (U+F43F, *"Double whole note (breve),
  single vertical strokes"*) plus `…Small` and `…Oversized`; ⇒ 🔶 Bravura's DEFAULT E0A0 is the
  two-stroke form (inferred from the alternate's description). `scripts/vendor/Bravura.json`
  (`optionalGlyphs`, `glyphsWithAlternates`).

### 3.2 Flags — ✅ <https://smufl.formats.music/latest/tables/flags.html>

| value | up | down |
|---|---|---|
| 64th | `flag64thUp` E246 | `flag64thDown` E247 |
| 128th | `flag128thUp` E248 | `flag128thDown` E249 |
| 256th | `flag256thUp` E24A | `flag256thDown` E24B |
| 512th | `flag512thUp` E24C | `flag512thDown` E24D |
| 1024th | `flag1024thUp` E24E | `flag1024thDown` E24F |

- ✅ SMuFL allows either a precomposed flag or a BUILD: *"Scoring applications may create groups of
  flags for notes shorter than 16th notes … by combining flag16thUp with the required number of
  flagInternalUp …, ensuring even spacing."* Straight / short / small alternates exist for every
  flag through the 1024th (flags page).
- ✅ In Bravura each longer flag stack carries its own `stemUpNW` anchor (512th up: y = 3.324 sp,
  1024th up: 4.064 sp) — i.e. the font tells the app how far the stem must reach into the flag.
  `scripts/vendor/Bravura.json` `glyphsWithAnchors`. (What that means for stem LENGTH is the books'
  question, not this file's.)

### 3.3 Rests — ✅ <https://smufl.formats.music/latest/tables/rests.html>

| glyph | cp | | glyph | cp |
|---|---|---|---|---|
| `restMaxima` | U+E4E0 | | `rest64th` | U+E4E9 |
| `restLonga` | U+E4E1 | | `rest128th` | U+E4EA |
| `restDoubleWhole` | U+E4E2 | | `rest256th` | U+E4EB |
| `restWhole` | U+E4E3 | | `rest512th` | U+E4EC |
| `restDoubleWholeLegerLine` | U+E4F3 | | `rest1024th` | U+E4ED |

- ✅ Unlike noteheads, **the longa and maxima RESTS are in the CMN range** (E4E0/E4E1).
- ✅ Implementation note: "old style" multi-bar rests may combine *"restLonga (four bars),
  restDoubleWhole (two bars) and restWhole (one bar) next to each other"*; modern H-bars are to be
  drawn with primitives, not `restHBar`.
- ✅ Our three fonts **all ship every glyph named in §3.1–3.3** (Bravura 1.481, Leipzig 5.2.86,
  Sebastian 1.35 — checked against `glyphBBoxes` in `scripts/vendor/*.json`). ⚠️ Leipzig's metadata
  has **no `glyphsWithAnchors` entry** for `flag512thUp` / `flag1024thUp`; Bravura and Sebastian do.

---

## 4. Commercial apps

### 4.1 Sibelius (Avid) — ✅ Sibelius Reference Guide 2024.3
<https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf>

- ✅ **Range: "512th note (7 beams) to double breve (4 times duration of whole note)"** in Sibelius
  Artist and Ultimate; **Sibelius First: "32nd note to breve"** (edition table, printed p. 7 / PDF
  p. 12 — column assignment read off the RENDERED page). ⚠️ Sibelius calls the longa a **"double
  breve"**; its Keypad calls it "Long" (`docs/research/sibelius-keypad.md` §3). No 1024th, no maxima.
- ✅ **Internal resolution: 256 ticks per quarter**, fixed: *"The default of 256 PPQN … matches
  Sibelius's internal resolution … (Choosing a higher PPQN value doesn't make the exported MIDI file
  any more 'accurate', since Sibelius's internal resolution is fixed at 256.)"* (PDF p. 108), and
  *"256 ticks = 1 quarter note (crotchet)"* (PDF p. 274). 🔶 Arithmetic: a 512th is then **2 ticks**,
  a 1024th would be 1, a dotted 512th 3 — the 512th floor is exactly where a 256-PPQ grid still has
  room for a dot. (The Reference does not give this as the reason; it is our observation.)
- ✅ **Breve bar rest:** *"In 4/2 and other time signatures where the bar length is equal to eight
  quarter notes (crotchets), Sibelius shows a double whole note (breve) bar rest, rather than a
  regular bar rest."* Switchable: *"Use double whole note (breve) bar rests in 4/2 and 3/1"*
  (Engraving Rules › Bar rests) (PDF p. 201). Its MusicXML exporter loses this: *"double whole note
  (breve) bar rests in 4/2 will appear as normal whole note (semibreve) bar rests"*.
- ✅ Its MusicXML importer drops *"Metronome marks containing 256th, 128th, 64th and long (breve)
  notes"* (PDF p. 58) — a small sign of how rarely these values travel between apps.
- ✅ **Entry:** default Keypad layout 1 has 4 = quarter; the 64th/128th/256th/512th/breve/longa are on
  the **second Keypad layout (F8)** — keys 4/5/6/7 and 8/9 (`docs/research/sibelius-keypad.md` §3,
  from the Sibelius 6 Reference). ✅ An alternative "Finale-style" layout (5 = quarter) reaches *"a
  128th note … right up to a double whole note (breve) without changing Keypad layout"* (PDF p. 235).
- ⛔ UNKNOWN: Sibelius' default breve HEAD shape (round-with-bars vs square). The Reference text does
  not say; not checked in the program.

### 4.2 Finale (MakeMusic) — ⚠️ DISCONTINUED

- ✅ MakeMusic ended Finale's development and sales on **26 Aug 2024**.
  <https://www.makemusic.com/press-room/press-releases-2024/makemusic-sunsets-finale/> ·
  <https://www.scoringnotes.com/news/makemusic-ends-development-and-availability-of-finale/>
- ✅ **Shortest: the 4096th** — the secondary-beam-break dialog lists *"16th • 32nd • 64th… 4096th"*.
  <https://usermanuals.finalemusic.com/Finale2009Mac/Content/Finale/STSBBDLG.htm> (and the denigma PR,
  §1.1).
- ✅ **Simple Entry Rests palette:** Double Whole down to **128th** (nine values).
  <https://usermanuals.finalemusic.com/Finale2014Win/Content/Finale/IDR_SIMPLETOOLPALETTE_RESTS.htm>
- 🔶 **Keys:** numpad **1 = 64th … 5 = quarter … 8 = breve** (third-party guide, Univ. of Notre Dame
  library). <https://libguides.library.nd.edu/notation/finale-notes> — Finale's own page says only
  *"the numeric keypad (1-8)"*. <https://usermanuals.finalemusic.com/FinaleMac/Content/Finale/Simple_Entry.htm>
- ✅ **Breve head:** *"The double whole note, or breve has a duration of eight beats"*; the user
  chooses between two notehead styles (Document Options › Notes and Rests › Note Head Characters ›
  Double Whole). The page does not name which is default (⛔ UNKNOWN).
  <http://usermanuals.finalemusic.com/Finale2012Mac/Content/Finale/Double_whole_notes.htm>
- ⛔ UNKNOWN: whether Finale has a longa/maxima note value. No Finale page found names one.

### 4.3 Dorico (Steinberg)

- ✅ **Range: "Note durations from 1/1,024th note to maxima (32 quarters)"** and *"Rest durations from
  1/1024th to maxima (32 quarters)"* — Dorico 2.2 Detailed Feature List (Nov 2018).
  <https://download.steinberg.net/webcontent/products/dorico/Dorico_22_Detailed_Feature_List.pdf>
  ⇒ the widest range of the three, and the only one with a **maxima**.
- ✅ **Keys** (number row): *"press 6 for quarter notes … 5 for eighth notes and 4 for 16th notes …
  7 for half notes"*.
  <https://archive.steinberg.help/dorico/v5/en/dorico/topics/write_mode/write_mode_durations/write_mode_duration_selecting_t.html>
  ✅ **9 = breve**: *"press 9 G for a double whole note (two whole notes)"* — Dorico "Getting started"
  hand-out (2023). <https://blog.dorico.com/wp-content/uploads/2023/01/2023-01-26-Getting-started-USA.pdf>
  🔶 The pattern puts 3 = 32nd, 2 = 64th, 1 = 128th, 8 = whole (search snippet + the layout; ⚠️ the
  same hand-out also prints *"8 . (dotted half note)"*, which contradicts 7 = half — a typo one way or
  the other). The 5.1 Quick Reference Card shows the grid **1–9, 0, −, =** as pictures only
  (<https://blog.dorico.com/wp-content/uploads/2024/08/Dorico-Quick-Reference-Card-v5.pdf>) ⇒ ⛔
  UNKNOWN which values 0, − and = carry (plausibly 256th and longer values — not verified). Values
  with no key are reached from the Notes panel (*"Show/Hide All Notes"*, manual page above).
- ✅ **Breve shape is an option:** Dorico 1.2.10 (Feb 2018) added *"the choice of using square or
  round noteheads for double whole notes (breves)"*.
  <https://blog.dorico.com/2018/02/dorico-1-2-10-released-system-dividers-wings-repeats/>
  ✅ A notehead set's breve is *"a wider white notehead with one or two vertical strokes on either
  side, or a square white notehead"*.
  <https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_notes_notehead_sets_c.html>
  🔶 Before that option existed users complained of the **square** breve in chords, and Daniel
  Spreadbury (Steinberg) promised *"a setting for this in Engraving Options"*.
  <https://forums.steinberg.net/t/breve-notehead-options/677645> ⇒ ⛔ UNKNOWN which shape is the
  CURRENT default.
- 🔶 **Breve bar rest in 4/2:** a user says there is a global option *"to display whole bar rests as
  breve rests in 4/2"*, name not given. <https://forums.steinberg.net/t/whole-bar-breve-multi-bar-rests/899784>
  ⛔ UNKNOWN: the option's name and default.

---

## 5. MIDI / Standard MIDI File

- ✅ SMF header `<division>`, bit 15 = 0: *"bits 14 thru 0 represent the number of delta time 'ticks'
  which make up a quarter-note"* (so ≤ 32767); bit 15 = 1 is SMPTE time instead.
  <https://midimusic.github.io/tech/midispec.html>
- 🔶 Typical values: 24 (MIDI clock), 96, **120** "a common value", **960** "and beyond" in modern
  sequencers (<https://en.wikipedia.org/wiki/Pulses_per_quarter_note>); Cubase 480, Logic 960
  (forum/secondhand, <https://forums.steinberg.net/t/midi-resolution-ticks-ppq-and-quantize/669566>).
- 🔶 **Arithmetic — is a 512th representable?** It is `PPQ / 128` ticks:

  | PPQ | 64th | 128th | 256th | 512th | 1024th | longa |
  |---|---|---|---|---|---|---|
  | 96 | 6 | 3 | 1.5 ⛔ | 0.75 ⛔ | ⛔ | 1536 |
  | 256 (Sibelius) | 16 | 8 | 4 | **2** | 1 | 4096 |
  | 480 | 30 | 15 | 7.5 ⛔ | 3.75 ⛔ | ⛔ | 7680 |
  | 960 | 60 | 30 | 15 | 7.5 ⛔ | ⛔ | 15360 |
  | 1920 | 120 | 60 | 30 | **15** | 7.5 ⛔ | 30720 |

  ⛔ = not an integer ⇒ the note must be rounded on export. **At the common 480 and 960, a 512th is
  NOT exactly representable** (480 fails already at the 256th); a power-of-two PPQ (256, 1024…) or a
  multiple of 128 (e.g. 1920 = 15 × 128) is needed. Tuplets multiply the requirement.
  ⇒ This only bites an SMF EXPORT; our model keeps `beat` as an exact `Fraction` (`CLAUDE.md`), and
  🔶 we have no MIDI or MusicXML exporter today (grep of `src/`, 2026-09-26).

---

## 6. ABC notation (v2.1)

- ✅ Durations are multiples of a unit length `L:` (`A2`, `A/2`, `A//`); *"All compliant software should
  be able to handle note lengths down to a 128th note; shorter lengths are optional."* and *"Note
  lengths that can't be translated to conventional staff notation are legal, but their representation
  by abc typesetting software is undefined"* (§4.3). Multi-bar rests `Z`/`X` (§4.5). No breve / longa
  is named. <https://abcnotation.com/wiki/abc:standard:v2.1>
- ⇒ The only standard found that states a **minimum conformance floor**: the 128th.

---

## 7. Practice — how short is short, how long is long

- ✅ 256ths occur in Mozart ("Je suis Lindor" variations, var. 11), Vivaldi (RV 444), Dussek, Couperin; 512ths and 1024ths
  are *"extremely rare"* (Heinrich's *Toccata Grande Cromatica*, c. 1825); Ferneyhough uses down to
  the **4096th** (inside tuplets). <https://en.wikipedia.org/wiki/Two_hundred_fifty-sixth_note>
- ✅ *"Shorter notes can be created theoretically ad infinitum by adding further flags, but are very
  rare."* The longa or breve can mark *"a very long note of indefinite duration, as at the end of a
  piece (e.g. … Mozart's Mass KV 192)"*. <https://en.wikipedia.org/wiki/Note_value>
- ✅ A modern longa *"is often given the rounded notehead shape of the double whole note"*, and *"the
  longa rest still appears as a way of writing rests that last exactly four measures"*.
  <https://en.wikipedia.org/wiki/Longa_(music)>
- ✅ The breve head is drawn *"by a hollow oval note head, like a whole note, with one or two vertical
  lines on either side … or as the rectangular shape also found in older notation"*; its rest is a
  filled rectangle between the 2nd and 3rd lines from the top.
  <https://en.wikipedia.org/wiki/Double_whole_note>
- ⛔ **No source found that STATES why apps stop where they do.** The only mechanism documented is
  Sibelius' fixed 256-PPQ grid (§4.1), which makes its 512th floor arithmetic, not taste (our reading).
  Every standard (MusicXML 1024th, MEI 2048th, SMuFL 1024th) goes further than any app except
  Finale (4096th).

---

## 8. Comparison

| | shortest | longest | breve | longa | maxima | breve head | breve bar rest in 4/2 |
|---|---|---|---|---|---|---|---|
| **MusicXML 4.0** | 1024th | maxima | `breve` | `long` | ✅ `maxima` | not encoded by type (`notehead` has `square`/`rectangle`, undefined) | `measure="yes"` flag; glyph = reader's |
| **MEI 5 (CMN)** | 2048 | long | `breve` | `long` | mensural only | ⛔ not looked at | ⛔ not looked at |
| **SMuFL** | 1024th (flag, rest, note) | maxima (rest only) | E0A0 round / E0A1 square | **no CMN head**; `restLonga` E4E1 | `restMaxima` E4E0; head mensural only | both provided | `restDoubleWhole` E4E2 |
| **SMF (MIDI)** | PPQ-bound (512th needs PPQ ÷ 128) | — | — | — | — | — | — |
| **ABC 2.1** | 128th required, shorter optional | — | not named | not named | — | — | `Z` |
| **Sibelius** (Artist/Ultimate) | 512th | "double breve" (= longa) | ✅ | ✅ | ⛔ | ⛔ UNKNOWN | ✅ breve rest, default ON, rule to switch off |
| Sibelius First | 32nd | breve | ✅ | ⛔ | ⛔ | | |
| **Finale** (discontinued 2024) | 4096th | breve (longer ⛔ UNKNOWN) | ✅ | ⛔ UNKNOWN | ⛔ UNKNOWN | two styles, choosable | ⛔ UNKNOWN |
| **Dorico** | 1024th | maxima | ✅ (key 9) | ✅ | ✅ | round or square, option since 1.2.10; default ⛔ | 🔶 option exists |

Entry keys, where known: Sibelius — second Keypad layout F8 (4/5/6/7 = 64th/128th/256th/512th,
8 = breve, 9 = longa); Finale — numpad 1 = 64th … 8 = breve (🔶); Dorico — 6 = quarter, 9 = breve
(✅), 1 = 128th (🔶).

---

## 9. What matters for us — agreements, disagreements, options

**Where every source AGREES**

1. **64th, 128th, 256th, breve** are standard everywhere we looked — every format names them, every
   current app enters them, SMuFL and all three of our fonts have every glyph. There is no source-side
   obstacle to any of them.
2. The **512th** is in every format and in Sibelius (its floor), Dorico and Finale; SMuFL and our fonts
   have its flag and rest. ⚠️ It is the first value the common 480/960 MIDI grids cannot hold (§5).
3. **The breve's SHAPE is house style, not data.** MusicXML has one `breve`; SMuFL gives both heads;
   Dorico and Finale let the user choose. ⇒ in this editor it is a changeable ROW (CLAUDE.md: an
   engraving choice is never a constant). Which default is the books' question (sibling survey).
4. **"This bar is silent" is separate from the glyph drawn** — MusicXML `measure="yes"`, Sibelius'
   bar rest vs whole rest, and its breve-bar-rest-in-4/2 rule. Relevant to our voice bar rest
   (`barRest`), not only to the durations.

**Where sources DISAGREE (left open)**

5. **Shortest value:** ABC requires 128th · Sibelius 512th · MusicXML/SMuFL/Dorico 1024th · MEI 2048th
   · Finale 4096th. Our plan's 512th sits with Sibelius; the 1024th is the next value that a
   standard, SMuFL and Dorico all have. Options: stop at 512th (plan), or 1024th (SMuFL/MusicXML's
   edge). `feedback_durations_will_grow` already says to key on what a note HAS, not today's list.
6. **Longa:** a type in MusicXML (`long`), MEI (`long`), Sibelius ("double breve") and Dorico — but
   **SMuFL has no CMN longa notehead**. Options: breve head (round or square) + a primitive stem —
   the Keypad's picture today uses the square head, Wikipedia says modern practice "often" uses the
   round one. The stem side (right, mensural-style, vs half-note-like) is the books'/engines'
   question.
7. **Maxima:** MusicXML, SMuFL (rest) and Dorico have it; MEI files it under MENSURAL, not CMN;
   Sibelius does not have it. It is **not in our plan**; noted only so the choice is visible.
8. **Breve head default:** ⛔ UNKNOWN for all three apps' current defaults; Dorico was square before
   2018 and drew complaints about chords. Not resolvable from these sources.

**Consequences worth writing down**

9. **Export, not the model, is where short values cost something.** Our `Fraction` beats hold a 512th
   exactly. A future MusicXML export needs `divisions` a multiple of 128 (≥ 256 with dots) — fine
   under the 16383 advice; a future SMF export needs a PPQ divisible by 128, which **480 and 960 are
   not** (1920 is).
10. **Leipzig lacks stem anchors for the 512th/1024th flags** (§3.3) — a font-metrics gap to expect when
    the 512th meets the font switch, not a blocker (a fallback row, like other missing metadata).
11. **Rests for longa/maxima exist in SMuFL even though the notes' heads don't** — a longa REST is a
    single glyph (E4E1); a longa NOTE is a stack.
