# The glissando, the bend and the free-ended slide, in three engines' SOURCE

**What this is:** a survey of the CODE that stores, places, draws and plays a glissando — and its
relatives with a free end (fall, doit, scoop, plop, bend, slide in/out) — in MuseScore, Verovio and
LilyPond. It feeds the planning of a GLISSANDO / BEND tool (a line from a note to another note, or
to nothing; optional "gliss." text; Properties-window switches). Every number has a `file:line`
behind it. ⛔ Nothing here is a recommendation until §6; §4 records where the engines disagree and
§5 what could not be established.

⚠️ **Read from source, not measured from output.** No engine was built or run.

---

## §1 What was surveyed

| engine | tree | HEAD | native unit | → staff spaces |
|---|---|---|---|---|
| MuseScore 4.x | `~/dev/engine-sources/MuseScore` | `929d1e9` (2026-08-18) | the **spatium** (= 1 sp); `_sp` literals | ×1 |
| Verovio | `~/dev/engine-sources/verovio` | `efff0bc` (2026-08-18) | `unit` = **half** a staff space (`DEFAULT_UNIT`, see `accidental-dot-engines.md` §1) | ÷2 |
| LilyPond | `~/dev/engine-sources/lilypond` | `beedbfa` (2026-08-18) | the **staff space**; `delta-step` / staff-position = HALF spaces | ×1 (steps ÷2) |

VexFlow (on disk, removed from this project) was not surveyed — outside the brief. `belle/` and
`musxdom/` were not surveyed either.

Glyph metrics used below are Bravura's, from `verovio/fonts/Bravura/bravura_metadata.json`:
`wiggleGlissando` (U+EAAF) advance **0.96 sp**, bbox 1.224 × 0.444 sp; `noteheadBlack` 1.18 sp wide;
`brassFallRoughShort` / `brassLiftShort` advance 1.7 sp, 1.692 × 1.86 sp; `brassScoop` 1.272 sp,
`brassPlop` 1.172 sp; `guitarVibratoBarScoop` 2.036 sp; `staffLineThickness` 0.13, `stemThickness` 0.12.

---

## §2 Engine by engine

### 2.1 MuseScore

MuseScore has **four** different objects for "a line that changes pitch", and they do not share a
model:

| object | file | ends on | used for |
|---|---|---|---|
| `Glissando` | `src/engraving/dom/glissando.{h,cpp}` | **always a note** | gliss / slide / portamento, note → note |
| `ChordLine` | `src/engraving/dom/chordline.{h,cpp}` | **nothing** — a fixed-size shape on one note | fall, doit, plop, scoop (jazz/brass) |
| `GuitarBend` | `src/engraving/dom/guitarbend.{h,cpp}` | a note (a *created* end note or grace), or **itself** for slight bend / dip / scoop | guitar bends, whammy dives |
| `Bend` (legacy) | `src/engraving/dom/bend.{h,cpp}` | nothing — a list of `PitchValue` points | old tab bend graph |

#### 1 · Data model

**Glissando is a note-to-note spanner.** `class Glissando final : public SLine`
(`glissando.h:58`), `anchor() → Anchor::NOTE` (`:79`), `allowTimeAnchor() → false` (`:89`). Its
properties (`glissando.h:62-71`): `text`, `glissandoType` (STRAIGHT | WAVY — `types/types.h:1187-1189`),
`glissandoStyle` (playback: CHROMATIC | WHITE_KEYS | BLACK_KEYS | DIATONIC | PORTAMENTO —
`types/types.h:293-295`), `glissandoShift`, `fontFace`, `fontSize`, `showText`, `fontStyle`,
`easeIn`, `easeOut`; plus the inherited line props `LINE_WIDTH`, `LINE_STYLE`, `DASH_LINE_LEN`,
`DASH_GAP_LEN` (`glissando.cpp:56-68`) and a runtime `isHarpGliss` (`glissando.h:83-84`).

- **The end cannot be empty.** When dropped on a note, `Note::add` (`dom/note.cpp:2069-2111`) takes
  the given end note or calls `SLine::guessFinalNote(this)`; if none is found the glissando is
  **deleted** (`"no segment for second note of glissando found"`, `:2107-2110`). A note carries at
  most one outgoing glissando (`:2071-2076`). Layout (`layoutNoteAnchoredLine`) casts both ends with
  `toNote(...)` unconditionally (`rendering/score/tlayout.cpp:4934-4939`).
- **"Gliss to nothing" is a different object** — see ChordLine below — or, on import, a
  MusicXML glissando whose start and stop fall on the same tick is **converted to a FALL ChordLine**
  (`importexport/musicxml/internal/import/importmusicxmlpass2.cpp:9007-9016`).
