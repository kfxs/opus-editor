# Cue-size notes — what the sources say

> **Findings only**, in the manner of `docs/research/grace-notes-research.md`. ⛔ Nothing here is a
> decision, and no file is named to edit. The feature (a cue-size toggle, first as a dev-shell button,
> on notes, chords, graces and a note's brackets) has no plan yet. When it has one, the choices are
> made in the plan, and this file is its list of options. ⚠️ A research file does not know what was DECIDED.
>
> Written 2026-09-23 from three investigations run in parallel. Each is a chapter below, kept whole
> with its own citations: `file:line` under `~/dev/engine-sources/`, printed page numbers in
> `reference/`, and URLs for online sources. The chapters are:
> **A** Verovio, MuseScore, LilyPond · **B** the literature · **C** industry standards (specs, apps, publishers).
> §0 is the synthesis, and it is the one part of this file written by hand rather than found.
>
> ⚠️ **The three chapters were written by three agents that did not know of each other.** Where two
> disagree, §0 says which one read the source.

## 0. Synthesis

### 0.1 ⭐ Cue is a FLAG, and its size is a house setting

Every format and engine stores cue as a yes/no: MEI `@cue`, MusicXML's `size="cue"`, MuseScore
`isSmall`, Verovio `m_drawingCueSize`, and LilyPond's CueVoice. The RATIO lives in a style setting
(MuseScore `smallNoteMag`, Verovio `--grace-factor`, Dorico and Sibelius engraving options) or in the
file's header (MusicXML `<note-size>`). No spec states a number (§C.1).

### 0.2 The size

| source | cue | grace |
|---|---|---|
| Dorico · Sibelius | 0.75 | 0.6 |
| Verovio | 0.75 | the same 0.75 |
| MuseScore | 0.7 | 0.7 |
| IMSLP (German guidelines) | 0.7 | 0.6 |
| LilyPond | ≈0.63 | ≈0.79 |
| Gould, stated | ¾ | "slightly smaller" |
| **Gould, as drawn** | **≈0.62** | **≈0.62 (the same)** |
| Ross, measured | 0.72–0.77 (0.70–0.86 over his chart) | ≈0.57 |
| G&L | 65–75% (measured 0.61 / 0.71) | 65% |

⇒ **Two answers are defensible: ¾ as WRITTEN** (Gould, Ross, the apps) **and ≈⅝ as DRAWN** (Gould's
plates, G&L's lower example, LilyPond). ⭐ Every source but LilyPond and Gould's plates has
**grace ≤ cue**.
- Our grace is 2/3 (D5), so a cue at 0.75 keeps the order the books write.
- A cue at ≈0.62 would be SMALLER than our grace.

### 0.3 What shrinks, and what stays full

| | books | engines | apps |
|---|---|---|---|
| heads, flags, dots, accidentals, articulations, dynamics | scale (Gould p. 569, G&L p. 54) | scale (all three) | scale (Sibelius) |
| stem LENGTH | scales (G&L 0.65/0.73; Gould 2–2½ sp; Stone ≈3) | scales (all three) | scales |
| stem THICKNESS | not stated | MuseScore thins; Verovio and LilyPond full | Dorico thins (a user complains) |
| beam | cue size (G&L p. 88, Ross A-13; Gould measured ≈0.75) | thickness and gap scale (all three) | UNKNOWN |
| **mixed beam** | not stated | **full** (MuseScore max; Verovio needs all cue) | UNKNOWN |
| ledger LENGTH | follows the head | follows the head | — |
| ledger THICKNESS | ⚠️ **thinner** (Gould p. 569) | MuseScore and Verovio thin; LilyPond full | — |
| ledger SPACING | ⭐ full (Gould p. 569): the pitch position is the full staff's | full | — |
| ties / slurs | UNKNOWN | MuseScore thins; Verovio and LilyPond full (LilyPond by rule) | — |
| a head's brackets | Gould's plates: mostly **full** (pp. 139, 378), once ≈0.85 (p. 497) | **follow the head** (all three) | UNKNOWN |
| rests INSIDE a cue | scale (Gould p. 569; measured 0.76) | scale | scale (Sibelius) |
| the PLAYER's rests beside a cue | ⭐ **full** (Gould p. 571, Stone p. 161, Ross p. 189) | — | Dorico: full by default |
| spacing | ⭐ **closed up in proportion** (Gould p. 569) | MuseScore 4 × 0.7 over a whole cue column; Verovio and LilyPond: the ink only | Dorico 70% |
| clef | ⅔ (Gould p. 573) · 75% (G&L p. 51) | MuseScore `smallClefMag` 0.8 | Sibelius: follows the cue size |

### 0.4 A grace that is also cue

- **The books:** UNKNOWN (§B.4).
- **Multiply:** MuseScore (0.49), Sibelius (45%, from a plugin author), and LilyPond's fonts (≈0.445).
- **One wins:** Verovio (0.75, grace = cue), and Dorico's Scale = Cue (it replaces the grace size).
- **Its own class:** MusicXML (`grace-cue`, its own %) and Dorico ("Cue grace", size UNKNOWN).

### 0.5 Sound

Cue SIZE and SILENCE are two facts:
- MusicXML: `<cue/>` means silent, `size="cue"` means small.
- MuseScore has `play`; Verovio has `midiNoCue`, off by default.
- Every engine plays a cue-sized note by default. The exceptions are LilyPond's quoted `\cueDuring`
  and Notion.

### 0.6 Where it lives

- **On the CHORD:** MuseScore's "Cue size" and Finale's stem click.
- **On a single head as well:** MuseScore ("Small notehead") and Verovio `note@cue`. Sibelius and Dorico
  cannot do it without a special notehead.
- **On a voice:** LilyPond's CueVoice; MEI's `layer@cue`.

### 0.7 What the books add that the engines lack

- The PLAYER's rests stay full size.
- Cue stems are often REVERSED away from the staff, kept one way through a cue (Gould, Stone, Ross, G&L).
- Spacing is closed up in proportion.
- The cue CLEF is small.

These are about a CUE PASSAGE (music quoted from another part), not about a small note as such.
Gould's "cue-sized" also covers ossias, alternatives, hummed notes and enharmonic helpers (§B.5).

---

## A. The engines: Verovio, MuseScore, LilyPond

Everything in this chapter comes from reading the source. **Nothing was rendered in any engine.**
The clones read:
- Verovio `efff0bc` (2026-08-18)
- MuseScore `929d1e9` (2026-08-18, the 4.x line)
- LilyPond `beedbfa` (2026-08-03)

For MuseScore 3.x, eight `libmscore/` files were read from the `3.x` branch
(`style, chord, note, beam, rest, accidental, segment, measure .cpp`).

### A.1 MuseScore 4.x

MuseScore paths are relative to `src/engraving/`.

**Data model.** Smallness is set at four levels:
- **Chord or rest:** `ChordRest::m_isSmall` (`dom/chordrest.h:90-91,218`), `Pid::SMALL`. The Properties
  panel calls it **"Cue size"**, and it is always written to the ancestor **chord**, never to the note:
  in `generalsettingsmodel.cpp`, `requestElements()` puts `findAncestor(CHORD)` into
  `elementsForIsSmallProperty`.
- **Note:** `Note::m_isSmall` (`dom/note.h:273-274,505`). The panel calls it **"Small notehead"**
  (`noteheads/HeadSettings.qml:88`). ⇒ **one note inside a normal chord can be small.**
- **Accidental:** `Accidental::m_isSmall` (`dom/accidental.h:257-258`), "Small accidental".
- **Staff:** `StaffType::m_small` (`dom/stafftype.h:205-209`). This is a separate small-staff feature.

**Cue means small AND silent.** MusicXML export separates the two:
`isCueNote = isSmallNote && !note->play()` (`importexport/musicxml/internal/export/exportmusicxml.cpp:4174-4186`).

- **Export:**
  - `<cue/>` when the note is small and silent (`:4402-4403`).
  - `<type size="cue">` when it is small and plays (`:4226-4227`). A grace note gets `size="grace-cue"` (`:4229`).
  - The accidental gets `size="cue"` or `"grace-cue"` (`:2880-2883`).
  - The defaults block writes `<note-size type="cue">`, `"grace"` and `"grace-cue"` (`:1421-1423`).
- **Import:**
  - `<cue/>` sets cue (`importmusicxmlpass2.cpp:7055`). `size="cue"` or `"grace-cue"` sets `isSmall` (`:7124`).
  - `handleSmallness()` (`:6644-6660`) makes the chord small. If any note is not small, it un-smalls the
    chord and marks the other notes small one by one.
  - `note->setPlay(!cue)` (`:7298`): "cue notes don't play".
  - `coerceGraceCue()` (`:2616-2627`) makes a grace note small or silent when its main chord is.

**Size factors.** They are style settings, editable in Format → Style (`style/styledef.cpp:515-521`):

| style | default |
|---|---|
| `smallNoteMag` (the cue size) | `.7` |
| `graceNoteMag` | `0.7` |
| `smallStaffMag` | `0.7` |
| `smallClefMag` | `0.8` |
| `scaleRythmicSpacingForSmallNotes` | `true` |

**A grace note that is also cue: the factors multiply.**
- `Chord::intrinsicMag()` (`dom/chord.cpp:2062-2077`) does `m *= smallNoteMag` if the chord is small,
  then `m *= graceNoteMag` if it is a grace.
- `Chord::mag()` is `staffMag × intrinsicMag` (`:2083-2087`).
- `Note::mag()` multiplies by `smallNoteMag` again when the note itself is small (`dom/note.cpp:2430-2437`).
- ⇒ a small grace is 0.49. A small note inside a small chord would also be 0.49, which the import
  avoids on purpose ("Avoid redundant smallness", `:6647`).
- `SegmentLayout::setChordMag` (`rendering/score/segmentlayout.cpp:91-112`) gives a grace chord
  `staffMag × (parent small ? .7 : 1) × graceNoteMag`.
- The exported `grace-cue` size is `graceNoteMag × smallNoteMag × 100` (`exportmusicxml.cpp:1423`).

**What scales:**

| element | behaviour | source |
|---|---|---|
| notehead | scales by the note's mag | `note.cpp:2430` |
| stem length | × `intrinsicMag` | `rendering/score/stemlayout.cpp:87,102,122` |
| stem **thickness** | scales, with the chord's intrinsic mag only (a small note in a normal chord does not thin the stem) | `Stem::lineWidthMag`, `dom/stem.cpp:69-72` |
| flag | scales | `Hook::mag()` returns the parent's mag, `dom/hook.h:42` |
| dots | scale, times `dotMag` = 1.0 | `dom/notedot.cpp:64-66`; `styledef.cpp:303` |
| articulations | scale, times `articulationMag` = 1.0 | `dom/articulation.cpp:565-567`; `styledef.cpp:311` |
| accidentals | scale with the note, and again if the accidental itself is small | `dom/accidental.cpp:394-399` |
| rests | scale | `dom/rest.cpp:452-458` |
| other note-attached elements | get the note's mag; **fingering deliberately does not** | `chordlayout.cpp:3244-3263` |
| ledger lines | thickness `ledgerLineWidth × chordMag`; extension past the head `ledgerLineLength × note->mag()` | `tlayout.cpp:3804-3809`; `chordlayout.cpp:1311,1361-1370` |
| beam | thickness and the gap between beam lines both × the beam's mag | `beamlayout.cpp:334-336` |
| tuplet number | `smallNoteMag` only when **every** element is small | `tupletlayout.cpp:202-210` |
| tuplet bracket | mean of the first and last chord's mag | `tupletlayout.cpp:66-67` |
| ties and slurs | mid-thickness capped at `normal × scalingFactor`, the average `intrinsicMag` of the two end chords (a grace-to-parent slur uses `graceNoteMag`); endpoint offsets also × `intrinsicMag` | `Tie::scalingFactor` `dom/tie.cpp:421-440`; `Slur::scalingFactor` `dom/slur.cpp:389-410`; `slurtielayout.cpp:3222-3253`, `:528-818` |
| a note's parentheses | `setMag(chord->mag())` | `parenthesislayout.cpp:420` |
| horizontal spacing | the duration stretch × `smallNoteMag` when every chord or rest filling the segment is small (`needsCueSizeSpacing`); smaller heads also take less ink | `horizontalspacing.cpp:780-782`, `:818-834` |

**A beam mixing cue and normal notes is drawn full size.** `BeamLayout` sets the beam's mag to the
**max** over its elements of `isSmall ? smallNoteMag : 1` (`beamlayout.cpp:209-226`), so one normal
note makes the whole beam full size. A grace beam is then × `graceNoteMag` (`:338-341`).

**Playback: small does not mute.** `Note::m_play` (`dom/note.h:276-277,506`, default true, the "Play"
checkbox in Properties) is a separate flag, and it is the one the renderers check
(`playback/renderers/noterenderer.cpp:45`; `compat/midi/compatmidirenderinternal.cpp:223`). Only a
MusicXML `<cue/>` import sets play to false.

### A.2 MuseScore 3.x (differences only)

- Same defaults: `smallNoteMag` .7, `graceNoteMag` 0.7, `smallStaffMag` 0.7, `smallClefMag` 0.8
  (`libmscore/style.cpp:400-403`).
- Same multiplication, in `Chord::chordMag()` (`chord.cpp:2969-2977`) and `Note::mag()` (`note.cpp:2337-2343`).
- Same mixed-beam rule, max over the elements (`beam.cpp:369-370`).
- **Different:** a grace beam is set to `graceNoteMag` only, ignoring smallness (`beam.cpp:463-464`).
- **Different:** there is no `scaleRythmicSpacingForSmallNotes` (not found in `style.cpp`), so small
  notes get no reduction in duration spacing.

### A.3 Verovio

**Data model.**
- MEI `@cue` (boolean, `att.cue`) is registered on `layer`, `beam`, `chord`, `note`, `rest`, `mRest`
  and `mensur` (`src/{layer,beam,chord,note,rest,mrest,mensur}.cpp`, `RegisterAttClass(ATT_CUE)`).
- In MEI before version 4, `@size` on a chord is converted to `@cue="true"` (`src/iomei.cpp:6954-6959`).
  `@fontsize` plays no part.
- Staff size is separate: `staffDef@scale` becomes `m_drawingStaffSize` (`src/setscoredeffunctor.cpp:336-338`).

The drawing flag is `LayerElement::m_drawingCueSize` (`include/vrv/layerelement.h:144-145`), set by
`PrepareCueSizeFunctor` (`src/preparedatafunctor.cpp:208-262`):
- a layer with `@cue` makes everything in it cue;
- **every grace note is cue-size;**
- otherwise the element's own `@cue` decides;
- accidentals follow their note, and an editorial accidental (`@func="edit"`) is always cue;
- articulations, dots, flags and stems follow their note, or else their chord;
- a tuplet follows its first note or chord.

**One note of a chord:** yes, `note@cue` exists. From the code, a chord's `@cue` does **not** pass to
notes that have none: `Note` has `ATT_CUE`, so the `Is(NOTE)` branch at `:229-234` never runs.
⚠️ This was read, not run.

**MusicXML import.** `<cue/>` or `type[@size='cue']` gives cue (`src/iomusxml.cpp:2952`). `grace-cue`
is not matched. A chord is cue only if all its notes are (`:3315-3322`). No MusicXML writer was found
(`include/vrv` has `MEIOutput` and `PAEOutput`).

**Size factor: one option covers grace and cue.** It is `--grace-factor` / `m_graceFactor`,
"The grace size ratio numerator", `Init(0.75, 0.5, 1.0)` (`src/options.cpp:1326-1328`).
`Doc::GetCueScaling()` returns it (`src/doc.cpp:2116-2119`). There is no separate cue option and no
small-staff preset; a staff's `@scale` is a free percentage.

**A grace that is also cue: no multiplication.** Cue is a boolean, and a grace already has it, so
both come out at 0.75. The staff's `@scale` does multiply: glyphs are × graceFactor × staffSize/100
(`src/doc.cpp:1864-1890`).

**What scales.** Anything drawn through `GetDrawingSmuflFont` or `GetGlyph*` with `graceSize`
(`doc.cpp:1864-1930,2121-2127`):

| element | behaviour | source |
|---|---|---|
| heads, flags, accidentals, articulations, rests, mRest, tuplet number | scale | `view_element.cpp:342,374,952,1537,1637,1242`; `view_tuplet.cpp:184-186` |
| a note's `@headmod="paren"` parentheses | scale | `view_element.cpp:1587-1594` |
| dots | scale, and their offsets too | `view_element.cpp:682-686,891,2090` |
| stem length | base × the cue factor | `calcstemfunctor.cpp:378` |
| stem **thickness** | **full**: `DrawStem` uses `GetDrawingStemWidth(staffSize)` with no cue argument | `view_element.cpp:1780-1781`; `doc.cpp:2062-2065` |
| ledger lines | extension scales (`doc.cpp:2097-2102`); thickness × graceFactor (`view_page.cpp:1441-1443`); drawn from separate cue ledger lists | `staff.cpp:296-303` |
| beam | thickness and the white gap between beam lines both × graceFactor | `doc.cpp:2083-2095` |
| ties and slurs | no cue code, so full thickness | `src/tie.cpp`, `slur.cpp`, `view_control.cpp` |
| tuplet bracket | no cue code found in `view_tuplet.cpp` | — |
| horizontal spacing | no cue rule found (no alignment functor mentions cue); only the glyph boxes shrink | — |

**A beam mixing cue and normal notes is drawn full size.** `BeamDrawingInterface::InitCue` makes the
beam cue only when `beam@cue` is set or **all** its elements are grace or cue
(`src/drawinginterface.cpp:263-276`). With one normal note the beam is full size, and a cue note
with its stem up has its stem x shifted to fit its smaller head (`src/beam.cpp:1890-1896`).

**Playback: cue notes play by default.** The option `midiNoCue` defaults to `false` ("Skip cue notes
in MIDI output", `src/options.cpp:1854-1856`). When it is on, a note is skipped only if `note@cue`
or `layer@cue` is set (`src/midifunctor.cpp:468-469,747,815-816`).

### A.4 LilyPond

**Data model.** Cue is a **voice context**, not a property of a note.
- `CueVoice` (`ly/engraver-init.ly:430-445`) has `fontSize = #-4`. It is usually created by
  `\cueDuring` / `\cueDuringWithClef`, which quote another part's music into a `CueVoice`
  (`ly/music-functions-init.ly:575-604`).
- Size is the context property `fontSize` (`scm/define-context-properties.scm:417`).
  `Font_size_engraver` adds it to each font grob's `font-size` (`lily/font-size-engraver.cc:53-61`).
- Shortcuts: `\teeny` −3, `\tiny` −2, `\small` −1 (`ly/property-init.ly:402-407`). Also
  `\magnifyMusic mag` and `\magnifyStaff mag` (`ly/music-functions-init.ly:1112-1180`).
- There is no cue flag for one note of a chord. The only way is a generic `\tweak font-size` on that
  `NoteHead`, which leaves the shared stem alone.
- **musicxml2ly ignores cue.** It reads `<note-size>` and does nothing with it ("TODO",
  `scripts/musicxml2ly.py:219-223`), and it has no handling for `<cue/>` or `size="cue"`.

**Size factors.** `magstep(s) = 2^(s/6)` (`scm/lily-library.scm:1718-1719`).
- **Cue:** `fontSize −4` = magstep(−4) ≈ **0.63**. Stem and beam `length-fraction` are set to
  `(magstep -4)` explicitly, and `Beam.beam-thickness` to `0.35` (the default is `0.48`,
  `scm/define-grobs.scm:479`).
- **Grace:** `general-grace-settings` sets `font-size −3` (≈ 0.794) on `NoteHead`, `Stem`, `Flag`,
  `Dots` and `Script`, and `−4` on `Accidental`. It also sets `Stem length-fraction 0.8`,
  `Beam beam-thickness 0.384` and `Beam length-fraction 0.8` (`scm/music-functions.scm:674-688`).
- No small-staff preset; `\magnifyStaff` takes any factor. All of these are defaults that a source
  file can override.

**A grace that is also cue: font sizes multiply, lengths do not.**
- `font-size` steps **add**. The grace setting pushes −3 on the grob (`lily/grace-engraver.cc:111-130`),
  and `Font_size_engraver` then adds CueVoice's −4. That makes −7 ≈ 0.445 for heads, flags, dots and scripts.
- Stem and beam `length-fraction` and `beam-thickness` are **replaced**. For as long as the grace
  lasts, its 0.8 / 0.384 hide CueVoice's 0.63 / 0.35.

**What scales.** Only the font grobs follow `fontSize`: NoteHead, Flag, Dots, Accidental, Script,
Rest, TupletNumber and Parentheses (their interfaces are in `scm/define-grobs.scm`).
- **Parentheses** get their own `−6` plus the font-size of the grob they enclose
  (`lily/parenthesis-engraver.cc:97-99`), so they follow the note.
- **Stem, Beam, Slur, Tie, TupletBracket and LedgerLineSpanner are not font grobs:**
  - Stem thickness is `thickness × staff line thickness`, and it is **not** scaled (`lily/stem.cc:909-913`).
  - Beam thickness is set explicitly (0.35 sp in a cue). The gap between beam lines shrinks through
    `length-fraction` in `Beam::get_beam_translation` (`lily/beam.cc:130-145`: "we want the gap to
    decrease too").
  - Ledger lines are as long as the head plus `length-fraction 0.25`, so they follow the smaller
    head; their thickness is the staff's (`lily/ledger-line-spanner.cc:204-231,382`).
  - Tie and slur thickness are unscaled. `\magnifyMusic` states the rule: stem, slur and tie
    thicknesses are "NOT allowed to shrink below default size" (`ly/music-functions-init.ly:1060-1079`).
- **Horizontal spacing:** no spacing module reads `font-size` (a grep of `lily/*spacing*.cc` found
  nothing), so there is no cue rule beyond the narrower ink. `\magnifyMusic` leaves
  `spacing-increment` commented out (Issue 3987, `:1090-1092`).

**A beam mixing cue and normal notes cannot happen.** A beam belongs to one voice, so a CueVoice beam
cannot hold main-voice notes. The Beam grob reads its own properties, not its notes' `font-size`, so
a note tweaked back to full size inside a cue beam keeps the cue beam. ⚠️ This was read, not run.

**Playback.** `\cueDuring` material is **left out of MIDI**: the performer context sets
`quotedCueEventTypes = #'()` "in order not to get multiple midi renditions"
(`ly/performer-init.ly:327-332`). Music written directly in a `\new CueVoice` does play, because
CueVoice exists in the performer too (`:113`). There is no per-note play flag.

### A.5 Comparison

| | MuseScore 4.x | Verovio | LilyPond |
|---|---|---|---|
| where cue lives | chord or rest `small` ("Cue size"); note `small` ("Small notehead"); accidental `small`; staff `small` | `@cue` on a note, chord, rest, mRest, beam or layer | the CueVoice context, `fontSize` |
| one note of a chord alone | yes (`Note::m_isSmall`) | yes (`note@cue`) | only by `\tweak font-size` |
| cue ratio | `smallNoteMag` 0.7 (a style setting) | `graceFactor` 0.75 (an option, 0.5–1.0) | fontSize −4 ≈ 0.63 |
| grace ratio | `graceNoteMag` 0.7 (a separate setting) | the same `graceFactor` | −3 ≈ 0.794 (−4 for accidentals) |
| small-staff ratio | `smallStaffMag` 0.7 | none (`@scale` %) | none (`\magnifyStaff`, any factor) |
| grace that is also cue | multiply: 0.49 | boolean: 0.75 | font steps add: −7 ≈ 0.445; stem and beam lengths take the grace value |
| stem thickness | scales (chord level) | full | full |
| ledger thickness / length | both scale | both scale | thickness full; length follows the head |
| beam thickness and gap | both × mag | both × factor | explicit 0.35; gap via `length-fraction` |
| ties / slurs | thickness capped by the averaged mag | full | full (a stated rule) |
| tuplet number | only if every note is small | if the first note is cue | scales |
| a note's parentheses | the chord's mag | scale | follow the note's font-size |
| horizontal spacing | duration stretch × 0.7 when the whole segment is small (4.x only) | no rule | no rule |
| mixed beam | full size (max) | full size (all must be cue) | cannot happen (a beam is per voice) |
| muted by default | no; a separate `play` flag | no; `midiNoCue` option (default false) | `\cueDuring` yes; a direct CueVoice no |
| MusicXML | `<cue/>` = small + silent; `type@size="cue"` / `"grace-cue"` = small only | imports `<cue/>` and `size="cue"`; no export | ignored |

### A.6 UNKNOWN

- LilyPond: whether the Parentheses grob gets the context `fontSize` a second time from
  `Font_size_engraver`. That depends on the order in which the engravers run.
- Verovio: how tuplet brackets, slurs and ties treat cue notes, beyond "there is no cue code".
- Nothing was rendered in any engine. Every value above comes from reading the source.

---

## B. The literature

This chapter starts at `reference/README.md`. The four treatises on disk are Gould, Ross, Stone and
Gerou & Lusk (G&L). Their text layers were grepped, and the scans were rendered and **measured**.
- Page offsets: Gould PDF = printed + 20; Ross PDF = printed + 12. Stone and G&L are 2-up scans.
- The crops and measuring scripts were in a session scratchpad and are gone. Every measurement names
  its printed page and dpi, so it can be reproduced.

⭐ **Headline: Gould WRITES ¾, but DRAWS about ⅝, and her engraved cue heads are the same size as her
grace heads.**

### B.1 Size

**Gould** (`gould-behind-bars-fulltext.txt`; scans measured at 480 dpi):
- **p. 569:** *"Cue notation is about three-quarters the size of full-sized notation, so that it is
  conspicuously smaller than the player's material."* And: *"Cue notes are usually slightly larger than
  grace notes (stem lengths of both tend to be the same)."*
- **p. 125:** *"The grace note is slightly smaller than a cue note, which is ¾ of a full-sized note."*
- **p. 571:** *"There must be sufficient contrast in size between cue and full-sized notes so that it is
  absolutely clear that the cue should not be played."*
- **Drawn.** Three examples on pp. 570–571 (the clarinet and Bruckner cues, and the flute), all on one
  staff with sp = 21.3 px, measure the same:

  | head | width | height |
  |---|---|---|
  | cue | 0.89 sp | 0.65–0.70 sp |
  | full (same examples) | 1.36–1.41 sp | 1.03–1.13 sp |
  | ratio | **≈0.63** | **≈0.61** |

- **Graces, p. 125**, by the same method, measure 0.89 × 0.65 sp against a full 1.36–1.40 × 1.12–1.17.
  ⚠️ That is exactly the cue head, so the "grace slightly smaller" she writes is not in her plates.
- **Cue STAVE, p. 575:** *"A cue stave is about three-quarters of the full-sized stave."* The ossia
  heads on p. 497 measure 22/30 ≈ 0.73 of the main staff's, so ¾ holds for a small STAFF.

**Ross** (`ross-art-of-music-engraving-fulltext.txt`; PDF at 720 dpi):
- **p. 189:** *"It is somewhat smaller than a normal sized note… Its size is determined by the staff and
  tool sizes used. For staff sizes one, two and three, the note size for staff six is used; for staff
  sizes four, five and six, the note size for staff seven is used."*
- **pp. 189–190:** *"The ratio of the size of the solo staff to the size of the piano-accompaniment staff
  is the same as the ratio of the size of a cue note to a normal note."*
- **Measured:**
  - p. 190: solo staff / piano staff = 32.7 / 45.2 px = **0.72**, and the heads on them **0.77**.
  - His staff chart on p. 57 (PDF 69; staff heights in px at 600 dpi: No. 1 185, 2 173.5, 3 162, 4 155,
    5 141, 6 130, 7 ≈112) turns the rastral rule into ratios of **0.70–0.86**, typically about 0.75–0.8.
- **p. 190:** *"The grace note is slightly smaller than the cue note."* His grace measures about
  **0.57** of the full head's height.

**Stone** (`stone-notation-20th-century-fulltext.txt`):
- No ratio in words. Stems, p. 49: *"7. CUES — Stems usually take up about 3 spaces"*, and
  *"6. GRACE NOTES — about 2½ spaces"*.
- The p. 49 example on a rough 2-up scan: a cue head 0.80 sp tall against a full head's 1.21 (≈0.66).
  The widths disagree (≈0.88). ⚠️ **Low confidence.**

**Gerou & Lusk** (PDF 29 at 600 dpi):
- **p. 54:** *"somewhat smaller than normal note size, but still large enough to be legible (65–75% of
  normal note size)"*. It is drawn as a ruler: 65% / 75% / 100%.
- **Measured:**
  - head widths 0.71 / 0.83 / 1.17 sp, i.e. **0.61 and 0.71** of full;
  - stems, centre to tip, 2.29 / 2.59 / 3.54 sp, i.e. **0.65 and 0.73**, so the stem scales with the head.
- **Graces, pp. 72–73:** *"notated at cue size or slightly smaller (65% of normal size works well)."*
- **Clef, p. 51:** *"cue-size clef… usually 75% of the original clef size."*

### B.2 What scales, and what does not

**Scales:**
- **Gould p. 569:** *"All notation symbols that are part of the cue (including rests, accidentals,
  articulation and dynamics) are scaled down."*
- **Gould p. 78:** *"An accidental is scaled down in size only when placed before a grace note… or a
  cue note."*
- **G&L:**
  - p. 54: *"All musical elements associated with the cue notes will also be at cue size."*
  - p. 88: *"Stems and beams should also be cue size."*
  - pp. 100–101: *"For any passage at cue size the 8va will likewise be at cue size."*
- **Ross p. A-13:** *"For beams on cue notes, insert a point of the proper size."*
- **Measured, Gould p. 571:**
  - a cue beam is ≈0.42 sp thick against a full beam's ≈0.52–0.56 (≈0.75);
  - a quaver rest inside the cue is 0.89 × 1.36 sp against 1.17 × 1.78 (**0.76**).

**Ledger lines:** Gould p. 569: *"Ledger lines for cue notes should be the same vertical distance apart
as full-sized ledger lines (although they are thinner)."* ⚠️ So they are **thinner**, at the full
spacing: a cue note sits at its full-size pitch position.

**Spacing:** Gould p. 569: *"Note spacing should be closed up within a cue: space characters in
proportion to the reduced note size."*

**Clef:** Gould p. 573: *"The cue clef is the same size as a mid-system clef: about two-thirds of the
full-sized clef."* G&L p. 51 says 75%.

**Rests that do NOT scale** are the PLAYER's own rests; rests *inside* a cue are scaled (p. 569, and
the 0.76 measured above).
- Gould p. 571: *"Rests are full-sized"*, said of the whole-bar rests beside a cue.
- Stone p. 161: *"cue-size notes predominantly stemmed in the wrong direction, and full-size rests."*
- Ross p. 189 draws full-size multi-rests beside cue notes.

**Brackets:** no book gives a number. The scans disagree: **two of three drawings are unscaled.**
- Gould p. 139 (a trill note) is a small head in brackets **2.07–2.11 sp** tall. Gould p. 378 (a bend
  target) measures **2.04 sp**. That equals a full head's ≈2.0 sp, so these are NOT scaled
  (`grace-notes-research.md` §G.4).
- Measured for this file: the ossia bracket on Gould p. 497 is **≈1.69 sp** round a small head on
  ledgers, ≈0.85 of the full pair, so it is partly scaled.
- The small-bracket rule that puts the head **and** its stem inside is in
  `parenthesised-note-research.md` B.2 (Gould p. 469).

**Slurs and ties:** their size is **UNKNOWN**.
- Gould p. 570 only says to reverse them away from the stave.
- On content, Gould p. 569 says *"Omit dynamics, articulation and phrasing except when they are
  important"*, and Holab writes *"there are no slurs or articulation"*.

### B.3 Stems and rests, briefly

**Stem direction has two styles:**
- **Gould p. 570:**
  - (1) *"Cue-stems reversed away from the stave"*: a high cue takes up-stems, a low one down-stems, and
    *"Keep the stems of the same cue… in one direction."*
  - (2) *"Cue-stems with ordinary stem direction"*, which saves space. The two may be mixed.
- **Stone p. 51:** *"Cues generally are stemmed opposite to normal, except that the stem direction should
  not be changed within any one cue."*
- **Ross p. 189:** the same two methods, chosen by whether most notes are above or below the middle line.
- **G&L p. 54:** *"reverse stem direction and added rests"* against *"normal stem direction and no added
  rests."*

**Rests:**
- Gould p. 571: with reversed stems, place the player's rests as in two-part writing, on ledger lines
  where they would collide. With ordinary stems the rests may be omitted, but hand-copied parts should
  always have them.
- Gould p. 572: a cue does not take rests to fill the bar once the player has entered.

**Cue stem length:**
- Gould p. 569 says 2–2½ sp and measures 2.27–2.78 unbeamed.
- Stone p. 49 says ≈3 sp.
- G&L measures 2.29–2.59.

### B.4 A grace inside a cue

**UNKNOWN in all four books.** No sentence covers it. All of Gould's cue chapter (pp. 566–578, PDF
586–598) was searched, and it has no grace inside a cue. Nor do Ross, Stone or G&L.

