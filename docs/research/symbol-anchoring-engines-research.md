# Free symbols on a note — how MuseScore, LilyPond, Verovio, Finale and VexFlow anchor an arbitrary glyph

> **Findings only**, in the manner of `docs/research/staff-label-engines-research.md`. ⛔ Nothing here is a
> decision (the plan makes them). ⚠️ A research file does not know what was DECIDED.
>
> Written 2026-09-28 from the SOURCE on disk, `~/dev/engine-sources/`; no web search. Paths are relative
> to each repo. Checkouts: **MuseScore** `main` @ `929d1e9` · **LilyPond** `master` @ `beedbfa` ·
> **Verovio** `develop` @ `efff0bc` · **musxdom** (Finale's data model, not an engine) @ `c870522` ·
> **VexFlow** TypeScript source, tag `5.0.0` @ `8879d09` (⚠️ its line numbers are NOT the npm-build ones
> our port comments cite). **UNKNOWN** marks what could not be verified.
>
> The question: *the user picks any SMuFL glyph in the Symbols window and anchors it to the selected
> note or rest, as many as they like.* What does each engine call that, and what does it do with it?

## 0. Synthesis

| | MuseScore | LilyPond | Verovio / MEI | Finale (musxdom) | VexFlow 5 |
|---|---|---|---|---|---|
| The "free glyph" element | `Symbol` (SMuFL `SymId`) / `FSymbol` (any font char) | a `TextScript` whose markup is `\musicglyph "name"` | `<dir>` holding `<symbol glyph.auth="smufl" glyph.name=…>` | ⭐ no separate kind: an **ArticulationDef** *is* "any char in any font, or a shape" | `Articulation(type)` — an unknown `type` string is drawn as a glyph code |
| Glyph named by | SMuFL name (`<name>`) | Emmentaler (feta) name — ⛔ not SMuFL | SMuFL name or codepoint (`@glyph.name` / `@glyph.num`) | codepoint + font (`charMain`, `fontMain`) | codepoint string |
| Holds | sym, font, size ×, angle, offset, colour, visible, child symbols | markup, direction, any grob property via `\tweak` | glyph, colour, fontsize, `@place`, `@ho/@vo` | char/shape, font, main/alt (above/below), offsets, auto-vert mode, stacking + slur flags, playback deltas | code, position |
| Parent | ⭐ **NOTE** (a list on the note) — or a **SEGMENT** (a time position on a staff) | the note column (or the rest) | a time point: `@startid` → note/chord/rest (or `@tstamp`) | the **ENTRY** (note, chord or rest) — ⛔ not one note of a chord | the note (a modifier) |
| On a REST? | ⚠️ dropped on a rest it goes to the **segment**, not the rest | yes (a rest becomes the X-parent) | yes (`@startid` may name a rest) | yes (an entry may be a rest) | UNKNOWN (not traced) |
| Several on one note | yes, a list in insertion order | yes, ordered by `script-priority` + input order | yes, one `<dir>` each | yes, `inci` order | yes |
| Default position | ⭐ **ON the notehead's origin** (baseline on the note's line, left edge at the head's left) — or the staff's top line when on a segment | outside the staff, **below** by default, stacked by skyline | **below** the staff, left-aligned at the head's centre | per definition: head side / stem side / above / below / on stem, or manual | above/below by codepoint parity, stacked |
| Stacking | ⛔ **none** — each sits at the same origin + its offset ⇒ they OVERLAP | automatic (ScriptColumn + outside-staff skyline) | automatic (floating positioners, by class then order) | automatic (`autoStack`, per-assign `neverStack`) | automatic (`textLine` increments) |
| Offset units | staff spaces (file); drag snaps to a sp raster | staff spaces (`extra-offset`, `padding`) | `vu` = ½ staff space | Evpu (288/inch) | pixels |
| Takes horizontal room | on a NOTE: yes (joins the note's shape); on a SEGMENT: explicitly no | no (`extra-spacing-width` empty) unless `\textLengthOn` | no path found | UNKNOWN (Finale's spacer has an `avoidColArtics` switch) | yes (widens the modifier context) |
| Playback | ⚠️ a note's symbol **plays** if its glyph is an articulation glyph | no — meaning lives on the EVENT, not the glyph | no path found | optional, per definition (`playArtic` + deltas) | none (renderer only) |
| MusicXML | note/rest symbol → `<other-notation type="single" smufl=…>`; segment symbol not exported; import of `other-notation` → an **Articulation** | `other-notation` not imported (a TODO) | `direction-type/symbol` → `<dir><symbol>` | — | — |

⇒ **Two models exist, and every engine but LilyPond has the first:**

1. **A PICTURE owned by the note** (MuseScore `Symbol`, Verovio `<dir><symbol>`, LilyPond `\markup
   \musicglyph`): no meaning, a user offset, and — in MuseScore — no automatic placement at all.
2. **A typed articulation whose glyph is open** (Finale's whole articulation system, VexFlow's fallback,
   Verovio's `<artic glyph.name>`, MuseScore's own MusicXML import): stacks with the other marks,
   can carry playback.

⭐ **MuseScore is the only engine that offers "drop any SMuFL glyph on a note" as a UI**, and it is
the literal precedent for the feature: Master Palette → Symbols builds `Symbol` elements, `Note::drop`
parents them to the note. Its defaults are the crudest of the five (glyph on the head, overlapping,
no stacking), and it blurs picture and meaning (the note's symbols feed playback by glyph identity).

## 1. MuseScore — `Symbol` on a Note, or on a Segment

### Model
- `Symbol : BSymbol : EngravingItem` holds `SymId m_sym`, an optional per-symbol `m_scoreFont`,
  `m_symbolsSize = 1.0`, `m_symAngle = 0.0` (`src/engraving/dom/symbol.h:46-86`; properties
  `Pid::SYMBOL / SCORE_FONT / SYMBOLS_SIZE / SYMBOL_ANGLE`, `dom/symbol.cpp:105-175`). Constructed
  `MOVABLE`; default glyph `accidentalSharp` (`symbol.cpp:46-55`). Colour, visibility and `offset`
  come from `EngravingItem`.
- `FSymbol` is the same thing for **one codepoint of any text font** (`m_font`, `m_code`,
  `symbol.h:93-117`) — the Special Characters dialog makes these (`src/palette/widgets/specialcharactersdialog.cpp:682-733`).
- `BSymbol` (base of Symbol and Image) carries `m_align = {LEFT, BASELINE}` and **`m_leafs`** — a
  symbol can own child symbols/images, drawn on top (`dom/bsymbol.h:37-70`, `bsymbol.cpp:66-77`).
  Dropping a symbol on a symbol makes it a leaf, offset by the parent's width×height "so newly added
  child is visible" (`bsymbol.cpp:121-138`) ⇒ compound symbols are built by nesting.

### Which element a palette glyph becomes
- **Master Palette → Symbols** = `SymbolDialog`, one per SMuFL range, with a FONT chooser: it makes a
  `Symbol` per `SymId` and `setSym(symId, font)` (`src/palette/widgets/symboldialog.cpp:55-71`,
  `masterpalette.cpp:143, 194`). The regular palettes also hold `Symbol`s (e.g. the accordion one,
  `palette/internal/palettecreator.cpp:915-919`).
- **Articulations are a different class**: `Articulation` belongs to the **Chord**, not the note
  (`dom/chord.cpp:703-720` — close-to-note ones first, staccato always first), carries its own
  `m_symId` and an `ArticulationAnchor` (`dom/articulation.h:104-235`), and is placed and stacked by
  `ChordLayout::layoutArticulations` (`rendering/score/chordlayout.cpp:774-1010`: direction rules,
  Gould p. 117 marcato above, `articulationMinDistance`, keep-together). ⚠️ `setSymId` accepts any
  `SymId` (`articulation.cpp:76-83`) — and the MusicXML importer uses exactly that (below).

### Anchor / parent
- **Note**: `Note::acceptDrop` accepts `SYMBOL` (`dom/note.cpp:1807`); `Note::drop` just
  `setParent(this)` + `undoAddElement` — **no offset is set** (`note.cpp:1864-1868`). `Note::add` pushes
  it onto `m_el` (`note.cpp:1372-1374`), the note's list of *"fingering, other text, symbols or images"*
  (`dom/note.h:554`). ⭐ Unlimited, in insertion order; no sort.
- **Rest**: `Rest::acceptDrop` accepts `SYMBOL` (`dom/rest.cpp:173`), but `Rest::drop` has no case for it
  and falls to `ChordRest::drop`, which parents it to the **segment** (`chordrest.cpp:294-299`). So a
  symbol "on a rest" is a segment annotation of the rest's track — it does not belong to the rest.
  (`Rest::remove` still handles `SYMBOL` in `el()`, `rest.cpp:572`, and an `MMRest` reads child symbols,
  `rw/read500/tread.cpp:3283-3290` — the rest path is a leftover / MM-rest-only.)
- **Segment** (time position + track): `Segment::add` files `SYMBOL` in `m_annotations`
  (`dom/segment.cpp:705`); also where a drop on empty staff lands (`doDropTextBaseAndSymbols`,
  `src/notation/internal/notationinteraction.cpp:2034-2048`, with the click offset kept as the user
  offset). A segment symbol may be a *system object* (`systemFlag`, `measureread.cpp` in read500:467-475).
- Applying from the palette to a selected note uses the same `drop` path (`applyDropPaletteElement`,
  `notationinteraction.cpp:2683-2717`); so does paste (`src/engraving/editing/paste.cpp:597-632`).

### Placement
- `TLayout::layoutSymbol`: bbox of the glyph (per-symbol font × `symbolsSize` when a font is set),
  then `pos` from `align` only — `BASELINE` ⇒ `(0, 0)` (`rendering/score/tlayout.cpp:5574-5627`). No
  autoplace, no skyline query, no above/below property.
- ⭐ ⇒ **on a note, the glyph's SMuFL baseline sits on the note's staff position and its left edge at the
  notehead's left** — it covers the head until the user moves it. Laid out from `ChordLayout` with the
  note's mag (`chordlayout.cpp:3244-3248`).
- On a segment: x = the segment's x, y = the **top staff line** (`BSymbol::pagePos/canvasPos`,
  `bsymbol.cpp:188-227`).
- ⛔ **Multiple symbols do not stack**: each is laid out at the same origin + its own offset.

### Editing
- Drag = `setOffset(delta)`, snapped to `spatium / hRaster` / `vRaster` when raster is on
  (`bsymbol.cpp:144-173`). Offset is written in **staff spaces** (`rw/write/twrite.cpp:438-447`).
  Properties panel: symbol, font, size, angle (`src/propertiespanel/.../symbols/symbolsettingsmodel.cpp:41-51`).
- A note's symbols are children: they follow the note, are cloned with it (`note.cpp:746-760`), and go
  when it is deleted. A segment symbol stays with the time position.

### Spacing
- On a note: `fillNoteShape` adds every `el()` item with `addToSkyline()` to the note's shape
  (`tlayout.cpp:4236-4243`), the chord shape adds the notes' (`chordlayout.cpp:3399-3462`), the segment
  shape adds the chord's (`segment.cpp:2640-2641`) ⇒ **a note's symbol widens spacing and enters the
  skyline** (unless invisible or autoplace is off, `engravingitem.h:438`).
- On a segment: `Segment::createShape` **explicitly excludes** `isSymbol()` / `isFSymbol()` from the
  collision shape (`dom/segment.cpp:2693-2712`).

### Playback — picture and meaning are NOT separated
- `NoteArticulationsParser::parseSymbols` walks `note->el()` and maps each `Symbol`'s glyph through
  `SymbolsMetaParser::symbolToArticulations` (`src/engraving/playback/metaparsers/notearticulationsparser.cpp:194-202`,
  `internal/symbolsmetaparser.cpp:48-…`: `articAccentAbove` → Accent, etc.) ⇒ a SMuFL accent dropped as a
  free Symbol on a note **plays as an accent**. Segment symbols are not parsed there.

### Serialization
- MSCX: `<Symbol><name>smuflName</name>[<font>…</font><symbolsSize/><symbolAngle/>]<offset/>…</Symbol>`
  inside `<Note>` or in the measure's voice at a tick (`twrite.cpp:3222-3233`; read:
  `rw/read500/tread.cpp:2417-2479` — unknown name → `noSym`; note child `3408-3412`; segment
  `measureread.cpp:467-475`).