- **Finding the end note** — `SLine::guessFinalNote` (`dom/line.cpp:1087-1150`): the next grace
  note if any, else the first chord-rest segment after the chord's END tick, same track (else any
  chord of the same part); if that chord has grace-befores, their first note; otherwise **the note at
  the same index** in the target chord, clamped to its last note
  (`startNoteIdx → min(startNoteIdx, target->notes().size()-1)`, `:1142-1145`). `Chord::notes()` is
  low→high, so **chord glissandi pair by index from the bottom**, and extra start notes all converge
  on the target's top note.
- **Two-note selection** also works: a list selection of exactly two notes at different ticks is a
  note-to-note line (`notation/internal/notationinteraction.cpp:2277-2280`).
- **Linked staves** get a linked clone with the corresponding end note
  (`editing/edit.cpp:4055-4064`); on TAB it is forced STRAIGHT with no text (`note.cpp:2091-2094`).
- Default playback style comes from the **instrument** (`Instrument::glissandoStyle`,
  `dom/instrument.cpp:794`; `note.cpp:2097-2103`) — harp → DIATONIC (`Sid::glissandoStyleHarp`,
  `glissando.cpp:152-159`), and a harp gliss may only be DIATONIC or CHROMATIC (`:398-404`).

**MusicXML.** Import (`importmusicxmlpass2.cpp:8958-9035`): `<glissando>` and `<slide>` both become
a `Glissando`; `line-type` dashed/dotted/solid → `LINE_STYLE`; the element's text → `text`;
**`<glissando>` always becomes WAVY** (`glissandoTag || lineType == "wavy"`, `:8996`) and `<slide>`
STRAIGHT unless wavy; a gliss longer than 4 whole notes is dropped (`:9018-9024`). Export
(`export/exportmusicxml.cpp:978-1006`): STRAIGHT → `<slide line-type="solid|dashed|dotted">`, WAVY →
`<glissando line-type="wavy">`; text is written only if `showText`. `<falloff>`, `<doit>`,
`<plop>`, `<scoop>` ↔ `ChordLine` (import `:9277-9310`, export `:3349-3384`), with
`line-shape="straight"` and `line-type="wavy"` mapped to the ChordLine's `straight` / `wavy` flags.
`<bend>` goes to the guitar-bend importer (not traced).

#### 2 · Geometry (`rendering/score/tlayout.cpp`, `layoutNoteAnchoredLine`, `:4934-5098`)

- **y = head centre** of both notes (the segment starts at the note origin, x shifted by
  `headWidth × 0.5`, `:4953-4957`).
- **Same staff line, different pitch** (e.g. F → F♯): the ends are pushed **±0.25 sp** so the line
  still slopes (`:4987-4991`); on TAB ±0.4 × line distance (`:4981-4985`).
- **Start x:** the start **chord's shape** (lyrics removed) — its right-most edge *at the start
  note's own height band* (`rightMostEdgeAtHeight(startYAbove, startYBelow)`, `:5031-5043`) — so a
  dot or a second-displaced head at that height is cleared; then **+0.25 sp**
  (`lineNoteDist = 0.25 * spatium  // TODO: style`, `:5059-5061`).
- **End x:** the end chord's left-most edge within **the half of the note the line approaches from**,
  widened by one ledger-line thickness (`llWidth`, `:5044-5056`) — so an accidental is cleared only
  if the line would actually hit it; then **−0.25 sp**.
- The y at each end is re-derived **proportionally along the line** after the x-shortening
  (`:5063-5069`), so the ends stay on the head-centre-to-head-centre line.
- **System break:** the line is one `Glissando` with N `GlissandoSegment`s (BEGIN / MIDDLE / END).
  The BEGIN segment runs to `system->endingXForOpenEndedLines()`, the END segment starts at
  `system->firstNoteRestSegmentX(true)` (`tlayout.cpp:4908-4930`). One **constant slope**
  `yTot / xTot` over the summed segment widths, corrected for the staff's y difference between
  systems (`yStaffDifference`), is interpolated so the pieces read as one line
  (`:4993-5025`).
- **Cross-staff:** `track2` may be another staff; handled by the same y interpolation.
- **Minimum length** — enforced by SPACING, not by dropping: `minStraightGlissandoLength` **1.2 sp**,
  `minWigglyGlissandoLength` **2.0 sp** (`style/styledef.cpp:614-615`), added as padding between the
  two notes (`rendering/score/horizontalspacing.cpp:1535-1568`) and at system ends
  (`:1885-1893`). A segment whose `pos2().x() <= 0` has no bbox and is not drawn
  (`tlayout.cpp:2730-2734`, `tdraw.cpp:1599-1601`).

