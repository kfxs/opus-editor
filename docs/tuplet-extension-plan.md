# Tuplets beyond the triplet — the DATA plan

Status: **shipped**, less the open items in §7. Arbitrary `N:M` arming, a dotted unit, the remembered
entry (§6), the Tuplet window that asks the whole sentence, the FORMAT on the model and engraved
(§9), and `Ctrl+2`…`Ctrl+9` (§10).

Sibling to `docs/tuplet-control-plan.md`, which is about the bracket's *position and look*. Three
things get called "the tuplet" and only the first is this document's subject:

| | what it is | where |
|---|---|---|
| **data** | what the tuplet IS — how many notes, in the time of how many, of what value | **here** |
| look | bracket side/visibility, what the number says, "full duration" | §9 + tuplet-control-plan.md |
| shortcut | `Ctrl+2`…`Ctrl+9`, one per preset; M from the meter | §10 + §11 |

---

## 1. What a tuplet has to know

One sentence: **"play N of these in the time of M of them."** Three values:

- **N** — `numNotes`, how many you are squeezing in
- **M** — `notesOccupied`, how many they replace
- **the unit** — `baseDuration` (+ `baseDots`), *what "these" are*

The third is the one that gets forgotten, and without it the other two mean nothing: *"3 in the
time of 2"* is not a tuplet until you say **2 of what**. Two eighths is a quarter's worth of time;
two quarters is a half's worth. Same "3:2", different music.

Everything else is arithmetic on those three:

```
span            = M × unit
each note of value v sounds  v × M/N
```

So the three sit in ONE identity with one degree of freedom — `span = M × unit` — which is why the
four programs look different and are not: Dorico takes **ratio + unit** (`5:4e`), Finale takes
**both sides with their own note values**, MuseScore takes a selected **span** + a ratio. Same
triangle, different two corners.

**Position is not part of what a tuplet IS.** Measure, beat, voice, staff say where you *put* one.
That is what makes arming possible: "3 in the time of 2 eighths" is a complete thought before you
have decided where it goes.

### ⚠️ N:M is two integers, NOT a `Fraction`

`fracCreate` reduces by gcd (`utils/fraction.ts`), so a ratio stored as a `Fraction` turns **6:4
into 3:2** — and a sextuplet is not a triplet. The *scaling factor* `M/N` is legitimately a
Fraction and should be, for exactness; the *identity* N:M must stay two independent integers.
`Tuplet` already keeps them apart. Do not "simplify" this.

---

## 2. The dotted unit (`Tuplet.baseDots`)

The unit is a note VALUE, and a note value can be dotted — a triplet of dotted quarters. Both
references agree: Finale's two dropdowns list *"Half(s) • Dotted Quarter(s) • Quarter(s)…"*, and
MusicXML carries `<tuplet-dot>` (and `<normal-dot>`) for the same reason.

It **cannot be worked around**: `numNotes` counts NOTES, so respelling the group in undotted units
would change N into a different tuplet. So the model holds it.

The two sides are NOT symmetric, which is the useful thing to know:

- a dot on the **normal** side ("in the time of a dotted quarter") is **free** — it only changes
  the span, and the span is divided out into `M`;
- a dot on the **actual** side is what needs storing, and is what `baseDots` is.

⚠️ `baseDots` must reach **every span calculation**. `getTupletTotalBeatsFrac` and
`getTupletNoteDurationFrac` both take it (trailing, defaulted 0); a site that forgets it computes a
span a third short and the failure surfaces as a rebar or overflow bug three layers away, never as
"the dot went missing". It is written to the model only when non-zero, so undotted scores serialize
byte-identically.

**What is still NOT expressible:** a normal side with its own note value — MusicXML's
`<normal-type>` + `<normal-dot>`, Finale's second dropdown. "2 quarters in the time of 1 dotted
quarter" is a span of one and a half quarters, and `notesOccupied` is an integer count of the
SHARED unit. Adding a dot does not fix it; only an independent normal side would, and that is the
step from a 3-value model to a 4-value one. The same music is writable as `2:3` in eighths, so
nothing is unwritable — only unlabellable. What the user typed IS kept, though — §6.

---

## 3. Arming (what SHIPPED)

`EditorState.tupletMode: boolean` → **`armedTuplet: { numNotes, notesOccupied } | null`**. A boolean
could only ever mean "triplet"; the engine below has always taken any N:M.

The unit is deliberately NOT in that object — it is `selectedDuration` + `selectedDots`, already
armed, and duplicating it would let the two disagree. Arming a tuplet switches to entry mode, clears
any marking tool, and puts the ghost up, like every other armed tool.