- MusicXML export: note/rest symbols → `<notations><other-notation type="single" smufl="name"/>`
  (`src/importexport/musicxml/internal/export/exportmusicxml.cpp:4137-4153`, called at 4516 and 4701).
  Segment symbols: no branch in `commonAnnotations` (6614-6650) ⇒ **not exported** (as far as traced).
- MusicXML import: `<other-notation smufl=…>` becomes a `Notation` with a `SymId`
  (`import/importmusicxmlpass2.cpp:9651-9664`) and then an **`Articulation`** with that `SymId`
  (`addNotation` → `addArticulationToChord`, 9471-9486, 1215-1240). `<other-direction smufl=…>` becomes
  a `Symbol` (4264-4280). ⇒ the round trip note-Symbol → XML → back is **asymmetric** (Symbol comes back
  as an Articulation).

## 2. LilyPond — a markup glyph as a TextScript (or a custom Script)

- **Model.** `\musicglyph "name"` is a markup command returning the glyph stencil from the music font,
  by **Emmentaler (feta) name** (`scm/define-markup-commands.scm:4400-4425`); the docs list it as the way
  to put "any available musical symbol" on a note (`Documentation/en/notation/text.itely:1746-1760`).
  Attached as `c4^\markup{…}` it is a `TextScriptEvent` → a **`TextScript`** grob
  (`lily/text-engraver.cc:57-82`). ⛔ No SMuFL name lookup was found (`smufl` appears only in a comment in
  `lily/open-type-font.cc:327`) — **UNKNOWN** how a SMuFL name would map.
