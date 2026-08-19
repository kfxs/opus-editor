# Which Voices a Dynamic (and a Hairpin) Affects

Status: **PLANNED 2026-08-19**, amended the same day against the code (the staff test, the two paste
roads, `createHairpin`, the write op — every site below carries its line number now, because the
compiler cannot list them). Gives the dynamics family a real *scope* — the voices its loudness
governs — defaulting to **ALL voices of its own staff**, editable from the Keypad's voice row and
`Alt+1…5`, and readable at a glance because the selection colour follows it.

## The ask (from the user)

> *"a dynamic and a hairpin affects the volume of the reproduction; so the default is that it affect
> ALL voices, and that is what means this color now: that means that a dynamic and a hairpin object
> should have a record of the voice it affect: 1,2,3,4 or ALL; the default is ALL … so when we select
> a dynamic and a hairpin we should be able to see the voice it affect in the keypad, and also …
> modify the voice it affect (and it highligh color) in the keypad section voice or with alt
> 1,2,3,4 or 5"*

And on what `Alt+N` does, which is the whole interaction rule:

> *"alt 1234 works regarding the context: if a note is selected it move the note to the voice, if a
> dynamic is selected it move the dynamic to the voice (we add in case of dynamic alt5 for all); if
> note + dynamic is selected we move everything to the voice (in this case if alt 5 we just move
> dynamic or hairpin cause for note this voice ALL is not valid)"*

## 🚨 What the code does today, and why this is a bug fix

1. `Dynamic.voice` / `Hairpin.voice` are `0|1|2|3`, documented *"governed voice/stream, default 0"*,
   and read through `voiceOf()` — absent = **voice 1**.
