# The marking tool — one armed value, not eight flags

A **marking tool** is something armed for placement: arming one switches to entry mode, hides the
keyboard cursor, previews itself as a ghost at the pointer, and makes the next canvas click *place or
stamp* instead of entering a note. There are nine:

| | tool | arms | click does |
|---|---|---|---|
| **positional** — place a new object at a slot | `clef` | a `Clef` | sets that measure/beat's clef |
| | `timeSignature` | a `TimeSignature` | sets that measure's meter |
| | `dynamic` | a level or `'text'` | places the mark |
| | `tempo` | a `TempoTool` | places the mark (system-level) |
| **stamps** — attach to a note that already exists | `articulation` | a SET (additive) | adds them to the note clicked |
| | `accidental` | one sign (swaps) | re-spells the note clicked |
| | `tie` | *nothing* | ties the note clicked to the next slot |
| | `dot` | *nothing* | dots the note **or rest** clicked |
| **place a length** | `rest` | *nothing — it reads the armed length* | **places** a rest at the beat clicked, replacing what it covers |

They are **mutually exclusive**: exactly one is armed, or none.

## The rest tool is the odd one out (and why it carries no value)

Every other tool either places an object or *adds* a mark to something that already exists. A rest is
neither: it is **a length**, and a length is the one thing the note-entry keys already hold. So:

- It arms `{ kind: 'rest' }` — **valueless**. It does *not* carry a `duration`. Copying the length
  into the tool would be a second source of truth to keep in step with `selectedDuration` /
  `selectedDots`, which is the exact N² problem this union was built to delete.
- It is the **only** tool the duration and dot keys stay live under. They light, and pressing one
  **retunes the armed rest** rather than ending the tool. That is not an exception list: it is the
  property `MARKING_TOOL_USES_ARMED_LENGTH` asks of every kind, and a tenth tool cannot be added
  without answering it (the same trick as `MEASURE_RENDER_ROLE`).
- Its click is **positional**, not a hit-test: it is note entry with `isRest`, so you click a place
  in the bar and the rest lands there — you do not have to hit a glyph. It shares note entry's beat
  resolution and snap (`addRestAtPosition`), minus everything about pitch. Built the other way first
  (off `findClosestNoteOrRest`) it was nearly unusable: every click in open space reported "not on a
  note or rest" and only a direct hit on the default rest did anything.
- It **replaces** rather than adds, so it is not idempotent — clicking a note destroys it. A longer
  armed rest overwrites what it covers, exactly as dropping a half note over two quarters does.
- Its ghost is the only stamp ghost with a **value** to show (the armed length). It draws the
  **attach line** for whole/half rests: they are the same rectangle, and *hangs from* vs *sits on* a
  line is all that distinguishes them — invisible on a ghost floating free of the staff.
- **Capped at the barline**, never split: a note that overflows splits and ties, which a rest cannot
  do (`fitRestDuration`). The trim takes the **longest value that fits, single dot included** — three
  beats left is a dotted half, not a half and a quarter — and knows nothing about meter, so no time
  signature needs a case of its own.

### It is the only tool with a KEYBOARD half — SPACE types rests

Arm it in keyboard entry and **SPACE lays the armed rest at the caret and moves on**, like a
typewriter's space bar (`KeyboardController.enterArmedRestAtCursor`). Hold it and rests type out; at a
barline the rest trims to fit and the caret rolls into the next measure. The armed length is *not*
consumed — SPACE again types the same rest.

The mouse stamp and SPACE share `fitRestDuration`, so what a barline does to a rest is **one answer,
not two**. Everything else about the tool follows from "a caret is not a selection":

- **Arming keeps the caret.** `selectedNoteId` is the selection anchor in selection mode and the
  CARET in entry mode; arming clears a *selection*, so from entry mode it leaves the caret alone. You
  leave keyboard entry by **placing** something — the stamp click drops the caret, arming does not.
- **Disarming returns you where you came from**: caret up ⇒ back to keyboard entry (not selection
  mode, which lit `0` straight back up — a caret note that IS a rest reads as "a rest is selected", so
  the tool looked undisarmable while it was disarming every time).
- **Typing a note disarms it.** The lit key claims what the next thing entered will be; a letter
  settles that. Keeps the armed length — the quarter you were resting is the quarter you now note.
- **Arming clears the note-entry extras** (accidental, articulations, beam): a rest is a length and
  nothing else. The Keypad already darkened those keys; clearing makes the dark keys TRUE rather than
  a mask, since the values were sitting in the state waiting to land on the next note.

⚠️ **A cap is not a choice.** Moving the caret syncs the palette to the note it lands on, which is
right for a selection and wrong for a barline-trimmed one — the trim would silently become the armed
length. Both entry paths hold the armed length across the placement. That is a patch in two places
for one rule; see `docs/caret-is-not-a-selection-plan.md` for the general fix (and the live bug it
also repairs).