- The alternative is a **Script** (articulation): `make_script_from_event` looks the `articulation-type`
  up in the context property `scriptDefinitions` (`lily/script-engraver.cc:99-157`), default
  `default-script-alist` (`scm/script.scm:18-…`, `ly/engraver-init.ly:892`), each entry naming its glyph as
  `script-stencil (feta . (up-glyph . down-glyph))`. A user may add an entry ⇒ an arbitrary glyph as a
  typed articulation.
- **Anchor.** The TextScript's X-parent is the note column — or the **rest** when the column has no
  heads (`text-engraver.cc:85-100`). Several per note: each gets `script-priority` 200 + its index
  (`text-engraver.cc:67-72`).
- **Placement.** `TextScript` defaults (`scm/define-grobs.scm:3806-3839`): `direction DOWN`,
  `outside-staff-priority 450`, `padding 0.3`, `staff-padding 0.5`, `avoid-slur around`,
  `X-align-on-main-noteheads #t`, Y by `side-position-interface::y-aligned-side` ⇒ outside the staff,
  stacked by the skyline. `^` / `_` force the side. Scripts and text scripts of one moment share a
  `ScriptColumn` (`lily/script-column-engraver.cc:69-83`), ordered by `script-priority` then input order,
  bumping `outside-staff-priority` by 0.1 so the order is kept (`lily/script-column.cc:131-186`).