2. `resolveChordLevels` (utils/dynamics) matches `voiceOf(dynamic) === voiceOf(slot)`, and every
   stamp site writes a hardcoded `voice: 0` (`MouseController.placeDynamicAtClick` calls itself *"the
   VOICE SEAM"* and predicts this change). **So a dynamic today changes the loudness of voice 1 only
   — voices 2–4 never hear it, silently.**
   🚨 …and it matches ONLY the voice: there is no `staffId` test in that file at all, so a staff-2
   `p` already governs staff-1's voice 1. Absent = ALL turns that leak into the whole score unless
   the same phase closes it — the section after next.
3. A **hairpin has no playback at all** yet (no velocity ramp; `playbackSchedule` reads levels, not
   wedges). Its scope will be honoured for layout and colour now, and for sound when the ramp lands.
   ⛔ Do not describe this plan as making the wedge audible.
4. The Keypad's voice row is already `['1','2','3','4','All']`, with "All" deliberately inert:
   *"not an editor entry voice — keep it a local highlight for now (unwired)"*. Phase 4 wires the
   button that is already there.

## Decisions (locked with the user)

- **Absent = ALL; an explicit `voice` = that voice alone.** The common case stores nothing, which is
  the model's own idiom for a default. ⚠️ It inverts what absent means *for these two kinds only*.
- **ALL means every voice of the mark's OWN STAFF** — the ordinary notation rule. A dynamic under
  the left hand does not govern the right.
- **Existing files may be reinterpreted.** His: *"the file is not important, is just my example"*.
  Old scores stamp `voice: 0` explicitly and will read as *voice 1 only*; there is no migration
  (`docs/json-io-plan.md` — report-never-repair), and stamps stop writing the field from phase 1.
- ✅ **SETTLED (was assumed, then confirmed 2026-08-19: *"preserve the voice of the element… just as
  a label, just to know what voice affect in the reproduction"*) — a pasted mark keeps its OWN
  scope, on BOTH clipboard roads.** `elementClipboard` currently
  lets the anchor's lane win (`anchor.voice ?? clip.voice ?? 0`), so pasting an ALL dynamic onto a
  voice-2 note would scope it to voice 2. Written here as *scope travels with the mark, like
  `placement`*, and the anchor only supplies a lane to a mark that had one. ⇒ `pasteEvents` does not
  re-voice a mark into the target lane either: that re-voicing is for NOTES, which are *in* a stream.
- **`Alt+N` is contextual, and it is ONE rule:** *`Alt+1–4` applies to everything in the selection
  that can take a voice; `Alt+5` applies to everything that can take ALL — which is marks only.*
  A note moves voice, a mark changes scope, a mixed selection does both, and `Alt+5` leaves the
  notes alone because a note has no "all".

## 🚨🚨 ALL MEANS "ITS OWN STAFF", AND THE STAFF TEST DOES NOT EXIST

**`resolveChordLevels` / `resolveActiveLevel` match the VOICE and nothing else** — there is no
`staffId` comparison anywhere in `utils/dynamics.ts` (`:299`, `:340`). That is a live bleed already:
a staff-2 `p` governs staff-1's voice-1 chords today. Multiplied by *absent = ALL* it stops being a
gap and becomes the whole score — **every dynamic would govern every chord on every staff**, which
is a bigger wrong than the bug this plan fixes.

⇒ **The staff test lands in P1, with the ALL semantics it makes true.** Not deferred, not "made
visible": *all voices of its own staff* is unsayable without it.

⚠️ And `utils/dynamics.ts` cannot import `matchesStaff` (`engine/models/staffContent`) — no non-test
file in `utils/` imports `engine/`, and that arrow is the score layer's. The precedent is exactly
`utils/pedalScope.ts`: *what a mark reaches*, pure, normalising the absent-`staffId` itself. So the
accessor is a **MODULE**, not a line in `lanes.ts` (the ⭐ rule):

```ts
// utils/dynamicScope.ts — pedalScope's sibling: WHICH LANES A DYNAMIC/HAIRPIN GOVERNS
export type VoiceScope = 'all' | 0 | 1 | 2 | 3
export function voiceScopeOf(mark: { voice?: 0 | 1 | 2 | 3 }): VoiceScope     // absent = 'all'
export function governs(score: Score, mark: DynamicOrHairpin, slot: ChordRest): boolean
```

⛔ **`voiceOf()` must never be called on a `Dynamic` or a `Hairpin` again** — it answers 0 for
absent, which is now exactly the wrong answer.

## ⚠️ The compiler will NOT list the sites — this is a GREP migration

`voiceScopeOf` leaves the field's type identical, so nothing breaks; and **most readers are inline
`(x.voice ?? 0)`**, which compile unchanged whatever the accessor says. There is no "change the type
and follow the errors" here. The list is short enough to BE the checklist:

| Site | What ALL must mean there |
|---|---|
| `utils/dynamics` `resolveChordLevels:340` / `resolveActiveLevel:299` | every voice **of the mark's staff** — 🚨 and the staff test above. One non-test caller of the latter: `ScoreModel:1322`, whose signature gains the staff |
| `engine/models/dynamicOps:60` (`laneStops`) | any voice on its staff — the tempo mark's `onsets` rule |
| `engine/rendering/DynamicsLayout:66` (the drawn anchor) | the slot at that beat in ANY voice. ⭐ State the tie-break — *first in reading order* — it is arbitrary between voices and the mark is centred on the COLUMN anyway (`dynamicMarkAnchor`) |
| `engine/rendering/HairpinRenderer:130,305,313` (its lane + the dynamics it clears) | any voice on its staff |
| `engine/models/hairpinOps:311,362` (`addHairpinOverNotes` dedup, `hairpinSpan`) | a wedge with no voice covers the staff |
| `interactions/dynamicLane:58`, `elements/hairpinHandles:169` | the lane the walk/handles read |
| `interactions/attachedMarks:85,100` (the Properties list for a note) | an ALL mark is attached to every voice's note — ⚠️ and it tests voice but **not staff**, so a staff-2 hairpin would list under a staff-1 note. Same fix, same commit |
| `engine/MusicEngine.createHairpin:1355` | 🚨 see below |
| `interactions/clipboard:319,404` + `rebarOps.pasteEvents:505,524` | 🚨 the paste trap |
| `interactions/elementClipboard:101` | 🚨 the SECOND paste trap |

🚨 **The POSITION rows of this table were later overturned** — the walk, the drag, the drawn anchor
and the wedge's tips ask the STAFF, not the scope. See *"scope is NOT position"* below; the table is
kept as written because it is the checklist the migration was done against.

🚨 **`createHairpin`'s lane has TWO jobs, and they now diverge.** `s` over selected notes passes
`{ voice }` from the first note, and `addHairpinOverNotes` both *chooses the span's slots* with it
and *stores* it — so the ordinary case would store a scoped wedge. Split them: derive the span from
the notes' lane, store nothing. The idempotency test (`hairpinOps:311`) compares the same field.

🚨 **The paste trap, twice over.**
- `pasteEvents` re-voices a single-voice clip into the target (`voice: singleVoice ? targetVoice :
  cd.voice`) — and `clipboard.ts` collapses ALL to 0 at **copy** time (`voice: voiceOf(d)`), before
  paste is even involved. The clip must carry the SCOPE, and the re-voicing must skip an ALL mark.
- `elementClipboard:101` is a separate road: `voice: (anchor.voice ?? clip.voice ?? 0)`. An ALL
  dynamic pasted onto a note takes that note's voice; onto a mark, `?? 0` = voice 1.
  ⭐ **The clip's scope WINS over the anchor's lane** — scope is a property of the mark, like
  `placement`, and the anchor only supplies a lane to a mark that had one.

⚠️ **There is no way to WRITE ALL through the current mutators.** `ScoreModel.updateDynamic:516` and
`hairpinOps.updateHairpin:126` are `Object.assign`, so `{ voice: undefined }` leaves an own key
holding `undefined` — two spellings of one state, the very thing `moveDynamicToMeasure` guards
against for an emptied `dynamics` array. The scope write is its own op that **`delete`s** the field:
`setDynamicVoiceScope` / `setHairpinVoiceScope`, in `dynamicOps` / `hairpinOps`.

## Phases

**P1 — the model, the module, the sound, and the clipboards. ✅ BUILT 2026-08-19.**
`utils/dynamicScope.ts` (+ its spec); absent = ALL;
stop writing `voice: 0` at the four stamp sites (`PaletteController:2110`, `MouseController:663`,
`:2054`, `:2074` — and rewrite the VOICE SEAM comment at `MouseController:2039`, which predicts a
*different* change: "source the voice from a UI selector" is now "omit it"); `createHairpin` stores
no voice; and `resolveChordLevels` learns both halves at once — an ALL mark governs every voice **of
its own staff**. ⭐ This phase alone is the semantic fix: after it, a dynamic is audible to every
voice, which it is not today.

⚠️ **The clipboards ride along in P1, not at the end.** They were a phase of their own until the copy
path turned out to collapse ALL to 0 *before* any paste (`clipboard:319/404`): four phases would ship
with every copy silently narrowing scope. It is ~3 lines on each of the two roads — the passage clip
(`ClipDynamic`/`ClipHairpin` carry the scope, `pasteEvents` skips re-voicing an ALL mark) and the
element clip (`elementClipboard:101` — the clip's scope wins over the anchor's lane).

⭐ **What P1 actually landed**, since the line numbers move: `utils/dynamicScope.ts` +
`dynamicScope.test.ts` (`voiceScopeOf` / `scopeCoversVoice` / `governsSlot` / `sameScope` /
`staffScopeKey`) · both resolvers in `utils/dynamics.ts` rewritten onto `governsSlot`, with
`resolveChordLevels` carrying **two buckets compared by age** (the header there says why a per-lane
map cannot work) · `resolveActiveLevel` / `ScoreModel.getActiveLevel` / `MusicEngine.getActiveLevel`
gained the `staffId` half · the four stamps and `createHairpin` write no `voice` · `ClipDynamic.voice`
/ `ClipHairpin.voice` became OPTIONAL and travel verbatim · `pasteEvents` skips re-voicing an
unscoped mark · `pasteElement` keeps the clip's scope · `addHairpinOverNotes` de-dups on `sameScope`.
⚠️ The lane READERS were deliberately left alone — they still read `?? 0`, i.e. today's behaviour,
which is P3's job. A staff-wide wedge's `Ctrl+→` still walks voice 1's slots until then.
🧪 Break-tested both halves (sabotage `voiceScopeOf` → 10 red; drop the staff test → 5 red).

**P2 — the colour follows the scope. ✅ BUILT 2026-08-19.** `utils/selectionColors.markSelectionColor`
(+ its spec) is the whole rule — ALL → the element ink, a scoped mark → that voice's colour — and
`HighlightController`'s dynamic and hairpin recolours ask it per id (⚠️ per ID, not hoisted: a box
can sweep up a staff-wide `p` and a voice-2 `f` together, and they do not paint alike). ONE colour,
not a fill/stroke pair, because a dynamic is filled text and a wedge is two stroked polylines whose
triangle must stay empty. 🧪 Break-tested: pin the rule to the element ink → 5 red.
⚠️ This makes the dynamic and the hairpin DERIVED — 2 of the 5 kinds; the ottava
and the pedal keep their hard-coded element ink (they have no voice at all) and the trill keeps its
anchor note's. So `116166a`'s rule is not deleted, it is *narrowed to the kinds that never had a
scope to read* — and `utils/selectionColors` should say so.

**P3 — the lane readers. ✅ BUILT 2026-08-19.** (The table above, minus what P1 took): the walk, the
drawn anchor, the wedge's span and boundaries, `attachedMarks`' two rows. No new gesture — every one
of these already worked, on one voice.

Three things it turned up that the table did not predict:

- 🚨 **`sortedSlots` arrives VOICE-MAJOR.** `drawMeasureContent` builds the array
  `groups.flatMap(g => g.slots)`, one group per voice, so `DynamicsLayout`'s three `findIndex` steps
  were answering *the lowest VOICE's slot*, not the nearest beat's. Invisible while a mark saw one
  voice. Replaced by `anchorSlotIndex`, which orders by **(beat, then voice)** — the voice being the
  tie-break so two voices striking one beat cannot move the drawn anchor between renders. It is
  exported for `DynamicsLayout.anchor.test.ts`: the trap IS the ordering, and asserting an array
  index through VexFlow annotations would be theatre.
- ⭐ **The wedge's break for a dynamic is an INK question, not a lane one.** `interiorMarkGaps`
  compared the two voices before asking `inksClash`; there is ONE dynamics line per staff, so a
  voice-2 `f` under a voice-1 wedge sits on it and was drawn straight through. The voice test is
  gone and the measurement decides.
- ⚠️ **The hairpin's lane needs ONE entry per onset, whose length is the SHORTEST there** — it is
  what "cover this slot" reaches, and it has to be the next onset in the lane. Two voices beginning
  together otherwise let a grown wedge jump past music it claims to cover. ⛔ The dynamic's walk got
  no such de-dup: both its readers compare ADDRESSES, so a repeat is already invisible to them —
  the first draft de-duped there too, and a break-test proved the guard guarded nothing.

🧪 Break-tested each: naive first-match scan → 4 red; keep-first instead of shortest → 1 red (⚠️ and
that one needed its own fixture with the LONG voice typed first — in the shared one, insertion order
happened to give the right answer, so the first version of the test passed either way).

**P4 — the Keypad and `Alt+1…5`. ✅ BUILT 2026-08-19.** `bus.voice` widens to `1|2|3|4|'all'`; `keypadSync:361` lights the
SELECTED mark's scope (not the entry voice) when one is selected; the row's "All" button and a new
`Alt+5` press through the same seam. ⭐ Per the module rule, what a voice press DOES with a mark is
its own module (`interactions/markVoiceScope`), not a fifth branch inside
`PaletteController.setActiveVoice` — the palette gains one delegation. Three traps:

- ⛔ **`EditorState.activeVoice` stays `1|2|3|4`.** It is the ENTRY voice, and there is no entering
  into "all". Widening `bus.voice` widens `PaletteSelection`'s *press* channel too, so
  `markVoiceScope` intercepts `'all'` before `setActiveVoice` ever sees it.
- ⚠️ **A mark's scope is MODEL data**, so the Keypad's light must ride keypadSync's
  `getEngine().onModelChange` half, not the state subscription — a scope write touches no
  `EditorState` field, so the Proxy emits nothing. That seam already exists.
- ⭐ `selectedIdsOf(kind)` already exists — PRIVATE on `HighlightController:995`. The mixed-selection
  rule needs it too: **lift it** beside `selectedNoteIds`, ⛔ don't copy it. (It went to
  `EditorState.ts` beside `selectedOf`, not to `selection.ts`: it reads BOTH halves of the selection,
  and `selection.ts` does not know what an `EditorState` is.)

