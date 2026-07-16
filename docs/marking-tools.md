# The marking tool — one armed value, not eight flags

A **marking tool** is something armed for placement: arming one switches to entry mode, hides the
keyboard cursor, previews itself as a ghost at the pointer, and makes the next canvas click *place or
stamp* instead of entering a note. There are eight:

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

They are **mutually exclusive**: exactly one is armed, or none.

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
- **Any armed tool darkens the note-entry keys.** All eight arm into entry mode but enter *no note*,
  so duration / accidental / dot / articulation must go dark — only the armed gesture lights.
  Otherwise the Keypad claims "a quarter note is coming" while a clef is armed. This once tested a
  list of the four *stamp* kinds; the list encoded no real distinction and is deleted.
- **The gate belongs in the rule.** `dotHighlight` is the single source for the dot key — the Vue
  palette's computeds read it too — so its armed-tool gate lives inside it, not at the caller.
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
  entry-mode form, and the positional four place objects, not note properties.
