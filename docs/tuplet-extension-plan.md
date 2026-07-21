# Tuplets beyond the triplet — the DATA plan

Status: **in progress.** Arbitrary `N:M` arming and a dotted unit are SHIPPED and enterable; the
Tuplet window is a look-only shell; the format options are not modelled.

Sibling to `docs/tuplet-control-plan.md`, which is about the bracket's *position and look*. Three
things get called "the tuplet" and only the first is this document's subject:

| | what it is | where |
|---|---|---|
| **data** | what the tuplet IS — how many notes, in the time of how many, of what value | **here** |
| look | bracket side/visibility, what the number says, "full duration" | tuplet-control-plan.md |
| shortcut | `Ctrl+3` today; `Ctrl+`N tomorrow | §6 below |

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
nothing is unwritable — only unlabellable. Deferred, deliberately.

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
comes from VexFlow's `Metrics` (Bravura at the Tuplet category's own size) and cannot go stale; the
text is SMuFL tuplet digits (`tuplet0`…`tuplet9` = U+E880 + d, `tupletColon` = U+E88A) via
`tupletMarkText()`, a port of VexFlow's private `Tuplet.resolveGlyphs()`. Codepoints are written as
escapes — `Glyphs` is CJS-only and `undefined` in the browser build.

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

## 6. Open

- **The default M.** Not a function of N: 5:4 in simple meter, 5:3 in 6/8, because the normal side
  comes from what is being divided. Must be derived from the meter + the span, in ONE place. Today
  every caller states its own M (the palette presets each carry theirs) and there is deliberately no
  `defaultNotesOccupied(n)` table.
- **`Ctrl+`N shortcuts.** `Ctrl+3` is `armTuplet(3, 2)`; `Ctrl+2`…`Ctrl+9` fall out once the default
  M above exists. The Tuplet window's own hint promises them.
- **The Tuplet window** (`src/windows/tupletWindow.ts`) is a LOOK-ONLY shell — Finale/Sibelius's
  Format box laid out, wired to nothing. Its four format options need fields on `Tuplet` (each
  `undefined` = auto, like `placement`), and they are NOT `engravingOverrides`: that compartment is
  for anchor-keyed geometry deltas, and "which symbol is drawn" is neither.
- **The float ratio sites.** `NoteEntryCoordinator.ts:101`, `:127`, `:675` compute
  `notesOccupied / numNotes` as a JS float for epsilon-guarded overlap comparisons. The stored
  `actualDuration` stays an exact `Fraction`, but 4/5 and 8/11 are not binary-exact and those
  margins were sized against 2/3.
- **`normal-type` / `normal-dot`** — §2.
- **Nesting** — one `tupletId` per slot cannot express it; VexFlow already has `NESTING_OFFSET`.
- **The Vue palette sketch** (`App.vue`, Finale-shaped: `N ♪ in the time of M ♪` + live readout) is
  a THINKING TOOL, not the shipping UI — the Vue palettes are being deleted. It holds only the four
  typed values; the arithmetic is `PaletteController.resolveTupletInTimeOf`, which returns the
  ratio or the REASON it describes no storable tuplet.

---

## 7. Code references

- `src/types/music.ts` — `Tuplet` (`baseDots`), `GhostNote.tupletLabel`
- `src/utils/musicUtils.ts` — `getTupletTotalBeatsFrac`, `getTupletNoteDurationFrac`, `tupletMarkText`
- `src/engine/models/tupletOps.ts` — `createTuplet`, `refillTupletRemainder`
- `src/engine/NoteEntryCoordinator.ts` — `buildTupletWithFirstNote`, `applyTupletToNote`, `tupletFitsBar`
- `src/interactions/EditorState.ts` — `armedTuplet`
- `src/interactions/PaletteController.ts` — `armTuplet`, `resolveTupletInSpaceOf`, `armTupletInSpaceOf`
- `src/windows/tupletWindow.ts` — the window shell
- `src/engine/NoteEntryCoordinator.test.ts` — "dotted tuplet unit"
