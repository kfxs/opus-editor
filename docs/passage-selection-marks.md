# What a Passage Selection HOLDS

Status: **BUILT 2026-08-19.** A box selection (a plain-click bar, a Shift-click range) now selects —
and highlights — every mark it encloses, and a paste selects everything it just wrote. The TEMPO
mark joined the family on the same day (below).

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

**The rule (amended 2026-08-19):** a mark belongs to where it **BEGINS**. A dynamic is taken on its
point, a slur on its two endpoints, a trill on its SIGN alone (its wavy extension may run out of the
window) — and the three SPANS (hairpin, octave line, pedal) on their START, with their extent
travelling verbatim however far past the box it reaches.

⭐ That is the model's own filing rule: each span is stored on the bar its start lands in, carrying
its extent (`types/music.ts`). It replaced a *fully enclosed* rule after his report that a 6-beat
8va and a 5-beat pedal sat out the copy of the 4-beat bar they start in — *"when we select the
measure we should select ottava and pedal too"*. ⛔ Nothing is truncated (the old rule's real fear),
and ⚠️ a span starting BEFORE the box is still not in it — its home is that earlier bar.

⚠️ The rule is now stated twice — here keyed by **id**, in `clipboard.ts` keyed by **offset** — and
`enclosedMarks.test.ts` pins them against each other: for one fixture, what the box highlights and
what the clip carries are asserted to be the same marks. Merging the two is possible later; the
test is what makes the duplication safe meanwhile.

## ⭐ Ctrl-click builds the same set BY HAND

> *"with ctr click we are just able to group select and deselect notes and rest… however we should
> be able to also do it with all elements that we are now handling group selection (tril, hairpin,
> slur, dynamic).. so we can also use the real selection for filtering or add in copy and paste"*

`interactions/markGroupSelect.ts` — a Ctrl/Cmd-press toggles one mark in or out, the toggle a note
has always had. It answers *which mark is under the pointer* by **re-running the press chain with a
different tail**: `pick` records instead of replacing, and every drag and editor door is a no-op
(⛔ two Ctrl-presses on a dynamic are "in, then out", never "open its editor"). ⛔ Writing a second
hit-test here would be a second answer that can disagree with `ELEMENT_HIT_ORDER` on exactly the
presses that are hardest to reproduce.

⚠️ **Only the kinds the set can hold take part.** The chain is filtered to them, so Ctrl-click
on a clef, accidental, dot or barline does what it always did (toggles the note under the pointer).
A kind whose ink sits INSIDE a note's must not join without deciding that question first — the note
fallback has a 30px reach and would lose presses to it.

⚠️ Shift stays temporal: a range is an amount of MUSIC, and a hairpin is not a position to range
from. And `toggleMark` touches no note anchor — `selectedNoteId` and the Shift pivot drive note
navigation and the palette, and a hairpin is none of those things.

⭐⭐ **A Ctrl-click GROWS what you have, including a single-element selection.** His report the same
day: *"i select dynamic and ctr click the hairpin, however ctr click the hairpin clear the
dynamic"*. The asymmetry behind it: a plain click on a NOTE puts that note **in the set**, so
growing from one always worked — while a plain click on a MARK puts it in `selectedElement`, and the
toggles cleared that. `SelectionController.absorbElementIntoSet` carries it across first, so the
first thing you picked survives picking a second.

⚠️ Only the kinds the set can hold are absorbed; a clef, a barline or a measure box is still just
cleared, because a group has nowhere to put it. And the absorb runs BEFORE the toggle, so
Ctrl-clicking the mark that is already singly selected still *removes* it — the note toggle's own
behaviour.

## ⭐⭐ The clip carries what is SELECTED

> *"i'm not selecting the dynamic, however it paste it"* — holding a Ctrl-built selection of three
> notes and one slur, and watching the dynamic under them arrive in the paste.

That was the last place the old rule still spoke: `buildClipboardFromSelection` recomputed the
enclosed marks from the note span and never asked what the user was holding. It now takes the
selection's mark ids (`MarkFilter`), and **the two are an INTERSECTION**:

- the **window** says which marks a clip *may* carry — a mark half in and half out has no place in
  it, which is each builder's own fully-enclosed rule and stays exactly as it was;
- the **selection** says which of those the user actually asked for.

⛔ Order matters: a mark that is selected but sits OUTSIDE the copied span still does not travel,
because the clip has no offset to file it under.

⚠️ A box or a plain passage click puts every enclosed mark in the set, so **those copies are
unchanged** — this only narrows a selection built by hand. And an absent filter still means
"everything enclosed", which is what a caller with no selection to consult means by *copy this
passage*; the specs that call the builder directly pass none, because they are testing the window.

## ⭐ The TEMPO mark, the one SYSTEM-level member

> *"now i want to be able to include the tempo in the group selection"*

It joins as a full member — box, Ctrl-click, highlight, Delete, and the clip — with one difference
that runs through all of them: **a tempo mark has no staff and no voice.** So the box takes it on
its POSITION alone (no staff-band test, because there is no field to test), the clip carries it with
no lane to re-base (`ClipTempo` is `ClipDynamic` minus the lane), and the paste re-anchors it
through the `{kind:'tempo'}` beat anchor `restoreBeatAnchors` already had — the same road the
DESTINATION's own marks take through a rebar, one-per-beat rule included.

⚠️ That means a box on ONE staff of a grand staff takes the system's tempo mark. It governs that
staff as much as any other; Sibelius's separate *system passage* is a refinement we have not made.

⛔ No id travels, so a hand-nudged tempo offset (keyed by the copied mark's id) stays behind with
the music it was authored against — the rule the expression clip already follows.

## The selection union grew five arms

`SelectionItem` gained `hairpin` / `trill` / `ottava` / `pedal` / `tempo` (id-keyed, like `dynamic`
and `slur`). Every reader of `selectedItems` filters by kind, so nothing else had to change — but two
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

- A **marks-only group** copies nothing: the clip is built from a note span, so with no notes
  selected there is no window to file the marks under. Copying a bare mark is `Ctrl+C` on a single
  selected one (`docs/element-copy-paste-plan.md`).
- A box still does not select **clefs**, **meters** or **tempo marks** inside it; the copy does not
  take them either, so the two remain consistent (`docs/copy-paste-staff-plan.md` has them listed as
  dropped).
- `selectedItems` is still note-anchored: the anchor and Shift pivot are always notes, so a group
  of marks alone has no anchor for note navigation or the palette to follow (it selects and deletes
  fine).
