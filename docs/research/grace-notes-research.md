# Grace notes — appoggiatura, acciaccatura, Nachschlag: what the sources say

> **Findings only**, in the manner of `docs/research/spacing-model-research.md` — ⛔ nothing here is a
> decision, and no file is named to edit. The feature has no plan yet; when it does, that plan is where
> the choices get made, and this file is its menu. ⚠️ A research file does not know what was DECIDED.
>
> Written 2026-09-22 from four investigations run the same morning, each a chapter below, kept whole
> with its own citations (`file:line` under `~/dev/engine-sources/`, printed page numbers in
> `reference/`, URLs online — §A.n below means Part A, section n): **A** VexFlow 5.0.0 · **B** LilyPond, Verovio, MuseScore · **C** the
> four treatises on disk · **D** the interchange formats, SMuFL and the shipping applications. §0 is
> the synthesis, and the one part of this file written by hand rather than found.
> **G · H · I** (2026-09-23) are the BRACKETED note — the stemless head in round brackets (Sibelius's
> "pre-bend", a trill's auxiliary): the books, the engines, the apps and formats; §0.9 is their synthesis.
>
> ⚠️ **The four chapters were written by four agents in parallel and do not know of each other.** Where
> two disagree, §0.4 says which one read the source. The scans the literature chapter measured were
> rendered into a session scratchpad and are gone; every measurement names its printed page and dpi,
> so `pdftoppm -r 600 -f <printed+20> -l <printed+20>` on Gould reproduces it (`reference/README.md`
> for the other three books' page offsets).

## 0. Synthesis

### 0.1 ⭐⭐ The picture is content; the clock is a house rule

Every format, engine and book stores the same five facts and nothing more:

| fact | MusicXML | MEI | MNX | music21 | LilyPond | MuseScore | VexFlow |
|---|---|---|---|---|---|---|---|
| **no counted duration** | `<grace/>`, no `<duration>` | `@grace`, not counted for conformance | `type:"grace"` | `GraceDuration`, quarterLength 0 | `Moment(main, grace)` | child `Chord`, parent's tick | modifier, ticks unused |
| **a WRITTEN value** | `<type>` | `@dur` | inner event `/8` | `Duration.type` | the written duration | `NoteType` + `durationType` | `duration` |
| **slash = acciaccatura** | `slash="yes"` | `@stem.mod="1slash"` | `slash` (default true) | `.slash` | `\acciaccatura` / `\slashedGrace` | `ACCIACCATURA` | `slash: true` |
| **attached BEFORE or AFTER** | order only (⚠️ no attachment) | `<graceGrp @attach="pre\|post">` | order | `priority` | `\afterGrace` | `GRACE8_AFTER…` | `Position.LEFT/RIGHT` |
| **whose time, as a HINT** | `steal-time-previous/-following`, `make-time` | `@grace=acc\|unacc\|unknown`, `@grace.time` | `graceType` | `stealTimePrevious/Following` | — | — | — |

⭐⭐ **Nobody stores the borrowed time as a duration**, and the hint is a hint: MuseScore's MusicXML code
has **zero** occurrences of `steal-time` (§D.1, §B.3.12), Verovio drops it, and the three engines' own
performance rules disagree outright (§0.3). Gould, pp. 127–129, makes the PLACEMENT independent of the
performance and leaves the meaning to the composer's instruction or articulation (§C.11). ⇒ what the
score says is *"these attacks belong to that note and are drawn small"*; what they steal is a
playback preset.

### 0.2 ⭐⭐ The one structural disagreement — first-class event vs child of the principal

| | first-class at a grace moment | child of the principal note |
|---|---|---|
| who | **LilyPond**: `Moment (main, grace)`, lexicographic compare, a grace starts at `(0, −len)` (§B.1.2) | **MuseScore**: a child `Chord` at the parent's tick (§B.3.1) · **VexFlow**: a `Modifier` on the host (§A.1) · **Dorico**: *"a mini-score of all of the grace notes in all of the voices at a given rhythmic position"* (§D.5) |
| what it buys | every engraver sees the grace; beams, slurs, accidentals, spacing need no special path | the tick line, bar arithmetic, rebar, playback's clock and the columns never see it |
| what it costs | ⭐ LilyPond's own Known Issues (§B.1.13): barlines and key signatures move on staves WITHOUT the grace, no nesting, MIDI *"Going back in time"* | grace-AFTER is awkward — MuseScore pre-appends it to the FOLLOWING segment and re-offsets after spacing (§B.3.1), its `graceIndex` is admitted *"not well-maintained"*; Dorico cannot split before+after at one position (§D.8) |

Verovio sits between: a sibling `<note grace=…>` of zero alignment duration, with a side
`GraceAligner` counting time backwards (§B.2.2).

### 0.3 ⭐ Where the time goes — every rule found, none of them the notation's

| source | acciaccatura (slashed) | appoggiatura (unslashed) | grace after |
|---|---|---|---|
| LilyPond MIDI | steals **9/40** of the written value from the PREVIOUS note (`audio-item.cc:120-124`; the docs say ¼) | same rule | `afterGraceFraction` **3/4** of the main note |
| MuseScore | **65 ms × n** before the beat, *"determined empirically"*; the principal is always delayed | **½** the principal (⅔ dotted, 4/7 double-dotted; ⅔ in compound meter) | at the end of the main note |
| Verovio | `tempo/2048` per grace before the beat, **only if there is room** | — | — |
| Dorico (manual) | before the beat, one default length (number UNKNOWN); unslashed ≤16th also before | ≥8th unslashed: ON the beat, half the main note | — |
| Stone p. 21 | *"as fast as possible … always before the beat"* | no slash ⇒ a measured value (p. 22 fn) | — |
| Gould pp. 127–129 | placement is independent of performance | — | — |

⛔ The half-value rule is stated in NO book on disk (§C.11): it is an engine convention.

### 0.4 ⭐ The numbers, and who read them where

| what | value | source |
|---|---|---|
| **size** | Gould p. 125 *"slightly smaller than a cue note, which is ¾"*, her drawing measures **0.60–0.65**; G&L p. 72 *"65%"*; Dorico **3/5**; Sibelius **60%**; MuseScore `graceNoteMag` **0.7**; LilyPond `font-size −3` = **0.707**; Verovio **0.75**; VexFlow **2/3**; ⭐ the FONTS draw **0.66** (Bravura) / **0.64** (Sebastian), §0.5 | §C.1 · §D.7 · §B · §A.3 |
| **stem** | Gould p. 125 prose **2¼**, ⭐ her own 12 drawn graces **2.22–2.67, median ≈2½** — the drawing sides with Stone p. 49's **2½**; ≈0.75 of a full stem, not scaled with the head. Engines: LilyPond 0.8×, MuseScore 0.7×, Verovio 0.75×, all with the middle-line rule OFF; Dorico: normal stems | §C.1 · §B.1.4/2.4/3.4 |
| **stem direction** | UP regardless of pitch — all four books, all three engines, Dorico/Sibelius/Finale; the one shared exception is the lower part on a shared stave (voice parity checked BEFORE the grace rule in MuseScore) | §C.2 · §B · §D.5 |
| **slash** | Gould drawn, 600 dpi: **≈2.1–2.2 sp long, 38–43°, crossing ≈1.15–1.24 sp below the tip (mid-stem), ≈0.5 sp outside / ≈1.15 sp on the flag side, ≈0.09 sp thick**; Ross p. 190 *"lower left to upper right … bisect the flag"*; MuseScore `stemSlashPosition 2.0 sp` / `stemSlashAngle 40°` / `stemSlashThickness 0.125 sp` (the only engine with a full geometry); SMuFL anchors on Bravura's 8th flags ⇒ 1.93 × 1.66 sp (41°) stem-up; VexFlow a hand-stroked 45° at half the stem | §C.3 · §B.3.6 · §0.5 · §A.3 |
| ⭐ **slash — the deep pass** | measured from the STEM TIP; a ledger line is cleared by LENGTHENING the stem, never by moving the slash; staff lines are not avoided; no book slashes an unflagged grace | **§0.8, Part E** |
| **slash on a beamed group** | ONE, on the first stem, diagonal to the beam (Gould p. 126 *may*; Stone *must*; G&L *never*; LilyPond draws NONE — a Known Issue; Verovio none) | §C.3 · §B.1.6/2.6 |
| **slur** | Gould p. 129 *"below the grace note, from notehead to notehead"*, above only when it would hit the main note's accidental or ledgers (pp. 129–130); each group its own slur even inside a phrase slur (p. 130); Stone omits it. Only LilyPond auto-adds one (forced DOWN); VexFlow's `showSlur` is a tie from the FIRST grace to the host | §C.4 · §B.1.8 · §A.5 |
| **beams** | a group's own beam, thinner by the size factor, never joined to the principal; the count differs in all four books (§C.5) | §C.5 · §B |
| **spacing** | ⭐ measured off Gould, no book states it: last grace → principal **2.1–2.5 sp** c-to-c (edge gap ≈1.15) vs **1.5–1.85** between beamed graces (edge ≈0.65–1.0) — the gap to the principal IS larger; barline → first grace **1.0 sp**; Gould p. 43 *"an accidental or grace note may be closed up to within ½ space of a barline"*. Engines pack RIGHT-TO-LEFT from the principal and add the group's width as the principal's LEFT padding: LilyPond `GraceSpacing` (increment 0.8 vs 1.2, `shortest-duration-space` 1.6 vs 2.0, an admitted *"arbitrary"* 0.8 spring into the run), MuseScore `graceToMainNoteDist 0.45` / `graceToGraceNoteDist 0.3`, Verovio 0.375 sp before the principal; ⭐ all three EXCLUDE graces from the bar's shortest-note statistic | §C.6 · §B.1.3/2.3/3.3 |
| **bar start** | after the barline by default, before the principal *"including for the first note in a bar"* (Dorico, LilyPond, Gould p. 127); 3+ before-beat graces MAY go before the barline; trill finishing notes go before it; other parts and rests align with the PRINCIPAL (Gould pp. 127–128, 159) — Dorico: one x on every staff, and its *"before barline"* property applies to ALL graces at that position and is broken at repeat barlines | §C.6 · §D.5/8 |
| **accidentals** | scaled with the grace (LilyPond `−4` = 0.63, one step smaller than the note); Gould p. 125 grace ♯♮ 2 sp, ♭ 1¾ sp; Gould p. 78 (accidentals scaled *only* before a grace or cue note) is located in the OCR only, ⚠️ not rendered | §C.7 · §B.1.9 |
| **ledger lines** | Gould p. 26 *"shorter … in proportion"* (0.64× — already in `docs/research/ledger-line-length-research.md` §5.6); G&L p. 75 same thickness; SMuFL: `legerLineExtension` *"scaled proportionally with the notehead's size, e.g. when scaled down as a grace note"* | §C.10 · §D.4 |
| **stem thickness** | NOT thinned on Gould's grace plate (`docs/research/stem-thickness-research.md` §2.4); MuseScore scales with `mag()`, Verovio with the staff only | — |

**The four books disagree on** (§C, *Where the sources DISAGREE*): stem 2¼ vs 2½; the slash on
groups (must / never / may / none); the down-stem slash direction (G&L and Ross always rising, Gould
mirrored — drawn twice); whether the slur is obligatory; beam counts; grace ledger weight; on/before
the beat. ⭐ Every one of these is a ROW for a preset, none a blocker (`CLAUDE.md`).

### 0.5 ⭐ The fonts we ship (checked by hand, 2026-09-22, opentype.js + a Chromium render)

SMuFL's *Common ornaments* range holds six grace glyphs: precomposed acciaccatura and appoggiatura,
stem up and down (U+E560–E563), and a standalone slash for each stem direction (U+E564–E565).

| | Bravura | Sebastian | Leipzig |
|---|---|---|---|
| E560–E565 present | ✅ | ✅ | ❌ **none** |
| grace head width ÷ `noteheadBlack` | 0.780 / 1.180 = **0.66** | 0.816 / 1.280 = **0.64** | — |
| head centre → stem tip in the precomposed glyph | **2.1 sp** | **2.3 sp** | — |
| standalone slash box | 2.02 × 1.604 sp (38°) | same | — |
| slash anchors (`graceNoteSlashSW/NE` on `flag8thUp`, `NW/SE` on `flag8thDown`) | ✅ **8th flags only** — SW [−0.644, −2.456], NE [1.284, −0.796] ⇒ 1.93 × 1.66 sp, 41° | ❌ | ❌ |

- ⭐⭐ **The precomposed glyphs are not the way, and SMuFL says so itself** (§D.4): *"Scoring
  applications should draw grace notes in the same way as they draw regular notes, rather than using
  the precomposed glyphs."* They are one fixed picture — an 8th, one head, no accidental, no ledger,
  unbeamable. Every engine composes from the parts at a scale; so does VexFlow.
- ⭐ **The slash is a drawn line in every case.** The anchors exist for the 8th flag in Bravura alone
  (nothing for 16th flags, nothing in the other two faces, nothing for a beamed group), so they are one
  sourced row where they apply and a stated angle + extent everywhere else.
- 🚨 Sebastian's precomposed grace glyphs report an **advance of 0.81 sp with ink reaching 1.86 sp** —
  harmless unstamped, wrong to space by.
- SMuFL's `engravingDefaults` has **no** grace/cue scale key (all 30 checked, §D.4).

### 0.6 ⭐ Free / unmeasured music — what the grace note shares with it, and what it does not

- Gould **p. 630** keeps *"conventional grace-note groups – to indicate playing a group as fast as
  possible"* inside proportional notation, drawn unchanged in Table 2, p. 631 (§C.12).
- Stone **p. 140**: grace notes are used *"in the traditional manner"* and *"belong to a main note"*,
  whereas unstemmed small heads are independent events; small unstemmed heads *"not recommended"*;
  p. 141's alternative is full-size heads under an extra slashed beam.
- ⭐ So the literature draws the line: a grace group is a gesture OWNED BY A NEIGHBOUR and borrows its
  time; free notation is gestures owned by nobody. Beside the fan (`docs/plans/fanned-beams-plan.md`,
  a gesture that OWNS its span) that makes three time relations — owns / borrows / has no metre — and
  what the three share is the picture: attacks that are not slots, drawn at a scale, spaced as unfixed
  ink of a column (`docs/plans/spacing-model-plan.md`, *FIXED vs UNFIXED*; LilyPond's
  `strict-grace-spacing` *"grace notes are put left of the musical columns for the main notes"*).
- Structurally reusable in VexFlow (§A.9): a Voice + Formatter nested inside a modifier, `ignoreTicks`
  on a tickable, and a width-only formatting pass.

### 0.7 UNKNOWN — checked, not found

- A grace note vs a **clef / key / meter change at the same point** — no book (Gould 43, 125–131; G&L
  52, 72–74; Ross 189–191; Stone 21–22, 46, 50–51); engines default to after the header signs.
- A grace before a **REST** — no book. ⭐ Built anyway (D7 reversed, his call 2026-09-22): the picture is our default.
- The **half-value** appoggiatura rule as a stated rule — no book.
- Grace **beam thickness** and **flag length** — Gould *"scaled down proportionally"* only.
- **Dorico / Sibelius / Finale `steal-time` behaviour** on MusicXML, and Dorico's default grace length.
- VexFlow: grace across a barline, grace + tuplet, a main-voice slur onto a grace, two groups at one
  tick in two voices — untested there.
- Gardner Read, *Music Notation* — not on disk.

### 0.8 ⭐ The slash, the stem and the ledger lines (Part E, 2026-09-22)

| question | books | engines | ⇒ for us |
|---|---|---|---|
| **where the slash sits** | ⭐ Gould (11 correct instances, stems 2.21–3.77 sp): measured from the **stem TIP**, not the head — crossing **1.05–1.17 sp below the tip**, ends ≈0.2 and ≈1.5 sp below it, ≈0.47 sp left / ≈1.05–1.2 sp right of the stem, **≈2.0 sp long at ≈40.5°**, thickness ≈ the stem's (§E.2 Q4) | MuseScore 1.4 sp below the tip → the flag's right edge, 40° (48° for 16th+ in Bravura, a "HACK"); Verovio fixed 45° from the flag top; LilyPond a glyph on the flag; SMuFL anchors on the 8th flag (Bravura, Petaluma — ⛔ not Leland) — §E.1 Q4 | the slash is a property of the stem's END — which is what the font's flag anchors encode too |
| **ledger lines** | ⭐ Gould p. 126: *"a sufficiently long stem for the diagonal stroke not to obscure a ledger line"* — her and/not pair: the stem grows (2.65 → 3.25 sp, tip from the E4 to the G4 line), **the slash keeps its place under the tip** and clears the C4 ledger by 0.36 sp; every correct low grace's tip reaches ≈ the G4 line. ⚠️ G&L p. 73 draws the forbidden case (A3, 2.15 sp stem, slash on the C4 ledger) | ⛔ **nobody implements it** — Verovio's flag-clears-the-first-ledger lengthening is the nearest (flagged notes only); MuseScore's grace stems reach the 2nd line from the outside; LilyPond, Verovio never extend | ⭐ lengthen the stem until the slash clears the nearest ledger — derived threshold (no book states it): tip ≥ ≈1.8 sp beyond the ledger nearest the staff; a grace ABOVE the staff never needs it (its ledgers are on the head's far side) |
| **staff lines** | ⛔ **not avoided**: in 8 of 11 correct instances a staff line runs through the slash, 3 cross the stem exactly on one. Only LEDGERS are protected — Gould p. 26, ledgers must be countable *"at a glance"* | nobody moves the slash for anything (VexFlow's FIXME) | no rule against a staff line |
| **a slashed QUARTER / half** | ⛔ **no book shows one**: Gould *"a small quaver"*, Stone *"notated as eighths"*, G&L *"considered eighth notes"* and p. 73 *"The slanted line is only for single, flagged grace notes"*; the only flagless slash anywhere is Stone p. 141's spatial-notation beam | MuseScore and Verovio draw one (MuseScore 0.924 sp below the tip, head-width wide); **LilyPond and Finale do not**; Dorico, Sibelius UNKNOWN | ⏳ his call — refuse it, draw it (MuseScore's), or make the acciaccatura an 8th |
| **stem length** | Stone ≈2½ sp; Gould's plate 2.21–3.77 (the long ones are the ledger cases) | MuseScore 2.45 · Verovio 2.625 · LilyPond 2.8 · VexFlow ≈2.33 sp | ours 2.5 sp — in the range |


### 0.9 ⭐⭐ The BRACKETED note — a head in round brackets, no stem, no flag (Parts G · H · I, 2026-09-23)

Sibelius's keypad calls it the guitar **"pre-bend note"**; the same drawing is how a trill says **which
note to trill to**. Three investigations the same day — **G** the four books on disk (scans read),
**H** the engines' source, **I** the shipping apps and the interchange formats online. Findings only;
⛔ nothing here is decided (the discussion of how we model it is not in this file).

| question | books (G) | engines (H) | apps + formats (I) |
|---|---|---|---|
| **is it a grace note?** | ⛔ **No** — Gould p. 139: *"Do not use a grace note for the trilling pitch; reserve grace notes for the starting and finishing notes of a trill."* No book names the form; each describes it (*"small notehead in brackets"*, *"small, stemless note-head in parentheses"*, *"cue-size notehead"*) | no engine has the kind: each composes **brackets on a head + no stem + a ROLE**. MuseScore's pre-bend IS a grace (stemless 8th appoggiatura, made a ghost note ⇒ bracketed); its trill note is NOT — a small chord owned by the `Ornament` | Dorico calls both an **"auxiliary note"** and makes neither a typed note: each is GENERATED from a property of its target (the note's *Pre-bend interval*, the trill's *Appearance → Auxiliary note*) |
| **which side of its note** | ⭐ **AFTER, in every use shown**: trilling pitch (Gould 139, Stone 75–76, G&L 154), bend target (Gould 378), glissando end (Gould 144, Stone 63), harmonic's sounding pitch (Gould 388, 421). 🚨 Gould's one pre-bend (p. 378b) has **no bracketed note** — a microtonal accidental and words | trill note AFTER (MuseScore, LilyPond `\pitchedTrill`, Finale's detector); MuseScore's pre-bend BEFORE | pre-bend BEFORE in every app; trill note AFTER (Gould, Dorico, LilyPond). Sibelius's own help (article 400, 2004): its pre-bend note as a trill note is *"not always ideal because they attach to the previous note"* |
| **what the brackets mean** | one idea: *this pitch is information, not an attack* — *"not separately articulated"* (Gould 144), *"merely mark the final pitches"* (Stone 63) | — | — |
| **does it sound** | not articulated (G.7) | never: MuseScore's pre-bend grace is unplayable (`chord.cpp:1393`), its trill note plays by the INTERVAL; LilyPond discards the pitch; Verovio's MIDI ignores the brackets | no app plays the bracketed head — the trill's interval or the bend sounds |
| **the head** | BLACK *"regardless of duration"* (Gould 418); size disagrees inside Gould: ≈0.75 (trill, p. 139) vs ≈0.65 (bend target, p. 378); G&L "cue-size"; Sibelius 60% | MuseScore 0.7, forced filled; LilyPond size −4 (0.63), `duration-log 2` | — |
| **the accidental** | **INSIDE** the brackets in every drawing (Gould 139, 144, 145, 378, 388, 421; Stone 76; G&L 154) | ⚠️ **SPLIT**: inside in MuseScore and LilyPond; OUTSIDE (head only) in Verovio and VexFlow | MusicXML cannot say — `<notehead parentheses>` and `<accidental parentheses>` are separate flags |
| **the brackets** | ≈2.0–2.1 sp tall, growing to enclose ledger lines (Gould 388); one pair PER HEAD — a chord is stacked pairs (Stone 76) | MuseScore: a DRAWN bezier sized from the heads ±0.25 sp, accidental and dots inside (gaps 0.3 / 0.15 sp); Verovio E26A/E26B hugging the head; VexFlow E0F5/E0F6 per key | SMuFL has no dedicated glyph: a notehead + E0F5/E0F6 (or E0CE) |
| **interchange** | — | MuseScore does not export its trill note, and imports no `<bend>` (an imported pre-bend arrives as a SOUNDING grace) | MusicXML: pre-bend = `<bend><pre-bend/>` on the MAIN note; a trill's interval only `trill-step` + `<accidental-mark>`; MEI `<trill>` keeps only the accidental; MNX nothing |

**The fonts we ship** (H.6, opentype.js): Bravura, Sebastian and Leipzig all carry E0F5/E0F6 and
E26A–E26D; ⚠️ **Leipzig lacks E0CE** (the one the Keypad's key draws); the precomposed bracketed
accidentals F5E0–F5E4 are Bravura's only.

**UNKNOWN** (G.8 · H.10 · I.8): a bracketed note BEFORE its note in any book · a bracketed note beside a
grace group at the same note · several heads inside ONE pair · tab conventions (no tab book on disk) ·
the pre-bend release · Guitar Pro / Notion on the staff · Dorico's pre-bend playback and export ·
Sibelius / Dorico source (none on disk).

---

## Part A — VexFlow 5.0.0 — grace notes (appoggiatura / acciaccatura), read from the source

**Sources.** All `file:line` references below are into the TypeScript source at
`/home/kiko/dev/engine-sources/vexflow/src/` (git HEAD `8879d09`, "Release VexFlow 5.0.0" — the
same version as `/home/kiko/dev/engine-sources/vexflow-5.0.0-npm/package`, which ships only the
compiled JS in `build/esm/src/gracenote.js` / `gracenotegroup.js`, so the TS line numbers are the
authoritative ones). Tests are `/home/kiko/dev/engine-sources/vexflow/tests/`.

**Units.** VexFlow's glyph sizes are POINTS: the root `fontSize: 30` (`metrics.ts:90`) is 30 pt; every
other number in this report is pixels at the library's default of `STAVE_LINE_DISTANCE = 10` px
(`tables.ts:360`), so 1 staff space = 10 px and I convert where useful. Where the source gives no
number, I write UNKNOWN.

---

### 1. Data model

**`GraceNote` is a `StaveNote` subclass** (`gracenote.ts:13`) with one extra struct field:

```ts
export interface GraceNoteStruct extends StaveNoteStruct { slash?: boolean; }   // gracenote.ts:9-11
```

Constructor (`gracenote.ts:25-37`):

```ts
super({ strokePx: GraceNote.LEDGER_LINE_OFFSET, ...noteStruct });   // LEDGER_LINE_OFFSET = 2 (:18-20; StaveNote's is 3, stavenote.ts:97-99)
this.slash = noteStruct.slash || false;
this.slur = true;          // never read anywhere in src (grep: only the assignment) — dead field
this.buildNoteHeads();
this.width = 3;            // overwritten by StaveNote.preFormat() before any formatting (stavenote.ts:889-912)
```

So a `GraceNote` has keys, a duration (any of the normal ones — tests use `'4'`, `'8'`, `'16'`, `'32'`,
`'64'`, `'128'`), a stem, a flag, optional beam, and can be a chord (`keys: ['e/4', 'g/4']`,
`tests/gracenote_tests.ts:72`; two-key chords throughout the `slash` test, `:335-345`). Stem direction
is whatever `StaveNoteStruct` gives: `autoStem`, or `stemDirection`, default `Stem.UP`
(`stavenote.ts:420-424`). There is no "acciaccatura vs appoggiatura" type — only the boolean `slash`.

**`GraceNoteGroup` is a `Modifier`** (`gracenotegroup.ts:30`), attached to the principal note with
`note.addModifier(group, 0)`; it owns the grace notes, a private `Voice`, a private `Formatter`, its
`Beam[]`, and the optional slur:

```ts
constructor(graceNotes: StemmableNote[], showSlur?: boolean) {        // gracenotegroup.ts:103-128
  this.position = Modifier.Position.LEFT;
  this.graceNotes = graceNotes;  this.width = 0;
  this.showSlur = showSlur;  this.slur = undefined;
  this.voice = new Voice({ numBeats: 4, beatValue: 4, resolution: Tables.RESOLUTION }).setStrict(false);
  this.renderOptions = { slurYShift: 0 };
  this.beams = [];
  this.voice.addTickables(this.graceNotes);
}
```

Options, complete list: `slash` (per note), `showSlur` (per group, ctor arg 2 / `Factory.GraceNoteGroup({notes, slur})`,
`factory.ts:322-324`), `beamNotes(subset?)` (per group, repeatable, `gracenotegroup.ts:141-153`),
`setPosition(LEFT | RIGHT)` (inherited `Modifier.setPosition`, `modifier.ts:148-152`),
`renderOptions.slurYShift` (`:119-121`). Stem length is not a group option; `setStemLength()` /
`stemExtensionOverride` is the inherited per-note one (`stemmablenote.ts:188-191`), and
`GraceNote.getStemExtension` tests it with a truthiness check (`gracenote.ts:40`) rather than
`!== undefined` (`stemmablenote.ts:174`), so an override of exactly 0 is ignored on a grace note.

**Is a grace note ever a tickable of the main voice?** Not by design: the group is a `Modifier`, not a
`Tickable`, so the host's `TickContext` never sees the grace notes — only the group's WIDTH via the
`ModifierContext` (§2). But nothing forbids it: `tests/percussion_tests.ts:223,234-235` add `f.GraceNote(...)`
directly to a strict 4/4 `Voice` as ordinary tickables (with duration `'4'`), where they simply
consume their ticks and draw as small notes with a tremolo. That is the only such use in the tests.

**Grace notes AFTER a note (Nachschlag).** Supported only as `group.setPosition(ModifierPosition.RIGHT)`
(`tests/gracenote_tests.ts:103`). `GraceNoteGroup.format` then adds the width to `state.rightShift`
instead of `leftShift` (`gracenotegroup.ts:97-98`), and `alignSubNotesWithNote` places the notes at a
fixed formula, `tickContext.getX() + spacingFromNextModifier × N + 10` (`modifier.ts:207-210`) — it
does not read the host's head width or its right-side modifiers. No slur variant for it, no test with a
slur on a RIGHT group. Grace notes "before the barline, belonging to the next bar" have no concept.

---

### 2. Timing / ticks and the width arithmetic

**Ticks.** A `GraceNote` carries the ordinary ticks of its duration: `Note`'s constructor calls
`setIntrinsicTicks(parsedNoteStruct.ticks)` (`note.ts:303`) from `Tables.durationToTicks`
(`note.ts:212`, `tables.ts:568-575`, `RESOLUTION = 16384`, `tables.ts:9`; so `'8'` = 2048, `'32'` = 512),
and `ignoreTicks = false` (`note.ts:316`). Those ticks are consumed ONLY by the group's own soft 4/4 voice
(`gracenotegroup.ts:113-117`; `Voice.addTickable` in SOFT mode never throws "Too many ticks",
`voice.ts:221-235`). They matter for two things inside the group: the beam levels
(`Beam.getBeamLines` compares `getIntrinsicTicks()` to the level's tick, `beam.ts:827,835-836`) and
nothing else — see the width arithmetic: the group's formatter is run with `justifyWidth = 0`, which
returns after pass 1, before any softmax (`formatter.ts:708`), so grace-note spacing inside the group
is purely width-driven, not duration-driven.

**The group formats itself with its own `Formatter`** (`gracenotegroup.ts:130-139`):

```ts
preFormat(): void {
  if (this.preFormatted) return;
  if (!this.formatter) this.formatter = new Formatter();
  this.formatter.joinVoices([this.voice]).format([this.voice], 0, {});
  this.setWidth(this.formatter.getMinTotalWidth());
  this.preFormatted = true;
}
```

`joinVoices` builds `ModifierContext`s for the grace notes (`formatter.ts:1048-1052` → `:575-618`), so a
grace note's own accidentals/dots are formatted in the grace note's own `ModifierContext` (§6).
`format(voices, 0)` builds `TickContext`s and runs `preFormat(0)` (`formatter.ts:1064-1084`), whose
pass 1 is (`formatter.ts:671-704`):

```ts
let x = 0, shift = 0; this.minTotalWidth = 0;
contextList.forEach((tick) => {
  const context = contextMap[tick]; context.preFormat();
  const width = context.getWidth();            // = context.width + padding*2, padding = 1  (tickcontext.ts:77,137-139)
  this.minTotalWidth += width;
  const metrics = context.getMetrics();
  x = x + shift + metrics.totalLeftPx;  context.setX(x);
  shift = width - metrics.totalLeftPx;
});
this.minTotalWidth = x + shift;                 // == Σ context.getWidth()
if (justifyWidth <= 0) return this.evaluate();  // :708 — no justification, no softmax
```

with `context.width = notePx + totalLeftPx + totalRightPx` (`tickcontext.ts:274`), `notePx` being the
note's width minus its modifier and displaced-head pixels (`note.ts:601-632`), and a `StaveNote`'s
width (`stavenote.ts:889-912`):

```ts
let noteHeadPadding = 0;
if (this.modifierContext) { this.modifierContext.preFormat();
  if (this.modifierContext.getWidth() === 0) noteHeadPadding = StaveNote.minNoteheadPadding; }   // 2 px
let width = this.getGlyphWidth() + this.leftDisplacedHeadPx + this.rightDisplacedHeadPx + noteHeadPadding;
if (this.shouldDrawFlag() && this.stemDirection === Stem.UP) width += this.getGlyphWidth();      // "TODO: Add flag width as a separate metric"
this.setWidth(width);
```

So **the width of one grace note** = its (scaled) head width, + another head width if it is an unbeamed
up-stem flagged note, + 2 px `minNoteheadPadding` if it has no modifiers (or its accidental's width if
it has one), + 2 px of `TickContext` padding (1 each side). The group's width is the sum over its
notes. Nothing in the group scales the paddings — the head width is the only thing that is 2/3.

**How the group's width feeds the host** — `GraceNoteGroup.format`, called from
`ModifierContext.preFormat` (`modifiercontext.ts:155`), transcribed (`gracenotegroup.ts:48-100`):

```ts
static format(gracenoteGroups: GraceNoteGroup[], state: ModifierContextState): boolean {
  const groupSpacingStave = 4;
  const groupSpacingTab = 0;
  if (!gracenoteGroups || gracenoteGroups.length === 0) return false;
  const groupList = []; let prevNote = null; let shift = 0;
  for (let i = 0; i < gracenoteGroups.length; ++i) {
    const gracenoteGroup = gracenoteGroups[i];
    const note = gracenoteGroup.getNote();
    const isStavenote = isStaveNote(note);
    const spacing = isStavenote ? groupSpacingStave : groupSpacingTab;
    if (isStavenote && note !== prevNote) {
      for (let n = 0; n < note.keys.length; ++n) shift = Math.max(note.getLeftDisplacedHeadPx(), shift);
      prevNote = note;
    }
    groupList.push({ shift: shift, gracenoteGroup, spacing });
  }
  let groupShift = groupList[0].shift;            // the host chord's left-displaced head, if any
  let formatWidth; let right = false; let left = false;
  for (let i = 0; i < groupList.length; ++i) {
    const gracenoteGroup = groupList[i].gracenoteGroup;
    if (gracenoteGroup.position === Modifier.Position.RIGHT) right = true; else left = true;
    gracenoteGroup.preFormat();
    formatWidth = gracenoteGroup.getWidth() + groupList[i].spacing;      // minTotalWidth + 2 + 4
    groupShift = Math.max(formatWidth, groupShift);
  }
  for (let i = 0; i < groupList.length; ++i) {
    const gracenoteGroup = groupList[i].gracenoteGroup;
    formatWidth = gracenoteGroup.getWidth() + groupList[i].spacing;
    gracenoteGroup.setSpacingFromNextModifier(groupShift - Math.min(formatWidth, groupShift) + StaveNote.minNoteheadPadding);
  }
  if (right) state.rightShift += groupShift;
  if (left) state.leftShift += groupShift;
  return true;
}
getWidth(): number { return this.width + StaveNote.minNoteheadPadding; }   // :160-162 — minTotalWidth + 2
```

Constants: `groupSpacingStave = 4` px (the air between the group and whatever stands inside it);
`groupSpacingTab = 0`; `StaveNote.minNoteheadPadding = Metrics 'NoteHead.minPadding' = 2` px
(`stavenote.ts:101-103`, `metrics.ts:140-142`). For one group on a note with nothing displaced:
`leftShift += minTotalWidth + 6` and `spacingFromNextModifier = 2`. Several groups at one tick (different
voices) all reserve the same `groupShift` and each gets an extra `spacingFromNextModifier` so that a
narrower group is right-aligned to the widest one. The host's `TickContext` then folds
`leftShift` into `modLeftPx` → `totalLeftPx` (`note.ts:606`, `tickcontext.ts:266-274`), and the main
formatter's pass 1 sets the host's x to `x + shift + totalLeftPx` (`formatter.ts:691`), i.e. the host
moves right by the group's width and the tick context's width grows by it; a grace group before the
first note of a bar simply pushes that note right of the signs (same line, `x` starts at 0).

**Where the grace notes actually land** — at draw time, `GraceNoteGroup.draw` calls
`alignSubNotesWithNote` (`gracenotegroup.ts:175`; `modifier.ts:202-216`):

```ts
alignSubNotesWithNote(subNotes: Note[], note: Note, position = Modifier.Position.LEFT): void {
  const tickContext = note.getTickContext();
  const metrics = tickContext.getMetrics();
  const stave = note.getStave();
  const subNoteXOffset =
    position === Modifier.Position.RIGHT
      ? tickContext.getX() + this.getSpacingFromNextModifier() * subNotes.length + 10
      : tickContext.getX() - metrics.modLeftPx - metrics.modRightPx + this.getSpacingFromNextModifier();
  subNotes.forEach((subNote) => {
    const subTickContext = subNote.getTickContext();
    if (stave) subNote.setStave(stave);
    subTickContext.setXOffset(subNoteXOffset); // don't touch baseX to avoid shift each render
  });
}
```

So the group's x = host tick x − (ALL of the host's left modifier pixels) − (its RIGHT modifier pixels
too — `modRightPx` is subtracted although the group stands on the left; a quirk, not commented) + 2;
each grace note keeps the x its own formatter gave it (from 0) as `xBase` and gets this as `xOffset`
(`tickcontext.ts:119-135` — the base/offset split exists precisely so a redraw does not creep;
`tests/gracenote_tests.ts:484-548` "Multiple Draws" draws twice). The group's `spacing` of 4 px and
its `getWidth()`'s +2 are reserved in `leftShift` but the notes start 2 px in from the outer edge, so the
gap between the LAST grace note's tick context and the host's next-inner modifier (accidental) or head
is the remaining 4 px + the last grace's own trailing tick padding (1 px) + its `minNoteheadPadding` (2 px,
if it had no modifiers). No constant names "the gap to the principal note" as such.

---

### 3. Drawing: size, stem, slash

**Smaller size = a font scale on the element's category, not a separate glyph set.** Every `Element` reads
`Metrics.get('<Category>.fontScale')` in its constructor (`element.ts:155-157`) and `Metrics.getFontInfo`
multiplies `fontSize × fontScale` (`metrics.ts:25`). The table (`metrics.ts:88-93,132-138`):

```ts
fontFamily: 'Bravura,Academico', fontSize: 30, fontScale: 1.0,
GraceNote:    { fontScale: 2 / 3 },
GraceTabNote: { fontScale: 2 / 3 },
```

so a `GraceNote`'s `fontInfo.size` is 30 × 2/3 = **20 pt**, and its heads and flag inherit that font
object: `notehead.fontInfo = this.fontInfo` (`stavenote.ts:519`), `this.flag.fontInfo = this.fontInfo`
(`stemmablenote.ts:67`). Head width is then measured from the text in that font (`element.ts:517-520,
608-620`), so every width in §2 is 2/3 of a normal head. The head glyphs are the ordinary
`noteheadBlack` etc. — the SMuFL grace-note glyphs `graceNoteAcciaccaturaStemUp/Down`,
`graceNoteAppoggiaturaStemUp/Down`, `graceNoteSlashStemUp/Down` are declared (`glyphs.ts:2340-2351`)
but referenced nowhere else in `src/` (grep). The stem is NOT scaled in thickness: `Stem.WIDTH =
Tables.STEM_WIDTH = 1.5` px is used verbatim (`stem.ts:52-53,215`; `tables.ts:293`). The
`tests/gracenote_tests.ts:6` TODO records that with Petaluma the heads "are not scaled down properly".

**Stem length.** `Stem.HEIGHT = Tables.STEM_HEIGHT = 35` px = 3.5 spaces (`stem.ts:55-57`, `tables.ts:294`).
A stem's length is `Stem.HEIGHT + extension` (`stemmablenote.ts:81-83`, `stem.ts:154`), and `GraceNote`
overrides the extension (`gracenote.ts:39-47`):

```ts
getStemExtension(): number {
  if (this.stemExtensionOverride) return this.stemExtensionOverride;
  let ret = super.getStemExtension();
  ret = Stem.HEIGHT * this.getFontScale() - Stem.HEIGHT + ret;   // = ret − 35/3 = ret − 11.667 px
  return ret;
}
```

so a grace stem is **35 × 2/3 = 23.33 px (2.33 spaces) + the inherited extension**, where the inherited
`StemmableNote.getStemExtension` is already scale-aware (`stemmablenote.ts:169-185`): with a beam,
`glyphProps.stemBeamExtension * scale`; otherwise `flagHeight > Stem.HEIGHT*scale ? flagHeight −
Stem.HEIGHT*scale : 0` (the flag, being a 20 pt glyph, is measured); and `StaveNote.getStemExtension`
adds the unscaled "more than an octave from the middle line" rule on top (`stavenote.ts:1146-1182`:
`linesOverOctaveFromMidLine × spacingBetweenLines`, 10 px per line, only when the stem direction is
the automatic one). Default stem direction: `Stem.UP` unless `autoStem` or `stemDirection` is given
(`stavenote.ts:420-424`); `beamNotes` does not auto-stem (`new Beam(graceNotes)` with `autoStem`
defaulting to `false`, `beam.ts:451`).

**The acciaccatura slash** is a stroked line drawn by `GraceNote.draw` after `super.draw()`
(`gracenote.ts:49-104`), only when `this.slash && stem`. Two cases.

*Unbeamed* (`:68-91`), with `scale = 2/3`, `w = noteHeads[0].getWidth()` (the scaled head width):

```ts
const x = stemDirection === Stem.DOWN ? this.getAbsoluteX() : this.getAbsoluteX() + noteHeadWidth;  // the stem's side of the head
const defaultOffsetY = (Tables.STEM_HEIGHT * scale) / 2;                                              // 35 × 2/3 / 2 = 11.667 px
const y = stemDirection === Stem.DOWN ? noteHeadBounds.yBottom + defaultOffsetY : noteHeadBounds.yTop - defaultOffsetY;
// stem DOWN: (x − w, y − w) → (x + w, y + w)      stem UP: (x − w, y + w) → (x + w, y − w)
```

i.e. a 45° line, horizontal extent 2w centred on the stem's x, crossing the stem at half the scaled
stem height (11.667 px) from the outer head; for an up-stem it rises left-to-right, for a down-stem it
falls left-to-right (mirror). Line width `1 × scale = 0.667` px (`:97`, "FIXME: use more appropriate
value"). It is drawn regardless of the flag, ledger lines or accidentals ("FIXME: avoid staff lines,
ledger lines or others.", `:94`).

*Beamed* (`:58-67`, `:106-143`): `calcBeamedNotesSlashBBox(8*scale, 8*scale, { stem: 6*scale, beam: 5*scale })`,
i.e. `slashStemOffset = 5.333` px, `slashBeamOffset = 5.333` px, protrusions `stem = 4` px, `beam = 3.333` px:

```ts
const beamSlope = beam.slope;
const isBeamEndNote = beam.notes[beam.notes.length - 1] === this;
const scaleX = isBeamEndNote ? -1 : 1;                       // the slash leans INTO the group; on the last note it flips
const beamAngle = Math.atan(beamSlope * scaleX);
const iPointOnBeam = { dx: Math.cos(beamAngle) * slashBeamOffset, dy: Math.sin(beamAngle) * slashBeamOffset };  // point on the beam 5.33 px along it
slashStemOffset *= this.getStemDirection();                  // point on the stem 5.33 px from the beam
const slashAngle = Math.atan((iPointOnBeam.dy - slashStemOffset) / iPointOnBeam.dx);
const protrusionStemDeltaX = Math.cos(slashAngle) * protrusions.stem * scaleX;  const protrusionStemDeltaY = Math.sin(slashAngle) * protrusions.stem;
const protrusionBeamDeltaX = Math.cos(slashAngle) * protrusions.beam * scaleX;  const protrusionBeamDeltaY = Math.sin(slashAngle) * protrusions.beam;
const stemX = this.getStemX();  const stem0X = beam.notes[0].getStemX();
const stemY = beam.getBeamYToDraw() + (stemX - stem0X) * beamSlope;              // the beam's y at this stem
return { x1: stemX - protrusionStemDeltaX,                 y1: stemY + slashStemOffset - protrusionStemDeltaY,
         x2: stemX + iPointOnBeam.dx * scaleX + protrusionBeamDeltaX, y2: stemY + iPointOnBeam.dy + protrusionBeamDeltaY };
```

So on a beamed group the slash is a short line from a point on the stem 5.33 px inside the beam to a
point on the beam 5.33 px along it (a ~45° cut across the stem/beam corner, tilted with the beam), extended
4 px past the stem and 3.33 px past the beam. It is per-note: every grace note with `slash: true` draws
one, and the tests put it on the first note of each beamed pair only (`tests/gracenote_tests.ts:385-392`).
The beam is forced through `postFormat()` first (`:60-62`, "FIXME: should render slash after beam?").

---

### 4. Beaming

```ts
beamNotes(graceNotes?: StemmableNote[]): this {          // gracenotegroup.ts:141-153
  graceNotes = graceNotes || this.graceNotes;
  if (graceNotes.length > 1) {
    const beam = new Beam(graceNotes);
    beam.renderOptions.beamWidth = 3;                    // normal default 5   (beam.ts:501)
    beam.renderOptions.partialBeamLength = 4;            // normal default 10  (beam.ts:508)
    this.beams.push(beam);
  }
  return this;
}
```

An explicit `Beam` over the given notes (all of them by default, or a subset — callable repeatedly for
several beams inside one group, `tests/gracenote_tests.ts:304,356,402`); `Beam.generateBeams` is not used
for grace groups (`generateBeams` itself skips `shouldIgnoreTicks()` tickables, `beam.ts:235-239` — not
relevant to grace notes, whose ticks are real). Everything else is the ordinary `Beam`: slope search
between ±0.25 in 20 steps (`beam.ts:502-504,571-630`), secondary beams 1.5 × beamWidth apart
(`beam.ts:956`: `beamY += beamThickness * 1.5`, so 4.5 px pitch for grace beams vs 7.5), stems extended
into the beam by `applyStemExtensions` (`beam.ts:715-763`), the beam drawn by the group's `draw`
(`gracenotegroup.ts:180`) after the notes. A single-note "group" gets no beam and keeps its flag
(`length > 1` guard). Beam thickness 3 px = 0.3 space (vs 0.5 space normal); partial (fractional) beam
4 px (vs 10 px).

---

### 5. Slurs and ties

`showSlur` draws one tie-shaped curve **from the group's FIRST grace note to the host**, created anew on
every `draw` (`gracenotegroup.ts:182-197`):

```ts
if (this.showSlur) {
  const isStavenote = isStaveNote(note);
  const TieClass = isStavenote ? StaveTie : TabTie;
  this.slur = new TieClass({ lastNote: this.graceNotes[0], firstNote: note, firstIndexes: [0], lastIndexes: [0] });
  this.slur.renderOptions.cp2 = 12;
  this.slur.renderOptions.yShift = (isStavenote ? 7 : 5) + this.renderOptions.slurYShift;
  this.slur.setContext(ctx).drawWithStyle();
}
```

Note the deliberate swap: `firstNote` = the HOST, `lastNote` = the first grace note, so `getFirstX()` =
`host.getTieRightX()` and `getLastX()` = `grace0.getTieLeftX()` (`stavetie.ts:206-228`) and the curve is
drawn "backwards" from right of the host to left of the first grace note — a slur over the whole group,
always index 0 of each chord. `cp2 = 12` px equals `StaveTie`'s own default (`cp1: 8, cp2: 12,
shortTieCutoff: 10, cp1Short: 2, cp2Short: 8, yShift: 7, tieSpacing: 0`, `stavetie.ts:60-71`), so the
only real change is `yShift` (7 px stave / 5 px tab, plus the group's `slurYShift`). The curve's side
comes from `StaveTie.getDirection()`, which prefers `lastNote.getStemDirection()` (`stavetie.ts:81-82`)
— i.e. the FIRST GRACE NOTE's stem: stems up ⇒ `direction = 1` ⇒ curve below the heads.

**Where a tie/slur finds a grace note's x.** `StaveNote.getTieRightX / getTieLeftX` (`stavenote.ts:725-737`):

```ts
getTieRightX() { let x = this.getAbsoluteX(); x += this.getGlyphWidth() + this.xShift + this.rightDisplacedHeadPx;
                 if (this.modifierContext) x += this.modifierContext.getRightShift(); return x; }
getTieLeftX()  { let x = this.getAbsoluteX(); x += this.xShift - this.leftDisplacedHeadPx; return x; }
```

`getAbsoluteX()` is the grace note's own `TickContext.getX()` = `xBase (from the group's formatter) +
xOffset (set by alignSubNotesWithNote at the group's draw)`. So a grace note's x is only meaningful after
its group has been drawn once. **Can a main-voice slur/tie start on a grace note?** Nothing in the
source forbids constructing a `StaveTie`/`Curve` with a grace note as an endpoint (they only need
`getTieLeftX/RightX`, `getYs`, `getStemDirection`), but no test does it, and it would have to be drawn
after the host note: UNKNOWN whether it renders correctly. The only test with a curve near a grace note
(`tests/demo_petzold_tests.ts:183-200`) attaches the `Curve` to the host (`m8c`), not the grace.

---

### 6. Accidentals, dots and other modifiers ON a grace note

A grace note is a `StaveNote`, so `graceNote.addModifier(f.Accidental(...), 0)` works
(`tests/gracenote_tests.ts:83-85,188-191`). Those modifiers are laid out in **the grace note's own
`ModifierContext`**, created by the group's `formatter.joinVoices([voice])` (`gracenotegroup.ts:136` →
`formatter.ts:1048-1052,575-618`), and their width flows into the grace note's width and so into the
group's `minTotalWidth` (§2). Specifics:

- **Accidental**: rendered smaller — `Accidental.reset()` sets `fontInfo.size = Metrics.get('Accidental.grace.fontSize')`
  = **20 pt** when `isGraceNote(this.note)` (`accidental.ts:536-539`; row at `metrics.ts:99-101`), and
  `setNote` re-runs `reset()` (`accidental.ts:543-549`) so it applies once attached. The gaps are the
  normal, unscaled rows: `noteheadAccidentalPadding: 1, leftPadding: 2, accidentalSpacing: 3` px
  (`metrics.ts:102-104`). `Accidental.applyAccidentals` recurses into every `GraceNoteGroup` of a note
  (`accidental.ts:493-497`; changelog 1.2.84, `changelog/CHANGELOG.md:48`) so automatic accidentals
  reach grace notes.
- **Dot**: `Dot.buildAndAttach([grace], { all: true })` works (`tests/gracenote_tests.ts:85`).
  🚨 **CORRECTED 2026-09-22 (Part F.1):** this line used to say the dot is drawn full size. It is NOT —
  `Dot.setNote` copies the note's font (`this.font = note.font`, `dot.ts:140-144`; 5.0.0 `dot.js:106-110`)
  and a `GraceNote`'s font is 30 × 2/3 = 20 pt, re-measured at that size. What stays full size are its
  two GAPS — the literal 2 px head→dot and 1 px dot→dot (`stavenote.js:531`, `dot.js:32, 92`).
- **Articulation / annotation**: `articulation.ts:66-150` treats `GraceNote` exactly like `StaveNote`
  for its top/bottom y (`isStaveOrGraceNote`); no scaling.
- **Tremolo**: scaled — `ySpacing = Tremolo.spacing(7) × stemDirection × scale`, `fontInfo.size =
  Tremolo.fontSize × scale` (`tremolo.ts:37-44`, `metrics.ts:265-267`).
- **Ledger lines**: the ordinary `drawLedgerLines` with the grace's `strokePx = 2` (vs 3) each side of
  the head (`stavenote.ts:1005-1046`, `gracenote.ts:18-20,27`).

---

### 7. Order in the host's ModifierContext

`ModifierContext.preFormat` (`modifiercontext.ts:141-168`) — "The ordering below determines when
different members are formatted and rendered":

```ts
StaveNote.format(...)        // multi-voice head displacement first
Parenthesis.format(...)
Dot.format(...)
FretHandFinger.format(...)
Accidental.format(...)
Stroke.format(...)
GraceNoteGroup.format(...)   // ← :155
NoteSubGroup.format(...)
StringNumber.format(...)
Articulation.format(...)
Ornament.format(...)
Annotation.format(...)
ChordSymbol.format(...)
Bend.format(...)
Vibrato.format(...)
this.width = state.leftShift + state.rightShift;
```

Each `format` adds its width to the running `state.leftShift` / `rightShift`, and each LEFT modifier
is later drawn at `−(the leftShift when it was formatted)`; so for LEFT-side members, **earlier in
the list = closer to the head**: accidentals and strokes (arpeggio lines) stand between the head and
the grace group; a clef/time-signature `NoteSubGroup` stands OUTSIDE the grace group (further left).
The category list itself is `typeguard.ts:69-130` (alphabetical; it is not the order — the order is
this function). The grace group's draw is triggered from `StaveNote.drawModifiers` per notehead index
(`stavenote.ts:1070-1081`, called from `NoteHead.draw`, `notehead.ts:159`), after the host's ledger
lines, stem and heads (`stavenote.ts:1208-1212`).

---

### 8. Limitations, TODOs, quirks visible in the source

1. `gracenote.ts:59` `// FIXME: should render slash after beam?` — the note forces `beam.postFormat()` to draw its slash.
2. `gracenote.ts:94` `// FIXME: avoid staff lines, ledger lines or others.` — the slash ignores collisions.
3. `gracenote.ts:97` `// FIXME: use more appropriate value.` — slash stroke width `1 × scale`.
4. `tests/gracenote_tests.ts:6` TODO: Petaluma heads not scaled properly.
5. `modifier.ts:207-210`: the RIGHT (Nachschlag) placement is `x + 2·N + 10` px, blind to the host's head/modifiers; the LEFT placement subtracts `modRightPx` as well as `modLeftPx`.
6. `gracenote.ts:40` truthy test on `stemExtensionOverride` (an override of 0 is ignored) vs `stemmablenote.ts:174`.
7. `gracenote.ts:32` `this.slur = true` is never read.
8. `gracenote.ts:36` `this.width = 3` is overwritten by `preFormat`.
9. The group's internal spacing ignores duration (formatter run with `justifyWidth 0`, `formatter.ts:708`); its ticks serve only the beam levels.
10. Slur: one shape only (first grace → host, chord index 0, side from the first grace's stem); no slur for RIGHT groups; recreated every draw.
11. Dots on grace notes are drawn at the grace's size (🚨 corrected 2026-09-22, Part F.1 — this said full
    size), but their 2 px / 1 px GAPS are literals, unscaled; stems keep full thickness (1.5 px).
12. Grace across a barline / grace before the barline belonging to the next bar: no concept — a group is a left modifier of ONE host; the only "after" form is `Position.RIGHT`. Untested: UNKNOWN how it interacts with the end-of-bar justification.
13. Grace before the first note of a bar: nothing special — the first tick context is placed at `totalLeftPx` (`formatter.ts:691`), so the group sits between the signs and the note. Tests do this in every block (`stem`, `slash`, `slashWithBeams`).
14. Grace notes in chords: yes (grace chords), and on chord hosts: the group's `shift` takes the host's `getLeftDisplacedHeadPx()` (`gracenotegroup.ts:64-70`), i.e. a displaced host head pushes the group out.
15. Multi-voice: groups from several voices at one tick are right-aligned to the widest (`gracenotegroup.ts:80-95`); tested in `multipleVoices` (`tests/gracenote_tests.ts:419-482`) with groups in two voices at different ticks. Different groups at the SAME tick in two voices: UNKNOWN (not tested).
16. Grace + tuplet: no code path; a `Tuplet` over grace notes is UNKNOWN (untested).
17. A `GraceNote` added to a main voice as a tickable consumes its ticks (`tests/percussion_tests.ts:220-238`).

---

### 9. Structurally interesting for "no time, but width" (free / unmeasured music)

- **The nested-formatter pattern.** A `Modifier` that owns a `Voice` + `Formatter`, formats its notes
  with `justifyWidth = 0` (pure width, no rhythm), reports `getMinTotalWidth()` as its width into the
  host's `ModifierContext` (`leftShift`), and at draw time offsets every sub-note's `TickContext` by
  the host's x (`alignSubNotesWithNote`). `NoteSubGroup` (`notesubgroup.ts`) is the same mechanism
  with no spacing constants at all (`width += group.getWidth()`, `state.leftShift += width`,
  `:25-37`) — used for mid-bar `ClefNote` / `TimeSigNote` / `BarNote` (`:8`). Two things make it
  restartable: the `xBase`/`xOffset` split on `TickContext` (`tickcontext.ts:79-80,119-135`) and the
  `preFormatted` guard.
- **`ignoreTicks`** on `Tickable` (`tickable.ts:40,112-120`): a tickable in the MAIN voice that takes no
  rhythmic time but has width — set by `BarNote`, `ClefNote`, `TimeSigNote`, `KeySigNote`
  (`barnote.ts:53`, `clefnote.ts:21`, `timesignote.ts:23`, `keysignote.ts:22`). `Voice.addTickable`
  skips its ticks (`voice.ts:221-235`), `TickContext.addTickable` skips it for min/max ticks
  (`tickcontext.ts:223-238`, "this can remain null if all tickables have ignoreTicks", `:74`),
  `Beam.generateBeams` breaks a group on it (`beam.ts:235-239`), rest alignment skips it
  (`formatter.ts:144`). Its width still enters the tick context and pass 1 (`formatter.ts:677-696`).
  ⚠️ In justification, a zero-tick context's softmax share is `softmaxFactor ** 0 = 1`
  (`formatter.ts:701`), so it is NOT zero — a reading of the arithmetic, not a tested claim.
- **Soft voices** (`Voice.setStrict(false)`, `voice.ts:167-170`): tick totals unconstrained — the
  grace group's own voice is one; every grace test's main voice is one too.
- **Pass 1 of `Formatter.preFormat` is a width-only layout** (`formatter.ts:671-704`): with
  `justifyWidth ≤ 0` the result is the minimal, duration-blind spacing — what an unmeasured passage
  wants before any stretch.
- **`GhostNote`** (`ghostnote.ts`) is the inverse: ticks but `setWidth(0)` and no `ModifierContext`
  (`:37,54-57`) — time without ink.
- **Category-keyed font scale** (`metrics.ts:132-138`, `element.ts:155-157`): "small" is a property of
  the element's category, inherited by the parts the note builds (heads, flag) through a shared
  `fontInfo` object — one number, `2/3`, and everything glyph-derived follows; everything that is a
  pixel constant (stem width, paddings, tick padding, accidental gaps, dots) does not.

---

### The VexFlow approach in one paragraph

A grace note is an ordinary `StaveNote` whose category carries `fontScale = 2/3`, so its heads and flag
are 20 pt glyphs instead of 30 pt, its stem is 2/3 of the 35 px default plus the usual extensions, its
ledger lines reach 2 px instead of 3, and its accidentals drop to 20 pt — while stem thickness,
paddings and dots stay full size. The grace notes never enter the principal voice: they live in a
`GraceNoteGroup`, a `Modifier` attached to the host note, which owns a soft 4/4 `Voice` and a private
`Formatter`, formats them with `justifyWidth 0` (pure width, their real ticks serving only the beam
levels), and reports `minTotalWidth + 2 + 4` px into the host's `ModifierContext.leftShift` between the
accidentals (inside) and any clef/meter `NoteSubGroup` (outside). At draw time the group offsets every
grace note's `TickContext` by the host's x minus its modifier pixels, draws the notes, then its beams
(3 px thick, 4 px partials), then — if asked — one tie-shaped slur from the first grace note to the host
(yShift 7). The acciaccatura slash is a hand-drawn 45° stroke through the stem at half the scaled stem
height, or a short cut across the stem/beam corner on beamed groups, ignoring collisions. Grace notes
after a note exist only as `Position.RIGHT` with a fixed `+10` px formula; grace across a barline,
grace + tuplet, and slurs from the main voice onto a grace note are untested (UNKNOWN).

### Constants (value · unit · source)

| Constant | Value | Where |
|---|---|---|
| root `fontSize` | 30 pt | `metrics.ts:90` |
| `GraceNote.fontScale`, `GraceTabNote.fontScale` | 2/3 (⇒ 20 pt) | `metrics.ts:132-138` |
| `Accidental.grace.fontSize` | 20 pt (cautionary also 20) | `metrics.ts:96-101` |
| `Tables.STEM_HEIGHT` / `Stem.HEIGHT` | 35 px = 3.5 sp; grace stem = 23.33 px + extension | `tables.ts:294`, `gracenote.ts:45` |
| `Tables.STEM_WIDTH` / `Stem.WIDTH` | 1.5 px, unscaled | `tables.ts:293`, `stem.ts:215` |
| `GraceNote.LEDGER_LINE_OFFSET` (`strokePx`) | 2 px (StaveNote: 3) | `gracenote.ts:18-20`, `stavenote.ts:97-99` |
| `groupSpacingStave` / `groupSpacingTab` | 4 px / 0 px | `gracenotegroup.ts:49-50` |
| `StaveNote.minNoteheadPadding` (= `NoteHead.minPadding`) | 2 px | `stavenote.ts:101-103`, `metrics.ts:140-142` |
| `TickContext.padding` | 1 px each side | `tickcontext.ts:77,137-139` |
| grace beam `beamWidth` / `partialBeamLength` | 3 px / 4 px (normal 5 / 10) | `gracenotegroup.ts:146-147`, `beam.ts:501,508` |
| secondary-beam pitch | 1.5 × beamWidth (= 4.5 px for grace) | `beam.ts:956` |
| slur `cp2` / `yShift` | 12 px / 7 px stave, 5 px tab (+ `slurYShift`) | `gracenotegroup.ts:194-195` |
| `StaveTie` defaults | cp1 8, cp2 12, shortTieCutoff 10, cp1Short 2, cp2Short 8, yShift 7, tieSpacing 0 | `stavetie.ts:60-71` |
| unbeamed slash | crosses the stem at `35 × 2/3 / 2 = 11.667` px; extent ±head width; 45°; stroke `1 × 2/3` px | `gracenote.ts:71-91,97` |
| beamed slash | stem offset 8×2/3 = 5.333 px, beam offset 5.333 px, protrusions stem 4 px, beam 3.333 px | `gracenote.ts:64-67` |
| RIGHT (Nachschlag) placement | host x + 2·N + 10 px | `modifier.ts:207-209` |
| group voice | 4/4, `RESOLUTION 16384`, SOFT | `gracenotegroup.ts:113-117`, `tables.ts:9` |
| `Tremolo.spacing` | 7 px × scale on a grace | `metrics.ts:265-267`, `tremolo.ts:38` |
| `Accidental` gaps (unscaled) | noteheadAccidentalPadding 1, leftPadding 2, accidentalSpacing 3 px | `metrics.ts:102-104` |
| `GraceTabNote.renderOptions.yShift` | 0.3 | `gracetabnote.ts:22-26` |

---

## Part B — Grace notes in three engraving engines — LilyPond, Verovio, MuseScore

Research date 2026-09-22. Sources are the trees under `/home/kiko/dev/engine-sources/`
(`lilypond`, `verovio`, `MuseScore`); every claim carries a `file:line`. Where a source does not
say, the answer is **UNKNOWN**. Read-only: nothing in the editor was touched.

Units: LilyPond distances are in **staff spaces** unless said otherwise; font sizes are
`magstep` steps (`scm/lily-library.scm:1718` — `magstep s = 2^(s/6)`, so `-3` = 0.707×, `-4` = 0.63×).
Verovio's `m_unit` is **half a staff space** (MEI "unit"). MuseScore's `sp` is a staff space.

---

### 1. LilyPond

#### 1.1 Data model — a grace note is a FIRST-CLASS event at a NEGATIVE grace moment

- Grace notes are ordinary notes wrapped in `GraceMusic` (`scm/define-music-types.scm:313-318`):
  ```
  (GraceMusic
   . ((description . "Interpret the argument as grace notes.")
      (start-callback . ,ly:grace-music::start-callback)
      (iterator-ctor . ,ly:grace-iterator::constructor)
      (types . (grace-music music-wrapper-music))
  ```
  The wrapper does NOT change the notes: it changes WHEN they happen. Its start callback puts the
  whole group before its main moment (`lily/grace-music.cc:32-36`):
  ```cpp
  Moment *l = unsmob<Moment> (Music_wrapper::length_callback (m));
  return to_scm (Moment (0, -(l->main_part_ + l->grace_part_)));
  ```
  i.e. `\grace { b16 c16 }` (written length 1/8) STARTS at `(0, -1/8)` and its length is
  reported as zero main time — `start-callback` is documented as "Function to compute the
  negative length of starting grace notes" (`scm/define-music-properties.scm:209`), and `length`
  "does not account for any initial grace notes: the full length of the music is `length` minus
  the start time" (`:124-128`).
- Written duration is kept as the note's normal `duration`; the iterator moves it from the main
  part into the grace part when now is a grace moment (`lily/translator.cc:233-243`):
  ```cpp
  auto len = get_event_length (e);
  if (now.grace_part_) { len.grace_part_ = len.main_part_; len.main_part_ = Rational (0); }
  ```
  and a note's end moment is computed accordingly (`lily/context.cc:963-965`): if
  `now.grace_part_ < 0` the end is `(main, grace + dur)`, else `(main + dur, 0)`.
- Before vs after: there is no "after" flag. `\afterGrace` is sugar that places a `GraceMusic`
  after a *skip* of a fraction of the main note inside a simultaneous
  (`ly/music-functions-init.ly:94-120`):
  ```
  afterGraceFraction = 3/4
  afterGrace = #(define-music-function (fraction main grace) ((scale?) ly:music? ly:music?)
     ... (delta (* factor (ly:moment-main (ly:music-length main))))
         (grace-music (make-music 'GraceMusic 'element grace)))
     (if (> factor 1) (ly:warning (G_ "\\afterGrace exceeds duration of main argument.")))
     #{ \context Bottom << #main { \skip 1*$delta #grace-music } >> #}
  ```
  So a Nachschlag is a grace group standing at `(t_main + 3/4·dur, -len)` — before the NEXT
  main moment in the ordering, not attached to the previous note.
- Acciaccatura vs appoggiatura vs plain vs slashed: NOT a note property. Each is the same
  `GraceMusic` wrapper with different start/stop music spliced around the group by
  `def-grace-function` (`scm/music-functions.scm:1275-1288`), the four pairs in `ly/grace-init.ly:25-58`:
  ```
  startGraceMusic = { }                       stopGraceMusic = { }
  startAppoggiaturaMusic = { <>\startGraceSlur }
  stopAppoggiaturaMusic  = { <>\stopGraceSlur }
  startAcciaccaturaMusic = { <>\startGraceSlur
      \temporary \override Flag.stroke-style = "grace" }
  stopAcciaccaturaMusic  = { \revert Flag.stroke-style  <>\stopGraceSlur }
  startSlashedGraceMusic = { \temporary \override Beam.stencil = #beam::slashed-stencil
      \temporary \override Flag.stroke-style = "grace" }
  stopSlashedGraceMusic  = { \revert Beam.stencil  \revert Flag.stroke-style }
  ```
  `\slashedGrace` "produces slashes through stems, but no slur" (`ly/music-functions-init.ly:2421-2425`).
  The NR (`Documentation/en/notation/rhythms.itely:4627-4635`): "the *acciaccatura* -- an unmeasured
  grace note indicated by a slurred note with a slashed stem -- and the *appoggiatura*, which
  takes a fixed fraction of the main note it is attached to and prints without the slash."
- Everything else that makes a grace look like a grace (size, stem direction, beam thickness…)
  is a CONTEXT PROPERTY LIST, `graceSettings`, pushed by `Grace_engraver` when the current moment
  gains a grace part and popped when it loses it (`lily/grace-engraver.cc:186-234`), with the
  `GraceChange` stream event from the iterator (`lily/grace-iterator.cc:64-76`) so that
  `\stemNeutral \grace {…` and `\grace { \stemNeutral …` can be told apart. The list
  (`scm/music-functions.scm:674-694`):
  ```scheme
  (define general-grace-settings
    `((Voice Stem font-size -3)
      (Voice Flag font-size -3)
      (Voice NoteHead font-size -3)
      (Voice TabNoteHead font-size -4)
      (Voice Dots font-size -3)
      (Voice Stem length-fraction 0.8)
      (Voice Stem no-stem-extend #t)
      (Voice Beam beam-thickness 0.384)
      (Voice Beam length-fraction 0.8)
      (Voice Accidental font-size -4)
      (Voice AccidentalCautionary font-size -4)
      (Voice Script font-size -3)
      (Voice Fingering font-size -8)
      (Voice StringNumber font-size -8)))
  (define-public score-grace-settings
    (append `((Voice Stem direction ,UP) (Voice Slur direction ,DOWN)) general-grace-settings))
  ```
  `Score.graceSettings = #score-grace-settings` (`ly/engraver-init.ly:985`); `\voiceOne` … replace
  it with `general-grace-settings` — i.e. WITHOUT the forced stem/slur direction
  (`scm/music-functions.scm:704-722`, `make-voice-props-set`).

#### 1.2 Timing — the `Moment (main, grace)` pair

`lily/include/moment.hh:30-34`: "Musical timing (Main-timing, grace-timing)". Two `Rational`s
(`:96-97`). Comparison is LEXICOGRAPHIC, main part first (`lily/moment.cc:52-60`):
```cpp
int Moment::compare (Moment const &a, Moment const &b)
{
  int c = Rational::compare (a.main_part_, b.main_part_);
  if (c) return c;
  return Rational::compare (a.grace_part_, b.grace_part_);
}
```
Addition/subtraction/negation act on both parts (`:62-76`, `:103-110`); scaling by a Rational
scales both (`:78-92`, header `:88-89` "affects main and grace parts"); `to_string` prints
`main` + `"G"` + grace (`:94-101`). `ly:make-moment` docs (`lily/moment-scheme.cc:31-37`): "A
*moment* is a point in musical time. It consists of a pair of rationals (m, g), where m is the
timing for the main notes, and g the timing for grace notes. In absence of grace notes, g is zero."

Consequences:
- A grace before beat `t` is at `(t, -g)` with `g > 0` decreasing toward 0 — the `\grace` start
  callback above. Sequences accumulate leading grace time (`lily/music-sequence.cc:182-193`
  "Accumulate grace time until finding the first element with non-grace time"), and the
  sequential iterator keeps `ahead_mom_.grace_part_` so a following element's graces can "borrow
  time from the current element" (`lily/sequential-iterator.cc:104`, `:156-160`, `:209-213`).
- `Grace_iterator::process` maps the outer `(0, g)` back to the child's main time
  (`lily/grace-iterator.cc:63`: `Moment main (-music_start_mom ().grace_part_ + m.grace_part_)`)
  and `pending_moment` re-wraps it (`:85-94`).
- The Timing translator: a measure that starts with graces starts "earlier";
  `measurePosition` carries the grace part (`lily/timing-translator.cc:448`,
  `Moment (0, now_mom ().grace_part_)`, and `:593`), bar checks compare ONLY the main part
  (`:283-287`: "We ignore differences in grace part. Simultaneous sequences may include different
  amounts of grace time … The measure starts with the earliest grace note, but we don't want to
  fail later bar checks when the only difference is grace notes."); `:581-590` admits the grace
  part of `measurePosition` "does not actually make sense … Maybe we should keep
  measurePosition.grace_part_ constantly at zero anyway?"
- Nesting: `\grace` inside `\grace` is UNSUPPORTED (NR `rhythms.itely:4840-4842`: "Grace sections
  should only be used within sequential music expressions. Nesting or juxtaposing grace sections
  is not supported, and might produce crashes or other errors.")

#### 1.3 Horizontal spacing — a separate spacing law inside the run, 0.8× at the join

- `Grace_spacing_engraver` (`lily/grace-spacing-engraver.cc:45-77`) makes one `GraceSpacing`
  spanner per run, adds every column in grace time — AND the first non-grace column after it —
  to its `columns`, and sets each column's `grace-spacing` object. Doc: "Bookkeeping of shortest
  starting and playing notes in grace note runs" (`:85-87`).
- `GraceSpacing` grob defaults (`scm/define-grobs.scm:1722-1732`):
  ```scheme
  (GraceSpacing
   . ((common-shortest-duration . ,grace-spacing::calc-shortest-duration)
      (shortest-duration-space . 1.6)
      (spacing-increment . 0.8)
  ```
  versus the main `SpacingSpanner` (`lily/spacing-options.cc:56-66`) `shortest_duration_space_ =
  2.0`, `increment_ = 1.2`. `common-shortest-duration` is the minimum `when`-difference between
  consecutive columns of the run (`scm/output-lib.scm:1429-1448`).
- The spring between two grace columns is computed with the grace options and stiffened
  (`lily/spacing-basic.cc:163-180`):
  ```cpp
  else if (delta_t.grace_part_)
    {
      Grob *grace_spacing = unsmob<Grob> (get_object (lc, "grace-spacing"));
      if (grace_spacing)
        {
          Spacing_options grace_opts; grace_opts.init_from_grob (grace_spacing);
          Real len = grace_opts.get_duration_space (delta_t.grace_part_);
          Real min = grace_opts.increment_;
          ret = Spring (len, min);
          // Grace notes should not stretch very much
          ret.set_inverse_stretch_strength (grace_opts.increment_ / 2.0);
        }
      else // Fallback to the old grace spacing: half that of the shortest note
        ret = Spring (options->get_duration_space (options->global_shortest_) / 2.0,
                      options->increment_ / 2.0);
    }
  ```
  Note `delta_t.main_part_ && !lwhen.grace_part_` guards the normal branch (`:148`): the spring
  FROM the last grace TO the main note is the grace branch too (its `delta_t` has a grace part).
- The join from a normal column (or a bar line) INTO a grace run is scaled by an admitted
  arbitrary number (`lily/spacing-spanner.cc:396-403`, and for breakable columns `:519-526`):
  ```cpp
  if (Paper_column::when_mom (right_col).grace_part_ && !Paper_column::when_mom (left_col).grace_part_)
    { /* Ugh. 0.8 is arbitrary. */ spring *= 0.8; }
  ```
  Regression `input/regression/spacing-to-grace.ly`: "Space from a normal note (or bar line) to a
  grace note is smaller than to a normal note."
- Grace columns are EXCLUDED from the measure's shortest-note statistic
  (`lily/spacing-spanner.cc:113-119` "ignore grace notes for shortest notes";
  `lily/spacing-engraver.cc:186-188` "only pay attention to durations that are not grace notes";
  `input/regression/spacing-grace-duration.ly`: "the 8ths around the grace are spaced exactly as
  the other 8th notes").
- Optional "floating" mode: `SpacingSpanner.strict-grace-spacing` — "If set, main notes are
  spaced normally, then grace notes are put left of the musical columns for the main notes"
  (`scm/define-grob-properties.scm:1324-1326`; `lily/spacing-determine-loose-columns.cc:52-56`
  makes such a column loose; the loose-column walk uses the `grace-spacing` options
  `lily/spacing-loose-columns.cc:139-143`). Its documented side effects
  (`Documentation/snippets/positioning-grace-notes-with-floating-space.ly`): accidentals are
  ignored (issue #6876) and "LilyPond does not check whether there is enough horizontal space for
  grace notes" (issue #2630).

#### 1.4 Size and stem length

- Heads, stems, flags, dots, scripts: `font-size -3` = 2^(−3/6) = **0.707×**; accidentals `-4` =
  **0.63×**; fingerings `-8` (list in §1.1). Beam-quanting comment confirms the intent
  (`lily/beam-quanting.cc:110-114`): "For grace notes, beams get scaled down to 80%, but glyphs
  go down to 63% (magstep -4 for accidentals). To make the padding commensurate with glyph size
  for grace notes, we take the square of the length fraction, yielding a 64% decrease."
- Stem: `length-fraction 0.8` multiplies the computed length (`lily/stem.cc:557`
  `length *= … "length-fraction"`; beamed ideal lengths `lily/stem.cc:1159-1166`), and
  `no-stem-extend #t` switches off the "extend to the middle line" rule (`lily/stem.cc:591-594`:
  `if (!no_extend && dir * stem_end < 0) stem_end = 0.0;`; for beams `lily/stem.cc:1230-1240`
  "Obviously not for grace beams"). Regression `grace-stem-length.ly`: "Stem lengths for grace
  notes should be shorter than normal notes, if possible. They should never be longer, even if
  that would lead to beam quanting problems." The standard length the 0.8 applies to is 3.5
  spaces (`scm/define-grobs.scm:3452` "3.5 (or 3 measured from note head) is standard length").

#### 1.5 Stem direction

Forced **UP** at Score level (`score-grace-settings`, `Voice Stem direction UP`), with the grace
slur forced **DOWN**; inside `\voiceOne`…`\voiceFour` the polyphonic direction wins instead
(§1.1). A user can drop the rule per score with
`$(remove-grace-property 'Voice 'Stem 'direction)` (snippet
`tweaking-grace-layout-within-music.ly`: "so that stems do not always point up").

#### 1.6 The slash

- Flagged grace: `Flag.stroke-style = "grace"` makes `Flag::print` add a second GLYPH from the
  font, `flags.ugrace` / `flags.dgrace` (`lily/flag.cc:140-163`; for straight flags the stroke
  is drawn as a line, `scm/flag-styles.scm:35-55`: "The stroke starts for up-flags at
  `upper-end-of-flag + (0,length/2)` and ends at `(0, vertical-center-of-flag-end) -
  (flag-x-width/2, flag-x-width + flag-thickness)`"). The glyph (`mf/feta-flags.mf:1228-1260`,
  "Single Stroke for Short Appoggiatura"): a line from `z1 = (-b, -d)` to `z2 = (w, h)` with pen
  `1.5 stemthickness`, box `hip_width# * 0.72` left, `hip_width#` right, `3 staff_space# * 0.72`
  down, `1 staff_space#` up (`flare# = staff_space#`, `foot_depth# = 3 staff_space#`,
  `hip_depth_ratio = .72`); down version `flare# = .99 staff_space#`, `total_depth# = 2.85 staff_space#`.
  It is positioned where the flag is (it is added to the flag stencil).
- Beamed grace group: only with `\slashedGrace` (Beam.stencil = `beam::slashed-stencil`) — NOT
  with `\acciaccatura` (see Known issues, §1.13). `beam::slashed-stencil`
  (`scm/output-lib.scm:350-440`) draws ONE line through the FIRST stem (`slash-side LEFT`,
  `relevant-stem = car stems`), with `details` defaults: `slash-stem-fraction 0.3` (the fraction
  of the stem from beam toward the head where the slash starts), `over-beam-height 0.75` (how far
  past the beam it ends), `slash-X-positions (-0.5 . 1)` (x start/end relative to the stem, staff
  spaces), `slash-slope 2`, and thickness = `Stem.thickness × line-thickness` unless
  `slash-thickness` is given (`:383-393`). Regression `slashed-beam-grace.ly`: "Printing slashed
  beams is the default for `\slashedGrace`."

#### 1.7 Beaming

- Two beam engravers coexist and are "always nested" (`lily/beam-engraver.cc:73-81`): the normal
  `Beam_engraver` only starts a beam when `now_mom ().grace_part_ == 0`;
  `Grace_beam_engraver` is the complement (`:305-335`, `valid_start_point` =
  `!Beam_engraver::valid_start_point ()`), doc "Only engraves beams when we are at grace points
  in time" (`:340-346`). Both are in Voice (`ly/engraver-init.ly:395-397`).
- Automatic: `Grace_auto_beam_engraver` (`lily/auto-beam-engraver.cc:609-695`) "Generates one
  autobeam group across an entire grace phrase" — start only at the group's first moment, end
  when the grace part is finished (`test_moment`, `:655-668`). The main `Auto_beam_engraver`
  skips interspersed graces (`:417-421`, `is_same_grace_state`). NR `rhythms.itely:3145-3146`
  "Grace note beams and normal note beams can occur simultaneously. Unbeamed grace notes are
  not put into normal note beams."
- Beaming pattern uses the (negative) grace moment as the stem's start
  (`lily/template-engraver-for-beams.cc:47-48`, `:72-74`; `lily/beaming-pattern.cc:92-95` "For
  grace beaming, which involves negative stem start moments, the measure position needs to
  undergo modulo to be nonnegative").
- Thickness: `beam-thickness 0.384` vs default `0.48` (`scm/define-grobs.scm:479`) — exactly
  0.8×; the inter-beam gap shrinks with `length-fraction` (`lily/beam.cc:133-146`: "if fract != 1.0,
  as is the case for grace notes, we want the gap to decrease too").
- Tuplets and subdivision inside grace beams are supported (`beam-grace-tuplet-bounds.ly`,
  `beam-subdivide-tuplet-grace.ly`; `lily/tuplet-description.cc:29-35` handles a tuplet whose
  start has a grace part).

#### 1.8 Slur

`\acciaccatura` and `\appoggiatura` add a slur with its OWN spanner id (`ly/grace-init.ly:21-22`,
`'spanner-id 'grace`) so it nests inside a user slur without warnings
(`input/regression/slur-grace.ly`). It starts on the first grace (`<>\startGraceSlur` inserted
before the group) and ends on the first note after it (the `<>\stopGraceSlur` after the group —
an empty chord at the main moment, so the slur's right end is the principal). Direction: forced
DOWN by `score-grace-settings` (§1.1) — no special geometry; it is a normal `Slur`. `\slashedGrace`
adds none, for a grace "tied to the next note" (`grace-slashed-no-slur.ly`). Ties work from a
grace to the next grace or the main note (`tie-grace.ly`).

#### 1.9 Accidentals

Scaled harder than the head: `Accidental font-size -4` (0.63×), `AccidentalCautionary -4`. No
grace-specific spacing rule found in `lily/accidental-engraver.cc` (no "grace" hit). Known issue:
in strict-grace-spacing mode accidentals are ignored (issue #6876, §1.3).

#### 1.10 Bar lines, measure start, line breaks

- A grace at the start of a bar is IN that bar, drawn after the bar line:
  `input/regression/grace-bar-line.ly` "Bar line should come before the grace note";
  `bar-line-submeasure-grace.ly` "Submeasure bar lines are placed before any grace notes in the
  submeasure"; `grace-start.ly` "Pieces may begin with grace notes"; `grace-bar-number.ly` "If a
  measure starts with a grace note, the measure does not start at 0, but earlier. Nevertheless …
  line breaks should be possible at grace notes, and the bar number should be printed correctly."
- Line start: the grace column follows the break-aligned column (clef/key/meter) like any
  musical column; spanners that would span only grace time at a line start are killed
  (`lily/spanner.cc:559-583`, "the amount of space left of a note at the start of a line is very
  small"). Loose (strict-spacing) grace columns across a break attach to the line end
  (`spacing-loose-grace-linebreak.ly`).
- Synchronisation: staff notation is synchronised on the FULL moment, so a staff without the
  grace gets its bar line/key before the other staff's grace (Known issues, §1.13) —
  `grace-sync.ly` "Grace notes in different voices/staves are synchronized."

#### 1.11 Playback (MIDI)

- A grace note's real time is **9/40 of its written duration**
  (`lily/audio-item.cc:120-124`):
  ```cpp
  Real moment_to_real (Moment m)
  { return static_cast<Real> (m.main_part_ + Rational (9, 40) * m.grace_part_); }
  ```
  (the NR says "1/4 of its actual duration", `rhythms.itely:4844-4845` — the code says 9/40;
  `midi-grace-after-rest.ly` computes with 9/40).
- Time is stolen from the PREVIOUS non-grace note, only when they would overlap
  (`lily/note-performer.cc:99-116`): "Grace notes shorten the previous non-grace note. If it was
  part of a tie, shorten the first note in the tie." … "Shorten the note if it would overlap. It
  might not if there's a rest in between." — `tie_head->length_mom_ = now_mom () - start`.
- There is NO on-the-beat appoggiatura playback: `\appoggiatura` is the same `GraceMusic` and is
  played before the beat like every grace. `\afterGrace` is placed at 3/4 of the main note by
  its skip, so it steals the last quarter of the main note in MIDI as well.
- Graces at the very start give negative ticks (`lily/midi-walker.cc:63-64`: "Scores that begin
  with grace notes start at negative times. This is OK - MIDI output doesn't use absolute ticks");
  overflow raises "Going back in MIDI time" (`:175-183`).

#### 1.12 Multi-voice, chords, rests, tuplets

- Grace groups may hold chords, rests, skips (`\grace s16` is the documented way to keep other
  staves synchronised, NR `rhythms.itely:4824-4838`), ties, tuplets (`beam-grace-tuplet-bounds.ly`),
  `\partial` (`grace-partial.ly`), part-combine (`grace-part-combine.ly`), lyrics with
  `includeGraceNotes` (`scm/define-context-properties.scm:463-464`).
- Polyphony: `\voiceOne` keeps its direction through a grace (`grace-direction-polyphony.ly`,
  `property-grace-polyphony.ly`), because voice settings swap in `general-grace-settings`.
- Completion heads engraver refuses to split graces (`lily/completion-note-heads-engraver.cc:263-267`
  "don't do complicated arithmetic with grace notes").

#### 1.13 Known issues (transcribed, `Documentation/en/notation/rhythms.itely:4799-4867`)

> A multi-note beamed *acciaccatura* is printed without a slash, and looks exactly the same as a
> multi-note beamed *appoggiatura*.
>
> Grace note synchronization can also lead to surprises. Staff notation, such as key signatures,
> bar lines, etc., are also synchronized. Take care when you mix staves with grace notes and
> staves without, for example, [`e''4 \section \grace c16 d2.` against `c''4 \section d2.`]
> This can be remedied by inserting grace skips of the corresponding durations in the other
> staves. … Please make sure that you use the `\grace` command for the spacer part, even if the
> visual part uses `\acciaccatura` or `\appoggiatura` because otherwise an ugly slur fragment will
> be printed, connecting the invisible grace note with the following note.
>
> Grace sections should only be used within sequential music expressions. Nesting or juxtaposing
> grace sections is not supported, and might produce crashes or other errors.
>
> Each grace note in MIDI output has a length of 1/4 of its actual duration. If the combined
> length of the grace notes is greater than the length of the preceding note a "Going back in
> MIDI time" error will be generated. Either make the grace notes shorter in duration … Or
> explicitly change the musical duration [`\scaleDurations 1/2`].

Other admissions in code: `lily/spacing-spanner.cc:399` and `:524` "Ugh. 0.8 is arbitrary.";
`lily/grace-engraver.cc:152-160` — a `\grace` at the very start "executes its actions already
before `\oneVoice`, causing different stem directions"; `lily/timing-translator.cc:581-590`
(grace part of `measurePosition`); `lily/lyric-engraver.cc:146-154` lyrics can include at most one
grace; `lily/quote-iterator.cc:186-192` quoted grace time must be supplied by the user;
`lily/multi-measure-rest-engraver.cc:67` "Ugh, this is a kludge - need this for
multi-measure-rest-grace.ly"; `lily/percent-repeat-engraver.cc:47-50` a percent repeat whose
measure starts with graces must bound at the first grace's command column.

---

### 2. Verovio

Paths are relative to `/home/kiko/dev/engine-sources/verovio/` (CHANGELOG top entry `6.2.0 – 2026-05-20`).
The unit is `m_unit` = "The MEI unit (1⁄2 of the distance between the staff lines)"
(`src/options.cpp:1202-1204`, default `DEFAULT_UNIT 9.0`, `include/vrv/vrvdef.h:455`), so
**1 unit = ½ staff space**.

#### 2.1 Data model — a SIBLING event in the layer with an attribute, optionally grouped

- A grace note is a plain `<note>`/`<chord>` child of `<layer>` (`src/layer.cpp:164` accepts any
  `LayerElement`); there is no parent/child relation to the principal. What marks it is MEI's
  `@grace` (`AttGraced`, `libmei/dist/atts_cmn.h:675-702`: `SetGrace/GetGrace/HasGrace`,
  `SetGraceTime/GetGraceTime/HasGraceTime`) with values `GRACE_acc`, `GRACE_unacc`,
  `GRACE_unknown` (`libmei/dist/atttypes.h:815-817`) — i.e. **acciaccatura vs appoggiatura is the
  `acc`/`unacc` ENUM on the note**, not a slash property. Carried by `Note` (`include/vrv/note.h:60`),
  `Chord` (`include/vrv/chord.h:40`), `GraceGrp` (`include/vrv/gracegrp.h:20`) and — copied at
  prepare time so the slash can be drawn — `Stem` (`include/vrv/stem.h:27`;
  `src/preparedatafunctor.cpp:1182` `currentStem->AttGraced::operator=(*chord);`, `:1231` for notes).
  `Rest` has NO `AttGraced` (`include/vrv/rest.h:39-49`).
- Grouping: `<graceGrp>` (`src/gracegrp.cpp:56-58`, children `BEAM, CHORD, NOTE, REST, SPACE` —
  **no TUPLET**), with `@attach = pre | post | unknown` (`libmei/dist/atttypes.h:2136-2141`).
  Before vs after is therefore `graceGrp@attach`; but `GetAttach()` is read in exactly ONE place,
  the MIDI functor (`src/midifunctor.cpp:398-401`) — "There is no layout consequence of `@attach`".
- The predicate (`src/layerelement.cpp:172-203`): anything with a `GRACEGRP` ancestor is a grace;
  a note asks its chord if it has one; a tuplet is a grace if its first note/chord is; accid/artic
  ask their parent note.
- Written duration stays in `@dur`; the alignment duration is zero when asked "not grace only"
  (`src/layerelement.cpp:661-666`):
  ```cpp
  Fraction LayerElement::GetAlignmentDuration(const AlignMeterParams &params, bool notGraceOnly, ...) const
  {
      if (this->IsGraceNote() && notGraceOnly) { return Fraction(0); }
  ```
  The measure aligner calls it with `true` (`src/alignfunctor.cpp:371`); the grace aligner with
  `false` (`src/horizontalaligner.cpp:397`).
- `@grace.time` (a percent) is MIDI-only, default 50 (`src/midifunctor.cpp:384/481`), and no
  importer ever sets it (`grep SetGraceTime src include` → none).

#### 2.2 Timing — a GraceAligner hung on the principal's alignment, time running BACKWARD

- Alignment types are ordered (`include/vrv/horizontalaligner.h:31-65`): … `ALIGNMENT_CLEF,
  ALIGNMENT_KEYSIG, ALIGNMENT_MENSUR, ALIGNMENT_METERSIG, ALIGNMENT_PROPORT, ALIGNMENT_DOT,
  ALIGNMENT_CUSTOS, ALIGNMENT_ACCID, ALIGNMENT_GRACENOTE, ALIGNMENT_BARLINE, ALIGNMENT_DIVLINE,
  ALIGNMENT_DEFAULT`. Alignments sort by time, then by this enum (`src/horizontalaligner.cpp:58-81`),
  so a grace at time t stands AFTER any clef/key/meter at t and BEFORE the notes at t.
- A grace element gets `type = ALIGNMENT_GRACENOTE` (`src/alignfunctor.cpp:359-364`) and is NOT
  added to that alignment's reference list; instead it is stacked onto a `GraceAligner` keyed
  by staff (or `0` for all staves when `graceRhythmAlign` is on — `src/alignfunctor.cpp:391-406`,
  the same idiom at six sites). The stack is flushed at the end of each layer
  (`src/alignfunctor.cpp:148-158`) by `GraceAligner::AlignStack` (`src/horizontalaligner.cpp:391-420`):
  ```cpp
  Fraction time;
  for (int i = (int)m_graceStack.size(); i > 0; --i) {
      LayerElement *element = ...m_graceStack.at(i - 1);
      Fraction duration = element->GetAlignmentDuration(false);
      // Time goes backward with grace notes
      time = time - duration;
      Alignment *alignment = this->GetAlignmentAtTime(time, ALIGNMENT_DEFAULT);
      element->SetGraceAlignment(alignment);
  ```
  Header comment (`include/vrv/horizontalaligner.h:591-599`): "Because the grace notes appear
  from left to right but need to be aligned from right to left, we first need to stack them and
  align them eventually when we have all of them."
- The `ALIGNMENT_GRACENOTE` alignment is then snapped onto the following alignment's x
  (`MeasureAligner::PushAlignmentsRight`, `src/horizontalaligner.cpp:246-259`; header `:511-515`
  "Push all the ALIGNMENT_GRACENOTE and ALIGNMENT_CONTAINER to the right … so they align with the
  next alignment content"), and each inner alignment gets a NEGATIVE default x
  (`src/horizontalaligner.cpp:460-476`):
  ```cpp
  // We space with a notehead (non grace size) which seems to be a reasonable default spacing with margin
  // Ideally we should look at the duration in that alignment and also the maximum staff scaling for this aligner
  alignment->SetXRel(-i * doc->GetGlyphWidth(SMUFL_E0A4_noteheadBlack, 100, false));
  ```
  applied in `GetDrawingX` as `graceNoteShift` (`src/layerelement.cpp:418-426`).
- `ALIGNMENT_GRACENOTE` is excluded as a spacing reference (`src/calcalignmentxposfunctor.cpp:90-91`)
  and, being inside the justifiable range, IS stretched by justification like any other
  alignment (`src/justifyfunctor.cpp:40-46`).

#### 2.3 Horizontal spacing — bounding-box packing, right to left

No duration law: a separate pass, `AdjustGraceXPosFunctor` ("adjusts the X positions of the grace
notes looking at the bounding boxes", `include/vrv/adjustgracexposfunctor.h:19-23`), run after
`AdjustXPos` (`src/page.cpp:458-466`).
- Right edge: the group's max-right is the principal's `minLeft` minus `leftMarginNote ×
  GetDrawingUnit(75)` (`src/adjustgracexposfunctor.cpp:69-88`); `leftMarginNote` default **1.0
  unit** (`src/options.cpp:1748-1750`, range 0–2) → gap last-grace→principal = **0.75 unit =
  0.375 sp**. Before a bar line the right bar line's left edge is used instead (`:79-88`). The
  principal's accidental is excluded from that edge when it does not vertically overlap the last
  grace (`:58-67`, `Alignment::HasAccidVerticalOverlap` `src/horizontalaligner.cpp:568-581`).
- Inside the group (`src/adjustgracexposfunctor.cpp:156-198`): each element's right is pushed
  under the running max, then its left minus `GetLeftMargin(element) ×
  GetDrawingUnit(GetCueSize(100))` becomes the next max — i.e. the normal left margin scaled by
  the cue factor: **1.0 × 0.75 = 0.75 unit** between grace heads (accidentals `leftMarginAccid`
  1.0 likewise, `src/options.cpp:1696-1698`).
- Left edge: `MeasureAligner::AdjustGraceNoteSpacing` (`src/horizontalaligner.cpp:262-320`)
  pushes the preceding alignment away by `leftMarginNote × GetDrawingUnit(100)` = **1.0 unit**
  (full size), never beyond the left bar line (`:295-299`).
- A tie ending on a grace reserves `tieMinLength + 1 unit` (`src/adjustgracexposfunctor.cpp:188-196`).
- `graceRightAlign` (default false, `src/options.cpp:1334-1336`) aligns the right position of a
  grace group across all staves; `graceRhythmAlign` (default false) shares one aligner across
  staves so the n-th grace lines up. `GraceAligner::m_totalWidth/SetWidth/GetWidth` are dead code
  (`include/vrv/horizontalaligner.h:606-610, 650-655`; only reset at `src/horizontalaligner.cpp:358`).

#### 2.4 Size and stem length

- `graceFactor`: "The grace size ratio numerator", `Init(0.75, 0.5, 1.0)` → default **0.75**,
  range 0.5–1.0 (`src/options.cpp:1326-1328`). `Doc::GetCueScaling()` returns it and
  `GetCueSize(v) = v × factor` (`src/doc.cpp:2111-2119`); every glyph/font/beam/ledger/dot
  measurement takes a `graceSize` bool that multiplies by it (`src/doc.cpp:1864-1940, 2121-2126,
  2233-2259`, `src/view_graph.cpp:206`).
- Who is cue-sized: `PrepareCueSizeFunctor` (`src/preparedatafunctor.cpp:208-262`) — any
  `IsGraceNote()` element, and accid/artic/dots/flag/stem inherit from their note.
- Stem length: `baseStem = -(CalcStemLenInThirdUnits × thirdUnit); if (drawingCueSize) baseStem
  = GetCueSize(baseStem);` (`src/calcstemfunctor.cpp:376-379`) — the standard length × 0.75; the
  "reach the staff centre" adjustment is skipped for graces (`:472-478`: "Do not adjust the
  length of grace notes - this is debatable and should probably become a styling option"), and
  so is the stem-mod adjustment (`:480-484`). In a beam the uniform stem length is multiplied by
  a HARD-CODED `0.75` (`src/beam.cpp:1225-1233`), not by `graceFactor`. Stem width (`0.20 unit`,
  `src/options.cpp:1532-1534`) is NOT cue-scaled.

#### 2.5 Stem direction

Single grace notes: forced UP, above the layer's direction but below an explicit `@stem.dir`
(`src/calcstemfunctor.cpp:263-280`: `else if (note->IsGraceNote()) { stemDir = STEMDIRECTION_up; }`
before the `layer->GetDrawingStemDir` branch). Beamed grace groups: `InitGraceStemDir` forces UP
"unless stem direction is provided" (`src/drawinginterface.cpp:279-292`, called
`src/calcstemfunctor.cpp:60-62`). **Grace CHORDS are not forced** — `VisitChord`
(`src/calcstemfunctor.cpp:151-161`) has no grace branch and uses the pitch rule.

#### 2.6 The slash

Drawn at the end of `DrawStem` only when `stem->GetGrace() == GRACE_unacc && !stem->IsInBeam()`
(`src/view_element.cpp:1785-1791`) — so a BEAMED grace group gets NO slash, and `@stem.mod="1slash"`
never draws one (it maps to a tremolo glyph, `src/layerelement.cpp:1000-1013`, and stem mods are
suppressed on graces, `src/view_element.cpp:1839`, `src/stem.cpp:207`). Geometry
(`src/view_element.cpp:2035-2082`, with `u` = unit, `s = GetCueSize(u)` = 0.75 u):
```cpp
dc->SetPen(m_doc->GetDrawingStemWidth(staff->m_drawingStaffSize) * 1.2, PEN_SOLID);
int positionShift = m_doc->GetCueSize(m_doc->GetDrawingUnit(staff->m_drawingStaffSize));
int positionShiftX1 = positionShift;         int positionShiftY1 = positionShift * -4;
int positionShiftX2 = positionShift * 2;     int positionShiftY2 = positionShift * -1;
int y = stem->GetDrawingY() - stem->GetDrawingStemLen();   // stem tip
if (flag) { ... y += GlyphTop/Bottom(flagGlyph, cue) }      // moved by the flag's extent
// HARDCODED
if (stemDir == STEMDIRECTION_up)
    dc->DrawLine(x - positionShiftX1, y + positionShiftY1, x + positionShiftX2, y + positionShiftY2);
```
Thickness **1.2 × stem width** (0.24 u); from `(x − s, tip − 4s)` to `(x + 2s, tip − s)` — a 45°
line 3s wide and 3s tall (≈ 2.25 u × 2.25 u = 1.125 sp square), crossing the stem near the flag.

#### 2.7 Beaming

No automatic beaming: MEI must contain `<beam>` (allowed inside `<graceGrp>`). `Beam::FilterList`
(`src/beam.cpp:1652-1697`): if the FIRST element is a grace the whole beam is a grace beam;
otherwise graces inside a normal beam are DROPPED ("Eventually, we also need to filter out grace
notes properly (e.g., with sub-beams)"). Beam thickness and white space are cue-scaled when every
element is a grace/cue (`InitCue`, `src/drawinginterface.cpp:263-276`; `src/beam.cpp:594-596`;
`src/doc.cpp:2233-2245`). Grace notes are ignored by beam-collision avoidance
(`src/adjustbeamsfunctor.cpp:237-244`).

#### 2.8 Slur

NOT auto-generated (no grace→slur creation; `src/convertfunctor.cpp` has no grace hit). A slur
whose start is a grace and end is not (`isGraceToNoteSlur`, `src/slur.cpp:649-650`,
`src/calcslurdirectionfunctor.cpp:87-88`) gets: direction from the grace's notehead side — stem
down → above, else BELOW (`src/calcslurdirectionfunctor.cpp:122-131`, used when the layer has no
forced stem direction, `:154-157`); start on the grace's top/bottom with the x shifted by the
head radius (`src/slur.cpp:699-709`, `:726-732`); end raised/lowered in 1–2-unit steps relative
to the principal (`:811-819`, `:858-870`); no angle normalisation (`:1138`); and the
"same-alignment" validity check waived (`src/view_control.cpp:441-448`). Ties: `isGraceToNoteTie`
skips the vertical adjustment (`src/tie.cpp:211-217`).

#### 2.9 Accidentals

Cue-sized by inheriting the note's `m_drawingCueSize` (`src/preparedatafunctor.cpp:242-251`);
given the grace alignment together with FLAG/NOTE/STEM (`src/horizontalaligner.cpp:404`);
`AdjustAccidXFunctor` recurses into the grace aligners (`src/adjustaccidxfunctor.cpp:28-34`);
intra-group margin `leftMarginAccid (1.0) × 0.75 unit`.

#### 2.10 Bar lines, measure start, breaks

Enum order (§2.2) puts the grace AFTER the system's scoreDef clef/key/meter and after a
mid-measure clef change; it may not be pushed past the left bar line
(`src/horizontalaligner.cpp:295-299`); a grace before the right bar line is measured against it
(`src/adjustgracexposfunctor.cpp:79-88`). Admitted limitation
(`src/adjustclefchangesfunctor.cpp:49-59`): "clef changes are always aligned before grace notes,
even if appearing after in the encoding. To overcome this limitation we will need to rethink
alignment, or (better) use <graceGrp> and have the <clef> within it at the right place."
System-break-specific behaviour: **UNKNOWN** (nothing grace-specific in cast-off).

#### 2.11 Playback

`include/vrv/vrvdef.h:75-76`: `#define UNACC_GRACENOTE_DUR 27 // in milliseconds` (unused) and
`#define UNACC_GRACENOTE_FRACTION Fraction(1, 2048)`. `InitTimemapAdjustNotesFunctor::SetGraceNotesFor`
(`src/midifunctor.cpp:504-541`):
- `acc` (appoggiatura): steals `@grace.time` % of the PRINCIPAL, default 50, "Arbitrarily
  constraint the time between 5% and 95%"; the principal's onset is delayed; the stolen span is
  split equally among the graces — ON the beat.
- `unacc`/`unknown` (acciaccatura): each grace lasts `tempo/2048` quarter notes (≈ 0.0586 ♩ at
  ♩=120), taken BEFORE the beat if there is room (`startTime -= totalDur`), else pushed onto the
  principal. The grace's written `@dur` is never used for playback.
- Nachschlag: `graceGrp@attach="pre"` + unaccented → squeezed into the tail of the previous note
  (`:398-420`); graces at the end of a layer are always treated as unaccented (`:424-448`).

#### 2.12 Chords, rests, tuplets, voices

Grace chords: yes (the chord is stacked, not its notes, `src/horizontalaligner.cpp:377-389`) but
no forced stem-up (§2.5). Grace rests/spaces: allowed in `graceGrp`, cue-sized, but never
stacked into the aligner so they get no grace x-shift (`src/alignfunctor.cpp:397-404`). Tuplets:
not a `graceGrp` child; a tuplet OF graces is recognised and cue-sized but `Tuplet::FilterList`
carries the same "eventually" note (`src/tuplet.cpp:109-112`). Multi-voice: one aligner per STAFF
(not per layer) — two layers' graces at the same time share it; a grace against a normal note in
another layer is shifted by `0.8 × horizontalMargin` (`src/layerelement.cpp:1152-1163`).

#### 2.13 Gotchas admitted in the source

`// HARDCODED` on the slash (`src/view_element.cpp:2070`); "this is debatable and should probably
become a styling option" (stem length, `src/calcstemfunctor.cpp:472`); "we will be able to get
rid of this once MEI has a better modeling for beamed grace notes" (`src/layerelement.cpp:236-237`);
"Arbitrarily looks at the first note, not sure what to do if we have contradictory values"
(`src/midifunctor.cpp:510`); the clef-before-grace limitation (§2.10); an empty
`MARKUP_GRACE_ATTRIBUTE` branch (`src/doc.cpp:1511-1512`). MusicXML import
(`src/iomusxml.cpp:3294-3302, 3326-3335`): `<grace slash="yes">` → `GRACE_unacc` +
`STEMMODIFIER_1slash`, else `GRACE_acc`; `steal-time-previous/following` are NOT read (no "steal"
in `src/`). CHANGELOG: `2.2.0` "Support for `<graceGrp>`", `2.0.0` "Additional options for
controlling grace notes alignment", `3.9.0` "Support for MIDI output of grace notes",
`1.1.3/1.1.4` "Fix missing slash on grace notes", `1.1.4` "Improved stem direction for grace notes".

---

### 3. MuseScore

Paths are relative to `/home/kiko/dev/engine-sources/MuseScore/src/engraving/` unless they start with
`src/`. Units: `_sp` = spatium (staff space); `graceNoteMag` is a dimensionless factor;
`stemSlashAngle` is in degrees.

#### 3.1 Data model — a grace chord is a CHILD of the principal `Chord`, typed by an enum

- `dom/chord.h:53-66` (a bit mask; `operator|`/`&` at `:68-76`):
  ```cpp
  enum class NoteType : unsigned char {
      NORMAL        = 0,
      ACCIACCATURA  = 0x1,
      APPOGGIATURA  = 0x2,         // grace notes
      GRACE4        = 0x4,
      GRACE16       = 0x8,
      GRACE32       = 0x10,
      GRACE8_AFTER  = 0x20,
      GRACE16_AFTER = 0x40,
      GRACE32_AFTER = 0x80,
      INVALID       = 0xFF
  };
  ```
  `Chord::isGrace()` = `m_noteType != NoteType::NORMAL` (`dom/chord.h:262-264`). Before vs
  after and the written value are BOTH folded into the enum: `graceNotesBefore()` filters
  `ACCIACCATURA|APPOGGIATURA|GRACE4|GRACE16|GRACE32`, `graceNotesAfter()` filters the three
  `*_AFTER` values and iterates in REVERSE (`dom/chord.cpp:2117-2136`, `:2142-2157`);
  `toGraceAfter()` maps APPOGGIATURA→GRACE8_AFTER, GRACE16→GRACE16_AFTER, GRACE32→GRACE32_AFTER
  (`dom/chord.cpp:2291-2302`).
- Storage on the principal (`dom/chord.h:411-414`):
  ```cpp
  std::vector<Chord*> m_graceNotes;    // storage for all grace notes
  mutable GraceNotesGroup m_graceNotesBefore = GraceNotesGroup(this);
  mutable GraceNotesGroup m_graceNotesAfter = GraceNotesGroup(this);
  size_t m_graceIndex = 0;             // if this is a grace note, index in parent list
  ```
  `Chord::add(CHORD)` asserts `gc->noteType() != NoteType::NORMAL` and inserts at `graceIndex`
  (`dom/chord.cpp:691-698`). A grace added to a grace is re-rooted to the principal
  (`editing/cmd.cpp:667-671` "allow grace notes to be added to other grace notes by really
  adding to parent chord"). `Chord::segment()` walks up to the PARENT's segment
  (`dom/chord.cpp:2093-2099`); the grace is never in `Segment::elist()`.
- Written duration: an ordinary `TDuration` + `ticks` set by the creator
  (`editing/cmd.cpp:664-697`, `Score::setGraceNote`: `chord->setDurationType(d);
  chord->setTicks(d.fraction()); chord->setNoteType(type); chord->setShowStemSlashInAdvance();
  chord->mutldata()->setMag(… * style().styleD(Sid::graceNoteMag));` — doc `:656-662` "\len is
  the visual duration of the grace note (1/16 or 1/32)"). The NoteType→length table lives in
  the callers (`dom/note.cpp:1925-1975`: ACCIACCATURA/APPOGGIATURA → eighth, GRACE4 → quarter,
  GRACE16 → 16th, GRACE32 → 32nd, `*_AFTER` likewise).
- Acciaccatura vs appoggiatura: the enum PLUS a user-overridable `showStemSlash` whose default
  is derived from it — `dom/chord.cpp:296` `m_showStemSlash = m_noteType ==
  NoteType::ACCIACCATURA;`, `:1695` `case Pid::SHOW_STEM_SLASH: return noteType() ==
  NoteType::ACCIACCATURA;`, `setNoteType` resets it (`:2281-2285`), and `requestShowStemSlash`
  propagates it over the whole beam (`:2212-2226`). The slash is a separate element,
  `StemSlash` (`dom/stemslash.h:30-59`, "used for grace notes of type acciaccatura").
- Serialisation (`rw/write/twrite.cpp:1084-1121`): grace `<Chord>`s are written BEFORE the
  principal as siblings, each carrying a child tag `<acciaccatura/>`, `<appoggiatura/>`,
  `<grace4/>` … `<grace32after/>`; the measure reader collects them and attaches them to the
  next normal chord (`rw/read460/measureread.cpp:271-286`).

#### 3.2 Timing — the parent's tick, no grace component

`EngravingItem::tick()` walks up to the segment (`dom/engravingitem.cpp:609-621`), so grace-before,
grace-after and the principal all report the SAME tick (`rendering/score/beamtremololayout.cpp:979`
"graces have the same tick"). Ordering within the tick is `graceIndex` (`dom/location.cpp:199-208`,
written as `<grace>` in `<location>`, `rw/write/twrite.cpp:2366`), rebuilt on every layout because
"graceIndex is not well-maintained on add & remove" (`rendering/score/chordlayout.cpp:86-91`).
`ticks()`/`actualTicks()` hold the WRITTEN value (not zero; `cmd.cpp:679`) and are ignored by
measure accounting because the grace is not in the segment; the legacy MIDI renderer reads them
for appoggiatura length (§3.11). There is no `Fraction` grace part.

#### 3.3 Horizontal spacing — three style rows, bounding-box packing

- `style/styledef.cpp`:
  ```
  515: smallNoteMag            .7
  517: graceNoteMag            0.7
  518: graceToMainNoteDist     0.45_sp
  519: graceToGraceNoteDist    0.3_sp
  264: minNoteDistance         0.35_sp
  793: barGraceDistance        1.0_sp      // defined and serialised, but NO code reads Sid::barGraceDistance
  ```
- Padding pairs (`rendering/score/horizontalspacing.cpp:1510-1520`): grace→grace `max(padding,
  graceToGraceNoteDist)`; grace→main and main→grace `max(padding, graceToMainNoteDist)`.
- Placement (`rendering/score/tlayout.cpp:2744-2828`, `layoutGraceNotesGroup`): iterate the group
  BACKWARDS, pack each grace chord's shape against the accumulated group shape with
  `minHorizontalDistance`, then push the whole group left of the segment's staff shape:
  ```cpp
  double xPos = -HorizontalSpacing::minHorizontalDistance(_shape, staffShape, _shapeSpatium);
  // Safety net in case the shape checks don't succeed
  xPos = std::min(xPos, -double(ctx.conf().styleAbsolute(Sid::graceToMainNoteDist) + firstGN->notes().front()->headWidth() / 2));
  item->setPos(xPos, 0.0);
  ```
  i.e. negative x relative to the SEGMENT. The group's shape is added to the segment's staff shape
  (`dom/chord.cpp:2812-2826`, `dom/segment.cpp:2717-2727`) — NOT to the parent chord's shape
  (`fillShape`, `chordlayout.cpp:3399-3470`, never adds `graceNotes()`) — so ordinary segment
  spacing then makes the room: the grace group's width is the segment's left padding.
- Grace-after is PRE-APPENDED to the FOLLOWING segment (`rendering/score/chordlayout.cpp:2943-2979`:
  "Attach graceNotesAfter of this chord to the *following* segment", walking past empty and
  TimeTick segments) and then re-offset into the parent's frame "AFTER horizontal spacing is
  calculated" (`repositionGraceNotesAfter`, `:2981-2998`). If the chord ends the measure no
  following segment is found and the group is not appended — UNKNOWN what then places it.
- `Segment::m_preAppendedItems` (`dom/segment.h:375`): "Container for items appended to the left
  of this segment (example: grace notes), size = staves * VOICES."
- The TAB layout still carries a legacy hand-packed version with an after-grace start factor by
  duration (`chordlayout.cpp:624-672`: `fc = 3.8 / 3.6 / 2.1 / 1.4 / 1.2` for whole … 16th,
  "Values found by testing") and a "HACK: align grace notes in TAB to their linked notation
  staff … TODO: refactor grace notes to allow doing this properly" (`tlayout.cpp:2753-2757`).

#### 3.4 Size and stem length

- `graceNoteMag` **0.7**; `Chord::intrinsicMag()` multiplies `smallNoteMag` (if small) and
  `graceNoteMag` (if grace) (`dom/chord.cpp:2061-2086`) — small+grace = 0.49. Set on the layout
  data per segment (`rendering/score/segmentlayout.cpp:100-112`). `StemSlash::mag()` = the
  chord's (`dom/stemslash.h:43`).
- Stem length: no separate rule — `finalStemLength = chordHeight/4·sp + (stemLength/4·sp) ×
  intrinsicMag()` (`rendering/score/stemlayout.cpp:122`); the staff-overlap minimum is relaxed
  for grace/small (`:78-82`); `maxReduction` limits hooked grace stems' shortening to 0.5 sp
  ("reducing by the full amount puts the hooks too low", `:373-378`).

#### 3.5 Stem direction

`ChordLayout::computeUp` (`rendering/score/chordlayout.cpp:1529-1597`): explicit direction →
beam → **multi-voice parity** (`ldata->up = isTrackEven`) → THEN `isGraceNote → up = true` →
cross-staff → pitch. So a grace in voice 2 points DOWN; otherwise always UP. Beams the same
(`rendering/score/beamlayout.cpp:246-252`: `if (hasMultipleVoices) setUp(track % 2 == 0) else
setUp(true)`). No `Sid::graceNoteStemDirection`.

#### 3.6 The slash — `StemSlash`

- Style rows (`style/styledef.cpp:280-282`): `stemSlashPosition 2.0_sp`, `stemSlashAngle 40.0`
  (degrees), `stemSlashThickness 0.125_sp`.
- Created in `layoutStem` only when `showStemSlash()` and the chord is unbeamed or the FIRST of
  its beam (`rendering/score/chordlayout.cpp:1258-1266`) — one slash per beamed group.
- Geometry (`rendering/score/tlayout.cpp:5399-5470`, constants `heightReduction 0.66`,
  `angleIncrease 1.2`, `lengthIncrease 1.1`):
  ```cpp
  double leftHang = conf.noteHeadWidth() * mag / 2;
  double startX = stemRight - leftHang;
  double startY = stemTipY - up * mag * stemSlashPosition * (straight || !hook ? heightReduction : 1);
  if (hook)      { endX = hook bbox right; endY = startY + up * (endX - startX) * tan(angle); }   // angle ×1.2 for ≥2 beams in Bravura/Finale Maestro/Gonville ("HACK … we must use smufl cutOut")
  else if (beam) { angle += up * beamAngle / 2; length = 2 sp (×1.1 if obtuse); endX = startX + length·cos; endY = startY + up·length·sin; }
  else           { rightHang = headWidth·mag/2 − stem->width(); endX = stemRight + rightHang; endY = … tan(angle); }
  ldata->stemWidth = stemSlashThickness * mag;
  ```
  So: the slash starts half a (scaled) head LEFT of the stem, `2.0 sp × 0.7` (× 0.66 when there
  is no hook or with straight flags) BELOW the stem tip, rises at 40° to the hook's right edge;
  through a beam it is a 2 sp line at 40° ± half the beam's slope; thickness 0.125 × 0.7 sp.
  Kerning: a slash may collide with items of its own grace beam
  (`rendering/score/horizontalspacing.cpp:1781-1804`).

#### 3.7 Beaming

Automatic and SEPARATE: `BeamLayout::beamGraceNotes(ctx, chord, after)` is run per chord for
before and after groups (`rendering/score/beamlayout.cpp:718-724`, body `:552-620`), using
`Groups::baseBeamMode` per grace and breaking at ≤ quarter or `BeamMode::NONE`; it never sees the
principal, so a grace beam cannot join it. Thickness and distance × `graceNoteMag`
(`beamlayout.cpp:332-341`; `beamtremololayout.cpp:53-82`). "Make sure grace & small note inner
beams are within the stave" (`beamtremololayout.cpp:751-771`).

#### 3.8 Slur

NOT auto-created by the palette/shortcut (`Score::setGraceNote`, `cmdAddGrace`,
`addGraceNotesToSelectedNotes` create only the chord). Slur layout: zero-length slurs allowed
when an end is a grace (`rendering/score/slurtielayout.cpp:87-88`); anchors add the parent-chord
offset (`:456-461`); grace-after uses the appended segment's shape (`:1168-1190`); collision uses
the grace CHORD's shape (`:2226-2271`); direction-mixture exceptions (`:2665-2669`, `:2954-2966`);
a slur between a grace-before and its parent (or a parent and its grace-after) scales by
`graceNoteMag` (`dom/slur.cpp:388-409`). When a slur is added over a selection the endpoints
prefer `gracesBefore.front()` / `gracesAfter.back()` (`editing/edit.cpp:1814-1830`, `:1856-1870`).

#### 3.9 Accidentals

Laid out per grace chord separately (`rendering/score/chordlayout.cpp:2281-2288`); no `mag()`
override so they take the chord's 0.7; pair padding scales by the mean of both mags
(`rendering/score/accidentalslayout.cpp:1151-1160`); grace-after accidentals are kept close to
their chord (`:1146-1149`); accidental state walks grace-before → main → grace-after
(`dom/chord.cpp:1170-1225`, `dom/measure.cpp:411-421`).

#### 3.10 Bar lines, measure start, breaks

A grace before the first chord of a bar is inside that chord, pre-appended to the bar's first
`ChordRest` segment, i.e. AFTER the clef/key/meter segments and the bar line; ordinary segment
spacing keeps it clear (no grace-specific bar rule; `barGraceDistance` is dead). Grace-after at
a measure end: see §3.3 — UNKNOWN. System breaks: nothing grace-specific found (skyline only,
`rendering/score/systemlayout.cpp:1717-1727` "add grace notes to skyline") — UNKNOWN.

#### 3.11 Playback — two renderers, both ON the beat

- Modern MPE renderer (`playback/renderers/gracechordcontext.cpp:42-59`):
  ```cpp
  const duration_t halvedDuration = 0.5 * ctx.nominalDuration;
  const duration_t twoThirdsDuration = (2 * ctx.nominalDuration) / 3;
  if (type == PostAppoggiatura || (type == PreAppoggiatura && graceNotesCount == 1)) {
      if (ctx.timeSignatureFraction.isCompound() && ctx.nominalDurationTicks > QUAVER_TICKS) return twoThirdsDuration;
      else return halvedDuration;
  }
  const duration_t minAcciacaturaDuration = durationFromTempoAndTicks(ctx.beatsPerSecond.val, DEMISEMIQUAVER_TICKS / 2);
  return std::min(minAcciacaturaDuration * graceNotesCount, halvedDuration);
  ```
  Appoggiatura: 1/2 of the principal (2/3 in compound meter when longer than a quaver);
  acciaccatura and multi-note pre-groups: n × a 64th-note's time, capped at 1/2. Principal is
  DELAYED for both (`:95-133` `principalNotesStartTimestamp`), nothing is taken from the
  previous note; post-graces are placed at `nominalTimestamp − availableDuration`, i.e. inside
  the principal's tail. Mapping `playback/metaparsers/internal/gracenotesmetaparser.cpp:44-62`:
  ACCIACCATURA → `Acciaccatura`; APPOGGIATURA/GRACE4/16/32 → `PreAppoggiatura`; `*_AFTER` →
  `PostAppoggiatura`.
- Legacy MIDI (`compat/midi/compatmidirender.cpp:539-588`): "grace notes start on the beat of
  the main note … appoggiatura: 0.5 * duration of main note (2/3 for dotted notes, 4/7 for
  double-dotted) … acciacatura: min of 0.5 * duration or 65ms fixed" (in the code the
  acciaccatura branch sets `ontime = 0; graceDuration = 0`); grace-after `trailtime = 500 / 667 /
  571` ‰ of the principal by dots (`:617-641`); graces are dropped when a trill/ornament
  already plays them (`compatmidirenderinternal.cpp:1741-1754`).

#### 3.12 MusicXML, UI, chords, rests, tuplets, voices

- Import (`src/importexport/musicxml/internal/import/importmusicxmlpass2.cpp:7058-7062`,
  `:6580-6595`): `slash="yes"` → ACCIACCATURA, else by written type (quarter → GRACE4, 16th →
  GRACE16, 32nd → GRACE32, otherwise APPOGGIATURA); `steal-time-previous ≥ 0` (or a slur/wavy
  line stop) decides AFTER vs before (`:7407-7413`) — no timing is imported; grace rests are
  dropped (`:7232` "ignoring grace rest"). Export (`…/export/exportmusicxml.cpp:4394-4400`)
  writes `<grace slash="yes"/>` keyed on `showStemSlash()`; `steal-time-*` is NEVER written;
  `<note-size type="grace">` = `graceNoteMag × 100` (`:1422-1423`).
- UI: palette `newGraceNotePalette` with eight action icons (`src/palette/internal/palettecreator.cpp:1100-1119`);
  actions `acciaccatura`, `appoggiatura`, `grace4`, `grace16`, `grace32`, `grace8after`,
  `grace16after`, `grace32after` (`src/notationscene/internal/notationuiactions.cpp:864-918`);
  only `acciaccatura` has a default shortcut, `/` and `Num+/` (`src/app/configs/data/shortcuts.xml:720-724`).
- Grace chords with several notes: yes (ordinary `Chord`). Grace on a rest: no (`Rest` has no
  storage). Tuplets inside graces: no (reader has the tuplet add commented out,
  `rw/read460/measureread.cpp:269-284`; UI skips graces, `src/notation/internal/notationinteraction.cpp:5540-5542`).
  Voice 2: the grace inherits the track (`cmd.cpp:672`) and gets a DOWN stem (§3.5).

---

### 4. Comparison table

| Question | LilyPond | Verovio | MuseScore |
|---|---|---|---|
| 1 Data model | First-class NOTE events inside a `GraceMusic` wrapper; the wrapper sets a NEGATIVE start moment; written duration is the note's own; nothing is "attached" to a principal (`grace-music.cc:32-36`) | Sibling `<note>`/`<chord>` in the layer with `@grace = acc/unacc/unknown`, optionally in `<graceGrp attach=pre/post>`; written `@dur` kept; alignment duration 0 (`layerelement.cpp:661-666`) | Grace `Chord` is a CHILD of the principal `Chord` (`m_graceNotes`), typed by `NoteType` enum; written `TDuration` on the grace chord (`chord.h:53-66`, `:411-414`) |
| 1 acc vs app | Not a property: `\acciaccatura` = `\grace` + slur + `Flag.stroke-style = "grace"`; `\appoggiatura` = + slur; `\slashedGrace` = slash, no slur (`ly/grace-init.ly:25-58`) | The enum on the note (`GRACE_unacc` = slash) | `NoteType::ACCIACCATURA` vs `APPOGGIATURA`, plus an overridable `showStemSlash` defaulting from it |
| 1 before/after | `\afterGrace` = grace group after a skip of `afterGraceFraction` (3/4) of the main note | `graceGrp@attach` — MIDI only, no layout effect | `*_AFTER` enum values; `graceNotesAfter()` |
| 2 Timing | `Moment (main, grace)`, lexicographic compare, grace part NEGATIVE before its main moment (`moment.cc:52-60`) | A `GraceAligner` hung on the principal's alignment, internal times `0, −d, −2d…` from the last grace backwards (`horizontalaligner.cpp:391-420`) | Same `tick()` as the parent; order = `graceIndex` (`engravingitem.cpp:609-621`) |
| 3 Spacing | Own spacing law: `GraceSpacing` `shortest-duration-space 1.6`, `spacing-increment 0.8` (main: 2.0 / 1.2); join into a run × 0.8 "arbitrary"; graces excluded from the shortest-note statistic (`spacing-basic.cc:163-180`, `spacing-spanner.cc:396-403`) | Bounding-box packing right-to-left; gap to principal `leftMarginNote(1.0) × 0.75 unit` = 0.375 sp; between graces `1.0 × 0.75 unit`; to the previous note 1.0 unit = 0.5 sp (`adjustgracexposfunctor.cpp:69-88, 156-198`) | Shape packing; `graceToMainNoteDist 0.45 sp`, `graceToGraceNoteDist 0.3 sp`; group shape becomes the segment's left padding (`styledef.cpp:518-519`, `tlayout.cpp:2744-2828`) |
| 4 Size | `font-size -3` = 0.707 (heads/stems/flags/dots), accidentals `-4` = 0.63, stem `length-fraction 0.8`, beams 0.8 | `graceFactor` 0.75 (0.5–1.0) on everything incl. stem length; beamed stems × hard-coded 0.75 | `graceNoteMag` 0.7 on everything incl. stem length (via `intrinsicMag`) |
| 5 Stem dir | UP at Score level; polyphonic voices keep their direction | UP for notes and grace beams (above the layer direction); grace CHORDS follow pitch | UP unless multi-voice (voice parity wins) |
| 6 Slash | Flag: font glyph `flags.ugrace` (pen 1.5 × stem thickness, from (−0.72·hip_width, −2.16 sp) to (hip_width, +1 sp)); beam: only via `\slashedGrace`, one line on the first stem, `slash-X-positions (−0.5 . 1)`, `slash-slope 2`, `over-beam-height 0.75`, `slash-stem-fraction 0.3` (`output-lib.scm:350-440`) | Only unbeamed `unacc`: 45° line from `(x−0.75u, tip−3u)` to `(x+1.5u, tip−0.75u)`, 1.2 × stem width, `// HARDCODED`; NO slash on beamed groups (`view_element.cpp:1785-1791, 2035-2082`) | `StemSlash` element: starts half a head left of the stem, `2.0 sp × mag` below the tip, 40°, `0.125 sp × mag` thick; through a beam a 2 sp line at 40° ± beam slope/2; once per beamed group (`tlayout.cpp:5399-5470`) |
| 7 Beaming | `Grace_beam_engraver` + `Grace_auto_beam_engraver` ("one autobeam group across an entire grace phrase"), nested with the main beam; thickness 0.384 vs 0.48 | No auto-beam; explicit `<beam>`; graces inside a normal beam are DROPPED; thickness × 0.75 | Auto, separate `beamGraceNotes` per before/after group; never joins the principal; thickness × 0.7 |
| 8 Slur | AUTO for `\acciaccatura`/`\appoggiatura`, own `spanner-id 'grace`, forced DOWN | Not auto; grace→note slurs get their own direction (notehead side) and endpoint rules | Not auto; special anchors/collision/scaling (`× graceNoteMag`) |
| 9 Accidentals | `-4` (0.63), no special spacing | Cue-sized; margin `1.0 × 0.75 unit`; excluded from the principal's edge when no vertical overlap | 0.7; laid out per grace chord; padding by mean mag |
| 10 Bar/line | In the bar AFTER the bar line ("Bar line should come before the grace note"); synchronisation across staves is on the full moment (known issue) | Sorted after clef/key/meter alignments at the same time; cannot pass the left bar line; clef changes are always before graces (limitation) | Pre-appended to the first ChordRest segment ⇒ after clef/key/meter; `barGraceDistance` dead; breaks UNKNOWN |
| 11 Playback | Each grace = 9/40 of its written value (doc says 1/4), stolen from the PREVIOUS note if they overlap; no on-beat appoggiatura (`audio-item.cc:120-124`, `note-performer.cc:99-116`) | `acc`: `@grace.time` % (default 50, clamp 5–95) of the principal ON the beat; `unacc`: `tempo/2048` ♩ each, before the beat if room (`midifunctor.cpp:504-541`) | Both ON the beat: appoggiatura ½ (⅔ compound), acciaccatura n × 64th capped at ½; after-graces in the principal's tail (`gracechordcontext.cpp:42-59`) |
| 12 Chords/rests/tuplets/voices | All supported: chords, rests, `\grace s16` skips, tuplets, part-combine; nesting `\grace` in `\grace` NOT supported | Chords yes; rests only inside `graceGrp` and never x-positioned; tuplet not a `graceGrp` child; one aligner per staff | Chords yes; rests no; tuplets no; voice 2 flips the stem |
| 13 Gotchas | Beamed acciaccatura has no slash; grace sync moves bar lines; 0.8 "arbitrary"; MIDI "Going back in time" | `// HARDCODED` slash; stem length "debatable"; beamed graces "once MEI has a better modeling"; `@attach`/`@grace.time` MIDI-only | `graceIndex` "not well-maintained"; TAB "HACK"; `barGraceDistance` unused; `steal-time-*` never exported |

### 5. Where they agree and where they differ

Agree: (a) size ≈ 0.7 (0.707 / 0.75 / 0.7) applied to head, stem, flag, beam and accidental, with
the stem shortened by the same factor (LilyPond 0.8) and the "reach the middle line" rule switched
off; (b) stems UP by default, with an escape for polyphony; (c) the grace group is packed RIGHT to
LEFT from the principal, closer to it than to the preceding note, and excluded from the bar's
rhythmic-spacing statistic; (d) grace beams are their own beams, thinner by the same factor, and
never join the principal; (e) an acciaccatura slash is one stroke near the flag, and on a beamed
group at most one stroke on the first stem; (f) `steal-time` is not what the model stores — the
model stores TYPE (or slash) and playback derives the timing.

The one real disagreement: the DATA MODEL / TIME MODEL. LilyPond makes a grace a real event at a
negative sub-moment, so every engraver (bar lines, key signatures, lyrics, MIDI) sees it and has to
be taught to ignore or synchronise it — its known-issues list is the cost. MuseScore attaches the
grace to the principal chord and hides it from the tick line, so nothing else sees it — its cost is
the after-grace hack (pre-appended to a different segment and re-offset after spacing) and a
`graceIndex` that "is not well-maintained". Verovio sits between: a sibling event, but with zero
alignment duration and a side aligner. A second, smaller disagreement is playback of the
acciaccatura: LilyPond steals from the previous note, Verovio steals before the beat only if there
is room, MuseScore always delays the principal.

---

## Part C — Grace notes in the engraving literature — research report (2026-09-22)

Sources read from disk (`reference/`), per `reference/README.md`:

- **Gould, *Behind Bars*** — printed pp. 26, 43, 84, 125–131, 138, 159, 283, 297, 569, 610–611, 630–631 (PDF = printed + 20), every page RENDERED with `pdftoppm -r 300` and read from the scan; the figures on pp. 125, 126, 127, 129 re-rendered at 600 dpi and MEASURED (1 stave-space = 26.6–27.0 px at 600 dpi, from the detected staff lines). Quotations below are transcribed from the rendered page, never from the OCR layer.
- **Ross, *The Art of Music Engraving*** — printed pp. 189–191 (PDF 201–203), clean OCR text confirmed against the rendered pages.
- **Stone, *Music Notation in the Twentieth Century*** — printed pp. 21–22, 42, 49–51, 136–137, 140–141 (2-up PDF: printed 21 = right half of PDF 21, 22 = left of PDF 22, 42 = left of PDF 32, 49 = right of PDF 35, 50–51 = PDF 36, 136–137 = PDF 79, 140–141 = PDF 81). Dirty OCR used ONLY to locate; wording taken from the rendered halves.
- **Gerou & Lusk, *Essential Dictionary of Music Notation*** — printed pp. 54–55 (Cue notes), 72–74 (Grace notes), PDF 29, 38–39 rendered; the `.txt` agrees.

Measurement conventions: "sp" = stave-space; "head centre" = centre of the notehead's ink box; stem length = head centre to stem tip (Gould p. 14's own convention). Positions in the crops are given in 600-dpi pixels so they can be re-checked.

---

### 1. SIZE of a grace note, and its stem length

| source | page | quotation | measured drawing |
|---|---|---|---|
| Gould | 125 | *"Grace notes are notated as small noteheads with stems shortened to about **2¼ stave-spaces**. Tails, beams, articulation and accidentals are also scaled down proportionally. The sharp and natural signs become 2 spaces long (rather than the normal 3), the flat is 1¾ spaces long."* | — |
| Gould | 125 | *"The grace note is slightly smaller than a cue note, which is **¾ of a full-sized note** (see Cue notation, p. 569)."* | **Her p. 125/126/129 figures, measured**: grace head **0.83–0.87 sp wide × 0.60–0.67 sp tall**; full-size head in the same figures **1.31–1.35 × 1.08–1.12 sp**. Ratio **≈0.64 (width), ≈0.58 (height) — i.e. ≈⅝, below the cue's ¾**, as the sentence says. |
| Gould | 569 | *"Cue notation is about three-quarters the size of full-sized notation … Stem lengths are 2–2½ stave-spaces long. Cue notes are usually slightly larger than grace notes (stem lengths of both tend to be the same)."* | — |
| Gould | 125–129 (stems) | (2¼ stated, above) | **Flagged single grace stems, head centre → tip: 2.22 · 2.27 · 2.32 · 2.37 · 2.40 · 2.46 · 2.52 · 2.56 · 2.58 · 2.60 · 2.65 · 2.67 sp** (12 instances on pp. 125, 126, 129; beamed-group stems 2.36–3.09). Median **≈2.5 sp**. Full-size stems in the same figures: 3.25–3.53 sp. ⚠️ **Her drawn stem is nearer Stone's 2½ than her own 2¼**; the grace stem is ≈0.75 of a full stem, NOT scaled with the head (≈0.62). |
| Gould | 126 | *"Ensure that a grace note on ledger lines has a sufficiently long stem for the diagonal stroke not to obscure a ledger line"* (drawn and/not pair) | — |
| Ross | 190 | *"The grace note is slightly smaller than the cue note, and is generally stemmed upward."* | — |
| Ross | 189 | (cue size) *"Its size is determined by the staff and tool sizes used. For staff sizes one, two and three, the note size for staff six is used; for staff sizes four, five and six, the note size for staff seven is used."* — a tool-set number, no ratio. | — |
| Stone | 49 | *"6. GRACE NOTES — Stems usually take up about **2½ spaces**"*; *"7. CUES — Stems usually take up about 3 spaces"* | — |
| G&L | 72 | *"Grace notes are notated at **cue size** or slightly smaller (**65% of normal size** works well)."* | — |
| G&L | 54 | *"The size of cue notes is somewhat smaller than normal note size, but still large enough to be legible (**65–75%** of normal note size)."* (drawn 65% / 75% / 100% triplet) | — |
| G&L | 73 | *"Stems for grace notes on leger lines do not have to be lengthened to meet the middle line."* | — |

**Numbers in one line**: head scale ≈ **0.6–0.65** (Gould's drawing 0.58–0.64; G&L 65%; Gould's prose only says "< ¾"); stem **2¼ (Gould prose) / 2½ (Stone; Gould's own drawing)**; grace accidentals ♯♮ = 2 sp, ♭ = 1¾ sp (Gould).

### 2. STEM DIRECTION

| source | page | quotation |
|---|---|---|
| Gould | 126 | *"Grace notes take up-stems, regardless of their position on the stave. An exception to this is where there are two parts on one stave, in which case the lower part takes down-stems"* |
| Gould | 127 | *"The other exceptions are: where there are double-stemmed beams (as shown above); also, where grace notes are attached to a measured value (see Grace notes on the beat, p. 129)."* |
| Gould | 129 | *"…by joining them to a measured note (b). In the latter case, grace-note stems should point away from the measured notes"* |
| Gould | 283 (percussion, one line) | *"Grace notes take up-stems, regardless of the prevailing stem direction."* |
| Ross | 190 | *"…generally stemmed upward. The exception, however, is with divided voices when it is stemmed in the same direction as the voice to which it belongs."* |
| Ross | 191 | *"Grace notes occurring at the termination of a trill should be stemmed in the same direction as the main note to avoid conflict with the slur and trill; the slur is sometimes omitted."* |
| Stone | 21 | *"They should have upstems regardless of their position in the staff unless the staff contains more than one part."* |
| Stone | 50–51 | *"4. GRACE NOTES — Grace notes should always have upstems except in double-stemmed contexts, where their stems generally follow the part to which they belong, i.e., point away from the staff"* |
| G&L | 72–73 | *"Place the stem up regardless of the main note's stem direction (except when two parts share a staff)."* / *"When two parts share a staff, the grace note stems follow the stem direction of the parts."* |

Four for four: **up, always**; the ONE exception all four name is the second voice on a shared stave (lower part down). Gould adds two more: double-stemmed beams and graces beamed onto a measured note; Ross adds the trill's Nachschlag (follows the main note).

### 3. The acciaccatura SLASH

| source | page | quotation | measured drawing |
|---|---|---|---|
| Gould | 125 | *"A single grace note is a small quaver with a diagonal stroke that intersects the tail. It is essential to use the diagonal stroke to differentiate the grace note from an appoggiatura"* (drawn pair *Grace notes* / *Appoggiaturas*) | **Up-stem singles (pp. 125, 126, 129, three instances, 600 dpi): slash length 2.1–2.2 sp; angle 38–39° above horizontal, rising to the right; it crosses the stem 1.14–1.17 sp below the stem tip (≈ the middle of a 2.3–2.7 sp stem); ≈0.5 sp of it lies on the outer (head) side of the stem and ≈1.15 sp on the flag side, its upper end clearing the flag by ≈0.3 sp; stroke thickness ≈0.09 sp (stem ≈0.11).** |
| Gould | 126 | *"The diagonal line should intersect the tail or beam without colliding with the notehead"* (and/not pair) · *"Place the diagonal stroke so that, ideally, white space shows through between the stem, the tail or beam and the diagonal."* | — |
| Gould | 126 | *"PLACING DIAGONAL LINES ON GRACE-NOTE GROUPS — Place the line at the beginning of a group, and diagonally to the beam"* (two drawn groups: the stroke through the first stem and the beam's start) | — |
| Gould | 126 | *"With double-stemmed beams … the stem direction of the first note determines the position of the diagonal line. **The direction of the diagonal is the same as for the single grace note of the same stem direction**"* | **Down-stem singles (pp. 125 and 126, two instances): the slash is the vertical MIRROR — it FALLS left-to-right at 42–43°, crossing the stem 1.16–1.24 sp above the (lower) tip, length ≈2.2 sp.** |
| Gould | 125 | *"A group of grace notes is joined by one or more beams. A diagonal stroke **may** be placed through the beam if grace notes might otherwise be confused with an appoggiatura."* · *"It is common practice to place a diagonal line through a single beam. If preferred, in addition two or more beams may be used"* | — |
| Ross | 190 | *"1. The slash through the stem and flag goes from the lower left to the upper right."* (CORRECT / INCORRECT pair — ⚠️ both drawn on a **down-stem** note: his correct slash still rises to the right) | — |
| Ross | 190 | *"2. The slash should bisect the flag in such a manner as to permit white space to be seen towards the end of the stem joining the flag."* (CORRECT: slash through the middle of the flag; INCORRECT: slash at the flag's far end) | — |
| Ross | 191 | *"Two or three beamed grace notes bear the value of sixteenth notes. Four or more have the value of thirty-second notes."* — his beamed-group figure carries **no** slash. | — |
| Stone | 22 | *"Single grace notes must have a thin slanted line through stem and flag; two or more grace notes **must** have the slanted line through stem and beams."* footnote: *"If the slanted line is omitted, single grace notes turn into appoggiaturas, which have measured durations depending on the durational context in which they occur"* | — |
| G&L | 72 | *"For single grace notes with a flag, a small line can intersect the flag, **always slanting upward, from left to right, regardless of stem direction**."* (drawn: up-stem and a down-stem lower-voice grace, both rising) | — |
| G&L | 73 | *"Multiple grace notes should **never** have a slanted line through the stems or beams. The slanted line is only for single, flagged grace notes."* | — |

Meaning: all four use the slash as the acciaccatura/appoggiatura discriminator (Gould, Stone explicit; G&L's definition below; Ross's chapter title *"…as appoggiaturas, acciaccaturas or trills"*). None gives an angle or length in words — Gould's drawing is the only number source (≈2.1 sp, ≈40°, mid-stem).

### 4. SLUR from grace to main note

| source | page | quotation | measured drawing |
|---|---|---|---|
| Gould | 129 | *"Grace notes are slurred to the following measured value, provided that this is the required articulation. Slurs should not be used with grace notes on instruments of indefinite pitch"* · *"**The slur goes below the grace note, from notehead to notehead**"* | **p. 129 first example: slur starts at x = grace-head centre (+0.04 sp), ends 0.17 sp left of the main-head centre; ends 0.50 sp (grace) / 0.34 sp (main) below the head bottoms; span 2.4 sp; thickest 0.3 sp.** p. 125 first example: starts under the grace-head centre (0.0 sp), runs under the main head. |
| Gould | 129 | *"When there are two parts on a stave, curve the grace-note slurs away from the stave. The slurs may be placed close to noteheads where they would otherwise collide with beams"* | — |
| Gould | 129 | *"A slur must not obscure a ledger line. It is often preferable to place slurs above ledger lines to avoid collision"* | — |
| Gould | 130 | *"A slur should always be placed above the notes when it would otherwise collide with the accidentals of a measured value … and so that grace notes can be slurred to the uppermost note of a chord (the slur should lead to the pitch that resolves the ornament)"* | — |
| Gould | 130 | *"It is usual (and recommended practice) for each grace-note group to take an independent slur, even when this occurs within a standard slur … It is also acceptable to include grace notes within a standard slur, and to omit independent slurs. Although this is less fussy, the grace notes lose some visual definition"* | — |
| Gould | 297 (drums) | *"Do not use a slur between a single grace note and a following measured note, because the strokes are played with different hands."* (slur = same hand, *closed strokes*) | — |
| Ross | 191 | *"Slurs used in conjunction with grace notes usually go from the note head of the grace note to the note head of the main note. Since grace notes are generally stemmed up, the slurs will generally go beneath the note heads."* | — |
| Ross | 191 | *"When a single grace note leads into a note that has an additional note head on the same stem, the slur is placed on the opposite side from the additional note head."* · *"When grace notes appear among leger lines, the slur should be placed so as to avoid coming in contact with the leger lines."* (CONFUSING / CORRECT pair, slur moved above) | — |
| Stone | 22 | *"It used to be customary to slur grace notes to the main note, but since such slurs are superfluous it is recommended that they be omitted. As a result of this omission, a tied grace note becomes more immediately recognizable."* · *"It was also customary to begin a full-size legato slur at the first main note of a phrase … This practice should be revised to include the grace note(s) in the slurs"* | — |
| Stone | 42 | *"If, in spite of these recommendations, grace notes are to be treated in the more traditional way … The small slurs or ties should curve downward (the stems always point up) and full-size slurs begin at the main note."* | — |
| G&L | 72 | *"Usually a small slur connects the grace note to the main note; the slur usually begins below the grace note."* · *"The slur end does not need to be centered on the main notehead like slurs normally do. It may end slightly to the left of the notehead."* | — |
| G&L | 73–74 | *"If a grace note precedes an interval or chord, the slur will follow the direction of resolution"* · *"If leger lines are used, the slur may be placed above to avoid the leger lines."* | — |

### 5. BEAMING of grace groups

| source | page | quotation |
|---|---|---|
| Gould | 125 | *"The traditional practice is to use most commonly two, but often three, beams to join groups of two or more notes. **Two beams are recommended** as they give the least cluttered appearance"* · *"Some editions use two beams to join two notes and three beams to join three or more notes. Four beams sometimes join four or more notes"* · *"Tails, beams … are also scaled down proportionally."* |
| Ross | 191 | *"Two or three beamed grace notes bear the value of sixteenth notes. Four or more have the value of thirty-second notes."* |
| Stone | 22 | *"Single grace notes should be notated as eighths; two or more grace notes as sixteenths."* |
| G&L | 73 | *"Two grace notes are considered sixteenth notes and should be beamed accordingly. Three and four can be either sixteenth or 32nd notes."* / *"Larger groupings, such as five and six grace notes, are usually beamed as 32nd notes."* |

Always beamed when 2+ (all four; nobody shows two flagged 16ths). Beam thickness: Gould says "scaled down proportionally"; no book gives a number and my erosion-based measurement of her grace beams was not reliable (⛔ not reported). Grace-to-grace centre spacing inside a beamed group, measured: **1.50 sp** (three 16ths, p. 127), **1.85 sp** (two 16ths, p. 129), **2.22–2.28 sp** when each carries a flat (p. 127).

### 6. HORIZONTAL SPACING

| source | page | quotation | measured drawing |
|---|---|---|---|
| Gould | 43 | *"Where space is limited, an accidental or grace note may be closed up to within ½ space of a barline. Stems must never come closer to a barline than one space, because the close parallel lines are difficult to read"* | — |
| Gould | 127 | *"Grace notes are placed before the position of the beat regardless of whether they are performed on or before the beat. Grace notes preceding the first beat of a bar are usually placed **after** the barline"* | **p. 127 fig. 1 bar 2: barline → first grace flat 1.01 sp; barline → grace head 1.98 sp.** |
| Gould | 127 | *"Grace notes sounding on the beat should always be placed after the barline. However, a group of three or more grace notes sounding before the beat may go before the barline so that the first beat of the following bar is not pushed too far from the barline"* | **p. 127 fig. 2: last grace stem → barline 1.25 sp; barline → the main note's ♮ 0.91 sp, → its head 1.96 sp.** |
| Gould | 127 | *"The finishing notes of a trill or tremolo are written as grace notes and should be placed before the barline"* | — |
| Gould | 127–128 | *"Grace notes written after the barline displace the first beat to the right. All other parts align with the measured value and not with the grace notes"* · *"note-spacing in one part need not necessarily be expanded to accommodate grace notes in another part … This facilitates score-reading, as it prevents distorted note-spacing of a single beat"* | — |
| Gould | 128 | *"When there are two parts on one stave, align the grace notes of the two parts"* · separate staves: *"it may be more helpful visually to close up grace notes to the following measured value, regardless of vertical alignment (accidentals may force some grace notes further apart than others…)"* | — |
| Gould | 159 | *"When another part contains grace notes, rests align with the measured note"* | — |
| Gould | 569 (cues) | *"Note spacing should be closed up within a cue: space characters in proportion to the reduced note size."* | — |
| — (measured only) | 125, 126, 127, 129 | no book states the gaps in words | **Last grace → principal, centre to centre: 2.11 · 2.11 · 2.22 · 2.23 · 2.27 · 2.33 · 2.38 · 2.42 · 2.47 · 2.50 (♮ between) · 2.60 · 2.99 (accent+slur) sp — typical ≈2.2–2.4.** Head-edge white gap grace→principal **0.8–1.5 sp, typical ≈1.15**. Between graces in a group: centre 1.5–1.85 sp, edge gap **≈0.65–1.0 sp**. ⭐ So yes: the gap to the principal is LARGER than the gap between graces (≈1.15 vs ≈0.65–1.0) in her engraving. After a clef opening a line: clef → first grace head 2.4 sp (p. 127 fig. 1 bar 1). |
| Ross | 143 (per README) | barline → first note's left side **one space** | — |
| Stone | 141 | (spatial) *"full-size grace notes generally take up more horizontal space than they should in spatial notation"* — the only spacing remark. | — |
| ⛔ before/after a CLEF / KEY / METER change at that point | — | **UNKNOWN** — not stated in Gould pp. 125–131, 43, Ross 189–191, Stone 21–22/46, G&L 72–74. G&L p. 52 gives only the general order (clef before the barline; key and time after it); nothing places a grace group relative to them. |

### 7. ACCIDENTALS on grace notes

| source | page | quotation |
|---|---|---|
| Gould | 125 | *"The sharp and natural signs become 2 spaces long (rather than the normal 3), the flat is 1¾ spaces long."* |
| Gould | 78 (index *accidentals 78*) | OCR-located sentence: *"An accidental is scaled down in size only when placed before a grace note … or a cue note"* (⚠️ p. 78 not rendered — located in the text layer only). |
| Gould | 84 | *"Accidentals hold good equally for grace notes and for measured notes. However, unless the measured note follows the grace note almost immediately (bar 2), for safety it is best to repeat an accidental for a measured note"* · *"An accidental for a measured note is always deemed to hold good for a subsequent grace note"* · *"A grace-note accidental is cancelled for a subsequent measured note (bar 1), and a full-sized accidental is cancelled for a subsequent grace note (bar 2)"* |
| Gould | 128 | *"accidentals may force some grace notes further apart than others"* — measured: a flat before each grace widens the grace-to-grace centre spacing from 1.5 to ≈2.25 sp (p. 127). |
| Ross | 190 | *"Most sets of tools used by engravers contain a note head, sharp, flat and natural sign to be used as a grace note."* |
| G&L | 72 | *"Grace-note accidentals are also cue size."*; Accidentals entry: *"The accidental placed on a grace note will be smaller (cue size), like the grace note."* |
| Stone | — | nothing on grace accidentals (pp. 21–22, 42, 49–51 checked). |

### 8. Grace notes AFTER a note (Nachschlag); before a chord / rest

| source | page | quotation |
|---|---|---|
| Gould | 127 | *"The finishing notes of a trill or tremolo are written as grace notes and should be placed before the barline"* (two drawn examples, slurred from the trilled note over the graces) |
| Gould | 138 | *"A grace note may specify when the starting note is other than the written note (a). Grace notes should also be used to specify finishing notes. According to the required articulation, slur the grace notes to the measured note (b) or to the following note (c), or include both (d)"* |
| Ross | 191 | *"Grace notes occurring at the termination of a trill should be stemmed in the same direction as the main note to avoid conflict with the slur and trill; the slur is sometimes omitted."* |
| Stone | 22 | (only) *"a tied grace note becomes more immediately recognizable"* — a grace TIED to its main note. |
| Gould | 130 | before a CHORD: *"grace notes can be slurred to the uppermost note of a chord (the slur should lead to the pitch that resolves the ornament)"* |
| Ross | 191 | before an INTERVAL: *"the slur is placed on the opposite side from the additional note head"* |
| G&L | 73 | *"If a grace note precedes an interval or chord, the slur will follow the direction of resolution"* |
| ⛔ before a REST | — | **UNKNOWN** — no sentence or figure in any of the four (Gould p. 129's rhythm examples put graces AFTER a rest, never before one). |

Which note a Nachschlag is attached to: Gould's p. 127/138 drawings (b) hang the finishing graces on the trilled note (slur from it), (c) on the following note; the notation is the same small beamed group, only the slur decides. No book gives an "after-note" spacing.

### 9. Second voice / multi-voice / across staves

| source | page | quotation |
|---|---|---|
| Gould | 126 | lower part on a shared stave takes down-stems (drawn); double-stemmed beams across two staves of a braced part: *"the stem direction of the first note determines the position of the diagonal line"* (piano figure, refers to *Double-stemmed beams*, p. 315) |
| Gould | 128 | *"When there are two parts on one stave, align the grace notes of the two parts"*; separate staves — close up to the measured value instead |
| Gould | 129 | two parts on a stave: *"curve the grace-note slurs away from the stave"* |
| Ross | 190 | *"with divided voices … stemmed in the same direction as the voice to which it belongs"* |
| Stone | 42 | *"In double-stemmed passages, grace notes are treated like the other notes: upstems and upward-curving slurs or ties for the upper voice, the opposite for the lower voice"* |
| G&L | 73 | *"When two parts share a staff, the grace note stems follow the stem direction of the parts."* |
| ⛔ cross-staff (keyboard) beyond the p. 126 double-stemmed figure | — | **UNKNOWN** — Gould's keyboard chapter index (*grace notes 26, 126, 129*) points back to these pages only. |

### 10. Vertical: ledger lines, collision with the main note's accidental

| source | page | quotation | measured |
|---|---|---|---|
| Gould | 26 | *"Grace notes take ledger lines that are shorter and thinner than full-sized notes, in proportion to their smaller noteheads"* | — |
| Gould | 126 | *"Ensure that a grace note on ledger lines has a sufficiently long stem for the diagonal stroke not to obscure a ledger line"* | — |
| Gould | 569 (cues) | *"Ledger lines for cue notes should be the same vertical distance apart as full-sized ledger lines (although they are thinner)"* | — |
| Gould | 130 | *"A slur should always be placed above the notes when it would otherwise collide with the accidentals of a measured value"* (and/not pair: grace ♮-e above a ♯-chord) | — |
| G&L | 72 | *"The grace note is centered in a space or placed directly on a line."* | Gould's heads: centres at 0.47–0.51 sp (spaces) and 0.98–1.02 sp (lines) from the top line — on the pitch exactly. |
| G&L | 73–74 | *"Stems for grace notes on leger lines do not have to be lengthened to meet the middle line."* · *"The grace-note leger lines can be the **same thickness** as staff lines, but shorter."* | — |

### 11. RHYTHMIC MEANING (playback)

| source | page | quotation |
|---|---|---|
| Gould | 125 | the stroke distinguishes grace note from appoggiatura (§3); no realisation given. |
| Gould | 127 | *"Grace notes are placed before the position of the beat regardless of whether they are performed on or before the beat."* |
| Gould | 128 | *"Unless the context is very obvious, clarify where grace notes are to be placed. To write grace notes before a barline clearly indicates that they should be sounded before the first beat but this notation is limited to first beats. A general instruction is unambiguous: 'all grace notes to be placed before the beat / on the beat'."* |
| Gould | 129 | *"When grace notes are to be placed both on and before the beat, different articulation may indicate placing (clarify this with an instruction)"* (accent or tenuto on the grace = on the beat, on the main note = before) · *"If accents are not appropriate, differentiate notes to be sounded on the beat either by writing them in rhythm (a) or, alternatively, by joining them to a measured note (b)"* |
| Gould | 297 | drums: closed strokes *"crushed in immediately before the beat"* |
| Stone | 21 | *"Grace notes are performed as fast as possible and must always be notated before the beat."* |
| Stone | 22 fn. | *"If the slanted line is omitted, single grace notes turn into appoggiaturas, which have measured durations depending on the durational context in which they occur"* + a drawn *"may be performed"* pair; *"Although appoggiaturas are not often used in twentieth-century music, they are nevertheless part of today's musical vocabulary due to our century's revival of old music."* |
| G&L | 72 | *"Grace notes are small notes without a rhythmic value of their own, taking their value from the previous or following beat."* |
| Ross | — | nothing on performance (pp. 189–191 are drawing rules only). |
| ⛔ "takes half the value" | — | **UNKNOWN as a stated rule** — none of the four writes the half-value (or two-thirds) appoggiatura rule; Stone's footnote figure is the only realisation drawn, and its note-values were not read at measurement resolution. |

### 12. FREE / UNMEASURED music and the grace-note mechanism

| source | page | quotation |
|---|---|---|
| Gould | 630 (*Freedom and choice → Proportional spacing*) | *"The fastest notes dictate the minimum measurement a time-unit requires. These fast notes must not only fit into the required measurement, or a proportion of it, but must be spaced equally if they are to be performed evenly … To this end, **conventional grace-note groups – to indicate playing a group as fast as possible – may be retained, since they occupy less space than a full-size note** (see Table 2, opposite)."* |
| Gould | 631 (Table 2) | Three notation options (a) stemless heads, (b) heads + extender lines, (c) duration beams — **all three keep a slashed grace-note group** (a ♭-grace before the chord) drawn exactly as on p. 125. *"A stemless notehead placed on the time–space axis is held … until the next note, barline or other marker … Very short notes can be indicated with staccato marks"* |
| Gould | 611 | *"A bar or section without metre … is labelled senza misura … An 'X' placed on the stave cancels an existing time signature"* · *"A stemless note may also indicate a note of unmeasured duration"* — nothing grace-like there. |
| Gould | 610 | cadenzas: *"it may be barred metrically · dotted barlines may demarcate sections … · it may be notated without barlines"* — full-size notes with a `♩=♩` equivalence; no small notes. |
| Stone | 136–137 | *"Spatial or proportional notation is a system in which durations are 'translated' into horizontal distances instead of duration symbols"* · *"all duration symbols … become irrelevant. Note-heads now are needed only as pitch indicators (black note-heads are preferred)"* · *"spatial notation is the ideal graphic vehicle whenever rhythmic flexibility or durational vagueness is desired"* |
| Stone | 140 | *"3. GRACE NOTES — Grace notes are used in the traditional manner. In slurred passages they should be included under the slur (see page 21 f)"* · *"The difference between grace notes and the unstemmed note-heads mentioned above is that **grace notes belong to a main note, while the unstemmed note-heads are generally independent short notes**."* · *"Grace notes could be written as small unstemmed note-heads, but such notation has proven to be unclear"* (drawn *not recommended*) |
| Stone | 141 | *"Another solution is to use an extra beam with slash for grace notes"* (full-size heads under a slashed extra beam) · *"This notation is more legible because all note-heads are equally large. Its drawback is that full-size grace notes generally take up more horizontal space than they should in spatial notation."* · accelerando/ritardando beams *"one should not be too dogmatic about banning them altogether from spatially notated music"* |
| Stone | 21 | grace notes = *"performed as fast as possible"* (the same words Gould uses for the proportional-notation use). |

Verdict on "is a free run an extension of the grace note?": **Gould — yes, explicitly**: in proportional notation the slashed grace group IS the notation for "as fast as possible", chosen for its compactness, and her Table 2 draws it unchanged. **Stone — with a distinction**: a grace group *belongs to a main note*; independent short notes are *unstemmed full-size heads* on the time axis, and he rejects small unstemmed heads as unclear. Neither book scales or respaces the grace group for free music; both keep the traditional drawing.

---

### Where the sources DISAGREE

1. **Stem length**: Gould prose **2¼** vs Stone **2½**; Gould's own engravings measure **2.22–2.67, median ≈2.5** — her drawing sides with Stone (the sixth "drawing vs sentence" case in this library, cf. README).
2. **Slash on beamed groups**: Stone *must*; G&L *never*; Gould *may / common practice*; Ross draws none.
3. **Slash direction on a down-stem**: G&L *"always slanting upward … regardless of stem direction"* and Ross's CORRECT figure (rising, on a down-stem note) vs **Gould, drawn twice: mirrored — falls to the right on a down-stem** (*"the same as for the single grace note of the same stem direction"*).
4. **The slur**: Gould, Ross, G&L — slur it, below, notehead to notehead; **Stone — omit it** and start the phrase slur at the grace.
5. **Beam count / value**: Gould two beams recommended for any group; Ross 2–3 notes = 16ths, 4+ = 32nds; Stone 16ths; G&L 2 = 16ths, 3–4 either, 5–6 = 32nds.
6. **Grace ledger lines**: Gould *thinner and shorter*; G&L *same thickness, shorter*.
7. **Grace vs cue size**: Gould grace < cue (¾), stems equal; G&L grace = cue or slightly smaller (65%; cue 65–75%); Stone grace 2½ < cue 3 (stems); Ross grace slightly smaller than cue. Same ORDER in all four (grace ≤ cue); the numbers differ (Gould's drawing ≈0.6, G&L 0.65).
8. **On/before the beat**: Stone *"must always be notated before the beat"* (performed before); Gould: placement is independent of performance, clarify by instruction/articulation.
9. **Slur end at the main note**: Gould/Ross "notehead to notehead" (measured: ends 0.17 sp left of the main-head centre); G&L "may end slightly to the left of the notehead" — consistent with Gould's drawing, not with her sentence.

### UNKNOWN / not found — checked where

- Grace notes vs a clef / key / meter change at the same point — Gould 43, 125–131; G&L 52, 72–74; Ross 189–191; Stone 21–22, 46, 50–51: nothing.
- Grace notes before a REST — same pages: nothing.
- The half-value appoggiatura realisation as a stated rule — nothing beyond Stone's p. 22 footnote figure (values not read).
- Grace beam THICKNESS and grace FLAG length — Gould says "scaled down proportionally" only; my measurement of her beams was unreliable (erosion merged the two beams) — ⛔ not reported.
- A slash angle/length in words — no book; Gould's drawing is the only source (≈2.1 sp, ≈39°, crossing ≈1.15 sp below the tip).
- Cross-staff grace notes in keyboard music beyond p. 126's double-stemmed figure — Gould keyboard chapter index points only to 26/126/129.
- Ross on performance meaning, and on grace spacing — silent.
- Gould p. 78 (accidental scaled only before a grace/cue note) — located in the OCR layer only, page NOT rendered; treat the wording as unverified.
- Gardner Read, *Music Notation* — not on disk (README "Still missing"); not consulted.

### Rendered / produced files

⚠️ The page renders, 600-dpi crops, measurement grids and the `measure.py` script this chapter used were written to a session scratchpad and are GONE. Every measurement above names its printed page and dpi; `pdftoppm -r 600 -f <printed+20> -l <printed+20>` on Gould (PDF = printed + 20), `-r 300` on Ross (PDF = printed + 12), and the 2-up halves of Stone and Gerou & Lusk (`reference/README.md` for the offsets) reproduce them. Pages rendered: Gould 26, 43, 84, 125–131, 138, 159, 283, 297, 569, 610–611, 630–631 (the figures on 125, 126, 127, 129 at 600 dpi); Ross 189–191; Stone 21–22, 42, 49–51, 136–137, 140–141; Gerou & Lusk 52–55, 70–75.

---

## Part D — Grace notes — industry standards and data models (online research, 2026-09-22)

Scope: appoggiatura, acciaccatura, Nachschlag / grace-after, grace groups. Every claim carries a URL;
quotations are verbatim from the fetched page unless marked *(paraphrase of the fetched page)*.
Where a page could not be reached or did not say, the answer is **UNKNOWN**. Nothing below is invented.

Method notes that matter for re-checking:
- The SMuFL and MNX specs have MOVED: `w3c.github.io/smufl` → `w3c-cg.github.io/smufl` → **`smufl.formats.music`**;
  `w3c.github.io/mnx` → **`mnx.formats.music`**. The old URLs only redirect. There is NO separate "Grace notes"
  glyph table in SMuFL — the grace glyphs sit in **"Common ornaments (U+E560–U+E56F)"**.
- `steinberg.help` "Reader" pages (Dorico 5/6) are JavaScript shells: WebFetch returns only a table of contents.
  The static copies at **`archive.steinberg.help`** (Dorico 1 / 2 / 3.5) answered.
- `musescore.org` forum/handbook nodes answer HTTP 403 to a fetcher; MuseScore's *source* on
  `raw.githubusercontent.com` (tag v4.4.4) was readable and is quoted instead.
- The Bravura metadata on GitHub (`redist/bravura_metadata.json`, branch master) is a 404; the project's own
  vendored copy `/home/kiko/dev/opus-editor/scripts/vendor/Bravura.json` (fontVersion 1.481) was read instead (read-only).

---

### 1. MusicXML 4.0 — `<grace>`

**Spec page:** https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/grace/

Definition (verbatim): *"The <grace> element indicates the presence of a grace note."*
Parent: `<note>`. Content model: *"Always empty."*

Attributes (verbatim descriptions):

| attribute | type | required | description |
|---|---|---|---|
| `make-time` | divisions | No | *"Indicates to make time, not steal time, for grace note playback."* |
| `slash` | yes-no | No | *"The value is yes for slashed grace notes and no if no slash is present."* |
| `steal-time-following` | percent | No | *"Indicates the percentage of time to steal from the following note for the grace note playback."* |
| `steal-time-previous` | percent | No | *"The steal-time-previous attribute indicates the percentage of time to steal from the previous note."* |

**Where it sits in `<note>`** — https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/note/ .
The `<note>` content model (verbatim structure, read off the page): *"Exactly one of the following — In this order:
`<grace>` (Required), Exactly one of the following: [In this order: `<chord>` (Optional), Exactly one of `<pitch>` |
`<unpitched>` | `<rest>`, `<tie>` (0 to 2 times)] | [In this order: `<cue>` (Required), `<chord>` (Optional), Exactly
one of `<pitch>` | `<unpitched>` | `<rest>`]"* — then the cue branch (`<cue>`, `<chord>?`, full-note, `<duration>`
Required) and the normal branch (`<chord>?`, full-note, `<duration>` Required, `<tie>` 0–2). After that branch, common
to all: `<instrument>*`, `<footnote>?`, `<level>?`, `<voice>?`, **`<type>` (Optional)**, `<dot>*`, `<accidental>?`,
`<time-modification>?`, `<stem>?`, `<notehead>?`, `<notehead-text>?`, `<staff>?`, **`<beam>` (0 to 8 times)**,
**`<notations>` (Zero or more times)**, `<lyric>*`, `<play>?`, `<listen>?`.

Prose (verbatim): *"The MusicXML format distinguishes between elements used for sound information and elements used
for notation information (e.g., <tie> is used for sound, <tied> for notation). Thus grace notes do not have a
<duration> element. Cue notes have a <duration> element, as do <forward> elements, but no <tie> elements."*

So: the written value is `<type>` (e.g. `eighth`), `<duration>` is absent, and a **grace-cue** note is `<grace/>` followed
by `<cue/>` (the second sub-branch). Beams, slurs and ties on grace notes use the ordinary `<beam>`, `<notations><slur>`,
`<tie>`/`<tied>` — nothing grace-specific exists.

**Official example** — https://www.w3.org/2021/06/musicxml40/musicxml-reference/examples/grace-element/ :

```xml
<note default-x="13">
  <grace slash="yes"/>
  <pitch><step>B</step><octave>4</octave></pitch>
  <voice>1</voice>
  <type>eighth</type>
  <stem default-y="3">up</stem>
  <notations><slur number="1" placement="above" type="start"/></notations>
</note>
<note default-x="31">
  <pitch><step>A</step><octave>4</octave></pitch>
  <duration>8</duration>
  <voice>1</voice>
  <type>quarter</type>
  <stem default-y="10">up</stem>
  <notations><slur number="1" type="stop"/></notations>
</note>
```

**Grace AFTER a note (Nachschlag).** MusicXML has no attachment concept; a grace note is whatever `<note>` with `<grace>`
stands in the sequence. Joe Berkovitz (MusicXML co-chair) on the W3C list,
https://lists.w3.org/Archives/Public/public-music-notation/2017Sep/0007.html and
https://lists.w3.org/Archives/Public/public-music-notation/2017Sep/0010.html (verbatim):
*"grace notes and appoggiaturas are not 'attached' to notes that follow them (although ties or slurs could provide
such connections, as they do in non-grace-note cases)."* — *"They simply precede the following notes, in their order
of occurrence on the page or in a document."* — *"MusicXML doesn't need to encode attachment, because music notation
doesn't have an inherent notion of such attachment."* — and of a grace after the last note of a bar: *"That second
scenario (grace note following normal note at the end of a measure) is not seen in conventional notated music."*
Bernd Jungmann (capella) replied, https://lists.w3.org/Archives/Public/public-music-notation/2017Sep/0009.html :
*"In capella, we support both appoggiatura and passing appoggiatura."* — *"In our MusicXML export, we use the
steal-time-previous attribute for Nachschlag notes, and hope that the steal-time-following attribute (documented 'as
for appoggiaturas'), will be implicitly applied if the note has a <grace/> element."*
Alexander Plötz, https://lists.w3.org/Archives/Public/public-music-notation/2017Sep/0017.html , proposed *(paraphrase of
the fetched page)* treating grace notes as attached to a POSITION rather than to a note, so a grace can exist before a rest
or with no following note.

**How MuseScore actually reads a grace-after** (source, tag v4.4.4,
https://raw.githubusercontent.com/musescore/MuseScore/v4.4.4/src/importexport/musicxml/internal/musicxml/importmxmlpass2.cpp):
*"// any grace note containing a slur stop means / // last note of a grace after set has been found"* (line ≈7787);
*"// any grace note containing a wavy-line stop means / // last note of a grace after set has been found"* (≈8042);
and at the end of a measure: *"// convert remaining grace chords to grace after"* (≈2762). I.e. a grace note that STOPS a
slur or a trill wavy line, or that has no following non-grace chord in the bar, becomes a grace-after of the previous chord.

**Chords of grace notes.** sonicscores forum thread https://sonicscores.com/forum/viewtopic.php?t=23122 : Overture used to
write *"the first grace note carried the element <grace> (and not <duration>). The remaining notes carried the element
<chord> but not <grace>"* — Finale warned, MuseScore *(paraphrase)* treated the unmarked chord notes as regular notes; the
LilyPond MusicXML test suite was taken as the model: *"each of the grace note chords in the example file, each with two
notes, the second note contains both <grace> and <chord> elements."* ⇒ **every note of a grace chord carries `<grace/>`,
and the 2nd+ notes also `<chord/>`** (this is what the `<note>` content model literally requires: `<grace>` then `<chord>`).

**Interoperability of `steal-time-*`.** Verified: MuseScore 4.4.4 neither writes nor reads `steal-time-previous`,
`steal-time-following` or `make-time` — a grep over its whole MusicXML exporter (8 772 lines) and importer (8 920 lines)
finds **zero** occurrences; the exporter writes only `<grace slash="yes"/>` or `<grace/>`
(https://raw.githubusercontent.com/musescore/MuseScore/v4.4.4/src/importexport/musicxml/internal/musicxml/exportxml.cpp
lines ≈4262–4266) plus `<note-size type="grace">` = `graceNoteMag × 100` (line 1405). capella writes `steal-time-previous`
for Nachschlag (above). music21 round-trips all four attributes (§6). **Dorico, Sibelius, Finale: UNKNOWN** — no manual
page or forum post stating whether they emit or honour `steal-time-*` was found; Dorico's MusicXML blog post
(https://blog.dorico.com/musicxml-export-and-import/) says nothing about grace notes.

---

### 2. MEI 5.x

**`att.graced`** — https://music-encoding.org/guidelines/v5/attribute-classes/att.graced.html (verbatim):
class: *"Attributes that mark a note or chord as a 'grace', how it should 'steal' time, and how much time should be
allotted to the grace note/chord."* — `@grace` (data.GRACE): *"Marks a note or chord as a 'grace' (without a definite
performed duration) and records from which other note/chord it should 'steal' time."* — `@grace.time` (data.PERCENT):
*"Records the amount of time to be 'stolen' from a non-grace note/chord."* Carried by `chord`, `graceGrp`, `note`.

**`data.GRACE`** — https://music-encoding.org/guidelines/v5/data-types/data.GRACE.html (verbatim):
`acc` — *"Time 'stolen' from following note."* · `unacc` — *"Time 'stolen' from previous note."* ·
`unknown` — *"No interpretation regarding performed value of grace note."*
(So MEI's `acc`/`unacc` are performance semantics — accented = on the beat = steals from the following note — not the
slash. The slash is `@stem.mod`.)

**`@stem.mod`** — https://music-encoding.org/guidelines/v5/attribute-classes/att.stems.html : *"Encodes any stem
'modifiers'; that is, symbols rendered on the stem, such as tremolo or Sprechstimme indicators."* Values,
https://music-encoding.org/guidelines/v5/data-types/data.STEMMODIFIER.html : `1slash` — *"1 slash through stem."*
(also `2slash`…`6slash`, `none`, `sprech`, `z`). The guidelines' grace example uses `stem.mod="1slash"`.

**`<graceGrp>`** — https://music-encoding.org/guidelines/v5/elements/graceGrp.html (verbatim): *"A container for a
sequence of grace notes."* `@attach`: `pre` — *"Attached to the preceding event."* · `post` — *"Attached to the following
event."* · `unknown` — *"Attachment is ambiguous."* Also carries `@grace` and `@grace.time`. Content: model.eventLike,
model.eventLike.cmn, model.appLike, model.editLike, model.transcriptionLike. Parents: layer, beam, tuplet, graceGrp,
editorial elements. Constraint *(paraphrase)*: a graceGrp without `@copyof` must contain at least one note, rest, chord
or space. ⚠️ Read the `@attach` wording carefully: *"pre — Attached to the PRECEDING event"* is the group that comes
AFTER its main note (a Nachschlag). MuseScore's MEI export contradicts this reading (see below) — the wording is
ambiguous and the two readings are in the wild.

**Guidelines prose** — https://music-encoding.org/guidelines/v5/content/cmn.html (verbatim where quoted): *"Grace
notes are not counted when determining the measure's conformance to the current time signature."* The CMN chapter adds
`grace` and `grace.time` to note and chord; the example there:

```xml
<beam>
  <note dur="8" oct="5" pname="d" stem.dir="down"/>
  <note dur="8" oct="5" pname="e" stem.dir="up" grace="unacc" stem.mod="1slash"/>
  <note dur="8" oct="5" pname="d" stem.dir="down"/>
  <note accid="s" dur="8" oct="5" pname="c" stem.dir="up" grace="unacc" stem.mod="1slash"/>
  ...
</beam>
```
(grace notes sit inside a normal beam among normal notes; `@dur` is their written value).

**Timeline.** `@tstamp` (https://music-encoding.org/guidelines/v5/attribute-classes/att.timestamp.log.html):
*"Encodes the onset time in terms of musical time, i.e., beats[.fractional beat part], as expressed in the written time
signature."* The guidelines give **no rule** for what `@tstamp` a grace note carries — position in the `<layer>`
sequence is the order. **UNKNOWN** whether any MEI text prescribes the grace's tstamp = the main note's tstamp.
Verovio 5.1.0 *(paraphrase of https://zenodo.org/records/14938488 via search)* "improved timemap with grace notes and
arpeggios"; Verovio issue 255 (https://github.com/rism-digital/verovio/issues/255): *"Extra space should not be added
to the second staff due to the grace notes on staff 1."*

**MuseScore → MEI mapping** — https://music-encoding.org/musescore-doc/docs/features/grace-notes.html (verbatim):
*"Grace notes are encoded as `graceGrp` with the appropriate `@attach` and `@grace`."* Preceding grace notes →
`@attach="pre"`; ending (following) grace notes → `@attach="post"`; preceding: acciaccature `@grace="unacc"`,
appoggiature `@grace="acc"`; ending notes `@grace="unknown"`. It *"also supports grace notes encoded without being
wrapped within a `graceGrp`"*, which cannot represent ending grace notes.

---

### 3. MNX (W3C Community Group draft)

**`grace` object** — https://mnx.formats.music/docs/mnx-reference/objects/grace/ (verbatim):
*"A grace object encodes grace notes. Its "content" contains the note data. Within "content", each inner event's
"value" encodes the visual rhythmic appearance of the grace note — e.g., "/8" for an eighth note."*

| name | type | required | description |
|---|---|---|---|
| `type` | the string `"grace"` | Yes | |
| `content` | array of event objects | Yes | |
| `graceType` | grace type | No | *"The kind of grace notes to use. The default value is "stealPrevious"."* |
| `slash` | boolean | No | *"Whether grace notes are notated with a slash. The default value (true) specifies a slash, indicating that the grace notes are displayed with a diagonal stroke and are to be performed quickly and not in their notated rhythm. Otherwise, they are performed with the notated note values according to the performance characteristics given by "graceType"."* |
| `color` | color | No | |
| + `_c`, `_x`, `id` | | | globally available attributes |

Parent: `sequence` → `"content"`. Examples: *Beams (with inner grace notes)*, *Grace note*, *Grace notes (beamed)*.

**`grace type`** — https://mnx.formats.music/docs/mnx-reference/objects/grace-type/ (verbatim):
`"makeTime"` — *"The run of grace notes delays the onset of the next non-grace event."* ·
`"stealFollowing"` — *"The run of grace notes occupies a time interval starting at the expected onset of the next
non-grace event, both delaying its onset and shortening its duration."* ·
`"stealPrevious"` — *"The run of grace notes occupies a time interval that ends before the expected onset of the next
non-grace event, shortening the duration of the preceding non-grace event."*

**Example** — https://mnx.formats.music/docs/mnx-reference/examples/grace-note/ : the grace object precedes the principal
event inside `sequences[0].content`:
```json
{ "type": "grace", "content": [ { "duration": { "base": "eighth" }, "notes": [ { "pitch": { "octave": 4, "step": "B" } } ] } ] },
{ "duration": { "base": "whole" }, "notes": [ { "pitch": { "octave": 5, "step": "C" } } ] }
```
**Beamed graces** — https://mnx.formats.music/docs/mnx-reference/examples/grace-notes-beamed/ : beams reference the grace
EVENTS by id (`"events": ["grace1", "grace2"]`), i.e. beams are a part-level list, not a property of the grace object.
**Grace-after:** MNX defines no attachment field; a `grace` object may stand anywhere in a sequence's content, and its
timing semantics (`graceType`) are stated relative to the *next* non-grace event only. **UNKNOWN** whether the draft says
anything about a grace object that is last in a sequence.

---

### 4. SMuFL 1.5 and Bravura

**Glyphs** — single-page spec https://smufl.formats.music/latest/print.html, section *"Common ornaments (U+E560–U+E56F)"*
(there is no "Grace notes" table; `…/tables/grace-notes.html` is a 404):

| codepoint | name | description |
|---|---|---|
| U+E560 (and U+1D194) | `graceNoteAcciaccaturaStemUp` | Slashed grace note stem up |
| U+E561 | `graceNoteAcciaccaturaStemDown` | Slashed grace note stem down |
| U+E562 (and U+1D195) | `graceNoteAppoggiaturaStemUp` | Grace note stem up |
| U+E563 | `graceNoteAppoggiaturaStemDown` | Grace note stem down |
| U+E564 | `graceNoteSlashStemUp` | Slash for stem up grace note |
| U+E565 | `graceNoteSlashStemDown` | Slash for stem down grace note |

Implementation note, same section (verbatim): *"Scoring applications should draw grace notes in the same way as they
draw regular notes, rather than using the precomposed glyphs."*

**Anchors** — https://smufl.formats.music/latest/specification/glyphswithanchors.html (verbatim, from the print build):
- `graceNoteSlashSW` — *"The Cartesian coordinates in staff spaces of the position at which the glyph graceNoteSlashStemUp
  should be positioned relative to the stem-up flag of an unbeamed grace note; alternatively, the bottom left corner of a
  diagonal line drawn instead of using the above glyph."*
- `graceNoteSlashNE` — *"The Cartesian coordinates in staff spaces of the top right corner of a diagonal line drawn instead
  of using the glyph graceNoteSlashStemUp for a stem-up flag of an unbeamed grace note."*
- `graceNoteSlashNW` — *"The Cartesian coordinates in staff spaces of the position at which the glyph graceNoteSlashStemDown
  should be positioned relative to the stem-down flag of an unbeamed grace note; alternatively, the top left corner of a
  diagonal line drawn instead of using the above glyph."*
- `graceNoteSlashSE` — *"The Cartesian coordinates in staff spaces of the bottom right corner of a diagonal line drawn
  instead of using the glyph graceNoteSlashStemDown for a stem-down flag of an unbeamed grace note."*
- `stemUpSE` — *"The exact position at which the bottom right-hand (south-east) corner of an upward-pointing stem rectangle
  should start, relative to the glyph origin, expressed as Cartesian coordinates in staff spaces."* · `stemDownNW` — same
  for the top-left corner of a down-stem. · `stemUpNW` — *"The amount by which an up-stem should be lengthened from its
  nominal unmodified length in order to ensure a good connection with a flag, in spaces."* · `stemDownSW` — the down-stem
  counterpart.
The spec's changelog records that the four `graceNoteSlash*` anchors were *"Added … to help with the correct positioning
of slashes on stem up and stem down flags of unbeamed grace notes"* (version of that entry not captured).

**Scale / cue size: SMuFL says nothing.** `engravingDefaults`
(https://smufl.formats.music/latest/specification/engravingdefaults.html) has 30 keys; the only one mentioning grace notes
is `legerLineExtension` — *"The amount by which a leger line should extend either side of a notehead, scaled proportionally
with the notehead's size, e.g. when scaled down as a grace note"*. No `graceNoteScale`, `cueSize` or similar exists. (The
project's `Bravura.json` `engravingDefaults` confirms: no such key.)

**Bravura metadata** (`/home/kiko/dev/opus-editor/scripts/vendor/Bravura.json`, fontVersion 1.481 — the GitHub raw URL 404s):
- The six grace glyphs themselves expose **no anchors**; they have only bounding boxes:
  `graceNoteSlashStemUp` bBoxNE [2.02, 1.604] / bBoxSW [0, 0]; `graceNoteSlashStemDown` bBoxNE [2.02, 0] / bBoxSW [0, −1.604];
  `graceNoteAcciaccaturaStemUp` [1.428, 2.096]/[0, −0.332]; `…StemDown` [0.78, 0.332]/[−0.336, −2.1];
  `graceNoteAppoggiaturaStemUp` [1.292, 2.104]/[0, −0.324]; `…StemDown` [0.78, 0.32]/[0, −2.112].
- The slash anchors live on the **8th flags** only:
  `flag8thUp: { graceNoteSlashNE: [1.284, −0.796], graceNoteSlashSW: [−0.644, −2.456], stemUpNW: [0, −0.04] }`
  `flag8thDown: { graceNoteSlashNW: [−0.596, 2.168], graceNoteSlashSE: [1.328, 0.628], stemDownSW: [0, 0.132] }`
  `flag16thUp: { stemUpNW: [0, −0.088] }`, `flag16thDown: { stemDownSW: [0, 0.128] }` — no slash anchors on 16th+ flags.
  The project already mirrors these two rows in `/home/kiko/dev/opus-editor/src/engine/fonts/bravuraMetrics.ts` lines 347–348.
- `noteheadBlack: { stemUpSE: [1.18, 0.168], stemDownNW: [0, −0.168], cutOutNW/SE, splitStem* }`.
- **Computed from those anchors (my arithmetic, not a published number):** the stem-up slash line runs Δx 1.928 sp,
  Δy 1.660 sp ⇒ length **2.54 sp at 40.7°**; stem-down Δx 1.924, Δy −1.540 ⇒ **2.46 sp at 38.7°**; the standalone glyph's
  bbox 2.02 × 1.604 gives a diagonal of **38.5°**. These are for a FULL-size flag: the anchors are in the flag's own
  staff-space units, so at grace scale they scale with the flag.

---

### 5. Applications' user-facing behaviour

#### Dorico (Steinberg)
- **Size**: *"Grace notes are smaller versions of normal notes, and are scaled down by a ratio that is set by default to
  3/5 of a normal note."* — Engrave > Engraving Options > Notes > Grace Notes ("Grace note scale factor").
  https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_grace_notes/notation_reference_grace_notes_size_c.html
  and https://archive.steinberg.help/dorico/v1/en/dorico/topics/notation_reference/notation_reference_grace_notes_appearance_project_wide_changes_c.html .
  (Historical: the 2014 development diary said *"drawn at two-thirds the size of rhythmic notes"* — it shipped at 3/5.)
- **Slash**: slashed by default; *"Grace notes with slashed stems are known as acciaccaturas and are often played very fast.
  Grace notes without slashed stems are known as appoggiaturas and are often played slower than acciaccaturas."* Options:
  *"Thickness of grace note stem slashes"*, *"Default length of grace note stem slashes"*, *"Position of grace note stem
  slashes relative to the end of the stem"* (values not stated on the page — UNKNOWN).
  https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_grace_notes/notation_reference_grace_notes_slashes_c.html
  Beamed groups: *"Grace note stem slashes appear at the beginning of a grace note beam if multiple grace notes can be joined
  by a single beam at the same rhythmic position. If there is a single grace note, the slash appears across the stem."*
  (general placement conventions page, below).
- **Stems**: *"Grace notes in Dorico Pro are stem up by default in any clef, regardless of the stem direction of the note to
  which they apply."* — *"The length of grace note stems is determined by your project-wide settings for the stem length of
  all notes."* https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_grace_notes_stems_c.html ;
  *"Grace notes appear stem up by default, except when there are multiple voices with grace notes in a single staff, in which
  case grace notes in the lower voices appear stem down."*
  https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_grace_notes/notation_reference_grace_notes_general_placement_conventions_c.html
- **Placement**: *"Grace notes are always positioned before a notehead, even if they are intended to be played on the beat
  rather than before the beat."* — *"grace notes are positioned after barlines and directly before the notehead to which they
  apply, including for the first note in a bar."* Property **"Grace note before barline"** (Properties > Grace Notes) flips
  them; *"This adjustment applies to all grace notes at the selected rhythmic positions simultaneously."* The convention
  stated: groups of three or more grace notes may go before the barline to avoid pushing the first beat away from it
  *(paraphrase)*.
  https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_grace_notes/notation_reference_grace_notes_position_relative_barlines_changing_t.html
  Gap: Engraving Options *"the minimum distance to the right of the rightmost grace note"*; per-layout *"note spacing scale
  factor for grace notes"* (Layout Options > Note Spacing). Values UNKNOWN.
  https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_grace_notes_position_project_wide_changes_c.html
- **Beams**: *"Dorico Pro automatically beams multiple adjacent grace notes together if they are an eighth note (quaver) or
  shorter in duration."* https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_grace_notes/notation_reference_grace_notes_beams_c.html
- **Slurs**: *"slurs in Dorico Pro appear below grace notes and curve downwards by default"*; rules: *"Slurs connect noteheads
  rather than stems"*, *"Slurs are scaled to match the proportions of grace notes"*, *"Slurs must not obscure ledger lines"*,
  *"Slurs are placed above notes if they would collide with the accidental of a standard note when placed below the notes"*;
  apply only when the slur ends on *"the note immediately following the grace note"*.
  https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_slurs/notation_reference_slurs_placement_grace_notes_c.html
- **Input**: *"Press / to start grace note input"*, *"Press the number for the rhythmic duration you want. For example, press 5
  for eighth grace notes"*, *"Press / again to stop grace note input"*, *"Press Alt-/ to switch between inputting
  slashed/unslashed grace notes"*, *"There is no limit to the number of grace notes that can exist at the same rhythmic
  position"*. https://archive.steinberg.help/dorico/v2/en/dorico/topics/write_mode/write_mode_grace_notes_inputting_t.html
  **Popover syntax: none found** — grace notes have no popover in the manual pages read (UNKNOWN whether one exists).
- **Grace notes after**: no feature. Users place trill terminations as grace notes with "before barline"; a developer:
  *"I agree that we should have a dedicated feature for termination notes for trills, and I hope that in the future we will
  be able to add this."* https://forums.steinberg.net/t/termination-notes-of-trills-vs-grace-notes/677808
- **Playback** (Play > Playback Options > Timing > Grace Notes): *"Slashed grace notes of any note duration, and unslashed
  grace notes a 16th note or shorter, play back before the beat with a single default sounding duration."* — *"Unslashed
  grace notes an eighth note or longer play back on the beat."* — on the beat *"their sounding duration is half the note
  duration of the note to which they are attached."* Options: whether single unslashed grace notes play on/before the beat;
  the maximum note duration for unslashed grace notes to play as short appoggiaturas; *"Default grace note length"*
  (a fraction of a quarter at 120 bpm — **default value UNKNOWN**, no page or thread states it).
  https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_grace_notes/notation_reference_grace_notes_playback_r.html ;
  https://forums.steinberg.net/t/duration-of-grace-notes-in-playback/939608 (names *"Library > Playback Options > Timing >
  Grace Notes … Default grace note length"*). First note of a piece: *"Playback Options->Timing->Flows (Pre-roll before flow)"*
  https://forums.steinberg.net/t/playback-grace-notes/769211 .
- **Internal model** (Daniel Spreadbury, Development diary part nine, https://blog.dorico.com/2014/12/development-diary-part-nine/):
  *"because grace notes always precede a rhythmic note, they should be stored with that rhythmic note."* — *"the grace notes
  that precede a rhythmic note would be stored separately from the rhythmic notes, like their own little mini-score of all of
  the grace notes in all of the voices at a given rhythmic position."* — enabling *"multiple simultaneous grace notes in
  different voices at the same rhythmic position to be spaced correctly relative to each other, and to the rhythmic notes they
  precede."* — *"the space between grace notes should not be justified (stretched) when the music is spread out to fill the
  width of a system."* — supports *"one or more grace notes before a barline, and one or more grace notes after the barline
  and preceding the rhythmic note"* and *"placing a clef change in the middle of a run of grace notes"*, but *"you cannot
  insert a key change in the middle of a run of grace notes in the middle of a bar"*. Consequences on the forum: *"Grace notes
  at the same rhythmic position on multiple staves are always positioned at the same horizontal position on every staff."*
  (https://forums.steinberg.net/t/position-of-grace-notes/156055) and *"many users would prefer that grace notes at the same
  rhythmic position were spaced completely independently, and this is something that we agree we should add an option for"*
  (https://forums.steinberg.net/t/grace-note-rhythmic-spacing/737626). A Steinberg staffer on items attached to a grace
  position: *"Attaching items to grace note positions rather than 'full' positions can cause little issues, like excess spacing
  if the tempo mark is long."* (https://forums.steinberg.net/t/problem-with-grace-notes-at-the-beginning-of-system/711100).

#### Sibelius (Avid) — Sibelius 7 Reference, §4.23 "Grace notes", https://hub.sibelius.com/download/documentation/pdfs/sibelius710-reference-en.pdf (pdftotext, verbatim)
- *"Grace notes are smaller than normal notes, and are drawn in between them. Unlike cue notes, grace notes don't count towards
  the total duration of the bar."* — *"Grace notes with a diagonal line through the stem are acciaccaturas, and ones without are
  appoggiaturas (this is the terminology Sibelius uses, anyway)."*
- *"Grace notes are normally drawn with stems up, regardless of their pitch. They are only drawn with stems down to avoid
  colliding with other objects, e.g. in the second of two voices, and in bagpipe music."*
- *"Acciaccaturas (with a line through the stem) are normally used only for single grace notes. Single grace notes, particularly
  acciaccaturas, are almost always written as an eighth note (quaver) regardless of how long they actually last. Pairs of grace
  notes are usually written as sixteenth notes (semiquavers), with 32nd-notes (demisemiquavers) being used for groups of about
  four or more grace notes."*
- *"Grace notes are usually slurred from the first grace note to the following main note. The slur normally goes above if the
  main note is higher than the grace note, or if the grace note or main note has leger lines above the staff; otherwise the
  slur is below."*
- *"Grace notes are always attached to the following normal note in a bar (so you cannot automatically create grace notes at
  the very end of a bar – see below)."* — *"Because grace notes attach to the note or rest following them, if you try to create
  a grace note at the very end of the bar (e.g. after a trill or other ornament), it has nothing to attach to. So to create a
  grace note at the end of a bar, enter a note in the next bar and create the grace note(s) before this note, then alter its
  position to before the barline using the X parameter in the General panel of the Inspector."*
- Keypad: *"To input a grace note, first choose appoggiatura or acciaccatura from the second (F8) Keypad layout, then input the
  note as normal … You can also turn a selected normal note into a grace note by typing ; (semicolon)."* Grace chords: *"Type
  1–9 (or Shift-1–9 for notes below) to produce grace note chords"*.
- **Sizes**: *"The Notes and Tremolos page of Appearance > House Style > Engraving Rules … lets you modify the size of grace and
  cue notes relative to normal notes. Grace notes are normally a bit smaller than cue notes (60% of full size instead of 75%)."*
  Corroborated by Bob Zawalich's plug-in PDF: *"The percentage 75% is the default size for a cue-sized note. 60% is the default
  size for a grace note, and 45% is the size of a grace note to which cue-sizing has been applied."*
  https://bobzawalich.com/wp-content/uploads/2019/03/How-to-use-the-Scale-Notehead-Size-plugin-in-Sibelius.pdf
- Spacing: *"Space around grace notes (i.e. the separation between each grace note) and the Extra space after last grace note"*
  in the Note Spacing Rule dialog (values UNKNOWN).
- Playback: the Reference's glossary says acciaccatura is *"a short grace note normally played before the beat"* and
  appoggiatura *"a long grace note normally played on the beat"*; **the actual playback rule/fraction: UNKNOWN** (not found in
  the text searched).
- Stem length: Gould's rule quoted by Scoring Notes, *"Ensure that a grace note on ledger lines has a sufficiently long stem for
  the diagonal stroke not to obscure a ledger line."* — Sibelius's default fails it, hence the plug-in.
  https://www.scoringnotes.com/tips/adjust-grace-note-stem-lengths-with-sibelius-plug-in/

#### Finale (MakeMusic)
- Size: two statements in the same 2012 manual disagree. *"the default reduction percentage for grace notes is 60%"*
  (https://usermanuals.finalemusic.com/Finale2012Win/Content/Finale/Grace_notes3.htm and
  https://usermanuals.finalemusic.com/FinaleMac/Content/Finale/Grace_notes.htm) vs Document Options – Grace Notes:
  *"The number in this text box specifies the size of grace notes in your document, expressed as a percentage of normal-sized
  notes. The default is 50%."* (http://usermanuals.finalemusic.com/Finale2012Win/Content/Finale/IDD_GRACENOTEOPTIONS.htm).
  ⚠️ Treat Finale's default as **60% per the task pages, 50% per the dialog page** — unresolved.
- Slash: *"Always Slash Flagged Grace Notes: Select this option if you want the slash to appear by default on all unbeamed grace
  notes."* (on by default: *"slashes appear on every flagged grace note"* unless deselected). Other options: *"Grace Note Offset
  on Entry"*, *"Grace Note Slash Thickness"*, *"Tablature Grace Note Size"* (default 50%).
- Playback: *"Playback Duration: Enter a value in the EDUs text box to specify the grace note duration (there are 1024 EDUs in
  one quarter note)."* — default EDU value **UNKNOWN**; *"On playback, the grace note will play just ahead of the beat—even if
  there are many grace notes together, forming a run."*
- Entry: Speedy Entry `;` or `G`; Simple Entry Option+G *(paraphrase)*. Stems: *"The stem direction is up for grace notes."*
  (https://usermanuals.finalemusic.com/Finale2012Mac/Content/Finale/Finale_Notational_Defaults.htm)

#### MuseScore Studio 4 — https://handbook.musescore.org/notation/expressive-markings/grace-notes
- Types named on the page: **Acciaccatura** (*"Usually written with an oblique stroke through the note flag, or through the
  beam"*), **Appoggiatura** (*"A stressed note which takes half the value from the parent note"*), **Grace note after** (for
  trill endings); the Bagpipe embellishments palette has more. The 4th/16th/32nd variants are enumerated in the source as
  `NoteType::GRACE4 / GRACE16 / GRACE32` (importer line ≈6132) and `graceNotesAfter()` exists on `Chord`.
- Shortcut: *"To apply an acciaccatura, press `/` (slash)."* Chords of graces: *"Press `Shift` and a note letter, `A` to `G`"*.
  Slash toggle: Properties > Stem > *"Show stem slash"*. Size: *"Format -> Styles -> Sizes -> Grace note size"*, *"independent
  from Small note size"*.
- **Defaults from source** (https://raw.githubusercontent.com/musescore/MuseScore/v4.4.4/src/engraving/style/styledef.cpp):
  `styleDef(smallNoteMag, PropertyValue(.7))`, `styleDef(graceNoteMag, PropertyValue(0.7))` ⇒ **grace 70 %, small/cue 70 %**.
  The exporter writes `<note-size type="grace">70</note-size>` and `type="grace-cue"` = 0.7 × 0.7 = 49.
- **Playback rule** (https://raw.githubusercontent.com/musescore/MuseScore/v4.4.4/src/engraving/compat/midi/compatmidirender.cpp,
  lines ≈505–546, verbatim comments): *"if there are graceNotesBefore and also graceNotesAfter, and the before grace notes are
  not ACCIACCATURA, then the total time of all of them will be 50% of the time of the main note. if the before grace notes are
  ACCIACCATURA then the grace notes after (if there are any) get 50% of the time of the main note."* — and (v3.6.2
  `libmscore/rendermidi.cpp` ≈2100, same logic): *"duration: appoggiatura: 0.5 * duration of main note (2/3 for dotted notes,
  4/7 for double-dotted) / acciacatura: min of 0.5 * duration or 65ms fixed (independent of duration or tempo) / for
  appoggiaturas, the duration is divided by the number of grace notes"*; *"treat multiple subsequent grace notes as
  acciaccaturas"*; *"int graceTimeMS = 65 * nb; // value determined empirically"*. In 4.4.4 an ACCIACCATURA sets `ontime = 0`
  (on the beat, zero-length offset) — the MIDI-export regression is https://github.com/musescore/MuseScore/issues/18624 .
- Ordering of graces in the model: `graceIndex()` — *"higher means closer to the non-grace chord it is attached to"*
  (exportxml.cpp ≈858).

#### LilyPond — Notation Reference §"Grace notes", https://lilypond.org/doc/v2.24/Documentation/notation/special-rhythmic-concerns
- *"Grace notes are musical ornaments, printed in a smaller font, that take up no additional logical time in a measure."*
  `\acciaccatura`: *"An unmeasured grace note indicated by a slurred note with a slashed stem."* `\appoggiatura`: takes *"a
  fixed fraction of the main note it is attached to and prints without the slash."* `\slashedGrace`: *"a grace note with a
  slashed stem, like the acciaccatura but without the slur, so as to place it between notes that are slurred themselves."*
  `\afterGrace`: *"It takes two arguments: the main note, and the grace notes following the main note."*; the grace notes are
  placed at `afterGraceFraction` of the main note, *"afterGraceFraction = 3/4"* by default, settable globally or per call.
- **Known issues and warnings** (verbatim, the four items): *"A multi-note beamed acciaccatura is printed without a slash, and
  looks exactly the same as a multi-note beamed appoggiatura."* — *"Grace note synchronization can also lead to surprises.
  Staff notation, such as key signatures, bar lines, etc., are also synchronized."* (remedy: `\grace s16` skips in the other
  staves — *"Please make sure that you use the \grace command for the spacer part, even if the visual part uses \acciaccatura
  or \appoggiatura because otherwise an ugly slur fragment will be printed."*) — *"Grace sections should only be used within
  sequential music expressions. Nesting or juxtaposing grace sections is not supported, and might produce crashes or other
  errors."* — *"Each grace note in MIDI output has a length of 1/4 of its actual duration. If the combined length of the grace
  notes is greater than the length of the preceding note a 'Going back in MIDI time' error will be generated."*
- **Timeline model**: a Moment is *"a point in musical time. It consists of a pair of rationals (m, g), where m is the timing
  for the main notes, and g the timing for grace notes."* (http://lilypond.org/doc/v2.19/Documentation/internals/scheme-functions,
  `ly:make-moment`; `ly:moment-grace` — *"Extract grace timing as a rational number from mom."*). `GraceMusic`: *"Interpret
  the argument as grace notes."*, length `#<Mom 0>`, with a start-callback computing the negative length of starting grace
  notes (http://lilypond.org/doc/v2.23/Documentation/internals/gracemusic). ⇒ graces live at (m, g<0) before the main note at (m, 0).
- Barline: *"By default, appoggiaturas and grace notes that occur on the first beat of a measure are printed after the bar
  line."* — snippet moves them before it with an invisible barline or `\afterGrace` + `afterGraceFraction = 15/16`.
  https://lilypond.org/doc/v2.25/Documentation/snippets/rhythms-_002d-appoggiatura-or-grace-note-before-a-bar-line
- Grace scale: **UNKNOWN online** (the fetched pages did not state the `font-size` LilyPond applies).

---

### 6. Other data models

**music21** — https://www.music21.org/music21docs/moduleReference/moduleDuration.html and the User's Guide ch. 27
https://music21.org/music21docs/usersGuide/usersGuide_27_graceNotes.html . `GraceDuration`: *"A Duration that, no matter how it
is created, always has a quarter length of zero."* Attributes *(paraphrase of the docs)*: `slash` (bool, default True),
`stealTimePrevious` / `stealTimeFollowing` (0.0–1.0 or None, default None — *"values from 0 to 1 that show what fraction of the
previous or following note's durations should be allocated to make room for this grace note"*), `makeTime` (bool, default
False, unused in playback). `AppoggiaturaDuration` subclasses it. `Duration.isGrace`; `Duration.getGraceDuration()` returns a
deep copy with quarterLength 0 keeping the `type`. Ordering: grace notes at the same offset sort BEFORE regular notes by the
sort tuple's `isNotGrace=0` (vs 1); several graces order by insertion then `.priority`; **a Nachschlag is a grace with
`priority` > 0** so it sorts after its main note at the same offset. Playback: *"MIDI output does not yet support playing back
grace notes."*

**Humdrum `**kern`** — https://www.humdrum.org/rep/kern/ (verbatim): *"Acciaccaturas (grace notes) are visually represented as
minature notes denoted by a slash mark through the stem. In kern these notes are treated as 'durationless' notes and are
designated by the lower-case letter `q`."* — groupettos: *"minature (non-cue) notes (typically in groups) whose stems do not
contain a slash, and whose notated durations cause the total notated duration for the measure to exceed the prevailing meter
… encoded as notes having their notated durations, but are also designated by the upper-case letter `Q`."* — appoggiaturas:
*"The appoggiatura itself is designated by the upper-case letter `P`, whereas the subsequent note (whose notated duration has
been shorted) is designated by the lower-case letter `p`."* — *"data records containing acciaccaturas or groupettos notes must
not include normal notes"* (graces get their own record, i.e. their own line before the main note's record). Craig Sapp's
extension (https://groups.google.com/g/starstarhug/c/kwJYvcpR5gA, *paraphrase of the fetched thread*): `q` = unaccented
grace → MusicXML `<grace slash="yes"/>`; `qq` = accented grace → `<grace/>` (no slash); any `q` makes the logical duration
zero and the `**recip` value becomes a visual parameter used for `<type>` but not `<duration>`; P/p (function) is decoupled
from q/qq (rendering). Grace-after ordering in kern: **UNKNOWN**.

**ABC 2.1** — https://abcnotation.com/wiki/abc:standard:v2.1 §"Grace notes" *(paraphrase of the fetched summary)*: `{…}`
encloses grace notes; `{/…}` is an acciaccatura; *"Notes inside braces may have length modifiers, e.g. `{A/B/c/}`"*; software
guidance: *"Software should play grace notes very quickly (typically as short as possible), usually before the beat."* The
braces precede the note they ornament; the fetched summary also claimed braces AFTER a note (`c{BG}`) make a grace-after —
**not verified verbatim, treat as UNKNOWN.**

**GUIDO (GMN)** — https://guidodoc.grame.fr/refs/tags/Notes/ : `\grace` — *"display grace notes"*, no parameters listed;
example https://guidodoc.grame.fr/examples/notes/ : `\stemsUp \slur<"down">( \beam(\grace(f2/16 a g f))) \stemsAuto` — the
grace notes are ordinary notes with written durations wrapped by the tag, before the main note. Grace-after: UNKNOWN.

**MusicXML → MIDI conventions.** There is no normative rule; every implementation picks its own: LilyPond 1/4 of written
value (§5); MuseScore 65 ms × n for acciaccaturas, half the main note for appoggiaturas (§5); Finale a fixed EDU count
"just ahead of the beat" (§5); Dorico a "Default grace note length" before the beat, half the main note on it (§5);
music21 none; MusicXML itself offers `steal-time-previous/following` percentages and `make-time` divisions (§1) that only
capella (writes) and music21 (round-trips) are verified to use.

**How each orders a grace-after:** MusicXML — sequence order + (capella) `steal-time-previous`; MuseScore import — slur-stop /
wavy-line-stop / end-of-bar heuristics; MEI — `graceGrp @attach` (`post` per MuseScore's export; the spec's wording is
ambiguous); MNX — none defined; music21 — same offset, `priority` > 0; LilyPond — `\afterGrace` at `afterGraceFraction` of the
main note; Humdrum / ABC / Guido — UNKNOWN.

---

### 7. Verifiable engraving numbers

| quantity | value | source | status |
|---|---|---|---|
| Grace note scale | **3/5 (60 %)** | Dorico Engraving Options default (§5 URLs) | verified |
| Grace note scale | **60 %** (cue 75 %) | Sibelius 7 Reference §4.23; Zawalich PDF | verified |
| Grace note scale | **60 %** (one page says 50 %) | Finale 2012 / Mac manuals (§5) | verified, self-contradicting |
| Grace note scale | **70 %** (`graceNoteMag 0.7`; small 0.7) | MuseScore 4.4.4 styledef.cpp | verified |
| Grace note scale | 2/3 (2014 prototype only) | Dorico dev diary 9 | superseded by 3/5 |
| Grace note scale in SMuFL | none — no key exists | engravingDefaults (§4) | verified absence |
| Stem length | same as normal stems | Dorico stems page (§5) | verified |
| Stem length | grace 2¼ sp, cue 2–2½ sp (Gould pp. 125/569); grace ≈2½, cue ≈3 (Stone p. 49) | `/home/kiko/dev/opus-editor/reference/README.md` line 736 (LOCAL library manifest, not online) | local only |
| Slash geometry | ≈2.5 sp long at ≈39–41° on a full-size 8th flag | COMPUTED from Bravura's `graceNoteSlash*` anchors (§4) | derived, not published |
| Slash thickness / length / offset | Dorico has three options | §5 | values UNKNOWN |
| Gap grace→main note | Dorico "minimum distance to the right of the rightmost grace note"; Sibelius "Extra space after last grace note"; Finale "Grace Note Offset on Entry" | §5 | values UNKNOWN |
| Grace→barline | *"an accidental or grace note may be closed up to within ½ space of a barline"* (Gould p. 43) | `reference/README.md` line 353 (LOCAL) | local only |
| Acciaccatura playback | 65 ms fixed (× count) | MuseScore source comment "determined empirically" | verified, folklore-grade |
| Appoggiatura playback | ½ main note (⅔ dotted, 4/7 double-dotted) | MuseScore source; Dorico "half the note duration" | verified |
| LilyPond MIDI grace | ¼ of written value | Notation Reference | verified |
| `afterGraceFraction` | 3/4 | LilyPond Notation Reference | verified |

Folklore: "grace notes are 60 %" is three vendors' default, not a treatise rule found online; "slash at 45°" — no source found.

---

### 8. The hard cases — what is written about them

- **Which side of the barline (first note of a bar / system).** Dorico default: after the barline, immediately before the
  notehead, *"including for the first note in a bar"*; "Grace note before barline" property flips ALL graces at that rhythmic
  position across the score (a moderator: *"you can't have some after the barline and others before the barline (though this
  is recognised as a limitation and may be improved in future)"*, https://forums.steinberg.net/t/grace-notes-before-bar-or-not/144675 ;
  a user: *"it is still impossible to have both grace notes before and after the barline"*,
  https://forums.steinberg.net/t/grace-note-placement/870423 ; and it leaks across instruments: *"I had instruments above that
  one that had a grace note placed before the barline in the same time position; this forces the grace note of other instruments
  before the barline"*, https://forums.steinberg.net/t/grace-note-after-trill-is-being-put-before-barline-by-default/1036843).
  LilyPond default: printed after the barline (§5). Sibelius: attach to the next note and shift with the Inspector X (§5).
  Stated convention (Dorico manual): three or more graces may go before the barline so the first beat is not pushed away.
- **Before or after a clef / key change.** Dorico: clef change *inside* a run of graces is supported; a key change inside a run
  mid-bar is not (dev diary, §5). The Dorico feature list mentions *"split grace notes around barlines and changes of clef"*
  (search snippet from a Dorico features PDF — not fetched, UNVERIFIED). No treatise text found online.
- **Grace before a repeat barline.** Dorico's before-barline property does not work at a repeat: *"As soon as I add the repeat
  barline, they jump to the next measure."* (https://forums.steinberg.net/t/placement-of-grace-notes-before-a-repeat-bar/1000432);
  *"I think the issue you describe is a limitation currently"* (Steinberg's Christian_R,
  https://forums.steinberg.net/t/grace-notes-before-barline-doesnt-work-before-repeat/1035212); older thread
  https://forums.steinberg.net/t/grace-notes-before-repeat-barline/100296 — workarounds are hidden tuplets or a dummy
  hidden 1/16 in another voice.
- **First note of a piece.** Dorico: pre-roll — *"Playback Options->Timing->Flows (Pre-roll before flow)"*
  (https://forums.steinberg.net/t/playback-grace-notes/769211). Engraving side: no source found.
- **Across a system break.** Dorico: no break between graces and their note; "before barline" is all-or-nothing:
  *"there is a current limitation on the grace notes: it's either all before the barline, or none of them"*
  (https://forums.steinberg.net/t/system-break-on-grace-notes/899586); graces vanishing at a new system were caused by a tempo
  mark attached to the grace position (§5). MuseScore fixed a trill line ending on a grace at a system break
  (https://github.com/musescore/MuseScore/pull/34764, title only).
- **Grace + tuplet.** Dorico: *"We do not support grace note tuplets at the moment, I am afraid."* — imitate with Shift+X text
  (https://forums.steinberg.net/t/grace-note-tuplets/677130). LilyPond: nesting grace sections unsupported (§5). The inverse
  trick — fake graces as a hidden tuplet resized to grace size — recurs on every forum (Sibelius: Scoring Notes; Dorico: both
  repeat threads).
- **Grace on a chord vs chord of graces.** MusicXML: every grace-chord note carries `<grace/>`, 2nd+ also `<chord/>` (§1).
  Sibelius: *"Type 1–9 … to produce grace note chords"*; MuseScore: Shift+letter. Dorico: *"There is no limit to the number of
  grace notes that can exist at the same rhythmic position"*.
- **Grace before a rest.** Dorico allows it: *"I can place the small after-notes of a trill as grace notes before a barline or a
  rest"* (https://forums.steinberg.net/t/termination-notes-of-trills-vs-grace-notes/677808). Sibelius: attaches *"to the note or
  rest following"* (§5). W3C list: Berkovitz's "must have a following normal note" vs Plötz's "attached to a position" (§1).
- **Playback of a chain of graces.** Dorico: one *"single default sounding duration"* each, before the beat (§5). MuseScore:
  n acciaccaturas = 65 ms × n; several unslashed graces are *"treat[ed] … as acciaccaturas"*; appoggiaturas share half the main
  note (§5). LilyPond: each ¼ of its written value, overflow ⇒ *"Going back in MIDI time"* (§5).
- **"Free time" in the apps' timelines.** Dorico: a *"mini-score"* of all graces at a rhythmic position, unjustified spacing,
  same x on every staff (§5). LilyPond: Moment = (main, grace) rationals, grace part negative before the main onset (§5).
  music21: same offset, sort key `isNotGrace`, `priority` for after-graces (§6). MuseScore: `graceNotesBefore()` /
  `graceNotesAfter()` lists on the Chord with `graceIndex()` (§5). MEI: `<graceGrp @attach>` in the layer sequence, no tstamp
  rule (§2). MNX: a `grace` object in the sequence, `graceType` for timing (§3). Verovio: graces must not widen other
  staves' spacing (issue 255, §2). On-the-beat notation: *"Dorico doesn't support grace notes that start on the beat"*
  (https://forums.steinberg.net/t/grace-notes-on-the-beat-notation/133182); Boulez-style measured graces need manual spacing
  everywhere but LilyPond (https://notat.io/viewtopic.php?t=185).

---

### The data-model fields every format agrees on

| field | MusicXML | MEI | MNX | music21 | **kern | LilyPond | MuseScore (internal) | Dorico (docs) |
|---|---|---|---|---|---|---|---|---|
| **is a grace / zero logical duration** | `<grace/>`, no `<duration>` | `@grace` present; "not counted" toward the meter | `type:"grace"` | `GraceDuration`, qL 0 | `q` / `qq` durationless | `\grace…` length 0 | `Chord::isGrace()` | "do not take up space rhythmically" |
| **written (visual) value** | `<type>` | `@dur` | inner event `duration` (`"/8"`) | `Duration.type` kept | `**recip` as visual param | note value | `TDuration` | number key at input |
| **slash (acciaccatura) vs none (appoggiatura)** | `slash="yes/no"` | `@stem.mod="1slash"` | `slash` (default true) | `.slash` (default True) | `q` vs `qq` | `\acciaccatura` vs `\appoggiatura` | `NoteType::ACCIACCATURA` vs `APPOGGIATURA`, "Show stem slash" | slashed default, Alt-/ |
| **before / after attachment** | order only (+`steal-time-previous` by capella) | `graceGrp @attach pre/post` | order only | `priority` | UNKNOWN | `\grace` vs `\afterGrace` | `graceNotesBefore/After`, `graceIndex` | before only; "before barline" property |
| **steal-time / timing hints** | `steal-time-previous/following` %, `make-time` | `@grace acc/unacc/unknown`, `@grace.time` % | `graceType` stealPrevious/stealFollowing/makeTime | `stealTimePrevious/Following`, `makeTime` | `P`/`p` (function) | `afterGraceFraction`, MIDI ¼ | 65 ms / ½ rules | Playback Options: length, on/before beat, threshold |
| **slur / tie / beam** | ordinary `<slur>`, `<tie>`, `<beam>` | ordinary `<slur>`, `<beam>`, graces inside a normal `<beam>` | beams by event id | ordinary spanners | ordinary | `\acciaccatura` adds the slur | ordinary | auto-beam ≤ 8th; slur rules |
| **chords of graces** | each note `<grace/>` (+`<chord/>`) | `<chord grace=…>` (att.graced on chord) | inner event with several `notes` | chord with GraceDuration | one record | `\grace <c e>` | grace Chord | any number at a position |
| **size** | `<note-size type="grace">` in `<appearance>` (MuseScore writes 70) | — | — | — | — | smaller font | `graceNoteMag` 0.7 | 3/5 |

Common core (present in ALL of MusicXML, MEI, MNX, music21): **grace flag (no logical duration) · written type · slash boolean ·
a steal/make-time hint · position in the event sequence** — and, in all but MNX, **some way to say "after" (MEI `@attach`,
music21 `priority`, MusicXML by order/`steal-time-previous`)**.

### UNKNOWN (not verifiable from the sources reached)

1. Whether Dorico, Sibelius or Finale write or honour `steal-time-previous/following` / `make-time` on MusicXML export/import.
2. Dorico's numeric defaults: "Default grace note length" (playback), slash thickness/length/offset, minimum gap after the last
   grace note, grace note-spacing scale factor.
3. Sibelius's playback rule for grace notes (fraction / on vs before the beat) and its default "Space around grace notes" /
   "Extra space after last grace note".
4. Finale's default Playback Duration in EDUs; which of 50 % / 60 % is the real Finale default (the manual contradicts itself).
5. LilyPond's grace font-size / scale factor (not on the pages fetched).
6. Whether the MEI guidelines prescribe a `@tstamp` for grace notes, and which of `@attach="pre"`'s two readings is intended.
7. Whether MNX allows / defines a `grace` object that is last in a sequence (grace-after).
8. Grace-after ordering in Humdrum, ABC (the `c{BG}` claim is unverified) and Guido.
9. Any published slash ANGLE; any online statement of grace stem LENGTH beyond Dorico's "same as normal" (Gould/Stone numbers
   exist only in the project's local library manifest).
10. The SMuFL version in which the `graceNoteSlash*` anchors were added (changelog entry seen, version not captured).
11. Which existing treatise text settles "before or after the clef/key change" for a grace at a bar start — nothing found online.

---

## Part E — The SLASH, the STEM and the LEDGER LINES — the deep pass (2026-09-22)

Asked for after P1's first picture (his words: *"the slash on a 4th looks really ugly … position on the
stem when we have ledger lines how to manage this, it is something in the literature also about this?"*).
Two agents, one per half: the engines' SOURCE (§E.1) and the BOOKS' scans, measured (§E.2). The
synthesis is §0.8. ⚠️ Both name renders and scripts in a session scratchpad that did not survive the
session — the page numbers and pixel coordinates given are enough to re-measure every number.

### E.1 — The engines: how they draw the slash, and how long a grace stem is

Sources read on disk (`~/dev/engine-sources/`, revisions: MuseScore `929d1e9` 2026-08-18, Verovio `efff0bc` 2026-08-18,
LilyPond `beedbfa` 2026-08-03, VexFlow `8879d09` 2025-03-05 + the 5.0.0 npm build, musxdom). Paths below are relative to each
repo. Units: **sp** = staff space. "Derived" = arithmetic I did from the cited code, not a number the code states.

Coordinate reminders: MuseScore and VexFlow use y DOWN; Verovio's layout y is UP (`ToDeviceContextY` flips); LilyPond/METAFONT y is UP.

---

#### 0. The prior knowledge — verified

| Claim | Verified at |
|---|---|
| MuseScore `TLayout::layoutStemSlash`, `stemSlashPosition` 2.0 sp, `stemSlashAngle` 40°, `stemSlashThickness` 0.125 sp, `heightReduction` 0.66 when no hook | `src/engraving/rendering/score/tlayout.cpp:5399-5467`; `src/engraving/style/styledef.cpp:280-282` |
| Verovio `View::DrawAcciaccaturaSlash`, hard-coded cue-unit offsets, not in a beam | `src/view_element.cpp:2035-2079`, gate at `:1789` |
| LilyPond slash = a flag-stroke glyph `flags.ugrace`/`dgrace`; `beam::slashed-stencil` for beams | `mf/feta-flags.mf:1228-1297`, `lily/flag.cc:140-160`, `scm/output-lib.scm:350-440` |

All three confirmed.

---

#### Q1. A slashed grace with NO FLAG (quarter / half / whole)

##### MuseScore — YES for quarter and half; NO for whole
* A slash is created for any chord with `showStemSlash()` that has a stem and is not a non-first member of a beam:
  `rendering/score/chordlayout.cpp:1243-1266` (returns early at `:1243` when `!item->stem()`; the slash is added at `:1259-1263`).
  Nothing in that gate or in `layoutStemSlash` looks at duration.
* `showStemSlash` defaults to true only for `NoteType::ACCIACCATURA` (`dom/chord.cpp:296`, `:1695`), but the Properties panel
  offers "Show stem slash" on **every** grace type (`GRACE4` quarter, `APPOGGIATURA`, …): visible when `noteType() != NORMAL`,
  enabled when `!chord->noStem()` — `src/propertiespanel/.../chords/chordsettingsmodel.cpp:89-119`; label in
  `.../stems/StemSettings.qml:62-65`.
* Whole notes: comment "Notes without a stem (including whole notes) don't draw a slash." (`tlayout.cpp:5413`), and the stem gate above.
* **Geometry without a hook** (`tlayout.cpp:5415-5462`), `mag` = chord mag (grace = `graceNoteMag` 0.7, `styledef.cpp:517`):
  * start x = stem right edge − `noteHeadWidth·mag/2`
  * start y = stem tip + (towards the head) `stemSlashPosition(2.0 sp)·mag·0.66` = **0.924 sp** from the tip at mag 0.7 (the
    0.66 `heightReduction` applies when `straight || !hook`, `:5431-5432`)
  * end x = stem right edge + (`noteHeadWidth·mag/2 − stemWidth`) — "subtract the stem width so the slash is optically centered on
    the stem" (`:5456-5458`)
  * end y = start y ∓ (endX − startX)·tan(40°) (rises away from the head)
  * thickness `stemSlashThickness 0.125 sp · mag` = 0.0875 sp; drawn as a **FlatCap** pen line (`tdraw.cpp:2918-2924`)
  * Derived: horizontal run ≈ `noteHeadWidth·mag − stemWidth` ≈ one grace head width; so the unflagged slash is a short ~1 sp
    stroke, centred on the stem, starting ~0.9 sp below the tip.

##### Verovio — YES for quarter and half; NO for whole
* Gate: `(stem->GetGrace() == GRACE_unacc) && !stem->IsInBeam()` (`view_element.cpp:1789`); no duration test. Whole notes: the
  stem is virtual and the function returns before (`:1771`, "Do not draw virtual (e.g., whole note) stems").
* With no `Flag` child, `y` stays at the stem tip (`:2050-2060`); for a stem-down note without a flag, `y -= unit/3` (`:2061-2063`).
* Geometry is the same hard-coded shape as with a flag (see Q4).

##### LilyPond — NO slash on a quarter/half/whole `\acciaccatura`
* `\acciaccatura` only does `\temporary \override Flag.stroke-style = "grace"` (`ly/grace-init.ly:40-48`); the stroke is added
  inside `Flag::print` (`lily/flag.cc:141-160`).
* A `Flag` grob is created only when `Stem::duration_log (stem_) > 2`, i.e. 8th or shorter (`lily/stem-engraver.cc:154-161`), and is
  killed when the stem is beamed (`:165-173`). So a quarter/half acciaccatura has no Flag ⇒ no stroke.
* Corroborated by the snippet `Documentation/snippets/using-grace-note-slashes-with-normal-heads.ly` (`\override Flag.stroke-style =
  "grace"  c8( d2) e8( f4)`) — only the eighths can carry it, by the code above. No regression test for a quarter acciaccatura found
  (`input/regression/grace*.ly`, `slashed-*.ly` listed; none exercises durlog ≤ 2 with a stroke).
* Known issue text is about BEAMED graces only: "A multi-note beamed acciaccatura is printed without a slash"
  (`Documentation/en/notation/rhythms.itely:4804-4806`).

##### VexFlow — YES for quarter and half; by code reading ALSO whole
* Gate: `if (this.slash && stem)` (`src/gracenote.ts:53`). `StaveNote.buildStem()` creates a `Stem` for every note, hidden only for
  rests (`src/stavenote.ts:417`, `:459-460`), so `this.stem` is truthy for a whole note too. I did not render it; by the code a whole
  GraceNote with `slash: true` would get the head-anchored slash (it does not depend on a drawn stem). Treat as *code reading only*.
* Geometry for the unbeamed case does not depend on flag or duration (see Q4): centre at (stem x, head top − `STEM_HEIGHT·scale/2`),
  ±`noteHeadWidth` in x and y, i.e. 45°.

##### Finale — NO (documented)
* Document Options › Grace Notes: "Always Slash Flagged Grace Notes — It's customary to place a small diagonal slash through the
  flag of any grace note that's not beamed" — http://usermanuals.finalemusic.com/Finale2012Mac/Content/Finale/IDD_GRACENOTEOPTIONS.htm
* "Normally, Finale adds slashes only to flagged (unbeamed) grace notes." — https://usermanuals.finalemusic.com/Finale2012Win/Content/Finale/Grace_notes6.htm
* musxdom (a reader of Finale files, not Finale itself) models it the same: slash iff `(slashGrace || slashFlaggedGraceNotes) &&
  calcCanBeBeamed() && calcUnbeamed()`, where "can be beamed" = duration < quarter — `musxdom/src/musx/dom/Entries.cpp:1260-1275`;
  field doc "a non-beamed grace note with flags (8th note or smaller)" — `Entries.h:437-439`.

##### Dorico — UNKNOWN for unflagged
* "If there is a single grace note, the slash appears across its stem and flag, *if applicable*, and extends either side of the stem."
  (Dorico help, "Grace note slashes", as returned by search from https://www.steinberg.help/r/dorico-elements/6.1/en/dorico/topics/notation_reference/notation_reference_grace_notes/notation_reference_grace_notes_slashes_c.html —
  the page itself now 301-redirects; text is from the search snippet). "if applicable" suggests a flagless stem can carry one, but
  that is not an explicit statement ⇒ UNKNOWN.

##### Sibelius — UNKNOWN (no source found).

| Engine | Quarter/half slashed? | Whole? | Source |
|---|---|---|---|
| MuseScore | yes (any grace type with a stem; default only for ACCIACCATURA) | no | chordlayout.cpp:1243-1266; chord.cpp:296; chordsettingsmodel.cpp:89-119; tlayout.cpp:5413 |
| Verovio | yes | no | view_element.cpp:1771, 1789 |
| LilyPond | **no** (stroke lives on the Flag grob) | no | stem-engraver.cc:154-161; flag.cc:141-160; grace-init.ly:40-48 |
| VexFlow | yes | yes by code reading | gracenote.ts:53; stavenote.ts:417,459-460 |
| Finale | **no** (flagged, unbeamed only) | no | Finale manual URLs above; musxdom Entries.cpp:1260 |
| Dorico | UNKNOWN ("flag, if applicable") | UNKNOWN | Dorico help (search snippet) |
| Sibelius | UNKNOWN | UNKNOWN | — |

---

#### Q2. Grace stem length, esp. with ledger lines

##### MuseScore (`rendering/score/stemlayout.cpp`)
* Base: `stemLength` 3.5 sp (`styledef.cpp:259`) in quarter-spaces, scaled by `intrinsicMag` (0.7) ⇒ **2.45 sp** nominal
  (`stemlayout.cpp:60`, `:125`).
* Shortening when the stem points out of the staff: `maxReduction` table (`:345-395`); for grace-sized (intrinsicMag < 1) stems with a
  traditional hook, the reduction is capped at 0.5 sp — "reducing by the full amount puts the hooks too low. Limit reduction to 0.5sp"
  (`:373-379`). Floor `shortestStem` 2.5 sp (`styledef.cpp:261`), also ×mag.
* Extension into the staff for notes outside it: `minStaffOverlap(..., isFullSize = !(isGrace()||isSmall()))` (`:80-82`, `:162-180`).
  For a grace (not full size) `staffLineOffset = 4` ⇒ `staffOverlap = min(8, (lines−4)·4) = 4` quarter-spaces on a 5-line staff, so a
  stem-UP grace tip must reach at least **3 sp below the top line (the 4th line)**; a stem-DOWN grace at least the 2nd line. Full-size
  notes must reach the middle line. Enforced by the `extraLength` block (`:126-158`: "when the chord's magnitude is < 1, the stem
  length with mag can find itself below the middle line… add the extra amount").
* **No slash-specific or ledger-line-specific lengthening.** The only ledger-ish rule is this "reach the 2nd line from the outside"
  minimum. Nothing reads the slash when computing the stem (grep of `stemSlash` in `rendering/`: only layout/draw/kerning sites).

##### Verovio (`src/calcstemfunctor.cpp`, `src/note.cpp`)
* Base: `STANDARD_STEMLENGTH` 7 units = 3.5 sp (`include/vrv/vrvdef.h:753`), minus a shortening of 0–6 thirds-of-a-unit when the stem
  points away from the staff, capped at 4 (up) / 3 (down) thirds for unbeamed flagged notes (`note.cpp:570-610`); then ×`graceFactor`
  0.75 (`calcstemfunctor.cpp:378`; option `options.cpp:1326-1328`) ⇒ **2.625 sp** nominal.
* Grace stems are **not** extended to the middle line: "Do not adjust the length of grace notes - this is debatable and should
  probably become a styling option. However we still want flags from grace notes not to overlap with ledger lines"
  (`calcstemfunctor.cpp:472-476`). Stem-mod adjustment is also skipped for graces (`:479`).
* Ledger lines: `AdjustFlagPlacement` runs for graces too (`:484`, no grace gate). If the note has ledger lines on the stem side, the
  stem is lengthened in whole units until the flag's far end clears the first ledger line (`ledgerPosition = verticalCenter −
  6·dir·unit`, i.e. 3 sp from the middle line) — `:667-693`, comment "Make sure that flags don't overlap with first (top or bottom)
  ledger line (effectively avoiding all ledgers)". Since the slash sits within the flag's vertical span (Q4), this indirectly keeps a
  flagged grace's slash off the ledger lines. **A quarter/half grace (no flag) gets no such adjustment** (the function is only called
  `if (flag)`, `:484`).

##### LilyPond
* `general-grace-settings`: `Stem length-fraction 0.8`, `Stem no-stem-extend #t`, `Stem/Flag/NoteHead font-size -3`, `Beam
  length-fraction 0.8`, `beam-thickness 0.384` (`scm/music-functions.scm:674-688`); `score-grace-settings` adds `Stem direction UP`
  (`:690-694`).
* `Stem details lengths (3.5 3.5 3.5 4.25 5.0 …)` (`scm/define-grobs.scm:3454`) × `length-fraction` 0.8 (`lily/stem.cc:555`) ⇒
  **2.8 sp** for quarter/8th/16th graces, 3.4 sp for 32nd.
* `stem-shorten (1.0 0.5 0.25)` only for stems pointing away from the staff centre (`stem.cc:519-553`).
* `no-stem-extend #t` ⇒ grace stems are never extended to the middle line (`stem.cc:589-592`; regression
  `input/regression/grace-stems.ly`). `input/regression/grace-stem-length.ly`: "Stem lengths for grace notes should be shorter than
  normal notes, if possible. They should never be longer."
* **No ledger-line / slash lengthening found.**

##### VexFlow
* `Stem.HEIGHT` = `Tables.STEM_HEIGHT` 35 px (3.5 sp at 10 px/sp; `tables.ts:294`, `stem.ts:55-57`); GraceNote `getStemExtension`
  returns `HEIGHT·fontScale − HEIGHT + super` (`gracenote.ts:39-46`), `fontScale` 2/3 (`metrics.ts:132-134`) ⇒ **≈2.33 sp**.
* No ledger or slash logic ("FIXME: avoid staff lines, ledger lines or others", `gracenote.ts:95`).

##### Dorico / Sibelius / Finale
* Sibelius: Scoring Notes says Sibelius's default grace stems "are generally too short, especially problematic when notes appear on
  ledger lines where the diagonal slash can obscure the lines", fixed only by the *Adjust Grace Note Stem Lengths* plug-in (options:
  slashed / unslashed / all; per-font settings for Opus, Helsinki, Norfolk). The same article says Dorico "handles grace note stem
  lengths correctly by default" while Sibelius, Finale and MuseScore do not —
  https://www.scoringnotes.com/tips/adjust-grace-note-stem-lengths-with-sibelius-plug-in/ . The plug-in's numbers: UNKNOWN.
* Dorico's actual rule: UNKNOWN (only the Scoring Notes judgement above).
* Finale grace stem length: UNKNOWN (the Grace Notes options page lists none).

| Engine | Nominal grace stem | Extended into staff? | Ledger/slash rule | Source |
|---|---|---|---|---|
| MuseScore | 3.5 × 0.7 = 2.45 sp | yes, to the 2nd line from the outside (not middle) | none | stemlayout.cpp:60,80-82,126-180; styledef.cpp:259,517 |
| Verovio | 3.5 × 0.75 = 2.625 sp | **no** | flag must clear the 1st ledger line (flagged only) | calcstemfunctor.cpp:378,472-476,667-693; note.cpp:570-610 |
| LilyPond | 3.5 × 0.8 = 2.8 sp | **no** (`no-stem-extend`) | none | music-functions.scm:674-688; stem.cc:505-592 |
| VexFlow | 3.5 × 2/3 ≈ 2.33 sp | no logic | none (FIXME) | gracenote.ts:39-46,95; metrics.ts:132 |
| Sibelius | UNKNOWN (reported too short) | UNKNOWN | plug-in only | Scoring Notes URL |
| Dorico | UNKNOWN (reported right) | UNKNOWN | UNKNOWN | Scoring Notes URL |
| Finale | UNKNOWN | UNKNOWN | UNKNOWN | — |

Gould's p.126 ledger-line rule is implemented as such by **nobody** read here; Verovio's flag-vs-first-ledger lengthening is the
closest, and it only fires for flagged notes.

---

#### Q3. Does any engine move/shorten the slash itself to avoid lines, heads, accidentals?

| Engine | Vertical collision logic for the slash | Horizontal | Source |
|---|---|---|---|
| MuseScore | none — fixed geometry from stem/hook | the slash is part of the chord `Shape`, so spacing kerns other items away from it; allowed to collide with chords of its own grace beam group | chordlayout.cpp:3413-3416; horizontalspacing.cpp:1731-1732,1781-1805 |
| Verovio | none (drawn at draw time, "HARDCODED"); only the stem-lengthening of Q2 | none found | view_element.cpp:2064-2079 |
| LilyPond | none — the stroke is part of the Flag stencil, so it enters the flag's skyline like any ink | as flag ink | flag.cc:158 (`flag.add_stencil (stroke)`) |
| VexFlow | none — "FIXME: avoid staff lines, ledger lines or others." | none | gracenote.ts:95 |
| Dorico/Sibelius/Finale | UNKNOWN | UNKNOWN | — |

---

#### Q4. Where on the flag

##### MuseScore (`tlayout.cpp:5424-5450`)
* start x = stem right − `noteHeadWidth·mag/2` (left overhang = half a grace head)
* start y = tip + 2.0 sp · mag = **1.4 sp** from the tip toward the head (full `stemSlashPosition`, no 0.66 with a curved hook)
* end x = **right edge of the hook's bbox** ("always ends at the right bbox margin of the hook", `:5444`)
* end y = start y ∓ (endX − startX)·tan(angle); angle 40°, ×1.2 (= 48°) for ≥2 flags (16th+) with Bravura / Finale Maestro /
  Gonville — "HACK: adjust slash angle for fonts with 'fat' hooks. In future, we must use smufl cutOut" (`:5440-5443`)
* Straight flags (`useStraightNoteFlags`) use the 0.66 reduction (`:5432`).
* **SMuFL `graceNoteSlash*` anchors are NOT used** (no reference in `src/engraving/rendering`).
* Derived with Leland (default font: flag8thUp width 1.157 sp, `fonts/leland/leland_metadata.json`) and a ~1.18 sp head: dx ≈ 0.41 +
  0.81 = 1.22 sp, rise ≈ 1.02 sp ⇒ ends ≈0.38 sp below the tip.

##### Verovio (`view_element.cpp:2035-2079`)
* `positionShift = unit·graceFactor` = 0.5 sp · 0.75 = **0.375 sp** (unit = half a staff space, `options.cpp:1202`).
* Reference y = stem tip + flag glyph top (stem up) / bottom (stem down) at cue size (`:2050-2060`). In Leipzig (default)
  `flag8thUp`/`flag16thUp` tops are 0 (`data/Leipzig.xml:94,312`), `flag32ndUp` top = +190/1000 em (≈0.57 sp at cue) (`:313`) — so for a
  32nd the reference moves up to the top of the flag glyph.
* Stem up: line from (stemX − 0.375, y − 1.5 sp) to (stemX + 0.75, y − 0.375 sp) ⇒ **45°**, length ≈ 1.59 sp, spanning 1.5 → 0.375 sp
  below the reference. Not anchored to the flag's width or anchors.
* Stem down, 8th flag or no flag: reference shifted by `unit/3` (≈0.17 sp) further out (`:2061-2063`).
* Pen = `stemWidth·1.2` = 0.2 unit ·1.2 = **0.12 sp**, not cue-scaled (`:2041`; `options.cpp:1532-1533`; `doc.cpp:2062-2064`).

##### LilyPond (`mf/feta-flags.mf:1228-1297`)
* One glyph `flags.ugrace` for every flag count (the lookup is `"flags." + flag_style + dir + "grace"`, falling back to `dir +
  "grace"`, `flag.cc:150-155`) — a 16th/32nd gets the same stroke, placed at the flag origin (stem end).
* Up stroke: `hip_depth_ratio .72`, `flare = 1 sp`, `foot_depth = 3 sp`, `hip_width = upflag_width − hip_thickness/2`; z1 = (−0.72·hip_width,
  −2.16 sp), z2 = (hip_width, −1.0 sp); pen `1.5 stemthickness` (`stemthickness = 1.3 stafflinethickness`, `feta-params.mf:65`);
  `upflag_width = .65 black_notehead_width + stemthickness/2` (`feta-flags.mf:29`).
  At grace `font-size -3` (factor 2^(−½) ≈ 0.707) ⇒ from ≈**1.53 sp** below the tip, left of the stem by 0.72·hip_width, to ≈**0.71 sp**
  below the tip at the flag's right edge (derived). Exact degrees UNKNOWN without the compiled font's notehead width.
* Down stroke: `flare .99 sp`, depth `2.85 sp`, `downflag_width = .833 black_notehead_width + stemthickness/2`, then `y_mirror_char`
  (`feta-flags.mf:1263-1297`).
* Straight flags: `add-stroke-straight` — "starts for up-flags at upper-end-of-flag + (0,length/2) and ends at (0,
  vertical-center-of-flag-end) − (flag-x-width/2, flag-x-width + flag-thickness)" (`scm/flag-styles.scm:35-55`).

##### VexFlow (`gracenote.ts:66-91`)
* Ignores the flag: centre x = `getAbsoluteX() + noteHeadWidth` (stem up) / `getAbsoluteX()` (down); centre y = head top −
  `STEM_HEIGHT·scale/2` (35·⅔/2 ≈ 11.7 px ≈ 1.17 sp from the head's edge); segment ±`noteHeadWidth` in both axes (45°).
  `lineWidth = 1·scale` px ("FIXME: use more appropriate value", `:97`).

##### SMuFL anchors (fonts on disk)
* Bravura and Petaluma define `graceNoteSlashSW (−0.644, −2.456)` / `graceNoteSlashNE (1.284, −0.796)` on `flag8thUp` and
  `graceNoteSlashNW (−0.596, 2.168)` / `graceNoteSlashSE (1.328, 0.628)` on `flag8thDown` — **8th flags only**, none on 16th/32nd;
  Leland defines none (`MuseScore/fonts/{bravura,petaluma,leland}/*_metadata.json`). Derived slope Bravura up: rise 1.66 over run
  1.928 ⇒ ≈40.7°. No engine read here consumes these anchors.

| Engine | Anchor | Start (from tip, toward head) | End | Angle | Thickness | Source |
|---|---|---|---|---|---|---|
| MuseScore | stem + hook bbox right | 1.4 sp (mag .7), x = stem − ½ head | hook bbox right | 40° (48° 16th+ in 3 fonts) | 0.0875 sp | tlayout.cpp:5424-5465 |
| Verovio | stem tip + flag glyph top | 1.5 sp, x = stem − 0.375 | 0.375 sp, x = stem + 0.75 | 45° | 0.12 sp | view_element.cpp:2035-2079 |
| LilyPond | flag origin (glyph) | ≈1.53 sp, x = −0.72·hip_w | ≈0.71 sp, x = hip_w | UNKNOWN exact (~40° order) | 1.5 stem thickness ×0.707 | feta-flags.mf:1228-1261 |
| VexFlow | notehead (not flag) | head top − 1.17 sp ± head width | — | 45° | ⅔ px | gracenote.ts:66-99 |
| SMuFL Bravura | `graceNoteSlashSW/NE` | 2.456 sp below flag origin | 0.796 sp | ≈40.7° | — | bravura_metadata.json |

---

#### Q5. Stem-down graces

| Engine | Direction | Source |
|---|---|---|
| MuseScore | **mirrored**: `up = +1` for down stems flips both the start offset and the rise, so the slash falls to the right (start above the tip, end lower right) | tlayout.cpp:5419, 5431, 5445, 5458 |
| Verovio | **mirrored** (sign of Y1/Y2 flipped), plus the unit/3 shift for 8th/no flag | view_element.cpp:2061-2078 |
| LilyPond | **mirrored** — `dgrace` is a separate glyph with `y_mirror_char` and slightly different flare/depth (0.99 / 2.85 sp) | feta-flags.mf:1263-1297 |
| VexFlow | **mirrored**: down = (x−w, y−w)→(x+w, y+w) | gracenote.ts:77-83 |
| SMuFL | separate `flag8thDown` anchors NW/SE (mirrored) | bravura_metadata.json |
| Dorico/Sibelius/Finale | UNKNOWN | — |

No engine read here draws an always-rising slash on a down stem.

---

#### Q6. Beamed groups (brief)

| Engine | Which stems | Geometry | Source |
|---|---|---|---|
| MuseScore | first chord of the beam only (`beam()->elements().front()`); toggling the property sets it on every chord of the beam | start as the no-hook case (0.924 sp from the beam-end tip); length **2 sp** (×1.1 when the beam angle is obtuse to the slash); angle = 40° + ½ beam angle | chordlayout.cpp:1259; chord.cpp:2212-2226; tlayout.cpp:5446-5455 |
| Verovio | **none** (`!stem->IsInBeam()`) | — | view_element.cpp:1789 |
| LilyPond | `\acciaccatura` beamed: **none** (documented known issue); `\slashedGrace`: `beam::slashed-stencil` — `slash-side` LEFT, `slash-stem-fraction` 0.3, `over-beam-height` 0.75 sp, `slash-X-positions (-0.5 . 1)`, `slash-slope` 2, thickness = stem thickness·line-thickness | rhythms.itely:4804; grace-init.ly:50-58; output-lib.scm:350-440 |
| VexFlow | every note with `slash: true`; `calcBeamedNotesSlashBBox(8·scale, 8·scale, {stem: 6·scale, beam: 5·scale})` — a point 8 px along the beam and 8 px down the stem, extended by protrusions; "FIXME: should render slash after beam?" | gracenote.ts:57-65, 106-143 |
| Dorico | "slashes appear at the beginning of grace note beams"; property *Slash protrusion from beam* | Dorico help (search snippet); https://archive.steinberg.help/dorico/v1/en/dorico/topics/notation_reference/notation_reference_grace_notes_slashes_length_changing_individually_t.html |
| Finale | none by default ("Normally, Finale adds slashes only to flagged (unbeamed) grace notes"); workaround = a custom expression shape | https://usermanuals.finalemusic.com/Finale2012Win/Content/Finale/Grace_notes6.htm |

---

#### Q7. User-facing options

| Product | Option | Default | Source |
|---|---|---|---|
| MuseScore | Style `stemSlashPosition` / `stemSlashAngle` / `stemSlashThickness` | 2.0 sp / 40° / 0.125 sp | styledef.cpp:280-282 |
| MuseScore | per chord "Show stem slash" | on for acciaccatura | StemSettings.qml:62; chord.cpp:1695 |
| Verovio | `--grace-factor` (scales the slash offsets); `--stem-width` (slash = ×1.2) | 0.75 / 0.20 unit | options.cpp:1326-1328, 1532-1533 |
| LilyPond | `Flag.stroke-style`, `Beam.details` slash-* keys (Q6) | "grace" under `\acciaccatura` | grace-init.ly; output-lib.scm |
| Dorico | Engraving Options › Notes › Grace Notes: thickness of slashes, default length, position relative to the end of the stem (forum names the section "Slash on Stem") | **values UNKNOWN** | https://archive.steinberg.help/dorico_pro/v2/en/dorico/topics/notation_reference/notation_reference_grace_notes_slashes_c.html ; https://forums.steinberg.net/t/grace-note-global-settings-with-slashes/939477 |
| Dorico | Properties › Grace Notes: *Slash inset from stem tip*, *Slash offset to right*, *Slash length*, *Slash protrusion from beam* (activating *Slash length* resets it to 0) | UNKNOWN | https://archive.steinberg.help/dorico/v1/en/dorico/topics/notation_reference/notation_reference_grace_notes_slashes_position_changing_individually_t.html ; …_slashes_length_changing_individually_t.html |
| Finale | Document Options › Grace Notes: *Grace Note Slash Thickness*; *Always Slash Flagged Grace Notes*; Grace Note Size 50% | thickness value not in the manual; musxdom test files store `graceSlashWidth` **115 EFIX** = 115/64 EVPU ≈ **0.075 sp** (1 sp = 24 EVPU) | Finale manual URL (Q1); musxdom `src/musx/dom/Options.h:525-526`, `Fundamentals.h:62,89-92`, `tests/data/*.enigmaxml` |
| Sibelius | Engraving Rules › Notes and Tremolos: grace note size; no slash options found; stem-length plug-in | UNKNOWN | Scoring Notes URL (Q2) |

Note: Dorico exposes no *angle* option in anything found — only inset (vertical), offset to right, length, thickness, protrusion.

---

#### What nobody answers (UNKNOWN)

1. Dorico's default values for slash inset, offset, length, thickness, protrusion — the manual names the options but gives no numbers.
2. Whether Dorico and Sibelius slash a flagless (quarter/half) acciaccatura, and how.
3. Dorico's and Sibelius's grace stem-length rules (Scoring Notes judges Dorico "correct", Sibelius "too short", gives no numbers).
4. No engine read implements Gould p.126 as stated (lengthen the stem so the *slash* clears a ledger line). Verovio's flag-vs-first-ledger
   lengthening comes closest and only for flagged notes; MuseScore, LilyPond and VexFlow have nothing.
5. No engine moves the slash itself vertically to avoid staff lines, ledger lines, heads or accidentals.
6. LilyPond's exact slash angle in degrees (needs the compiled Emmentaler notehead width; font not built on disk).
7. SMuFL `graceNoteSlash*` anchors exist only on 8th flags (Bravura, Petaluma); no engine read here uses them, and there is no anchor
   for 16th/32nd flags or for flagless stems.
8. VexFlow on a whole note: by code reading a slash is drawn; not rendered to confirm.


### E.2 — The literature: every slashed grace measured, ledger lines above all

Follows `docs/research/grace-notes-research.md` Part C §3 / §10. Sources are the books in `reference/`,
used as `reference/README.md` says: the OCR was used only to find pages, every quotation below comes
from a rendered scan, and every number was measured off the scan.

**How it was measured.** Gould: PDF = printed + 20, rendered at **600 dpi** (`pdftoppm -r 600 -gray`),
where 1 sp = 26.5–27.5 px, taken from each figure's own staff lines. Ross: PDF = printed + 12, 600 dpi,
1 sp ≈ 34.1 px. Stone: PDF 22 / 48 / 81 (2-up). Gerou & Lusk (G&L): PDF 38 = printed 72–73, 600 dpi,
1 sp ≈ 57 px. Ink means gray < 128, read from ASCII pixel dumps with PIL.
- **Stem length** is measured from the centre of the head's ink box to the tip. Where the tip merges into a staff line, it is taken at the line's centre (±1 px).
- **Slash length and angle** are measured between the two end points of the stroke's centre line.
- **Crossing** is where that centre line meets the stem's centre column.

⚠️ Every page render and pixel dump is in this session's scratchpad (`g600-*.png`, `r600-*.png`,
`s600-022.png`, `gl600-38.png`, `m.py`, `gm.py`), and the scratchpad does not last. The page numbers
and pixel coordinates below are enough to measure everything again.

---

#### ⭐ Headline findings

1. **Gould places the slash relative to the STEM TIP, not the notehead.** In 11 correctly drawn up-stem singles:
   - the slash crosses the stem **1.05–1.17 sp below the tip**;
   - its lower-left end sits **1.42–1.57 sp** below the tip;
   - its upper-right end sits **0.16–0.25 sp** below the tip.

   This holds whatever the stem length, and her stem lengths run from 2.21 to 3.77 sp. So the crossing's
   *fraction* of the stem varies (0.30–0.50) while its *distance from the tip* stays fixed. Dorico's option
   *"Position of grace note stem slashes relative to the end of the stem"* and SMuFL's slash anchors on the
   **flag** glyph encode the same model.
2. **The ledger-line rule is carried out by making the stem LONGER, never by moving the slash.**
   - p. 126's pair, a G3 grace: the "not" version has a 2.65 sp stem, and its slash crosses the stem
     **exactly on the C4 ledger line**. The correct version has a 3.25 sp stem, and its slash clears the
     C4 ledger by 0.36 sp.
   - p. 130: an F3 grace on the 3rd ledger has a **3.77 sp** stem.
   - In every correct low case the stem tip reaches about the **G4 line** (2nd line of the staff).
3. **Staff lines are NOT avoided.** In 8 of Gould's 11 correct instances a staff line runs through the
   slash. In 3 of them it crosses the stem **exactly on a staff line** (p. 126 G3 on the E4 line; p. 130 B3
   on the E4 line; p. 129 D4 on the G4 line). The ban is on ledger lines only. The obvious reason is
   Gould p. 26: *"a player … can take in the number of ledger lines at a glance"*. A stroke on a ledger
   line confuses the count, while a stroke on a staff line confuses nothing.
4. **Gerou & Lusk draw exactly the case Gould forbids.** G&L p. 73 has an A3 grace with a 2.15 sp stem,
   and its slash crosses the stem on the C4 ledger line. This matches their sentence that ledger-line
   grace stems *"do not have to be lengthened"*. Their sentence is about the middle line, but their
   drawing is the configuration Gould forbids.
5. **No source shows or discusses a slashed crotchet or minim grace.** Three books define the single slashed grace as an EIGHTH:
   - Gould: *"a small quaver"*;
   - Stone: *"notated as eighths"*;
   - G&L: *"considered eighth notes"*.

   The one flagless slash anywhere is Stone p. 141's *"extra beam with slash"* on full-size grace notes in spatial notation.

---

#### Q1. Ledger lines and the slash

| source | page | quotation (from the scan) | measured drawing |
|---|---|---|---|
| Gould | 126 | *"Ensure that a grace note on ledger lines has a sufficiently long stem for the diagonal stroke not to obscure a ledger line:"* — then an *and / not* pair. (See also *Ledger lines*, p. 26.) | **The pair is a G3 grace (hanging below the A3 ledger, with the C4 ledger above it) before an A3 crotchet.** **CORRECT:** head centre y 1706.5, tip y 1617 (on the G4 line) ⇒ **stem 3.25 sp**. The slash (1510,1656)→(1551,1621.5) is 1.95 sp long at 40–41°. It crosses the stem at y 1646, **1.05 sp below the tip, i.e. ON the bottom staff line (E4, y 1643, within 0.1 sp)**. Its lower end is **0.36 sp above the C4 ledger**. **NOT:** head centre y 1709.5, tip y 1639 (at the bottom line) ⇒ **stem 2.65 sp**. The slash is 2.08 sp at 40.6° and crosses the stem 1.17 sp below the tip, at y 1670, **i.e. ON the C4 ledger (y 1669)** — the fault. So the stem grows by ≈0.6 sp (one staff step, tip from the E4 line to the G4 line) while the slash **keeps its place relative to the tip**. |
| Gould | 26 | *"Ledger lines … are about twice as thick"* [as stave-lines] · *"It is important that ledger lines are visibly thicker than stave-lines so that a player reading a passage of ledger-line notes can take in the number of ledger lines at a glance."* · *"Grace notes take ledger lines that are shorter and thinner than full-sized notes, in proportion to their smaller noteheads"* | The figure is an unslashed beamed grace group on ledgers. The p. 26 sentence is the likely **rationale** for the p. 126 rule: the ledger COUNT has to stay readable. ⚠️ That is my inference. Gould does not tie the two together. |
| Gould | 130 (*Articulation*, grace 3) | (figure only) | **F3 on the 3rd ledger** (ledgers C4 y 4285.5, A3 4311, F3 4338.5; sp 26.5). Tip y 4238, 0.26 sp below the G4 line ⇒ **stem 3.77 sp**. The slash is 2.02 sp at 41.6°. It crosses the stem **1.13 sp below the tip**, in the D4 space (0.38 sp under the E4 line). The E4 staff line cuts the slash on the flag side. Its lower end is **0.23 sp above the C4 ledger**. |
| Gould | 130 (*Articulation*, grace 2) | (figure only) | **B3 under one C4 ledger.** Tip on the G4 line ⇒ **stem 2.68 sp**, i.e. hardly longer than normal, because the slash already clears the one ledger. The slash is 2.09 sp at 39.1° and crosses **1.17 sp below the tip, exactly ON the bottom staff line (E4)**. Its lower end is **0.6 sp above the C4 ledger**. |
| Gould | 129 (*Slurs*, grace 4) | (figure only) | **D4 under the staff, no ledger**, stem 2.64 sp. The slash is 2.17 sp at 37.7° and crosses the stem 1.14 sp below the tip, **exactly on the G4 line**. |
| Gould | 130 (top pair, *"and not"*) | *"A slur should always be placed above the notes when it would otherwise collide with the accidentals of a measured value"* | **A HIGH grace: D6 above the C6 ledger, with the A5 ledger below that.** Stem **2.37 sp (normal)**. The slash is 2.02 sp at 40.5° and crosses 1.10 sp below the tip. Nothing is near it. ⭐ **For an up-stem grace ABOVE the staff the ledgers lie between the head and the staff, i.e. on the far side from the stem and slash, so the rule can never apply.** Only graces BELOW the staff (ledgers between head and staff, crossed by the up-stem) need a longer stem. |
| Gould | 144 | (glissando figures, a low slashed grace before a glissando) | seen, not measured |
| Ross | 191 | *"When grace notes appear among leger lines, the slur should be placed so as to avoid coming in contact with the leger lines."* (CONFUSING / CORRECT) | The figure is a beamed, **unslashed** group, and the rule is about the slur. His p. 191 slur figure has single slashed graces **above** the staff on ledgers, with normal stems. ⛔ **Ross draws no slashed grace below the staff with ledgers.** |
| G&L | 73 | *"Stems for grace notes on leger lines do not have to be lengthened to meet the middle line."* | Three up-stem slashed graces. The low one is **A3 on the 2nd ledger** (sp 57 px; C4 ledger at local y ≈1207.5, A3 ledger ≈1266.5). Tip at the bottom staff line ⇒ **stem 2.15 sp**. The slash (4371,1225)→(4436,1176) is **1.43 sp at 37°**, crossing the stem 1.17 sp below the tip (0.55 of the stem) at y 1212, **i.e. ON the C4 ledger line (0.08 sp from its centre)**. ⇒ **G&L's drawing is Gould's p. 126 "not".** |
| Stone | 22, 49 | (grace stems *"about 2½ spaces"*, p. 49) | ⛔ No ledger-line slashed grace found in the scans read (pp. 21–22, 49–51, 74–75, 140–141). |

**The stem-length pattern (Gould, measured):**
- In the staff: 2.21–2.64 sp.
- Below the staff with ledgers above the head: 2.68 (B3, 1 ledger), 3.25 (G3, 2 ledgers), 3.77 (F3, 3 ledgers).
- The distance from the tip down to the topmost (C4) ledger is 2.2 / 1.82 / 1.79 sp in the three correct cases, and **1.13 sp in the "not"**.

**A rule implied by her drawings (derived, not stated anywhere):** the lower end of the slash (≈1.5 sp below the tip) must clear the topmost ledger line by about 0.2 sp or more. That means a tip at least ≈1.8 sp above the ledger nearest the staff. In practice the tip reaches about the G4 line (treble).

#### Q2. The slash against STAFF LINES

| source | page | quotation | measured drawing |
|---|---|---|---|
| Gould | 126 | *"Place the diagonal stroke so that, ideally, white space shows through between the stem, the tail or beam and the diagonal."* | The white space she means is **inside the stem–flag angle**. The sentence is not about staff lines. |
| Gould | 125, 126, 129, 130 (11 correct instances) | — | **8 of 11 have a staff line passing through the slash.** 3 cross the stem exactly on a staff line: p. 126 G3 (E4), p. 130 B3 (E4), p. 129 D4 (G4). Others cross it within 0.15–0.19 sp of a line: p. 130 A4 (D5 line), p. 130 D5 (F5 line). **No sign of the slash being placed BETWEEN lines.** The crossing point is fixed relative to the tip, wherever that puts it on the staff. |
| Ross | 190 | rule 2: *"The slash should bisect the flag in such a manner as to permit white space to be seen towards the end of the stem joining the flag."* | The white space again means **inside the stem/flag join**. Nothing about staff lines. |
| Stone, G&L | — | nothing | G&L's p. 73 in-staff examples also have lines through their slashes (seen, not measured). |

⇒ **No source asks the slash to avoid staff lines. Every drawing in all four books lets a staff line cross the slash. The one line a slash must not obscure is a LEDGER line (Gould p. 126).**

#### Q3. A slash without a flag, and the written value of an acciaccatura

| source | page | quotation (scan) | drawing |
|---|---|---|---|
| Gould | 125 | *"A single grace note is a small quaver with a diagonal stroke that intersects the tail."* · *"A diagonal stroke may be placed through the beam if grace notes might otherwise be confused with an appoggiatura."* · *"It is common practice to place a diagonal line through a single beam."* | The only slash placements she names are **tail** (flag) and **beam**. Every slashed single in pp. 125–131 and 144 is a quaver. |
| Stone | 22 | *"Single grace notes should be notated as eighths; two or more grace notes as sixteenths. Single grace notes must have a thin slanted line through stem and flag; two or more grace notes must have the slanted line through stem and beams.\*"* Footnote: *"If the slanted line is omitted, single grace notes turn into appoggiaturas, which have measured durations depending on the durational context in which they occur:"* | The footnote figure has an unslashed **quaver** and an unslashed **crotchet** appoggiatura ("may be performed" as measured notes). There is **no slashed crotchet**. |
| Stone | 75 | *"If a trill is to begin with two or more opening notes, small sixteenth notes with a slash should precede the trill note"* | beamed group, slashed |
| Stone | 141 | *"Another solution is to use an extra beam with slash for grace notes:"* … *"This notation is more legible because all note-heads are equally large. Its drawback is that full-size grace notes generally take up more horizontal space than they should in spatial notation."* | ⭐ **The only flagless slash in the four books**: in spatial notation, FULL-SIZE grace notes hang from an extra beam carrying the slash. It sits on a beam, not a bare stem. |
| G&L | 72–73 | *"Single grace notes are considered eighth notes."* · *"For single grace notes with a flag, a small line can intersect the flag…"* · *"Multiple grace notes should never have a slanted line through the stems or beams. The slanted line is only for single, flagged grace notes."* | Every slashed grace drawn is a flagged eighth. |
| Ross | 190–191 | *"1. The slash through the stem and flag goes…"* · *"Two or three beamed grace notes bear the value of sixteenth notes. Four or more have the value of thirty-second notes."* | All his slashes are on flagged eighths. |

⇒ **Four for four: a slash is drawn through a FLAG (G&L: only there; Gould and Stone: also on a beam).** Three
books state that a single slashed grace is written as an eighth. **No book shows or discusses a slashed crotchet, minim or other unflagged
single grace.** Whether one may exist is **UNKNOWN** in the literature. The engines are another matter
(research doc Part B §3.6): MuseScore's `StemSlash` has an explicit branch for an unbeamed chord with
**no hook**, starting at `2.0 sp × 0.66` below the tip, so the software supports it. The books do not.

#### Q4. Slash geometry — per instance

Gould, up-stem singles, 600 dpi. "Left" and "right" are the stroke's ends measured from the stem's centre
line. "Down" is how far below the tip. Thickness: every correct stroke has a 5 px horizontal run, i.e.
≈3.2 px perpendicular ≈ **0.12 sp**, against a stem of 3–4 px ≈ **0.11–0.13 sp**. ⇒ the slash is about as
thick as the stem (the threshold sets the exact value; the earlier pass read 0.09).

| # | page / figure | head | stem (sp) | slash length (sp) | angle | crossing below tip (sp) | as a fraction of the stem | left end ← stem (sp) | right end → stem (sp) | upper end ↓ tip | lower end ↓ tip | lines cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 126 *diagonal… notehead*, "and", grace 1 | D5 (line) | 2.24 | 2.06 | 40.2° | 1.07 | 0.48 | 0.50 | 1.07 | 0.17 | 1.50 | F5 line cuts the lower-left part |
| 2 | 126 ledger pair, "and" | G3 (2 ledgers) | **3.25** | 1.95 | 40.9° | 1.05 | 0.32 | 0.47 | 1.02 | 0.16 | 1.42 | crosses the stem ON the E4 line; clears C4 by 0.36 |
| 3 | 129 *Slurs*, grace 1 | E4 (line) | 2.64 | 2.13 | 39.3° | 1.16 | 0.44 | 0.49 | 1.16 | 0.21 | 1.55 | B4 line; lower end touches the G4 line |
| 4 | 129 *Slurs*, grace 3 | G4 (line) | 2.60 | 2.01 | 40.5° | 1.06 | 0.41 | 0.49 | 1.05 | 0.17 | 1.48 | D5 line; lower end touches the B4 line |
| 5 | 129 *Slurs*, grace 4 | D4 (below) | 2.64 | 2.17 | 37.7° | 1.14 | 0.43 | 0.49 | 1.23 | 0.19 | 1.51 | crosses the stem ON the G4 line |
| 6 | 130 *Articulation*, grace 1 | A4 (space) | 2.45 | 2.02 | 40.1° | 1.13 | 0.46 | 0.47 | 1.08 | 0.23 | 1.53 | D5 line |
| 7 | 130 *Articulation*, grace 2 | B3 (1 ledger) | 2.68 | 2.09 | 39.1° | 1.17 | 0.44 | 0.49 | 1.13 | 0.25 | 1.57 | crosses the stem ON the E4 line |
| 8 | 130 *Articulation*, grace 3 | F3 (3 ledgers) | **3.77** | 2.02 | 41.6° | 1.13 | 0.30 | 0.45 | 1.06 | 0.19 | 1.53 | E4 line; clears C4 by 0.23 |
| 9 | 130 *Articulation*, grace 4 | D5 (line) | 2.21 | 2.02 | 40.8° | 1.10 | 0.50 | 0.45 | 1.08 | 0.17 | 1.49 | F5 line |
| 10 | 130 top pair, "and" | D6 (above the staff) | 2.37 | 2.02 | 40.5° | 1.10 | 0.46 | 0.49 | 1.05 | 0.21 | 1.51 | none |
| — | earlier pass (Part C §3), pp. 125/126/129 | — | 2.3–2.7 | 2.1–2.2 | 38–39° | 1.14–1.17 | ≈0.5 | ≈0.5 | ≈1.15 | — | — | — |
| ✗ | 126 ledger pair, "**not**" | G3 | 2.65 | 2.08 | 40.6° | 1.17 | 0.44 | 0.75 | 0.83 | — | — | **ON the C4 ledger** |
| ✗ | 126 *diagonal… notehead*, "**not**", grace 1 | D5 | ≈2.3 | ≈2.6 | ≈44° | **≈1.64** | **≈0.72** | — | — | — | at head level | the slash runs into the NOTEHEAD (the fault shown) |

**Gould's slash, correct instances only:**
- length **1.95–2.17 sp** (median ≈2.02);
- angle **37.7–41.6°** (median ≈40.5°), rising to the right on an up-stem;
- it crosses the stem **1.05–1.17 sp below the tip**;
- ≈**0.47 sp** of it lies left of the stem (the head side) and ≈**1.05–1.2 sp** right of it (the flag side);
- its upper-right end is ≈0.2 sp below the tip and passes the flag's outer curve by a few px;
- its lower-left end is ≈1.5 sp below the tip.

⚠️ The distance from the head does NOT stay constant: it is whatever is left of the stem.

**Other books:**

| source | page | instance | measured |
|---|---|---|---|
| Ross | 190 (example above rule 1) | up-stem grace, G4 (on the line) | ⚠️ low confidence: the 1970 plate's staff lines are 0.17 sp thick and merge with the stroke. Stem ≈**1.96 sp** (tip at the B4 line). Slash ≈**1.3 sp at ≈30°**, crossing ≈1.2 sp below the tip (≈0.6 of the stem). |
| Ross | 190 rule 2, CORRECT up-stem glyph (drawn alone, no staff ⇒ no sp scale) | isolated | Slash **≈19°**, crossing at **0.59 of the stem from the tip**, length ≈0.85 × the stem. It passes below the flag's join, leaving the white triangle rule 2 asks for. |
| Ross | 190 rule 2, INCORRECT | isolated | The slash is drawn through the flag's far end (lower), with no white space at the stem/flag join (seen). |
| G&L | 73 | A3 on a ledger (above) | 1.43 sp, 37°, crossing 1.17 sp below the tip; stem 2.15 sp |
| Stone | 22, 75 | small plates | seen, not measured. The p. 22 plate is too coarse at this size to separate the slash from the flag. |
| SMuFL / Bravura (my arithmetic on the anchors quoted in Part D §4; not a published number) | `flag8thUp`: `graceNoteSlashSW [-0.644,-2.456]`, `graceNoteSlashNE [1.284,-0.796]` | full-size flag | 2.54 sp at 40.7°, both ends placed relative to the **flag origin = the stem tip**. At a 0.63 grace scale that is ≈1.6 sp long, lower end ≈1.55 sp and upper end ≈0.5 sp below the tip, crossing ≈1.2 sp below the tip. ⇒ **the same model as Gould's drawing and almost the same crossing depth.** Gould's stroke is longer (≈2.0 sp) and runs higher, to ≈0.2 sp below the tip. |

#### Q5. Other literature and online sources

| source | where | quotation | status |
|---|---|---|---|
| Scoring Notes, Philip Rothman, 25 Aug 2020, "Adjust grace note stem lengths with Sibelius plug-in" | https://www.scoringnotes.com/tips/adjust-grace-note-stem-lengths-with-sibelius-plug-in/ | Quotes Gould p. 126 *"Ensure that a grace note on ledger lines has a sufficiently long stem for the diagonal stroke not to obscure a ledger line."* Says Sibelius's default is *"generally unappealing"*, **Dorico gets it right without intervention**, and Finale and MuseScore also need adjusting. Bob Zawalich's *Adjust Grace Note Stem Lengths* plug-in lengthens the stems (settings for slashed, unslashed or both; Opus/Helsinki/Norfolk). | fetched; the page gives no numbers (WebFetch summary, ⚠️ not a full verbatim read) |
| Dorico 2 manual, *Grace note slashes* | https://archive.steinberg.help/dorico_pro/v2/en/dorico/topics/notation_reference/notation_reference_grace_notes_slashes_c.html | Engraving Options: *"Thickness of grace note stem slashes"*, *"Default length of grace note stem slashes"*, *"Position of grace note stem slashes relative to the end of the stem"* | fetched. The values are **UNKNOWN**. ⭐ The position is measured from the STEM END, the same model as Gould's drawing. |
| Dorico 2 manual, *Grace note stems* | https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_grace_notes_stems_c.html | *"Grace notes are scaled-down notes, so the length of grace note stems is determined by your project-wide settings for the stem length of all notes."* | fetched. The page does not say how Dorico lengthens a stem for ledgers: **UNKNOWN**. |
| Dorico blog, Development diary part 10 (2015) | https://blog.dorico.com/2015/03/development-diary-part-10/ | grace notes *"typically around two thirds or three fifths the size of normal notes"*; a grace beam ≈0.3 sp thick with a 0.15 sp gap | fetched; nothing on the slash |
| SMuFL, *Common ornaments* | https://smufl.formats.music/latest/tables/common-ornaments.html | U+E560 `graceNoteAcciaccaturaStemUp` *"Slashed grace note stem up"* … U+E564 `graceNoteSlashStemUp` *"Slash for stem up grace note"*. Note: *"Scoring applications should draw grace notes in the same way as they draw regular notes, rather than using the precomposed glyphs."* | fetched (WebFetch rendering). There is no slashed-quarter glyph. |
| SMuFL, *Glyphs with anchors* | https://smufl.formats.music/latest/specification/glyphswithanchors.html | `graceNoteSlashNE`: *"The Cartesian coordinates in staff spaces of the top right corner of a diagonal line drawn instead of using the glyph graceNoteSlashStemUp"* (+ SW/NW/SE) — anchors of **unbeamed grace-note flags** | fetched. ⭐ The spec ties the slash to the FLAG glyph. |
| Wikipedia, *Acciaccatura* | https://en.wikipedia.org/wiki/Acciaccatura | *"It is written using a grace note (often a quaver, or eighth note), with an oblique stroke through the stem."* | tertiary; the "often" is unsourced |
| Clinton Roemer, *The Art of Music Copying* | only bookseller/Goodreads/Scribd listings found | — | **UNKNOWN** (no text reachable) |
| Gardner Read, *Music Notation* | Google Books listing only (id `pGQJAQAAMAAJ`, no preview) | — | **UNKNOWN** (not on disk, no text reachable) |
| MOLA Guidelines | Scribd copies only; notat.io t=656 (the README marks notat.io as Cloudflare-gated) | — | **UNKNOWN** |

---

#### What nobody answers (UNKNOWN)

- **A stated rule** for the slash's angle, length, crossing point or thickness. No book gives one. Gould's
  drawings are the only numbers (≈2.0 sp, ≈40°, ≈1.1 sp below the tip, stem thickness).
- **A stated rule** for HOW MUCH to lengthen a ledger-line grace stem. Gould: *"sufficiently long"*. The
  ≈1.8 sp-above-the-top-ledger threshold is my reading of three drawings.
- Whether a slash may cross a staff line. No one discusses it. The drawings say yes.
- A slashed crotchet, minim or other unflagged single grace — unmentioned and undrawn in all four books.
- Dorico's default values for slash length, thickness and position, and its ledger-lengthening rule.
- Roemer, Gardner Read, MOLA: not reached.
- Down-stem ledger cases (a lower-voice grace above the staff whose down-stem passes ledgers): no figure found.

#### Where the sources disagree

1. **Lengthening the stem for ledgers.** Gould p. 126: lengthen it so the slash clears the ledger, with a
   drawn and/not pair. **G&L p. 73**: *"do not have to be lengthened to meet the middle line"*, and their
   figure puts the slash **on the C4 ledger**, exactly Gould's "not". Strictly, the two sentences answer
   different questions (clearing a ledger vs. reaching the middle line). The drawings do conflict.
2. **Slash angle and length.** Gould ≈40°, ≈2.0 sp (≈0.8 of the stem). G&L ≈37°, 1.43 sp. Ross ≈19–30° and
   short (low confidence). Bravura's anchors ≈41°, ≈1.6 sp at grace scale.
3. **Where it crosses.** Gould fixes the crossing ≈1.1 sp below the tip, so it moves up and down the stem as
   the stem changes. Ross draws it lower on the stem (≈0.6 of the stem from the tip) but keeps it clear of the
   flag join by rule 2. MuseScore (Part B) starts at 1.4 sp × grace mag below the tip.
4. **The slash on beams** (repeated from Part C): Stone *must*, G&L *never*, Gould *may*. Stone p. 141 alone
   also puts one on a beam of FULL-SIZE grace notes.
5. **Written value.** Gould, Stone and G&L agree the single slashed grace is an eighth. Group values
   differ (Part C §5).

---

## Part F — DOTS on grace notes — the deep pass (2026-09-22)

Asked for after his screenshot of a dotted grace (*"i think the position of the dot is not correct, we
should see how the normal note use the dot position and aply to the grace proportionally"*), and his
*"send an agent to inspect the literature and the engines for the dot"*. Builds on
`docs/research/accidental-dot-engines.md` / `accidental-dot-research.md` (normal notes). §F.1 the engines;
§F.2 the literature.

⭐⭐ **The two halves DISAGREE on the gap, and it is his call** (`docs/plans/grace-notes-plan.md`):

| | the dot's SIZE | the head→dot and dot→dot GAPS |
|---|---|---|
| **the books** (no dotted GRACE is drawn anywhere; dotted CUE notes measured instead — Gould pp. 449, 469, 570–572; Stone p. 161) | scaled (Gould's cue dot 0.38 sp against 0.49–0.53 full) | ⛔ **NOT scaled** — Gould's cue gaps 0.27–0.60 sp against 0.33–0.38 full; Stone 0.28 against 0.22 |
| **MuseScore** | scaled (`notedot.cpp:64-67`) | ✅ scaled where it DRAWS (`chordlayout.cpp:3192-3194`, `correctMag`) — ⚠️ its ROOM uses the staff's size only (`:106-107`); the two agents each read one of those lines, and both are right |
| **Verovio · LilyPond** | scaled | scaled (§F.1 Q1) |
| **VexFlow** | scaled | its literal 2 px / 1 px — unscaled |
| **what we draw** (`graceDotXs`) | scaled | scaled — the three engines' answer |



⭐ **What was built on it** (`layout/graceRoom.graceDotXs`, `rendering/GracePass.drawGraceDots`): the
NORMAL note's dot rule (`rendering/format/dotPlacement` + `engrave/notes/modifierStart`) run at the grace's
size — glyph AND both gaps scaled, which is what MuseScore, Verovio and LilyPond do (§F.1 Q1); pushed past
the flag on a stem-up flagged grace, VexFlow's and MuseScore's answer (§F.1 Q2 — the engines split);
a head on a line lifts its dot half of the STAFF's space (§F.1 Q3 — every engine). Measured against a
normal note in the same render: 16.2 px against 25 × ⅔ = 16.7 (an 8th), 11.2 against 17 × ⅔ = 11.3 (a
quarter).

### F.1 — The engines: how a grace note's dot is sized, spaced and pushed

Research only; no repo file edited. This builds on `docs/research/accidental-dot-engines.md` (dots on NORMAL
notes) and `docs/research/grace-notes-research.md` Parts B/E (grace scale factors). Paths are relative to
`~/dev/engine-sources/<engine>/`. **sp** means page staff spaces (the staff the grace sits on). **g-sp** means the same
distance divided by the grace factor, i.e. "in the grace's own staff spaces". A number marked **≈** is derived
from source arithmetic and was not run or measured.

Scale factors (from grace-notes-research, re-checked here):
MuseScore `graceNoteMag` 0.7 (`src/engraving/style/styledef.cpp:517`, applied in `Chord::intrinsicMag`,
`dom/chord.cpp:2063-2076`) · Verovio `graceFactor` 0.75 (`src/options.cpp:1326-1327`) · LilyPond `font-size -3` =
2^(−3/6) = 0.7071 (`scm/music-functions.scm:674-688`, `magstep` at `scm/lily-library.scm:1718-1719`) · VexFlow
`GraceNote.fontScale` 2/3 (`build/esm/src/metrics.js:99-101`).

---

#### ⚠️ Correction to an existing doc first

`docs/research/grace-notes-research.md:551-553` and `:610` say VexFlow draws a dot on a grace note at the full
30 pt ("`dot.ts` never consults the note's font scale"). **The source says otherwise.** `Dot.setNote` copies the
note's font: `this.font = note.font` (`vexflow-5.0.0-npm/package/build/esm/src/dot.js:106-110`; the same line is in
the TS repo, `vexflow/src/dot.ts:140-144`). A `GraceNote`'s font is built from its category, so it is
`Metrics.getFontInfo('GraceNote')` = 30 × 2/3 = **20 pt** (`element.js:56-63`, `metrics.js:12-23, 99-101`).
`setFont` clears `metricsValid` (`element.js:205-211`), so the dot's width is measured again at 20 pt the next
time it is read (`element.js:275-278, 339-349`). `Note.addModifier` calls `setNote` (`note.js:282`). **The dot
on a VexFlow grace note is therefore drawn at 2/3 size, and its width is measured at 2/3 size.** VexFlow's gaps
are still unscaled, as described below.

---

#### Q1: Glyph size, head→dot gap, dot→dot gap

##### MuseScore 4 (Bravura)
- **Glyph:** scaled. `NoteDot::mag() = parentItem()->mag() * dotMag` (`dom/notedot.cpp:64-67`). A grace note's
  `mag()` is its chord's `mag()` (`dom/note.cpp:2430-2437`), which already includes `graceNoteMag`. The dot's bbox
  is `symBbox(augmentationDot)` at the note's magS (`rendering/score/tlayout.cpp:4268-4278`; `symWidth` uses
  `magS()`, `dom/engravingitem.cpp:1874-1877`).
- **Gaps:** scaled. Grace chords are laid out in `layoutChords3` (`rendering/score/chordlayout.cpp:1689-1690`),
  and their notes go through the same `layoutNote2`. The code there is:
  ```cpp
  double correctMag = chord->notes().size() > 1 ? chord->mag() : item->mag();   // :3192
  double d  = ctx.conf().point(ctx.conf().styleS(Sid::dotNoteDistance)) * correctMag;  // :3193
  double dd = ctx.conf().point(ctx.conf().styleS(Sid::dotDotDistance)) * correctMag;   // :3194
  ```
  The anchor `dotPosX` is the head's right edge, `noteX + headBodyWidth()` (`:2800`). `headBodyWidth` is the
  head glyph at the grace mag (`dom/note.cpp:1103-1110, 1203-1206`). Placement is `visibleX = x + d; … visibleX += dd`
  (`:3225-3231`).
- **Quirk: the reserved room uses full-size gaps.** `layoutPitched` reserves right-side room (`rrr`) with
  `dotNoteDistance * mag_` and `dotDotDistance * mag_`, where `mag_` is `staffMag` only, not the grace mag
  (`chordlayout.cpp:106-107, 264-268`). The dot width added there *is* scaled (`symWidth`). So a grace chord's
  `spaceRw` reserves 0.5 + 0.28 sp for the first dot, while it draws at 0.35 + 0.28. Whether `spaceRw` is ever read
  for a grace chord is **UNKNOWN**. Grace groups are spaced by shapes (`tlayout.cpp:2765-2790`), and a note's shape
  contains its dots (`tlayout.cpp:4218-4222`).
- **Padding to the next item:** `NOTEDOT→NOTE` = max(0.5, 0.65) = 0.65 sp (`rendering/paddingtable.cpp:94-95`),
  multiplied by the average mag of the two items (`rendering/score/horizontalspacing.cpp:1460, 1468`). Grace dot to
  grace note: 0.65 × 0.7 = **0.455 sp**. Grace dot to main note: 0.65 × 0.85 = **0.5525 sp**, raised to at least
  `graceToMainNoteDist` only when the pair is note→note (`:1513-1515`).

##### Verovio (Leipzig, the default font, `src/options.cpp:1306-1307`)
- **The grace flag reaches the dots:** `PrepareCueSizeFunctor` sets `m_drawingCueSize` on every grace element
  (`src/preparedatafunctor.cpp:218-219`). `LayerElement::IsGraceNote` is true for a DOTS element through its
  ancestor note (`src/layerelement.cpp:194-201`), and DOTS also inherit it explicitly (`preparedatafunctor.cpp:252-257`).
- **Glyph:** scaled. The dot is a drawn circle, not a glyph. `r = DoubleUnit/5` (0.2 sp), then
  `if (dimin) r *= m_graceFactor` (`src/view_graph.cpp:203-210`).
- **Head→dot:** scaled at both of its stages.
  1. The anchor is `xRel = 2 * radius` (`src/calcdotsfunctor.cpp:121-122`), where the radius is half the head's width
     at cue size (`src/layerelement.cpp:658`; `Doc::GetGlyphWidth` multiplies by `graceFactor`, `src/doc.cpp:1877-1885`).
  2. At draw time `x = dots->GetDrawingX() + unit * offsetFactor`, with
     `offsetFactor = cue ? m_graceFactor : 1.0` (`src/view_element.cpp:891, 899`).
- **Dot→dot:** scaled. `DrawDotsPart(…, bool dimin)` computes `distance = dimin ? m_graceFactor : 1.0`, then
  `x += unit * 1.5 * distance` (`src/view_element.cpp:2084-2100`, marked `// HARDCODED`). `dimin` comes from
  `dots->GetDrawingCueSize()` for a note (`:903-904`) and from `chord->GetDrawingCueSize()` for a chord (`:684-686`).

##### LilyPond (Emmentaler)
- **Glyph:** scaled. `(Voice Dots font-size -3)` is set in `general-grace-settings`
  (`scm/music-functions.scm:679`). The glyph is the font's `dots.dot` (`scm/output-lib.scm:666-683`).
- **Head→dot:** scaled, because it is defined as *one dot width*. `DotColumn.padding` =
  `dot-column-interface::pad-by-one-dot-width` (`scm/define-grobs.scm:1264`), which is the max X-extent of the
  column's dot stencils (`scm/output-lib.scm:692-704`), so the grace-sized one here. It is added to the head/stem/flag
  skyline edge (`lily/dot-column.cc:229-232`, `lily/dot-configuration.cc:125-133`).
  `Dot_column_engraver` lives in Staff (`ly/engraver-init.ly:73`) and makes one column per timestep
  (`lily/dot-column-engraver.cc:46-60`). A grace timestep therefore gets its own DotColumn, containing only grace dots.
  Note that `DotColumn` itself gets no font-size override: its padding is scaled only because its *dots* are.
- **Dot→dot:** scaled. `ly:dots::print` stacks the dots with `padding = the dot stencil's own X-extent`
  (`scm/output-lib.scm:686-690`).
- The dot diameter is `(staff_space − stafflinethickness)/2` = 0.45 sp at full size (`mf/feta-dots.mf:23`) ⇒
  **≈0.318 sp** at font-size −3.

##### VexFlow 5.0.0 (Bravura, 10 px = 1 sp)
- **Glyph:** scaled to 2/3 (see the correction above).
- **Head→dot:** NOT scaled. The draw start is `getGlyphWidth() + xShift + 2` px (`stavenote.js:530-531`), and
  the first dot's `xShift` is `getFirstDotPx()`, which is 0 without displaced heads or parentheses (`note.js:307-314`,
  `dot.js:45, 68, 91`). The 2 px is a literal. The head width it adds to is the grace head (20 pt:
  `stavenote.js:351` copies the note's fontInfo onto each notehead).
- **Dot→dot:** half-scaled. `dotShift += dot.getWidth() + dotSpacing` with `dotSpacing = 1` px (`dot.js:32, 92`).
  The width is the 2/3 dot, but the 1 px is a literal.
- The room `Dot.format` reserves (`state.rightShift += xWidth`, `dot.js:97`) leaves out the 2 px start offset and
  any flag shift, both of which are added only at draw (`dot.js:121`). The same is true on normal notes.

##### Table 1: numbers
Dot glyph widths: Bravura 0.40 sp, Leipzig drawn circle 0.40 sp, Emmentaler 0.45 sp (full size).

| | MuseScore (×0.7) | Verovio (×0.75) | LilyPond (×0.707) | VexFlow (×2/3) |
|---|---|---|---|---|
| dot width, sp | 0.28 | 0.30 | ≈0.318 | 0.267 |
| head→dot WHITE, full-size note, sp | 0.50 | 0.30 | 0.45 | 0.20 |
| head→dot WHITE on grace, **sp** | **0.35** | **0.225** (centre at +0.375, minus r 0.15) | **≈0.318** | **0.20** |
| … in g-sp | 0.50 | 0.30 | 0.45 | **0.30** (grows) |
| dot→dot ORIGIN step on grace, sp | 0.455 (0.65×0.7) | 0.5625 (0.75×0.75, centre to centre) | ≈0.636 (2 dot widths) | 0.367 (0.267 + 0.1) |
| dot→dot WHITE on grace, **sp** | **0.175** | **0.2625** | **≈0.318** | **0.10** |
| … in g-sp | 0.25 | 0.35 | 0.45 | **0.15** (grows) |
| verdict | everything × mag | everything × graceFactor | everything × font-size (the gaps *are* the dot width) | glyph scaled, gaps are fixed px |

Three of the four engines scale all three things (glyph, head→dot, dot→dot), so a dotted grace is a uniformly
shrunk dotted note. VexFlow scales only the glyph. Its gaps stay full size on the page, so they are
proportionally 1.5× wider on a grace.

---

#### Q2: Stem-up FLAGGED grace (8th/16th, unbeamed)

##### MuseScore: yes, pushed past the flag, with a vertical test
`chordlayout.cpp:3202-3211`:
```cpp
if (chord->up() && hook && hook->visible()) {
    double hookRight = hook->width() + hook->x() + chord->pos().x();
    double hookBottom = hook->height() + hook->y() + chord->pos().y() + (0.25 * item->spatium());
    double dotY = chord->notes().back()->y() + chord->notes().back()->dots().front()->pos().y();
    if (chord->dotPosX() < hookRight && dotY < hookBottom) { d = hook->width(); }
}
```
The same code runs for graces. The hook is grace-sized, so `d` = flag8thUp width 1.056 × 0.7 = **0.739 sp**
(full-size note: 1.056 sp; Bravura metadata, `fonts/bravura/bravura_metadata.json`). The dot's left edge then sits
one hook-width right of the head's right edge, which is at the flag's right edge. The `+0.25 sp` margin uses
`item->spatium()`, the staff spatium, which is not scaled for graces (`dom/engravingitem.cpp:266-273`,
`dom/staff.cpp:784-787`).

Does the condition fire? ≈ Yes, for any ordinary unbeamed stem-up grace:
- The grace stem is ≈3.5 × 0.7 = 2.45 sp (`stemLength × intrinsicMag`, `rendering/score/stemlayout.cpp:60, 128`;
  hook minimums not evaluated).
- The flag hangs 3.276 × 0.7 = 2.29 sp from the tip, so its bottom is ≈0.16 sp above the head centre, and
  `hookBottom` ≈ +0.09 sp (y points down).
- The dot sits at 0 sp (head in a space) or −0.5 sp (head on a line). Both are < +0.09, so the dot is shifted.

A full-size 8th fires the same way (≈+0.03 sp).

##### Verovio: pushed right by 0.8 × a cue flag width, only if the flag would overlap the dot
`calcdotsfunctor.cpp:110-121`: the shift applies when the stem is up, the note is not in a beam, `GetDrawingStemLen() < 3`
(always true for up stems, whose length is stored negative, `calcstemfunctor.cpp:395, 432`), and `IsDotOverlappingWithFlag` is true.
The shift is `GetGlyphWidth(flag8thUp, staffSize, drawingCueSize) * 0.8` (`// HARDCODED`), which is cue-scaled.

The overlap test (`:179-197`):
`dotMargin = flag.y − note.y − flagHeight(cue) − radius(cue)/2 − dotLocShift·unit`, overlap if < 0.
The flag height uses the 8th's own glyph for an 8th and the 16th glyph for 16th and shorter. Grace stems are not
lengthened (`calcstemfunctor.cpp:471-476`, "Do not adjust the length of grace notes"). Their base stem is
7 units × graceFactor (`calcstemfunctor.cpp:375-378`, `STANDARD_STEMLENGTH 7`, `include/vrv/vrvdef.h:753`).

Leipzig metrics (`data/Leipzig.xml:23, 94, 312`; 1 sp = 250 units): noteheadBlack width 1.256 sp · flag8thUp
width 1.104 sp, height 2.776 sp · flag16thUp height 3.116 sp. For a note low enough that no stem shortening
applies (`src/note.cpp:583-606`):

| Verovio | stem | flag h | r/2 | margin, head in a SPACE | margin, head on a LINE (dot +0.5) | shift |
|---|---|---|---|---|---|---|
| full 8th | 3.5 | 2.776 | 0.314 | +0.41 → none | −0.09 → **shift 0.883 sp** | 0.8×1.104 |
| grace 8th | 2.625 | 2.082 | 0.236 | ≈+0.31 → none | ≈−0.19 → **shift 0.662 sp** | 0.8×1.104×0.75 |
| grace 16th | 2.625 | 2.337 | 0.236 | ≈+0.05 → none | ≈−0.45 → **shift 0.662 sp** | same |

(All values ≈ and in sp.) Chords behave differently: they skip the overlap test. The top note, if not flipped, gets
the 0.8 × flag shift whenever the stem is up, the chord is shorter than a quarter and it is not in a beam (`:82-94`).

##### LilyPond: pushed only if the dot's staff position meets the flag's box
The flag is one of the boxes in the dots' head skyline. Its Y-extent is converted to staff positions:
`Box (flag X-extent, flag Y-extent * 2/ss)` (`lily/dot-column.cc:127-138`). The dot's x is the skyline height at
the dot's own staff position (`lily/dot-configuration.cc:125-133`). So the dot clears the flag only when the flag
reaches down to the dot's row. Regression test for normal notes: `input/regression/dot-flag-collision.ly`
("Dots move to the right when a collision with the (up)flag happens.").

For graces, ≈: the grace stem is 3.5 sp × `length-fraction 0.8` = 2.8 sp (`scm/define-grobs.scm:3454`,
`lily/stem.cc:505-515, 557`; font-size does not enter the length). The Emmentaler up-flag is ≈3 sp deep at full size
(`mf/feta-flags.mf:159`, `total_depth = (3 − shortening)·staff_space − blot/2`), so ≈2.12 sp at −3. Its bottom is then
≈0.68 sp (≈1.36 staff positions) above the head, which is above both a space-dot (pos 0) and a line-dot (pos +1).
**≈ A dotted unbeamed 8th grace keeps its dot next to the head.** This is not verified by rendering; no LilyPond
binary is on this machine.

##### VexFlow: always pushed by the full (grace-sized) flag width, with no vertical test
`Dot.draw` calls `getModifierStartXY(RIGHT, index, { forceFlagRight: true })` (`dot.js:121`), which adds
`this.flag.getWidth()` whenever the stem is up and `hasFlag()` (`stavenote.js:532-536`).
`hasFlag` is false when beamed (`stemmablenote.js:168-170`). The flag has the grace font (`stemmablenote.js:42`),
so the shift is 10.56 × 2/3 = **7.04 px = 0.704 sp**, on top of the unscaled 2 px. The dot's left edge ends up
≈0.2 sp past the flag's right edge.

##### Table 2: first dot of an unbeamed stem-up grace 8th, measured from the head's right edge
| | head in space | head on line | rule |
|---|---|---|---|
| MuseScore | 0.739 sp (hook width) | 0.739 sp | hook box + 0.25 sp vertical test, ≈always fires |
| Verovio | 0.225 sp white (no shift) | 0.225 + 0.662 = ≈0.887 sp | per-note overlap test |
| LilyPond | ≈0.318 sp (no shift) | ≈0.318 sp (no shift) | skyline at the dot's row |
| VexFlow | 0.2 + 0.704 = 0.904 sp | 0.904 sp | unconditional |

---

#### Q3: Vertical placement

No engine has a grace-specific vertical rule. In every engine the half-space move is measured in the staff's
own (unscaled) units, because the grace head sits on the same staff positions:
- **MuseScore:** grace chords get the same `layoutChords3` direction pass (`chordlayout.cpp:1690, 2689-2750`) and
  the same `placeDots` (`:2462-2558`). The y is `dotMove/2 × note->spatium() × lineDistance` (`:2560-2595`), where
  `spatium()` is the staff's and does not include the grace mag (`dom/staff.cpp:784-787`). A head on a line moves
  ±0.5 sp.
- **Verovio:** the same `CalcOptimalDotLocations` (`calcdotsfunctor.cpp:103-104`). `DrawDotsPart` raises an on-line
  dot by one *unscaled* unit, 0.5 sp (`view_element.cpp:2086-2089`). The dot loc `y + loc * unit` also uses the
  unscaled unit (`:903`).
- **LilyPond:** the same `Dot_configuration` optimiser in staff positions (`lily/dot-column.cc:201-224`,
  `lily/dot-configuration.cc:26-98`). No grace branch exists (a grep for "grace" in `lily/dot-column*.cc`
  and `lily/dots*.cc` finds nothing).
- **VexFlow:** the same `Dot.format` on `keyProps.line` (`dot.js:70-89`), then `y = start.y + dotShiftY × stave line
  spacing` (`dot.js:120, 126`). The line spacing is the stave's 10 px, unscaled.

| | head on line → dot | grace-specific? |
|---|---|---|
| MuseScore | ±0.5 sp, direction by `dotPosition` + claimed slots | no |
| Verovio | +0.5 sp (primary), safety net raises by 0.5 sp | no |
| LilyPond | ±0.5 sp by optimiser (prefers up) | no (own DotColumn per grace timestep) |
| VexFlow | −0.5 (up) | no |

---

#### Q4: Dotted graces: refused, special-cased, tested?

- **MuseScore:** allowed. `NoteInput::toggleDots` applies the dotted duration to a selected grace through
  `undoChangeChordRestLen` (`src/engraving/editing/noteinput.cpp:1492-1515, 1619-1622`; the same branch appears in
  `editing/editduration.cpp:134-135`). Graces are *created* undotted (`dom/note.cpp:1930-1954`, `setGraceNote` with
  plain divisions). The mixed-mag chord case keeps dots aligned: "if chords have notes with different mag, dots
  must still align" (`chordlayout.cpp:3191-3201`). No vtest score contains a dotted grace: a scan of
  `vtest/scores/*.mscx` for `<dots>` inside a grace `<Chord>` found none.
- **Verovio:** no grace check in `calcdotsfunctor.cpp`, `adjustdotsfunctor.cpp` or the dot draw path (grep). The
  cue scaling is the only special case. This checkout has no test suite: **UNKNOWN**.
- **LilyPond:** no refusal. Grace music is ordinary music at a grace timestep. No regression file in
  `input/regression/` has a dotted grace; the regex hits were false positives (`grace-alternative.ly:15` dots the
  main note, not the grace).
- **VexFlow:** no refusal. The only tests with a dotted grace are `tests/gracenote_tests.js:65` and `:154`, and in
  both the dotted 8th grace is in a **beamed** group (`.beamNotes()`, `:82`), so the flag path of Q2 is untested.
  The first is also in a RIGHT (Nachschlag) group.

---

#### Dorico / Sibelius / Finale (documentation only)
- **Dorico:** graces are scaled "by a ratio that is set by default to 3/5 of a normal note", set in Engraving
  Options > Notes > Grace Notes
  ([Grace note size, v2](https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_grace_notes_size_c.html),
  [v5](https://archive.steinberg.help/dorico/v5/en/dorico/topics/notation_reference/notation_reference_grace_notes/notation_reference_grace_notes_size_c.html)).
  Rhythm-dot options exist on the Notes page
  ([notes engraving options](https://archive.steinberg.help/dorico/v1/zh/dorico/topics/notation_reference/notation_reference_notes_project_wide_engraving_options_c.html)).
  **UNKNOWN** whether dot gaps scale with the grace ratio: the docs do not say.
- **Finale:** the Augmentation Dots options are "Space Between Dot and Note", "Space Between Dots", "Vertical
  Adjustment of Dot" and "Horizontal Adjustment for Upstem Flags", the last described as "By default, Finale
  positions the dot to the right of the flag to avoid collision"
  ([Augmentation Dots](http://usermanuals.finalemusic.com/Finale2012Mac/Content/Finale/IDD_AUGDOTOPTIONS.htm)).
  Grace Note Size defaults to 50%
  ([Grace Notes](http://usermanuals.finalemusic.com/Finale2012Mac/Content/Finale/IDD_GRACENOTEOPTIONS.htm)).
  Neither page says whether dot spacing is reduced with the grace: **UNKNOWN**.
- **Sibelius:** nothing found on dots of grace notes. Engraving Rules has an "Accidentals and Dots" page
  ([What's new in Sibelius 2020](https://www.avid.com/resource-center/whats-new-in-sibelius-2020)). **UNKNOWN**.

---

#### UNKNOWNs
1. MuseScore: whether the grace chord's `spaceRw` (reserved with unscaled dot gaps) is read anywhere for a grace.
2. MuseScore: exact grace stem length after `calcMinStemLength` and hook minimums, so the Q2 "fires" verdict is ≈.
3. LilyPond: exact Emmentaler `flags.u3` extent at font-size −3 (no font or binary on disk), so the Q2 verdict is ≈.
4. Verovio: the Q2 table assumes no stem shortening (note ≥ 2.5 sp below the top line) and the Leipzig font.
   Other fonts change the numbers.
5. Dorico, Sibelius, Finale: whether dot gaps scale with grace size. Not documented in the pages found.
6. No engine has a regression test of a dotted **unbeamed stem-up** grace (Q2's case).

### F.2 — The literature: no dotted grace drawn; dotted CUE notes measured instead

Research 2026-09-22. Sources: the four books in `reference/` (`reference/README.md` page offsets: Gould PDF = printed+20; Ross +12; Stone 2-up, printed = 2*PDF - 22 (left half); G&L 2-up, printed P on PDF P/2+2). Every quotation below was read off a rendered scan (110 or 600 dpi), not the OCR. Builds on `docs/research/accidental-dot-research.md` (full-size dots) and `docs/research/grace-notes-research.md` Parts C/E (grace notes) — not redone.

**Method.** Pages rendered with `pdftoppm -r 600`. 1 sp = the staff-line pitch **on the same plate** (Gould 26.25–27.0 px, Stone 28.4–29.1 px, G&L 25.0 px cue staff / 38.0 px full staff on p. 54, 50 px on p. 21's magnified example staff). Blob/row-profile PIL loops (`scratchpad/meas.py`, `prof.py`), ink threshold grey < 128. All horizontal numbers are **INK to INK**: *gap* = right-most ink of the head (incl. an up-stem, which stands at the head's right edge) → left edge of the dot. ⚠️ ±1–2 px anti-alias uncertainty = ±0.05 sp; treat numbers as ±0.05.

---

#### ⛔ The headline: no book DRAWS a dotted GRACE note

Pages searched for a dotted grace / dotted small appoggiatura: **Gould pp. 125–131, 136–138** (whole *Grace notes* chapter + trill starting/finishing notes); **Ross pp. 189–191**; **Stone pp. 20–22, 48–49**; **G&L pp. 54–55, 72–74**. **None contains a dotted grace note, a dotted appoggiatura, or a dotted grace group.** (Every grace in those figures is an undotted quaver/semiquaver/demisemiquaver.) ⇒ everything measured below is on **CUE-sized dotted notes**, the nearest drawn relative (Gould p. 125: *"The grace note is slightly smaller than a cue note, which is ¾ of a full-sized note"*; Ross p. 190 and G&L p. 72 say the same). Whether a grace's dot follows the cue practice is an **inference**, not a source.

---

#### Q1 — every dotted SMALL note drawn, measured

##### Gould (cue notes; full-size dotted notes on the SAME plate where marked ⭐)

| source | page (PDF) | what is drawn | dot size (sp) | head→dot gap (sp) | vertical | same-plate full-size dot: size / gap |
|---|---|---|---|---|---|---|
| Gould ⭐ | **449** (469), *Alternative rhythms*, ex. 3 ("now, — plai-sir") | cue ♩. stem up, head in top space | **0.38** (10 px @ 26.5) | **0.34–0.36** | dot in the head's space, centred to 0.02 sp | ex. 1 same row: full ♩. in space 2, stem down → **0.52 / 0.33** |
| Gould ⭐ | **469** (489), *Alternative text layout* ex. (a), beat 1 | TWO cue ♩. (one stem up, one stem down, spaces 1 & 2) right of full half-note chord; dots in ONE vertical column | **0.38 / 0.38** | **0.53 / 0.53** (up-stem voice from its stem; down-stem voice from its head) | each in its head's space (0.47 / 1.53 sp below top line) | beat 3, same example: full ♩. ×2 → **0.49 / 0.38**; the up-voice head on the top line takes its dot in the space above (+0.5 sp) |
| Gould | **570** (590), Flute cue, bar 1 ("Tpt.") | cue ♪. beamed, stem up, head ON the 2nd ledger line below | **0.38** | **0.53** (to the stem; the dot also clears the ledger line's end by ≈0.3 sp) | dot in the space ABOVE the ledger line | — |
| Gould ⭐ | **571** (591), Bruckner 9, bar 5 ("Vln. 1") | cue ♩. above the stave, head in the space above the 3rd ledger | **0.38** | **0.60** | dot in the head's space | bar 22 same system: full ♩. on the middle line → **0.53 / 0.34**, dot in the space above |
| Gould | **571** (591), *Cue bars without rests* ("Clt.") bar 1 | cue ♪. beamed, stem up, head in the space below the 2nd ledger | **0.38** | **0.30** | dot in the head's space | — |
| Gould ⭐ | **572** (592), Horn, bar 18 ("Ob.") | cue ♯♩. stem up, head ON the top line (tie follows) | **0.38** | **0.27–0.30** | dot in the space above (+0.5 sp) | last bar same line: full 𝅗𝅥. in top space → **0.50 / 0.34** |

**Gould summary (6 cue dots, 4 full-size dots on the same plates):**
- **Dot SIZE is SCALED.** All six cue dots are the same glyph, **0.38 sp** wide; the full dots on the same plates are **0.49–0.53 sp** (her p. 54 plate: 0.48 raw). Ratio **≈0.72–0.78 ≈ ¾** — her own cue size (p. 569 *"about three-quarters"*). Cue heads on these plates measure ≈0.8–0.9 sp wide (incl. stem) vs ≈1.3–1.45 full, i.e. ≈0.65–0.7.
- **The GAP is NOT scaled.** Cue gaps **0.27 · 0.30 · 0.34 · 0.53 · 0.53 · 0.60 sp** (median ≈0.44) vs full **0.33 · 0.34 · 0.34 · 0.38** (median 0.34) — and her p. 54 plate 0.37–0.44. A gap scaled by ¾ would be ≈0.25–0.28; only one cue dot is that close, and three are wider than any full-size gap. As a fraction of the cue's own scale (÷0.75): 0.36–0.80 "cue-spaces". ⇒ her engraving keeps **a full-size (or larger) standoff with a smaller dot**; the spread (0.27–0.60) says it is not a fixed rule either. The widest ones (0.53–0.60) are all at ledger-line / multi-voice positions (the p. 469 pair shares one column across two voices; p. 570 clears a ledger line's end), so context may be pushing them — ⚠️ inference.
- **Vertical: the FULL-SIZE rule, in full-staff spaces, unchanged.** Head in a space → dot centred in that space (6/6, within 0.03 sp); head on a line or ledger line → dot in the space above (2/2: p. 572 top line, p. 570 ledger line). The dot's vertical grid is the staff's, not scaled — necessarily, since the cue head sits on the full staff's lines/spaces.
- **Flag:** ⛔ none of the six is an UNBEAMED stem-up flagged note (the two quavers are beamed) ⇒ the flag question is **UNKNOWN from her drawings**.

##### Stone

| source | page (PDF) | what is drawn | dot size (sp) | head→dot gap (sp) | vertical | full-size comparison |
|---|---|---|---|---|---|---|
| Stone ⭐ | **161** (91 right), *Playing-Cues*, "Substitute part" Cl. II bar 3 | cue ♭♩. stem up, head in top space | **0.38** (11 px @ 28.9) | **0.28** | dot in the head's space | same page, "Original part" Ob. III bar 3: full ♭♩. on 2nd line → **0.45–0.48 / 0.22**, dot in the space above |
| Stone | **20** (21 left), glissando durations item 3 | cue ♩. rhythm ABOVE the stave (no staff under it) | **0.28** (8 px @ 28.6) | **0.28** | level with the head centre | — |
| Stone | **21** (21 right), undulating glissando item 4 | cue ♩. in a rhythm "cue-line", no staff | **≈0.33** (9–10 px @ 28.4; dot touches the tie ink) | **≈0.26** | level with the head centre | p. 125 (PDF 73 right), *Dotted Notes* A.1, full ♩. two voices: **≈0.49–0.55 / 0.28–0.31** (different plate) |

Stone agrees with Gould: **dot scaled (0.28–0.38 vs 0.45–0.55 → ≈0.6–0.8), gap NOT scaled (0.26–0.28 vs 0.22–0.31).** ⚠️ Stone is a heavy photo-offset; ink is fat.

##### Ross — ⛔ nothing drawn. pp. 189–191 cue and grace figures carry no dotted note; the p. 190 small-staff solo part has none either.

##### Gerou & Lusk — a cue-size STAFF, not cue notes on a full staff

| source | page (PDF) | what is drawn | dot size | gap | vertical | comparison |
|---|---|---|---|---|---|---|
| G&L | **54** (29 left), *Piano accompaniment parts may include a cue-size solo part above the grand staff* | two ♩. on a cue-size STAFF (its sp 25.0 px vs the grand staff's 38.0 px on the same figure = **66%**) | **0.26 own sp = 0.17 full sp** | **0.32 own sp = 0.21 full sp** | dot in the head's space (≈0.08 sp high) | full ♩. on p. 21 (PDF 12 right, *Augmentation dot* "For a space note"), magnified example staff: **0.34 / 0.38 sp** — ⚠️ different plate |

Here the whole STAFF is reduced, so dot **and** gap shrink with it (≈0.17/0.21 full sp). That is the "small staff" case (the staff space itself is smaller), not the "small note on a normal staff" case, and it does not bear on graces.

---

#### Q2 — written rules about dots on grace / cue notes

| source | page | quotation (from the scan) | bears on the dot? |
|---|---|---|---|
| Gould | 125 | *"Grace notes are notated as small noteheads with stems shortened to about 2¼ stave-spaces. Tails, beams, articulation and accidentals are also scaled down proportionally."* | ⚠️ lists what scales — **dots are not named** |
| Gould | 569 | *"Cue notation is about three-quarters the size of full-sized notation, so that it is conspicuously smaller than the player's material. All notation symbols that are part of the cue (including rests, accidentals, articulation and dynamics) are scaled down."* | ✅ by implication (a dot is a notation symbol of the cue) — **but no word "dot"**; and nothing about the GAP. ⚠️ p. 571 then says *"Rests are full-sized."* (for the player's whole-bar rests beside a cue) |
| Gould | 569 | *"Note spacing should be closed up within a cue: space characters in proportion to the reduced note size."* | horizontal note spacing, not the dot standoff — ⚠️ yet her own dot standoffs are NOT closed up (Q1) |
| Gould | 449 | *"The alternative rhythm takes cue-sized notes with opposite stem directions. Both rhythms share full-sized noteheads except when one part is dotted. Place the alternative rhythms after the main note, except when it is the main note that has the dot."* | a dot rule for small + full notes together: the cue note goes LEFT of a dotted main note so the dot stays against its head |
| Gould | 469 | *"Place duplicating notes as close as possible to the full-sized notes. A cue-sized note goes to the right unless the main notes are dotted (see example (a) below, beat 3), or are semibreves (b)."* | same rule, second statement, with the drawn example measured above |
| Ross | 189 | *"Its size is determined by the staff and tool sizes used. For staff sizes one, two and three, the note size for staff six is used; for staff sizes four, five and six, the note size for staff seven is used."* | cue = a smaller staff's TOOLS ⇒ by implication a smaller staff's dot; not stated |
| Ross | 190 | *"The grace note is slightly smaller than the cue note … Most sets of tools used by engravers contain a note head, sharp, flat and natural sign to be used as a grace note."* | ⭐ the grace toolset he lists has **no dot** — a note head and three accidentals only |
| Ross | 169 (via accidental-dot-research) | *"Mention should be made of the dot's size in relation to the characters for a particular staff size."* | dot size tracks the staff size — silent on grace/cue |
| G&L | 54 | *"All musical elements associated with the cue notes will also be at cue size."* | ✅ the closest to a sentence covering the dot (size); gap not mentioned |
| G&L | 72 | *"Grace notes are notated at cue size or slightly smaller (65% of normal size works well)."* | chains with p. 54 ⇒ grace dot at cue size, by implication |
| Stone | 49 | grace stems ≈2½, cues ≈3 sp | nothing on dots |

⛔ **No book states a dot rule for grace notes, and no book says anything about the head→dot GAP of a small note.**

---

#### Q3 — same book, same plate: the scaling question answered by one engraver

| engraver | plate | cue dot / full dot | cue gap / full gap | verdict |
|---|---|---|---|---|
| Gould | p. 449 | 0.38 / 0.52 (0.73) | 0.34–0.36 / 0.33 (≈1.05) | size scaled, gap not |
| Gould | p. 469 (a) | 0.38 / 0.49 (0.78) | 0.53 / 0.38 (1.4) | size scaled, gap wider |
| Gould | p. 571 | 0.38 / 0.53 (0.72) | 0.60 / 0.34 (1.8) | size scaled, gap wider |
| Gould | p. 572 | 0.38 / 0.50 (0.76) | 0.27–0.30 / 0.34 (≈0.85) | size scaled, gap ≈ full |
| Stone | p. 161 | 0.38 / 0.45–0.48 (≈0.8) | 0.28 / 0.22 (1.3) | size scaled, gap not |

⭐ **Five plates, two engravers, one answer: the dot GLYPH shrinks (≈¾), the head→dot STANDOFF does not** (it is full-size or wider; never the ¾ it would be if scaled). Vertical placement is the full staff's space grid in every case.

---

#### Q4 — web / standards / engines

| source | URL | finding |
|---|---|---|
| SMuFL, *Individual notes* | https://smufl.formats.music/latest/tables/individual-notes.html | `augmentationDot` U+E1E7 (and U+1D16D), description *"Augmentation dot"*; **no implementation note, no small/cue/grace variant** |
| Bravura 1.392 metadata (`~/dev/engine-sources/MuseScore/fonts/bravura/bravura_metadata.json`) | — | set **ss01 "opticalVariantsSmall — Smaller optical size for small staves"** (49 glyphs: `noteheadBlackSmall`, `accidental*Small`, `artic*Small`, clefs, time-sig digits, dynamics) — **no `augmentationDotSmall`**. `augmentationDot` bbox 0.4 × 0.4 sp. ⭐ ss02 **"flagsShort — Short flags (to avoid augmentation dots)"** — the flag/dot clash handled by a shorter FLAG, full-size notes only. No `engravingDefaults` row for a dot gap |
| SMuFL on optical variants (search) | https://w3c-cg.github.io/smufl/latest/about/recommended-chars-optional-glyphs.html | optional small-staff variants exist as a stylistic set; ⚠️ page not fetched in full |
| Dorico help, grace notes | https://www.steinberg.help/r/dorico-pro/5.1/en/dorico/topics/notation_reference/notation_reference_grace_notes/notation_reference_grace_notes_c.html · https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_grace_notes_size_c.html | grace scale factor (default 3/5) in Engraving Options > Notes > Grace Notes; ⛔ nothing on grace dots (per search summary; not fetched verbatim) |
| Steinberg forum *Dotted grace notes* | https://forums.steinberg.net/t/dotted-grace-notes/838303 | users only: *"It appears that dotted grace notes are not possible"*, then a workaround (16th grid + Alt-Shift-Right). No Steinberg staff answer; nothing on dot size/gap |
| Steinberg forum *Grace note dot* | https://forums.steinberg.net/t/grace-note-dot/1035689 | how to ENTER a dot on a grace; no geometry |
| MuseScore forum *Formating dotted grace note* | https://musescore.org/en/node/102566 | ⛔ **UNVERIFIED** — 403 on fetch; the search snippet says two dotted graces on one chord overlap their dots |
| MuseScore source (`~/dev/engine-sources/MuseScore` @ `929d1e9`) | — | ⭐ `notedot.cpp:66` — the dot's mag = *"parentItem()->mag() * style().styleD(Sid::dotMag)"* ⇒ **the dot glyph scales with the grace** (grace mag 0.7 via the chord's intrinsic mag, per grace-notes-research Part B); `chordlayout.cpp:106–107` — *"double mag_ = item->staff() ? item->staff()->staffMag(item) : 1.0; … dotNoteDistance = …styleAbsolute(Sid::dotNoteDistance) * mag_"* ⇒ **the gap is scaled by the STAFF's mag only, not the grace's** (`dotNoteDistance` 0.5 sp, `dotDotDistance` 0.65 sp, `styledef.cpp:304–306`). ⇒ MuseScore = scaled dot, full-size gap — **the same shape as Gould's and Stone's plates** |
| VexFlow 5.0.0 (grace-notes-research Part A §6) | — | dot drawn **full size** on a grace (no `Dot` scale row), placed by ordinary `Dot.format` |
| LilyPond / Verovio (grace-notes-research Part B) | — | LilyPond: Dots `font-size -3` (0.707) on graces; Verovio: cue size applied to dots. ⛔ How each treats the GAP was not read — UNKNOWN |
| Scoring Notes | — | ⛔ no article on dotted graces found |

---

#### What nobody answers (UNKNOWN)

1. **A dotted grace note, drawn** — none in the four books (pages listed above). Everything is inferred from cue notes.
2. **The flag**: a dotted stem-up FLAGGED small note is drawn nowhere (all measured quavers are beamed). Whether a grace's dot goes past the (small) flag or tucks next to the head is **UNKNOWN**. The full-size rule is unanimous (Ross p. 171 *"DO place the dot after the flag!"*, G&L p. 22, Gould p. 55 — move the dot right of the tail *or* lengthen the stem).
3. **The GAP in words** — no book states a head→dot distance for a small note.
4. **Double dots on a small note** — none drawn, none stated.
5. **A dotted grace on a chord / in a beamed grace group** — nothing.
6. Dorico's / Sibelius's actual rule for grace dot size and gap — docs found say nothing; ⛔ not verified by running either program.
7. MuseScore forum thread 102566 — unreadable (403).

#### Disagreements

1. **Gould's words vs her plates, on the gap**: p. 569 *"space characters in proportion to the reduced note size"* reads as "shrink the spacing", but her dot standoffs on cue notes are full-size or wider (0.27–0.60 vs 0.33–0.38 full). The sentence is about note-to-note spacing; the plates show the dot standoff was not closed up.
2. **Gould's own spread**: her cue gaps range 0.27 → 0.60 sp — twice the spread of her full-size gaps (0.33–0.38). Not a fixed number.
3. **Engines**: VexFlow scales neither dot nor gap (full-size dot); MuseScore scales the dot but not the gap (= the plates); LilyPond/Verovio scale the dot (gap unread).
4. **G&L's cue STAFF** scales dot and gap together (≈0.17/0.21 full sp) — consistent with a whole reduced staff, and not in conflict with the cue-note plates, but a reader must not mix the two cases.
5. Ross p. 190's grace tool list (head + ♯♭♮) has no dot, i.e. no dedicated small dot die is named — whereas Gould and Stone plainly engrave a smaller dot on cue notes.

---

## Part G — The BRACKETED stemless note (Sibelius's "pre-bend note"): what the literature says

*Researched 2026-09-23. Findings only, no decisions. Sources: Gould, *Behind Bars* (whole PDF; ⚠️ printed
page = PDF page − 20, checked on every page cited here); Stone, *Music Notation in the Twentieth
Century* (⚠️ 2-up PDF: printed pp. 62/63 = PDF 42, 74/75 = PDF 48, 76/77 = PDF 49); Gerou & Lusk,
*Essential Dictionary* (2-up: printed 154/155 = PDF 79); Ross, *Art of Music Engraving* (printed =
PDF − 12). Sibelius is `docs/research/sibelius-keypad.md` §3a–3b, not re-read. Every drawn claim was
read off a rendered scan (`pdftoppm`), and the measurements say which page and dpi they came from.*

### G.0 Synthesis

- ⭐⭐ **No book calls this form a grace note, and Gould says outright that it is NOT one.** Gould
  p. 139, on the trill: *"Notate the trilling pitch as a small notehead in brackets after the measured
  note. **Do not use a grace note for the trilling pitch**; reserve grace notes for the starting and
  finishing notes of a trill."* The books have no single name for it. It is described each time from
  what it looks like: *"a small notehead in brackets"* (Gould 139, 421), *"small, stemless note-head in
  parentheses"* (Stone 75), *"parenthetical note-head"* (Stone 76), *"cue-size notehead"* (G&L 154),
  *"small bracketed black notehead"* (Gould 418), *"small stemless notehead"* with *"a bracket
  around it"* (Gould 144). "Pre-bend note" is Sibelius's word. It appears in none of the four books.
- ⭐⭐ **In every book use, it stands AFTER the note it belongs to, not before it.** The trilling note
  (Gould 139, Stone 75–76, G&L 154), the bend's target (Gould 378), a glissando's finishing pitch
  (Gould 144, Stone 63) and a harmonic's sounding pitch (Gould 388, 421) all come after their note.
  🚨 **The one pre-bend Gould shows (p. 378 (b)) has NO bracketed note at all.** It is a single note
  carrying a microtonal accidental, an arrow and the words *"pre-bend string ¼-tone sharp"*. So
  Sibelius's "bracketed note BEFORE the main note" is the only placement-before we found, and no book
  on disk supports it. ⚠️ Tab and guitar-method conventions are not in this library (G.8).
- ⭐ **What the brackets mean is one idea: "this pitch is information, not an attack."** For a
  trill, it is the pitch to alternate with. At the end of a glissando, it is *"not separately
  articulated"* (Gould 144) / *"not articulated; they merely mark the final pitches"* (Stone 63). For a
  harmonic, it is the pitch that sounds, not the one fingered (Gould 421). For an open string, it is a
  reference pitch (Gould 418). For a bend, it is where the pitch arrives (Gould 378). This supports his
  view that the form is the same and the context gives the meaning. ⚠️ But in every case the books
  place it AFTER its note, which a grace note never does.
- **What is drawn** (G.4): a black head at about cue or grace size, no stem and no flag. A head
  that stands for a whole note or half note is still black, *"regardless of duration"* (Gould 418).
  The accidental goes **inside** the brackets (all drawn cases: Gould 139, 144, 145, 378, 388, 421;
  Stone 76; G&L 154). The round brackets are about **2 sp tall** and grow to enclose ledger lines.
  Each head gets its own pair of brackets.

### G.1 Names and category (Q1)

| source | name / description | category |
|---|---|---|
| **Gould p. 139** (PDF 159) | *"a small notehead in brackets"*; the section heading is **"Trilling note"** | ⛔ explicitly **not a grace note** (quote above) |
| Gould p. 138 | *"Trilling note — When no trilling note is indicated, it is the upper neighbouring note"* | part of the trill |
| **Gould p. 144** (PDF 164) | *"Notate the finishing pitch as a grace note **or small stemless notehead**. To indicate that the finishing pitch is not separately articulated, place a bracket around it"* | a glissando's finishing pitch. The bracket goes on either a grace note or a stemless head |
| Gould p. 145 | *"notate interim pitches in brackets either as small noteheads, or as note-values"* | glissando interim pitches |
| Gould p. 378 (PDF 398) | the text never names the bracketed note. It shows it at the end of a *bend* line | guitar string bending |
| Gould p. 418 (PDF 438) | *"Use a small bracketed black notehead (regardless of duration) for the open string"* | string harmonics (open-string reference) |
| Gould p. 421 (PDF 441) | *"Indicate a sounding pitch as a small notehead in brackets directly above or after the fingered pitches"* | harmonics |
| **Stone p. 75** (PDF 48 R) | *"a small, stemless note-head in parentheses, following the main note"* | trill: single-step trill |
| Stone p. 76 (PDF 49 L) | *"parenthetical note-head"* / *"parenthetical trill note-head"* | wide trill (trill tremolo), microtonal trill |
| Stone p. 63 (PDF 42 R) | *"From a note to a small note-head … The small, parenthetical note-heads are not articulated"* | glissando |
| **G&L p. 154** (PDF 79) | *"A **cue-size notehead** is sometimes used"*. The drawing puts it in parentheses | trill (an alternative to the accidental on the tr) |
| Ross pp. 189–191, 197 | — | ❌ **not mentioned**. Ross's trill (p. 197) shows only an accidental beside or above the tr. His grace chapter (pp. 189–191) has no bracketed head |
| Sibelius (sibelius-keypad.md §3a) | **"pre-bend note"**, Keypad F8 | a note *type* on the grace-note layout |

### G.2 The trill's auxiliary note (Q2)

- **Position: AFTER the main note, on the staff at its own pitch.** Gould p. 139 (quoted above). Stone
  p. 75: *"following the main note"*. G&L p. 154 draws it right after a half note (`(♭●)`).
- **Gould p. 139, spacing: short notes.** *"If the first note of a tied trill is a short value, add the
  trilling note after the second note, where there is more room. This avoids cramping or distorting
  the spacing of the short note"*. The drawn *"trilling note cramped"* version is the one to avoid.
  ⇒ The note lives in the white space AFTER a note, and it is moved to a note that has room.
- **Gould p. 139, ties:** *"A tie should not run through a trilling note. It should start from the
  measured note if there is room; otherwise, after the trilling note"*. Drawn: *recommended* is the
  tie arching over the bracket, *acceptable* is the tie starting after it.
- **Gould p. 139, barlines:** *"It is not necessary to indicate that the same trilling note continues
  over a barline or system break as this is assumed unless otherwise indicated."* A *change* of
  trilling note is written in again at the new note. The drawn example has one bracketed note in bar
  1 and another in bar 3.
- **When it is required (Gould p. 138):** *"A trilling note that is the same note of the scale as the
  measured note (but with a different accidental) must be written in."* It is also required when the
  trilling note differs from the previous one. Otherwise it is an option: *"To avoid any possible
  ambiguity, the trilling note may be written in."*
- **Alternative form: an accidental alone** (Gould p. 138): *"The accidental follows the trill sign or
  goes above it. Whichever layout is used depends on the priority for horizontal or vertical
  space-saving"* (three drawn layouts: `tr♭`, `tr` with the ♭ raised, ♭ over `tr`). Also G&L p. 154:
  *"placed after the trill sign but before the wavy line"*, and *"may also appear above the trill
  sign"*. Stone p. 75: *"a small accidental just to the right of the r of the trill sign"*. Stone p. 75
  also draws a **cautionary natural in parentheses above the tr** `(♮)`. Ross p. 197 draws `tr♮` and
  `tr` with a raised ♮.
- **Accidental: INSIDE the brackets.** This holds in every drawing: Gould p. 139 `(♯●)` `(♮●)` `(♭●)`,
  G&L p. 154 `(♭●)`, and Stone p. 76 `(♭●)` `(♯●)` plus a microtonal sign inside. Stone p. 76 says in
  words *"A microtonal accidental must be placed in front of the main note, or above the tr of the
  trill sign, or in front of the parenthetical trill note-head"*. His drawing puts it inside the
  bracket.
- **A slur to it — Stone only.** Stone's wide-trill (p. 76) and microtonal (p. 76) examples slur the
  main note to the bracketed head. Gould and G&L draw no slur.
- **Lower-neighbour trills (Stone p. 76):** *"only rarely notated with a small, parenthetical note
  showing the lower pitch"*. It is marked *"Rare (not recommended)"*. Instead, a grace note is used or
  the main note is lowered.
- **Wide trills (Stone p. 76):** *"Any trill wider than one whole step is a 'wide' trill and requires a
  parenthetical note-head following the main note."* The bracketed head can sit BELOW the main note
  (first example). For a trill on a two-note chord, each head has its own bracket, stacked
  (`(♭●)` over `(♮)`).
- **Starting / finishing notes are real grace notes**, stemmed, not bracketed (Gould p. 138 (a)–(d);
  Stone p. 75 *"a grace note (the upper pitch) should precede the main note"*; Stone p. 77 *Afterbeats*;
  Ross p. 191).

### G.3 Guitar bends and pre-bends (Q3)

- **Gould p. 378** (PDF 398), *String bending*, the whole rule: *"This is used both as an expressive
  device and to produce microtones. The left hand remains in the same fret position but stretches a
  string after it is plucked, to produce an audible bending of pitch (a). By bending the string before
  plucking it (a 'pre-bend') the player can produce a microtone (b). **Give a verbal instruction in both
  cases**"*.
  - (a) **bend**: a string number ②, the word *bend*, and a full crotchet (stem down). A straight
    line leads from it to **a small stemless black head in round brackets, AFTER the note**, carrying
    a ¼-tone-sharp arrow-natural **inside** the brackets. The bracketed note is the pitch reached.
  - (b) **pre-bend**: ③, *"pre-bend string ¼-tone sharp"*, and one ordinary half note carrying the
    microtonal accidental with an arrow, and a fingering `3`. ⛔ **No bracketed note and no grace
    note.** The written note IS the pitch that sounds.
  - Nothing on "full"/"½" labels, bend arrows as curves, release, or tab. That is the whole entry.
- **Stone:** ❌ no guitar bend. His index has *"bending the pitch — harp, 229; winds, 187"* only, and
  p. 70ff calls microtonal "bendings" ornamental (PDF 45). Tablature appears only for string artificial
  harmonics (pp. 310–313, PDF 166–167, OCR only: *"sounding pitches with small note-heads in parentheses, either above the
  tablature or immediately behind it"*).
- **G&L:** ❌ no bend. The tablature pages (pp. 140–143) say only that *"tied notes are in parentheses"*
  on the tab staff.
- **Ross:** ❌ nothing.
- **Sibelius** (keypad research §3a): the pre-bend note comes BEFORE the main note, then **J** for the
  bend. *"On a tab staff, a pre-bend is represented by a vertical arrow"*.
- ⇒ **How tab conventions differ from the books: UNKNOWN.** No guitar-method or tab book is on disk.
  The only contrast we can source is Sibelius's (bracketed note before the main note, arrow on tab)
  against Gould's (verbal instruction plus accidental, no bracketed note for a pre-bend; a bracketed
  target AFTER a bend).

### G.4 What is drawn — size, stem, brackets, accidentals, dots, ledgers, chords (Q4)

**Measured.** Staff space found from the five staff lines, extents read off black-pixel runs.

| what | Gould p. 139, trill (PDF 159, **600 dpi**, sp = 26.6 px) | Gould p. 378, bend (PDF 398, **600 dpi**, sp = 27.0 px) |
|---|---|---|
| bracketed head, w × h | **1.02 × 0.79 sp** (isolated head, tied example) | **0.85 × 0.67 sp** |
| full black head beside it | ≈1.35 × 1.05 sp (the quaver in the same figure) | ≈1.3 × 1.0 sp |
| ⇒ ratio | **≈0.75: cue size** | **≈0.65: grace size** |
| bracket height | **2.07–2.11 sp** (also 1.95 and 2.07 in the first figure) | **2.04 sp** |
| bracket width (each) | 0.60–0.68 sp | 0.56–0.59 sp |
| `(` → accidental | 0.15 sp | 0.26 sp |
| accidental → head | 0.38 sp (♭, itself 1.88 sp tall) | 0.41 sp (arrow-natural) |
| head → `)` | 0.45 sp | 0.52 sp |
| main note → `(` | 0.90 sp from a minim head. 0.49 sp from a dotted minim's **dot** (the bracket follows the dot) | 5.1 sp (the bend line runs between) |

- **Size — the two figures in the same book disagree.** Gould's trilling note is about ¾ (cue size).
  Her bend target is about ⅔ (grace size). Her own prose says only *"small"*. G&L p. 154 says
  *"cue-size"*. Sibelius's pre-bend note is grace size (60 %, measured at ≈0.65 in the keypad research
  §3a). ⚠️ Each ratio comes from **one** instance.
- **Stem: never on the trill form.** Every trill drawing is stemless (Gould 139, Stone 75–76, G&L
  154). ⚠️ The same brackets **can** enclose a stemmed grace note: Gould p. 144 (a), first figure, a
  bracketed slashed grace at the end of a glissando. They can also enclose a stemmed small note-value:
  Gould p. 145, interim glissando pitches `(♭●.)` and `(♩)`. And they can enclose an ossia note on the
  main note's stem (Gould p. 497). So the bracket is its own sign, not something that belongs only to
  a stemless head.
- **Notehead type:** black. For the open string it is black *"regardless of duration"* (Gould p. 418).
  None of the trill drawings has a white bracketed head. Gould p. 145's interim pitches may be white
  when they carry a value.
- **Accidentals: inside the brackets** in every drawing (G.2, G.3; Gould p. 388 `(♭●)` over ledgers).
  Gould p. 83 on bracketed *accidentals* (a separate sign): *"On a chord, each accidental takes a
  separate pair of brackets. Brackets force extra horizontal space"*. Ross p. 146: a bracketed
  accidental is cut *"one size smaller"* by plate engravers, and *"extra space is given as needed"*.
- **Dots:** ⛔ the trilling note carries no dot. It sits after the main note's dot (Gould p. 139,
  measured above). Only the stemmed *interim value* on p. 145 is dotted.
- **Ledger lines:** the head takes its own short ledger (Gould p. 139, tied example: B♭5 over a short
  ledger). On Gould p. 388 the brackets **grow to enclose the ledger lines** (tall brackets around a
  head with 2–3 ledgers above the staff) — seen at 200 dpi, not measured.
- **Chords:** each head gets its own brackets. Stone p. 76 (double wide trill: two bracketed heads
  stacked). Gould p. 421 (two parts on one staff: *"the sounding pitch for the lower part is offset to
  the right"*, each in its own brackets). Consecutive *ossia* notes, a different case, need *"only one
  set of brackets"* (Gould p. 497). ⛔ **Several heads inside ONE pair of brackets: not seen** for the
  stemless form.

### G.5 Horizontal placement and time (Q5)

- **It takes no time.** In every trill, bend and harmonic drawing it sits in the white space of the
  note it follows, and the bar's arithmetic ignores it. Gould p. 139's *"where there is more room"*
  rule is the only spacing rule stated: the note needs room, so it moves to a note that has room.
  ⛔ Nobody says whether the spacing should *grant* that room. The drawn "cramped" version shows what
  goes wrong when it does not.
- ⚠️ **Exception: glissando interim pitches** (Gould p. 145) sit at a rhythmic position in the bar.
  The drawing places a bracketed head right after a barline, at the start of the bar. That is a
  timeline position, not a gap after a note.
- **Distance from the main note:** measured 0.90 sp from a head and 0.49 sp from a dot (Gould p. 139,
  G.4). No book states a distance.
- **Relative to other graces:** Gould p. 139 keeps the two apart — graces for the starting and
  finishing notes, the bracketed head for the trilling pitch. ⛔ No drawing shows both beside one
  note. **UNKNOWN.**
- **After a barline:** only *"not necessary to indicate that the same trilling note continues over a
  barline"* (Gould p. 139), and the interim-pitch drawing (p. 145). ⛔ No rule for a bracketed note
  *before* a note at the start of a bar, because no book places it before.

### G.6 Other uses of the same written form (Q6)

| use | source | where it stands | stem? |
|---|---|---|---|
| trilling (auxiliary) note | Gould 139, Stone 75–76, G&L 154 | after the main note | no |
| bend target | Gould 378 (a) | after, at the end of the bend line | no |
| glissando finishing pitch, *"not separately articulated"* | Gould 144 (a), Stone 63 | after, at the end of the gliss line | no (Gould also brackets a stemmed grace here) |
| glissando interim pitches | Gould 145 | on the rhythmic grid of the bar | no, or stemmed with its value |
| harmonic sounding pitch | Gould 421 (*"directly above or after"*; *"Do not join a small note to the stem of the harmonic"*), Gould 388 (guitar), Gould 339 (harp: the partial *"in brackets above"* — OCR only), Gould 366 (harp, OCR only: *"the sounding pitch as a small note in brackets"* on one stem with the string), Stone pp. 310–313 (PDF 166–167, OCR only, not rendered) | above or after | on 421, not joined to the stem. On 366 and 418, on one stem |
| open-string reference for harmonics | Gould 418, *"small bracketed black notehead (regardless of duration)"* | on the harmonic's stem | shares the stem |
| ossia (alternative) pitch | Gould 497, *"a small note in brackets and placed on the same stem as the preferred pitch"* | same stem | shares the stem |
| rhythm reminder over harmonics | Gould 418, *"rhythmic values as small notes in brackets over the stave"* | above the staff | stemmed |
| ⛔ cautionary *pitch* (a bracketed note as a reminder) | — | not found. Brackets for caution go on ACCIDENTALS (Gould 83, Sibelius) and on the trill sign after a system break (Gould 137, Stone 77 `(tr)`) | — |
| ⛔ tremolo auxiliary | — | not found. Stone's *wide trill = trill tremolo* (p. 76) is the nearest | — |

### G.7 Playback / interpretation (Q7)

- **Trill:** the alternating pitch. Gould p. 134: traditionally the upper neighbour, but *"acceptable
  to allow a trilling note to include wider … intervals"*. The start of the trill is shown by a grace
  note, never by the bracketed note (Gould p. 138).
- **Glissando end:** *"not separately articulated"* (Gould 144). *"Not articulated; they merely mark
  the final pitches"* (Stone 63). An articulation mark on a grace note means the opposite (Gould 144).
- **Bend:** the pitch reached by stretching the string after plucking. A pre-bend is bent before
  plucking (Gould 378). *"Give a verbal instruction in both cases."*
- **Harmonic:** what sounds, while the fingered notes are what is played (Gould 421). It gives
  *"flexibility to find alternative fingerings"* (Gould 422).
- ⛔ No book gives a duration or a sounding length for the bracketed head.

### G.8 UNKNOWN — checked, not found

- **Tab / guitar-method conventions** for pre-bend, release, "full"/"½", bend curves: no such book on
  disk. Gould 378 is the whole of Gould's bend coverage. Stone, G&L and Ross have none.
- **A bracketed stemless note placed BEFORE its main note** in any book. Checked: Gould's grace
  chapter pp. 125–131, trills 134–140, glissandos 141–146, guitar 369–389, harmonics 416–424, ossia 497;
  Stone 21–22, 62–63, 74–77, 310–313; G&L 72–74, 152–155; Ross 189–191, 197. Only Sibelius does it.
- **A stated size, bracket size or distance** for the form. Every number in G.4 was measured, and the
  size disagrees between Gould's two figures (≈0.75 vs ≈0.65).
- **Several heads in one pair of brackets** (stemless form). **A bracketed note beside a grace group**
  at one note. **Stem/slash on a bracketed trill note:** never drawn.
- **The pre-bend's release** (bend back down): not in any book on disk.
- Gardner Read and the Sibelius Reference's own figures beyond the keypad research: not re-checked here.

---

## Part H — The BRACKETED grace note (a head in round brackets, no stem, no flag) in the engines

> **Findings only**, nothing decided. Written 2026-09-23, read from the trees under
> `~/dev/engine-sources/` at the same commits as Part B (MuseScore `929d1e9`, Verovio `efff0bc`,
> LilyPond `beedbfa`) plus `vexflow-5.0.0-npm` and `musxdom`. Each claim carries its `file:line`
> (MuseScore paths are under `src/engraving/` unless they start `src/importexport/`). Where a source
> does not say, the answer is **UNKNOWN**. Units follow Part B: `sp` = staff space; LilyPond
> `font-size` is magstep (`2^(s/6)`: −3 = 0.707, −4 = 0.63, −6 = 0.5, −9 = 0.354).
>
> Subject: one picture put to two uses. **(a)** the guitar **pre-bend** (Sibelius's name): a small
> head before the principal, bracketed, stemless, joined to it by a bend arrow, and **silent**.
> **(b)** the **trill auxiliary** ("trill-to" note): the note to trill to, a small bracketed
> stemless head. Part B covers the grace note in general; nothing here repeats it.

### H.0 Synthesis

⭐⭐ **No engine has a "bracketed grace note" type.** Every one of them builds it from three
separate properties: *parentheses on a head* + *no stem* + *a role* (a grace before the principal,
or an ornament's helper). The role, not the picture, decides when it plays and where it stands:

| | the parentheses | stemless by | role / where it stands | plays? |
|---|---|---|---|---|
| **MuseScore pre-bend** | *generated*: the grace is made a **ghost** note (`guitarbendlayout.cpp:115-119`) and a ghost gets generated parens (`chordlayout.cpp:3174-3181`, `:3268-3292`) | `setNoStem(true)` + `BeamMode::NONE` on the grace chord (`editing/cmd.cpp:787-811`) | an **APPOGGIATURA 8th** grace *before*, a diatonic step below the principal (`cmd.cpp:800-802`) | **no** — `isChordPlayable()` false (`dom/chord.cpp:1393-1395`); the bends renderer skips it (`playback/renderers/bendsrenderer.cpp:106-109`) |
| **MuseScore trill cue note** | added by `EditParentheses::addParenthesesToNotes` (`dom/ornament.cpp:423-425`) | the cue chord has no duration type (`V_INVALID`), and `hasStem()` is false for it (`dom/durationtype.cpp:222-240`, `durationtype.h:91`) | a chord of its own, `setSmall(true)`, **AFTER** the principal in the same segment (`tlayout.cpp:4330-4369`) | **no** — playback reads the ornament's *interval*, not the note (`playback/renderers/ornamentsrenderer.cpp:317`, `:485-488`) |
| **LilyPond `\pitchedTrill`** | `TrillPitchParentheses` grob (`scm/define-grobs.scm:4037-4056`) | the head is a bare `TrillPitchHead` — no Stem grob exists | a side-positioned group to the **RIGHT** of the principal (`define-grobs.scm:3995-4012`) | **no** — the pitch is a property of the trill-span EVENT; `articulate.ly` ignores it (§H.3.4) |
| **LilyPond `\parenthesize`** on a grace | `Parentheses` grob (`lily/parenthesis-engraver.cc:58-107`) | by hand (`\omit Stem` etc.) — nothing automatic | an ordinary grace | yes (a grob property; performers never see it) |
| **Verovio** | MEI `note@head.mod="paren"` (`view_element.cpp:1587-1596`) | `@stem.visible="false"` (MusicXML `<stem>none` → `iomusxml.cpp:3349`) | an ordinary `@grace` note | yes — `midifunctor.cpp` never reads `head.mod` |
| **VexFlow** | a `Parenthesis` modifier per key (`parenthesis.js:6-13`) | a stemless duration / `stem` option | — | — |
| **Finale (musx)** | UNKNOWN in these sources | a **hidden custom stem** | a *singleton grace* moved ≥1 sp right of its main note = "trill-to" (`musxdom/src/musx/dom/Entries.cpp:2252-2284`) | UNKNOWN |

⭐ **One split and one agreement:**
1. **SPLIT — does the accidental go INSIDE the brackets?** Yes — `( ♭● )`, not `♭( ● )` — in MuseScore (§H.1.3)
   and LilyPond (§H.3.2). ⚠️ Verovio and VexFlow put the brackets round the HEAD ONLY and leave the
   accidental outside (§H.2.2, §H.4).
2. **AGREED — the trill auxiliary is a filled head whatever the principal's value** — LilyPond
   `TrillPitchHead` `duration-log 2` (`define-grobs.scm:4018`), MuseScore
   `setHeadType(NoteHeadType::HEAD_QUARTER)` (`ornament.cpp:419`).

⭐ **They split on where the trill auxiliary stands**: LilyPond and MuseScore put it AFTER the
principal (right of its ink, inside the principal's own column / segment). Finale's plugin also puts
it to the right, but it models it as a grace moved there by hand. ⛔ No engine puts a trill
auxiliary BEFORE its principal. The pre-bend (MuseScore) is the one form that stands BEFORE.

⭐ **Size**: MuseScore 0.7 (`smallNoteMag` / `graceNoteMag`, `style/styledef.cpp:515-517`);
LilyPond trill head −4 = **0.63**; Verovio cue = graceFactor 0.75 (Part B). The brackets scale with
the head everywhere except LilyPond's pitched trill, whose parens are a fixed −4 (`define-grobs.scm:4039-4041`).

---

### H.1 MuseScore

#### H.1.1 Data model — parentheses are ELEMENTS, owned by the chord, one pair per group of notes

- `Parenthesis : EngravingItem`, one per side, `DirectionH direction` (`dom/parenthesis.h:27-68`).
  Any item can carry a left and a right one (`dom/engravingitem.h:496-502`, `:763-766`), driven by
  `ParenthesesMode { NONE, LEFT, RIGHT, BOTH }` (`types/types.h:824-829`) under `Pid::HAS_PARENTHESES`
  (XML tag `"parentheses"`, `dom/property.cpp:95`).
- ⭐ **On a NOTE the pair belongs to the CHORD**: `Chord::m_noteParens` is a list of
  `NoteParenthesisInfo { leftParen, rightParen, std::vector<Note*> notes }` (`dom/chord.h:119-135`,
  `:181-187`, `:397`). Parenthesising several notes of one chord in one command makes ONE tall pair
  around all of them (`editing/editparentheses.cpp:117-133`). A note cannot take one side only:
  *"Notes cannot set left & right parens individually"* (`dom/note.cpp:3245-3249`, `:4029-4033`).
- Two sources of brackets on a note: **user** (`HAS_PARENTHESES`) and **generated** (a ghost note,
  or a TAB fret tied across a system break: `useParens = (tieBackParen || item->ghost()) &&
  !item->hideGeneratedParens()`, `rendering/score/chordlayout.cpp:3174`). `createParenGroups` turns
  `hasGeneratedParens` into real `Parenthesis` elements marked `generated()`
  (`chordlayout.cpp:3268-3292`); `HIDE_GENERATED_PARENTHESES` lets the user veto them
  (`dom/note.cpp:3139-3140`, `:3251-3252`).
- Legacy (≤ MuseScore 3): the brackets were two `Symbol`s, `noteheadParenthesisLeft/Right`, attached
  to the note; the 4.x reader turns them into `ParenthesesMode::BOTH` and deletes the symbols
  (`rw/read400/tread.cpp:3138-3148`).

#### H.1.2 The pre-bend — a stemless, silent, ghost appoggiatura

`GuitarBendType { BEND, PRE_BEND, GRACE_NOTE_BEND, SLIGHT_BEND, DIVE, PRE_DIVE, DIP, SCOOP }`
(`dom/guitarbend.h:30-40`); `GuitarBend : SLine`, anchored to notes (`:50-70`). Creating a
`PRE_BEND` (`editing/cmd.cpp:699-846`, `Score::addGuitarBend`):

1. adds a grace chord BEFORE the principal: `setGraceNote(chord, note->pitch(),
   NoteType::APPOGGIATURA, Constants::DIVISION / 2)` — an **appoggiatura, eighth** (`:800-802`); or
   adds the note to an existing bend-grace chord (one pre-bend grace chord per principal, `:790-801`);
2. transposes it **one diatonic step DOWN** (`transposeDiatonic(-1)`; a PRE_DIVE goes up) (`:802`);
3. on every linked chord (standard staff AND tab): `setNoStem(true)`, `setBeamMode(BeamMode::NONE)` (`:805-810`);
4. the bend runs grace → principal (`:813-815`).

The brackets are not set here: the bend's LAYOUT sets the start note a ghost, which generates them —
`if ((PRE_BEND || PRE_DIVE) && !startNote->parenthesisInfo()) { startNote->setGhost(true); …
layoutChord(…) }` (`rendering/score/guitarbendlayout.cpp:115-120`). Deleting the bend undoes all three:
`setParenthesesMode(NONE)`, `setNoStem(false)`, `setBeamMode(AUTO)` (`dom/score.cpp:1523-1528`).

- **The arrow**: by default the pre-bend's vertical arrow stands on the END (principal) note, not
  the grace — `alignPreBendAndPreDiveToGraceNote` defaults **false** (`style/styledef.cpp:1621`;
  `guitarbendlayout.cpp:428-455` `startOnEndNote`). Line width `guitarBendLineWidth 0.13 sp`, arrow
  `1.0 × 1.0 sp` (`styledef.cpp:1611-1617`).
- **Playback**: the grace is **silent** — `Chord::isChordPlayable()` returns false when the first
  note `isPreBendOrDiveStart()` (`dom/chord.cpp:1390-1396`); the bends renderer: *"ignore the grace
  note and render only the principal note"* (`playback/renderers/bendsrenderer.cpp:106-109`), and the
  principal IS rendered despite having a bend back (`:111-120`). The old MIDI path special-cases
  `PRE_BEND` the same way (`compat/midi/compatmidirenderinternal.cpp:344-349`, `:1120`).
- `GRACE_NOTE_BEND` (an ordinary grace bent up into the principal) is the SOUNDING sibling: its grace
  is not a ghost and is not bracketed (only PRE_BEND/PRE_DIVE take the ghost branch, `guitarbendlayout.cpp:115`).

#### H.1.3 Drawing the brackets — a drawn bezier, sized from the HEADS, padded outside the accidental

`rendering/score/parenthesislayout.cpp`:

- **Not a font glyph** on a chord: `symId` stays `noSym`, so `createPathAndShape` draws two cubic
  beziers (`:159-168`, `:264-337`); the SMuFL route (`createSmuflShape`) is used only for chord
  symbols with `harmonyParenUseSmuflSym` (`:506-511`). Painted with a round-capped pen of
  `endPointThickness × spatium × intrinsicMag` (`rendering/score/tdraw.cpp:2501-2507`).
- **Height** (`setChordValues`, `:416-475`): the union of the bracketed notes' shapes **with
  accidentals, dots, bends and laissez-vibrer REMOVED** (`getNoteShape`, `:563-571`), then
  `startY = top − 0.25 sp × intrinsicMag`, `height = shapeHeight + 0.5 sp × intrinsicMag`
  (`:470-471`). ⇒ ¼ sp above and below the head(s), scaled with the grace/cue mag.
- **Stroke**: mid thickness `(h/sp)^0.33 × sp/sp0^0.67 × intrinsicMag` (`:442-464`), capped at
  `MAX_MID_THICKNESS 0.2 sp` (`:40`, `:273-274`); ends `0.05` (`:474`). Shoulder (bulge)
  `0.2 × h^0.95 × mag^0.1`, never below `0.25 sp × intrinsicMag` (`:285-289`); the bulge's control
  points sit `0.2 × h` in from each end (`:277`). ⇒ at the default spatium (1.75 mm × 1200 dpi,
  `styledef.cpp:797`, `dom/mscore.h:70`) a one-head full-size pair (h = 1.5 sp) is ≈ 0.06 sp thick
  mid-stroke (derived, not stated).
- ⭐ **Horizontal**: the pair is padded against the whole CHORD's shape minus stem, hook, arpeggio,
  chord bracket and l.v. (`getParentShape`, `:545-561`) — so **accidentals and dots are INSIDE** the
  brackets. Internal gaps (`computeInternalParenthesisPadding`, `:210-262`), all × the mean mag of
  the two items: note **0.3 sp**, accidental **0.3**, stem **0.3**, ledger line **0.3**, dot **0.15**,
  another parenthesis **1.0**, anything else 0.1. If the bracketed thing is narrower than that
  paren-to-paren minimum, both brackets are shifted to centre it (`:136-156`).
- ⭐ **The accidental drops its OWN brackets** when its note is bracketed: `parentNoteHasParentheses()`
  (`dom/accidental.cpp:269-272`) switches off both the precomposed `accidental*Parens` glyph and the
  `accidentalParensLeft/Right` pair (`rendering/score/tlayout.cpp:549`, `:590`). ⇒ one pair, round
  head and accidental together.
- **External gaps** (bracket ↔ neighbouring items, `rendering/paddingtable.cpp:317-345`), default
  0.1 sp: before a bracket — note/stem/dot/hook 0.35, rest 0.45, barline `barAccidentalDistance`,
  keysig 1.6, timesig 0.8, clef 0.6; after a bracket — note/accidental `max(accidentalNoteDistance
  0.25, 0.35)` = **0.35**, rest/stem `minNoteDistance 0.35`, barline `noteBarDistance`, clef 0.8.

#### H.1.4 The trill cue note — `Ornament::cueNoteChord`

- `Ornament : Articulation` (MuseScore ≥ 4.1) holds `intervalAbove/Below`, `showAccidental`,
  `startOnUpperNote`, `m_notesAboveAndBelow`, `m_cueNoteChord`, `m_showCueNote` (AUTO/ON/OFF)
  (`dom/ornament.h:10-80`). A `Trill` spanner owns an `Ornament` and re-parents the cue chord to its
  start segment (`dom/trill.cpp:227-239`).
- **When it shows** (`ornament.cpp:244-251`): AUTO ⇒ `(ornament is a trill && trillAlwaysShowCueNote)
  || intervalAbove.step != SECOND`. `trillAlwaysShowCueNote` defaults **false**
  (`styledef.cpp:318`). ⇒ a trill to the neighbouring step shows an accidental above the `tr`; a
  trill to a THIRD or wider shows the bracketed note. When the cue note shows, the accidental-above
  is deleted (`ornament.cpp:374-381`) — one or the other, never both.
- **Its pitch**: the principal's upper note cloned and transposed by the interval (AUTO: diatonic step
  plus whatever alteration the bar's accidental state holds, `ornament.cpp:282-320`).
- **What it is** (`updateCueNote`, `ornament.cpp:395-431`): a new `Chord` in the principal's segment,
  `setSmall(true)` (⇒ `smallNoteMag 0.7`, `styledef.cpp:515`), the note forced to
  `NoteHeadType::HEAD_QUARTER` (filled), bracketed with `addParenthesesToNotes`, flagged
  `setIsTrillCueNote(true)`. No stem: the chord's duration type stays `V_INVALID`
  (`durationtype.h:91`) and `hasStem()` lists only real values (`durationtype.cpp:222-240`, used by
  `Chord::shouldHaveStem`, `dom/chord.cpp:1066-1077`).
- **Where** (`TLayout::layoutOrnamentCueNote`, `tlayout.cpp:4330-4369`): heads, ledger lines and
  accidentals laid out as a chord (`:4351-4354`), then `x = minHorizontalDistance(principal chord's
  shape, cue shape)`, maximised over every voice's chord in the segment (`:4356-4368`) ⇒ **just
  right of the principal's ink** (dots included) at the normal shape padding. Its accidental is kept
  close to it (`accidentalslayout.cpp:1146-1149`); nothing kerns under it (`horizontalspacing.cpp:1748-1751`).
- ⭐ **It takes width**: its shape is added to the SEGMENT's shape (`dom/segment.cpp:2762-2768`) and to
  the system skyline (`rendering/score/systemlayout.cpp:1729-1736`) ⇒ the next note is pushed.
- **Playback**: the ornament renderer reads `intervalAbove/Below` (`ornamentsrenderer.cpp:317`,
  `:485-488`); the cue chord is not an event of its own (parented to the segment but not stored in the segment's element list; not verified further).

#### H.1.5 MusicXML

- **Export**: a bracketed note ⇒ `<notehead parentheses="yes">normal</notehead>`
  (`src/importexport/musicxml/internal/export/exportmusicxml.cpp:3893-3896`); `noStem` ⇒
  `<stem>none</stem>` (`:4464-4465`). A pre-bend is written on the PRINCIPAL (its `bendBack`) as
  `<technical><bend first-beat last-beat><bend-alter>−½·amount</bend-alter><pre-bend/></bend>`
  (`:4021-4035`) — the grace itself goes out as a grace with the bracketed head and no stem.
  Ornament accidentals go out as `<accidental-mark>` (`:3524`, `:2946`); ⚠️ the TRILL CUE NOTE is
  written nowhere (no `cueNoteChord` in the exporter) and, when it shows, the accidental-above has
  been deleted (§H.1.4) ⇒ a trill to a third leaves MusicXML with **no interval at all** (derived).
- **Import**: `<notehead parentheses="yes">` ⇒ `setParenthesesMode(BOTH)`
  (`import/importmusicxmlpass2.cpp:7076`, `:7314-7316`); `<stem>none` ⇒ `setNoStem`
  (`:7383`); `<accidental parentheses="yes">` or `cautionary="yes"` ⇒ `AccidentalBracket::PARENTHESIS`
  (`import/importmusicxmlnotepitch.cpp:50-75`). ⛔ **`<bend>` is not imported at all** (no `bend`
  handling in `import/*.cpp` beyond `brass-bend`), and neither is an `<accidental-mark>` on a trill ⇒
  an imported pre-bend arrives as a *sounding* bracketed stemless grace.

### H.2 Verovio

#### H.2.1 Data model

- Brackets on a head are MEI **`note@head.mod="paren"`** (`AttNoteHeads`; `libmei/dist/atttypes.h:1412`,
  `attconverter.cpp:2985`, `:3005`). ⚠️ `Note` does NOT carry `AttEnclosingChars`; `@enclose` exists on
  accid, arpeg, artic, clef, dynam, fermata, keyAccid, mordent, meterSig, rest, trill, turn (the
  classes that include it, `include/vrv/*.h`).
- A grace is `note@grace` (Part B §2.1); stemless is `@stem.visible="false"`. There is no pre-bend
  and no trill auxiliary note: MEI's `<trill>` carries only `@accidupper/@accidlower`, drawn as a
  small accidental above/below the `tr` (`src/view_control.cpp:2866-2885`).

#### H.2.2 Drawing — two accidental-bracket GLYPHS hugging the head

`View::DrawNote` (`src/view_element.cpp:1576-1603`), after the head glyph:

```cpp
case NOTEHEADMODIFIER_paren: {
    this->DrawSmuflCode(dc, x - note->GetDrawingRadius(m_doc), y, SMUFL_E26A_accidentalParensLeft, …, drawingCueSize, true);
    this->DrawSmuflCode(dc, x + note->GetDrawingRadius(m_doc) * 2, y, SMUFL_E26B_accidentalParensRight, …, drawingCueSize, true);
```

- Glyphs: **`accidentalParensLeft/Right` U+E26A/E26B**, not `noteheadParenthesis*`; at cue size when
  the note is (the grace factor, Part B); vertically on the head's centre line.
- Place: left glyph origin at `x − r`, right at `x + 2r`, where `r` = half the head glyph's width at
  that size (`layerelement.cpp:599-658`). With Bravura (E26A 0.564 sp wide, head 1.18 sp ⇒ r 0.59):
  the left bracket ends **0.026 sp** before the head, the right one starts **exactly** at the head's
  right edge — no gap (derived from the font, §H.6). No padding constant exists.
- ⭐ **Head only**: the accidental is a separate child (`DrawLayerChildren`, `:1606`) and is not
  enclosed. Whether the accidental column avoids the left bracket is UNKNOWN (not traced).
- Chords: each note brackets itself — no shared pair. Ledger lines, dots: unchanged by `head.mod`.

#### H.2.3 Playback / IO

- MIDI: `head.mod` is never read in `src/midifunctor.cpp` ⇒ a bracketed grace plays like any grace
  (Part B §2.11). Trills are not expanded (only a comment, `midifunctor.cpp:838`).
- MusicXML **import only** (Verovio writes MEI/Humdrum, no MusicXML): `<notehead parentheses="yes">`
  ⇒ `head.mod paren` (`src/iomusxml.cpp:3248`); `<stem>none` ⇒ `stem.visible false` (`:3283`, `:3349`);
  `<accidental parentheses="yes">` ⇒ `accid@enclose="paren"` (`:4082`), drawn as E26A + glyph + E26B
  (`src/accid.cpp:326-330`); `<accidental-mark>` after `<trill-mark>` ⇒ `trill@accidupper` (`:3846-3852`);
  `<bend>` ⇒ `ARTICULATION_bend` — the `<pre-bend/>` child is dropped (`:4620`).

### H.3 LilyPond

#### H.3.1 `\parenthesize` — a Parentheses grob, sticky to its host

- `parenthesize` sets the grob property `parenthesized #t` (on an event chord, with a shared
  `parenthesis-id` so ONE pair encloses the chord) (`ly/music-functions-init.ly:1657-1668`).
- `Parenthesis_engraver` makes a sticky `Parentheses` grob per host, or one per `parenthesis-id`
  per time step, and sets its `font-size` to **its own −6 PLUS the host's** (`lily/parenthesis-engraver.cc:58-107`).
  ⇒ a normal head: −6 = **0.5**; a grace (−3, Part B): **−9 = 0.354**. Accidentals and TAB heads are
  excluded — they have their own bracket code (`:61-70`).
- `Parentheses` defaults: `font-size −6`, `padding 0.2` (`scm/define-grobs.scm:2772-2790`).
- Glyphs: Feta's `accidentals.leftparen` / `accidentals.rightparen` — the ACCIDENTAL brackets
  (`scm/output-lib.scm:1222-1227`).
- ⭐ **Enclosure = host + its "friends"**: `NoteHead` has `parenthesis-friends (accidental-grob dot)`
  (`define-grobs.scm:2608`; also `ApproximatePitchNoteHead :2489`, `Rest (dot) :2967`, `TabNoteHead (dot) :3746`).
  `parentheses-interface::print` takes the X extent of hosts + friends, widens it by `padding` each
  side, and stands the two glyphs at its ends (`output-lib.scm:1229-1256`). ⇒ **accidental and dots
  INSIDE**; regression `input/regression/parenthesize-notes-accidentals.ly`: *"Parentheses around notes
  also include accidentals and dots"*.
- Vertical: centred on the hosts only, *"We don't want the friends, or parenthesized notes with a flat
  would look bad"* (`output-lib.scm:1259-1277`). ⚠️ The 2.19 regression text says *"the combined enclosed
  items"*; the code says hosts only.
- Spacing: *"Parentheses only cause minimum distances to be set. They should not cause more space to
  be allowed for a note when they do not cause a collision"* (`input/regression/parenthesize-horizontal-spacing-cosy.ly`).
- Stemless: nothing automatic — a bracketed grace keeps its stem unless the user omits it.

#### H.3.2 `\pitchedTrill` — the trill auxiliary as three grobs to the RIGHT

- `\pitchedTrill main secondary`: *"@var{secondary-note} gets printed as a stemless note head in
  parentheses"*; it copies the second note's PITCH (and `force-accidental`) onto the main note's
  `TrillSpanEvent` and discards the second note (`ly/music-functions-init.ly:1800-1827`).
- `Pitched_trill_engraver::make_trill` (`lily/pitched-trill-engraver.cc:94-161`) builds
  `TrillPitchHead` at the pitch's staff position (`:127-133`), an optional `TrillPitchAccidental`
  (`:139-152`), and `TrillPitchParentheses` whose element is the head (`:154-160`), all in a
  `TrillPitchGroup` supported by the main note's heads, dots, stem and flag (`:63-82`, `:163-168`).
- Accidental rule: printed unless the bar already holds that alteration for that step, or always
  for a natural, or when forced (`:100-119`).
- Grob defaults (`scm/define-grobs.scm`):
  - `TrillPitchHead` (`:4016-4035`): `font-size −4` (0.63), **`duration-log 2`** (a filled head
    whatever the trill's value), `parenthesis-friends (accidental-grob)`, `ledgered-interface`
    (⇒ ledger lines), no stem.
  - `TrillPitchParentheses` (`:4037-4056`): `font-size −4` fixed — *"different from Parentheses, which
    has −6 plus the font size of its host"*; `padding 0.3`, *"from a time when parentheses were baked
    into TrillPitchGroup … It could be revisited (Parentheses has 0.2)"*. ⇒ the accidental is inside.
  - `TrillPitchAccidental` (`:3975-3993`): `font-size −4`, `padding 0.2`, to the LEFT of the head.
  - `TrillPitchGroup` (`:3995-4014`): `direction RIGHT`, side-positioned on X, `padding 0.3`,
    **`minimum-space 2.5`** (*"minimum shift to the right, in case the parent note has no stem"*),
    `horizon-padding 0.1` (*"to avoid interleaving with augmentation dots"*).
  ⇒ it stands AFTER the principal, outside its dots; regression *"a small note head in parentheses
  following the main note … properly ledgered, and parentheses include the accidental"*
  (`input/regression/trill-spanner-pitched.ly`).
- Whether the group widens the principal's column is not stated in these sources (UNKNOWN beyond
  `minimum-space`).

#### H.3.3 Guitar pre-bend — a TAB-only spanner; the standard-staff grace is an ordinary grace

`\preBend` / `\preBendHold` only set `BendSpanner.style` (`ly/music-functions-init.ly:393-409`);
`Bend_spanner_engraver` is consisted in **`TabVoice` only** (`ly/engraver-init.ly:1173-1178`). The
manual's own example writes the pre-bend as `\grace f'4\preBend \^ g'1` and prints the standard staff
with a normal stemmed grace (`Documentation/en/notation/fretted-strings.itely:454-508`). ⛔ No
automatic brackets or stem removal.

#### H.3.4 MIDI and MusicXML

- The pitched trill's second note is gone before the performer runs (§H.3.2) — it is never played.
  `articulate.ly` realises a trill with the next diatonic step IN THE KEY (`ac:up`,
  `ly/articulate.ly:283-292`, `:379-410`, `:602-607`) and never reads the event's `pitch` ⇒ a
  `\pitchedTrill` to a third still plays as a trill to the second (derived).
- `\parenthesize` sets grob properties only ⇒ a bracketed grace plays (derived).
- musicxml2ly: `<notehead parentheses="yes">` ⇒ a `ParenthesizeEvent` (`python/musicxml.py:940-942`);
  `<accidental-mark>` on a trill ⇒ an accidental above the spanner, with a warning that placement
  may need fixing (`python/musicexp.py:2258-2279`) — ⛔ it does NOT become a `\pitchedTrill`.

### H.4 VexFlow 5.0.0

`Parenthesis` modifier (`build/esm/src/parenthesis.js`): `buildAndAttach` adds a LEFT and a RIGHT
one to **every key** of the note (`:6-13`); glyphs **`noteheadParenthesisLeft/Right` U+E0F5/E0F6**
in the note's font (so they scale with a grace) (`:39-53`). Formatted **before** dots and accidentals
(`modifiercontext.js:85-89`): the left bracket touches the head (shift = the head's displaced offset,
no padding, `note.js:299-306`) and the accidental stands OUTSIDE it; the first dot starts after the
right bracket + 1 px (`note.js:307-314`). No stem/playback logic.

### H.5 Finale (musx / EnigmaXML)

- A "trill-to" note is **recognised, not modelled**: `calcIsAuxiliaryPitchMarker` = a singleton grace
  with a hidden custom stem (`musxdom/src/musx/dom/Entries.cpp:2252-2261`); `calcIsTrillToGraceEntry`
  adds *"positioned at least 1 space to the right of the main entry"* — the grace's manual offset minus
  the grace-entry offset ≥ 1 sp (`:2263-2284`; doc `Entries.h:993-1010`: *"as created by the
  Parenthesize Trill-To Notes plugin"*). A gliss-to marker is the same grace ending a gliss line
  (`:2286-2310`).
- Options: `guitarBendUseParens` *"Guitar Bend Use Parentheses"* (`Options.h:1358`); precomposed
  bracketed accidentals `parenNatural/Flat/Sharp/DblFlat/DblSharp` (`Options.h:877-881`; the test
  document maps them to U+F5D5–F5D9, `tests/data/trill-to.enigmaxml:633-637`); an accidental's own
  flag `parenAcci` (`Entries.h:314`). How the plugin draws the head brackets: UNKNOWN in these sources.

### H.6 SMuFL glyphs, checked in the fonts we ship (opentype.js, 2026-09-23)

Measured in sp (upm/4); `x` = ink extent from the glyph origin.

| glyph | code | Bravura | Sebastian | Leipzig |
|---|---|---|---|---|
| `noteheadParenthesisLeft` | U+E0F5 | ✅ adv 0.292, ink 0…0.436, h 1.448 | ✅ **identical to Bravura** | ✅ adv 0.400, ink 0…0.612, h 1.920 |
| `noteheadParenthesisRight` | U+E0F6 | ✅ adv 0.292, ink −0.144…0.292, h 1.448 | ✅ identical | ✅ ink −0.212…0.400, h 1.920 |
| `noteheadParenthesis` (both, to overlay a head) | U+E0CE | ✅ ink −0.292…1.472 over a 1.18 head | ✅ identical | ❌ missing |
| `accidentalParensLeft/Right` | U+E26A/E26B | ✅ 0.564 w, h 1.980 | ✅ 0.388 w, h 1.712 | ✅ 0.652 w, h 2.000 |
| `accidentalBracketLeft/Right` | U+E26C/E26D | ✅ 0.308 w | ✅ 0.348 w | ✅ 0.360 w |
| `accidental*Parens` (precomposed, Bravura optional) | U+F5E0–F5E4 | ✅ 2.0–2.8 w | ❌ | ❌ |
| `noteheadBlack` (for scale) | U+E0A4 | 1.180 | 1.280 | 1.256 |
| `ornamentTrill` | U+E566 | ✅ 2.084 | ✅ 2.004 | ✅ 1.728 |

- ⭐ **The notehead brackets are designed to kern into the head**: their ink runs **0.144 sp** (Bravura)
  past the advance toward the head — set `(` advance, then the head, the tips wrap its box. The pair is
  1.448 sp tall around a 1.0 sp head — ≈ 0.22 sp above and below, next to MuseScore's computed 0.25.
- The accidental brackets are ~2 sp tall (made for a sharp) — what Verovio and LilyPond use round a head.
- The precomposed `accidentalFlatParens` etc. are Bravura OPTIONAL glyphs (codepoints from
  `~/dev/engine-sources/MuseScore/fonts/bravura/bravura_metadata.json`, `optionalGlyphs`); not in
  `public/smufl/glyphnames.json`. Finale's test file uses a different PUA range (F5D5–F5D9) — present
  in our Bravura/Sebastian but their identity was NOT checked.
- ⚠️ Sebastian's E0F5/E0F6/E0CE are byte-for-byte Bravura's numbers — probably copied glyphs.
- SMuFL `engravingDefaults` has no key for note/accidental parentheses (Bravura's 29 keys in `bravura_metadata.json`; `bracketThickness` is the SYSTEM bracket).

### H.7 Comparison table

| Question | MuseScore | Verovio | LilyPond | VexFlow |
|---|---|---|---|---|
| model | `Parenthesis` elements owned by the chord, one pair per note group; ghost ⇒ generated pair | `note@head.mod="paren"` | `Parentheses` grob (`\parenthesize`); trill: `TrillPitch*` grobs off the trill event | `Parenthesis` modifier per key |
| brackets drawn as | a bezier path (not a glyph) | E26A/E26B glyphs | Feta accidental parens | E0F5/E0F6 glyphs |
| bracket height | heads ± 0.25 sp × mag | the glyph (≈2 sp × size) | the glyph at −6 + host (trill −4) | the glyph |
| accidental | **inside** (own bracket suppressed) | outside | **inside** (friend) | outside |
| dots | inside, 0.15 sp | not enclosed | inside (friend) | after the right bracket |
| chord | one pair round the group | per note | one pair (shared id) | per key |
| head size (trill aux) | 0.7, filled | — | 0.63, filled | — |
| stem | pre-bend: `noStem`; cue: none (no duration) | `@stem.visible=false` | trill head: none; `\parenthesize`: kept | — |
| where the trill aux stands | after the principal, takes width | — | after, `minimum-space 2.5`, `padding 0.3` | — |
| plays | pre-bend grace: no; trill cue: no (interval played) | yes | trill head: no; `\parenthesize`: yes | — |

### H.8 Constants (value · unit · source)

| constant | value | source |
|---|---|---|
| MuseScore bracket height | heads + **0.25 sp** top and bottom × intrinsicMag | `parenthesislayout.cpp:470-471` |
| MuseScore bracket mid thickness cap | **0.2 sp** | `parenthesislayout.cpp:40` |
| MuseScore bracket end pen | **0.05 sp** × intrinsicMag | `parenthesislayout.cpp:474`; `tdraw.cpp:2504` |
| MuseScore bracket bulge | `0.2·h^0.95·mag^0.1`, min **0.25 sp** × intrinsicMag | `parenthesislayout.cpp:285-289` |
| MuseScore inner gap to head / accidental / stem / ledger | **0.3 sp** × mean mag | `parenthesislayout.cpp:218-235` |
| MuseScore inner gap to dot | **0.15 sp** | `parenthesislayout.cpp:230-232` |
| MuseScore outer gap, bracket → next note | **0.35 sp** | `paddingtable.cpp:340` |
| MuseScore outer gap, note → bracket | **0.35 sp** | `paddingtable.cpp:328` |
| MuseScore small / grace mag | **0.7** | `styledef.cpp:515`, `:517` |
| MuseScore `trillAlwaysShowCueNote` | **false** | `styledef.cpp:318` |
| MuseScore pre-bend grace | appoggiatura, **8th**, a diatonic step below | `editing/cmd.cpp:800-802` |
| MuseScore `alignPreBendAndPreDiveToGraceNote` | **false** (arrow on the principal) | `styledef.cpp:1621` |
| MuseScore bend line / arrow | **0.13 sp** / **1.0 × 1.0 sp** | `styledef.cpp:1611`, `:1616-1617` |
| Verovio bracket position | left at head x − r, right at head x + 2r (r = ½ head width) | `view_element.cpp:1591-1594` |
| LilyPond `Parentheses` | `font-size −6` + host's, `padding 0.2` | `define-grobs.scm:2772-2790`; `parenthesis-engraver.cc:97-99` |
| LilyPond `TrillPitchHead` | `font-size −4` (0.63), `duration-log 2` | `define-grobs.scm:4016-4020` |
| LilyPond `TrillPitchParentheses` | `font-size −4`, `padding 0.3` | `define-grobs.scm:4037-4047` |
| LilyPond `TrillPitchAccidental` | `font-size −4`, `padding 0.2` | `define-grobs.scm:3975-3981` |
| LilyPond `TrillPitchGroup` | `padding 0.3`, `minimum-space 2.5`, `horizon-padding 0.1` | `define-grobs.scm:3995-4004` |
| Finale trill-to test | grace ≥ **1 sp** right of its main entry, hidden stem | `musxdom/.../Entries.cpp:2263-2284` |
| Bravura `noteheadParenthesisLeft` | adv 0.292, ink 0.436, h 1.448 sp | §H.6 |

### H.9 Gotchas

- 🚨 **Brackets round the head only vs round head + accidental** is the one real split (MuseScore,
  LilyPond: inside; Verovio, VexFlow: outside). MusicXML cannot say which: `<notehead parentheses>`
  and `<accidental parentheses>` are two separate flags (`musicxml.xsd` notehead type: *"If the
  parentheses attribute is set to yes, the notehead is parenthesized"*; the `parentheses` attribute on
  accidentals is a separate group).
- 🚨 **The same picture, opposite playback**: MuseScore's pre-bend grace is silent; a bracketed grace
  from MusicXML (where `<pre-bend/>` sits on the principal and MuseScore does not import `<bend>`) plays.
  The silence comes from the ROLE (`isPreBendOrDiveStart`), never from the brackets.
- 🚨 MuseScore's trill cue note is not exported to MusicXML, and its accidental-mark is deleted while it
  shows (§H.1.5) — a trill to a third round-trips as a plain trill.
- ⚠️ LilyPond's `\pitchedTrill` pitch is drawn but never sounds, and `articulate.ly` trills to the key's
  next step whatever was written (§H.3.4).
- ⚠️ The trill auxiliary and the pre-bend stand on OPPOSITE sides of the principal: after (MuseScore cue
  note, LilyPond, Finale's plugin) vs before (pre-bend). Neither side is a grace in LilyPond's or
  MuseScore's trill model — only Finale stores the trill-to note as a grace.
- ⚠️ MuseScore's cue note has no duration, so any code that asks a "note" for its value must not reach
  it; it is flagged `isTrillCueNote` and skipped by voice edits, note input and selection
  (`editing/editvoice.cpp:94`, `editing/noteinput.cpp:1337`, `notation/internal/notationinteraction.cpp:5540-5562`).

### H.10 UNKNOWN — checked, not found

- Verovio: whether the accidental column avoids a `head.mod="paren"` bracket.
- LilyPond: whether `TrillPitchGroup` widens the principal's column beyond `minimum-space`.
- Finale: how the "Parenthesize Trill-To Notes" plugin draws the head's brackets; whether the trill-to
  grace plays.
- Sibelius, Dorico: not on disk (no source).
- The identity of the glyphs at U+F5D5–F5D9 in our Bravura (present, not identified).

---

## Part I — The BRACKETED grace note (stemless head in round brackets): pre-bend and trill auxiliary — industry picture (online research, 2026-09-23)

Scope: the small, **stemless, flagless notehead in round brackets** that stands beside a main note. Two
uses were researched: the guitar **pre-bend** (Sibelius's F8 `-` key, `docs/research/sibelius-keypad.md` §3a)
and the **trill auxiliary** / "trill-to" / "trilling pitch". Every claim carries a URL or a local source;
quotations are verbatim from the fetched page unless marked *(paraphrase)*. **UNKNOWN** means the page
could not be reached or did not say. ⛔ FINDINGS ONLY — nothing here is a decision.

Method notes that matter for re-checking:
- `steinberg.help/r/…` (Dorico 5/6 Reader) is a JavaScript shell — curl returns nothing, WebFetch gets a
  301 to a table of contents. The static pages on **`archive.steinberg.help/dorico_pro/v3.5/…`** and
  `…/dorico/v3/…` answered, quoted below. Dorico 3.0's feature text came from the **Version History PDF**
  (`download.steinberg.net/downloads_software/Dorico_3/3.1/Dorico_3.1_Version_History.pdf`, pp. 64–66).
- `musescore.org/en/handbook/4/…` answers with a normal browser User-Agent (curl `-A "Mozilla/5.0 …"`);
  `musescore.org/en/node/…` forum threads still answer **403**. MuseScore's source was read on
  `raw.githubusercontent.com` at tags **v4.4.4, v4.6.0, v4.7.3, v4.7.5**.
- The Sibelius help-center article and forum threads (`sibelius.com/helpcenter/…`, `…/chat/chat.pl?…&guest=1`)
  answer to plain curl; the forum banner says it is *"down for maintenance"*, but the archived threads still
  serve.
- The SMuFL tables are at **`smufl.formats.music/latest/tables/<range>.html`**. Without `/latest/` they 404.
- The GitHub issue-search API rate-limited us (unauthenticated) before it returned anything for
  `w3c-cg/musicxml`, `w3c-cg/mnx` or `w3c-cg/smufl` — see the UNKNOWN list.

---

### I.0 Synthesis

1. **⭐⭐ The two uses are drawn the same way and placed on OPPOSITE sides of the main note.** Every source
   that places the trill auxiliary puts it **after** (to the right of) the measured note. Every app that
   makes a pre-bend puts its bracketed head **before** the main note, as a grace note would sit:
   - Gould, *Behind Bars* p. 139 (read off the rendered scan, PDF p. 159): *"Notate the trilling pitch as a
     small notehead in brackets after the measured note. **Do not use a grace note for the trilling pitch;**
     reserve grace notes for the starting and finishing notes of a trill."*
   - Stone, *Music Notation in the Twentieth Century*, *Trills*, A. Single-Step Trills (local OCR text,
     dirty, wording checked against the text layer only): *"modified, if needed, by a small accidental just to
     the right of the tr of the trill sign or by a small, stemless note-head in parentheses, following the
     main note"*.
   - Dorico: the auxiliary note is shown *"in the staff immediately to the right of the first note to which
     the trill applies"*; LilyPond `\pitchedTrill` prints *"the trilled note … as a stemless note head in
     parentheses"* after the main note.
   - Sibelius's help center says it outright: the pre-bend note *"attach[es] to the previous note, i.e. they
     prefer to be positioned to the left of the main note, rather than on the right"*. That is why using the
     pre-bend key for a trill note is called a workaround there (§I.1).
2. **⭐ Only Sibelius offers it as a KEY, and there it is a grace note.** The pre-bend note is a grace note
   with stemless, bracketed heads that does not sound. Dorico and MuseScore **generate** the head from a
   property of the main note or of the trill. Neither makes it a grace note the user types. Dorico uses one
   word for both, **"auxiliary note"**, and both of Dorico's bracketed heads come from a property: *Pre-bend
   interval* on the note, and trill *Appearance → Auxiliary note*.
3. **⭐ Nothing plays the bracketed head itself.** The Sibelius pre-bend note is *"silent"*, and Bob
   Zawalich (a Sibelius power user) could not find a way to make it sound. MuseScore's `Chord::isChordPlayable()`
   returns `false` for a pre-bend start. The trill auxiliary is never played as a note: Sibelius *"won't read"*
   a written trill accidental, and Dorico and MuseScore play the trill from its INTERVAL property. The
   pre-bend's sound is the BEND: Dorico 3.0 played none (*"no automatic playback of bends, releases or
   pre-bends"*); Dorico 3.5 plays *"bends and releases with bend intervals of up to a whole step"*, and
   whether that covers pre-bends is UNKNOWN.
4. **⭐ The interchange formats have no object for either written form.** In MusicXML a pre-bend is a `<bend>`
   with `<pre-bend/>` on the MAIN note (a playback/technical fact with `<bend-alter>`), and a trill's interval
   is `trill-step` (`whole` / `half` / `unison`) plus an optional `<accidental-mark>`. Nothing says "draw a
   bracketed auxiliary head here". The generic parts exist: `<grace/>`, `<stem>none</stem>`,
   `<notehead parentheses="yes">`, `<cue/>`. So a writer can spell the drawing as a separate note, and the
   meaning is lost. MEI's `<trill>` carries only `@accidupper`/`@accidlower` and has no pitch for the
   auxiliary. MNX has no trill, no bend, no notehead parentheses and no stemless note.
5. **Gould uses the bracketed small head for a THIRD thing, a bend's target.** *Behind Bars* p. 378
   (Classical guitar, *String bending*, rendered PDF p. 398): example (a) "bend" is drawn as a main note, a
   line, then a **bracketed small notehead after it**. For a pre-bend she prescribes a **verbal
   instruction**, not a bracketed grace: *"By bending the string before plucking it (a 'pre-bend') the player
   can produce a microtone (b). Give a verbal instruction in both cases"*. Example (b) is *"pre-bend string
   ¼-tone sharp"* over an ordinary note. 🔶 The shape of example (a) was read off a 110-dpi render. Render it
   again at 450 dpi before quoting it as a measurement.

---

### I.1 Sibelius

**What the pre-bend key makes.** Sibelius 6 Reference, p. 130 (re-downloaded 2026-09-23 from
`https://resources.avid.com/SupportFiles/Sibelius/6/reference.pdf`; the same text is in the 2018.6
Reference, `https://resources.avid.com/SupportFiles/Sibelius/2018.6/Sibelius_Reference_2018.6.pdf`, §3.8):

> *"Grace note bends and pre-bends — Both these kinds of bends are notated in the same way: first, from the
> second Keypad layout (shortcut F8), create the grace note (…) or pre-bend note (…, shortcut – on Windows,
> \* on Mac); hit J to create a bend; then create the second note. On a tab staff, a pre-bend is represented
> by a vertical arrow."*

> *"Pre-bend and release — … create a pre-bend note followed by a grace note, create a bend, then create a
> full-size note, and create another bend between the grace note and the full-size note."*

The Reference does not say what the pre-bend note IS or how it plays. The forum does. Bob Zawalich, thread
*"Sib. 2018.x: Does anyone know how pre-bend notes are implemented?"*,
https://www.sibelius.com/cgi-bin/helpcenter/chat/chat.pl?com=thread&start=729872&groupid=3&guest=1 :

> *"pre-bend notes (from the 2nd keypad layout)are a form of grace notes. They appear to be parenthesized,
> stemless and silent. You can't turn the () or and off, though you can change the notehead type. Silencing
> is not done via the notehead type, play on pass, or live playback. You can change the size by changing the
> grace note size in Engraving Rules, but of course that changes all grace notes as well."*
> — and later in the thread: *"Any ideas on a way to make these non silent?"* (no answer in the thread).

The same user, thread *"Sib. 7.1.3: Parentheses trill"*,
https://www.sibelius.com/cgi-bin/helpcenter/chat/chat.pl?com=thread&start=635651&groupid=3&guest=1 :

> *"the pre-bend notes appear to be grace notes with stemless noteheads with the bracketed property. So like
> all grace notes, their default position is to the left of the note to which they are attached. Once you
> create one, you can add more of them, but each will have its own brackets (is that acceptable?). Also a
> beam will show up and you will need to turm it off in the keypad."*

Wim Hoogewerf in the same thread says the placement moves when the spacing is reset: *"By default the
bracketed note will set itself at the end of the main note rhythmical value. After Reset Note Spacing it will
jump back to this Default Position."*

**⭐ Its use as a trill note — Avid's own help center.** Article 400, *"Creating auxiliary notes for
trills without using grace notes"* (Wim Hoogewerf, versions affected 2 – 7.1, changed 24 Feb 2004),
http://www.sibelius.com/helpcenter/article.php?id=400 :

> *"Auxiliary notes are often drawn just to the right of trilled notes, to show which note should be trilled
> to. You can normally use the pre-bend note (a stemless, bracketed grace note on the F9 Keypad layout) for
> these, but they are not always ideal because they attach to the previous note, i.e. they prefer to be
> positioned to the left of the main note, rather than on the right, and their position can be volatile (if
> e.g. you have to reset note spacing)."*

Its alternative: a new notehead with *"Playable"* and *"Stem"* switched off, the trill note entered *"using
an unused voice, e.g. voice 3"*, set to *"'cue-size' (cue-cue size gives grace note size!) and 'brackets'"*,
and moved right *"using the X offset … about 3 spaces"*. ⚠️ The article says **F9** where the 6 Reference
says **F8**. This article is from 2004 and covers Sibelius 2–7.1. Whether the keypad numbering was
different in those versions is UNKNOWN.

**Forum practice, as recorded.** Thread *"Sib. 7.5: Pre Bend notes - is there a better solution for writing
a half step trill?"*,
https://www.sibelius.com/cgi-bin/helpcenter/chat/chat.pl?com=thread&start=671046&groupid=3&guest=1 :
- David T: *"a trill with a flat note in brackets (parenthesis!!) a half step above the original note and to
  the right … I found a solution using pre bend notes and moving the x position of the bent note to the
  right - but it's a bit fiddly … when i copy and paste the bars the X position is not remembered"*.
- Michael Cryne: *"I instead use voice 2 (or 3 …) to create a 'trill-to' note in parentheses, and turn it off
  in playback"*.
- Robert Puff, quoted by Bob Morabito: *"One way is to indicate the trill-to pitch as a stemless, cue sized
  note in a parenthesis."* The article is
  https://www.scoringnotes.com/of-note/half-whole-tone-flat-natural-sharp-trill-lines-in-sibelius/ ; it
  continues *"…this method is somewhat labor-intensive to create in the current software, and furthermore,
  isn't completely bulletproof in terms of the trill-to pitch maintaining its horizontal positioning after
  music spacing."*

**Trill playback.** 6 Reference, *Trills* (Playback chapter): *"By default, trills alternate 12 times per
second with an interval of a diatonic step … To specify an interval in half-steps (semitones), switch off
Diatonic, then set Half-steps to the desired interval … You can write a small accidental as a symbol above
the trill to indicate the interval, but Sibelius won't read it directly."* So in Sibelius the trill's sound is
a property of the trill **line**. No written symbol changes it, whether an accidental or a bracketed note.

**The round-bracket key is separate** (6 Reference p. 165, already in `sibelius-keypad.md` §3b): *"You can
add parentheses (round brackets) to any notehead (including grace notes) using the button on the second
Keypad layout"*.

### I.2 Dorico

**Trill interval appearance.** Dorico 3.5 help, *Trill interval appearance*,
https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_ornaments/notation_reference_ornaments_trills_intervals_appearance_r.html
(identical text in the 3.1 page, `…/dorico/v3/…`):

> *"Accidental — Indicates the trill interval using accidentals positioned above, below, or beside the tr
> mark. This is the default trill interval appearance in Dorico Pro for major or minor second trills.*
> *Hollywood-style — Indicates the trill interval using text. H.T. … W.T. …*
> *Auxiliary note — Indicates the trill interval using a small, parenthesized, stemless notehead shown in
> the staff immediately to the right of the first note to which the trill applies, and at the correct staff
> position for the trilled-to pitch. Auxiliary notes are used for all trill intervals that are not a major or
> minor second, but are automatically hidden for unison trills if the notehead design of the auxiliary note
> has not been overridden.*
> *Note — On tablature, the trilled-to pitch always appears as a parenthesized fret number."*

*Changing the appearance of trill intervals*,
https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_ornaments/notation_reference_ornaments_trills_intervals_appearance_changing_t.html :
*"You can only change the trill interval appearance of trills with a major/minor second interval."*, and
*"You can change the notehead design of individual auxiliary notes, for example, to show that the
trilled-to note is a harmonic."*

**The interval is the source of truth, and it plays.** *Trill intervals*,
https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_ornaments/notation_reference_ornaments_trills_intervals_c.html :
*"Trill intervals tell performers which notes to play and also affect the pitches used in playback in Dorico
Pro."* *Trills in playback*,
https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_ornaments/notation_reference_ornaments_trills_playback_r.html :
*"Dorico Pro plays back trills by using a combination of sampled trills, when available, and triggering
multiple notes … When playing generated trills, Dorico Pro incorporates grace notes immediately before and
after trills. A single unslashed grace note on the initial trill note produces an appoggiatura, while
multiple grace notes on the initial trill note are included in the trill pattern."* So Dorico's GRACE notes
next to a trill are start/end notes. That is Gould's division exactly.

**Pre-bend = a property of the note, and its bracketed head is generated.** *Guitar pre-bends and
pre-dives*,
https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_guitar_bends/notation_reference_guitar_bends_pre_bends_pre_dives_c.html :

> *"In Dorico Pro, guitar pre-bends and pre-dives are properties of notes belonging to fretted instruments,
> meaning they only apply to single notes … On notation staves, guitar pre-bends are notated using an angled
> line between the noteheads at the start and end. However, unlike guitar bends, the parenthesized auxiliary
> notehead at the start is shown automatically as part of the pre-bend. On tablature, guitar pre-bends are
> notated using a solid vertical line with an arrowhead at the top, a bend interval above the arrowhead, and
> a small fret number below the line to indicate the start pitch … On notation staves, guitar pre-dives
> appear the same as guitar pre-bends."*

Dorico 3.0 feature text (Version History PDF pp. 64–66, link in the method notes): *"Creating a pre-bend. A
pre-bend is created by activating the Pre-bend interval property in the new Guitar Pre-bends group in the
Properties panel, and specifying the amount by which you want the string to be pre-bent. Defining a pre-bend
interval causes a parenthesized auxiliary note with a bend to appear on the notation staff, while in
tablature a pre-bend is shown by way of a grace-note sized fret number with a vertical arrow"*. Also:
*"Bends, pre-bends and releases are all notated in the same way on staff notation: an angled line joins the
start and end noteheads"*. The same document says *"Pre-bends cannot be flipped with F, but you can activate
the Guitar pre-bend direction property"*, and *"Playback of bends. There is no automatic playback of bends,
releases or pre-bends in this release of Dorico"*.

Playback today: *Guitar bends* (3.5),
https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_guitar_bends/notation_reference_guitar_bends_c.html :
*"Guitar bends and releases with bend intervals of up to a whole step (tone) are reflected in playback."*
Whether pre-bends are included is **UNKNOWN**. The pages say "bends and releases", and the 3.5 playback page
for bends could not be found at a guessed URL.

**Bracketed noteheads in general** (not grace-specific),
https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_notes/notation_reference_notes_bracketed_c.html :
*"Bracketed noteheads are often used to indicate that notes are optional, editorial, not played in all
playthroughs in music with repeats, or pressed down but not fully struck on the piano … By default,
bracketed notes have reduced velocity, causing them to sound quieter in playback than normal notes."* In
Dorico a bracket on an ordinary note does NOT silence it. It only makes it quieter.

Scoring Notes' review of Dorico 2.2 (when trills were redesigned), https://www.scoringnotes.com/reviews/dorico-2-2/ :
*"The third option is to show auxiliary notes – small parenthesised noteheads indicating the note to be
trilled to. Auxiliary notes – generated automatically without workarounds"*.

### I.3 MuseScore 4

**Pre-bend** — Handbook, *Guitar bends & dives*, https://musescore.org/en/handbook/4/guitar-bends :
*"Pre-bends indicate a string that has been bent prior to being struck. On the standard stave, it is
represented as a stemless, parenthesised grace note. On the tablature stave, it is illustrated with a
straight, rather than curved arrow."* Also *"Grace note bends … When you apply a grace note bend to a note,
it will automatically be entered one diatonic step lower than the note it precedes."* The source (v4.4.4,
`src/engraving/dom/cmd.cpp`, `Score::addGuitarBend`) shows what the command creates, read directly:
- it creates a **grace note before the main note**: `setGraceNote(chord, note->pitch(), NoteType::APPOGGIATURA,
  Constants::DIVISION / 2)` (an eighth appoggiatura), then `graceNote->transposeDiatonic(-1, …)`;
- on every linked copy, `linkedGrace->setNoStem(true); linkedGrace->setBeamMode(BeamMode::NONE);` (this
  branch runs for both `PRE_BEND` and `GRACE_NOTE_BEND`);
- the **brackets are drawn by layout, not stored**: `rendering/dev/guitarbendlayout.cpp:102–103`, *"if
  (bend->type() == GuitarBendType::PRE_BEND && !startNote->headHasParentheses())
  startNote->setHeadHasParentheses(true, /\* addToLinked= \*/ false, /\* generated= \*/ true);"*
- it is **silent**: `dom/chord.cpp` `Chord::isChordPlayable()` → *"if (m_notes.front()->isPreBendStart())
  { return false; }"*. Removing the bend reverses all of this (`score.cpp`, `case ElementType::GUITAR_BEND`
  in the remove path: `setHeadHasParentheses(false)`, `setNoStem(false)`, `BeamMode::AUTO`).
- The sound belongs to the bend: *"Both the bend amount and its playback speed can be adjusted via the
  Properties panel"* (handbook, same page).

So MuseScore makes the pre-bend's bracketed head a real grace chord (an appoggiatura with its stem and beam
switched off), bracketed at layout and never played. This matches Sibelius's model, but the bend command
creates it and no keypad key does.

**Trill auxiliary** — Handbook, *Ornaments*, https://musescore.org/en/handbook/4/ornaments :
*"Trills can be customized by quality (major, minor, augmented, etc.) and interval number from unison to
octave. The appropriate accidental or upper auxiliary note will display in the score above or below the
ornament. For intervals larger than a second, consider using a tremolo."* The source shows it is **not a
grace note**:
- v4.4.4 `dom/ornament.cpp` `Ornament::updateCueNote()`: `m_cueNoteChord = Factory::createChord(…);
  m_cueNoteChord->setSmall(true); cueNote->setHeadHasParentheses(true); cueNote->setHeadType(NoteHeadType::HEAD_QUARTER);
  … cueNote->setIsTrillCueNote(true);`. It is a small chord OWNED by the ornament (`m_cueNoteChord`), placed
  in the main chord's segment. It is not a member of the voice.
- when it shows: v4.4.4 `ornament.h:54` `bool showCueNote() { return _intervalAbove.step != IntervalStep::SECOND; }`.
  From v4.6.0 on it is a property, `AutoOnOff m_showCueNote = AutoOnOff::AUTO`, and AUTO means
  *"(hasFullIntervalChoice() && style().styleB(Sid::trillAlwaysShowCueNote)) || _intervalAbove.step != IntervalStep::SECOND"*.
- ⚠️ the parentheses have changed between versions: v4.4.4 sets them at creation; v4.6.0 uses
  `setParenthesesMode(ParenthesesMode::BOTH)`; v4.7.3 `EditChord::addChordParentheses(…)`; v4.7.5
  `score()->cmdAddParenthesesToNotes(notes)`. Issue **#33938**, *"Trill cue note should have parentheses by
  default"* (opened 24 Jun 2026, closed, project field "MuseScore Studio 4.7.4", status Done),
  https://github.com/musescore/MuseScore/issues/33938 , quotes Gould: *"On p. 139 of Behind Bars, Elaine
  Gloud [sic] says 'Notate the trilling pitch as a small notehead in brackets after the measured note.'. In
  order to achieve this in MuseScore, you have to turn the cue note on, then select the cue note and switch
  parentheses on."* So some 4.5–4.7 builds shipped the cue note without brackets.
- Scoring Notes on 4.1, https://www.scoringnotes.com/reviews/musescore-4-1/ : *"Intervals beyond a second
  are automatically shown as parenthesized noteheads, which look great. Intervals of a second are shown with
  the accidental above the trill line only. I do wish there was an option to show the trilled note in
  parentheses for seconds as well."* (From 4.6 the AUTO/ON property answers this.)

**MusicXML out of MuseScore** (v4.4.4 `importexport/musicxml/internal/musicxml/exportxml.cpp`, grepped): the
ornament's accidentals are written as `<accidental-mark>`
(`writeAccidental(m_xml, u"accidental-mark", accidental)`). A grep for `TrillCueNote`/`cueNote` and for a
guitar `<bend>`/`pre-bend` writer found **no match**. The only "bend" string is `brass-bend`. 🔶 So the trill
cue note and the guitar pre-bend do not appear to be exported. This is inference from a grep, not a test
export.

### I.4 Finale (discontinued 2024; the docs still serve)

- **Trill to** — *Trills*, https://usermanuals.finalemusic.com/FinaleMac/Content/Finale/ht-trills.htm :
  *"To let the player know which notes are to be trilled, a small accidental, sometimes in parentheses, is
  often placed next to the symbol. (This tells the player to raise or lower the written pitch by a half step
  for the trill.) This symbol, too, is an Articulation"*, and *"The Engraver font includes full size Trill to
  characters. These noteheads are provided for Trill to notes when they are to be placed outside of the
  staff."*
- *"Trill to" Noteheads*, https://usermanuals.finalemusic.com/Finale2011Win/Content/Finale/Fonts14.htm :
  *"Set One: Full Size — … First enter the notes with any of the Finale note entry methods, then with Special
  Tools Tool change the notehead, shorten the stem and move it to the desired horizontal position … Set Two:
  75% Reduction — These noteheads are already reduced to 75% and can be used as "trill to" notes for use
  within the staff. Enter with the Articulation Tool."* Finale has no trill-to object. It is either a
  **font glyph entered as an articulation** or an ordinary note restyled by hand.
- Trill playback: *"Trills defined with one of the default trill articulations playback automatically if
  Human Playback is enabled"* (same *Trills* page). A trill-to glyph affecting that playback is UNKNOWN.
- **Guitar bend** — *Guitar bends*, https://usermanuals.finalemusic.com/Finale2012Mac/Content/Finale/Guitar_bends.htm :
  tablature only: *"By default the second fret number will be hidden. By default, the second fret number of
  a release will be parenthesized."* A **pre-bend on the standard staff: UNKNOWN**. No Finale page reached
  described one, and the Engraver-font page `…/FinaleMac/Content/Finale/Engraver_font.htm` answered **403**.

### I.5 Guitar Pro, Notion, LilyPond

- **Guitar Pro 7 User Guide** (`https://blog.guitar-pro.com/wp-content/uploads/2018/10/GuitarPro7-user-guide.pdf`,
  86 pp., grepped): the bend is a curve on ONE note, *"The Bend window allows you to precisely set the type
  of the bend you want by adjusting its points"*, and *"The Stylesheet allows you to display the bend in
  standard notation too."* The trill is a note property with *"the fret of the second note"*, and *"This
  notation lightens the score, because alternated notes are not displayed."* The words "pre-bend" / "prebend"
  **do not occur** in the guide. **How GP draws a pre-bend on the standard staff: UNKNOWN.**
- **Notion: UNKNOWN.** Not reached.
- **LilyPond** (the one engine with a dedicated construct): *Expressive marks as lines*,
  https://lilypond.org/doc/v2.24/Documentation/notation/expressive-marks-as-lines :
  *"Trills that require an auxiliary note with an explicit pitch can be typeset with the \pitchedTrill
  command. The first argument is the main note, and the second is the trilled note, printed as a stemless
  note head in parentheses."* and *"The Accidental of the first pitched trill in a measure is always printed,
  even for naturals … Subsequent accidentals (of the same note in the same measure) will need to be added
  manually."* Its grobs are `TrillPitchHead`, `TrillPitchParentheses` (*"The parentheses of a pitched
  trill"*, `font-size: -4`), and `TrillPitchGroup`, all made by `Pitched_trill_engraver`
  (https://lilypond.org/doc/v2.24/Documentation/internals/trillpitchparentheses). The head is part of the
  TRILL SPANNER and not a note in the voice.

### I.6 Interchange formats

**MusicXML 4.0** (https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/…):

| element / attribute | what the spec says (verbatim) | relevant because |
|---|---|---|
| `<notehead parentheses="yes">` | *"If yes, the notehead is parenthesized. It is no if not specified."* | the brackets, per note |
| `<stem>none</stem>` | (value of `<stem>`) — used in the spec's own `<pre-bend>` example | the missing stem |
| `<grace/>` / `<cue/>` | see Part D §1 | a grace or grace-cue note |
| `<bend>` (parent `<technical>`) | *"used in guitar notation and tablature. A single note with a bend and release will contain two `<bend>` elements"*; content `<bend-alter>`, then zero or one of `<pre-bend>` / `<release>`, then `<with-bar>?` | the pre-bend lives HERE |
| `<pre-bend>` | *"indicates that a bend is a pre-bend rather than a normal bend or a release."* Always empty | |
| `<bend-alter>` | *"the number of semitones in the bend … Negative values indicate pre-bends or releases. The `<pre-bend>` and `<release>` elements are used to distinguish what is intended."* | |
| `<trill-mark>` | *"represents the trill symbol"*; attributes include `trill-step` (*"The alternating note for playback, relative to the current note. It is whole if not specified."*), `start-note`, `two-note-turn`, `accelerate`, `beats` | the trill's INTERVAL is a playback attribute |
| `trill-step` data type | *"describes the alternating note of trills and mordents for playback"*; values **`half` · `unison` · `whole`** | ⚠️ no third, no microtone, no spelled pitch |
| `<accidental-mark>` (in `<ornaments>`) | *"The `<accidental-mark>` element's content is represented the same as an `<accidental>` element, but with a different name to reflect the different musical meaning."* Has `parentheses` and `bracket` attributes | the written accidental of a trill |

The spec's own **pre-bend example**
(https://www.w3.org/2021/06/musicxml40/musicxml-reference/examples/pre-bend-element/) is a single TAB note
with no separate grace note:

```xml
<note>
  <pitch><step>B</step><alter>-1</alter><octave>3</octave></pitch>
  <duration>8</duration><voice>1</voice><type>half</type>
  <stem>none</stem>
  <notations><technical>
    <string>3</string><fret>3</fret>
    <bend><bend-alter>-2</bend-alter><pre-bend/></bend>
  </technical></notations>
</note>
```

⭐ So MusicXML models the pre-bend as a fact about the **struck note** (how far it was pre-bent), and it has
**no element for a trill auxiliary pitch**. The trill's second pitch is `trill-step` + `<accidental-mark>`,
both relative to the main note. A drawn bracketed auxiliary has to be written as a separate `<note>`
(`<grace/>` + `<stem>none</stem>` + `<notehead parentheses="yes">`), and then it cannot be told apart from
a real grace note. A MusicXML issue proposing a trill-auxiliary element: **UNKNOWN** (search was
rate-limited; see below). The 4.1 draft pages were not checked.

**MEI 5** (https://music-encoding.org/guidelines/v5/elements/…):
- `<trill>`: *"Rapid alternation of a note with another (usually at the interval of a second above)."*
  Attributes include `accidupper` (*"Records the written accidental associated with an upper neighboring
  note"*), `accidlower`, their `.ges` sounding forms, and `enclose`. It **may not have child elements**.
  Remarks: *"The interval between the main and auxiliary notes is usually understood to be diatonic unless
  altered by an accidental."* There is no attribute for the auxiliary's pitch.
- `<note>` has `@enclose` (*"Records the characters often used to mark accidentals, articulations, and
  sometimes notes as having a cautionary or editorial function"*; `data.ENCLOSURE` = `paren` · `brack` ·
  `box` · `none`), `@stem.visible` (*"Determines whether a stem should be displayed"*), `@grace`, `@cue`,
  `@head.visible`. So an MEI encoder can spell the drawing as `<note grace="…" stem.visible="false"
  enclose="paren">`, but nothing links it to the trill.
- `<bend>`: *"A variation in pitch (often micro-tonal) upwards or downwards during the course of a note"*,
  `@amount` *"the amount of detuning"*. It is a control event and has no pre-bend flag that we found.
- MEI issues on trill auxiliaries: **UNKNOWN**. A web search found none; GitHub issue search was
  rate-limited.

**MNX** (object list at https://w3c-cg.github.io/mnx/docs/mnx-reference/objects/ , schema
`…/docs/mnx-schema.json`): there is a `grace` object (`graceType` = `makeTime` · `stealFollowing` ·
`stealPrevious`, `slash`), an `accidental-enclosure`, and `stem-direction`. The object list has **no**
trill/ornament, **no** bend, **no** notehead parentheses, and **no** stemless-note flag. Neither use can be
encoded in MNX today.

**SMuFL** (https://smufl.formats.music/latest/tables/…):
- Noteheads: `noteheadParenthesis` U+E0CE (*"Parenthesis notehead"*), `noteheadParenthesisLeft` **U+E0F5**
  (*"Opening parenthesis"*), `noteheadParenthesisRight` **U+E0F6** (*"Closing parenthesis"*).
- Standard accidentals: `accidentalParensLeft` **U+E26A**, `accidentalParensRight` **U+E26B**,
  `accidentalBracketLeft/Right` U+E26C/E26D.
- Common ornaments: `ornamentTrill` U+E566, and the recommended ligatures `ornamentTrillFlatAbove`
  (`uniE260_uniE566`), `ornamentTrillNaturalAbove`, `ornamentTrillSharpAbove`.
- **No glyph for a trill auxiliary note and none for a pre-bend head.** Both are built from a notehead
  plus the parenthesis glyphs. The W3C list discussed adding more trill-interval glyphs in 2017. Kentaro
  Sato reported that London copyists *"are rather tired of specifying trill note with small or parenthesized
  note"* and wanted *"W"* / *"1/2"* trill ligatures. Daniel Spreadbury answered: *"My inclination is that we
  should not add these glyphs to SMuFL"*
  (https://lists.w3.org/Archives/Public/public-music-notation-contrib/2017Nov/0004.html ,
  …/0008.html). A SMuFL issue about a pitched-trill glyph: **UNKNOWN**.

### I.7 Comparison table

| | the bracketed head is… | placed | made by | stem / flag / beam | size | plays? | what carries the SOUND |
|---|---|---|---|---|---|---|---|
| **Sibelius** pre-bend (F8 `-`) | a **grace note** with bracketed stemless heads | **left** of the main note (grace position) | a keypad key, then **J** for the bend | none (a beam *"will show up and you will need to turn it off"*) | grace size (60 %) | **no**, *"silent"*, cannot be switched on | the bend line (playback UNKNOWN) |
| **Sibelius** trill note | no object: the pre-bend note dragged right, or a hidden-voice note with a custom notehead | right, by hand, and it moves when spacing is reset | workaround (help-center art. 400) | off (custom notehead *"Stem"* off) | cue-cue = grace size | off by hand (*"Playable"* off) | trill line's *Diatonic / Half-steps* property |
| **Dorico** trill auxiliary | a **generated** part of the trill | *"immediately to the right of the first note"* | trill *Appearance → Auxiliary note*; automatic when the interval is not a second | none | *"small"* | the head no; the trill plays its **interval** | trill interval |
| **Dorico** pre-bend | a **generated** *"parenthesized auxiliary notehead"* | at the start of the bend (before the note) | note property *Pre-bend interval* | UNKNOWN in detail (drawn as a head) | UNKNOWN | UNKNOWN (3.0: no bend playback at all) | the pre-bend interval |
| **MuseScore** pre-bend | a real **grace chord** (appoggiatura, eighth), stem off, beam off, brackets added at layout | before the main note | guitar palette / bend command | `setNoStem(true)`, `BeamMode::NONE` | grace | **no** (`isChordPlayable` false) | the bend curve |
| **MuseScore** trill cue note | a small chord **owned by the ornament** (`isTrillCueNote`) | beside the main chord, in its segment | automatic when the interval is not a second; from 4.6 an AUTO/ON/OFF property | quarter head, no stem | `setSmall(true)` | the head no; the ornament plays its **interval** | ornament interval |
| **Finale** trill-to | a font glyph (Engraver *"Trill to"*, 75 %) entered as an **articulation**, or a restyled real note | by hand | articulation tool / Special Tools | glyph has none | 75 % set, or full size | UNKNOWN | Human Playback of the trill |
| **LilyPond** `\pitchedTrill` | `TrillPitchHead` + `TrillPitchParentheses`, part of the trill spanner | after the main note | the trill command's 2nd argument | stemless | `font-size -4` | UNKNOWN (not checked) | UNKNOWN |
| **MusicXML** | no dedicated object; spell as `<note><grace/>…<stem>none</stem><notehead parentheses="yes">` | document order | — | `<stem>none</stem>` | `<cue/>` / `font-size` | a grace note has no `<duration>` | pre-bend: `<bend><bend-alter/><pre-bend/></bend>` on the main note; trill: `trill-step` half/whole/unison + `<accidental-mark>` |
| **MEI** | no dedicated object; `<note>` with `@enclose="paren"`, `@stem.visible="false"`, `@grace` | — | — | `@stem.visible` | `@cue` / `@fontsize` | — | trill: `@accidupper/@accidlower(.ges)`; `<bend @amount>` |
| **MNX** | cannot be encoded (no trill, bend, notehead parentheses or stemless flag) | — | — | — | — | — | — |
| **SMuFL** | no glyph; build from a head + U+E0F5/E0F6 (or U+E0CE) | — | — | — | — | — | — |
| **Gould** | trill: *"small notehead in brackets after the measured note"*, *"Do not use a grace note"*. Pre-bend: a *"verbal instruction"* | trill: after; bend target: after a line | — | — | small | — | — |

### I.8 UNKNOWN — checked, not answered

- **Sibelius pre-bend playback of the BEND** (not of the head): the 6 and 2018.6 References say nothing
  about bends playing back. The head is silent (forum).
- **Sibelius F9 vs F8**: help-center article 400 (2004) names the pre-bend note's layout *"F9"*; the 6
  Reference names F8. The keypad numbering in Sibelius 2–5 is not researched.
- **Sibelius MusicXML export of a pre-bend note**: not researched.
- **Dorico pre-bend playback** after 3.0; the auxiliary note's exact size, and its stem, for a pre-bend;
  the Dorico 3.5 bends-in-playback page (`…notation_reference_guitar_bends_in_playback_c.html` → 404) and
  the current `steinberg.help/r/dorico-pro/6.x` pages (a JavaScript shell; nothing fetchable).
- **Dorico MusicXML export/import** of trill auxiliary notes and pre-bends: not researched.
- **MuseScore forum** `musescore.org/en/node/356117` (*"trill with parenthetical note"*) and `/node/358238`
  (*"Guitar bends/prebends/reverse bends"*): **403**. Only a search-engine summary was seen, and it is not
  quoted as fact.
- **MuseScore MusicXML import** of a bracketed stemless grace note: not researched. The export conclusion is
  a grep, not a round trip.
- **Finale pre-bend on the standard staff** and the Engraver font page
  (`usermanuals.finalemusic.com/FinaleMac/Content/Finale/Engraver_font.htm` → **403**).
- **Guitar Pro** standard-notation drawing of a pre-bend (the GP7 guide never says "pre-bend"); **Notion**
  (not reached).
- **GitHub issue search** of `w3c-cg/musicxml`, `w3c-cg/mnx`, `w3c-cg/smufl` and
  `music-encoding/music-encoding` for "trill auxiliary" / "pitched trill" / "pre-bend": the unauthenticated
  API returned *"API rate limit exceeded"* before any result (repo names under `w3c/…` returned *"Validation
  Failed"*). Web search surfaced no such issue. That is not evidence that none exists.
- **MusicXML 4.1 draft** changes to `<trill-mark>` / `<bend>`: not checked.
- **Gould p. 378 example (a)**: its shape (a bracketed small head AFTER a bend line) was read at 110 dpi.
  Render PDF p. 398 at 450 dpi before treating it as measured.
