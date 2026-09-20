# Ink anchors and side bearings — how LilyPond, MuseScore and Verovio avoid our sign problem

**Written 2026-09-13, from the three engine clones in `~/dev/engine-sources`
(`reference/README.md` §"engine sources on disk").** This is a **research document**: it surveys
what the three engines *do*, with a file:line behind every claim. ⛔ It does not know what we
decided, it proposes no value, it recommends no change and it contains no work list. The repo's
owner settles our own question by measurement.

Revisions the citations are against — ⭐ **re-check them before quoting a line number**, these
clones move:

| clone | HEAD | date |
|---|---|---|
| `~/dev/engine-sources/lilypond` | `beedbfa0752ae51daede7cc4ff04a25a0c39683f` | 2026-08-03 |
| `~/dev/engine-sources/MuseScore` | `929d1e99d729e273cb6466fed98e082339106b1a` | 2026-08-18 |
| `~/dev/engine-sources/verovio` | `efff0bc992416d6af3f616bd5745f18bc3bfe933` | 2026-08-18 |

---

## 1. The question, and where it came from

This editor states header gaps as **clear white, ink edge to ink edge** — *"1.0 staff spaces between
the clef's ink and the time signature's ink"*. To draw that, a stated white gap has to be converted
into a glyph **position**, and a glyph's ink does not begin at its origin: our font table
(`src/engine/fonts/bravuraMetrics.ts`) gives `timeSig4` a left side bearing of **−0.08 staff
spaces**, `fClef` **+0.02**, `gClef` **0**.

Two places in our code perform that conversion, and they use **opposite signs for the bearing**:

- **`src/engine/rendering/staff/headerPlacementPass.ts`**, `meterOrigin()` — the two arms, with the
  contradiction stated in its own 🚨🚨 comment. The key-signature arm returns
  `keySignatureInkRight(...) + KEY_TO_METER_INK * space + bearing`; the clef arm calls
  `meterOriginX(inkRight + armedClefMeterInk() * space, glyphBox('timeSig4').left, space)`.
- **`src/engine/engrave/header/meter.ts`**, `meterOriginX()` — `inkLeftX - glyphLeft * space`.

Measured in a real browser, **each is correct against its own spec**: written with `meterOriginX`
for both anchors, `e2e/headerGap` measured the clef→meter white at **0.80** against the armed 1.0;
written the other way, `e2e/keySignature` measured the key→meter gap at **1.31** against the
stated 1.15. Both wrong by exactly **2 × 0.08 = 0.16 sp**. One conversion cannot be both, so one of
the two **anchors** — the ink-right of a key signature (`keySignatureInkRight`, in
`src/engine/rendering/staff/KeySignaturePass.ts`) or the ink-right of a clef taken from the font table —
is off by twice a bearing.

⭐ **What was asked of the engines was not "what is the right sign" but "why do they never have to
ask".** That is section 5, and it is the point of the document.

⚠️ One measurement worth recording because it validates the premise rather than the answer:
Verovio's own Bravura metrics file agrees with our table to the digit —
`<g c="E084" x="20.0" … h-a-x="470" n="timeSig4"/>` and `<g c="E050" x="0.0" … n="gClef"/>`
(`verovio/data/Bravura.xml`). At SMuFL's 250 font units per staff space that is a `timeSig4` left
side bearing of **0.08 sp** and a `gClef` bearing of **0**. The bearing is real, it is the size we
think it is, and three independent engines carry it.

---

## 2. MuseScore

**The placement anchor is the origin; the SPACING never sees an origin.** Each item's layout writes
its ink into a `Shape` — a list of `ShapeElement` rects, each a `RectF` with the item that owns it
(`MuseScore/src/engraving/infrastructure/shape.h:45-62`) — in the item's own coordinates, and
`Segment::createShape` then folds the origin in exactly once:
`s.add(e->shape().translate((e->isClef() ? e->ldata()->pos() : e->pos()) + e->staffOffset()))`
(`src/engraving/dom/segment.cpp:2641`). From that point the segment holds **ink boxes in segment
coordinates** and nothing downstream knows where an origin was.

**The stated distance is applied ink edge to ink edge.** The whole of MuseScore's horizontal spacing
reduces to one line in `HorizontalSpacing::minHorizontalDistance(const Shape& f, const Shape& s, …)`
(`src/engraving/rendering/score/horizontalspacing.cpp:1221`):

