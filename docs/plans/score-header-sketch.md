# 🚧 The score header — a SKETCH (title + composer), 2026-08-27

> ## ⛔⛔ READ THIS FIRST: THIS IS SCAFFOLDING, NOT A FEATURE
>
> His framing, in his own words, before a line of it was written:
>
> > *"lets do something provisional but it is important, just take into account that this will not
> > the final feature, just something temporal like an sketch"*
>
> and again, when the composer joined it:
>
> > *"the composer field we will add is also a sketch as the title, it means it is temporal"*
>
> **Every decision recorded here was made to be thrown away.** It exists so a wrapped page stops
> looking headless while the real layout work is still ahead. ⛔ Do not build on it, do not extend it
> with a third field, and do not treat any number in it as settled engraving. §6 is the list of what
> the real thing owes and this owes nothing towards; §5 is the (short) list of what is worth keeping
> when it is replaced.

---

## 1. What it does

In **wrapped view, on paper, on the first page only**, the score's `title` and `composer` are drawn
at the top of the sheet, above the opening system:

- the **title** centred at the head of the block;
- the **composer** right-aligned at its foot;
- both **selectable** (click), **deletable** (Delete/Backspace removes the field from the JSON), and
  **editable** (double-click opens the same dialog `Score ▸ Add Title… / Add Composer…` opens).

Neither field exists by default: a fresh `ScoreModel` writes no `title` key at all.

## 2. Where it lives

| thing | module |
|---|---|
| The two strings, as ONE table — read / write / clear | `engine/models/scoreTextOps.ts` |
| The drawing, the sizes, the room it takes | `engine/rendering/ScoreHeaderPass.ts` |
| The room, as an input to the vertical cast-off | `engine/layout/pageCastOff.ts` (`firstPageHeadPx`) |
| The press and the paint | `interactions/elements/scoreText.ts` (+ its two rows in `elements/chain.ts`) |
| The highlight | `HighlightController.applyScoreTextSelectionHighlight` |
| Delete | the `scoreText` case in `shortcutWiring`'s Delete switch |
| The dialog | `windows/scoreTextWindow.ts` (one window, both fields) |
| Dialog → engine | `bus/scoreTextSelection.ts` → `interactions/ScoreTextController.ts` |
| The menu rows | `menus/scoreMenu.ts`, under a separator |

⭐ **One selection kind for both lines** — `{ kind: 'scoreText'; field }` — because they differ in
nothing a press, a paint or a Delete cares about. Two kinds would be two rows in six tables saying
the same thing.

## 3. The numbers, and where each came from

⭐ Every size is in **staff spaces**, never px (`reference_engraving_text_sizes`: no notation program
states text in pixels). MuseScore's 10 pt against its 1.75 mm spatium is **2.02 spaces**, so its
figures scale by ×0.202.

| what | value | source |
|---|---|---|
| Title size | **4.44 sp** | MuseScore `titleFontSize` 22 pt (`styledef.cpp`) |
| Title alignment | centred, at the frame's top | MuseScore `titleAlign` HCENTER/TOP |
| Composer size | **2.80 sp** | see below — ⚠️ NOT MuseScore's own figure |
| Composer alignment | right, at the frame's foot | MuseScore `composerAlign` RIGHT/BOTTOM |
| The frame | **10 sp** | MuseScore's default title `VBox` (`box.cpp`, `absoluteFromSpatium(10_sp)`) |
| Air below a composer | **+5 sp** | LilyPond `markup-system-spacing.basic-distance` (`ly/paper-defaults-init.ly`) |

### 3a. 🚨 Why the composer is not MuseScore's 10 pt

It was, first — and his eye caught it: *"the composer font size is not big enough"*.

The two references **disagree, and the disagreement is in the RATIO** rather than in either number.
LilyPond's `bookTitleMarkup` (`ly/titling-init.ly`) sets the title `\huge \larger \larger \bold` —
font-size **+4**, and `magstep s = 2^(s/6)` (`scm/lily-library.scm`), so **×1.587** — while the
composer takes the **default text size with no override at all**. So:

- LilyPond: title is **1.587×** its composer;
- MuseScore: title is **2.2×** its composer (22 pt against 10 pt).

Our title is MuseScore's — the **larger** of the two — so pairing it with MuseScore's composer would
be right, and pairing it with the smaller of the two composers exaggerated a gap neither book states.
⭐ Ours takes **MuseScore's title and LilyPond's ratio**, which is the only combination that is not a
guess: 4.44 ÷ 1.587 = **2.80 sp**.

⚠️ This is exactly the kind of call §6 says the real feature must re-make with a style system behind
it. It is recorded here so that when it is re-made, it is re-made from the sources and not from this.

### 3b. 🚨 Why a composer buys air and a title does not

His report: *"if we add a composer field we need to add more air between the composer and the
beginning of the score"*.