- **Editing.** Source text: `\tweak extra-offset #'(x . y)`, `padding`, `direction` — staff spaces.
  It is a child of its note column, so it moves and dies with the note.
- **Spacing.** `extra-spacing-width (+inf.0 . -inf.0)` = empty ⇒ ignored by horizontal spacing
  (`define-grobs.scm:3811`); `\textLengthOn` makes it count (`ly/property-init.ly:918-922`). For a Y-side
  `Script`: **UNKNOWN** (not traced).
- **Playback.** Meaning lives on the **event**, not the glyph: `accent = #(make-articulation 'accent
  'midi-extra-velocity 20)` (`ly/script-init.ly:24-47`), read by `Note_performer`
  (`lily/note-performer.cc:69-93`). A TextScript carries none ⇒ a `\musicglyph "scripts.sforzato"` is a
  picture.
- **MusicXML.** `musicxml2ly` lists `other-notation` among unimplemented `<notations>` children
  (`scripts/musicxml2ly.py:4793-4799`); `other-direction` is a TODO (3082).

## 3. Verovio / MEI — `<dir>` with a `<symbol>`, or an `<artic>` with `@glyph.name`

- **Model.** `Symbol` is a **TextElement** with `AttColor`, `AttExtSymAuth` (`@glyph.auth`),
  `AttExtSymNames` (`@glyph.name`, `@glyph.num`), `AttTypography` (`include/vrv/symbol.h:25`); its glyph
  is `@glyph.num` first, else `@glyph.name` (`src/symbol.cpp:56-73`). It lives **inside text containers**:
  `<dir>`, `<ornam>`, `<tempo>`, `<rend>` (`src/dir.cpp:72`, `ornam.cpp:54`, `tempo.cpp:67`, `rend.cpp:72`).
  ⇒ the free glyph is `<dir startid="#n1"><symbol glyph.auth="smufl" glyph.name="…"/></dir>`.
