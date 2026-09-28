# Symbols on the score — a SMuFL glyph anchored to a note or rest

Plan, 2026-09-28. The Symbols window (`docs/plans/symbols-window-plan.md`) browses every SMuFL glyph and
puts nothing on the score. This plan adds the placing: **with a note or rest selected, the window's
*Add symbol* button anchors the chosen glyph to that event** — as many symbols per event as the user
wants.

⭐ This SUPERSEDES the window plan's *"It does NOT put anything on the score"*. That line was right for
the window's own plan — insertion was to be *"a different feature with a different model"*. This is
that feature.

Research (findings only, not decisions):
- `docs/research/symbol-anchoring-engines-research.md` — MuseScore, LilyPond, Verovio, Finale (musxdom),
  VexFlow, from source.
- `docs/research/symbol-anchoring-industry-research.md` — Sibelius, Dorico, Finale, MuseScore, MusicXML,
  MEI, SMuFL, and the books.
- `docs/research/20c-notation-survey.md` §11 *"the escape hatch"* — why this feature exists at all.

---

## 1. What it is — and what it is NOT

**It is the escape hatch** (survey §11): *"a mark whose MEANING I do not model, identified by its SMuFL
glyph name and anchored to this position."* MusicXML's `<other-*>` / `<symbol>` family, MEI's
`<symbol glyph.auth="smufl">`.

- ⛔ **No meaning.** It does not play, does not transpose, does not shorten or accent the note. A
  symbol is a picture. MuseScore plays a free Symbol by its glyph identity (a free accent glyph
  sounds as an accent, `notearticulationsparser.cpp:194-202`) — that is the trap we do not copy.
- ⛔ **Not the first answer for a mark we understand.** A fermata, a harmonic, a bowing is a TYPED
  mark with its own model; storing it as an opaque glyph is *"a modelling failure wearing an escape
  hatch's clothes"* (survey §11). The symbol is for what we do not model.
- ⛔ **Not a graphic score.** Survey §5.4 / §11: ink that is not an event, positioned in the model,
  contradicts Principle 3, and that decision stays open. This feature is always anchored to a
  musical position — it takes nothing from that question, and forecloses nothing (§3).

## 2. Decided — his word, 2026-09-28

| | decision | agrees with |
|---|---|---|
| **Anchor** | the CHORD or REST — the event, not one notehead of a chord | Finale (per entry, not per chord note); MEI `@startid` on a chord |
| **Default place** | ABOVE the staff | Sibelius symbols, Dorico playing techniques, MusicXML `<direction placement>` |
| **Spacing** | it takes NO horizontal room | MuseScore's segment Symbol (explicitly out of spacing, `segment.cpp:2693-2712`); LilyPond's text script without `\textLengthOn` |
| **How many** | as many as the user wants, same glyph twice included | MuseScore (unlimited list, `note.cpp:1372`), Finale |
| **The button** | *Add symbol* in the Symbols window, live only while the selection is a note or rest | Sibelius's *Create Symbol* with a note selected |

## 3. The model — `Measure`, at a beat (proposed; his call)

His question, and the one this plan turns on: *on the note, or in its own level?*

```ts
// types/marks.ts — beside Dynamic
interface ScoreSymbol {        // name: see §4 (h)
  id: string
  glyph: string                // SMuFL canonical name, e.g. 'pictGlsp' — ⛔ never a codepoint
  beat: Fraction               // on a slot boundary, like a Dynamic
  staffId?: string             // absent = staff 0
  voice?: 0 | 1 | 2 | 3        // the event it was added to
  placement?: 'above' | 'below' // absent = above (§2)
}
// Measure.symbols?: ScoreSymbol[]   — list order = the order they were added
```

**Why the measure, and not the chord:**

