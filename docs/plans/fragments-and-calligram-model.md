# Fragments, scores and the calligram — the document model (2026-09-30)

**Status: A DISCUSSION, written down. ⛔ Nothing is built, nothing is scheduled, no code was touched.**
§4–§7 are the working picture he called *"good"* on 2026-09-30; §10 is what is still open. The names
**use** and **figure** are working words of this file — his to rename.

> His brief: *"eye music is not just the spine; we can code a portion of eye music, a caligram (or
> similar), and a caligram can contain more than one path cause a figure is made with more than one line,
> that means in a caligram we can have more than one spine and each spine has an associated staff or
> system… every spine has a fragment associated to it, a fragment of music that is basically a score… but
> what is a score… maybe a fragment is a score, cause maybe a fragment can have subfragments, this is a non
> trivial thing… where does the caligram live? … we can have in our page 3 systems of music then caligram
> then system of music like continuation… what is important is the datamodel."*

And the frame for every answer below: *"we are thinking in opportunities for the future and not an
already made example I want to copy."* ⇒ ⭐ **"I don't know yet" means KEEP BOTH.** This file states what
the model must not assume; it does not pick cases.

## 1. Where the model stood before this conversation

`Score` (`src/types/score.ts`) is ONE `measures[]` list shared by every staff, plus `staves[]`, the
top-level spans, and two saved non-content compartments (`engravingOverrides`, `playback`). It cannot say:

- **anything above a `Score`** — no sections, no several musics in one document;
- **anything in the vertical flow but systems** — even the title is a sketch
  (`docs/plans/score-header-sketch.md`: the real thing is *"a FRAME of text items"*);
- **a path** — the spine's shape is a console view (`docs/plans/bent-staff-plan.md` #18, *"not yet"*);
- **ink that is not an event** — a symbol is always anchored to a chord or rest
  (`docs/plans/symbol-plan.md` §1);
- **a page** — `Surface` is session-only (`engine/layout/surface.ts`).

## 2. ⚠️ "Fragment" already means three things in the docs

| where | meaning |
|---|---|
| `docs/plans/instruments-plan.md` §1 (2026-07-13) | **the content** — what the TS type `Score` holds today. *"The score wraps the fragment. The fragment never knows a score exists."* A part is another wrapper over the same fragment. ONE content type. |
| `docs/research/20c-notation-survey.md` §5.3, §5.4, §11 | **open form** — *Klavierstück XI*'s 19 fragments; `Score` (fragments) / `NavigationRule` / `Realisation` are three objects; *"a different document kind"*. |
| `docs/plans/own-engraving-engine.md` §7.5.5 | a **rigid fragment** — a beamed group placed by one affine. A render word only. ⛔ Not this file's. |