Threading: the two entry sites (`KeyboardController` / `MouseController`) read `armedTuplet` and
pass `selectedDots` as the unit's dots; `createTupletAtBeat` / `createTupletAtPosition` /
`buildTupletWithFirstNote` / `createTuplet` all carry a trailing `dots` / `baseDots`.

### The ghost

The armed tuplet's number is drawn OVER the ghost note — a label on the note, not a tenth
marking-tool ghost, because what the click enters *is* a note and the tuplet is what that note
starts. `GhostNote.tupletLabel` carries it.

It is drawn the way VexFlow draws a real one: `new Element('Tuplet')` + `renderText()`, so the font
comes from VexFlow's `Metrics` (Bravura at the Tuplet category's size, which §9 sets) and cannot go
stale; the text is SMuFL tuplet digits (`tuplet0`…`tuplet9` = U+E880 + d, `tupletColon` = U+E88A) —
a port of VexFlow's private `Tuplet.resolveGlyphs()`. Codepoints are written as escapes: `Glyphs` is
CJS-only and `undefined` in the browser build.

Since §9 it draws the SAME runs, through the same `layoutTupletMark`, and asks for the armed
`numberStyle` — so what the preview says is what the page will print, at the sizes the page uses.

It rides the NOTE, not the staff: a fixed gap (`GHOST_TUPLET_NUMBER_GAP`, 1.5 staff SPACES so it
holds at any staff size) above the stem TIP when the stem is up, above the NOTEHEAD when it hangs
down, and above the head itself for a stemless whole note. Centred on the notehead's own two edges,
not on `getAbsoluteX()` — that is where the note *attaches*, and an accidental or a dot shifts it.

VexFlow's own rule is deliberately NOT copied: it clamps the number to at least 1.5 lines above the
top staff line, which is right for a real tuplet (one bracket over several notes needs a single
height) and wrong for a ghost, which is ONE note chasing the cursor — clamped, the number stops
tracking and drifts off the notehead as you move down the staff.

No bracket in the preview: a tuplet's bracket spans notes that do not exist until the click.

---

## 4. Two bugs this surfaced

1. **The keyboard could write a tuplet past the barline.** `tupletFitsBar` guarded the mouse path
   and the apply path, but `createTupletAtBeat` → `buildTupletWithFirstNote` never checked. 3:2 of
   halves is already 4 beats; of dotted halves, 6. The check now lives in
   `buildTupletWithFirstNote`, covering all three callers at once.
2. **Filler rests were spelled wrong in a dotted tuplet.** `refillTupletRemainder` splits gaps with
   an undotted splitter, so a dotted-quarter triplet with one note filled as `h` + `q` — the right
   amount of time, spelled as one-and-a-third slots plus two thirds. Dotted-unit tuplets now fill in
   their own unit, one rest per empty slot. Undotted tuplets keep the splitter (merging two empty
   eighth slots into one quarter rest is what a copyist does anyway).

---

## 5. How the industry models it

| | asks for | notes |
|---|---|---|
| **MusicXML** | `<time-modification>` = actual/normal (+`normal-type`/`normal-dot`); `<tuplet>` = the look | draws the same data/look line we do. `show-number` (actual\|both\|none), `bracket`, `line-shape`, `placement`, `number` for nesting |
| **Dorico** | ratio + unit — `5:4e`, `3:2q`; omit the unit and it uses the selected duration | our exact triple. 5.1.70 fixed misreading a triplet whose notes are 16ths but whose unit is the eighth as a *nested* tuplet |
| **Finale** | `__ [value] in the space of __ [value]` — both sides, dots included. ⚠️ that phrase is Finale's; WE say *in the time of*, with Sibelius and Dorico — a tuplet divides time, and "space" is the typesetter's idiom | the 4-value model. Number: `Nothing • Number • X:Y • X:Yq • Xq:Yq` |
| **Sibelius** | a ratio typed as text in one box (`12:8`) | Format: Number / Ratio / Ratio+note / None; Auto-bracket (drops the bracket when a beam already joins exactly those notes) / Bracket / No bracket; Full duration |
| **MuseScore** | select a span, then an arbitrary "relation" (`13/4`) | nesting supported, "outside in" |
| **VexFlow** (ours) | `numNotes`, `notesOccupied`, `bracketed`, `ratioed`, `location`, `yOffset` | `bracketed` defaults true *unless beamed* (= auto-bracket); `ratioed` defaults true when the counts differ by more than 1 — **both "auto" rows are already the renderer's behaviour** |

---

