# Measure numbers — the printed bar number (2026-09-28)

His ask: *"lets think now how to do measure numbers, we dont have it yet, we have it for linear view but this
is another thing … in the beginning we will have it … just in the beginning of the system (first system dont
show it) … a button in the dev shell cause this is temporary and we can select to show or not and default is
not show … measure number can be configurable in the future for the user (for example, maybe the user in some
point want to enter a random number) … for measure number and label we have to know position font size style
we need numbers."*

Research (findings only — ⛔ they do not know what is decided here):
`docs/research/measure-number-books-research.md` · `docs/research/measure-number-engines-research.md` ·
`docs/research/measure-number-industry-research.md`. The staff label's numbers from the same research went to
`docs/plans/staff-label-plan.md` §4.

## 0. What it is — and what it is not

- ⭐ **The printed number at the start of each system, above the top staff — except the first system.** It is
  Gould's rule word for word (p. 484: *"at the beginning of each system, ideally above the clef of the top
  stave"*; *"The first bar of a piece … is not labelled"*), and the default of LilyPond, MuseScore, Verovio,
  Sibelius and Dorico (engines §0, industry §0).
- ⛔ **It is NOT linear view's gutter number** (`rendering/GutterRenderer` — a frozen reading aid on the screen,
  Arial 11 px, not engraving). The two stay separate (his word); whether the gutter later shows the PRINTED
  number instead of the bar's index is his call (§7).
- ⛔ **It is NOT `Measure.number`.** That field is the bar's INDEX — renumbered on every insert (`measureOps`,
  `ScoreModel.insertMeasureAfter`) and the ADDRESS the whole editor finds a bar by (the registry, commands,
  `getSystemOpeningMeasureNumber`). Every standard keeps the bar's identity apart from the number printed on it,
  and the printed one is TEXT (MusicXML `number` token + `text`; MEI `@n` string + `<mNum>`; industry §0).

## 1. ⭐ ONE resolver answers "what number does this bar print?" — from day one

`printedMeasureNumber(score, index) → string | null` in the core (`engine/models/measureNumberOps`, principle 5).
Everything that prints a bar number asks it; ⛔ nothing prints `measure.number`. Today it is only a rule:

- **the bar's position, counted from the first COMPLETE bar** — ⭐ a pickup that opens the score is not counted
  (Gould p. 484: *"The first complete bar (and not an up-beat) is bar 1"*; Stone p. 168; MuseScore excludes it).
  Our pickup is the first bar carrying `actualDurationOverride` shorter than its meter
  (`utils/measureCapacity`). ⚠️ Sibelius numbers it 0 and LilyPond shares 1 with the next bar — a row
  (`notCounted` ⭐ default / `zero`), and it never shows at a system start's first system anyway.
- `null` = the bar prints no number (a pickup under `notCounted`).