**Drawing** (`rendering/score/tdraw.cpp:1595-1667`): the painter is **rotated to the line**, so
everything is drawn horizontally in the line's own frame.
- STRAIGHT: one line, flat caps, `glissandoLineWidth` **0.15 sp** (`styledef.cpp:1583`); dashed/
  dotted with `distributedDashPattern` so the pattern fits the length (`tdraw.cpp:1619-1630`); dash
  and gap default **5.0 / 5.0** line widths (`styledef.cpp:1589-1590`) = 0.75 sp each.
- WAVY: `wiggleGlissando` repeated `n = floor(l / advance)` times (truncated, never overlapping),
  **centred** in the length, glyph vertically centred on the line (`tdraw.cpp:1631-1643`).
- **Text:** drawn if `showText` (default **true**, `glissando.cpp:443-444`), string default
  **"gliss."** (`styledef.cpp:1584`), font **Edwin, 8 pt, italic**, spatium-dependent
  (`styledef.cpp:1568-1572`). It is **centred along the rotated line**, its descender raised
  **0.1 sp** above a straight line / **0.4 sp** above a wavy one, and **skipped entirely if its width
  is not less than the line's length** (`tdraw.cpp:1645-1665`). There is no "glissando" vs "gliss."
  logic — the text is a free string property.

#### 3 · Behaviour

- **Playback** (`dom/glissando.cpp:161-248`, `playback/renderers/glissandosrenderer.cpp:34-103`,
  `playback/metaparsers/internal/spannersmetaparser.cpp:104-130`): PORTAMENTO → a *continuous*
  pitch glide over the pitch range; everything else → a *discrete* run: CHROMATIC every semitone,
  WHITE_KEYS / BLACK_KEYS filtered by pitch class, DIATONIC walks staff **lines** from the start
  note obeying the accidentals in force (`chromaticPitchSteps`), harp DIATONIC obeys the pedal
  diagram. The start note's duration is divided equally among the steps
  (`renderDiscreteGlissando`). The legacy MIDI path (`compat/midi/compatmidirender.cpp:813-850`)
  instead packs the run into the last **33 %** of the note (`glissandoPart = 0.33`) with `easeIn` /
  `easeOut` (0–100) shaping; `glissandoShift` suppresses the slide flag there.
- **Properties panel** (`propertiespanel/.../lines/glissandosettingsmodel.cpp:103-111`): line type
  (straight/wavy), show text, text, thickness, line style, dash length, gap length. Playback style
  is on the separate Playback panel (`.../playback/internal/glissandoplaybackmodel.cpp:43`).
- **Creation:** apply the palette item to a note → end guessed; to two selected notes → between
  them; a range selection is applied per note (the `SLine` range branch excludes glissandi,
  `notationinteraction.cpp:2551`). The file's own TODO lists "draggable handles of glissando
  segments" and "re-attachable glissando extrema" as not done (`glissando.cpp:23-30`).

#### 4 · Free ends: ChordLine (fall / doit / plop / scoop) — to nothing AND from nothing

`class ChordLine final : public EngravingItem` (`dom/chordline.h:42`) — **not a spanner**: an
item on the chord, optionally bound to one note (`setNote`, `:98-99`). Type `ChordLineType`
NOTYPE | FALL | DOIT | PLOP | SCOOP (`types/types.h:1095-1098`), flags `straight` and `wavy`,
stored **`lengthX` / `lengthY`** (spatium units, written to file only when non-zero —
`rw/write/twrite.cpp:1256-1282`), and `modified` + a stored **`Path`** of element points in spatium
units once the user has dragged a grip.

- **Direction is the TYPE:** `isToTheLeft()` = PLOP or SCOOP (they come *into* the note, from
  nothing); `isBelow()` = SCOOP or FALL (`chordline.h:79-80`). So: FALL = right & down, DOIT = right
  & up, PLOP = from upper-left into the note, SCOOP = from lower-left.
- **Default shape** (`tlayout.cpp:1660-1683`): base length **1 sp** × chord mag; horizontal
  **1.2 sp** ("let the symbols extend a bit more horizontally"), vertical **1 sp**. Straight → a
  line; curved → a cubic (`cubicTo(x2/2, 0, x2, y2/2, x2, y2)` to the right,
  `cubicTo(0, y2/2, x2/2, y2, x2, y2)` to the left). Wavy → a glyph, `brassFallRoughShort` for
  FALL/PLOP, `brassLiftShort` for DOIT/SCOOP (`chordline.cpp:252-259`), drawn with a ±1° rotation
  (`tdraw.cpp:1207-1210`).
