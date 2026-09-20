# What a paste gives back — the SPELLING, and the cases at the edge

*2026-08-30. Two of his reports, one source investigation, three measurements, and one decision that
was his rather than the code's.*

## The problem, in one line

Paste gave back music of the right pitch and the right length, written as **different figures**.

> *"i copy and paste, however in the before copy i had doted crochet, in the paste is replacing this
> with same length but not the same figures… this is terrible user experience (i have the feeling
> that we had something similar of this before)"*

He was right that it had happened before. Same shape, twice:

| | Reported | Copied | Pasted back |
|---|---|---|---|
| 1 | 2026-08-19 | a dotted quarter | a quarter tied to an eighth |
| 2 | 2026-08-30 | a dotted eighth **tied to** a quarter | a 16th + an eighth + a quarter |

Reproduced against his own file (`public/examples/prelude-bwv846.json`, bass staff of bar 1 → bar 2)
before any code was touched:

```
BEFORE bar1:  R16@0  Nh@0(v2)  N8.@1/4  Nq@1  …
AFTER  bar2:  R16@0  Nh@0(v2)  N16@1/4  N8@1/2  Nq@1  …     ← three notes where he drew two
```

## Why it happens — the structural cause

A paste does not move slots. It **flattens** the selection into a stream of sounding lengths
(`RebarEvent`, `utils/rebar`) and **re-engraves** it on the way in — which is what lets it split a
note at a barline, regenerate ties, overwrite forward and re-fill rests at any target position.

The cost: the relay must decide a spelling for every length, and its decomposer (`decomposeSpan`)
applies **the rests' metric rule** — *a value may not cross a beat stronger than its own endpoints*.
That rule is right for silence and wrong for a note: a dotted quarter on a downbeat is ordinary
notation. So the relay kept re-deciding a question the author had already answered.

⭐ And the deeper version, which is the one worth remembering: **`RebarEvent` is a second model of a
`ChordRest`, so any field it does not list, the round trip eats** — silently, because the music still
comes back with the right pitches and the right length. `written`, `tremolo`, `fan`, `beam`,
`secondaryBreak` were each added to it one report at a time.

## What MuseScore does (read on disk, not from memory)

`~/dev/engine-sources/MuseScore`, main @ `929d1e9`. **It has no second model.**

- **The clipboard IS the score's own serialisation** — one mime type,
  `application/musescore/stafflist`, written by the same `TWrite::writeSegments` the `.mscx` saver
  uses for a measure (`rw/write/writer.cpp:293,340`). A `clipboardMode` flag changes only spanner
  locations and link handling; the element serialisers are the file format, byte for byte.
- **Figures are stored, lengths are derived** — `<durationType>` + `<dots>` verbatim, with a
  `<duration>` fraction written *only where the figure cannot express the ticks* (tuplets, measure
  rests): `rw/write/twrite.cpp:1211-1224`. Exactly the inverse of ours.
- **Paste asks one local predicate per note** — `shouldSplit = crosses the barline || partialCopy ||
  measure-rest conversion` (`editing/paste.cpp:162`). False → `undoAddCR` inserts **the object
  itself**, untouched. True → re-tile *that one* chord/rest (`toRhythmicDurationList`) and stitch the
  fragments with fresh ties (`paste.cpp:167-244`). One function, both cases; the repair is **local, at
  insertion**, not a parallel representation.
- A different **time signature** at the destination is not itself a re-spell trigger — only the
  destination's barlines force splits.
- **What it cannot repair, it refuses** up front with a named error rather than re-spelling: partial
  tuplet, split two-note tremolo, mismatched local meter, partial measure-repeat
  (`dom/select.cpp:1324-1455`), plus paste-side refusals (`editing/paste.cpp`, `rw/read460`).

## What we changed

Three commits, smallest first.

1. **`8f63861` — the spelling travels, chains included.** `RebarEvent.written` carries the authored
   figure; it was ONE figure, and a tie chain collapses into ONE event, so no single figure described
   7/4 of a beat and the whole spelling was dropped. It is now the **sequence** of figures,
   concatenated when two events merge and laid back in order when the event survives whole.
   *Invariant: the entries' lengths sum to the event's.* After it, the pasted bar is identical to the
   source, figure for figure.

2. **`2f1ecd6` P1 — `utils/slotFieldTravel`.** One table over `keyof Chord | keyof Rest`,
   `satisfies Record<SlotField, SlotFieldTravel>` — the device `scoreFile.ts` already uses for
   `Score`. Four answers: `carried`, `sideChannel` (lane keys; and `tremoloPair`, a *relation* a split
   event would duplicate), `rebuilt`, `dropped` (only `beamOver`). **A new slot field now fails to
   compile until someone says what a paste does with it.** The audit that produced the table found
   `articulationStemAlign` being eaten with no report behind it — now carried.

