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

## Out of scope

Editing a barline (repeats, double bars, final bars) — the selection is a handle for width, and the
*kind* of barline is music, not layout. Multi-barline selection.
