# Free symbols anchored to a note — the standards, the commercial editors, the books

> **Findings only**, in the manner of `docs/research/staff-label-industry-research.md`. ⛔ Nothing here is a
> decision. ⚠️ A research file does not know what was DECIDED.
>
> Written 2026-09-28 for the Symbols window's *"Add symbol"* (a generic SMuFL glyph anchored to the selected
> note or rest, any number per note). Sources: the MusicXML 4.0 and MEI 5 specifications, the SMuFL spec
> (`smufl.formats.music/latest/print.html`, the one route that serves it — `reference/README.md`), the
> **Sibelius Reference Guide 2024.3** (PDF, downloaded; **printed page = PDF page − 5**), the Finale user
> manuals, the Dorico help archive and Steinberg forums, the MuseScore Studio handbook, the MuseScore and
> Verovio source checkouts in `~/dev/engine-sources` (MuseScore `929d1e9`, Verovio `efff0bc`, both
> 2026-08-18), and Gould / Stone / Ross / Gerou & Lusk on disk. Every claim carries its URL or book + printed
> page. **UNKNOWN** marks what could not be verified; it does NOT mean the source is silent.
>
> ⚠️ The ORDER / SIDE / DISTANCE of typed articulations is `docs/research/articulation-research.md` — referenced
> here, not repeated.

## 0. Synthesis