## 6. Remembering what the user typed — SHIPPED

You type *"5 quarters in the time of 8 eighths"*. Eight eighths is four quarters, so the mark reads
**5:4** — and 5:4 cannot tell you afterwards whether you said "4 quarters" or "8 eighths". The tuplet
keeps the sentence:

```ts
numNotes: 5,   baseDuration: 'q',   baseDots: 0     // N, its value, its dots  ┐ the 6 typed
normalCount: 8, normalDuration: '8', normalDots: 0  // M, its value, its dots  ┘
notesOccupied: 4                                    // a count of the WRITTEN note
```

Written only when the two sides differ. When they agree, `notesOccupied` already IS the typed count
and `baseDuration` the typed value, so an ordinary triplet stores exactly as it always did.

**The entry is the truth; the ratio is the label.** `tupletSpan` reads `normalCount × normalDuration`
when an entry was recorded, and falls back to `notesOccupied × unit` otherwise — the same number for
every tuplet that predates the field. `tupletScale` follows from the span. This is what lets a group
last one and a HALF written notes ("2 quarters in the time of 3 eighths"), which the validator used
to refuse because the timing came from the ratio and a printed count is a whole number.

**The label is DERIVED, never read off the model** — `tupletPrintedCounts` = `span ÷ unit`, so both
figures count the written note. Where that is not whole, the ratio is quoted in the value the user
named (2:3 eighths) and *Ratio + note* prints THAT value, which is the case where the note beside the
ratio stops being decoration. A stored `notesOccupied` that disagreed with the entry cannot put a
wrong number on the page; a test sets it to 99 and the mark still reads 5:4.

⛔ **The printed string is not stored.** Tempo marks and dynamics are text-as-truth; a tuplet is the
opposite — the numbers ARE the rhythm, so a saved `"5:4"` would go on saying 5:4 after the tuplet
changed. `numberStyle` stores the CHOICE (absent = auto) and the string is derived — see §9, where
the window sets it and the renderer draws it.

### The design we did NOT take, and the honest score

The rejected version made `notesOccupied` itself the typed count (six fields, no `normalCount`) and
took the span from it. It was written up here as the plan and then abandoned when it made the mark
print **5:1**.

That verdict was wrong, and the record should say so: 5:1 happened because the label was being READ
off `notesOccupied`. Once the label is derived — which it now is — that design prints 5:4 too. It is
the same design as this one with **one fewer field** and no derivable value stored at all.

What kept us here is not elegance, it is blast radius. `notesOccupied` has meant "a count of the
written note" everywhere since the beginning — rebar, playback, VexFlow, saved scores, a lot of
tests. The rejected design redefines that one field to count a DIFFERENT note. Every reader still
compiles and still runs; some of them quietly read a number that now means something else, in
exactly the cases where the two notes differ. Nothing throws — you find out from a bar that plays
wrong.

⏭️ If the extra field is ever worth removing, the safe way in is to DELETE `notesOccupied` rather
than redefine it: the span comes from the entry and the label is derived, so nothing needs it except
tuplets that carry no entry — and those could record one on the way in.

---

## 7. Open

- **`beforeNext` has no control.** Modelled, resolved and drawn, but the window's tickbox reaches
  only `lastNote` / `division` (see §9 — deliberately). It wants a properties panel or an engraving
  option, not a third radio in the entry dialog.
- **Editing a tuplet that already exists.** The window ARMS; it cannot restyle the tuplet under the
  selection, so a format decision is made before the notes are written and never again. Sibelius's
  dialog edits the selection; the Time Signature window's "apply to the boxed bar, else arm" is the
  shape to copy.
- **The float ratio sites.** `NoteEntryCoordinator.ts:101`, `:127`, `:675` compute
  `notesOccupied / numNotes` as a JS float for epsilon-guarded overlap comparisons. The stored
  `actualDuration` stays an exact `Fraction`, but 4/5 and 8/11 are not binary-exact and those
  margins were sized against 2/3.
- **One field too many** — `notesOccupied` is derivable from the entry. §6's last part says why it
  stays and what removing it would take.
- **Nesting** — one `tupletId` per slot cannot express it; VexFlow already has `NESTING_OFFSET`.

---

## 9. The FORMAT — what the mark says and what the bracket does (SHIPPED)

The window's *Format* box is stored on the tuplet as `TupletFormat` (`types/music.ts`), which
`Tuplet` extends — so the fields stay flat and no existing score changes a byte:

| field | values | absent means |
|---|---|---|
| `numberStyle` | `number` · `ratio` · `ratioNote` · `entryRatio` · `none` | the rule in `autoNumberStyle` |
| `bracket` | `auto` · `always` · `never` | the rule in `tupletBracketed` |
| `bracketEnd` | `lastNote` · `division` · `beforeNext` | `DEFAULT_TUPLET_BRACKET_END` (`lastNote`) |

**Absent means the RULE, not a gap.** That is what makes `Ctrl+3` a complete answer rather than a
tuplet missing its settings: a format is a DEVIATION, the renderer asks a resolver and never the
field, and each rule is written once. A tuplet nobody argued with stores nothing.

The three rules, and why:

- **Mark** — a bare number when the METER already says what it is in the time of, the ratio when it
  does not. A figure alone is an instruction the reader completes from the meter (`5` is five in the
  time of four in 4/4, and of three in 6/8), so when M is the one §11 would have derived, the number
  is enough; when it is not — a duplet in 4/4, any borrowed span — the ratio has to be printed or the
  notation is a guess. The same tuplet therefore prints `2` in 6/8 and `2:3` in 4/4, which is the
  point. ⛔ Replaces VexFlow's `|N − M| > 1`, which spelled out 6:4 and 7:4 and left the quadruplet
  bare — that measures the distance between two numbers, which is not a fact about music. Without a
  bar to point at it falls back to the meter-free approximation (N a power of two above 2 ⇒ ratio).
- **Bracket** — none when a beam already shows the group. The beam and the bracket say the same
  thing. Asked at DRAW time, because `hasBeam()` only answers once the Beams exist.
- **Bracket end** — `lastNote`. Dorico defaults to the full duration and the argument is real (a
  bracket that stops at the notehead ends slightly before the group does), but the longer bracket
  reaches toward whatever follows and the ordinary beamed group never needed it. So it is opt-in.

`entryRatio` is ours and has no Sibelius equivalent: `5𝅘𝅥𝅯:1♩`, the sentence as typed, each side with
its own value — where `ratio` converts the second figure into the tuplet's written unit and prints
`5:4`. Printable only because §6 keeps the entry.

**The window asks `bracketEnd` as ONE tickbox** — *Full duration*, ticked = `division`, unticked =
the default — and that is lossy on purpose. Three radios were built and rejected on sight: this is a
dialog you open to type a ratio, and a three-way fine distinction there reads as a form to fill in.
The MODEL keeps all three regardless, because the enum is not the dialog's: the renderer resolves and
draws each, and `beforeNext` waits for the control that suits it (a properties panel for a tuplet
already engraved, or a document-wide engraving option — where Dorico asks it).

**Drawing.** `ScoreTuplet` (`engine/rendering/`) is VexFlow's `Tuplet` with `draw()` overridden, for
the two things no option reaches: where the bracket ends (handed in as an X, since only the renderer
knows where the next note was formatted), and a bracket with no number — VexFlow splits the line to
make room for text that isn't there, leaving a notch cut for nothing. `getYPosition()` stays
VexFlow's; everything hard about a mark's height is in it.

A mark is a list of RUNS (`tupletMarkRuns` → `TupletMarkRun[]`), not a string: the figures are cut
small inside their em and a `metNote…` fills its own, so they cannot share a font size — the glyphs
draw at `NOTE_GLYPH_SCALE` of the figures. Note values use SMuFL's **metronome** family (the
text-inline cut), never the staff's `noteQuarterUp`, which towers over the digits. Spacing between
runs is a measured GAP (`MARK_SPACE_EM`), never a space character — a music font's space is next to
nothing wide. `TUPLET_FONT_SIZE` (26) is the one knob for how big the whole mark is — the glyph scale
and the gaps are fractions of it, so it moves the whole mark together. VexFlow gives
the Tuplet category no size and it fell through to the toolkit's 30.

The GHOST draws the same runs through the same layout function and asks for the armed style, so a
preview cannot promise a mark the page will not print.

---

## 10. The presets and their keys (SHIPPED)

`utils/tupletPresets.ts` holds the eight `{n, m}` pairs, and the `Ctrl+`N keymap and its handler
table are both GENERATED from it (the action name spelled by `tupletPresetAction`, so a key and its
handler cannot drift by a character).

**The Vue palette's tuplet row is DELETED** — presets and the Finale-shaped sketch both. Two ways in
survive it and neither is Vue: `Ctrl+`2…9, and Insert ▸ Tuplet, which arms any ratio and its format.
⏭️ What went with the row is the armed-STATE light: nothing now says "5:4 is armed" except the ghost
under the cursor. That belongs on the Keypad, which mirrors editor state already.