⭐ **What P4 landed**: `dynamicOps.setDynamicVoiceScope` + `hairpinOps.setHairpinVoiceScope` (the
`delete`), one `MusicEngine.setMarkVoiceScope` over both kinds, `interactions/markVoiceScope` (+ its
spec) holding the rule and the Keypad's light, `bus.voice` widened to `1|2|3|4|'all'`, the row's
fifth button wired to the same seam it always sat beside, `Alt+5` → `setMarkScopeAllVoices`, and one
delegation at the top of `PaletteController.setActiveVoice`. 🧪 Break-tested the two load-bearing
claims (assign `undefined` instead of deleting → 1 red; always report a write → 1 red).

## 🚨🚨 THE CORRECTION THAT CAME OUT OF P4 — scope is NOT position

His, mid-build (2026-08-19): *"i dont understand how the voice affecte the walking… walking should
work in general no matter the voice"*, then *"a dynamic voice 2 should be able to walk even if there
are no elements of voice 2 in the score… voice 2 just control the reproduction"*, then *"the same for
hairpins"* and *"the same for copy and paste"*.

⭐⭐ **`voice` says who gets LOUDER. It says nothing about where the mark may stand.** P3 had fused
the two — the walk, the drag candidates, the drawn anchor and the wedge's tips all asked *what does
this mark govern* — which made a voice-2 dynamic unmovable in a bar voice 2 is silent in. The fix is
a second predicate beside the first, and the whole rule is which one a reader may ask:

