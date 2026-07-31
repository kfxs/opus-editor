# Barline selection — pointing at the line between two bars

Click a barline and it highlights; `←`/`→` walk to the previous/next one. It is the handle the
bar-width gesture hangs off (`Shift+Alt+←/→`, docs/bar-width-plan.md), and deliberately nothing
else — selecting a barline changes no music.

## 1. Identity — a barline is a BOUNDARY, not an object

`EditorState.selectedBarlineMeasure: number | null` — **the measure the line ENDS**. Not an id,
because there is no object to have one: a barline is the boundary between bar *n* and bar *n+1*,
and both bars draw one there.

Two consequences fall out of that and neither is incidental:

- **It is staff-less.** One barline is stated once for the system, like a time signature, and drawn
  once per staff. Whichever staff a click lands on, the whole line is what gets picked.
- **Navigation is arithmetic.** The barline after the one ending bar *n* is the one ending bar
  *n + 1*. `SelectionController.navigateBarline` needs no geometry at all.

> ⚠️ *"…and both bars draw one there"* was true of the DRAWING until 2026-07-31 and is not any more
> — the boundary is drawn once, by the bar it ends (`src/engine/rendering/barlineInk.ts`). The
> identity above is unaffected: it was always about the model, where a barline has no object at all.

## 1a. ⭐ A press may only reach INK

The hit-boxes and the drawing come from different tiers and do not agree:

- **Tier 1** registers the staff, the opening clef, the meter and the barline for **every bar in the
  score**, drawn or not. That is deliberate — it is what keeps pixel↔position honest for music
  scrolled out of the window.
- **Tier 2** paints only the bars inside the cull window.

So a culled bar has a barline hit-box and no barline. Reported from use as *"the selection is in a
hidden barline and is not possible to move it"*: the press selected the invisible line, and the
bar-width drag then measured its room from the bar's drawn columns, found none, and declined in
silence — selectable, invisible, immovable.

`ElementRegistry.isPainted(measure, staff)` is the fix and the rule: **a hit-test that a human aims
with asks it first**, and the press falls through to whatever is genuinely under it. It applies to
the three kinds tier 1 registers — barline, clef, time signature — and to the barline highlight,
which would otherwise paint an orange mark across a bar that had scrolled away. Everything else is
tier 2 and cannot have the problem.

Two more things the same report turned up, both fixed:

- **Nearest, not first-registered.** Two padded 4px boxes can cover one press; `find` handed it to
  whichever bar was numbered lower. Between two real barlines the answer is the one you aimed at.
- **⚠️ A no-op preview frame used to poison the next gesture.** `previewBarWidth` marked the model
  dirty on every frame, including ones that stored the same value — which is how every drag pushed
  past its clamp ends. The drag repaints only on a frame that *changed* something, and only a render
  clears the flag, so the model stayed dirty and `barWidthRoom` (which refuses on a dirty model,
  correctly) answered null for every later drag. **Drag one barline hard and the next one would not
  move.** Now the flag is set only when the stored value actually changes. `previewNoteSpacing` had
  the identical shape and got the identical fix.

## 2. Navigation

`←`/`→` are dispatched on **what is selected** — the same seam that makes `Shift+Alt+←/→` mean note
spacing on a note and bar width on a barline. A barline selection and a note selection are disjoint
(picking a barline clears the note), so this is a guard on the arrow handlers, not a mode.

⚠️ **It CLAMPS at both ends rather than deselecting.** Note navigation drops the selection when it
runs off the end, which suits it — a note is one of thousands and losing it costs a click. There are
far fewer barlines and you are usually holding one *because you are working on it* (width, mostly,
where one press is one of many). Letting go at the edge would throw that away for a keystroke that
meant "no further". The key is still consumed, so it does not fall through to note navigation.

Scroll-into-view goes through `getMeasureRect`, which is tier-1 geometry: it answers for bars
virtualization has never drawn, which is exactly when scrolling matters.

## 3. ⭐ The highlight is PAINTED, not recoloured

**This is the part worth reading.** It shipped as a recolour — draw the score black, then find
VexFlow's own `<rect>`s and change their `fill` — and every bug it had was a *finding* failure,
never a painting one. Four of them, all reported from use:

1. **One barline on screen is TWO drawn rects.** Bar *n*'s end and bar *n+1*'s begin sit at the same
   x; the later group paints over the earlier, so colouring one left a faint shadow.

   > ⚠️ **No longer true of the drawing, as of 2026-07-31** (`src/engine/rendering/barlineInk.ts`):
   > the duplicate was a defect in its own right — two coincident lines cover their shared
   > anti-aliased edge pixels twice, so every interior barline came out heavier than the one opening
   > or closing a system — and a bar now draws only the barline that ENDS it. It stays on this list
   > because the *lesson* is what the rest of this section is built on, and because it was true for
   > every reader of this file until that commit.
