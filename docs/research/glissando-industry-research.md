# Glissando / bend / slide notes — the industry survey

> **Findings only**, in the manner of `docs/research/cue-size-research.md`. ⛔ Nothing here is a
> decision, and no file is named to edit. The feature (a GLISSANDO / BEND tool: a line from a note to
> another note, or to NOTHING, modelled on Sibelius 6's "bend" line but richer, with optional text such
> as "gliss." that is off by default and turned on from Properties) has no plan yet. When it has one,
> the choices are made in the plan, and this file is one of its lists of options.
> ⚠️ A research file does not know what was DECIDED.
>
> Written 2026-09-25 from the web: the MusicXML 4.0, MEI 5 and SMuFL specifications, the Sibelius
> reference manuals (6, 8.6 What's New, 2024.3), the Dorico manuals (1.2 PDF, the v3.5 and v5 help
> archives, the 6.2.30 version history), the Finale user manuals and the MuseScore Studio handbook.
> Where the handbook was thin, MuseScore's SOURCE on disk (`~/dev/engine-sources/MuseScore`, commit
> `929d1e9`, 2026-08-18) was read for the numbers. Every claim carries its URL or path.
> **UNKNOWN** marks what could not be reached. It does NOT mean "the source is silent".
>
> §0 is the synthesis. §1–§5 are the evidence. §6 is the case the coordinator added mid-survey: a
> line from NOTHING into a note.

## 0. Synthesis

### 0.1 ⭐ Every app and standard splits this into TWO kinds of object

| | between two notes | one note, the other end free |
|---|---|---|
| MusicXML | `<glissando>`, `<slide>` (start/stop **pair**), `<bend>` | `<falloff>` `<doit>` (after) · `<scoop>` `<plop>` (before) — **articulations** |
| MEI | `<gliss>` (control event, start + end) | `@artic` = `doit` `fall` `plop` `scoop` `rip` `flip` `smear` `bend` |
| Sibelius | gliss/port. **line** (magnetic since 8.6); guitar bend (`J`) | plop/scoop/doit/fall on Keypad F11 (**symbols**); *long* fall = the wavy gliss line |
| Dorico | glissando line (two notes; "cannot input a glissando line on the last note in a staff") | jazz articulations, stored on the note (one **In**, one **Out**) |
| Finale | Smart Shape glissando / tab slide / bend hat | articulations (UNKNOWN in detail) |
| MuseScore | `Glissando` (a spanner between two notes) | `ChordLine`: FALL/DOIT/PLOP/SCOOP × {curved, straight, wavy} |

