# A caret is not a selection — one rule instead of a patch per entry path

Status: **IMPLEMENTED 2026-07-18 (uncommitted).** Diagnosed 2026-07-16 while shipping the rest tool;
parked, then built as written below. `moveCaretTo` split out of the selection path; both hand-restores
deleted; keyboard + mouse entry rewired to it; the §6 accidental leak pinned with a red→green test on
the REAL SelectionController. 1443 unit tests green, typecheck + `lint:boundary` clean. ⚠️ STILL NEEDS a
by-hand pass on MOUSE entry (§5 step 5 was a code-path argument, not a measurement) and on the chord
accidental behaviour change (§5) before it's truly done — the user does the manual UI testing.

⭐ **It is worth doing, and §6 is why**: the same root cause makes an armed sharp leak onto every note
typed after it — measured, live, unreported. This is not only tidying.

Goal: advancing the keyboard caret must stop re-arming the palette from whatever note it lands on.
Selecting a note and moving a caret onto one are two different acts sharing one method, and every
entry path pays for it with four lines of "put it back afterwards".

---

## 1. The bug, twice, reported live

Both were found by hand, from console traces, minutes apart:

**A cap is not a choice** (rests). Arm a WHOLE rest, SPACE at beat 1 of 4/4 → capped to a dotted half
(correct — a rest cannot cross a barline). The caret lands on it, the palette syncs *to it*, and the
armed length silently becomes `h.`. SPACE again in the empty next bar → a dotted half, not the whole
you armed. Every bar after inherits it.

**A split is not a choice** (notes). Arm a WHOLE, type `A` on beat 1 of 4/4 → a dotted half tied to a
quarter (correct). The caret lands on the QUARTER — genuinely where the note ends — the palette syncs
to it, and the Keypad now reads *negra*. The next note comes out a quarter.

> The user's words: *"the cursor land after the first beat but on the keypad now i have a negra, what
> is expected is have the same duration the user enter."*

Same mechanism, one path apart. Both are patched today by capturing the armed length before placing
and writing it back after `setSelectedNote`.

## 2. Why the patch is not the answer

The identical four lines now live in `enterArmedRestAtCursor` and `enterNoteAtCursorPosition`. That is
the N² shape this codebase keeps deleting (see `docs/marking-tools.md` — eight flags with eight
arm-sites each clearing the other seven, and a missed one is silent). A third entry path needs the
same four lines and nothing makes anyone remember.

It has already drifted once: the rest path got the fix, the note path was FLAGGED in the same session
("could bring back the split part's duration… I haven't measured it") and left. It was real, and the
user hit it within the hour.

## 3. The rule

`SelectionController.syncPaletteToNote` does TWO jobs:

| | what it sets | who needs it |
|---|---|---|
| **palette** | `selectedDuration`, `selectedAccidental`, `selectedDots` | a SELECTION — click a note, see its properties |
| **lane** | `activeVoice`, `activeStaff` | BOTH — a caret needs it too |

A caret advance needs the **lane** and not the **palette**. The palette holds what you are about to
TYPE; the note under the caret is what you just typed, or what the barline allowed. Selecting is
"show me this"; the caret is "I am here".

⚠️ The lane half is **not** optional for the caret: `HighlightController.applyKeyboardCursor` resolves
its beat stream through `activeVoice`/`activeStaff`, so dropping it lets the caret drift into another
voice's stream. "Just don't sync" is the wrong fix; splitting the two jobs is the right one.

## 4. The change (measured, ~30 lines, 4 files)

1. **`SelectionController.syncPaletteToNote` → split.** Extract `syncActiveLaneToNote(noteId)` (voice +
   staff); `syncPaletteToNote` calls it, then sets duration/accidental/dots. **Its six existing callers
   do not change** — they are all genuine selection paths.
2. **Add `moveCaretTo(id)`** beside `setSelectedNote`. Same body — **including `updateUndoNoteId(id)`;
   entry is undoable, and that line lives in `setSelectedNote`, not `selectNote`, so it is exactly the
   one a "same body" refactor drops** — but lane sync only, not palette. Share one private
   (`selectNoteInternal(id, syncPalette)`) so the two PUBLIC names carry the meaning — the call sites
   read as two different acts, not one act with a flag.
3. **`useKeyboardEntry.ts`** — inject `(id) => selection.moveCaretTo(id)`. This one swap converts all
   THREE keyboard entry sites at once: they are the only users of the injected dep, and all three are
   caret advances (rest ~225, note ~365, chord ~438).