## Why one field

They used to be eight independent fields — `selectedClef`, `selectedTieTool`, … — and nothing in the
type said they were exclusive. "The tie stamp and the dot stamp are both armed" was a sentence the
type could express, and the only thing preventing it was **eight arm-sites each remembering to clear
the other seven**, plus every press handler naming its siblings to switch. N² edits to keep in step,
and a missed one is **silent** — no compiler error, no test failure unless someone predicted that
exact pair.

That is not theoretical. Three bugs, all the same bug:

- **`dac5f42`** — a press armed TWO tools. `setAccidental`'s switch-tools check read
  `if (selectedArticulationTools.length > 0)`: it named the one sibling that existed *the day it was
  written*, so it didn't know the tie stamp existed. Caught only because a mutual-exclusion test
  happened to exist.
- **`setClef` never learned about the stamps.** It cleared time-signature/dynamic/tempo — the three
  tools of its day. So: arm the tie stamp → click clef (both armed, clef wins) → click clef again to
  disarm → **the tie stamp silently came back**. This shipped and went unnoticed until the union
  deleted it.
- **`setDuration` forgot the tempo tool** while clearing the other seven.

Now:

```ts
selectedMarkingTool: MarkingTool | null
```

Arming **is** clearing — a field cannot hold two values — so the illegal states are *unrepresentable*
rather than merely unreached, and there is no sibling list to fall behind. `armMarkingTool(tool)` is
the single write path; every "is a different tool armed?" check collapsed to `if (armed)`;
`disarmPositionalTools` went from eight lines to one.

Net: **−131 lines of source**, no new behaviour, three bugs gone.

## Adding a ninth tool

Add the variant to `MarkingTool` and **build**. The compiler names every site that must decide
something — verified by actually doing it:

```
PaletteController.ts: Function lacks ending return statement   → promoteStampToNoteEntry:
                                                                 does it have an entry-mode home?
RenderController.ts:  Argument of type '{ kind: "hairpin" … }'  → renderToolGhost:
                      is not assignable to parameter of type 'never'    how does it preview?
```

Two questions, asked by the build, where there used to be ~24 places to remember. That is the whole
point of the union; keep the exhaustive `switch`es exhaustive (`assertNeverTool`) and don't reach for
a `default`.

## Rules that live here

- **Always REASSIGN, never mutate inside.** `selectedMarkingTool` is the only object-valued field on
  the state, and the observable Proxy traps a SET on the field — a `tool.clef = 'bass'` would be
  invisible to it and the Keypad would go quietly stale. All seven write sites assign a whole value;
  `observableEditorState.spike.test.ts` (6) and (6b) pin it.
- **Any armed tool darkens the note-entry keys — except one.** They arm into entry mode but enter
  *no note*, so duration / accidental / dot / articulation go dark; otherwise the Keypad claims "a
  quarter note is coming" while a clef is armed. This once tested a list of the four *stamp* kinds;
  the list encoded no real distinction and is deleted. The `rest` tool is the sole exception, and a
  principled one — it USES the armed length (see above), which `MARKING_TOOL_USES_ARMED_LENGTH`
  states as a property of every kind rather than a list of names.
- **The gate belongs in the rule.** `dotHighlight` and `durationHighlight` are the single source for
  their keys — the Vue palette's computeds read them too — so the armed-tool gate lives inside them,
  not at the caller.
- **Framework-agnostic.** All of it lives in `interactions/`; no `vue` import (enforced by
  `lint:boundary`). `armMarkingTool` doesn't know whether a palette button, a Keypad key, a menu or a
  shortcut called it — which is what makes the Vue palettes deletable, and a right-click clef menu a
  new *caller* rather than a new mechanism. App.vue holds six read-only `armedTool(...)` pokes for
  button CSS, and nothing else.

## Two asymmetries preserved on purpose

Not fixed here, because this change was about the state's shape, not its behaviour — but now visible
as named methods instead of implicit in eight copies:

- Re-pressing a **stamp** key disarms to **selection** mode (`disarmMarkingTool`); re-pressing a
  **clef/TS/dynamic/tempo** button disarms to **entry** mode (`disarmToEntry`), so you fall back to
  the ghost note. The positional tools predate the stamps and only ever set the mode in their arm
  branch.
- A duration press **promotes** the accidental and dot stamps into note entry (the "accidental +
  duration" / "dotted quarter" flows) but merely disarms the other six — the tie has no armed
  entry-mode form, and the positional four place objects, not note properties. The `rest` tool is
  reached by neither path: a duration press returns before `promoteStampToNoteEntry` (it retunes the
  armed rest), and there is nothing to promote it *to*.