| Question | Predicate |
|---|---|
| Where may this mark stand, be dragged, be drawn? | `onSameStaff` — the mark's STAFF, every voice of it |
| Which chords does it make louder? Which marks hang off this note? | `governsSlot` — staff **and** scope |

⛔ `scopeCoversVoice` is no longer exported: a position reader must not be able to reach it.
⭐ And the same for the clipboard — **the scope travels VERBATIM, as a label**: `pasteEvents` no
longer re-voices a mark into the target lane (that re-voicing is for NOTES, which are *in* a stream),
and `pasteElement` keeps the clip's own. That also settles the ⏭️ ASSUMED decision above — it was his
call after all.

## Not in this plan

- **The hairpin's velocity ramp.** Scope says WHICH voices a wedge will govern; it does not make one
  sound. See `docs/dynamics-plan.md` (the velocity ladder) and `docs/dynamics-line-and-hairpins-plan.md`.
- ~~**Per-staff loudness.**~~ 🚨 **MOVED INTO P1** — it turned out not to be separable: *all voices
  of its own staff* cannot be written without the staff test `resolveChordLevels` has never had. See
  the section above. What stays out is anything FURTHER: a staff-level loudness that is not simply
  "which marks reach this slot".
- **A scope for the other lines.** An 8va and a pedal govern a STAFF and have no voice at all; they
  keep the element ink unconditionally.