- `<symbolDef>` (children `graphic`, `svg`, `symbol`, `src/symboldef.cpp:44-46`) is referenced by
  `@altsym` from any ControlElement (`include/vrv/controlelement.h:29-35`) — used to swap the glyph of a
  breath, caesura, fermata, mordent, repeat mark, trill, turn (`src/view_control.cpp:1654-2920`).
  ⚠️ `DrawSymbolDef` draws only `graphic` and `svg` children, not `symbol` (`src/view_graph.cpp:392-430`).
- **Typed articulation with an open glyph:** `<artic>` also carries `@glyph.name/num`, which override
  the glyph chosen by `@artic` (`src/artic.cpp:150-165`). `<artic>` may be a child of `note` / `chord`
  only (`note.cpp:150`, `chord.cpp:181`) — ⛔ **not a rest** (`rest.cpp:218` allows only `dots`).
- **Anchor.** A `<dir>` is a control element on a time point — `@startid` to any layer element (note,
  chord, rest) or `@tstamp`. Several: one `<dir>` each. A dir whose start cannot be resolved is simply
  **not drawn** (`view_control.cpp:1758-1759`).
- **Placement.** Default `@place` for a dir is **below** (`src/floatingobject.cpp:248-252`); x = the
  start's x + its drawing radius (the head's centre), text **left-aligned** (`view_control.cpp:1773-1784`);
  y from its floating positioner. The symbol is drawn at the music font size (`pointSize ×
  MusicToLyricFontSizeRatio`, `view_text.cpp:615-621`, `doc.cpp:2142-2145`) unless `@fontsize`.
- **Stacking.** `AdjustFloatingPositionersFunctor` processes classes in a fixed order (… FERMATA, DIR,
  CPMARK, REPEATMARK, TEMPO …) and within a class pushes each positioner past the overflow boxes it
  overlaps, then adds its own box (`src/adjustfloatingpositionerfunctor.cpp:121-160, 166-245`) ⇒
  automatic, outward, by class then order. A `@place="within"` dir skips collision (130-134). `@vgrp`
  aligns dirs (226-232).
- **Editing.** `@ho` / `@vo` in MEI `vu` = ½ staff space (`src/view.cpp:140-152`, `options.cpp:1202-1203`).
  The CMN editor toolkit has no dir/symbol command (`src/editortoolkit_cmn.cpp`) — editing **UNKNOWN**
  beyond the attributes.
