# Copy/Paste of a Selected ELEMENT

Status: **BUILT 2026-08-19.** Ctrl+C / Ctrl+V on one selected on-score element — the **expression**
(a `Dynamic`, whose text may be a level, a word, or both) and the **tempo mark**.

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

### ⭐⭐ …and the KIND says where it may land

> *"i want to be able to single copy and paste similar to expresion, but of course you have to take
> in consideration the real tempo anchor cordinate"*

The anchor module answers *where the selection points*. What a KIND may do with that point is the
kind's own rule, and it lives in `elementClipboard`:

| Kind | Its rule |
|---|---|
| dynamic | the anchor as given — a dynamic hangs off a slot of its own lane, which is what the anchor already resolved |
| tempo | the nearest **ONSET at-or-after** the anchor (`tempoOps.tempoAnchorAt`) |

⭐ **AT-OR-AFTER, and the drawing is why.** A tempo mark is engraved at the first notational element
at-or-after its beat (`TempoLayout.anchorX`, Gould p. 183); anchoring the model to the onset *before*
it would put the mark's meaning one step behind its ink. So a beat nothing sounds on — inside a half
note, say — resolves forward, and ⛔ a barline is never an anchor whatever the selection was.

⚠️ **At most ONE tempo mark per beat** (`docs/tempo-marks-plan.md` §4). A paste **replaces** the
mark sitting there — which is what the music clip's own paste does (`rebarOps.restoreBeatAnchors`)
— and both writes are ONE undo step, so a Ctrl+Z puts the old mark back.

⭐ What travels is the mark's text AND what it SOUNDS (`{unit, dots, bpm}`), because speed is stored,
not re-derived from the text at paste time.

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

**Sibling:** `docs/passage-selection-marks.md` — what a passage box selects (and highlights), and
why a paste now selects every mark it wrote, not only its notes.

## 2026-08-20 — the HAIRPIN travels

His ask: *"if i have just a hairpin selected i want to be able to copy and then paste it; if
something is selected on paste we use it as anchor (or near), if nothing is selected we just make the
blue cursor and get the coordinates from the click"* — which is the behaviour that already existed,
so the wedge is what the plan above calls a ROW: an arm on `ElementClip`, a case in `copyElement`,
a case in `pasteElement`.

- ⭐⭐ **It is the first clip that is not a POINT, so its LENGTH travels** (*"we should not copy the
  override but probably we should copy the length"*, his call). A wedge is an amount of music: how
  far it reaches is part of what makes it the mark it is, and the paste lands its START at the anchor
  with the extent following. ⛔ The length is never trimmed to what is left in the score — a span
  running past the music is clamped where it is READ (`hairpinOps.hairpinSpan`), so a wedge pasted
  near the end draws short and grows back if it is moved home, where trimming would throw music away.
- ⭐ **The generic anchor is already a wedge's answer**: a hairpin begins on a slot of its own lane,
  the address a dynamic hangs off — ⛔ unlike a tempo mark, which must find an ONSET.
- ⛔ **Neither end's nudge nor the hand-set MOUTH travels**, all three being overrides keyed to the
  copied wedge's id, which a paste never reuses. The new wedge opens at the automatic, length-aware
  aperture: a mouth authored against another length means nothing here.

## ⭐⭐ 2026-08-20 — THE RULE: a PASSAGE keeps the overrides, a single ELEMENT does not

His, after seeing both: *"probably this is the rule for elements: in passages the override persists,
for a single element no"*. And the reason is in the two gestures rather than in the marks:

- **A passage** brings the context with it. *"If the user makes something and wants to repeat it —
  suppose he angles the hairpin — he should not have to do all the work again."* The notes the nudge
  was authored against arrive too, so the nudge still means what it meant.
- **A single element** lands somewhere else entirely, against music it has never seen, so it arrives
  at its anchor's default — which is what an anchor-relative override is FOR.

⭐⭐ **One seam, no per-kind knowledge.** `Score.engravingOverrides[id]` is already a LIST, so the clip
carries that list verbatim (`engraving?: EngravingOverride[]` on every mark clip, filled by
`clipboard.engravingOf`) and the paste re-stamps it under the new id (`rebarOps.stampOverrides`). A
kind that grows a second or third override needs no change anywhere: the wedge's three (two end
nudges and the mouth) work because of the shape, not because anyone taught the seam about wedges.

🚨 **It also fixed a REBAR bug nobody had reported.** `restoreBeatAnchors` regenerates every mark's
id, and only the dynamic (2026-07-19) and the tempo mark (2026-08-19) had been taught to carry their
offset across — each as a bespoke `offset` field on `CapturedAnchor`. So a hairpin's, an ottava's, a
pedal's, a slur's and a trill's overrides orphaned on **every meter change**, silently, since the day
each shipped. `takeOverrides` replaces both bespoke fields with the list.

⛔ **Position-keyed overrides stay out of it** (a rest's shift, a bar's note spacing, a note's own
offset): they are keyed by `{measureId}:…` rather than by a mark's id, they ride `captureRestShifts`
and its siblings, and what they are about is a PLACE in the destination — *"probably not for note
spacing"*, his own exception.

## Not done

- ~~🚨 **A PASSAGE copy still loses a wedge's shape.**~~ ✅ Done 2026-08-20, for every mark kind — see
  the section above. The old note read: `ClipHairpin` (`utils/clip.ts`) carries staff,
  voice, offset, length, type and placement — and no overrides, where `ClipDynamic` has carried
  `engravingOffset` since 2026-07-19. His call, 2026-08-20: with the whole context copied the nudge
  still means what it meant, so it SHOULD travel there. That is the dynamic's pattern applied to
  three overrides (both end nudges + the mouth), and it has a second half — `rebarOps
  .restoreBeatAnchors` regenerates every mark's id on any rebar or paste, so an id-keyed override
  orphans unless it rides the capture/restore seam (docs/dynamic-offset-plan.md, P1).
- Only the dynamic, the tempo mark and the hairpin travel. A clef or a meter would each be one row
  (see above).
- No OS-clipboard interchange: the clip lives in the controller, like the music one.
- Multi-select of elements is out of scope — `selectedElement` is deliberately ONE.