⇒ Nobody's glissando TOOL draws to nothing. The line that ends in the air is a separate item that
belongs to ONE note, with a SIDE (before or after), a DIRECTION (up or down), a SHAPE (curved,
straight or wavy) and a LENGTH. The length is either a coarse class (MusicXML's and SMuFL's
short/medium/long) or a free vector (MuseScore's `lengthX`/`lengthY`).
- ⚠️ The one exception is Sibelius 6, and it is the one we model: its lines were PLAIN lines, each end
  attached separately to a rhythmic position, so an end could be dragged anywhere (§2.1). Sibelius
  also lets a guitar **bend** end on its own note, which draws a "slight bend" (§2.3).

### 0.2 The properties every app offers

| property | Sibelius (8.6+) | Dorico | MuseScore | Finale | MusicXML | MEI |
|---|---|---|---|---|---|---|
| line style | Glissando (straight) · (wavy) · Line · Portamento (+ custom) | Straight · Wavy (+ any line style, 6.2.30) | Straight · Wavy; solid/dashed/dotted | Solid · Dashed · Character | `line-type` solid/dashed/dotted/**wavy** | `@lform` |
| text on/off | **Auto** / On / Off | Show if sufficient space / Always | Show text (only if room) | text slots on the Smart Line | text content | text content |
| text content | edit the line style ("Centered Text") | Gliss / Port / No text | free text (default `gliss.`) | Left start · Left cont. · Right end · Center full · Center abbr. | the element's string | `<gliss>` content |
| end offsets | Slide ends LX LY RX RY (spaces) | Start offset X/Y, End offset X/Y | edit handles | Start/End Point H/V | `default-x/y` | `startho/vo`, `endho/vo` |
| thickness | via the line style | Engraving Options | `glissandoLineWidth` **0.15 sp** | Smart Shape line thickness | — | `@lwidth` |
| across a system break | segments move separately | segments move separately; the text repeats on every segment | — | — | — | — |
| playback | type + Early/Late/Linear | Continuous · Chromatic · White notes; delayed start | Chromatic · White · Black · Diatonic · Portamento | Human Playback | — | `att.gliss.ges` |

⭐ **The text is "auto" everywhere.** It shows when the line has room (Sibelius also weighs the angle)
and can be forced on or off. It is the only property all four apps share with the same meaning.
Sibelius writes the text "at an angle along its length", that is, along the line.

### 0.3 The gestures used to create one

- **Select a note, apply the tool → the line goes to the NEXT note.** Sibelius (`L`, then pick the gliss
  line), Dorico (popover `gliss` / `glisswavy`, or the Ornaments panel), MuseScore (palette), Finale
  (double-click the note). Every app has this, and every app makes it the default.
- **Select TWO notes → the line joins them**, even across other notes, rests, voices or staves:
  Dorico, and MuseScore through its handles.
- **Apply with NOTHING selected → a free line placed with the mouse.** Sibelius creates a
  non-magnetic line this way. Its ends do not snap to notes and are not positioned automatically.
- **Drag an end handle.** Sibelius: arrows, and Ctrl/Cmd for bigger steps. Dorico: Alt+arrows in Engrave
  mode; this is graphical only, and the rhythmic ends cannot be moved. MuseScore: Shift+arrow moves
  the end to the nearest note in that direction, and a plain drag or plain arrows move the free end
  of a fall or scoop.
- **Extend or retract a note at a time.** Sibelius: Space / Shift+Space. Retracting a guitar bend onto
  its own note makes the slight bend.

### 0.4 Numbers found (⛔ none decides anything; each is one house's DEFAULT)

| number | value | source |
|---|---|---|
| gliss line thickness | 0.15 sp | MuseScore `glissandoLineWidth` |
| min straight gliss length | 1.2 sp | MuseScore `minStraightGlissandoLength` |
| min wiggly gliss length | 2.0 sp | MuseScore `minWigglyGlissandoLength` |
| gliss text | italic, 8 pt, "gliss." | MuseScore `glissandoFontStyle/Size/Text` |
| fall/doit/scoop/plop default vector | 1.2 sp across × 1 sp high (× the chord's size) | MuseScore `layoutChordLine` |
| its gap from the head | ⅓ sp across; starts ¼ sp above or below the head's centre | MuseScore `layoutChordLine` |
| bend/slide timing | starts at 25 %, ends at 75 % of the note | MusicXML `first-beat`/`last-beat` defaults |
| gliss playback start | halfway through the note | Dorico playback page |
| SMuFL `engravingDefaults` gliss thickness | **none defined** | SMuFL spec (§1.3) |
| Dorico gap from the head, thickness, minimum spans | **UNKNOWN**: the manual describes the options but lists no values | §3 |

## 1. Standards

### 1.1 MusicXML 4.0

- **`<glissando>`**, child of `<notations>`. Its content is optional text "printed alongside the
  glissando line". `type` start/stop is required. `number` defaults to 1 and tells overlapping
  glissandi apart. `line-type` is solid, dashed, dotted or wavy, with `dash-length`/`space-length`,
  `default-x/y`, `relative-x/y`, font attributes and `color`. "A `<glissando>` sounds the distinct
  notes in between the two pitches and **defaults to a wavy line**."
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/glissando/
- **`<slide>`** has the same shape plus playback attributes: `accelerate` (no), `beats` (4),
  `first-beat` (25), `last-beat` (75). It is a continuous slide and "**defaults to a solid line**".
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/slide/
- ⚠️ Both come as a START/STOP PAIR on two notes. MusicXML has **no** glissando with a free end.
- **`<bend>`** (guitar): `<bend-alter>` in semitones (decimals allowed; negative for a release), then
  optionally `<pre-bend/>` or `<release/>`, then `<with-bar>`. `shape` is `angled` (standard notation)
  or `curved` (tab, and sometimes standard). It has the same `first-beat`/`last-beat`/`accelerate`/`beats`.
  A bend and release are two `<bend>` elements on the one note. ⭐ **A bend belongs to one note**: its
  amount is a number, not a second note.
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/bend/ ·
  …/elements/bend-alter/ · …/data-types/bend-shape/
- **`<falloff>` `<doit>` `<scoop>` `<plop>`** are children of `<articulations>` and always empty.
  Each is "an indeterminate slide attached to a single note":
  - doit: "appears **after** the main note and goes **above** the main pitch"
  - falloff: after, below
  - scoop: "appears **before** the main note and comes from **below**"
  - plop: before, from above

  Attributes: `line-shape` (straight/curved), `line-type`, `line-length` (**short / medium / long**,
  a token, not a measure), placement and position.
  …/elements/falloff/ · …/elements/doit/ · …/elements/scoop/ · …/elements/plop/ · …/data-types/line-length/

### 1.2 MEI 5

- **`<gliss>`** is a control event. It needs one START (`@startid`, `@tstamp`, `@tstamp.ges` or
  `@tstamp.real`) and one END (`@endid`, `@tstamp2`, `@dur` or `@dur.ges`). ⭐ Because either end may
  be a TIME STAMP rather than a note, MEI can encode a gliss that begins or ends at no note.
  Visual attributes: `@lform` (solid/dashed/dotted/wavy), `@lwidth`, `@lstartsym`/`@lendsym` (an arrow
  or similar at an end), `@lsegs`, `@startho/@startvo/@endho/@endvo`, `@x/@y/@x2/@y2`, and font attributes.
  Content: text and phrase-level elements (the "gliss." label).
  https://music-encoding.org/guidelines/v5/elements/gliss.html ·
  https://music-encoding.org/guidelines/v5/attribute-classes/att.gliss.vis.html
- **`<bend>`** is "a variation in pitch (often micro-tonal) upwards or downwards during the course of
  a note". It takes `@amount` (the detuning), `@startid` + `@endid`/`@dur`/`@tstamp2`, and curve
  attributes (`@bezier`, `@bulge`, `@curvedir`).
  https://music-encoding.org/guidelines/v5/elements/bend.html
- **The one-note family is ARTICULATION values**, not elements: `doit`, `fall`, `plop`, `scoop`,
  `rip` ("long slide from lower, often indeterminate pitch; also known as 'squeeze'"), `flip`, `smear`,
  and `bend` (MEI's `bend` artic is the brass "lip slur to lower pitch, then return").
  https://music-encoding.org/guidelines/v5/data-types/data.ARTICULATION.html

### 1.3 SMuFL

- **Glissando line**: `wiggleGlissando` U+EAAF in *Multi-segment lines*. The segments tessellate, and
  "scoring applications can combine these glyphs to produce lines of varying lengths". Also
  `wiggleGlissandoGroup1–3` (U+EABD–EABF) and the wavy, sawtooth and square-wave families.
  https://smufl.formats.music/latest/tables/multi-segment-lines.html (redirected from
  w3c.github.io/smufl, which now 301s to smufl.formats.music)
- **Precomposed** `glissandoUp` U+E585 and `glissandoDown` U+E586 (also U+1D1B1/U+1D1B2) sit in
  *Other baroque ornaments*. Fixed size, so no use for a line of variable length.
  https://smufl.formats.music/latest/tables/other-baroque-ornaments.html
- **Brass techniques**: `brassScoop` E5D0 · `brassLiftShort/Medium/Long` E5D1–3 · `brassDoitShort/Medium/Long`
  E5D4–6 · `brassFallLip…` E5D7–9 · `brassFallSmooth…` E5DA–C · `brassFallRough…` E5DD–F · `brassPlop` E5E0 ·
  `brassFlip` E5E1 · `brassSmear` E5E2 · `brassBend` E5E3 · `brassLiftSmooth…` E5EC–EE. ⭐ The lengths are
  the same three steps as MusicXML's `line-length`, as fixed glyphs.
  https://smufl.formats.music/latest/tables/brass-techniques.html
- **Guitar**: `guitarVibratoBarScoop` / `…Dip` (U+E830–1). A bend or slide LINE has no glyph and is drawn.
  https://smufl.formats.music/latest/tables/guitar.html
- **`engravingDefaults`**: ⛔ **no glissando key.** Line keys exist for `octaveLineThickness`,
  `pedalLineThickness`, `repeatEndingLineThickness`, `lyricLineThickness`, `arrowShaftThickness`,
  `hairpinThickness`, `tupletBracketThickness` and others, but none for a gliss.
  https://smufl.formats.music/latest/specification/engravingdefaults.html
- The SMuFL glyph-table index page could not be read (the fetch returned only the page header), so a
  "Glissandi" range, if one exists, is **UNKNOWN**. The ranges above were read directly.

## 2. Sibelius

### 2.1 Sibelius 6 (2009): lines are PLAIN, and each end is attached on its own

The Reference manual, edition 6 (April 2009), §2.21 *Lines*
(http://hub.sibelius.com/download/documentation/pdfs/sibelius6-reference-en.pdf):
- "Usually a gliss. line is straight and includes the word gliss. at an angle along its length
  (although Sibelius automatically omits the word if the line isn't long enough), or sometimes the line
  is wiggly instead. Portamento (port.) is similar but is usually only represented by a straight line."
- There was no text on/off property yet: "edit the port. line and remove the text, and use that as a
  textless gliss. line".
- The wiggle's thickness is chosen in Edit Lines, from the Style drop-down.
- Creation, shared by all lines: select a note or passage and the line goes there; or press Esc and
  place it with the mouse. "To extend the line rightwards a note at a time, hit space … Shift-space"
  retracts it. "You can also drag either end of a line with the mouse." With an end selected, the
  arrows nudge it, and Ctrl gives bigger steps.
- ⭐ "Basically, **both ends of a line are independently attached to a note or other rhythmic
  position**, so if you change the spacing of notes then any lines in the vicinity will expand or
  contract." The gliss did **not** follow pitch: an end sat at a rhythmic position with a free y. This
  is what let a S6 gliss end in the air.
- Forum, Sibelius 6.x: to slide INTO a note from nothing, "if you want playback, you'll need a hidden
  note to define the start point" (there was no free-start object).
  https://www.sibelius.com/cgi-bin/helpcenter/chat/chat.pl?com=thread&start=663260&groupid=3&guest=1
- Playback (§4.2, p. 265): "defaulting to an appropriate kind of glissando for the instrument…
  chromatic steps for wind…, continuous slide for strings". Glissando type, and for Continuous,
  Early / Late / Linear.

### 2.2 Sibelius 8.6 (2017) onwards: the magnetic gliss belongs to the NOTE

What's New 8.6 (https://resources.avid.com/SupportFiles/Sibelius/8.6/Whats_New.pdf, ch. 8):
- "glissandi lines are now magnetic — intelligently snapping to the next note — and avoid collisions
  with rhythm dots and accidentals by changing their start and end points automatically."
- Create: select a note (or a grace note), then `L` → the gliss line; "This draws a glissando line to
  the next note. During note input, glissando lines automatically continue to follow the pitch of the
  next note." ⭐ **Non-magnetic** gliss: create it with nothing selected; it "does not snap to notes and
  is not positioned automatically" (this is the S6 behaviour, kept).
- Inspector › Lines: **Slide ends** LX, LY, RX, RY (offsets of the start and end, in spaces) · **Slide
  style**: Glissando (straight), Glissando (wavy), Line, Portamento, plus custom · **Slide text**: Auto
  ("shows or hides text based upon the length and angle of the line") / On / Off.
- Text content: Edit Lines › the line › **Centered Text**.
- ⭐ ManuScript stores it as `note.SlideStyleId` (for example `"line.staff.gliss.straight"`). That is, a
  magnetic gliss is a **property of its start note**, not a free line object.
- A plug-in converts old non-magnetic glisses to magnetic ones:
  http://www.sibelius.com/download/plugins/index.html?plugin=554

The 2024.3 Reference (https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf,
§4.6 *Glissandi*, p. 350) repeats this and adds that the text is shown or hidden "with consideration to
the available space around it".

### 2.3 Sibelius guitar bends, slides and the jazz articulations (identical in 6 and 2024.3)

- **Bend** (`J`): "on notation staves, a bend is drawn as an angled line between two notes, a bit like
  a crooked slur". Magnetic. Space/Shift+Space extend or retract it, X flips it, and Alt+arrows walk left
  end → middle → right end, each point then nudged. The bend interval is set by the SECOND NOTE's pitch.
  ⭐ "To create a slight or microtonal bend, create a bend on a note and type Shift-space to retract the
  right-hand end so that it attaches to the **same note** as the left-hand end. A slight bend is drawn as
  a **curved line**." So a bend to nothing is a bend whose two ends sit on one note.
  Pre-bends and grace-note bends use a (pre-bend) grace note plus `J`. Release = a second, downward bend.
- **Slide** (Keypad F8, `.`): shift slide = a straight line; legato slide = the line plus a slur;
  "Slides are magnetic … adjust their position by selecting either end and moving the handle".
- **Plop, scoop, doit, fall**: Keypad F11 (keys 5, 7, 9, 8). Applied to a chord they reach every note,
  "taking into account … backnotes … rhythm dots". Alt+Shift+←/→ moves one horizontally. Engraving
  Rules › Jazz Articulations holds their horizontal and vertical positions, "with separate settings for
  notes on lines and spaces". They are SYMBOLS attached to the note, with no length handle.
  ⭐ "To create a **long fall**, use the **wavy glissando line**." So the long, free-ended case is
  already drawn with the gliss tool.
- Flip = the guitar-bend line (`J`). Bend or smear = a symbol.

## 3. Dorico

From the Dorico 1.2 Operation Manual (https://blog.dorico.com/wp-content/uploads/2017/12/dorico_en_1.2_22_12_17.pdf,
pp. 476–484), the v5 help archive
(https://archive.steinberg.help/dorico_pro/v5/en/dorico/topics/notation_reference/notation_reference_glissando_lines/notation_reference_glissando_lines_c.html
and its sub-pages) and the 6.2.30 version history
(https://blog.dorico.com/wp-content/uploads/2026/06/Dorico_6.2.30_Version_History.pdf):

- **Conventions** (manual, "General placement conventions"): the line runs between the noteheads and
  "must accurately match the interval between the pitches". "The endpoints … must be **directly beside
  noteheads but not directly touching them**." It "must not collide with accidentals, but should instead
  stop short so the accidental can be clearly read". It may cross system and page breaks, and ⭐ "if text
  is shown … **that text is shown on every part** of the glissando line".
- **Input**: select the start note, then the ornaments popover `gliss` / `glisswavy` (in later versions
  also `port`) or the Ornaments panel. "It starts from the selected note and ends at the next note."
  "**You cannot input a glissando line on the last note in a staff**", so there is no free end.
  Selecting two notes joins them, "even if there are rests or other notes between them, and including
  between notes in different voices and notes on different staves" (v5). The line "does not
  automatically adjust around any notes or rests between".
- **Properties** (Glissando Lines group): **Glissando style** Straight / Wavy; **Glissando text** Gliss /
  Port / No text; **Glissando text shown** "Show if sufficient space" / "Always show"; **Start offset**
  and **End offset**, each X and Y (Engrave mode); since 6.2.30, **Line style** (any project line
  style). The text is hidden automatically on fretted-instrument staves.
- **Engrave mode**: "two square handles, one at the start and one at the end". Each can be dragged or
  moved with Alt+arrows (Ctrl/Cmd for bigger steps). This changes the angle and graphical length, but
  "you cannot move glissando lines rhythmically". Segments on either side of a break move separately.
- **Engraving Options › Glissando Lines** exist for "style, appearance, and thickness … precise
  positions for the endpoints … relative to noteheads", and for **minimum spans** where "glissando
  lines cover a small pitch range [and] the angle … can be quite shallow" (e.g. "notes in the same
  staff space"). ⛔ **The numeric defaults are UNKNOWN**: neither the manual nor the help pages list
  them, and none were found on the forum
  (https://forums.steinberg.net/t/thickness-of-glissando-line/782750).
  6.2.30: "Draw wiggly glissando lines using" chooses the old default wiggle (the fastest or
  narrowest trill wiggle glyph) or a line style; new projects use "Wiggly line horizontal".
- **Playback**
  (https://archive.steinberg.help/dorico/v5/en/dorico/topics/notation_reference/notation_reference_glissando_lines/notation_reference_glissando_lines_playback_r.html):
  - Continuous (pitch bend): brass, singers, electronics, strings
  - White Notes: keyboards, pitched percussion
  - Chromatic: everything else

  "Glissandos start sounding **halfway** through their duration." A *Delayed start* option exists.
- **Jazz articulations** are Dorico's separate one-note family
  (https://archive.steinberg.help/dorico/v3.5/en/dorico/topics/notation_reference/notation_reference_jazz_articulations/notation_reference_jazz_articulations_c.html):
  - before the note: plop (from above) and scoop/lift (from below)
  - after the note: doit and fall
  - style: **bend** (curved, "similar to a slur") or **smooth** (straight: solid, dashed or wavy)
  - ⭐ "Each note accommodates **one articulation before and one after** it."
  - the after-note ones have lengths: v4 "Changing the type/length…", e.g. "a smooth doit to a long bend
    doit", set by the **In** / **Out** properties
  - the line style of a smooth one is its own property: *In line style* / *Out line style*, Straight /
    Wavy / Dashed

  https://archive.steinberg.help/dorico_pro/v2/en/dorico/topics/notation_reference/notation_reference_jazz_articulations_line_style_changing_t.html ·
  https://steinberg.help/dorico/v4/en/dorico/topics/notation_reference/notation_reference_jazz_articulations/notation_reference_jazz_articulations_type_length_changing_t.html
- **Guitar bends**: "each guitar bend joins two notes: the start pitch and the pitch at the peak".
  **Post-bends** are "properties attached to individual notes": a curved arrow and an interval, drawn on
  one note with no target.
  https://archive.steinberg.help/dorico/v3.5/en/dorico/topics/notation_reference/notation_reference_guitar_bends/notation_reference_guitar_bends_post_c.html
- A guitar "slide in" line in Dorico: only forum reports were found, of a *Slide in* FINGERING
  property (https://forums.steinberg.net/t/guitar-slide-in-notation/739488). Its official behaviour is
  **UNKNOWN**.

## 4. Finale and MuseScore

### 4.1 Finale

(MakeMusic ended Finale's development in 2024. It is included for its UX.)
- Glissando = a Smart Shape: "Double-click on the starting note, then drag diagonally", or
  double-click a note for the next one. **Diamond handles** "adjust the length and angle", and a square
  handle moves the whole shape.
  https://usermanuals.finalemusic.com/Finale2014Win/Content/Finale/Glissandos.htm
- Smart Shape Placement: the glissando attaches to the **notehead** at both ends, with Start/End Point
  H/V offsets. The **Tab slide** has nine contexts: Same/Different vertical position × Lines/Spaces ×
  Increasing/Decreasing pitch, plus Same Pitch.
  https://usermanuals.finalemusic.com/FinaleWin/Content/Finale/SLURPLAC.htm
- The line's look comes from the Smart Line style: Solid / Dashed / **Character** (a repeated glyph,
  for the wavy one); text slots **Left Start · Left Continuation · Right End · Center Full · Center
  Abbr.**; an optional "Horizontal"; arrowheads or hooks at the ends.
  https://usermanuals.finalemusic.com/Finale2014Mac/Content/Finale/SSLINESTYLEDLG.htm
- Bend Hat and Guitar Bend are their own Smart Shape tools.
  http://usermanuals.finalemusic.com/Finale2012Win/Content/Finale/Bend_hats.htm
- How Finale's falls and doits are stored and edited: **UNKNOWN** (not reached).

### 4.2 MuseScore Studio

- Handbook (https://handbook.musescore.org/notation/expressive-markings/arpeggios-and-glissandos):
  - add: "Select one or more start notes; click on the desired glissando icon … created extending to
    the **next note in the same voice**", or drag it from the palette. It can cross staves.
  - look: Straight / Wavy; for straight, the thickness and continuous/dashed/dotted
  - text: Show text, custom text, default "gliss."; "Text appears only if space permits"
  - playback: Chromatic, White keys, Black keys, Diatonic, Portamento
  - editing: Shift+arrows move an end handle "one note at a time", across voices and staves
- Source defaults (`src/engraving/style/styledef.cpp`, lines 614–615 and 1568–1591):
  - thickness: `glissandoLineWidth` 0.15 sp
  - minimum lengths: `minStraightGlissandoLength` 1.2 sp, `minWigglyGlissandoLength` 2.0 sp
  - text: `glissandoText` "gliss.", italic 8 pt, `glissandoShowText` true
  - style and type: `glissandoType` STRAIGHT, `glissandoStyle` CHROMATIC (harp: DIATONIC)
- **Fall/doit/plop/scoop** (handbook, same page): "Falls and doits come after the notehead, plops and
  scoops go before it"; "four adjustment handles … drag … until you get the shape you want"; they play back.
  Source: `ChordLine` (`src/engraving/dom/chordline.h`) = `ChordLineType` (FALL, DOIT, PLOP, SCOOP) +
  `straight` + `wavy` + **`lengthX`, `lengthY`** (a free vector from the note) + `playChordLine`.
  The palette makes each type in three forms: curved, straight and wavy
  (`palette/internal/palettecreator.cpp:1035–1063`). ⭐ The **straight** ones are the handbook's guitar
  "slide in / slide out"
  (https://handbook.musescore.org/idiomatic-notation/guitar/guitar-techniques: "Glissando-type slides
  … run from one note or chord to the next, and In/Out slides … played before or after a note").
  So MuseScore's free-ended slide is the SAME object as its jazz fall, not a gliss.
  - Default vector: 1.2 sp across by 1 sp high, scaled by the chord's size. Placed ⅓ sp from the chord
    and ¼ sp off the head's centre (`rendering/score/tlayout.cpp:1660–1689`).
  - A drag may not flip it into another type: `chordline.cpp:102–111` clamps each type's grip at 5 units.
- Guitar bends (4.2+): "most bends connect two notes … **slight bends are the exception**: they do not
  connect to an arrival note" (always ¼ tone). The amount is set by the arrival pitch or the
  bend-graph property.
  https://handbook.musescore.org/idiomatic-notation/guitar/guitar-bends

## 5. What the apps agree on (the evidence for §0.2–0.3)

- **The default look.** Straight + "gliss." in Sibelius, Dorico and MuseScore; MusicXML's default is
  wavy. So the default differs between the apps and the exchange format.
- **Where the text sits.** Along the line, at its angle (Sibelius says so outright; MuseScore's text
  follows the line). The rule for too short is the same everywhere: hide the text. Dorico repeats it on
  every system segment.
- **The end at a note.** It stands beside the head, not touching it, and stops short of an accidental
  (Dorico's conventions, Sibelius's magnetic line, Finale's notehead connection).
- **Following pitch.** The line re-aims when a pitch changes in Dorico, Sibelius 8.6+ and MuseScore.
  It did **not** in Sibelius 6, whose ends were rhythmic positions with a free y.
- **Offsets.** Always a pair of (x, y) offsets, one per end: Sibelius LX/LY/RX/RY, Dorico Start/End
  offset X/Y, Finale Start/End H/V, MEI `startho/vo`/`endho/vo`.
- **Gliss vs portamento.** In every app the two differ only by a style or text value on ONE object,
  not by two tools.

## 6. From NOTHING into a note (the coordinator's addition)

The question: how is a free START stored and edited (its length, angle, pitch distance), and is it the
same tool as the gliss?

| | stored as | the free end is | same tool as the gliss? |
|---|---|---|---|
| MusicXML | `<scoop>` (from below) / `<plop>` (from above), in `<articulations>` on the TARGET note | `line-length` short/medium/long + `line-shape` + `line-type`; no pitch, no angle | **No.** `<slide>`/`<glissando>` need a start note |
| MEI | `@artic` `scoop` / `plop` / `rip` on the note; or a `<gliss>` whose start is a `@tstamp` | none (artic); a time plus `@startvo` (gliss) | the articulation: no; the `<gliss>` with a tstamp start: yes |
| SMuFL | `brassScoop`, `brassPlop`, `brassLift{Short,Medium,Long}`, `brassLiftSmooth…` | a fixed glyph per length | — |
| Sibelius | plop / scoop **symbols** (Keypad F11) on the note; positions from Engraving Rules (lines vs spaces) | horizontal nudge only | **No.** In S6 a "slide into a note" needed a hidden start note, or a non-magnetic line placed by hand |
| Dorico | the **In** jazz articulation on the target note (plop; scoop/lift), bend or smooth style, *In line style* | a type and length class; handles in Engrave mode | **No.** Glissandi need two notes |
| MuseScore | `ChordLine` PLOP/SCOOP, curved / straight (= guitar "slide in") / wavy, on the target note | a free vector **`lengthX`, `lengthY`** from the note, dragged with handles; a type cannot flip into another | **No**, but it is the SAME object as fall/doit (the after-note ones) |
| Finale | UNKNOWN | UNKNOWN | UNKNOWN |

⇒ Everyone treats a free start as the MIRROR of a free end: the same one-note object with its side
flipped (MuseScore `isToTheLeft()`, Dorico In vs Out, MusicXML's four before/after × above/below
elements). Its length is a class (short/medium/long) in the standards and Dorico, and a free (x, y)
vector in MuseScore. **No one stores a pitch** for the free end. It is an "indeterminate pitch" by
definition (MusicXML, MEI and Sibelius all use that phrase).

## 7. What the plan should take from this

1. **Decide how many objects there are.** The industry has TWO: a note-to-note line and a one-note,
   free-ended mark. Sibelius 6's plain line did both jobs by leaving each end free. A single "gliss/bend"
   object whose far end is *either* a note *or* a free (dx, dy) would match Sibelius 6, and MEI's `<gliss>`
   with a `@tstamp` end. But on MusicXML export it has to split: a note end becomes `<glissando>`/`<slide>`,
   and a free end becomes `<falloff>`/`<doit>`/`<scoop>`/`<plop>` with a `line-length`.
2. **Treat a free START and a free END as one mark with a side** (before / after), as MuseScore, Dorico
   and MusicXML all do. The free end is a vector from the note, not a pitch.
3. **The property set the apps share**:
   - style (straight / wavy; portamento as a style or text value, not a second tool)
   - text Auto / On / Off with the content editable ("gliss.", "port.", custom); ⭐ "off by default"
     means Off by default, where every app defaults to Auto
   - a per-end (x, y) offset
   - separate segments across a system break, with the text repeated on each
   - playback as its own property
4. **Gestures to copy**: select a note + tool → the line goes to the next note in the same voice; select two
   notes → join them; with nothing selected → a free line; drag or arrow an end handle, and Shift+arrow
   hops the end note to note (MuseScore); Space / Shift+Space to extend or retract, and retracting onto its
   own note gives the "slight bend" (Sibelius).
5. **Engraving numbers are DEFAULTS, and none blocks the work** (CLAUDE.md). Rows to start from:
   - thickness 0.15 sp, min straight 1.2 sp, min wavy 2.0 sp, text italic "gliss." (MuseScore)
   - a free end of 1.2 × 1 sp, ⅓ sp off the head (MuseScore)
   - the end beside the head but not touching it, stopping short of accidentals (Dorico)

   The wave is `wiggleGlissando` U+EAAF, tessellated; SMuFL gives no thickness, so the thickness is our
   row. Dorico's own numbers are UNKNOWN and are a follow-up for the book research, not a blocker.
6. **Following pitch**: modern apps re-aim the line when a pitch changes. Sibelius 6's did not. If the
   Sibelius 6 model is followed literally, say in the plan which of the two behaviours is meant.