The table's M is now only a FALLBACK — §11 derives the real one — and its two families are what the
fallback covers: **2, 4, 8** the compound tuplets (duplet, quadruplet, octuplet: an even number
borrowed from a beat that divides in three), **3, 5, 6, 7, 9** the simple ones (the largest power of
two below N). 1 is absent and could not work — one note in the time of two IS a note of double value.

⚠️ Chrome uses `Ctrl+1`…`Ctrl+9` for tab switching. Pages can intercept them (the manager
`preventDefault`s any matched key), but that is the first thing to suspect if a key does nothing.

---

## 11. M comes from the METER (SHIPPED)

`Ctrl+5` means **"a 5"**, not "5:4". What a 5 replaces depends on what the beat divides into, so the
answer belongs to the bar it lands in — `deriveTupletM(N, unit, dots, meter, beat)`:

| | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|
| 4/4 · 2/4 · 5/8 · 5/4 · 6/4 · 3/2 | — | 3:2 | — | 5:4 | 6:4 | 7:4 | — | 9:8 |
| 6/8 · 9/8 · 12/8 · 9/16 · 3/8 | 2:3 | — | 4:3 | 5:3 | — | 7:6 | 8:6 | 9:6 |

The rule: **the nearest natural grouping of the unit that makes a real tuplet.** The span being
divided is the metrical GROUP the position falls in (7/8 as 3+2+2 answers differently along one bar);
its natural groupings are that span halved and doubled (4/4 in eighths gives 1, 2, 4, 8 — 6/8 gives
3, 6, 12, never 2 or 4, which is the whole difference); prefer the largest below N, else stretch to
the smallest above (how the duplet reaches 2:3); and skip any candidate where N:M reduces to a power
of two, since 2:1 and 4:2 are not tuplets but the same notes at another value.

A dash is an ANSWER: 4/4 has no duplet and no quadruplet, and in 6/8 the eighths already ARE the
triplet division. When the rule declines, the preset's own M is armed anyway (a deliberate 2:3 in
4/4) — and the mark then prints the ratio, because §9's rule sees an M the meter cannot explain.

**Nothing is decided at arm time**, because nothing is known then: `armedTuplet.deriveM` says "M is a
request", `notesOccupied` carries the fallback, and the answer is worked out at the three moments
that know a position — the click, the caret, and the GHOST. The ghost matters most: it resolves
against the hovered bar, so moving the cursor from 4/4 to 6/8 with `2` armed changes the preview from
`2:3` to `2` before you commit to anything. That is also why the mark is no longer built in
`RenderController`: the shape goes down and `MusicEngine.renderScoreWithPreview` builds it where the
position is known.

---

## 8. Code references

- `src/types/music.ts` — `TupletShape` / `Tuplet` / `TupletFormat` (`baseDots`, `normalCount`/`normalDuration`/`normalDots`, `numberStyle`, `bracket`, `bracketEnd`), `TupletMarkRun`, `GhostNote.tupletLabel`
- `src/utils/musicUtils.ts` — `tupletSpan`, `tupletScale`, `tupletSlotDuration`, `tupletWrittenDuration`, `tupletPrintedCounts`, `tupletMarkRuns`/`tupletMarkText`, `resolveTupletInTimeOf`, and the rules: `deriveTupletM`, `autoNumberStyle`, `tupletBracketed`, `tupletBracketEnd`
- `src/utils/tupletPresets.ts` — the eight presets + `tupletPresetAction`
- `src/engine/models/tupletOps.ts` — `createTuplet` (writes the format), `refillTupletRemainder`
- `src/engine/NoteEntryCoordinator.ts` — `buildTupletWithFirstNote`, `applyTupletToNote`, `tupletFitsBar`
- `src/engine/rendering/ScoreTuplet.ts` — the drawn mark and bracket: `TUPLET_FONT_SIZE`, `NOTE_GLYPH_SCALE`, `layoutTupletMark`
- `src/interactions/EditorState.ts` — `armedTuplet` (+ its `format` and `deriveM`), `armedTupletM`, `spendArmedTuplet`
- `src/interactions/PaletteController.ts` — `armTuplet`, `armTupletPreset` (the deriving one), `armTupletInTimeOf`
- `src/interactions/tupletSelection.ts` — the window → `keypadSync` → controller seam
- `src/windows/tupletWindow.ts` — the window: the sentence, the Format box, OK arms
- `src/engine/NoteEntryCoordinator.test.ts` — "dotted tuplet unit"
- `src/utils/musicUtils.test.ts` — the mark rules and the entry ratio; `ScoreModel.test.ts` — the format is stored