- ⭐ **Two anchoring models, and every product picks one.**
  - **Owned by the NOTE (or rest)** — the symbol is a child of the note, follows its pitch, dies with it:
    **MuseScore** (a Symbol dropped on a note becomes the NOTE's child; on a rest, the REST's — §4),
    **Finale** articulations (*"An articulation must be attached to a note (or a rest)"* — §3), MusicXML's
    `<notations>` family (`<other-notation smufl=…>`), MEI's `<artic glyph.name=…>` inside a `<note>`.
  - **Owned by a RHYTHMIC POSITION on a staff** — the symbol keeps its x but not the note's pitch:
    **Sibelius** symbols (*"attach to staves and rhythmic positions"*, and a sharp next to a note *"won't move
    vertically if the note is dragged up or down"* — §1), **Dorico** playing techniques (§2), MusicXML's
    `<direction>` family (`<symbol>`, `<other-direction smufl=…>`), MEI `<dir>` / `<ornam>` with `@startid`
    or `@tstamp`.
- ⭐ **A generic symbol is "non-functional" in both editors that have one.** MuseScore: items in the Symbols
  palette *"are for display purposes only and have no other effect on the score"*; Sibelius: *"their IQ is
  not as high as that of other objects"* — no playback, no transposition, no following the pitch. Only
  Sibelius offers a way to give a symbol playback (the Playback Dictionary).
- ⭐ **SMART placement exists only where the glyph is declared an ARTICULATION.** Finale's Articulation
  Designer turns *any* character into a note-attached mark with **Vertical positioning** (Manual · Auto
  notehead/stem side · Always notehead side · Always stem side · On stem · Above note · Below note),
  **Center horizontally**, a **Flipped** glyph for below, **Stack automatically** (order = the list order),
  **Always place outside staff**, **Avoid staff lines**, **Slur interaction**, **Distance from entry**. Sibelius
  gets there by putting a glyph into one of three spare *articulation* slots; Dorico cannot create new
  articulations at all and sends users to custom playing techniques.
- **Many symbols on one note:** MuseScore — yes, and a symbol may be dropped ON a symbol to chain them
  (they move as a unit). Finale — articulations stack by list order. Sibelius — each symbol is an
  independent object; no stacking rule was found (**UNKNOWN** whether they avoid each other). The standards
  allow any number (MusicXML `<notations>` children, MEI elements) and say nothing about their order.
- **Where it sits by default — the standards' ORIGINS agree on "the note's left edge":**
  MusicXML `default-x` on a notation is *"relative to the left-hand side of the note"*, `default-y` to the top
  staff line, plus `placement` above/below; MEI's origin for a note is *"the left end of the notehead, the
  vertical one is the center of the notehead"*, offsets `@ho`/`@vo` in half-spaces. MuseScore draws a note's
  symbol at the NOTE's origin with `AlignH::LEFT` / `AlignV::BASELINE` unless offset. Sibelius creates it
  *"next to the selected note"* (the numbers: **UNKNOWN**).
- ⭐ **SMuFL already carries the placement a generic tool needs, per glyph:** the registration rules
  (articulations above *"sit on the baseline"*, below *"hang from the baseline"*; stem decorations centred at
  x=0,y=0; noteheads/accidentals centred on the baseline) and `classes.json` (`articulationsAbove`,
  `articulationsBelow`, `stemDecorations`, `pausesAbove/Below`, `dynamics`, …), plus the `opticalCenter`
  anchor for glyphs *"normally centered on a notehead or stem"*. With no anchor, SMuFL calls **half the
  advance width** *"an acceptable default"* for centring and the bounding-box half-width *"least
  satisfactory"*.
- **Size:** Sibelius has **four size options** at creation and shrinks symbols on a small staff
  automatically; a staff symbol can be made cue-size. MuseScore's note symbol takes the NOTE's `mag` (so a
  cue note's symbol shrinks) and scales with the staff, with its own `symbolsSize` property.
- **Interchange:** MuseScore EXPORTS a note's symbol as `<other-notation type="single" smufl="…"/>` — name
  only, no position. MusicXML 4.0's `<symbol>` is a DIRECTION (*"an occasional musical symbol … interspersed
  into text"*), not a note notation.
- ⭐ **The books:** Gould — *"Any symbol requires verbal qualification in a preface or at its first
  appearance"*; *"A symbol should have a single function in a work"*; *"Do not give an existing symbol a new
  meaning"*; symbols go *"through a stem"*, as *"an unusual note shape"* or *"placed above the stave"*
  (p. 494). Stone — explanations *"on first occurrence"* (p. 307), verbal instructions *"best placed where
  they apply, instead of in footnotes"* (p. 26), and the Ghent criteria for new signs (pp. 336–337). **No
  book gives a stacking position for a sign it does not name** — the nearest analogue is the articulation
  order (smallest nearest the head, fermata and bowing outermost:
  `docs/research/articulation-research.md` §2). Ross and Gerou & Lusk: nothing found on composer-defined
  signs (text search only) — **UNKNOWN**.

## 1. Sibelius (Reference Guide 2024.3)

Source: https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf — pages below are
PRINTED (PDF − 5).

- **Attachment.** *"Like text and lines, symbols can attach either to a single staff, or to the system. The
  difference between symbols and other objects is that you can position symbols anywhere you like."*
  (§4.10, p. 367).
- **The cost of that freedom** (p. 367): *"The disadvantage of symbols is that their IQ is not as high as that
  of other objects. For instance, if you put a sharp symbol next to a note, it won't move vertically if the
  note is dragged up or down, nor will the note play as a sharp, and nor will it change to a natural (or
  whatever) if the music is transposed. The moral of this is: don't use a symbol where a normal object will
  do equally well."* — and *"Symbols are still smart in other ways, though—they attach to staves and rhythmic
  positions, so that they stay in the right place in parts."*
- **Creating** (p. 368): *"Select the note next to which you want to add a symbol, then choose Notations >
  Symbols > Symbol (shortcut Z for 'zymbol')."* The gallery shows a **Used** category first, then **Common**.
  *"The symbol will automatically be attached to the staff or to the system, as appropriate for the symbol you
  have chosen (you can specify this default behavior via the Edit Symbols dialog)."* **More Options** opens a
  dialog with *"the four size options"* — *"Symbols automatically shrink when attached to a small staff, so
  you should normally leave the size at Normal"* — and a Staff / System choice (+ *Draw on all staves* for a
  system symbol). *"Click OK, and the symbol is created in the score next to the selected note."* With nothing
  selected, the pointer changes colour and a click places it.
  - The size names: *Normal*, and *"Cue size or Grace note size"* named in §4.20 (p. 406); the fourth is
    **UNKNOWN** by name (cue-grace by analogy with notes, not verified).
- **Moving** (p. 368): arrow keys nudge, Ctrl/Cmd+arrow *"exactly one space"*; *"Reset Position
  (Ctrl+Shift+P) returns a symbol to its default position."* *"Symbols can be copied and deleted just like
  other objects."*
- **Playback** (p. 368): *"most symbols don't play back, a handful (such as scoops and falls) will"*; others via
  the Playback Dictionary.
- **Horizontal attachment** (§7.10, p. 670): *"All objects are attached horizontally to a rhythmic position in
  the music."* *"If an object is attached to a note, its attachment arrow will point to the note (or to the
  note's horizontal position)."* An object between two notes *"will attach to an in-between rhythmic
  position"* and stays proportionally between them. Alt-drag keeps the attachment while moving
  (https://www.scoringnotes.com/tips/constrain-attachment-points-in-sibelius-and-finale/).
- **Edit Symbols** (§4.11, pp. 372–374): a symbol is a font **Character** *or* an imported **Graphic** (SVG
  recommended); each has a default **Staff/System** attachment; *"you can adjust the position of the graphic
  or font character with respect to its origin"*; graphics get rotation and % scale; **Composite** symbols
  combine others. Standard symbols keep their MEANING by grid slot: *"If you change the sharp symbol to a
  dollar sign, Sibelius will still treat it as a sharp."* New symbols go in gaps or the **User-defined** row.
- **Symbols that sit ON a stem** exist in the gallery (*Techniques*: *"Attach to the stem of a note or chord"* —
  sprechstimme, sul ponticello, buzz, p. 370) but are still free symbols placed by hand.
- **Custom articulations instead** (Scoring Notes): three spare slots in the *Articulations* rows of Edit
  Symbols become Keypad articulations with *"mass placement, automatic positioning, definition in playback"*;
  *"articulations will stack in order from left to right as shown in the symbols dialog: staccato at the
  bottom, the pauses at the top."*
  https://www.scoringnotes.com/tips/use-graphics-as-symbols-in-sibelius-7-and-define-them-as-custom-articulations/
  — and the gallery's own Articulation category *"are ordered according to relative proximity to the
  notehead"* (p. 369).
- **Default Positions** (§8.4, pp. 686–688): per object, *"Horizontal position relative to note"* and
  *"Vertical position relative to staff"* (Above top / Below bottom / Above middle / Below middle), separately
  for score and parts; Reset Position returns to them. ⚠️ Whether SYMBOLS have an entry in its *Other objects*
  list: **UNKNOWN** (the manual does not list the entries).
- **Magnetic Layout** (§7.5, pp. 649–654): its object list (lyrics, dynamics, chord symbols, endings,
  rehearsal marks, tempo, figured bass, Roman numerals, function symbols, pedal lines) does **not name
  symbols**; whether a free symbol avoids collisions: **UNKNOWN**.
- **Deleting the note** (p. 237): *"if you delete a note/chord, it is converted to a rest of identical
  duration"*. What happens to a symbol attached to it: **UNKNOWN** (by the rhythmic-position model it would
  stay — an inference, not verified).

## 2. Dorico

⚠️ Route: `archive.steinberg.help/dorico/v4|v5` serves only topic STUBS today; `steinberg.help` (≥ 6) is a
JavaScript reader that WebFetch cannot read. The forums serve.

- **There is no free-symbol tool.** The music-symbols library can EDIT existing symbols but *"you cannot
  create new music symbols in the Edit Music Symbol dialog … if you want to add custom symbols to your music,
  you can, for example, create custom playing techniques or line annotations"* — from the Dorico Pro 6.1
  help, *Music symbols*, seen only as a search snippet (page itself unreadable):
  https://www.steinberg.help/r/dorico-pro/6.1/en/dorico/topics/library/library_music_symbols_c.html
- **Nor new articulations:** *"You can't create a new articulation"* (pianoleo); the workaround is to replace
  the glyph of an unused articulation in *Library > Music Symbols*, above and below; Lillie Harris: Dorico
  *"doesn't currently offer stem attachments for notations"*.
  https://forums.steinberg.net/t/create-a-new-articulation-2-dots/799407
- **Custom playing techniques** are the answer instead. Edit Playing Techniques dialog (v2): Name, Category,
  **Type: Glyph or Text**, **Default placement: Above or Below the staff**, Appearance (same / different on
  each side), Popover text, Playback playing technique, **Duration** (*"Has no duration, and can only appear
  at one rhythmic position"*), Shown in Cues.
  https://archive.steinberg.help/dorico_pro/v2/en/dorico/topics/notation_reference/notation_reference_playing_techniques_edit_playing_techniques_dialog_r.html
- **What they attach to:** a RHYTHMIC POSITION in a staff, placed outside the staff — *"Playing techniques, both
  as text and symbols, are placed above the staff by default. On vocal staves, they are placed above the staff
  and below dynamics. In multiple-voice contexts, playing techniques for the up-stem voices are placed above
  the staff, and playing techniques for the down-stem voices are automatically placed below the staff."*
  https://archive.steinberg.help/dorico/v4/en/dorico/topics/notation_reference/notation_reference_playing_techniques/notation_reference_playing_techniques_positions_c.html
- **Horizontal:** *"Glyph playing techniques are always center-aligned, text playing techniques are
  left-aligned"* (Lillie Harris); Spreadbury: *"no dedicated feature for arbitrary stem decorations"*; move by
  hand in Engrave mode. https://forums.steinberg.net/t/placement-of-custom-playing-techniques/797478 ·
  left/centre/right alignment options *"something we would like to add in future"*
  https://forums.steinberg.net/t/positioning-of-playing-technique-glyphs/818632
- Inside-staff / on-note placement of a custom glyph, and what happens when the note is deleted: **UNKNOWN**
  (not found; Dorico ≥ 6 help unreadable).

## 3. Finale

⚠️ Finale was discontinued by MakeMusic in 2024 (not re-verified in this pass). `usermanuals.finalemusic.com`
answers 403 to a bare curl and 200 with a browser User-Agent (both measured today).

- **Articulations are note-owned:** *"An articulation must be attached to a note (or a rest); you can't insert
  one into an empty measure. The marking maintains its position relative to that note, even if you transpose
  it; in fact, the symbol will automatically flip to the opposite side of the note if the stem changes
  direction, and even switch to a different symbol if the new stem direction warrants."*
  https://usermanuals.finalemusic.com/FinaleMac/Content/Finale/ht-articulations.htm
- **Any glyph can be one** — Articulation Designer: *Main* = a **Character** from any font or a **Shape**;
  *Flipped* = the below version, with *"When placed above/below a note, use the: Main · Flipped"*;
  **Vertical positioning: Manual · Auto notehead/stem side · Always notehead side · Always stem side · On stem
  · Above note · Below note** (*"On stem … mostly used for markings like tremolos"*); **Center horizontally** +
  *Center over/under stem when stem side*; **Stack automatically** (*"automatically avoids collisions when more
  than one articulation is present"*); **Always place outside staff**; **Avoid staff lines** (only the HANDLE is
  kept off a line); **Attach to top note** (else the bottom note of a chord); *Place stem side when multiple
  layers are present*; **Slur interaction: Ignore · Always inside · Auto inside/outside**; **Handle
  Positioning** (*"characters are displayed by the invisible 'handle' in the lower-left corner of each
  symbol"*); **Distance from entry** / on-stem distances; playback effects (attack, duration, velocity).
  https://usermanuals.finalemusic.com/FinaleWin/Content/Finale/db-articulation-designer.htm
- **Order of several on one note:** *"Finale stacks the articulations based on the order of markings in the
  Articulation Selection dialog box and the Stack automatically setting"*; per note, *Stack > Never* takes one
  out of the stack. https://usermanuals.finalemusic.com/FinaleMac/Content/Finale/ht-articulations.htm ·
  *"The stacking order of articulations is based on their position in the Articulation Selection dialog box.
  Changing the order in this dialog box automatically changes the order for all of the articulations in a
  document."* https://usermanuals.finalemusic.com/FinaleWin/Content/Finale/db-articulation-selection.htm
- **Handle nudge per instance** (Handle Positioning dialog: H/V, positive = right/up).
  https://usermanuals.finalemusic.com/FinaleWin/Content/Finale/db-handle-positioning.htm
- **Expressions** (text or shape, the other route for a glyph) attach to a NOTE or a MEASURE: the contextual
  menu *"will also state whether the expression is attached to a note or a measure"*; Alt-drag moves it
  *"without changing its attachment point"*.
  https://usermanuals.finalemusic.com/Finale2012Win/Content/Finale/ID_MAINTOOL_EXPRESSION.htm ·
  Expression Assignment: *Alignment Point*, *Offset from Alignment Point: Horizontal · Vertical*, *Scale
  Expression with Attached Note*.
  https://usermanuals.finalemusic.com/Finale2014Win/Content/Finale/STAFFEXP.htm

## 4. MuseScore Studio

- **User-facing:** *"The Symbols palette is a category within the Master palette and houses all symbols and
  text from all built-in music fonts. Unlike other categories in the Master palette, items in the Symbols
  palette are non-functional: they are for display purposes only and have no other effect on the score."*
  **Add:** *"Select one or more score elements (notes, rests, barlines) then click on the desired symbol"* or
  drag it onto one. **Add to other symbols:** select a placed symbol and click another, or drop onto it —
  *"If two symbols have been joined together …, moving the first-added symbol moves both. However you can
  still move the second symbol in relation to the first."* **Reposition:** drag, the Properties offsets, or
  arrows in edit mode. *"Symbols added from the Symbols palette scale in line with the score …, but their
  font-size is fixed."* https://handbook.musescore.org/notation/expressive-markings/other-symbols
- Older handbook (v2, via search snippet — `musescore.org` is Cloudflare-gated): Symbols-section elements
  *"do not follow any positioning rules … nor do they affect score playback"*.
  https://musescore.org/en/handbook/2/master-palette
- **What it attaches to (source, `929d1e9`):**
  - on a NOTE: `Note::drop` → `case ElementType::SYMBOL: case ElementType::IMAGE: e->setParent(this);
    score()->undoAddElement(e);` — the note's own element list (`note.cpp:1864-1868`; the list's comment:
    *"types in _el: SYMBOL, IMAGE, FINGERING, TEXT, BEND"*, `:746`) ⇒ it follows the pitch and is removed with
    the note.
  - on a REST: accepted (`rest.cpp:173`) and held in the rest's list (`rest.cpp:572-578`).
  - via `ChordRest::drop` (e.g. dropped on the chord): parented to the SEGMENT with the track —
    rhythmic-position-owned (`chordrest.cpp:294-298`).
- **Default position:** `BSymbol` default align `{ AlignH::LEFT, AlignV::BASELINE }` (`bsymbol.h:69`);
  `layoutSymbol` only shifts by the alignment and the offset — it places the glyph at the parent's origin
  (`tlayout.cpp`, `layoutSymbol`). **Size:** a note's symbols take the note's `mag` (`chordlayout.cpp:3245-3248`)
  ⇒ cue/grace notes shrink them; `Symbol` also has `symbolsSize` and `symAngle` properties (`symbol.cpp:57-63`).
- **Export:** a note's symbols go out as `<other-notation type="single" smufl="<name>"/>` — no position
  (`exportmusicxml.cpp:4137-4153`); import reads `<other-notation>` (`importmusicxmlpass2.cpp:9451`).

## 5. The standards

### 5a. MusicXML 4.0

- `<other-notation>` (in `<notations>`, i.e. NOTE-owned): *"used to define any notations not yet in the
  MusicXML format"*; *"The smufl attribute can be used to specify a particular notation, allowing application
  interoperability without requiring every Standard Music Font Layout (SMuFL) glyph to have a MusicXML element
  equivalent."* Attributes: `type` (*"a single-note notation, or the start or stop of a multi-note
  notation"*, required), `number`, `placement` (*"above or below another element, such as a note or a
  notation"*), `smufl`, `print-object`, and **`default-x`: *"The origin is changed relative to the left-hand
  side of the note or the musical position within the bar. Positive x is right"*; `default-y`: *"relative to
  the top line of the staff. Positive y is up"*;** `relative-x/y` offset from the computed or overridden
  default. https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/other-notation/
- Typed siblings with the same `smufl` + `placement`: `<other-articulation>` (in `<articulations>`),
  `<other-ornament>` (in `<ornaments>`), `<other-technical>` (in `<technical>`).
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/other-articulation/ ·
  …/elements/other-ornament/ · …/elements/other-technical/
- `smufl-glyph-name`: *"The value is a SMuFL canonical glyph name, not a code point"* (e.g. `keyboardPedalPed`).
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/smufl-glyph-name/ — what wins when
  both `smufl` and element text are present: **UNKNOWN** (not stated there).
- **DIRECTION-owned:** `<symbol>` — *"specifies a musical symbol using a canonical SMuFL glyph name. It is used
  when an occasional musical symbol is interspersed into text"*; parent `<direction-type>` (one or more
  `<words>`/`<symbol>` mixed); text-style attributes (justify, halign, valign, font-*, enclosure, rotation).
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/symbol/ · `<other-direction smufl=…>`, whose
  `default-x` is *"relative to the start of the entire current measure"*.
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/other-direction/
- `<direction>`: *"not necessarily attached to a specific note"*; *"For applications where a specific direction
  is indeed attached to a specific note, the <direction> element can be associated with the first <note>
  element that follows it in score order that is not in a different voice."*
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/direction/

### 5b. MEI 5

- `<symbol>`: *"A reference to a previously defined symbol"*; `@altsym` (→ a `symbolDef`), `@glyph.auth`
  (value `smufl`), `@glyph.name`, `@glyph.num` (`#xE000` / `U+E000`), `@glyph.uri`, `@startid`, `@x`/`@y`,
  `@scale`, `@ho`/`@vo` *"in units of 1/2 the distance between adjacent staff lines"*. Remarks: *"The starting
  point, e.g., 'hotspot', of the symbol may be identified in absolute output coordinate terms using the x and
  y attributes or relative to another element using the startid attribute."* It is contained by `dir`, `ornam`
  and many text elements — ⚠️ **not** directly by `measure` (checked in the *Contained By* list).
  https://music-encoding.org/guidelines/v5/elements/symbol.html
- **Anchoring to a note:** `<dir>` — *"An instruction expressed as a combination of text and symbols, typically
  above, below, or between staves, but not on the staff"*; *"The starting point of the directive may be
  indicated by either a startid, tstamp, tstamp.ges, or tstamp.real attribute"*; it may contain `<symbol>`.
  https://music-encoding.org/guidelines/v5/elements/dir.html · `<ornam>` likewise (`startid`, `altsym`, `<symbol>`
  child): the Guidelines' own example — `<ornam tstamp="1"><symbol glyph.auth="smufl" glyph.num="#xE5C0"
  glyph.name="ornamentPrecompDoubleCadenceLowerPrefix"/></ornam>` (§2.4 / §4.4.5,
  https://music-encoding.org/guidelines/v5/content/shared.html, …/cmn.html). `<artic>` (a child of the note)
  carries `@glyph.name` / `@altsym` directly.
- **Origins (§2.4.3.3 Positioning):** *"If startid is present, the origin of the referenced element"*; *"note:
  The horizontal origin is the left end of the notehead, the vertical one is the center of the notehead"*;
  offsets in staff units; *"If neither absolute nor relative coordinates are specified, determining visually
  suitable start and end points … is left to the rendering application."*
  https://music-encoding.org/guidelines/v5/content/shared.html
- **Semantics first (§2.4.2.2):** primitives and symbols describe things *"on a purely graphical level, without
  implying a specific logical meaning. If possible, however, more meaningful elements should be used."*
  User-defined `symbolDef`s (SVG or MEI primitives, in a `symbolTable`) can be shared between files.
- Verovio renders `<symbol>` as a text-run item (`View::DrawSymbol`, `src/view_text.cpp:575`).

### 5c. SMuFL (smufl.formats.music/latest)

- **Registration** (*Glyph registration*): *"Unless otherwise stated, all glyphs shall be horizontally
  registered so that their leftmost point coincides with x = 0"*, zero side bearings. *"Glyphs for movable
  notations that apply to some vertical staff position (e.g. noteheads, accidentals) shall be registered such
  that the font baseline lies exactly at that position."* *"Combining glyphs that are designed to be
  superimposed on stems (stem decorations) should be registered such that the point that should sit in the
  center of the stem … should be at x=0 and y=0."* ⭐ *"Articulations to be positioned above a note or chord
  should be positioned such that they sit on the baseline (y=0), while articulations to be positioned below a
  note or chord should be positioned such that they hang from the baseline."* Flags: y=0 at the stem end, x=0
  at the stem's left.
  http://smufl.formats.music/latest/print.html
- **`opticalCenter`**: *"to assist in the correct horizontal alignment of the glyph relative to a notehead or
  stem. Currently recommended for use with glyphs in the Dynamics range."* On centring: *"centering the
  dynamic by determining the bounding rectangle and using half its width is least satisfactory, while using
  half the advance width is an acceptable default in the absence of a specific optical center position."*
  Same URL. Other anchors (`cutOutNE/SE/SW/NW`, `stemUpSE`, …) are per glyph in the font's metadata.
- **`classes.json`** *"groups glyphs together into classes, so that software developers can handle similar
  glyphs … in a similar fashion"*; *"Not all glyphs are contained within classes, and the same glyph can appear
  in multiple classes."* 85 classes today, among them `articulations`, `articulationsAbove`,
  `articulationsBelow`, `stemDecorations` (*"glyphs that are designed to be positioned on stems"*),
  `pauses`, `pausesAbove`, `pausesBelow`, `dynamics`, `ornaments`, `noteheads`, `accidentals*`, `rests`.
  https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/classes.json · spec text at the print URL.
- ⚠️ SMuFL says **nothing** about which side of a note, or in what order, a glyph goes beyond the
  registration above — that is the application's.

## 6. The books

| source | finding | citation |
|---|---|---|
| **Gould** | ⭐ *"A symbol such as a cross or other sign through a stem, an unusual note shape or a symbol placed above the stave may replace copious repeated verbal instructions. (Any symbol requires verbal qualification in a preface or at its first appearance.)"* | p. 494 (PDF 514, scan read) |
| **Gould** | *"Where a technique occurs only occasionally, a short verbal description is more helpful than an invented symbol unique to a piece"*; *"A symbol should have a single function in a work or its meaning will be ambiguous. Do not give an existing symbol a new meaning: this is confusing."*; graphic shapes *"placed in or above the stave"* | p. 494 (scan) |
| **Gould** | Performance instructions at the front of a score or part; *"A short, specific local instruction … should appear above the appropriate stave. More complex explanation should take a footnote"*, on the same page as the technique; footnote signs `*`, not numerals | p. 491 (PDF 511, text layer) |
| **Gould** | *"Avoid elaborate symbols, as they clutter the stave … Where a symbol will save a lengthy instruction, use the simplest possible notation"*; a different symbol may be used *"as long as the symbol has clear explanation"* | pp. 298–299 (PDF 318–319, text layer) |
| **Gould** | the invention of novel notation *"to give a score a particular uniqueness is unhelpful and potentially alienating"* | Introduction, PDF p. ~10 (text layer; printed page **UNKNOWN**) |
| **Gould** (via the articulation file) | stacking: smallest nearest the head; pause outside all but an octave sign; bowing outermost; horizontal: *"centred in line with the notehead"* | `docs/research/articulation-research.md` §2, §5 |
| **Stone** | *"Explanations of the pictograms must be added on first occurrence"* (string players and beater pictograms) | p. 307 (PDF 164 right) |
| **Stone** | *"Verbal instructions are best placed where they apply, instead of in footnotes, which require the performer to look down and possibly lose his place."* | p. 26 (PDF 24 left) |
| **Stone** | percussion: *"All instruments used in a given work should be listed on a prefatory page"*; name in full at first occurrence, pictogram in parentheses, thereafter the pictogram alone | pp. 205–206 |
| **Stone** | Ghent 1974 criteria for new signs: *"made only in cases where a sufficient need is anticipated"*; *"the preferable notation is the one that is an extension of traditional notation"*; *"as self-evident as possible"*; tolerant of handwriting; *"spatially economical"*. UNSUITED: notation *"unique to the composition"*, for nonstandard situations, or for effects *"so rarely used that verbal instructions would be more efficient"* | pp. 336–337 (Appendix II) |
| **Stone** | *"Prefatory explanations of new signs are therefore inevitable"* (Polish scores); most new signs *"have come and gone with the compositions for which they were invented"* | p. ~103 (text layer; exact printed page **UNKNOWN**) |
| **Ross** | nothing found on composer-defined signs or a legend (text search of the OCR) | **UNKNOWN** |
| **Gerou & Lusk** | nothing found (text search) | **UNKNOWN** |

- ⚠️ **No book found gives a place for a sign it does not name** — where an arbitrary added sign stands in a
  note's stack, and whether it goes notehead- or stem-side, is **UNKNOWN** in the library; the articulation
  rules are the nearest analogue.
- Whether any editor generates a legend / "explanation of symbols" page automatically: **UNKNOWN** (not
  searched).
