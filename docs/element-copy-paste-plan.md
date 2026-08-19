# Copy/Paste of a Selected ELEMENT

Status: **BUILT 2026-08-19.** Ctrl+C / Ctrl+V on one selected on-score element — today the
**expression** (a `Dynamic`, whose text may be a level, a word, or both).

## The ask (from the user)

> *"if i select an expression i want to be able to copy with ctr c so i can paste it in other place
> with ctr v… if there is something selected we anchor to it (in case of note rest, for example) or
> to the neares point (for example if a barline is selected), and if nothing is selected on ctr v we
> show the blue cursor so the user click and we get the coordinates to paste"*

…and, the same day, on the placement mode: *"we dont need the green carret, just the arrow"*.

## ⭐ ONE clipboard, two things it can hold

`ClipboardController` holds **either** the music (`ClipboardPayload` — notes and everything that
travels with a lane) **or** one element (`ElementClip`), never both: a copy replaces whatever was
held. So Ctrl+V never has to guess which of two clipboards the user meant — **the last Ctrl+C is
the answer**.

⛔ Not two clipboards and not a modifier: with two, every paste needs a rule for which one wins, and
that rule is invisible at the moment of pressing. The two branches can never even collide on COPY —
selecting an element clears the note selection (selecting IS clearing), so at most one of them has
something to copy.

## The three modules

The controller only dispatches; the answers live beside it, in the shape `utils/clip.ts` already
uses for the music: **what travels** and **where it lands** are two objects, not one.

| Module | Question |
|---|---|
| `interactions/elementClipboard.ts` | WHAT travels, and what a paste writes |
| `interactions/pasteAnchor.ts` | WHERE it lands, given the selection |
| `interactions/ClipboardController.ts` | the dispatch, the arming, and the one call into the engine |

### What travels

`text` + `placement` + the `voice` it governed — and **no id**. That is what makes a clip
re-pasteable any number of times, and it has one deliberate consequence: an engraving-override
nudge is keyed by the copied mark's id, so it does **not** travel. The new mark arrives at its
anchor's default place, which is the honest answer — the nudge was authored against other music.

A second kind is a **row**: an arm on the `ElementClip` union, a case in `copyElement` that reads
the model, a case in `pasteElement` that writes it.

### Where it lands — `PasteAnchor`

Three answers, in order:

1. **Notes selected** → the earliest one's own slot, exactly. Reuses
   `clipboard.earliestSelectedPosition`, so the two clipboards cannot drift on what "the selection's
   start" means. A note IS a position: its voice and staff travel with it, so the pasted mark
   governs the stream you pointed at.
2. **One element selected** → the nearest anchorable point, per kind (`anchorOfElement`). Most kinds
   already carry a position (a dynamic's `{measure, beat}`, a clef's, a tuplet's start) or hang off
   a note that does; the ones that name only a BAR resolve to a downbeat.
3. **Nothing selected** → `null`, and the caller arms click-to-place. ⭐ Null is a REFUSAL, never a
   guessed bar-1 downbeat: a paste that silently lands somewhere is the guessing-fallback bug.

⭐ **A BARLINE points at the NEXT bar's downbeat** — never at the line itself, which is not a
position anything is anchored to (the tempo mark's own rule, *Behind Bars* p. 183). With no next bar
it falls back to the last slot of the bar the line closes.

⛔ **The MODEL answers, not the render.** Every branch reads the score, so the anchor is identical
in a headless spec and on screen, and a culled bar anchors as well as a drawn one. The one place
geometry legitimately decides is the armed CLICK — `MouseController.resolveSlotBeat`, a question
about pixels.

⚠️ **Total over `SelectedElement`.** An eighteenth kind fails to BUILD until it says where a paste
beside it goes — the guarantee `assertNeverElement` gives everywhere else in this family.

## 🚨 The placement mode draws NOTHING

`pastePlacementArmed` used to trail a dashed green caret at the pointer (`drawPasteCaret` +
`renderPasteCaret`, both now **deleted**). It is the blue place-cursor instead — the same
`cursor-place` the ghostless stamps take (`scoreCursorClass`), and the one entry in that list which
is not a tool.

Side benefit: a mousemove under an armed paste now costs **no render at all**, where the caret
forced a full `renderScore()` per frame.

## Where the pasted mark lands, exactly

`pasteElement` takes the anchor's lane where the anchor named one (a note carries voice AND staff)
and the clip's own where it did not (a barline is system-wide). The mark then becomes the
selection — a paste leaves you holding what you just made, the note paste's own rule — which means
clearing the note selection exactly as an element press does.

⚠️ Pasting while the copied expression is still selected stacks a duplicate at the same slot. That
is what "anchor to the selection" means, and the model allows co-located marks (`ScoreModel
.addDynamic`: nothing is replaced). Open, if it reads wrong in use.

## Tests

- `pasteAnchor.test.ts` — the anchor per selection, including the barline's two cases (⚠️ its
  fallback case FILLS bar 2 on purpose: an empty bar's single rest sits at beat 0, so the assertion
  would agree with the downbeat by luck of the fixture and prove nothing).
- `elementClipboard.test.ts` — what a clip carries, that a paste mints a new id, that the same clip
  pastes repeatedly, and that an undo takes the pasted mark back out.
- `ClipboardController.test.ts` — the dispatch: onto a note, onto a barline, armed with nothing
  selected, and that copying one thing drops the other.

## Not done

- Only the dynamic travels. A clef / meter / tempo mark would each be one row (see above).
- No OS-clipboard interchange: the clip lives in the controller, like the music one.
- Multi-select of elements is out of scope — `selectedElement` is deliberately ONE.