A title-only header already clears the music: the title's baseline sits 3.46 sp down a 10 sp frame,
so more than six spaces of paper follow it. The **composer is aligned to the frame's bottom edge** —
that is the whole point of `composerAlign` BOTTOM — so it ends where the frame ends, with nothing
under it at all. ⭐ The air is what the alignment costs, so it is owed by the line that chose the
alignment: `COMPOSER_AIR_SPACES` is added to the frame only when a composer is drawn.

## 4. ⭐ Wrapped view, and only on paper

The gate is one function (`headerIsDrawn`), asked by both exports so they cannot disagree.

- **Linear view** is one endless system with no page to head — his ask said wrapped, and it is also
  the only place the thing means anything.
- **The sketching CANVAS** is an endless strip, and `SurfaceMetrics.heightPx === null` IS "not paper"
  (`layout/surface`). ⭐ That half is what keeps the scaffolding out of every fixture's geometry: the
  renderer's own default surface is the canvas, so a header there would push the music down 10 staff
  spaces in code that has nothing to do with pages. (It did, briefly — four culling specs failed,
  which is how the rule was found.)

## 5. ⭐ What is worth KEEPING when this is replaced

Three things, because getting them wrong would cost more than the sketch is worth:

1. **The room is taken BEFORE the cast-off, not after.** `sketchHeaderRoomPx` goes into
   `pageCastOff` as `firstPageHeadPx`, so page 1 genuinely holds fewer systems and a break falls
   accordingly. Shifting the tops afterwards would walk the last system on page 1 off the sheet.
2. **It PRINTS.** Unlike `PagePass`'s desk and sheet edges, a title is ENGRAVING and not an editing
   affordance, so there is no `RenderAudience` gate — the PDF gets it.
3. **No measurement, NO hit-box.** ⛔ Never an estimated text width. jsdom has no layout, so a
   guessed box would be believed by every press that landed in it; a header nobody can click is a
   visible, explicable failure, where one whose box is somewhere else is not.

…and one rule that belongs to the MODEL rather than to the sketch: **blank means absent, in both
directions.** A blank write deletes the key and a blank field reads as nothing, so there is no
difference between *"this score has no composer"* and *"its composer is `''`"* — which is what makes
the exported JSON honest and what lets the dialog have no Clear button.

## 6. ⛔ What the REAL thing owes, and this owes nothing towards

**⏭️ Rethink all of it the day the real layout work opens** (`layout-plan.md` §8, THE VERTICAL — the
header's room is a vertical question, and this sketch answers it with two constants).

- **A title is not a `string` on `Score`.** The finished thing is a FRAME of *text items* — title,
  subtitle, composer, lyricist, arranger, copyright, a per-page header/footer — each an engraved
  object with an id, a placement, a style and its own offsets, of the same species as every other
  mark: its own row in `ELEMENT_SPECS`, its own overrides, its own anchor guide. MuseScore models it
  exactly that way (a `VBox` holding `Text` elements). ⛔ **A third string does not arrive by adding
  a third row to `scoreTextOps`** — it is the signal that the sketch has outlived itself.
- **Nothing here is LAID OUT.** The pass measures nothing before drawing: it anchors one line per
  field and trusts it to fit, so a title longer than the page runs off it. Real text WRAPS, and
  wrapping needs the font measured — browser-only work, so the real one is a measured pass rather
  than arithmetic.
- **The room is not a frame.** Two constants of blank paper, whatever the block holds. A real
  frame's height follows its text, line by line.
- **There is no style system.** One serif stack and two font sizes, hard-coded. Every reference
  program makes each of these a document-level style the user can set, which is where §3a's judgment
  call properly belongs.
- **It is first-page only, and unmovable.** No per-page headers or footers, no page numbers, no
  offset, no drag — an override has nothing to be keyed to, because there is no element.
- **It has no Properties panel.** The selection reports `{ field, text }` and the panel stringifies
  it; there is no control to edit it there, only the dialog.

## 7. Also decided here (and not a sketch)

Two things this work changed that stand on their own merits:

- **`Score.title` is OPTIONAL**, and a fresh `ScoreModel` seeds no title at all (his ask: *"the
  default score should not have title field in the json"*). This replaced a seeded `'Fragment 1'`,
  and the argument on that constant survives its deletion intact: its point was that the trailing
  "1" was never a live counter — numbering would mean ambient global state, which DESIGN-PRINCIPLES
  §1 forbids — and that whoever OPENS a fragment supplies the name. Writing no name says it plainer:
  **the model must never invent one.**
- **The manual double-click detector is keyed `mark:id`**, one pair of fields for every family, where
  `MouseController` held a pair PER MARK. The header lines were going to be a third pair and a third
  branch; keying by the mark makes them neither, and it is exactly as strict (two marks make two
  keys, so a tempo press followed by a dynamic press is still not a double-click).