```cpp
// horizontalspacing.cpp:1261
dist = std::max(dist, r1.right() - r2.left() + padding);
```

`r1` and `r2` are ink rects; `padding` is looked up per **element-type pair** by
`HorizontalSpacing::computePadding` (`horizontalspacing.cpp:1450-1477`) in the `PaddingTable`
(`src/engraving/rendering/paddingtable.cpp:41`), which is a full `TOT_ELEMENT_TYPES` ×
`TOT_ELEMENT_TYPES` matrix initialised to a floor of `0.1 * spatium` (`paddingtable.cpp:30-39`).
The header entries are `table[CLEF][KEYSIG] = Sid::clefKeyDistance`,
`table[CLEF][TIMESIG] = Sid::clefTimesigDistance` (`paddingtable.cpp:124-125`) and
`table[KEYSIG][TIMESIG] = Sid::keyTimesigDistance` (`paddingtable.cpp:147`), defaulting to
`0.75_sp`, `1.0_sp` and `1.0_sp` (`src/engraving/style/styledef.cpp:221-223`). The result is
consumed as `x = xPrevSeg + minHorizontalDistance(prevSeg, segment, …)`
(`horizontalspacing.cpp:385-388`) — a distance between segment **origins**, *derived from* ink. The
bearing enters once, inside the box, on both sides, and has no sign to get wrong.

**The ink extent is the real font's box, measured at font-load time, and it is not the advance.**
`EngravingFont::computeMetrics` stores both, separately:
`sym.bbox = fontProvider()->boundingRect(m_font, sym.code); sym.advance = fontProvider()->horizontalAdvance(...)`
(`src/engraving/internal/engravingfont.cpp:853-854`). ⭐ Note it queries the **loaded font**, not
the SMuFL metadata — `EngravingFont::load` reads `glyphsWithAnchors` from the JSON
(`engravingfont.cpp:140`) but never `glyphBBoxes`. `EngravingFont::bbox` returns that box scaled
(`engravingfont.cpp:913-921`) and `width()` is `bbox(id, mag).width()` (`engravingfont.cpp:1050`),
while `advance()` is the separate `sym.advance` (`engravingfont.cpp:1058-1065`). ⭐⭐ The two are
used for **different jobs**: `advance` composes a run of glyphs into one box
(`bbox(const SymIdList&…)`, `engravingfont.cpp:928-935`), `bbox` faces the neighbours.

**The clef and the time signature are anchored differently, and it does not matter.**
`TLayout::layoutTimeSig` finishes with `ldata->setPosX(-shape.bbox().left())`
(`src/engraving/rendering/score/tlayout.cpp:6392`) — the sign's origin is normalised onto its own
ink-left edge. `TLayout::layoutClef` does the opposite, twice over:
`double x = isMidMeasureClef ? -shape.right() : 0.0;` (`tlayout.cpp:1851`, under the comment
*"clefs on palette or at start of system/measure are left aligned / other clefs are right aligned"*,
`tlayout.cpp:1847-1848`) — a header clef keeps its raw origin, a mid-measure clef is normalised onto
its ink-**right**. ⭐ **Three different anchoring conventions in one engine, and the spacing is
still exact**, because the spacing reads shapes rather than origins. The normalisations exist so
that an item's `x` means something to *other* code (a courtesy alignment, a drawing offset), not to
protect the distance.

**The key signature.** `keySigAddLayout` walks the run with
`x = previous.xPos + previousWidth + accidentalGap` (`tlayout.cpp:3480`) where `previousWidth` is
`item->symWidth(previous.sym)` — the **ink** width, not the advance (`tlayout.cpp:3479`) — plus a
SMuFL cut-out kern that pulls an ascending or descending neighbour in by
`item->symSmuflAnchor(sym, cutOutSW|cutOutNW).x` (`tlayout.cpp:3482-3491`). ⚠️ That inner walk is
*itself* origin-to-origin arithmetic and would drift if two adjacent members had different bearings
(sharp vs natural); in practice every accidental in our own Bravura table has a bearing of 0, and
MuseScore never lets the question reach the outside world anyway — **the run's contribution to
spacing is rebuilt from true ink**: `layoutKeySig` re-walks the symbols and unions
`item->symShapeWithCutouts(ks.sym)` translated to each `x` into `keySigShape`
(`tlayout.cpp:3708-3717`). So the signature's right edge as the spacer sees it is the **last
accidental's ink**, with no padding baked in and no advance involved.