⭐ **Why build the resolver before anything is stored:** his future (*"the user … want to enter a random
number"*) then changes ONE function's inputs and no reader. It is the tempo / meter / clef lesson
(principle 6): the day the second value appears, everything already asks the right question.

## 2. The FUTURE: numbering statements — positional, ⛔ NOT built now

Recorded so today's shape does not foreclose it. What the editors expose (industry §0, §3–§6) reduces to a
statement AT A BAR that changes the count from there on — positional, resolved by counting forward from the
nearest earlier statement, bottoming out in the rule of §1:

- **restart at N** (Sibelius "New bar number", Dorico Primary, LilyPond `currentBarNumber`, MEI `@n` *"should
  restart numbering"*) — his "enter a random number";
- **don't count this bar** (Sibelius, Dorico "Don't Include", MuseScore `irregular`, Finale `noMeasNum`,
  MusicXML `implicit`);
- **a suffix run** — *12a 12b* (Dorico Subordinate, Sibelius format 1a/1b; Gould p. 237's ending option);
- **free text** before / after, or instead (Sibelius "Add text", MusicXML `text`, MEI `<mNum>`).

⛔ Keyed by the measure ID, never its number (the `engravingOverrides` / sound-assignment lesson: numbers
renumber). Content, not presentation — it is what the bar IS called. ⚠️ MuseScore REWRITES its typed text on
every layout (engines §2) — a typed number must survive a relayout, which the walk-forward resolver gives for free.

## 3. Showing it — a document-wide LOOK setting, session-only

`measureNumbers: 'none' | 'systems'` — ⭐ **default `none`** (his word: *"default is not show that this is what
we have for the moment"*). `systems` = each system's first bar, except the first system.

- Same route as `justifyLastLine` and the staff label's switch (`staff-label-plan.md` §3): engine-held, pushed to
  the renderer, in `layoutStateKey` — the parked boundary case of `DESIGN-PRINCIPLES.md`.
- ⏭️ *"this is going to change in the future"*: every N bars (Stone's "customary" every 5th — ⚠️ Gould says
  *"should be avoided"*), every bar, above other staves. `'none' | 'systems'` is where they grow from.
- **Linear view** has one system; its first bar is never numbered, so the score draws nothing there — the gutter
  keeps its own number.

## 4. Engraving — the NUMBERS (each a changeable ROW; ⭐ default = Gould unless he decides)

| | ⭐ `gould` (default) | alternatives |
|---|---|---|
| **staff** | the TOP staff only (p. 484) | Stone: also above the strings / piano / accompaniment (Later) |
| **horizontal** | the number's LEFT ink **flush with the staff's left end** — over the clef (p. 490, measured Δ −1 px) | MuseScore / Sibelius / Dorico: left at the initial barline (the same x here) · Verovio: centred on it · LilyPond: right edge AT the system's left edge, before the clef |
| **vertical** | baseline **2.4 sp** above the top line (p. 490), and never less than **0.55 sp** of white above the ink below it (the clef's top, measured) | MuseScore 2.0 sp + 0.5 sp min · Stone 2.0–2.2 sp · Verovio 1.35 sp fixed · LilyPond 1.0 sp padding on the skyline |
| **size** | digit height **1.65 sp** (p. 490), staff-scaled with the top staff | Stone 1.4–1.5 sp · MuseScore 8 pt FIXED ≈ 1.6 sp · LilyPond ≈ 1.75 sp · Verovio 1.8 sp em |
| **style** | **italic**, unframed (p. 484: *"italic to differentiate bar numbers from roman-type page numbers"*) | LilyPond upright · frames: Stone prefers a rectangle to a circle |
| **face** | the WORDS face (`textFamily(style)`), as every text instruction | — |

- ⚠️ A DIGIT height is not a font size: the font size is the one whose figures come to 1.65 sp in the words
  face — read from the face's metrics, ⛔ never guessed. The size in points is stated nowhere (books §3).
- **Vertical is ink-aware** — `docs/how-it-works/above-staff-ladder.md` §4: ⛔ no third private vertical rule;
  the number reads the ink band over its own short span (the clef, the system's first notes) the way the trill
  does, and takes the higher of its baseline and that clearance. ⚠️ **Against a TEMPO mark at the same bar:**
  Stone p. 169 puts the number ABOVE the tempo; Gould p. 520 reserves the place above tempi for rehearsal marks
  and endings (an inference). Today tempo is a fixed outermost rung — the two will meet at a system that opens
  with a tempo mark. ⏭️ His eye decides the order; ⛔ not a blocker.
- **It PRINTS** (engraving, not an affordance) and takes NO horizontal room — nothing is cast off differently.
- The staff label (`staff-label-plan.md`) stands LEFT of the system; the number stands ABOVE the clef — they
  do not meet.

## 5. The UI for now — scaffolding in the dev toolbar

In the `View:` group beside `Justify last`: **`Bar numbers`**, a toggle, off by default. Its logic in its own
`interactions/controllers/` module; the toolbar gets one line. 🚨 `lint:hubs` counts kind names as WORDS in the
hubs, strings included.

## 6. Phases — ⭐ one at a time, each stopped for his check

| Phase | Scope |
|---|---|
| **P0** | This document. |
| **P1** | The resolver (§1) + its spec: index, pickup rule, `null`. No stored field, no JSON change. |
| **P2** | Drawing at each system's first bar (§4 rows), ink-aware vertical, PDF. Browser tests for where it lands. |
| **P3** | The dev toggle (§5) + the session setting (§3). |

## 7. Later — ⛔ not a queue

The numbering statements (§2) and their UI · every N bars / every bar (§3) · other staves (Stone) · a bar split
across systems in parentheses *(122)* (Gould p. 490) · 1st / 2nd endings (count through ⭐ vs a/b — Gould
p. 237) · multi-bar-rest ranges · selecting the number on the score + Properties (its own element module) ·
the tempo-mark order (§4) · the gutter showing the printed number · the bent staff's port-map row
(`bent-staff-plan.md` §5) · MusicXML / MEI import-export (`number` vs `text`, `@n` vs `<mNum>`).