- **Placement** (`tlayout.cpp:1686-1745`): y = note centre **±0.25 sp** (`vertOffset`); x = the
  chord shape's edge at that height (excluding chord lines, harmony, lyrics), **always right of the
  dots** for right-going lines, then **±0.33 sp** (`horOffset`, "one third of a space away from the
  note"). A wavy glyph sits 0.125 sp / 0.075 sp off centre.
- Line thickness `chordlineThickness` **0.16 sp** (`styledef.cpp:2094`, `tdraw.cpp:1202`).
- **Editing:** grips move the path end (straight: one grip) or the Bézier points; the drag is
  clamped so it cannot turn one type into another (`slideBoundary = 5`, and a gradient check that
  refuses the move — `chordline.cpp:94-130`).
- **Playback:** `ChordLineMetaParser` maps the four types to articulations Fall / Doit / Plop /
  Scoop (`playback/metaparsers/internal/chordlinemetaparser.cpp:61-73`). In the legacy MIDI path a
  ChordLine bound to a note sets its `SlideType` (UpToNote / DownToNote / UpFromNote /
  DownFromNote — `dom/note.h:138-144`, `chordline.cpp:222-237`), rendered as **3 semitone steps**
  (`NoteEvent::SLIDE_AMOUNT = 3`, `dom/noteevent.h:42`) before or after the note
  (`compatmidirender.cpp:929-990`). ⚠️ The pitch AMOUNT is never stored — the drawn length has no
  pitch meaning.

**GuitarBend** (`dom/guitarbend.h:30-40`): BEND, PRE_BEND, GRACE_NOTE_BEND, SLIGHT_BEND, DIVE,
PRE_DIVE, DIP, SCOOP. A standard bend *creates* its end note (`GuitarBend::createEndNote`,
`guitarbend.cpp:270-300`); a pre-bend / pre-dive starts on a **created grace note** (a "from
nothing" start made real — `editing/cmd.cpp:795-815`); SLIGHT_BEND, DIP and SCOOP **end on their own
start note** — `bend->setEndElement(note)  // Slight bends don't end on another note`
(`cmd.cpp:816-820`). The SCOOP bend is drawn as the glyph `guitarVibratoBarScoop`
(`tdraw.cpp` GuitarBendSegment draw). Amount stored in quarter-tones (`bendAmountInQuarterTones`).
Line width 0.13 sp (0.15 on TAB), arrow 1.0 × 1.0 sp (`styledef.cpp:1611-1617`).

### 2.2 Verovio

#### 1 · Data model

`class Gliss : ControlElement, TimeSpanningInterface, AttLineRend, AttLineRendBase, AttNNumberLike`
(`include/vrv/gliss.h:24-28`, `src/gliss.cpp:29-37`) — MEI `<gliss>` with `@startid`/`@endid` (or
`@tstamp`/`@tstamp2` through the interface), `@lform` (solid | dashed | dotted | wavy), `@lwidth`,
`@n`. Read by `MEIInput::ReadGliss` (`src/iomei.cpp:6194-6207`). **The text content of an MEI
`<gliss>` is not read** — no child text, no drawing of it.

- **Both ends must be notes to draw:** `if (!note1 || !note2) return;  // … notes with tstamp events
  are not supported` (`src/view_control.cpp:2160-2168`). So a gliss "to nothing" by `@tstamp2`
  parses but **draws nothing**.
- **Chord glissandi:** one `<gliss>` per note pair; there is no pairing rule (the encoder decides).
- **MusicXML import** (`src/iomusxml.cpp:3718-3748`): `<glissando>` and `<slide>` both → `Gliss`,
  `line-type` → `@lform` directly (no default: an absent `line-type` stays unset and draws solid),
  `@type` records which element it came from; closed by `number` + element name. `<doit>`,
  `<falloff>`, `<plop>`, `<scoop>`, `<bend>` → `<artic>` values (`:4609-4620`), but
  **`Artic::GetArticGlyph` has those cases commented out** (`src/artic.cpp:176-182`) — they are
  imported and **not drawn**.

#### 2 · Geometry (`View::DrawGliss`, `src/view_control.cpp:2148-2277`)

x1/x2 arrive as **head centres** (`drawingX + radius`, `:302-312`); y = the note's drawing y
(the head centre). `angle = atan2(Δloc × unit, x2 − x1)`.

- **Start:** move **along the line** by `radius + unit` = half the head + **0.5 sp**
  (`:2183`), i.e. a 0.5 sp gap from the head's edge, measured on the diagonal. If the note is
  dotted and the slope is shallow (`|slope| < 1`), add **0.75 sp per dot** (`1.5 × unit × dots`,
  `:2184-2186`).
- **End, no accidental:** back off `radius + 0.5 sp` along the line (`:2205-2208`).
- **End with an accidental:** stop **0.25 sp** left of the accidental's content box
  (`x2 − accidLeft + 0.5 unit`, `:2196-2198`), then **walk the end forward along the line in 0.5 sp
  steps while it still clears** the accidental's top (descending) or bottom (ascending)
  (`:2199-2203`) — the line may overhang the accidental as far as it can without touching it.
- **Width:** `1.5 × stemWidth`; stemWidth defaults 0.20 unit (`src/options.cpp:1533`) → **0.15 sp**
  (`view_control.cpp:2217`); `@lwidth` narrow/medium/wide multiply by 1 / 2 / 4
  (`include/vrv/vrvdef.h:547-549`).
- **System break:** the **angle is halved** on each piece (`:2177`); the START piece ends at the
  system's last barline, shortened by **0.5 sp** (`:2211-2215`); the END piece starts at the first
  barline with `y1 = note2.y − (x2 − x1)·sin(angle)` (`:2189-2191`). ⚠️ Unlike MuseScore, the two
  halves are not one continuous slope — each piece has half the full angle.
- **Styles:** solid / dashed (`PEN_SHORT_DASH`) / dotted (`PEN_DOT`, width × 1.5) with round caps;
  **wavy** = `wiggleGlissando` (U+EAAF) repeated by `DrawSmuflLine` with
  `count = (length + fill/2) / fill` — **rounded to nearest**, so it may overrun by < ½ glyph
  (`src/view_graph.cpp:297-332`), rotated about the start, vertically centred (`:2248-2258`).
- No minimum length, no text, no cross-staff special case (only the first `@staff` value is used,
  `view_control.cpp:367-372`).

#### 3 · Behaviour

No playback of any kind for `gliss` was found (Verovio's MIDI export was not traced for it —
§5). No editing model.

#### 4 · Free ends: `<pitchInflection>`

`PitchInflection : ControlElement, TimeSpanningInterface` (`include/vrv/pitchinflection.h:23`) —
MEI's bend. Either end may be a note **or a timestamp** (`DrawPitchInflection`,
`src/view_control.cpp:964-1062`):
- the end that is not a note is placed at `topY` = **1 sp above the staff's top line** (`:971`);
- **start is a note ⇒ "up"**: a quadratic Bézier from the note to `topY` (a bend/lift *to nothing*);
  **start is not a note ⇒ "down"**: from `topY` into the end note (a release *from nothing*)
  (`:986-989`);
- control point `(x2, y1)` — the curve leaves horizontally and arrives vertically; an arrowhead
  **0.25 sp** half-width, **0.375 sp** tall at the end (`:1025-1034`); pen = stemWidth (0.1 sp);
- across a break the curve ends mid-height with no arrow; a MIDDLE piece is skipped (`:993-1018`).
- The **pitch amount is not stored or drawn** — the height is always "to 1 sp above the staff".

### 2.3 LilyPond

#### 1 · Data model

- **`\glissando`** is a post-event on the start note (`ly/property-init.ly:412`); the
  `Glissando_engraver` (`scm/scheme-engravers.scm:2487-2604`) makes one `Glissando` spanner per
  start note head and binds the right end to the **next note column's heads** in the same voice.
  **Chord pairing is by index in input order**: left head *i* → right head *i*; extras on either
  side are dropped (unbound glissandi are killed, `:2555-2566`). `glissandoMap` overrides with
  explicit `(from . to)` pairs (`:2497-2513`; documented `Documentation/en/notation/expressive.itely`,
  §Glissando). `NoteColumn.glissando-skip = ##t` lets a line pass over a column
  (`scheme-engravers.scm:2524-2535`).
- **The end cannot be nothing** — an unterminated glissando is killed with a warning
  (`:2590-2598`). The documented idiom for a "glissando without a final note" is a **hidden end
  note** (`Documentation/snippets/contemporary-glissando.ly`), and for a slide *into* a note from an
  imprecise point, a **hidden grace note** with `\glissando` (`snippets/guitar-slides.ly`, which also
  sets `bound-details.left.padding = 0.3`).
- **`\bendAfter #delta`** (`ly/music-functions-init.ly:368-372`) — falls and doits: one number,
  `delta-step`, the pitch interval **in half staff spaces** the curve travels beyond the note
  (`delta-y = 0.5 × delta-position`, `scm/output-lib.scm:1373`). There is **no `\bendBefore`** —
  nothing in `ly/`, `scm/`, `lily/` or the notation manual (grepped).
- **`BendSpanner`** (`scm/define-grobs.scm:562-600`, TAB `\^`) — guitar bends with ¼ ½ ¾ labels;
  note-to-note. Not surveyed further.
- **MusicXML** (`scripts/musicxml2ly.py`): `<glissando>` and `<slide>` → `\glissando`
  (`:2093-2096`); an absent `line-type` defaults to **wavy for `<glissando>`, solid for `<slide>`**
  (`:2161-2162`) — the MusicXML spec's defaults; wavy → `style = #'trill`, dashed/dotted →
  `dashed-line`/`dotted-line` (`python/musicexp.py:2595-2602`). `<falloff>` → `\bendAfter #-4`,
  `<doit>` → `\bendAfter #4` (`musicxml2ly.py:2257-2272`); `<plop>` and `<scoop>` unmapped
  (`:2443`, `:2447`).

#### 2 · Geometry (`lily/line-spanner.cc`, grob defaults `scm/define-grobs.scm:1693-1720`)

- **Left end:** the head's **right edge** (`attach-dir RIGHT`), or — `start-at-dot #t` — the
  **dot's right edge** if the head has one (`line-spanner.cc:204-208`).
- **Right end:** the head's **left edge** (`attach-dir LEFT`), or — `end-on-accidental #t` — the
  **left edge of the accidental placement** (`:176-202`).
- **y = centre of the bound's Y extent** — the head centre (`:417-424`).
- **`padding` 0.5 sp at each end, measured ALONG the line** (`span_points[d] += -d × gap ×
  dz.direction()`, `:597`); if the two paddings exceed the line's length **nothing is drawn**
  (`:589-592`) — LilyPond's only minimum-length rule.
- **thickness** 1 × `line-thickness` (≈ **0.1 sp** at the default staff size; `scm/paper.scm:52-60`).
- **Styles** (`lily/line-interface.cc:219-270`): `line` (default), `dashed-line` (dash-fraction
  0.4, period 1 sp, period stretched so the line starts and ends on a dash), `dotted-line`,
  `zigzag` (Glissando's `zigzag-width` 0.75 sp), `trill` (repeats `scripts.trill_element` —
  LilyPond's "wavy"), `none`. Optional `arrow` at either end (length 1.3 sp, width 0.5 sp).
- **Line breaks: FORBIDDEN by default.** Glissando has `unbreakable-spanner-interface`
  (`define-grobs.scm:1716`), and `Spanner_break_forbid_engraver` sets `forbidBreak` while a
  non-`breakable` one runs (`lily/spanner-break-forbid-engraver.cc:41-72`); the snippet
  `making-glissandi-breakable.ly` is the opt-in. When broken, the slope is made **continuous as if
  the systems were laid end to end**, aligning the *middles* of the start/end staves ("the choice of
  Solomon", `line-spanner.cc:244-395`). Default `after-line-breaking` =
  `kill-zero-spanned-time` removes a continuation piece that spans no time
  (`lily/spanner.cc:556-584`).
- **Cross-staff** is supported (`calc-cross-staff`, `:507-520`; manual example with `\change Staff`).
- **Text:** "Printing text over the line (such as *gliss.*) is not supported" — the manual's
  known-issue (`expressive.itely`, end of §Glissando). `bound-details.<side>.text` puts a markup at
  an END, not along the line.

**BendAfter** (`scm/output-lib.scm:1369-1420`, defaults `define-grobs.scm:552-560`): a spanner from
the note head to the **next musical column** (or the bar line — "don't cross a bar line",
`scheme-engravers.scm:2148-2155`). Start x = head's right edge (or dot's, if the dot is on the
line's height) **+ padding 0.5**; end x = next column's left − 0.5, but at least
**minimum-length 0.5 sp**; y starts at the head centre. Curve: one cubic,
`rcurveto dx/3 0, dx 0.66·dy, dx dy` — leaves horizontally, arrives steep. Thickness **2.0** ×
line-thickness (≈ 0.2 sp). ⚠️ So the **length is not stored** — only the pitch amount is; the width
is whatever the spacing gives up to the next note.

#### 3 · Behaviour

No MIDI performer handles glissandi or bends (no `lily/*performer*` or `scm/*perform*` mentions
either) — LilyPond does not play them. No editing model.

---

## §3 Free ends side by side (the coordinator's addendum: FROM nothing, and TO nothing)

| | stored as | length / angle | pitch amount | drawn as |
|---|---|---|---|---|
| **MuseScore FALL / DOIT** (to nothing) | `ChordLine` on the chord, optionally bound to a note | default 1.2 sp × 1 sp; user drag stored as `lengthX/Y` + a `Path` in sp | **none** (playback: 3 semitones) | cubic, straight line, or `brassFallRoughShort` / `brassLiftShort` |
| **MuseScore PLOP / SCOOP** (from nothing) | same object; `isToTheLeft()` | same, mirrored left of the chord shape, −0.33 sp | none (3 semitones, `SlideType::UpToNote/DownToNote`) | same, mirrored |
| **MuseScore GuitarBend SCOOP / SLIGHT / DIP** | spanner whose end = its own start note | glyph / layout | quarter-tones | `guitarVibratoBarScoop` glyph etc. |
| **MuseScore PRE_BEND / PRE_DIVE** (from nothing, made real) | spanner from a **created grace note** | spacing | quarter-tones | curve + arrow |
| **Verovio `pitchInflection`** | control element, one end a note, other a tstamp | from spacing; y fixed 1 sp above staff | none | quadratic Bézier + arrow |
| **Verovio `@artic` doit/fall/plop/scoop** | articulation | — | — | **not drawn** |
| **LilyPond `\bendAfter`** (to nothing) | a post-event number | to the next note/barline, ≥ 0.5 sp | **yes**: `delta-step` in half-spaces | cubic |
| **LilyPond "from nothing"** | no construct — a hidden grace note + `\glissando` | spacing of the grace | via the hidden pitch | a normal glissando |

Two patterns stand out: **(a)** the free end as a *shape with a stored length/angle and no pitch*
(MuseScore ChordLine), **(b)** the free end as a *pitch with no stored length* (LilyPond
`\bendAfter`, and the hidden-note idiom). Nobody stores both. MuseScore's guitar bends escape the
question by **creating a real note** (end note or grace) at the free end.

---

## §4 Comparison table (note → note glissando)

| | MuseScore | Verovio | LilyPond |
|---|---|---|---|
| end may be empty | ⛔ (deleted) — use ChordLine | parses, ⛔ not drawn | ⛔ (killed) — hidden-note idiom |
| chord pairing | by index from the bottom, clamped to top | encoder's job | by input-order index; `glissandoMap` |
| y at each end | head centre | head centre | head centre (Y-extent centre) |
| same-line slope fix | ±0.25 sp | — | — |
| start gap | chord shape at that height (dots incl.) **+ 0.25 sp** | head edge **+ 0.5 sp along the line**, +0.75 sp/dot if shallow | head (or dot) right edge **+ 0.5 sp along the line** |
| end gap | chord shape in the approach half-height (accidental only if hit) **− 0.25 sp** | head edge − 0.5 sp; accidental: −0.25 sp then slide along while clear | head / accidental left edge **− 0.5 sp along the line** |
| thickness | **0.15 sp** | **0.15 sp** | **≈ 0.10 sp** |
| wavy | `wiggleGlissando` × floor(l/adv), centred | `wiggleGlissando` × round(l/adv) | `trill` element (or `zigzag`) |
| dashed / dotted | yes (distributed dash) | yes | yes (starts/ends on a dash) |
| minimum length | spacing: 1.2 sp straight / 2.0 sp wavy | none | 1 sp (the two paddings), else not drawn |
| system break | segments; ONE continuous slope | pieces with HALF the angle; start piece −0.5 sp | forbidden by default; if allowed, one continuous slope |
| cross-staff | yes | first `@staff` only | yes |
| text | "gliss." Edwin 8 pt italic, centred along the rotated line, +0.1 sp (0.4 wavy) above; dropped if ≥ line length | none | not supported |
| playback | chromatic / white / black / diatonic / portamento (+ harp) | — | none |
| editable in UI | type, show text, text, thickness, style, dash, gap; playback style | — | — |

---

## §5 UNKNOWN — and where it was looked for

1. **Every figure is read, not rendered.** No engine was built or run.
2. **MuseScore's user handles on a glissando segment.** The file's own TODO says draggable segment
   handles and re-attachable ends are not done (`glissando.cpp:23-30`), but `GlissandoSegment` is a
   `LineSegment` with `ElementFlag::MOVABLE` (`:74-77`), so some generic offset editing probably
   exists. Not traced (`LineSegment` edit code not read). **UNKNOWN.**
3. **Verovio's MIDI output for `<gliss>`** — `src/midifunctor.cpp` was not read. **UNKNOWN**
   (the renderer draws only).
4. **MuseScore's MusicXML `<bend>` import** goes through `guitarbendimport/` — not traced.
5. **LilyPond's order of `note-heads` in a note column** — the manual says "in the order in which
   they appear in the input", which the engraver's `(iota (length note-heads))` indexing relies on;
   the array's build order in `Note_column` was not traced to confirm it.
6. **The "gliss." vs "glissando" choice** — no engine chooses between them; MuseScore stores a
   free string (default "gliss."), the others print none. Whether a longer word should be used on a
   long line is a book question, not answered here.

---

## §5b ⚠️ CORRECTION, 2026-09-25 — the ANGLE, re-read from source (his ask: *"double check all angles"*)

- **MuseScore does NOT re-angle before an accidental.** `tlayout.cpp` (~4990–5070) lays the line through the two
  heads' positions at their centre heights, then shortens each end by an x offset and cuts `y` IN PROPORTION
  (`startOffset.ry() = ipos2().y() × startOffset.x() / ipos2().x()`, the same for the end) — the line is shortened
  ALONG ITSELF and keeps the centres' angle. The accidental is only in the x offset (`leftMostEdgeAtHeight` over
  the half of the head the line approaches). §1 above read it as a re-angle; that was wrong.
- **Verovio** (`view_control.cpp` ~2170–2215): the angle is `atan2` of the two heads' positions; before an
  accidental `x2` moves to 0.25 sp (`0.5 × unit`) left of its content and `y2 = note2.y − dist·tan(angle)` — ON the
  line; then it steps forward ½ sp at a time while the end still clears the sign's bottom (rising) / top (falling).
- **LilyPond** (`line-spanner.cc` ~160–230 + `Glissando` bound-details): X from the left head's RIGHT edge to the
  right head's LEFT edge (`attach-dir`), Y the head's centre (`extent … center`); `end-on-accidental #t` moves the
  end X to the accidental's left edge at the SAME Y — the one engine that re-angles. `padding` 0.5 along the line.
- ⇒ rows in `engrave/marks/glissandoLine.GLISSANDO_END_RULES`: `aim: 'centres'` + `truncate` (MuseScore),
  `centres` + `slide` (Verovio), `edges` + `reangle` (LilyPond); Gould's plates `edges` + her leans + `truncate`.

## §6 What the plan should take from this

1. **Model the note→note gliss as a spanner on NOTES (per note, not per chord)**, with the end
   optional — something no surveyed engine does directly. The free-ended case is where the engines
   are weakest; each forks it into another object (ChordLine, pitchInflection, bendAfter, hidden
   note). One model with `end: note | free` avoids MuseScore's four-object split.
2. **For a free end, store the length and angle in staff spaces** (as MuseScore's `lengthX/lengthY`),
   and **optionally a pitch amount** for playback (as LilyPond's `delta-step`, MuseScore's
   quarter-tones). Nobody stores both; we can. A free START (scoop/plop/slide-in) is the same model
   mirrored to the left of the head (MuseScore's `isToTheLeft`), not a separate kind.
3. **Chord pairing default: by index from the bottom** (MuseScore and LilyPond agree on index
   pairing), with an explicit per-note override available by just being per-note data.
4. **Default rows (changeable, per CLAUDE.md's "a number is never a blocker"):**
   - y = head centre at both ends; same-line pitches nudged **±0.25 sp** (MuseScore).
   - end gap: **0.25 sp** off the measured chord ink (MuseScore) *or* **0.5 sp along the line**
     (LilyPond, Verovio) — two sourced options; clear the start's DOTS (all three do) and the
     target's ACCIDENTAL only if the line would hit it (MuseScore's half-height band).
   - thickness **0.15 sp** (MuseScore, Verovio) — LilyPond ≈ 0.10.
   - wavy: `wiggleGlissando` (U+EAAF) repeated `floor(l / advance)`, centred (MuseScore's version
     never overruns).
   - minimum length: **1.2 sp straight / 2.0 sp wavy** as a SPACING request (MuseScore), so the line
     is never too short to see.
   - text: "gliss.", italic, ~8 pt at the default space, **centred along the rotated line**, raised
     **0.1 sp** (0.4 over a wavy line), **dropped when it does not fit** (MuseScore) — the only
     engine that draws it.
   - free-end default size: **1.2 sp wide × 1 sp tall**, **0.33 sp** from the chord ink, y ±0.25 sp
     off the head centre (MuseScore ChordLine); fall/doit curve = LilyPond's cubic
     (`dx/3, 0 → dx, 0.66·dy → dx, dy`) or MuseScore's.
5. **System break:** one line in segments with **one continuous slope** (MuseScore and LilyPond
   agree; Verovio's half-angle is the outlier). LilyPond's refusal to break inside a glissando is a
   defensible house-style option, not a default any editor uses.
6. **Playback:** MuseScore's five styles (chromatic, white keys, black keys, diatonic, portamento)
   are the menu; default chromatic, harp diatonic. A free end plays its stored pitch amount (or
   MuseScore's fixed 3 semitones as the fallback).
7. **Properties window** (MuseScore's panel is the template): type straight/wavy, show text, text,
   thickness, line style (solid/dashed/dotted), dash/gap, playback style. Add what nobody has: end
   free/note, free-end length/angle, pitch amount.
8. **MusicXML mapping for later:** straight → `<slide>`, wavy → `<glissando line-type="wavy">`
   (MuseScore); on import, absent `line-type` = wavy for `<glissando>`, solid for `<slide>` (the
   spec, as musicxml2ly reads it — MuseScore's "every `<glissando>` is wavy" is a looser reading);
   a same-tick start/stop = a free end (MuseScore's fall conversion); `<falloff>` `<doit>` `<plop>`
   `<scoop>` = the free-end variants.