⭐⭐ **And where MuseScore does have to write the conversion by hand, it writes it whole.** The
system bracket placement is the canonical form:

```cpp
// src/engraving/rendering/score/systemheaderlayout.cpp:978
b->mutldata()->setPosX(bb->x() + bb->ldata()->bbox().right() - b->ldata()->bbox().left() + bracketsDist);
```

`origin_next = origin_prev + inkRight(prev) − inkLeft(next) + gap`. **Both** bearings appear,
**each** with its own sign, in **one** expression. There is no half of it to get wrong.

---

## 3. LilyPond

**A glyph stencil's reference point IS the glyph origin, and its extent carries the side bearing.**
`Font_metric::find_by_name` builds `Stencil q (b, expr)` from an untranslated `named-glyph`
expression and the metric box (`lilypond/lily/font-metric.cc:45-53`), so the stencil's x=0 is the
origin and `b[LEFT]` is whatever the font says — typically the left side bearing, possibly negative.
The box comes from the `bbox` entry of the font's embedded `LILC` character alist in
`Open_type_font::get_indexed_char_dimensions` (`lily/open-type-font.cc:393-405`), with a FreeType
fallback `ly_FT_get_unscaled_indexed_char_dimensions` returning `Interval (hb, hb + m.width)` from
`horiBearingX`/`width` (`lily/freetype.cc:50-65`) — ⭐ the **ink/black box**, and `m.horiAdvance` is
never read. A true measured-outline box exists (`ly_FT_get_glyph_outline_bbox` via
`FT_Outline_Get_BBox`, `lily/freetype.cc:67-88`) but serves skylines and Pango
(`lily/pango-font.cc:206`), **not** `find_by_name`.

**The stated distance is applied extent to extent.** The header run (clef · key · time) is laid out
by `Break_alignment_interface::calc_positioning_done`
(`lily/break-alignment-interface.cc:129-286` — ⚠️ the file is `break-alignment-interface.cc`, not
`break-align-interface.cc`). It snapshots each group's own extent at
`extents.push_back (g->extent (g, X_AXIS))` (`:141-142`), reads the `space-alist` entry on the left
item keyed by the right item's `break-align-symbol` (`:180`, `:201`), and:

```cpp
// lily/break-alignment-interface.cc:241-246
if (scm_is_eq (type, ly_symbol2scm ("extra-space")))
  offsets[next_idx]
    = extents[idx][RIGHT] + distance - extents[next_idx][LEFT];
/* should probably junk minimum-space */
else if (scm_is_eq (type, ly_symbol2scm ("minimum-space")))
  offsets[next_idx] = std::max (extents[idx][RIGHT], distance);
```

The offsets accumulate into origin translations (`here += offsets[i]; elems[i]->translate_axis (here, X_AXIS)`,
`:279-283`). So `extra-space` is **exactly the MuseScore bracket form**:
`origin_next = origin_left + inkRight(left) + distance − inkLeft(next)` — ⭐ both bearings, both
signs, one expression. The `distance` values are the `space-alist` entries in
`scm/define-grobs.scm` (Clef `:915-926`, e.g. `(key-signature . (extra-space . 0.82))` and
`(time-signature . (extra-space . 1.52))`; KeySignature `:1987-1997`; TimeSignature `:3951-3959`).

⚠️ **`minimum-space` is the exception and LilyPond calls it out in a code comment.** It omits the
`− extents[next_idx][LEFT]` term, so it measures from the left item's ink-right to the next item's
**ORIGIN**; `scm/define-grob-properties.scm:1179-1183` describes it as *"between the left sides"*,
and `break-alignment-interface.cc:244` says *"should probably junk minimum-space"*. ⭐⭐ That is the
same asymmetric shape our two arms disagree about — and the engine that ships it has flagged it as
the one it wants to remove.