- **Spacing.** No path found by which a `<dir>` widens a measure (only harm and syl have spacing
  functors: `adjustharmgrpsspacingfunctor.cpp`, `adjustsylspacingfunctor.cpp`).
- **Playback.** No read of artic or dir in `src/midifunctor.cpp` (grep) — none found.
- **MusicXML.** `direction-type/symbol` (and coda/segno) → `<dir>` + `<symbol glyph.auth="smufl">`
  (`src/iomusxml.cpp:703-726`, selection at 2378), positioned by `@tstamp`, not `@startid`; technical
  marks keep their `smufl` as `artic@glyph.name` (3615-3630).

## 4. Finale (musxdom) — every articulation is a user-defined glyph

- **Model.** `others::ArticulationDef` (`src/musx/dom/Others.h:215-326`): `charMain` + `fontMain` (any
  character of any font) **or** a Shape (`mainIsShape`, `mainShape`), plus an alternate char/shape for
  the other side, `autoVert` + `AutoVerticalMode` (notehead side / auto / stem side / on stem / above /
  below entry), `outsideStaff`, `autoStack`, `centerOnStem`, `avoidStaffLines`, slur interaction,
  offsets, `copyMode` (repeat the glyph along a line), and **playback**: `playArtic` + attack / duration /
  velocity deltas or percents.
- ⭐ There is no separate "free symbol": the articulation library *is* the user's glyph palette; a
  definition decides whether it plays.
- **Anchor.** `details::ArticulationAssign` on an **entry** — `articDef`, `horzOffset`, `vertOffset`,
  `overridePlacement` + `aboveEntry`, `hide`, `neverStack`, `avoidSlur`; one instance per `inci`
  (`src/musx/dom/Details.h:105-160`). An entry is a note/chord or a **rest** (`Entries.h:403`). ⛔ Not one
  note of a chord — the header says users fake it with manual vertical positioning (`Details.h:155-158`).
- **Placement.** `calcPlacementAbove` (`src/musx/dom/Details.cpp:84-125`): the assignment's override,
  else manual (sign of `vertOffset`), else the definition's mode vs the stem. The stacking algorithm
  itself is Finale's, not in musxdom — **UNKNOWN** beyond the flags.
- **Expressions** (`MeasureExprAssign`, `Others.h:1332-1493`) are the other route: attached to a
  **measure + Edu position + staff/layer**, not an entry, aligned by `HorizontalMeasExprAlign` (…
  `CenterPrimaryNotehead`, `Stem` …) and `VerticalMeasExprAlign` (`Others.h:988-1022`).
- **Units.** Evpu, 288 per inch (`Fundamentals.h:59, 83`).
- **Spacing.** `MusicSpacingOptions::avoidColArtics` (`Options.h:816`) — whether they take room by
  default: **UNKNOWN**.

## 5. VexFlow 5.0.0 — an unknown articulation type is a glyph

- `new Articulation(type)`: if `type` is not in `articulationCodes`, the string is used as the **glyph
  code** (`src/articulation.ts:300-325`), and its side is picked by the **codepoint's parity** — even
  above, odd below (306-307, doc 291-298: SMuFL pairs `…Above` / `…Below` that way).
- A modifier of the note (rests are notes too — **UNKNOWN** whether it formats sensibly on one).
  `Articulation.format` stacks each articulation outward by `topTextLine` / `textLine`, pushes it outside
  the staff unless `betweenLines`, and widens the modifier context by the glyph overhang
  (`articulation.ts:201-265`) ⇒ it takes horizontal room. No playback (a renderer).

## 6. What the sources do NOT answer

- How MuseScore users are expected to keep several symbols on one note from overlapping — the code
  gives only offsets and nested leafs; no layout rule found.
- LilyPond: a SMuFL-name route; whether a Y-side `Script` counts in spacing.
- Verovio: editing a `<dir>` interactively; its order among several dirs on one `@startid` beyond
  "class, then processing order".
- Finale: its stacking algorithm and spacing defaults (musxdom stores flags only).