### B.5 Small notes that are not cues

**Stated to be cue size:**
- G&L p. 55: *"Not all notes that are cue size are used as a cue. Ossia passages and grace notes are
  typically notated at cue size."*
- G&L p. 104: an ossia is *"cue size (65–75%)"*.
- G&L, *A cappella*: *"If cue size, the staff should be cue size also. (Cue-size notes on a full-size staff
  are not as easy to read.)"*
- G&L pp. 76–77: a harmonic's sounding note is *"cue size and in parentheses"*.

**Gould uses the one word "cue-sized" for all of these:**
- alternative rhythms, with cue-sized stems and rests (pp. 449–450, 469);
- a cappella keyboard reductions (p. 471);
- notes beyond the pianist's reach (p. 552);
- hummed pitches (p. 208);
- enharmonic helpers (p. 348);
- note-value equivalents between tempi (p. 185);
- the ossia note, *"a small note in brackets… on the same stem"* (p. 497). It measures ≈1.03–1.08 ×
  0.70 sp against a full 1.46 × 1.08 (≈0.72 / 0.65), about the same as a cue.

**Other small things:**
- **A small staff is ¾** (Gould pp. 481, 575). Ross p. 190: the small-staff ratio IS the cue ratio.
- **Editorial:** Gould p. 83 allows *"small-sized accidentals above their notes"*. No book defines an
  "editorial note" size (UNKNOWN).

