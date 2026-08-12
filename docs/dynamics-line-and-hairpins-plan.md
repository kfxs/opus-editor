# The Dynamics Line, and Hairpins — Plan

Status: **NOT STARTED.** Analysis complete (2026-08-12); the decisions in §11 are open and the build
waits on them. No code has been written for any phase.

Two features, deliberately in one document and one order: **the dynamics line first, the hairpin
second.** The hairpin is the small half. The line is the half that changes something already on
screen — and building the hairpin first would give it a private vertical rule that the line then
takes away.

---

## 1. Goal

**The line.** Every dynamic-family mark on a staff sits on one horizontal line per system — the
letters (`p`, `ff`), the expression words (`dolce`), and the hairpins. It is what LilyPond calls a
`DynamicLineSpanner`, and Dorico, Finale and Sibelius all behave the same way.

**The hairpin.** An open (crescendo) and a close (diminuendo) wedge spanning a range of the music,
created from the Lines palette or the keyboard, selectable and deletable like a slur, drawn on the
line, surviving a system break. A simple first pass: one wedge shape, no `cresc.`-with-dashes, no
playback ramp.

---

## 2. What the research found

Recorded so nobody repeats it.

### 2.1 VexFlow has `StaveHairpin`, and we should not take it

`node_modules/vexflow/build/esm/src/stavehairpin.js` — about 40 lines, three `lineTo`s. What it
decides for us, and why each one is wrong here:

- **y** = `stave.getY() + stave.getHeight() + 20` — a fixed **20 px** below the staff bottom. Not
  staff-space aware (breaks under a small staff's `scale(k)` group), and it knows nothing about the
  dynamics on that same line.
- **mouth** = `height: 10` px, fixed, same problem.
- **x** comes from `getModifierStartXY`, which **throws pre-draw** (see
  `reference_spacing_rules_must_be_clef_independent`) — a draw-time-only geometry source.
- Both ends must be real `StaveNote`s **on one stave**: no system break. No niente, no dashed
  `cresc.` form, no awareness of a dynamic it runs into.

Against the boundary test (*take VexFlow's decision only when the rule is unsayable* —
`docs/vexflow-boundary` in the memory index): every rule a hairpin needs is sayable and ours. What
we would inherit is three `lineTo`s. **Draw it ourselves**, in a score-level pass like
`renderSlurs(pass, score)` (`VexFlowRenderer.ts:3612`).

### 2.2 Our dynamics do not sit on a line today, and it is a defect

VexFlow 5's `annotation.js:181` places a `below` annotation from `note.getYs()` — **the note's own
lowest point**, with a branch that snaps it to the stave bottom only when the note is high enough.
So two `p`s in one bar sit at different heights whenever their notes differ in pitch, and a passage
that dips below the staff drags its dynamic down while its neighbour stays put.

This is already true with no hairpins in the score. The hairpin is what makes it impossible to
ignore: a wedge is a long horizontal object, so any disagreement between it and the letters at
either end is visible across the whole span.

### 2.3 Every standard models a hairpin POSITIONALLY, never by note identity

| | model | how the END is addressed |
|---|---|---|
| MusicXML | `<wedge type="crescendo"\|"diminuendo"\|"stop">` in a `<direction>`, paired by `number`; carries `spread` (mouth, in tenths) and `niente` | a separate **stop** element, owned by whatever measure it lands in |
| MEI | `<hairpin form="cres" place staff>` | `@tstamp2="0m+3"` — **relative** measures + beat (or `@startid`/`@endid`) |
| MuseScore | `Hairpin` is an `SLine` spanner on ticks | tick + **duration** |
| Dorico | a *gradual dynamic* | rhythmic position + **duration** |
| LilyPond | `\<` … `\!`, a spanner bounded by note columns | terminated by `\!` or the next dynamic |

Not one anchors to note identity the way our `Slur` does. That matters for us beyond fidelity:
`rebar` regenerates slot ids, which is why `repairDanglingSlurs()` exists (`ScoreModel.rebarDeps`).
A slur severed by a re-bar is tolerable; a dynamic-family mark severed by one is not — dynamics ride
their measure at their beat and simply survive, and a hairpin must too.

### 2.4 Engraving rules (Gould, *Behind Bars*, dynamics)

- Below the staff for instrumental music; **above** for vocal (words live below); **between the
  staves** for keyboard, where one mark serves both hands.
- Letters, words and wedges share one line; the wedge's mouth centres on the letters' optical centre.
- A hairpin running into a dynamic **stops short of it**, about a space.
- Mouth roughly 1–1.5 spaces (LilyPond's default `height` is 0.67 sp per side ≈ 1.33 total). ⚠️ A
  number to settle **by eye**, like the spacing model's — not to be taken from this document.
- A minimum length, so a short wedge still reads as one (LilyPond: 2 sp).
- Very long spans take `cresc.` + dashes instead of a wedge.
- At a system break the wedge splits; the continuation resumes at the width it left off.

### 2.5 Creation gestures in the field

Sibelius **`H` = crescendo, `Shift+H` = diminuendo** over the selection, then Space extends it note
by note. MuseScore `<` / `>`. Dorico Shift+D popover, `<` / `>`. Finale drags a Smart Shape from
start to end. The dominant gesture is **select a passage → one key**, which is exactly the routing
`createSlur` already has. `h` and `Shift+H` are free in `ShortcutConfig` (only `Ctrl+Shift+H` is
taken — the rest hide/show, `ShortcutConfig.ts:448`).

---

## 3. The dynamics line

**One line per `(system, staff, placement)`** — LilyPond's scope too, since the spanner breaks at
every line break.

**Its y is a BASELINE, not a top edge.** A 30 px Bravura glyph and 14 px Georgia italic look aligned
only when they share a baseline — which is how print sets `p dolce`. We are already set up for it:
`DYNAMIC_GLYPH_INK_ABOVE` / `_BELOW` (`rendering/dynamicStyle.ts`) are defined *from the text
baseline*, so the line states one baseline and each mark derives its ink extent from it. The
hairpin's mouth then centres not on the baseline but on the glyphs' optical centre — about a quarter
of the glyph size above it, from those same two constants.

**The rule:** the lowest ink of that system+staff, plus a padding, floored at a minimum distance
below the bottom line — all in staff-spaces, so a small staff scales with it.

⚠️ **One low note moves the whole system's dynamics down.** That is what every program does, and
engravers expect it; the alternative — each mark dodging on its own — is what makes a line of
dynamics look drunk. §4's "move the line" is the remedy when the music makes it too generous.

**What is ON the line:** dynamic letters, expression words, hairpins. In our model these are the
same object already — an expression word IS a `Dynamic` (text-as-truth); `dolce` differs from `p`
only in that `isInterpreted()` is false (so `resolveChordLevels` skips it) and `splitDynamicRuns`
sends it to the serif italic face. So the line covers expression text with no second rule, and
`p dolce` is already laid out left-to-right by `layoutCoLocatedDynamics` — that becomes a
line-local concern instead of a special case.

**What is NOT on it:** technique text (`pizz.`, `con sord.` — the open Alt+T item). Gould's split is
dynamics and *qualifying* expression below, playing technique above. Saying so now is what stops the
line quietly becoming "everything drawn below the staff".

**What expression text needs beyond that: almost nothing, and two named things.** Because a word is
a `Dynamic`, P1 must simply read the line for *every* dynamic, not only the interpreted ones — the
letters and the words move together or the pairing `p dolce` breaks. Then:

- ⭐ **The inline editor follows for free.** `TextEditController` positions the DOM overlay from
  `source.getScreenRect()`, and `DynamicTextSource` builds that from the mark's **registry bbox**
  mapped through the SVG's CTM — so as long as `registerDynamics` keeps taking the bbox from the
  *rendered* SVG, moving the glyph moves the editor with it. Better than free, in fact: `DomTextEdit`
  already aligns on a **baselineY**, which is the same quantity §3 makes the line, so the two agree
  by construction.
- ⚠️ **The suppressed-while-editing trap.** A mark being edited is dropped from the engraving
  (`pass.suppressedDynamicId`) and drawn by the overlay instead. If the hairpin's end stops against
  that word's skyline, the word vanishing mid-edit would make the wedge grow and shrink as you type.
  The skyline must include a suppressed mark's box, not the drawn ink.

**It also owns a horizontal skyline**, not just a y. "The hairpin stops short of the dynamic it runs
into" is easy against a glyph and awkward against a *word*: `dolce` is wide, and our dynamics
deliberately have zero layout width (`setWidth(0)`) so text never pushes notes apart. Once the line
owns everything on it, it owns their x-extents, and the wedge can stop against a word as easily as
against an `f`.

---

## 4. How free placement rides the line

We already have per-mark freedom in the small: `nudgeDynamicOffset(id, dx, dy)` →
`DynamicOffsetOverride`, id-keyed, in staff-spaces, anchor-relative, surviving copy/paste
(`clipboard.ts:280`). The line does not compete with it — **it gives it an origin.**

Today that origin is "wherever VexFlow dropped the annotation", computed from the note's own lowest
point. So the same stored delta means a different place after the note under it is re-pitched, and
"reset position" cannot be stated precisely, because the default is a side effect rather than a
rule. Every program stores a delta from a computed default for exactly this reason (Sibelius's
*Reset Position*, Dorico's Engrave-mode offsets, LilyPond's `extra-offset`); none of them abandon
the baseline in order to allow dragging.

**Two levels of freedom, both wanted:**

1. **Move one mark** — a delta from the line. Exists.
2. **Move the line** — per system / staff / score. Only expressible once a line exists, and it is
   the remedy for the "one low note pushed the whole system down" case. LilyPond exposes it as
   `DynamicLineSpanner.staff-padding`; Dorico as a dynamics baseline.

**⭐ THE RULE: an offset moves INK, not LAYOUT.** A dragged mark keeps its layout position for
everyone else's purposes — it does not drag the line down, does not push its neighbours, and a
hairpin still stops short of where that `p` *belongs*, not where it was dragged. This is
`extra-offset`'s behaviour, it is what the overrides compartment already says about itself
(weightless: in the shape key, absent from the width key), and the alternative is a feedback loop in
which moving a mark moves the line the mark is measured from. Nothing is capped or snapped: the
delta is unbounded, and reset brings the mark home.

**⚠️ Vertical and horizontal freedom are different kinds of thing.** Vertical is engraving — a delta
from the line. Horizontal is usually *musical*: a dynamic's x is its `beat`; a hairpin's extent is
its start and length. Dragging a hairpin's end is Sibelius's Space and Dorico's Write-mode drag —
it changes what the mark covers, i.e. the model. Let a horizontal drag write a cosmetic offset
instead and we get two ways to say "this hairpin is three beats long" that can disagree, with
playback believing the one the eye does not. Time comes from the address; engraving comes from the
compartment. (A small cosmetic x stays legitimate — `DynamicOffsetOverride` already carries one —
but it is a nudge, never how length is expressed.)

---

## 5. The data model

`docs/dynamics-plan.md` §8 already reserved the shape: *"a separate `Hairpin` array on `Measure`,
reusing the beat-anchor + voice + placement conventions"*. That still looks right; what needed
deciding is **how the end is addressed**.

**Recommended — start address + LENGTH, on the start measure** (Dorico's and MuseScore's shape):

```
Measure.hairpins?: Hairpin[]
Hairpin = {
  id: string
  type: 'cresc' | 'dim'
  beat: Fraction          // start, on the measure it lives in — a Dynamic's address
  length: Fraction        // how much music it covers, in the same units as a beat
  voice?: 0 | 1 | 2 | 3   // as Dynamic
  staffId?: string        // as Dynamic
  placement?: 'above' | 'below'
}
```

**No foreign key at all.** Nothing names another bar, so inserting or deleting a measure needs no
fix-up pass and the hairpin travels with its measure exactly as a `Dynamic` does. Honest costs:
deleting a bar *inside* the span silently shortens what it covers (arguably right — it covers less
music because there is less music), and finding the end's x means walking forward from the start
measure at render time.

**Rejected: note-id anchored (`startNoteId` / `endNoteId`, like `Slur`).** Maximum machinery reuse,
but wrong on two counts — it is not what a hairpin is in any standard (§2.3), and in our engine note
ids are not stable across a re-bar (§2.3, `repairDanglingSlurs`).

**Rejected for now: `Score.hairpins[]` with two addresses.** Symmetric with slurs and a single
repair site, but it reintroduces the foreign key (`endMeasure` by number breaks on insert; by
measure id survives) and puts a dynamics-family object in a different home from every other dynamic.

Resolution at render time is already solved in shape: `attachDynamicsToSlots` turns a `(voice, beat)`
address into a slot with a fall-forward rule, which is what both ends need. ⚠️ The end address means
the **end of that slot**, not the start of the next column — the trap recorded in
`project_fixed_vs_unfixed_time_space` ("read the room to the SLOT'S END").

---

## 6. Geometry vs semantics (Principle 3)

`docs/DESIGN-PRINCIPLES.md` §3: *the model holds neither pixels nor layout; layout results are
derived views, never stored back.* Its resolved boundary case is the one this plan must not repeat —
**`Slur.cps` used to keep the hand-edited arc on the content model**, and it moved to the
engraving-overrides compartment: id-keyed, anchor-relative, in **staff-spaces**. The same entry
blesses the other side of the split explicitly: *"semantic side/direction flips (`placement`,
`stemDirection`, `tieDirection`) deliberately stay on the content model — they are notational
meaning, not geometry."*

Sorted against that, the line elements land like this.

**On the content model (semantics).** Every field in §5's `Hairpin` and nothing more: `type` (which
wedge it is), `beat` + `length` (which music it covers), `voice` / `staffId` (which lane it governs),
`placement` (a notational statement, blessed above). ⭐ **`length` as a `Fraction` is this principle
doing the work**: what is stored is *how much music*, and the wedge's drawn length in pixels is
derived from it every render. That is also why §4's rule — horizontal is the model, vertical is an
override — is not merely a UX preference: a hairpin's extent is musical, its height is not.