1. **It is what §2 described.** The research found two anchors, and each product picks one:
   *owned by the note* (follows the notehead, widens spacing — MuseScore's note Symbol, Finale) or
   *owned by a beat on a staff* (keeps its x, stands off the staff, no spacing — Sibelius, Dorico,
   MuseScore's segment Symbol). "Above the staff, no spacing" is the second, word for word.
2. **A rest needs no special case, and survives a refill.** A rest's id is re-minted on every
   `fillRests` (`docs/plans/engraving-overrides-plan.md` §3, decision 6) — a symbol ON the rest, or pointing at
   its id, is lost the first time the bar is re-filled. A beat outlives any rest. (MuseScore agrees in
   its own way: a symbol dropped on a rest goes to the SEGMENT, not the rest.)
3. **It is the house shape.** `Measure.dynamics`, `.tempos`, `.hairpins` are anchored by
   `(beat, staffId, voice)` already — the same readers, the same `Clip` path, the same offset override.
4. **It keeps the door open (engine plan §0.1: *never designed for, never foreclosed*).** A symbol is
   already a mark AT A POSITION. A future free-standing symbol is the same shape with no event under
   it; a genuinely spatial one is Principle 3's open question, untouched.

**Principle checks** (`docs/DESIGN-PRINCIPLES.md`): §3 — the model holds the glyph NAME and a musical
position, no pixels; a hand nudge goes to `engravingOverrides` (§6 P4). §5 — add/remove are score
operations in `engine/models/`, reachable with no editor. §6 — not a global; nothing to resolve
backward, it is simply AT its beat.

## 4. Proposals — his call, one at a time

Each is a proposal; what we build first follows the proposal and is a changeable row (CLAUDE.md: a
number never blocks).

- **(e) Several symbols on one event — STACK, outward from the staff, in the order added.** MuseScore
  does not stack (they overlap and the user drags them apart — the research calls its default
  placement *crude*); Finale stacks in list order (`autoStack`). The gap between two is a row, from
  the articulation research's measured 0.25–0.45 sp (`docs/research/articulation-research.md`,
  `docs/plans/articulation-plan.md` N3) until measured for this.
- **(f) Horizontal — CENTRED on the notehead**, by the glyph's SMuFL `opticalCenter` where the font
  has one, else half its advance width (SMuFL's own stated fallback). Verovio left-aligns a `<dir>` at
  the head's centre and MuseScore puts the glyph's left edge at the head's left — both read as wrong
  for a sign that marks ONE event. For a rest, the rest's centre.
- **(g) When the event is deleted — the symbol STAYS at its beat**, over whatever now stands there
  (a note becoming a rest keeps its symbol). Same as a dynamic. A symbol whose BEAT disappears (the
  bar re-barred so no slot starts there) follows the dynamics' existing rule, whatever it is today —
  ⛔ no new rule invented here.
- **(h) The kind's NAME.** ⚠️ Not the bare word `symbol`: `lint:hubs` reads every `kind: '…'` of
  `EditorState.ts` as a WORD, and `symbol` already appears ~30 times in the hubs (`applyGroupSymbol`,
  a meter's `symbol`, `toggleSymbolsWindow`) — the count would jump and the lint would fail on words
  that are not this feature. A two-word kind is matched only as its whole name. Candidates:
  **`glyphMark`** (it is a mark that is only a glyph), `smuflMark`, `attachedSymbol`. The UI still says
  *Symbol*.
- **(i) Where it stands in the ABOVE-staff order.** A symbol is read at its note, so it needs no
  shared baseline (`docs/how-it-works/above-staff-ladder.md` §1 test), only the skyline push. For the
  order, LilyPond's nearest grob is the `TextScript` (priority 450: outside trill, dynamics and
  ottava, inside the tempo). Proposal: that rung — after the trill and ottava passes, before the tempo.

## 5. Where the code goes — modules, not hubs

| what | module |
|---|---|
| the type | `types/marks.ts`, `Measure.symbols` in `types/score.ts` |
| add / remove / find, the list order | `engine/models/<name>Ops.ts` + spec — ⛔ no `ScoreModel` forwarder |
| the edit: ops call + ONE `mutate` (undo label) | `engine/commands/<name>Commands.ts` + spec on `fakeCommandContext` |
| the drawing: above the staff, centred, stacked, no spacing | `engine/rendering/marks/<name>/` — a pass, in the order of §4 (i) |
| select / highlight / keys | `interactions/elements/<name>.ts` + `<name>Keys.ts`, a row in `ELEMENT_SPECS` and a place in `ELEMENT_HIT_ORDER` |
| the drag | `interactions/drags/<name>.ts`, armed by its element module |
| the button's request | a `RequestChannel` in `bus/`, applied by a controller that holds the engine |
| the button | `windows/symbols/` — reads `bus.selectionInspection`, publishes the request |

The two switches that legitimately grow a case: Delete (`shortcutWiring.deleteSelected`) and the
Properties report (`selectionSnapshot.selectedElements`).

## 6. Phases

Each phase stops for his UI check.

- **P0 — model + ops, no UI.** The type, `Measure.symbols`, add / remove / list order, JSON round-trip
  (an absent list stays absent — no empty arrays written). Specs only.
  ✅ **BUILT 2026-09-28** under the PROPOSED name of (h): `GlyphMark` (`types/marks.ts`),
  `Measure.glyphMarks`, `engine/models/glyphMarkOps.ts`. Beyond the list above, the model's own
  rebuild paths had to know the new array, or it would silently misbehave: **rebar** captures and
  restores it (the dynamics' rule — no dedupe, stack order kept, overrides re-stamped), the **per-staff
  view** (`staffContent`) filters it, and a **prepended staff** leaves it on its own staff
  (`staffContent.solidifyFirstStaffContent`). The render-role table asked too: `'shape'` (drawn, weightless),
  in the shape key with its id-keyed override — revisit if P1 draws outside the measure groups.
  ⚠️ A PASTE onto a region keeps the destination's marks at their beats (the dynamics' overwrite
  rule is not applied) — P5 decides.
- **P1 — drawing.** Above the staff at its beat, centred (f), stacked (e), no spacing, at the rung of
  (i). Geometry by SCENE test (`ScoreRenderer.recordScene`) where it reaches; the glyph's own extent in
  the browser suite. A cue event's symbol: ⏭️ same size as the others until he says.
- **P2 — the button.** *Add symbol* live when the selection is exactly one note or rest; a click adds
  the glyph to that event with one undo step; a second click adds a second symbol. ⏭️ With SEVERAL
  notes selected — one symbol on each, or disabled? His call at P2.
- **P3 — select, delete, keys.** The new kind in the union, its element module, highlight, Delete,
  `x` flips above/below, the Properties report (glyph name + codepoint).
- **P4 — drag + offset.** A `<name>Offset` override in `engravingOverrides`, id-keyed and in staff
  spaces, like `dynamicOffset`; Reset.
- **P5 — copy/paste.** A `Clip` carries symbols the way it carries dynamics (only those fully inside
  the window). ⏭️ MusicXML export as `<direction><direction-type><symbol>` when a MusicXML exporter
  exists — there is none today.

## 7. Later — not a queue

- A symbol's own SIZE (Sibelius: normal / cue / grace / cue-grace).
- Grouping two symbols so they move as one (MuseScore's symbol-on-symbol).
- The composer's LEGEND — Gould p. 494: *"Any symbol requires verbal qualification in a preface or at
  its first appearance"*. A text feature, not this one.
- A free-standing symbol with no event under it (§3 point 4).
- Arming a symbol as a stamp tool (click-to-place) instead of the button.