2. **The second rect is not always in the next measure's group.** Reaching in there for it found
   nothing, and the black half stayed black.
3. **⚠️ The coordinates lie.** A render that REUSES a measure it did not redraw moves it with a
   `translate` on the group (`VexFlowRenderer.replaySnapshot`) — the rects keep the numbers they were
   drawn with. So the two halves of one barline could compare *hundreds of pixels apart*. This is why
   it only misbehaved on bars whose width had been changed (exactly when neighbours are moved without
   being redrawn), and why an export/import round-trip appeared to cure it: a fresh score redraws
   everything, so nothing carries a transform.
4. And matching rects by their raw x across the score — the obvious repair — colours barlines that
   only *look* coincident in stale coordinates. Tried, and reported as the highlight jumping to
   other bars.

**Painting dissolves all four.** The registry knows where the barline is (`noteEndX`), and it is
offset-corrected for moved measures (`addAll(elements, dx, dy)`) — precisely the number the DOM
attributes get wrong. So the highlight draws its own `<rect>` there, per staff, and never touches
VexFlow's nodes. Removal is deleting a node, which `addNode` already logs; there is no colour to
replay. The mechanism was already in the file: the measure box has always drawn itself this way.

> **The general rule, and it is not only about barlines:** a highlight that recolours engraved ink
> inherits every one of the renderer's implementation details — how many elements a mark is made of,
> which group owns them, and whether their coordinates are still true. A highlight that paints its
> own mark from geometry inherits none of them. Reach for `addNode` before `setAttribute('fill')`.

Two details that cost a round-trip each, both about SVG rather than music:

- **`stroke: none` has to be STATED.** An SVG element *inherits* `stroke`, and the score root carries
  a black one — so a rect declaring only its fill comes out orange inside a black outline.
- **Colouring the stroke instead fixes the colour, not the weight.** A stroke straddles the edge,
  adding half its width to each side, and the selected barline drew visibly fatter than every other
  line on the page. With no stroke, `WIDTH` means what it says: 2px, just enough to cover the
  engraved line (1px, 2 for a thick end bar) without the selection reading as a change to the music.

## 4. The three things you can do to a selected barline

They are three different quantities and they use three different keys, coarse to fine:

| | key | what moves |
|---|---|---|
| **Bar width** | `Ctrl+←/→` | the bar's whole note space, ×; the music inside re-spaces proportionally |
| **Barline gap** | `Shift+←/→` | the line alone — the music keeps its spacing (`Shift+Backspace` resets) |
| — | `←/→` | nothing; walks to the previous/next barline |

⭐ **The barline gap** (2026-07-31) is the space between the bar's last element and the line that
ends it — *"like placing a rod between the last element and the barline"*, on top of the engraver's
own `space-to-barline` default of 1.0 staff space. A quarter-space a press.

**It is the same quantity as a note-spacing nudge, at the one address that gesture cannot name.** A
leading space is keyed by the *column* it opens a gap before; the barline is not a column, it is the
bar's end. So it gets its own key (`{measureId}:barlinespace`, id-keyed like a bar width, so a rebar
carries it), and that is very nearly the whole implementation:

- `measureUserSpacePx` sums it → `MeasureLayout` widens the bar → justification transfers the room
  from the bar's neighbours, so **the system still ends where it did**;
- the renderer formats the music into `noteArea − userSpace`, so the music keeps its own spacing;
- the shift pass (`applyLeadingSpaces`) walks *column* addresses and finds none, so nothing moves —
  ⛔ which is why the barline key must never be reachable through `measureLeadingSpaces`;
- `MeasureRedrawKey` sweeps `{measureId}:` keys, so the bar re-renders itself.

Measured at four staff spaces asked: the gap grew ~38px of the 40 (a justified bar pays for part of
its own growth — the same inversion bar width documents), the bar's first note did not move at all,
and the note-to-note spacing changed by under a pixel.

⚠️ **Naming.** He proposed *rod*, and it is the right metaphor — but `rod` is already a technical
term in this codebase (`Column.rod`: a minimum width spanning several columns, from Gourlay 2002 and
LilyPond's `springs-and-rods`), and this is not a minimum, it is an authored addition. Hence
*barline gap*.

The negative side is clamped by `measuredBarlineGapRoom` — the drawn distance from the last column
to the line, less the pair's own ink padding, minimum across staves. A rest may not stand as close
to a barline as a notehead may, and that asymmetry is the padding table's, not a constant here.

## Out of scope

Editing a barline (repeats, double bars, final bars) — the selection is a handle for width, and the
*kind* of barline is music, not layout. Multi-barline selection. A mouse drag for the gap: the
barline's drag is already the bar-width gesture, so this one is keyboard-only for now.