### B.6 Not reachable

- **Gardner Read, Chlapík, Wanske, Powell (*Music Engraving Today*), Vienna, Hal Leonard:** UNKNOWN. None
  is on disk, and a web search found nothing citable.
- **MOLA** covers only what a cue contains (*"Cues must be audible and obvious… transposed to the reading
  key"*), with no size.
- **Holab's *Music Engraving and Copying Essentials*** gives no size either.

### B.7 Summary

| source | cue ratio, stated | cue ratio, measured | grace ratio | what scales | what stays full size |
|---|---|---|---|---|---|
| **Gould** | ¾ (p. 569); stems 2–2½ sp | **≈0.61–0.63** of the head (pp. 570–571); cue stave ≈0.73 | "slightly smaller" (p. 125); drawn the **same** as cue (≈0.62–0.64) | rests, accidentals, articulation, dynamics (p. 569); accidentals (p. 78); clef ⅔ (p. 573); beams ≈0.75 and rests ≈0.76 (measured, p. 571); ledgers thinner | the player's whole-bar rests (p. 571); the ledgers' spacing; brackets mostly ≈2 sp (pp. 139, 378), but 1.69 on p. 497 |
| **Ross** | the staff-6/7 note punch (p. 189) | staff chart 0.70–0.86; p. 190 staff 0.72, heads 0.77 | "slightly smaller than the cue" (p. 190); ≈0.57 measured | beams, by pen size (A-13) | multi-rests drawn full |
| **Stone** | none in words; stems ≈3 sp (p. 49) | ≈0.66 height (low confidence) | stems ≈2½ sp | UNKNOWN | "full-size rests" (p. 161) |
| **G&L** | 65–75% (p. 54); clef 75% (p. 51) | 0.61 / 0.71 widths; stems 0.65 / 0.73 | "cue size or slightly smaller, 65%" (pp. 72–73) | "all musical elements" (p. 54); stems and beams (p. 88); 8va (pp. 100–101) | none stated |
| MOLA, Holab | nothing on size | — | — | — | — |
| Read, Chlapík, Wanske, Powell, Vienna, Hal Leonard | UNKNOWN (not reachable) | — | — | — | — |

---

## C. Industry standards: specs, applications, publishers

This chapter is web research, with a URL for every number. Engraving books and the three open-source
engines are left to chapters A and B, except where a spec cites them. The downloaded manuals were saved
to a session scratchpad, and they are gone now.

**The short answer.** The commercial default is **cue 75% and grace 60%**. Dorico and Sibelius both
ship those numbers, and Sibelius states them in its manual. Finale is the exception: its manual gives two
different grace defaults. **No spec gives a ratio.** MusicXML carries sizes as named classes, and the
percentages live in the file's own header. A grace that is also cue is its own size class in MusicXML,
Dorico and Sibelius. In Sibelius it comes out as the product, 45%, but only a plugin author says so, not
Avid. What Dorico's "Cue grace" measures is UNKNOWN.

### C.1 Specs

**SMuFL**
- **None of the 30 `engravingDefaults` keys concerns cue, grace or small-note scaling.** The only mention
  of scaling is in `legerLineExtension`, which is *"scaled proportionally with the notehead's size, e.g.
  when scaled down as a grace note"*. <https://smufl.formats.music/latest/specification/engravingdefaults.html>
- **Glyphs with a `Small` suffix are optical-size alternates for small staves, not cue notes.** They form
  the `opticalVariantsSmall` stylistic set: *"Glyphs designed for use on smaller staff sizes"*.
  - The spec's example is Bravura's ss01, *"Smaller optical size for small staves"*: `accidentalFlatSmall`
    U+F428, `accidentalNaturalSmall` U+F429 and `accidentalSharpSmall` U+F42A.
  - The spec gives no ratio. <https://smufl.formats.music/latest/specification/sets.html>
- The recommended-characters page mentions only an alternate sharp *"designed to have a clearer
  appearance when reproduced at a small size"*, with no factor.
  <https://smufl.formats.music/latest/about/recommended-chars-optional-glyphs.html>
- ⇒ SMuFL defines no cue or grace scale factor at all.

**MusicXML 4.0**
- **`<cue/>`, a child of `<note>`, means SILENT. It is not a size:** *"a cue note is a silent note with no
  playback. Normal notes that play can be specified as cue size using the <type> element. A cue note that
  is specified as full size using the <type> element will still remain silent."*
  <https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/cue/>
- **`<type size=…>`** takes a `symbol-size` value: `full`, `cue`, `grace-cue` or `large`. When it is absent:
  - a regular note is **full**;
  - a note with `<cue>` or `<grace>`, but not both, is **cue**;
  - a note with **both** `<grace>` and `<cue>` is **grace-cue**;
  - ⇒ a plain grace note is cue-sized by default.

  <https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/type/>
- **`symbol-size` compares; it gives no ratios.** `cue` is *"generally smaller than a full-sized symbol"*,
  `grace-cue` is *"generally smaller than a cue-sized symbol"*, and `large` is *"an oversized symbol"*.
  - It is the `size` attribute of `<accidental>`, `<accidental-mark>`, `<clef>`, `<level>` and `<type>`.
  - ⇒ an accidental's size is set apart from its note's.

  <https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/symbol-size/>
- **`<defaults><note-size type=…>` is the only place a ratio lives.** It is *"the numeric percentage of the
  regular note size to use for notes with cue and large size"*, where 100 is the music font's regular
  size, and the spec states **no default number**.
  <https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/note-size/>
  - Its `type` values are `cue`, `grace` (*"notes of cue size that include a <grace> element"*),
    `grace-cue` and `large`.
  - ⇒ a grace note and a grace-cue note each get their **own** percentage. The format does not multiply
    two factors. <https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/note-size-type/>
- **`<notehead>`** has `font-size` (*"One of the CSS sizes or a numeric point size"*) and `parentheses`
  (yes/no). No cue meaning attaches to either.
  <https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/notehead/>
- **`<staff-details><staff-size>`** is how large *"a staff space is on this staff, expressed as a
  percentage of the work's default scaling"*. An optional `scaling` attribute says whether the notation
  scales too, or only the line spacing.
  <https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/staff-size/>
  - The staff type `cue`, *"A cue staff represents music from another part."*, carries no size.
    <https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/staff-type/>
- **`<grace>`** has `slash`, `steal-time-*` and `make-time`, and nothing about size.
  <https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/grace/>

**MEI v5**
- **`@cue`** (`att.cue`) is a plain yes/no, *"Attributes that describe 'cue-ness'"*, with no ratio. It is
  available on beam, beamSpan, chord, layer, mRest, note, oLayer and rest.
  <https://music-encoding.org/guidelines/v5/attribute-classes/att.cue.html>
- **`@grace`** *"Marks a note or chord as a 'grace'…"*. Its `@grace.time` is a percentage of time
  stolen, not a size. <https://music-encoding.org/guidelines/v5/attribute-classes/att.graced.html>
- **`@fontsize`** (`att.typography`) exists on note, accid, rest, chord, clef, artic and others. It takes
  points, words ("small", "larger") or a percentage *"relative to normal size, e.g., 125%"*.
  <https://music-encoding.org/guidelines/v5/attribute-classes/att.typography.html>,
  <https://music-encoding.org/guidelines/v5/data-types/data.FONTSIZE.html>
- `@scale` (a percentage) exists only on staffDef and symbol.
  <https://music-encoding.org/guidelines/v5/attribute-classes/att.scalable.html>

### C.2 Commercial applications

**Dorico (Steinberg)**
- **Defaults: cue 75%, grace 60%. The user can change both.**
  - Grace: *"grace notes are scaled to 3/5 the size of a normal notehead by default"*.
    <https://archive.steinberg.help/dorico/v1/en/dorico/topics/notation_reference/notation_reference_grace_notes_c.html>
  - The settings are Engraving Options › Notes › *Grace note scale factor* and Engraving Options › Cues ›
    *Cue note scale factor*. Scoring Notes' Dorico 1.2 review gives the cue 75% and both locations:
    *"Dorico's default values of 75% and 60%"*.
    <https://www.scoringnotes.com/reviews/dorico-1-2-review-part-1-cues-new-notation-techniques-improvements/>
  - A forum user confirms the cue default is 3/4. <https://forums.steinberg.net/t/cue-size-grace-notes/853161>
  - ⚠️ The 75% cue default was not found on a steinberg.help page.
- **Size is a property of each selection, so one note can be cue-sized without being a cue.** The *Scale*
  property offers Normal, Grace, Cue and Cue grace, and *Custom scale* is a separate percentage.
  <https://archive.steinberg.help/dorico_pro/v5/en/dorico/topics/write_mode/write_mode_editing/write_mode_notes_items_size_changing_t.html>
- **How the two combine:**
  - With both set, notes take *"the custom percentage scale size of the selected default scale size"*
    (same page). Grace plus Custom 50 is half a grace note.
  - Custom scale *"is applied on top of the current Scale value"*.
    <https://blog.dorico.com/2017/12/dorico-1-2-released-cues-percussion-fingering/>
  - Setting Scale to Cue on a passage that holds grace notes **replaces** their grace size, so they grow;
    Custom scale keeps the proportions. <https://forums.steinberg.net/t/cue-size-grace-notes/853161>
- **The size of "Cue grace" is UNKNOWN.** The preset exists; no official number was found, and nothing
  says it is 75% × 60%.
- **Spacing scales too.** The options are *"Scale space for grace notes by"* and *"Scale space for cue
  notes by"*, each ≤ 100%.
  <https://archive.steinberg.help/dorico/v1/en/dorico/topics/engrave_mode/engrave_mode_note_spacing_page_layout_options_r.html>
  The default cue spacing is 70% of normal (the Scoring Notes review above).
- **One smaller head inside a chord needs a custom notehead set with smaller symbols**, per Daniel
  Spreadbury (Steinberg). The Scale property acts on the whole note-and-stem object.
  <https://forums.steinberg.net/t/changing-the-size-of-a-note/946425>

**Sibelius (Avid)**

Source: Reference Guide 2024.3, <https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf>.
- **Defaults: cue 75%, grace 60%, both editable** under House Style › Engraving Rules › Notes and
  Tremolos: *"Grace notes are normally a bit smaller than cue notes (60% of full size instead of 75%)"*
  (manual pp. 160, 416).
- **They multiply:**
  - *"any note — whether it's a normal note, special notehead or even a grace note — can be made cue-size."*
  - *"The size of cue notes is proportional to the staff size… You can even put cue grace notes on a small
    staff, to get really, really tiny notes."*
  - The numbers come from Bob Zawalich, a plugin author, not from Avid: *"75% is the default size for a
    cue-sized note. 60% … grace note, and 45% is the size of a grace note to which cue-sizing has been
    applied."* <https://bobzawalich.com/wp-content/uploads/2019/03/How-to-use-the-Scale-Notehead-Size-plugin-in-Sibelius.pdf>
- The cue size also sets the size of a clef change. At e.g. 130%, cue notes become "big notes".
- **Cue size cannot be applied to one note of a chord.** <https://www.scoringnotes.com/tips/new-plug-in-scale-notehead-sizes/>
  - The workaround is notehead type 10, *"cue-size noteheads"*, which the manual warns *"doesn't make
    associated objects such as accidentals small too"*.

**Finale (MakeMusic, discontinued 2024)**
- **The grace size contradicts itself in the official manual:**
  - the Document Options › Grace Notes page says *"The default is 50%"*
    (<http://usermanuals.finalemusic.com/Finale2012Mac/Content/Finale/IDD_GRACENOTEOPTIONS.htm>);
  - the how-to page says *"the default reduction percentage for grace notes is 60%"*
    (<https://usermanuals.finalemusic.com/Finale2012Win/Content/Finale/Grace_notes3.htm>).
  - Either way the user can change it. A separate *Tablature Grace Note Size* is 50%.
- **There is no global cue default.** Cue notes are made with Utilities › Change › Note Size or the Resize
  tool.
  - The manual advises *"numbers between 50 and 75 generally produce good results"*, and for a cue staff
    *"60% to 75% of full size would be a typical reduction"*.
    <https://usermanuals.finalemusic.com/FinaleMac/Content/Finale/Cue_notes.htm>
  - The Smart Cue Notes and Add Cue Notes plug-ins have a *"Reduce cue noteheads / Reduce Cue To __%"*
    field whose default is UNKNOWN.
    <http://usermanuals.finalemusic.com/Finale2014Mac/Content/Finale/Smart_Cue_Notes_Plug_in.htm>
- A grace that is also cue: UNKNOWN.

**Others**
- **Notion:** cue notes *"reduce in size"* and do not play back. The size is UNKNOWN and no setting is
  documented. <https://www.manualsdir.com/manuals/854655/presonus-notion-6-notation-software-boxed.html>
- **capella:** marked notes can be formatted *"invisible or small (cue notes)"*. The percentage is UNKNOWN.
  <https://www.capella-software.com/us/assets/File/Introduction_capella-us.pdf>
- **StaffPad, Guitar Pro 8:** no cue feature was found (UNKNOWN). The GP8 manual covers grace notes with
  no size setting. <https://static.guitar-pro.com/gp8/manual/Guitar-Pro-8-user-guide.pdf>

### C.3 Publishers' house-style guidance

- **MOLA** gives **no cue percentage**
  (<https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf>).
  - Cues *"must be audible and obvious to the musician reading the part"*, and are transposed to the
    reader's key.
  - The only sizes it gives are staff heights: parts 7.5 mm (never under 7.0 mm), scores at least 4 mm.
- **Henle, Bärenreiter, Faber, Schott, Boosey:** no public style sheet with a cue percentage was found (UNKNOWN).
- **IMSLP's German typesetting guidelines:** 70% for cues (*"70% der Normalgröße für Einsätze…"*), 60% for
  graces. <https://imslp.org/wiki/IMSLP:Notensatzrichtlinien>
- **Gerou & Lusk, *Essential Dictionary of Music Notation*** (Alfred, 1996, p. 119): cue notes and *"all
  elements associated with them"* at *"65-75% of normal note size"*. ⚠️ Seen only as Wikipedia quotes it
  (<https://en.wikipedia.org/wiki/Cue_note>); chapter B reads the book itself.
- **William Holab's handout** (an engraver and publisher): solo staves above a piano are 60% of the
  standard 7 mm staff. It gives no cue-note percentage.
  <https://mostlymodernfestival.org/wp-content/uploads/sites/2/2025/12/MMP-MMF-EngravingPresentationHandout.pdf>

### C.4 A grace that is also cue

| app / spec | behaviour |
|---|---|
| MusicXML | its own class, `grace-cue`, with its own `<note-size>` percentage; no multiplication defined |
| Dorico | its own "Cue grace" preset, size UNKNOWN; Scale = Cue **replaces** a grace's size (it grows); only Custom scale multiplies |
| Sibelius | **multiplies**: 75% × 60% = 45% (from a plugin author, not Avid); a small staff multiplies again |
| Finale | UNKNOWN |

### C.5 What scales, and what does not

**Sibelius**, from the manual:
- The cue button *"will also make the stem and any accents and articulations small"*.
- *"Accidentals automatically go small on cue notes and grace notes"*.
- Rests, bar rests, text, lines and symbols can each be made cue-size. System objects cannot. Clef changes
  follow the cue size.
- Parentheses go on any head, graces included, and *"automatically adjust to enclose accidentals"*.
  Whether they shrink on a cue note is UNKNOWN.
- A cue-width ledger line exists as a symbol. Whether ledger lines themselves scale is UNKNOWN.
- Notehead type 10 (cue-size heads) does not shrink the accidentals.

**Dorico:**
- Scale acts on the whole note-and-stem object (per the forum, including Steinberg staff).
- Stems scale down in proportion and can come out too thin. This is a user's feature request, not an
  official statement.
  <https://forums.steinberg.net/t/fr-noteheads-and-stem-thickness-for-grace-notes-and-cue-sized-notes/1039673>
- Two dots at one rhythmic position cannot differ in size, which shows in two voices (a user report).
  <https://forums.steinberg.net/t/rhythm-dots-not-resizing-with-cue-sized-notes/1032211>
- In cues, the destination player's full-sized rests show by default (Dorico 1.2 blog).

**Finale:** clicking the stem resizes *"the note or chord, stem, flag, lyric, articulations, and any notes
beamed to it"*; clicking a notehead resizes that head alone.
<http://usermanuals.finalemusic.com/Finale2012Win/Content/Finale/Note_size2.htm>

**Specs:** in SMuFL, the ledger extension scales with the notehead. In MusicXML, an accidental carries its
own `size`.

**Beams on cue notes:** none of these sources documents them (UNKNOWN).

### C.6 Summary

| app / spec | cue % | grace % | grace + cue | editable? | source |
|---|---|---|---|---|---|
| SMuFL | none | none | none | n/a | [engravingDefaults](https://smufl.formats.music/latest/specification/engravingdefaults.html) |
| MusicXML 4.0 | `<note-size type="cue">`, no default | `type="grace"`, no default; a plain grace is cue-sized | own class `grace-cue`, own % | per file | [note-size](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/note-size/) |
| MEI v5 | `@cue` flag, no ratio; `@fontsize` may carry a % | `@grace`, no size | not defined | per element | [att.cue](https://music-encoding.org/guidelines/v5/attribute-classes/att.cue.html) |
| Dorico | 75 (Scoring Notes; forum 3/4) | 60 (3/5, official) | "Cue grace" preset, UNKNOWN; Custom scale multiplies | yes | [review](https://www.scoringnotes.com/reviews/dorico-1-2-review-part-1-cues-new-notation-techniques-improvements/), [manual](https://archive.steinberg.help/dorico/v1/en/dorico/topics/notation_reference/notation_reference_grace_notes_c.html) |
| Sibelius | 75 | 60 | multiplies → 45 | yes | [manual](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf), Zawalich |
| Finale | no global default; manual advises 50–75 (cue staff 60–75) | 50 or 60 (the manual contradicts itself) | UNKNOWN | yes | [grace options](http://usermanuals.finalemusic.com/Finale2012Mac/Content/Finale/IDD_GRACENOTEOPTIONS.htm), [grace notes](https://usermanuals.finalemusic.com/Finale2012Win/Content/Finale/Grace_notes3.htm) |
| Notion | UNKNOWN (notes shrink) | UNKNOWN | UNKNOWN | UNKNOWN | [manual](https://www.manualsdir.com/manuals/854655/presonus-notion-6-notation-software-boxed.html) |
| capella | UNKNOWN ("small" exists) | UNKNOWN | UNKNOWN | UNKNOWN | [intro](https://www.capella-software.com/us/assets/File/Introduction_capella-us.pdf) |
| StaffPad / Guitar Pro 8 | none found | UNKNOWN | UNKNOWN | UNKNOWN | [GP8 manual](https://static.guitar-pro.com/gp8/manual/Guitar-Pro-8-user-guide.pdf) |
| MOLA | none given | none | none | n/a | MOLA PDF above |
| IMSLP German guidelines | 70 | 60 | none | n/a | [Notensatzrichtlinien](https://imslp.org/wiki/IMSLP:Notensatzrichtlinien) |
| Gerou & Lusk (via Wikipedia) | 65–75 | none | none | n/a | [Cue note](https://en.wikipedia.org/wiki/Cue_note) |
