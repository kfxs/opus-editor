# JSON import / export — a sketch, on purpose

**Status:** built. `src/utils/scoreFile.ts` (envelope + read/refuse, unit-tested) and the two buttons
in `src/dev/scoreJsonPanel.ts`. The two decisions at the bottom are still open — the code took the
default on both, and says so at the point where it did.

There are no users and the score model changes constantly. This is *not* the file format.
It exists so an export taken today still opens tomorrow, and so that when it can't, the
console says why instead of the app dying. Everything below is expected to be replaced when
a real document model lands (title, pages, instruments — see `pdf-export.md`, which has the
same disclaimer).

## What we already have

`MusicEngine.exportJSON()` → `ScoreModel.toJSON()` → `JSON.stringify(this.score, null, 2)`.
That is already a serialization of the **data model**. The `<pre>` in the Score-JSON dev panel
(`src/dev/scoreJsonPanel.ts`) is a *view* of that string, polled every 400ms.

> ⚠️ The Export button must call `exportJSON()`. **Never** `pre.textContent`. The string is
> sitting right there in the DOM, which is exactly why the mistake is easy.

`MusicEngine.loadJSON()` builds the new `ScoreModel` first and only then assigns
`this.scoreModel`. A bad file throws and leaves the open score untouched. **Keep that
property** — validate fully before swapping.

## Why an old export survives a new feature

Not with a migration layer. We don't build those (`docs/` has no legacy JSON anywhere, and
there is deliberately no migration path). It works because of one habit already visible in the
model — `slurs?`, `staffGroups?`, `engravingOverrides?`, `dynamics?`, `clefs?` are all optional,
and *absent means the feature isn't used*. `ScoreModel.fromJSON` already hand-defaults exactly
one of them (`staves` → one staff, explicitly labelled "defaulting, NOT a migration").

So the rule, stated once:

> **A new feature lands as an optional field whose absence is a legal score, and the load
> boundary is the single place its default is filled in.**

Follow it and old exports load into new builds forever, with no converter. What breaks it is
never *adding* — it's *renaming or re-meaning*: dynamics going text-as-truth, `score.clef`
being deleted. Those files are genuinely dead. That is what the console message is for.

## The sketch

> ⚠️ **2026-07-31 — it moved, and it SHIPS now.** The demo's File menu offers Export PDF / Export
> JSON / Import JSON, and nothing that ships may import `dev/`. So the envelope went to `utils/`
> (pure, unchanged) and the three actions to `interactions/scoreFileIo.ts`, called by the dev panel,
> the dev toolbar and the menu alike. **None of it got more finished by moving.** In particular:
> *Import still REPLACES the open score with no confirmation*, which mattered less when the only door
> was a dev button. That guard is the first thing this should grow. The File menu itself is demo
> chrome — see the warning at the top of docs/menus-design.md.

1. **An envelope, in `src/utils/scoreFile.ts` — not in the engine.** Today the file is a bare
   `Score` with no self-description, so an import has no way to say "this isn't mine".
   `{ format: "opus-editor-score", version, savedAt, score: {…} }`. Keeping it in `dev/` leaves
   `exportJSON`/`loadJSON` pure model↔string, and keeps the provisional part provisional.
2. **On import, report — never repair.**
   - no `format` but has a `measures` array → bare legacy `Score`, load it, `console.info`.
     (Covers every pre-envelope export and all hand-written test JSON.)
   - `version` newer than this build → `console.warn`, try anyway. Optional fields usually win.
   - unknown top-level keys → `console.warn("ignored: …")`. This is the signal that a newer
     build wrote something we dropped.
   - no `measures` array → `console.error`, **refuse**, score unchanged.
   - A bad meter still refuses (`validateMeters`), but as a collected error, not a raw stack.

   ⛔ Do **not** clamp a bad meter to 4/4 or invent a missing field. A guessing fallback gets
   believed. Load cleanly or refuse loudly.
3. **Two buttons in the Score-JSON panel heading.** Export → Blob download, filename from
   `score.title`. Import → hidden `<input type="file">`.
4. **Import must clear selection first.** `loadJSON` doesn't. `__perf.load` in `App.ts` calls
   `selection.selectNote(null)` itself before loading, for this reason: selection, multi-select
   and the caret all hold ids into the score you just threw away.

## Two open decisions — write down the answer here when it's made

### 1. Does derived state ship in the export? — *currently: yes, by default*

`slot.actualDuration` is derived — `fromJSON` recomputes it from the slot and the measure
rather than trusting the wire. So exporting it is harmless, but it bloats the file and reads
as authoritative when it isn't.

- **Leave it** (current behaviour, and the default if nobody decides): it's a real signal when
  eyeballing the live panel — you can see the rebar result.
- **Strip it on export**: smaller, honest files; the panel loses that readout.

Whatever we pick, the trap is the same one: `toJSON` is `JSON.stringify(this.score)`, so it
ships *whatever is on the object*. Any transient/derived field added to the model in future is
exported by default, without anyone deciding to. If more of them appear, that argues for an
explicit strip step.

### 2. When does `version` get bumped? — *the proposal below is written on the constant*

If nobody has a rule, the number becomes noise and gets bumped at random or never.

Proposed: **bump only when a field changes meaning** — i.e. only when old files stop working.
Adding an optional field is *not* a bump, because old files still load. That makes the number
mean exactly one thing: *below this, refuse and tell the user why.* It is a tombstone marker,
not a migration hook.