3. **`2f1ecd6` P2 — `RelayOptions.respell`, required.** The relay's two callers ask opposite things:
   a **meter change** wants the music re-shaped for barlines that moved (`'as-needed'`), a **paste**
   wants it put back (`'faithful'`). That difference used to be carried implicitly — by whether an
   event happened to have a spelling — which is precisely why a spelling lost upstream changed the
   notation instead of failing. Under `'faithful'` anything invented anyway is reported through
   `onImprovised`, split by reason: `split-at-barline` (unavoidable — MuseScore reaches the same
   conclusion in the same place) and `no-authored-shape` (it *fitted*, and we still guessed).

   ⚠️ Note what `'faithful'` protects: `pasteEvents` re-lays the whole destination region, so music
   **around** the paste — never selected, never copied — was being re-spelled too.

⛔ **Not touched, and must stay that way:** copying a single **element** (a hairpin, a dynamic, a
tempo mark) goes through `interactions/clipboard/elementClipboard` — no relay, no flatten, no overwrite of any
music. Selecting an element clears the note selection, so the two clipboards can never both have
something to copy (`ClipboardController.ts:61`).

## The three boundary cases — measured, then PARKED

MuseScore refuses all three. **He declined that**, and the reasoning is recorded here because it is
the decision, not an omission:

> *"instead of refuse i prefere to paste and fix it, probably not with two notes tremolo"*

A refusal also has nowhere to speak: the app has no user-visible message channel at all — one
`window.alert` for a failed PDF export and the dev panel's status line. `Ctrl+V` doing nothing, with
the reason in the console, is worse than what it does today. **So these stay documented and unbuilt
until one of them bites in practice.**

### 1. A range ending partway through a tuplet — *harmless, leave it*

```
bar 1:   Nq@0  N8@1[tup]  N8@4/3[tup]  N8@5/3[tup]
select:  the quarter + the FIRST triplet note        → clip span 3/2
paste:   Nq@0  N8@1[tup]  N8@4/3[tup]  N8@5/3[tup]   → 2 beats of music
```

The tuplet is atomic, so it travels whole and the paste writes past its own window. Untidy — it
overwrites more destination than the selection promised — but the result is **valid music**, which is
the behaviour he prefers. MuseScore refuses (`SOURCE_PARTIAL_TUPLET`); we do not.

### 2. Half a two-note tremolo — *a silent change of instruction*

```
bar 1:  Nh@0[trem:3][PAIR]  Nh@2
copy the first half only
paste:  Nh@0[trem:3]                ← the PAIR is gone, the strokes stayed
```

The relation drops correctly (its partner was not copied), but the strokes remain — so half a
two-note tremolo ("alternate between these") arrives as a **single-note tremolo** ("repeat this note
fast"). If it ever bites: drop the strokes *with* the relation, so you paste a plain note. Losing a
mark that had no meaning alone beats gaining one that means something else.

### 3. A COLLAPSED fan — *the only real corruption, and the narrowest case*

```
COLLAPSED   before: Nq.@0[fan:7 len 7/4]     after: Nq@0[fan:7]  N8@1  N16@3/2
ORDINARY    before: Nh@0[fan:6]              after: Nh@0[fan:6]        ← FINE
```

⭐⭐ **An ordinary fan is not affected** — one note saying "play me as 6" has a written value that *is*
its length, so its spelling travels and the paste is exact. That is why the fan work never showed
anything odd. Only `collapseIntoFan`'s carrier, whose figure is deliberately **not** its span (7
sixteenths = 7/4 behind a dotted quarter), has no spelling to travel with, and the span gets re-tiled
into three notes.

⭐ If it is ever fixed: a collapsed fan is an **assertion over a span** and should travel **atomic,
like a tuplet** — never re-tiled. ⛔ Not a refusal; nobody should be denied copying a fan.

🚨 **Verified not a regression.** The same measurement run in a worktree at `c77beb2` (before any of
this session's work) gives byte-identical output, and the deciding rule
(`fracEq(writtenLength(slot), slotActual)`) is character-for-character unchanged. His question,
answered by measurement rather than by argument.

## The open question this leaves

> *"for me a copy should make a copy of the json we already have… is just a small part of that json"*

That is MuseScore's design, and after the three changes above the *behaviour* now matches it for
everything that fits. What still differs is the **representation**: our clip re-encodes the slice
(events + side lists for dynamics, slurs, hairpins, trills, ottavas, pedals, tempos, spaces, rest
shifts, hidden rests, note offsets, tremolo pairs), and every authored field has to be remembered
into it. The table in `utils/slotFieldTravel` makes forgetting one a compile error rather than a
report — but it does not make the second model go away.

⏭️ If the second model ever earns its removal, the shape is MuseScore's: store the slots, and repair
locally at insertion. ⛔ Not scheduled. The relay already handles barline splits, tie regeneration,
overwrite-forward and mark anchors well, and replacing it buys the same guarantees for much more risk.