This file uses the FIRST meaning. The old moodboard idea is one sentence
(`docs/plans/engraving-overrides-plan.md` §1: *"a moodboard of sketches assembled into an engraved score…
the same musical material may appear in multiple contexts"*) plus `docs/DESIGN-PRINCIPLES.md` §5's
*"board where scores are merged and varied"*.

## 3. How the picture was reached — his corrections, in order

1. **How do a calligram's spines relate in time?** *"can be sequential, can be continuous, can be a mix,
   depends on the composition… we define what paths are simultaneous (time grouping spine), and we decide
   also the order of the groups in time."* ⇒ groups, in order; simultaneous inside a group.
2. ⛔ **Not "bars of the main score with a shape attached".** *"I know after measure 8 comes a caligram
   but I still don't know what it is, so the time is undefined, then I follow working in the rest of the
   score… just leaving the space, then I decide to work on the caligram but add just one path… the
   composing flow is not linear… probably I want to move the caligram from page 3 to page 1… the
   datamodel should be easy to edit by the engine."* ⇒ the calligram is its own object; it can be empty.
3. **Do simultaneous paths share bars?** *"I don't know, so the real choice is 3"* — both.
4. **Is its place tied to the music or to the page?** Both — *"it depends"*.
5. ⛔ **A score is not "ONE fragment plus things placed in it".** *"a score in my abstract conception can
   be also fragment1+fragment2+calligram1+fragment3+calligram2+fragment1"* — the repeat of fragment1 is
   DELIBERATE — and *"a single fragment can be a score, two fragments not connected are 2 scores… there
   is a relationship here."*
6. ⛔ **Not "a fragment editor and a page editor".** *"a fragment can also be edited in the page, and two
   fragments can be edited in the same page (we just need a way to identify one system or set of measures
   with fragment 1 and the other with fragment 2)… maybe we are working on the page, create on the page a
   new fragment, write music and apply a path to that new fragment… I don't want to think in UI now."*

## 4. ⭐ The model as it stands

```
Document
 ├ fragments        the pool — every fragment lives here ONCE
 └ scores           one or more
     └ items, in order
         ├ a USE of a fragment    drawn in the flow, as systems
         ├ a FIGURE (calligram)   groups → uses, each on a path; plus ink that is not music
         └ later: a text frame, a blank space, a graphic
```

- **Fragment** — music: bars, staves, notes. Exactly what `Score` holds today; ⛔ it does not change.
- **Use** — *"this fragment appears here."* It names a fragment and, optionally, WHICH STAVES and WHICH
  BARS of it (absent = all). ⭐ The path is applied to a USE, never to the fragment.
- **Score** — the ordered items. It is defined by the CONNECTION, not by what it contains: one use is
  the smallest score; two unconnected fragments are two scores.
- **Figure** — the calligram: uses drawn on paths that belong to one picture, in time groups. It may be
  empty (it then takes space and no time — its duration is DERIVED, ⛔ never stored).

⭐ A score and a figure have the SAME time structure — things in order, things together. The difference
is how it is shown: in the FLOW or as a FIGURE. And since a fragment is an ordinary score value that a
figure uses, a figure inside a figure needs no extra rule (Cordier's small heart inside the large one).

## 5. ⭐ The one rule — *is it the MUSIC, or is it THIS APPEARANCE?*

| the music → in the FRAGMENT | this appearance → on the USE |
|---|---|
| notes, rests, clefs, keys, meters | the path |
| slurs, dynamics, tempo | its place in the score's order |
| a hand nudge on a slur or a dynamic | line and page breaks |
| the sound | whether it CONTINUES from the item before (bar numbers, signs in force, a tie across) |

⇒ Editing the music of a fragment changes it in EVERY use — that is what his deliberate repeat means. An
independent version is a copy, i.e. a second fragment.

## 6. His cases, in the data

| what he said | what it is |
|---|---|
| fragment1 appears twice | two uses of one fragment |
| two fragments edited on the same page | two uses; ⭐ an address starts with the USE, then bar and element — the *"way to identify"* he asked for |
| create a fragment on the page, write music, apply a path | a fragment joins the pool · a use of it joins the score · the use is given a path. Take the path away and it draws straight again |
| a calligram not written yet | an empty figure in the list |
| move the calligram | its position in the list changes; ⛔ nothing inside it does |
| linear view · page view · a small panel for typing on a calligram | ⛔ not data — VIEWS of the same fragment, as linear and wrapped view are today |
| a violin part | another score over the same fragments, using some of their staves |

## 7. Inside a figure — a path carries STAVES × BARS of a fragment

| case | how it is written |
|---|---|
| shared bars — a piano bent two ways | one fragment, two paths, one staff on each |
| own bars — each path its own music | two fragments in one group, one path each |
| one music running from one path onto the next | one fragment, two paths, a run of bars on each — a line break, only curved |
| what `__spine.show()` draws today | one fragment, one path, every staff in parallel |

⚠️ **Simultaneous paths cannot line up beat by beat** (two halves of a heart differ in length and
direction), so each path is spaced on its own — his FREE STAVES note of 2026-09-01
(`docs/plans/spacing-model-plan.md`, *"FOR LATER — FREE STAVES"*), and the figure is its first client.
⭐ A tie or slur between two paths of ONE fragment is free — it is one music. Only a crossing between two
fragments needs a seam rule (§10).

## 8. What this means for what is already written — ⛔ none of these files was changed

- `docs/plans/instruments-plan.md` §1 **survives with one change**: the wrapper holds several USES
  instead of one fragment. Its *"a part is another wrapper"* is §6's last row.
- `docs/plans/bent-staff-plan.md` §2 and `docs/DESIGN-PRINCIPLES.md` (boundary case, the *"third
  stakeholder"*) say the shape is saved as *staff × bar range of the score → path*. Here the path belongs
  to a USE inside a figure, and a whole score bent on one path is the simplest figure. Port-map rows #18
  and B7 are this question.
- `Score.title` / `Score.composer` sit on the fragment today; they belong to the score.
- `docs/plans/measure-number-plan.md` §1 already asks ONE resolver what number a bar prints, ⛔ never
  `Measure.number` — which is what a bar number that runs across several uses needs.
- `docs/plans/linear-view-plan.md` already found that overrides are keyed to two kinds of thing and only
  one survives a change of view. That is §5's split: element-keyed ones travel with the fragment;
  layout-keyed ones belong to the use.
- `docs/research/20c-notation-survey.md` §5.3's open form is a score whose ORDER is left unstated — the
  same structure, ⛔ not designed here.

## 9. What must not be assumed — readers, not fields

Nothing to add today; each is an assumption the code must not DEEPEN.

1. **One document = one score = one timeline.** `docs/DESIGN-PRINCIPLES.md` already records two of these
   as boundary cases: `createEditorApp` creates and owns its only score, and the chrome singletons assume
   one editor.
2. **An address is a bare measure number of THE score** (`SelectedElement` in
   `interactions/state/EditorState.ts`). With two uses on one page it is ambiguous.
3. **A figure's duration is stored.** It is derived from what its groups hold.
4. **The drawing takes "the open score".** ✅ Already not so: `eye/spineScore.drawScoreOnSpine` is handed a
   score and a spine.

## 9b. What ORDINARY development owes this — one question, and it is in `CLAUDE.md`

His ask, 2026-09-30: *"next tasks will be ordinary tasks in the editor like adding extra accidental… is
there something… in order that normal development doesn't go the wrong way?"*

⭐ **Almost nothing, and that is by design**: the fragment IS today's `Score`, unchanged, so everything
added inside it — an accidental, an articulation, a mark, its nudge — stays valid whatever is built
above it. What already holds the line: a score operation takes the score as a PARAMETER and lives in the
core (`docs/DESIGN-PRINCIPLES.md` §5), `npm run lint:singletons` counts every module-level "the one
editor", saved data is keyed by measure ID and never by number, and a statement that can change
mid-score is positional (§6 there).

The one new question, asked **before a field joins `Score` / `Measure` / `StaffInfo` or a kind joins
`engravingOverrides`**: *is it the music, or this appearance?* (§5). The features where the answer is
NOT obvious, so they stop and ask him:

- **line and page breaks** — ⚠️ `docs/DESIGN-PRINCIPLES.md` files a break under the measure it happens
  before; `docs/plans/instruments-plan.md` §1 gives breaks to the wrapper (a part breaks elsewhere).
  Under §5 it is the USE's. Unresolved — and unbuilt.
- **the title and every text frame** — the score's, not the fragment's
  (`docs/plans/score-header-sketch.md` §6).
- **a count that runs across fragments** — `docs/plans/measure-number-plan.md`'s resolver takes one
  score today; a bar number continuing from the item before is one more INPUT to it, ⛔ not a field.
- **the spine's own knobs** — `docs/plans/bent-staff-plan.md` §9.1 already decided they are a separate
  compartment that never changes the page, and left their storage open (§9.3 C). That compartment is
  the use's.
- ⚠️ **Already in the fragment and layout-dependent** (nothing to do; known when a fragment is first used
  twice): the overrides that exist because of where a system broke — `staffSpacing` (keyed
  `staffId@openingMeasureId`) and the three `cautionary…` kinds.

## 9c. The first LOOK — one spine on the page (⛔ a proposal; his call when he asks for it)

His note, 2026-09-30: no real layout for now — the fake page, maybe in a few sizes, is enough — but *"soon
it will be good to place the spine in the page (not a whole caligram with many spines or paths but just a
simple one) to see how it looks and to see if visually it works."*

⭐ **The smaller step, his idea the same day: STAMP the open score on the page as its spine** — *"not
show the normal system in the page anymore but just the spine"*, no other fragment beside it.
⛔ **NOT a new view mode** (his correction — I had proposed a third `ViewMode` beside `wrapped` and
`linear`): *"something like `__spine.printOnPage()` or similar… not a new view"* — a CONSOLE command of the
`__spine` family (⚠️ that NAME was only his example — *"I didn't say I wanted that name"* — the command is
unnamed), session state like the rest of it, ⛔ no member of `layout/layoutConfig.ViewMode` and no
toggle in the palette. The sheets are drawn as today and the score's one figure on them instead of its
systems; nothing is saved. It needs NOTHING
of this file's model, no block in the flow and no second music — the panel's picture, moved onto the page.
What it does need, named so the build does not rediscover it: the page's readers must do nothing, quietly,
when no bar stands in a system (caret, playback cursor, note entry by click, the ghost — they ask the
registry, which the figure does not fill); the panel's click + highlight live in `dev/` and would have to
come with it to select on the page (edit by taking the stamp off otherwise); one spine is
ONE system, so a long score asks a circle larger than the sheet; and the PDF's rotated glyphs are unverified
(port map #20).
⭐ **The TITLE and COMPOSER can stay on the stamped page** (his ask) — the header sketch draws them as it does
on page 1 today and the figure stands under its room; in §4's terms that page is a score of two items, a
text frame and a figure, so the look agrees with the model. ⛔ *"Other page text"* is NOT part of this
step: the sketch holds two strings and must not grow (`docs/plans/score-header-sketch.md` §6) — a third
text is the real text-frame work. WHERE the figure sits on the sheet is appearance: a session value.

**If the stamp is ever SAVED (export / import) — ⛔ he has not said he will** (2026-09-30: *"I'm not
telling I will do, I'm just asking for possibilities"*). What would be saved: the path, the music's size,
where the figure sits on the sheet, the spine's knobs (already keyed by measure id).

⭐ **His question: *does exporting it SOON go against the future model?* — NO.** One fragment shown as one
figure is the smallest document §4 describes, so saving it early is the model's first case, not a detour.

⭐⭐ **ONE KIND OF JSON — his word, the same day:** *"I don't like the idea of a separate json… the score
just admits one kind of json, not two."* ⛔ So no document file wrapped round the score's, and no settings
file beside it (I had offered both). What that leaves, and what keeps it harmless:

- The stamp is **its own COMPARTMENT of the one JSON**, at the top level beside the music — the status
  `engravingOverrides` and `playback` already have. ⛔ Never mixed into `measures` or `staves`, and ⛔ not
  inside `engravingOverrides` (the spine's adjustments are a separate compartment by
  `docs/plans/bent-staff-plan.md` §9.1, and a path has no element to be keyed by).
- It is **self-contained and points at the music only by id**, and the music never points back — so taking
  it out leaves a score that draws straight, and on the day a fragment can be used twice the compartment
  moves onto the USE as one block.
- ⭐ **What "one kind of JSON" says about §4 itself:** the document model must GROW OUT OF today's JSON,
  ⛔ not arrive as a wrapper file. The top level of the JSON is the score in his large sense; today it
  holds ONE fragment inline. The day it holds several, its shape simply CHANGES — ⭐ his word
  (2026-09-30): *"there is no problem changing the json, we have no users yet… just the examples have to
  be updated and we for the moment still don't need json migration."* So a change of the JSON's shape is
  never a cost to weigh here: the new shape is written, `toJSON` / `fromJSON` follow it, and the files in
  `public/examples/` are re-saved. ⛔ No migration path, no reader for the old shape.

What today's conclusions ask of the LATER step — a spine BESIDE the score's systems:

1. **Nothing saved.** A session statement, like the spine's knobs (`docs/plans/bent-staff-plan.md` §9.3 C)
   and the `Surface`.
2. **Stated as a figure with ONE use** — its own music, a path, a place in the flow (*after bar N*) —
   ⛔ not as *"bars X–Y of the open score are bent"*. Beyond being §4's shape it is the CHEAPER one: bars
   taken out of the flow would need forced breaks either side (unbuilt) and would meet every page reader
   that assumes a bar stands in a system (cursor, caret, playback, selection). With its own music the
   page's bars never know.
   ⚠️ The editor holds ONE score today, so that music is a SNAPSHOT (taken from a selection, a file, an
   example) and re-taken to change it. Editing it live on the page is §9's first assumption, a larger step.
3. **The room is a BLOCK IN THE FLOW, not a spine special case.** The one thing to build first:
   `layout/pageCastOff` stacks systems and knows exactly one other thing, `firstPageHeadPx` (the title
   sketch's room). A block of a given height between two systems is what the figure, a blank space
   (*"just leaving the space"*) and the real title frame all need.

Already there: `eye/spineScore.drawScoreOnSpine(ctx, score, spine)` takes any `DrawContext` and any score.
What the first look will NOT have: a click on the figure (the page's registry is boxes + translation —
bent-staff §4 item 3), and a verified PDF (rotated glyphs through the outliner — port map #20).

## 10. Open — his calls, ⛔ not a queue

- **Can two uses share ONE line of music** (the end of one and the start of the next in a system)? The
  address handles either; the casting-off across two fragments is the expensive door to keep open.
- **A nudge in only ONE appearance of a reused fragment** — an override layer on the use.
- **The seam rules** — bar numbers, signs in force, a tie or slur across two fragments, playback order.
- **Page placement of a figure** (a spot on a page, the systems flowing round it) — waits on a saved page.
- **The ink that is not music** (a heart's outline, *Bike Ride*'s frame and spokes), and the graphic
  score's own question (`docs/research/20c-notation-survey.md` §11).
- **An unstated order** (open form) · **the moodboard** (the pool, seen as a board).
- **The names**, and the long-deferred rename of the TS type `Score` → fragment (`instruments-plan.md` §1).
