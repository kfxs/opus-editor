# What a Passage Selection HOLDS

Status: **BUILT 2026-08-19.** A box selection (a plain-click bar, a Shift-click range) now selects —
and highlights — every mark it encloses, and a paste selects everything it just wrote.

## The reports (from the user)

> *"if i select a measure that have hairpin or trill, i can paste on other measure with hairpin and
> trill too, however in the selection of the measure the hairpin either the trill is [not]
> highlighted… we need to highlight them so the user understand"*

> *"when pasting we just select the notes… but all element pasted should be selected"*

Both are the same bug seen from two sides: **the selection understated itself.** The copy had always
taken the enclosed hairpins, trills, octave lines and pedals (`interactions/clipboard`'s `*InWindow`
builders), and a paste had always written them — but neither the box nor the paste said so.

## ⭐ The highlight is a promise about the copy

One module answers "what else came with these notes": `interactions/enclosedMarks.ts`, and everything
downstream reads its answer instead of restating the rule.

| Reader | What it does with the answer |
|---|---|
| `SelectionController.selectNotes` (and the box paths) | puts the marks in `selectedItems` |
| `RenderController.applyHighlights` | one SET pass per kind paints them |
| Delete (`shortcutWiring`) | removes them with the notes, in the same batch |
| `ClipboardController.placeAt` | the paste selects what it wrote — it calls the same `selectNotes` |

**The rule:** fully enclosed, never clipped — the copy's own rule, for the copy's reason. A wedge
that starts inside the box and ends past its last note belongs to music the box does not hold, so it
travels with neither. The one asymmetry is the **trill**, taken on its SIGN alone (its wavy
extension may run out of the window), because that is what the clip does.

⚠️ The rule is now stated twice — here keyed by **id**, in `clipboard.ts` keyed by **offset** — and
`enclosedMarks.test.ts` pins them against each other: for one fixture, what the box highlights and
what the clip carries are asserted to be the same marks. Merging the two is possible later; the
test is what makes the duplication safe meanwhile.

## The selection union grew four arms

`SelectionItem` gained `hairpin` / `trill` / `ottava` / `pedal` (id-keyed, like `dynamic` and
`slur`). Every reader of `selectedItems` filters by kind, so nothing else had to change — but two
things chose to:

- **Delete** now removes them. A highlighted mark that Delete leaves behind is a promise the editor
  does not keep, which is the same argument that put them in the selection.
- **`selectNotes` and `selectMeasureContents` became one.** They were near-copies differing only in
  the marks pull; the paste needed the pull, so the pull moved into `selectNotes` and the passage
  method is now a one-line alias under the name the gesture has.

## Where the ink is painted

⭐ **One pass per kind, asked "which ids of yours are selected?"** —
`HighlightController.selectedIdsOf(kind)` unions the single-click element selection with the box's
items, so a mark's ink is painted in exactly one place however it came to be selected. The kind's
row in `ELEMENT_SPECS` is then only the EXTRA a single click earns: the anchor guide line and the
drag handles.

⛔ **Box members get colour, never handles.** A bar's worth of endpoint squares would be unreadable
and — since they overlap — unclickable. Handles are for editing ONE mark.

## Not done

- A box still does not select **clefs**, **meters** or **tempo marks** inside it; the copy does not
  take them either, so the two remain consistent (`docs/copy-paste-staff-plan.md` has them listed as
  dropped).
- `selectedItems` is still note-anchored: the anchor and Shift pivot are always notes, so a passage
  of marks alone is not a selection you can make.