4. **Delete both restores** in `KeyboardController` (and their "a cap/split is not a choice" comments —
   the rule moves to `moveCaretTo`'s doc, where it is stated once).
5. **`MouseController` ×3** (~1694, ~1721, ~1742) — swap `this.selection.setSelectedNote(…)` →
   `this.selection.moveCaretTo(…)` at the click-entry sites. **This is NOT automatic** (see §5): mouse
   calls the controller directly, so the keyboard injection swap does not reach it. Do this only after
   probing §5 — the split-across-barline bug there is argued, not measured.

It is small because the two acts are **already separated by their callers**: every selection path goes
through `selectNote`, every entry path through `setSelectedNote`. Nothing has to be untangled first.

## 5. What else it reaches — one truly free, one a deliberate swap

- **`addChordNoteByLetter`** (KeyboardController ~line 438) — **genuinely free.** It uses the same
  injected dep as the other keyboard sites, so step 3's single swap fixes it with no extra edit. A
  third caret site with the same clobber, never patched, never reported; the patch approach would have
  missed it again. ⚠️ One behaviour shift to note: unlike note entry, the chord path never sets
  `selectedAccidental = null`. Today the sync overwrites the armed accidental with the chord note's
  displayed one; after the fix the **armed accidental persists** across a chord-note add. That is the
  intended "the palette is what you'll type next" rule — but it is a real change, so land it knowing it.
- **`MouseController` ×3** (~1694, ~1721, ~1742) — **NOT free.** Click-entry calls
  `this.selection.setSelectedNote(…)` DIRECTLY, so it has the same clobber **today** but the keyboard
  injection swap does not touch it. Fixing it is §4 step 5's three explicit call-site edits. NOT
  reproduced — the code path is identical, but that is an argument, not a measurement. Probe it before
  claiming it.

## 6. ⭐ It fixes a LIVE bug: the sharp leaks onto every note after it

**MEASURED 2026-07-16, not argued.** This started as "a behaviour change to watch" and turned out to be
the strongest reason to do the work at all.

`enterNoteAtCursorPosition` sets `selectedAccidental = null` ("Clear accidental after keyboard entry")
and then `setSelectedNote` immediately syncs it BACK from the note it landed on. Probe, driving the
REAL `SelectionController` (constructible with four trivial deps — `() => engine`, state, and two
no-ops):

```
arm '#', type A  → A1   (A sharp — correct)
type B           → B1   (B SHARP — nobody asked for this)
armed after      → "#"  (and it never clears)
```

So a sharp is armed for ONE note and leaks onto **every note after it**, until you press the accidental
key again. That is the "duration + sharp remembered" bug class `setDuration` already fights in its own
comment — alive, in keyboard entry, unreported.

The general fix repairs it as a side effect: once the caret stops syncing the palette, the `null` the
line already writes finally **sticks**. That is the tell that the fix is right — the intent was
correct and expressed years ago; the sync was overwriting it.

⚠️ Pin it with a test **before** touching the code, and drive the real SelectionController — see §7 for
why a stub cannot see this.

## 7. Testing

- ⚠️⚠️ **DRIVE THE REAL `SelectionController`. Do not stub it.** This bit three times in one session:
  1. `KeyboardController.test.ts` stubbed `setSelectedNote` as `(id) => { state.selectedNoteId = id }`
     — no palette sync — so a test literally named *"the armed length is not consumed"* passed while
     the app clobbered it on every capped entry. Nothing could consume it.
  2. Fixing that stub to sync duration+dots made the length tests real — and then the §6 accidental
     probe read `null` and said "no bug", because the stub still did not sync the ACCIDENTAL. A stub
     patched to the last bug is blind to the next one.
  3. Only the REAL SelectionController showed `B1`. It takes four trivial deps:
     `new SelectionController(() => engine, state, () => {}, () => {})`.

  The rule: for anything about what the palette holds after entry, construct the real controller. A
  stub of the thing under test is not a test. See `feedback_user_does_manual_ui_testing` — he finds
  these by hand precisely because the harness lies.
- Pin the rule where it now lives: `moveCaretTo` leaves the palette alone, `selectNote` still syncs it,
  and BOTH keep the lane. The existing armed-length tests should pass **unchanged** — they are the
  regression net, so do not touch them while moving the fix.
- Re-test by hand afterwards: keyboard entry AND mouse entry both change — **but only because §4 step 5
  swaps the mouse sites too.** If you ship the keyboard-only change (steps 1–4) and skip step 5, mouse
  entry is UNCHANGED and still clobbers; do not test it expecting the fix. This hand re-test across both
  input paths is the reason it was parked, not the reason to skip it.

## 8. Not in scope

- The rest of `syncPaletteToNote`'s selection callers (multi-select anchors, navigation, chord nav).
  They want the palette; they are correct.
- Whether the caret should sync the lane at all on a *multi*-selection. Different question.