**In the overrides compartment (authored geometry).** Anything the user hand-tunes about how it
*looks*: a vertical nudge off the line (keyed by the hairpin's id, exactly as `DynamicOffsetOverride`
is), and — if we ever want it — a custom mouth. ⛔ **The mouth does not go on the model.** MusicXML
carries it as `spread` in tenths, which is a page measurement; ours would be a staff-space override,
one client of the compartment, and absent by default.

**Derived, stored nowhere (layout).** The line's y itself, the wedge's pixel endpoints, where it
splits at a system break, and the gap it leaves before a neighbouring mark. This is why P0 is a
**pure function** whose output nobody persists and which never reaches JSON: the line is a view over
the last render, in the same family as `measureColumns` and `pageCastOff`.

**⚠️ The one that needs care: "move the line" (§4, level 2).** That *is* authored presentation, so it
belongs in the compartment — but it must not be keyed by *system*, because which bars share a system
is itself a layout result that changes on every edit and resize. That is the exact dependency the
open boundary case in DESIGN-PRINCIPLES warns about. ⭐ **The house pattern already exists**: the
per-system staff-spacing override (client #7) keys on `staffSystemSpacingKey(staffId,
openingMeasureId)` — the staff's durable id joined to the durable id of the measure that **opens**
the system. An entry whose anchor measure no longer opens a system is simply never looked up
(self-healing, no stored layout index). A dynamics-line offset copies that key, plus `placement`.

**⛔ What none of this may become:** a `y` on `Hairpin` or `Dynamic`, a stored break point, or a
"the line is at 42px" cached in the score. If a value cannot be re-derived from the content plus the
current render, it is either an override with a durable anchor or it does not exist.

## 7. Rendering

- **Its own pass**, after the measures, like `renderSlurs(pass, score)`. That also keeps hairpins out
  of `MeasureRedrawKey` entirely — they never need a shape-key row, the way dynamics did.
- **No width.** `docs/ARCHITECTURE.md` §"Adding a new engraved element" answers it outright: *"An
  accidental does. A hairpin does not."*
- **System breaks.** `SlurRenderer` already owns a segment planner and the system-margin helpers
  (`planSlurSegments`, the left/right margin lookups); a hairpin wants the same idea, with the mouth
  continuing at the width it left off. A four-bar crescendo *will* cross a break in ordinary use, so
  this is not a deferrable nicety for long spans — see the phasing in §10.
- **Selection.** A fifteenth `SelectedElement` kind, one module in `interactions/elements/`, a row in
  `ELEMENT_SPECS` and a position in `ELEMENT_HIT_ORDER`, plus registry `points` for a proximity hit
  test — the slur's pattern exactly (`elements/slur.ts`, `distToSegment`).

**⚠️ THE OPEN FORK (§11.1).** Once dynamics read the line, a mark's y becomes a fact about its
**system**, not about its bar: a low note in bar 3 moves bar 1's `p`. Today dynamics are drawn inside
the measure group and `MeasureRedrawKey` answers "does this bar still look the same" from the bar's
own content. So either

- **(a)** the line's y goes **into the shape key** of every measure in the system, or
- **(b)** dynamics move **out of the measure group** into a system-level pass, as slurs already are.

(b) is cleaner, is the same shape the hairpin wants anyway, and we are already halfway there —
`layoutCoLocatedDynamics` overrides VexFlow's placement for stacked marks, and every annotation is
stashed in `dynamicObjectMap`. Its cost is that dynamics stop being VexFlow `Annotation` modifiers
and become ink we place, which is a bigger change than the hairpin itself.

---

## 8. UX

Following the slur, which is already routed this way (`PaletteController.createSlur`, `171b1bb`):

- **Two rows in the Lines palette** — open (cresc.) and close (dim.) — plus `h` / `Shift+H`
  (Sibelius's keys, both free).
- **Selection → create** over the selected range: start = the first selected note's address, length
  = to the last. **Nothing selected → arm the stamp.** **Armed → a re-press disarms.**
- **The ghost is a real wedge.** Unlike the slur, a hairpin has a previewable shape, so the armed
  tool can draw a short wedge at the pointer rather than only showing the blue placement pointer —
  a row in `GHOST_DRAWERS` + `ToolGhost` (and so it does **not** join `scoreCursorClass`'s
  ghostless list).
- **The stamp's click** — open, see §11.4.
- **Extending** an existing hairpin (Sibelius's Space, Dorico's Shift+Alt+→) is deferred; note that
  `Ctrl+←/→` is already taken by the slur-endpoint / dynamic / bar-width nudges.

---

## 9. Playback

**Out of scope for v1** — notation only, the precedent slurs set.

What it would take, recorded so the shape is known: `resolveChordLevels()` (`utils/dynamics.ts:325`)
returns `Map<chordId, DynamicLevel>` — an **enum**, so there is no room in it for a ramp. A real
crescendo means that map becoming a numeric velocity and interpolating from the level at the start
to the dynamic that follows the end (or one step up when nothing follows). That is a genuine change
to the resolution pass, not a slice on top of it.

---

## 10. Phases

Each is separately visible and separately testable.

- **P0 — the line as a pure function.** Its own module: in, the system's note extents + the staff's
  ratio; out, one baseline y per `(system, staff, placement)`. Unit-testable without a renderer —
  note y's come from pitch, not from fonts, so the jsdom trap does not bite (⚠️ the *ink heights* of
  the letters do need the browser, and stay in the e2e suite). Nothing reads it yet.
- **P1 — dynamics read the line.** The only visible change: letters and words stop wobbling and line
  up per system. This is where §11.1 is decided and where the hand-testing matters, because it
  touches something that already works. Offsets keep working, now measured from the line.
- **P2 — the model.** `Measure.hairpins`, the engine ops (add / remove / set length), undo, JSON
  round-trip, the rebar + copy/paste behaviour, no rendering yet.
- **P3 — draw it.** Own pass, on the line, mouth from the line's optical centre, ends stopping short
  of a neighbouring mark via the skyline, **including the system-break split**.
- **P4 — the UX.** Palette rows, `h` / `Shift+H`, selection→create, stamp + wedge ghost, selection /
  highlight / Delete, Properties report.

**Later, not in this plan:** move-the-line as a user control (§4), the `cresc.`-with-dashes style,
niente, the playback ramp, extending a hairpin from the keyboard, per-voice lines, and the
vocal-above / keyboard-between-staves placement variants.

---

## 11. Open decisions

Nothing is built until these have his word.

1. **§7's fork** — dynamics into a system-level pass (recommended), or the line's y folded into every
   measure's shape key?
2. **The model** — start + length on the measure (recommended, §5), or the score-level spanner?
3. **v1 scope** — notation only, no playback ramp (recommended)?
4. **The stamp's click** — a hairpin needs a span, so what does one click mean? The slur's answer
   (this note → the next slot, extend later), two clicks (start, then end), or a drag?
5. **Keys** — `h` / `Shift+H` as Sibelius, and two rows in the Lines palette?
6. **Default placement** — always `below` with a flip, or infer per staff kind (vocal above, keyboard
   between) later?
7. **`cresc.` as text.** Musically it is the same object as the wedge, and every model treats the
   dashed-word form as an *appearance* of the gradual dynamic rather than free text. Do we want
   `style: 'wedge' | 'text'` on the hairpin later? ⛔ Either way, do **not** retro-interpret
   expression text that is already typed in a score — report, never repair; no migration.

---

## 12. Later: the line is one rung of a LADDER (not in this plan)

His question, and the answer is yes — worth reconsidering once the bottom line exists.

The dynamics line is the **below-staff** rung. Above the staff every program keeps an equivalent
structure, but it is a **stack of rungs in a fixed order**, not one line — because far more kinds of
thing live up there. LilyPond states it as a number: every outside-staff grob carries an
`outside-staff-priority`, and they are placed outward in priority order, each pushed clear of what is
already there. Its own ordering, from the staff outward, is roughly: ornament/trill spanners →
octave (8va) brackets → text spanners → technique and expression text → volta brackets → metronome
marks → rehearsal marks. Dorico exposes the same thing as a configurable *vertical order of items
above the staff*; Sibelius as per-type default positions plus magnetic layout; **Finale calls them
baselines outright** — per staff, per system, one for lyrics, one for expressions, one for chords.

So the general shape is: **for a `(system, staff, side)` there is an ordered ladder of rows, and each
family occupies one rung.** The dynamics line is that structure with one rung and one member.

⚠️ **We already have a second family placed above the staff with no shared rule: tempo marks**
(`rendering/TempoLayout.ts`). Rehearsal marks, 8va brackets, technique text (the open Alt+T item) and
trill spanners would each add another, and each one placed on its own is another private vertical
rule to reconcile later — the "two settings arriving by two routes" failure that
`DESIGN-PRINCIPLES.md` warns about in its open boundary case.

**What that means for this plan: nothing to build, one thing to not preclude.** The line is already
keyed by `(system, staff, placement)`, so *above* is a legal value of the key on day one — a vocal
score's dynamics use the same rung machinery flipped. What is missing, and stays missing
deliberately, is the **ordering among families** on a side. Do not fold tempo marks into this work;
do keep the line's module free of the assumption that its side has exactly one rung, so the ladder is
a generalisation of it rather than a replacement for it.