**The key signature.** `Key_signature_interface::print` fetches each accidental with
`fm->find_by_name (glyph_name)` (`lily/key-signature-interface.cc:83`) and joins the run with
`mol.add_at_edge (X_AXIS, LEFT, column, padding)` (`:117`). `Stencil::add_at_edge` computes
`Real offset = first_extent[d] - next_extent[-d];` then `offset += d * padding;`
(`lily/stencil.cc:278-282`) — ⭐ **the same extent-to-extent form again, one level down**: the run
advances by ink edges plus an explicit padding, never by the advance width. `padding` defaults to
0.0 (`key-signature-interface.cc:106`), is overridable per glyph pair via `padding-pairs`
(`:107-110`), and gets an automatic +0.3 / +0.15 for naturals (`:111-115`). Because glyphs are added
at the LEFT edge, the assembled stencil's **right extent is the first-processed accidental's ink
right, with no trailing padding**. The whole stencil is then normalised —
`mol.align_to (X_AXIS, LEFT)` (`:124`), which is
`translate_axis (-i.linear_combination (x), a)` (`lily/stencil.cc:232-240`) — so the KeySignature's
origin sits on its own ink-left. `Clef::print` (`lily/clef.cc:52-68`) returns the raw stencil with
**no** normalisation, and TimeSignature goes through markup (`scm/time-signature.scm:31-42` →
`\musicglyph`, `scm/define-markup-commands.scm:4400-4425`) with **no** normalisation either.

⭐ So LilyPond, like MuseScore, normalises **one** of the three and not the others — and it likewise
does not matter, because `calc_positioning_done` never reads an origin: it reads
`g->extent (g, X_AXIS)` (`:142`), and any un-normalised bearing is absorbed by the
`− extents[next_idx][LEFT]` term.

---

## 4. Verovio

**The ink extent is the font's own box, parsed once at load.** `Glyph` holds `m_x, m_y, m_width,
m_height` (`verovio/include/vrv/glyph.h:120-124`), read by `Resources::LoadFont` from the metrics
XML's `x/y/w/h` attributes at `src/resources.cpp:384`, with the advance read separately from
`h-a-x` at `src/resources.cpp:396`. `Glyph::GetBoundingBox` (`src/glyph.cpp:99-105`) and
`Glyph::GetHorizAdvX` (`glyph.h:80`) are the accessors. The origin is x=0 and `m_x` is a genuine,
possibly nonzero left side bearing — `data/Bravura.xml` has
`<g c="E084" x="20.0" y="-250.0" w="430.0" h="501.0" h-a-x="470" n="timeSig4"/>` against
`<g c="E050" x="0.0" … w="671.0" h-a-x="671" n="gClef"/>`.

**The bounding box used for spacing is produced by a real draw pass, but the geometry drawn is that
font box.** `Page::LayOutHorizontally` renders the page into a `BBoxDeviceContext` before any
spacing functor (`src/page.cpp:406-412`, `view.DrawCurrentPage(&bBoxDC, false)`);
`BBoxDeviceContext::DrawMusicText` pushes `x + g_x*size/upm` … `x + (g_x+g_w)*size/upm` into
`UpdateBB` → `UpdateSelfBBoxX` (`src/bboxdevicecontext.cpp:354-386`, `:421`), and
`BoundingBox::UpdateSelfBBoxX` stores it relative to `GetDrawingX()` (`src/boundingbox.cpp:83-99`).
So the self-bbox is the SMuFL box, side bearing included, expressed as an offset from the origin —
which is what makes `GetSelfLeft() = GetDrawingX() + m_selfBB_x1` and
`GetSelfRight() = GetDrawingX() + m_selfBB_x2` (`include/vrv/boundingbox.h:106-107`) genuine ink
edges.

**Drawing places the ORIGIN; spacing compares INK.** `View::DrawClef` uses
`x = element->GetDrawingX()` and hands it to `DrawSmuflCode` unmodified
(`src/view_element.cpp:724`, `:758`; `src/view_graph.cpp:279-295`), and the same for
`View::DrawKeySig` (`:1060`) and `View::DrawMeterSig` (`:1185`).

**The crux — the margin is added between two ink edges.** Header clef/keySig/meterSig are aligned as
`ALIGNMENT_SCOREDEF_CLEF/KEYSIG/METERSIG` (`src/alignfunctor.cpp:230, 242, 267-279`), for which
`Alignment::PerformBoundingBoxAlignment()` is false (`src/horizontalaligner.cpp:712-715`), which
selects:

```cpp
// src/adjustxposfunctor.cpp:341-345
if (!performBoundingBoxAlignment) {
    selfLeft = layerElement->GetSelfLeft();
    selfLeft -= m_doc->GetLeftMargin(layerElement) * drawingUnit;
    return { 0, selfLeft };
}
```

against the running right edge

```cpp
// src/adjustxposfunctor.cpp:157
selfRight = layerElement->GetSelfRight() + m_doc->GetRightMargin(layerElement) * drawingUnit;
```

with `m_upcomingMinPos = std::max(selfRight, m_upcomingMinPos)` (`:189`) and the push at `:141-147`.
⭐ So the enforced gap A→B is `rightMargin(A)*unit + leftMargin(B)*unit`, measured **A's ink right to
B's ink left** — never origin to origin, and never a mix. `Doc::GetLeftMargin`/`GetRightMargin`
dispatch by ClassId (`src/doc.cpp:2153-2156`, `2190-2193`); `leftMarginClef`, `rightMarginClef`,
`leftMarginKeySig`, `rightMarginKeySig`, `leftMarginMeterSig`, `rightMarginMeterSig` all default to
1.0 MEI unit (`src/options.cpp:1713, 1717, 1729, 1783, 1787, 1799`). ⚠️ Note the *pair* is expressed
as **two half-gaps, one owned by each side**, rather than MuseScore's and LilyPond's single
pair-keyed number.

**The key signature run is the one place Verovio advances by ADVANCE.** `View::DrawKeyAccid` does
`x += extend.m_width` (`src/view_element.cpp:1166`), and `DeviceContext::AddGlyphToTextExtend`
defines that width as a sum of advances: `extend->m_width += (advX == 0) ? partialWidth : advX;`
(`src/devicecontext.cpp:327`). On top of that `View::DrawKeySig` adds a fixed step per accidental,
`x += step` with `step = GetDrawingUnit(...) * TEMP_KEYSIG_STEP` and `TEMP_KEYSIG_STEP 0.4`
(`src/view_element.cpp:1062`, `:1094`; `include/vrv/options.h:52`), naturals using
`TEMP_KEYSIG_NATURAL_STEP 0.6` (`:1134`, `:1148`). ⭐ But the run's **right edge for spacing is still
the last accidental's ink**, because the trailing `x += step` draws nothing and the self-bbox is
only ever grown by `UpdateBB` from real glyph ink (`src/bboxdevicecontext.cpp:379-381`). The advance
decides the internal rhythm; the ink decides the interface.

**No bearing normalisation in the spacing path.** The only `-GetSelfX1()` in the tree is
`AdjustXRelForTranscriptionFunctor::VisitLayerElement`
(`src/adjustxrelfortranscriptionfunctor.cpp:30`), gated on facsimile/transcription mode.
`Doc::GetGlyphLeft` (`src/doc.cpp:1920-1931`) exists and returns the scaled `m_x`, but is used only
to place decorations *around* a glyph — `View::DrawClefEnclosing` (`src/view_element.cpp:776`),
`View::DrawDynamSymbolOnly` (`src/view_control.cpp:1926`).

---

## 5. Comparison

| | **LilyPond** | **MuseScore** | **Verovio** |
|---|---|---|---|
| **Placement anchor** | the grob's **origin**, translated so its **extent** lands right (`break-alignment-interface.cc:279-283`) | the item's **origin**; the shape is translated by it once (`segment.cpp:2641`) | the element's **origin** (`view_element.cpp:724`), moved via `Alignment::GetXRel` |
| **Origin normalised onto ink?** | KeySignature **yes** (`align_to (X_AXIS, LEFT)`, `key-signature-interface.cc:124`); Clef **no**; TimeSignature **no** | TimeSig **yes, ink-LEFT** (`tlayout.cpp:6392`); mid-measure Clef **yes, ink-RIGHT** (`tlayout.cpp:1851`); header Clef **no** (`x = 0`) | **no** (except facsimile mode, `adjustxrelfortranscriptionfunctor.cpp:30`) |
| **…and does that matter?** | **No** — spacing reads `g->extent()` | **No** — spacing reads `Shape` | **No** — spacing reads `GetSelfLeft/Right()` |
| **Where the ink box comes from** | font's `LILC` `bbox`, FreeType `horiBearingX + width` fallback (`open-type-font.cc:393-405`, `freetype.cc:50-65`) | the **loaded font**, queried at load: `fontProvider()->boundingRect` (`engravingfont.cpp:853`) — ⛔ not the SMuFL `glyphBBoxes` | the metrics **XML** `x/y/w/h`, parsed at load (`resources.cpp:384`); re-emitted through a real draw into `BBoxDeviceContext` |
| **Advance used for spacing?** | **never** (`m.horiAdvance` unread) | **no** — `advance` composes runs, `bbox` faces neighbours (`engravingfont.cpp:928-935` vs `:1050`) | **only inside** the keysig run (`view_element.cpp:1166`); the run's outer edge is ink |
| **Shape of the arithmetic** | `origin_next = origin_left + inkRight(left) + distance − inkLeft(next)` (`:241-243`) | `x_next = x_prev + max(inkRight(r1) − inkLeft(r2) + padding)` (`horizontalspacing.cpp:1261`, `:386`) | `inkRight(A) + rightMargin(A) ≤ inkLeft(B) − leftMargin(B)` (`adjustxposfunctor.cpp:157`, `:341-345`) |
| **The distance is keyed on** | the **pair** — `space-alist` on the left item, keyed by the right item's `break-align-symbol` (`define-grobs.scm:915-926`) | the **pair** — a full type×type `PaddingTable` (`paddingtable.cpp:41`) | **each side separately** — `left/rightMargin<Class>` (`options.cpp:1713-1799`) |
| **Key-sig run advances by** | ink extents + explicit `padding` (`stencil.cc:278-282`) | ink width + `keysigAccidentalDistance` + a SMuFL cut-out kern (`tlayout.cpp:3479-3491`) | **advance** + `TEMP_KEYSIG_STEP 0.4` (`view_element.cpp:1094`, `:1166`) |
| **Key-sig run's right edge for spacing** | the last-placed accidental's **ink**, no trailing padding (`:117`, `:124`) | rebuilt from true ink (`tlayout.cpp:3708-3717`) | the last accidental's **ink** — the trailing step draws nothing |
| **A known asymmetric case in the engine** | `minimum-space` — ink-right → **origin**; comment says *"should probably junk"* (`:244-246`) | none found | the two-half-gap form is symmetric, but each half is a separate style knob |

---

## 6. ⭐⭐ What would make this class of bug impossible

Five patterns, all three engines, none of them a constant.

**A. The distance never touches an origin — it is a relation between two INK BOXES, and the origin
is what falls out.** All three state the rule as a predicate over ink and *solve* for the position:
LilyPond `offsets[next] = extents[idx][RIGHT] + distance − extents[next][LEFT]`
(`break-alignment-interface.cc:241-243`), MuseScore `dist = r1.right() − r2.left() + padding`
(`horizontalspacing.cpp:1261`), Verovio `selfLeft − leftMargin ≥ selfRight + rightMargin`
(`adjustxposfunctor.cpp:157`, `:341-345`). ⭐ In that shape a bearing is **not a term** — it is
inside both boxes, and there is nothing with a sign to put in front of it. Our failure needs a
formula in which one bearing appears *alone*.

**B. The conversion, where it is written by hand, is written WHOLE — both bearings, in one
expression.** `setPosX(bb->x() + bb->ldata()->bbox().right() − b->ldata()->bbox().left() + bracketsDist)`
(`MuseScore/src/engraving/rendering/score/systemheaderlayout.cpp:978`) is the canonical line. Both
`inkRight(prev)` and `inkLeft(next)` appear, each once, each with its own sign. An expression
containing only one of them is *by construction* half a conversion, and half a conversion is what a
reader reads as "the bearing, accounted for".

**C. There is ONE such expression per engine, so two of them can never disagree.** MuseScore's
whole spacing narrows to one line in one function; LilyPond's header run to one `if/else` in
`calc_positioning_done`; Verovio's to one functor. ⭐ Our problem is not that a sign is wrong — it
is that **the rule is expressed twice**, and two expressions of one rule do not disagree loudly,
they disagree by a bearing. All three engines make the disagreement unrepresentable rather than
detectable.

**D. Item geometry is a BOX carried as a value, not an x plus a remembered convention.**
`Shape`/`ShapeElement` (`shape.h:45-62`), `Stencil` + `Interval` extents, `BoundingBox`'s
`m_selfBB_x1/x2` — in each case an item hands the spacer *"here is my ink, in my coordinates"*, and
the frame change happens once, at a named seam (`segment.cpp:2641`;
`break-alignment-interface.cc:141-142`; `boundingbox.cpp:83-99`, which subtracts `drawingX`
explicitly). A `left: number` in a table has to be re-interpreted at every call site; a box does
not, because the only operation available on it is the right one.

**E. Advance and ink are two different numbers with two different jobs, and the split is
enforced.** MuseScore stores both on the same `Sym` and uses `advance` **only** to compose a run of
glyphs into one box and `bbox` **only** to face the neighbours
(`engravingfont.cpp:853-854`, `:928-935`, `:1050`, `:1058-1065`). LilyPond never reads
`horiAdvance` at all. Verovio uses the advance inside the keysig run and the ink at its boundary.
⭐ The invariant is the same in all three: **an advance may decide the internal rhythm of a run; only
ink may face the outside.** Where an engine breaks that invariant internally — MuseScore's
`keySigAddLayout` really is origin-to-origin arithmetic (`tlayout.cpp:3480`) — it is contained,
because the run's shape is then **rebuilt from ink** before anything else can see it
(`tlayout.cpp:3708-3717`). ⭐⭐ A local convention is survivable exactly as long as it cannot escape
into a second module.

**F. And the one engine that does have our asymmetric form has flagged it.** LilyPond's
`minimum-space` measures ink-right → **origin** while `extra-space` measures ink-right → ink-left,
and the line above it reads `/* should probably junk minimum-space */`
(`break-alignment-interface.cc:244`). ⭐ Two spacing types in one engine, differing by exactly a
bearing, with the asymmetric one marked for removal — that is the closest thing in the three
codebases to an independent verdict on the shape of our two arms.

---

## 7. UNKNOWN

⛔ Never guessed, never inferred from a constant's name. What could not be established:

- **MuseScore's `IFontProvider::boundingRect` implementation.** The `muse` framework is a submodule
  and is **not checked out** in this clone (`git submodule status` → `-6308157d…  muse`). The call
  site is unambiguous (`engravingfont.cpp:853` queries the loaded font for the glyph's bounding
  rect, not the SMuFL metadata), but whether it goes to FreeType, Qt or a Harfbuzz path, and
  whether it is a tight outline box or a table box, is **UNKNOWN from these sources**.
- **Whether Emmentaler's `LILC` `bbox` values are the true tight outline box** or a hand-authored
  METAFONT `set_char_box` that may differ from ink. The generation side is
  `mf/feta-autometric.mf:163-166` / `scripts/build/mf2pt1.pl:518-557`; not traced end to end. The
  consumer (`lily/open-type-font.cc:393`) treats it as the glyph's box, whatever it is.
- **Whether Verovio's `data/*.xml` `x/w` values were generated from real outlines or from the font's
  `hmtx`/bbox tables.** The generator is outside the tree.
- **LilyPond `extra-spacing-width`** on KeySignature (`scm/define-grobs.scm:1983`) and TimeSignature
  (`:3939`): its only C++ consumer was found to be `lily/separation-item.cc:167` (note-column
  skyline spacing), but it was **not** verified that it has no effect path into break-alignment.
- **How grobs *inside* one `BreakAlignGroup` get their X-offset**, and whether
  `Self_alignment_interface` participates in the clef/key/time header path — not traced.
- **LilyPond `lily/staff-spacing.cc:143-210`** (the `first-note`/`next-note` spring side, with
  `fixed = last_ext[RIGHT]` at `:166`) was read but its interaction with `calc_positioning_done`
  was not verified.
- **Verovio `src/adjustxoverflowfunctor.cpp`** was not read; its role in header-glyph horizontal
  placement is unverified. Likewise `AdjustClefChangesFunctor` (`src/adjustclefchangesfunctor.cpp:90`).
- **Whether a `ALIGNMENT_SCOREDEF_*` element ever reaches `AdjustXPosFunctor` with an empty
  self-BB** — which would switch it to the origin-based branch at `adjustxposfunctor.cpp:151`.
  Plausible for a C-major KeySig via `keySig->SetEmptyBB()` (`src/view_element.cpp:1051`), not
  confirmed at runtime.
- **Whether any LilyPond init file sets a nonzero `KeySignature.padding` default.** Only
  `padding-pairs` overrides were found (`ly/persian.ly:332`, `ly/turkish-makam.ly:522`).
- **Sibelius, Finale, Dorico** were not consulted — they are not on disk and are not open source.
