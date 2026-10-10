# Alteration signs and the accidentals Keypad — plan

> His ask, 2026-09-30: *"write the whole plan for the new accidental keypad implementation, starting
> of course with the model."* The framing it serves: *"the symbol is part of the score model"*; the
> scale and the sound are not. The decisions it builds on are his, asked one at a time —
> `docs/research/alteration-signs-research.md` §6 (A–F). ⛔ Nothing here is built.

Two parts. **Part 1 changes the model and shows nothing new** — a note stops storing a number and
stores a list of signs. **Part 2 wires the Keypad's keys, one at a time**, each for him to check.

## 1. What a pitch stores

```ts
// today                                  // after M2
{ step: 'F', alter: 1, octave: 4 }        { step: 'F', alteration: ['accidentalSharp'], octave: 4 }
{ step: 'F', alter: 0, octave: 4 }        { step: 'F', octave: 4 }            // absent = no alteration
```

- **`alteration` is an ordered LIST of signs**, left to right as drawn (decision A). One sign in it
  for everything on the Sibelius page; the list is there so Helmholtz-Ellis never needs a second shape.
- **Absent means unaltered** — ⛔ never an empty list, ⛔ never a LONE plain natural. The natural is
  what the bar's rule DRAWS to cancel; it is not an alteration. (⚠️ A natural carrying an arrow is a
  quarter-tone sign of its own in Gould, Stone and HEJI — a sign like any other, the day it has a row.)
- **The same list in a key signature** (`KeyAlteration`), so notes and signatures share one vocabulary.
- **How it is SHOWN stays separate** from which sign it is: `forceAccidental` today, and one field
  per new display property as its key arrives (K3, K5) — the way `enclosure` joined the notehead.

## 2. Three small modules — one per question

| module | answers | who asks |
|---|---|---|
| `utils/alterationSigns.ts` — **the sign table**, a ROW per sign: its id, its **rank** (decision B: double flat −4 … flat −2 … sharp +2 … double sharp +4; quarter-tones take the odd numbers) | *which signs exist · which of two is higher · is it sharp-like or flat-like* | the editor, the key signature, the drawing |
| `utils/pitchOrder.ts` | *which pitch is higher* (staff position first, then rank) · *are these the same pitch* (letter + signs + octave) | everything that compares notes |
| `engine/audio/equalTemperament.ts` — **the first tuning**, and the ONLY place a sign has a sound | *what does this pitch sound like on a piano-tuned instrument* | playback, nobody else |

⭐ A new sign is a ROW in the first table, plus a row in the tuning when it should sound. ⛔ The rank
is an order for WRITING, never a sound.

**Sound, stated once** (decision D — *"in double sharp or double flat have to be accurate now"*):

- **Doubles play correctly at every step.** They do today; after M2 it is the tuning table that
  says a double sharp is two semitones up, and a spec pins it. 👁 K1's check includes HEARING one.
- **Quarter-tones**: drawn from K4, where they play as the nearest normal note; **K6 makes them
  sound as real quarter-tones** by detuning — the last step, because it is the least important now.

## 3. Part 1 — the model (nothing visible changes)

**M0 — the table and the questions; no storage change.** The sign table with the four signs we store
today (sharp, flat, double sharp, double flat) and `pitchOrder`. Every place that asks *"which is
higher"* by turning notes into piano numbers — chord order, glissando direction, undo labels, about
twenty sites — asks `pitchOrder` instead. The piano number (`spellingToMidi`) moves into the audio
layer, which is the only place left that needs it.
⚠️ Two or three sites measure a DISTANCE in semitones (which octave a typed letter lands in); they
will measure it in staff steps, and any case where the answer differs is listed for him first.
✔ Otherwise the same answers as before for every pitch we can store; unit suite + browser geometry
suite unchanged.
✅ **Built 2026-10-10.** His call: a typed letter's octave is the NEAREST LINE in staff steps
(`pitchOrder.octaveNearest` — B4 then F is F4, never a tie), and Shift+letter the next line strictly
above the chord's top (`octaveAbove` — Shift+D on D♭4 is D5). MuseScore does the same
(`noteinput.cpp`, accidentals stripped); Sibelius's manuals do not say — UNKNOWN. Two bugs fell out:
the hit-test filed a head as a MIDI number and put every black key on the line below (a D♭ was
clicked on C's line) — the registry now holds `staffPosition`; and undo labels named D♭ "C#4".
⚠️ The five *"same pitch?"* sites (M1's) still compare sound, through ONE function,
`spellingEnharmonic` — so `spellingToMidi` leaves the core with M1, not M0.

**M1 — C♯ and D♭ are two pitches (the bug, its own commit).** The *"is this pitch already here"*
sites — mouse entry, grace pitches, bracketed graces, entry overwrite — ask `samePitch`, which
compares letter, signs and octave. ✔ Spec per site. 👁 His check: a chord holding both C♯ and D♭.
✅ **Built 2026-10-10.** `pitchOrder.samePitch` (letter + signs + octave) at all five sites; the MIDI helpers
(`spellingToMidi`, `pitchToMidi`, `midiToSpelling`) moved to `engine/audio/equalTemperament`, the first
tuning, which the core may not import. Found on the way: a D♭ clicked on a C♯'s column did not merely
fail to chord — it silently REPLACED the C♯ (`entryOverwriteOps` took it as "the same pitch").

**M2 — the storage flips.** `alter` (number) becomes `alteration` (list) on the pitch, the flat
`Note`, the entry parameters and `KeyAlteration`. The bar's accidental rule compares alterations
(it never did arithmetic, so its logic does not change). The score file's version goes up, so an old
file is **refused with a reason** rather than loaded with its accidentals silently gone.
**The three examples are re-saved in this step** (a one-off conversion script, not shipped).
⚠️ Size, said plainly: 67 source files and about 1,300 lines in 209 spec files change, almost all
mechanically (`alter: 1` → `alteration: ['accidentalSharp']`, `alter: 0` → removed).
✔ Whole unit suite, `build:check`, browser suite unchanged, and the three examples drawn before and
after compare identical. 👁 His check: the examples open and look and sound the same.
✅ **Built 2026-10-10.** Score file v2 (a v1 file, or a bare score still saying `alter`, is refused with
the reason); clipboard v6. The examples re-saved by a throwaway script (104 + 148 + 330 signs converted,
every `alter: 0` dropped — the diff is those lines and the version, nothing else). ⭐ **Drawn before and
after: byte-identical** scenes and SVGs for all three (113 accidentals in Syrinx alone, so the probe
reached the code that changed), and every scheduled note's onset, length, key and velocity identical.
Sound now has ONE home: `equalTemperament`'s per-sign semitone table (a sign with no row there does not
compile). The bar's running accidentals keep "absent" and "an explicit natural" apart with `has`, not
`??` — a natural is stored there as `undefined`. Specs write fixtures through `testing/signs`.

**M3 — the drawing speaks signs.** The renderer still names accidentals by five strings inherited
from VexFlow (`'#' 'b' 'n' '##' 'bb'`) in its glyph table, its column packer, its spacing rows, the
slur's accidental point and the hit box. They become sign ids and ROWS (glyph, ink extents), so a
sign the table gains can be drawn without touching those files again.
✔ No pixel moves: browser suite + the examples comparison, as M2.
✅ **Built 2026-10-10.** The drawing's vocabulary is `DrawnSignId` = a sign id or `'natural'` — the
natural is `NATURAL_SIGN`, a row the page draws and ⛔ a pitch never stores (the type keeps it out of
`Alteration`). `displayedAccidentals`, `EngravedAccidental`, the stack rule, the ink rows
(`spacingPadding`, ⚠️ a sign with no row takes the SHARP's numbers, as an unknown code always did),
the slur's accidental point, the hit box's `accidentalType` and the selected accidental all speak it;
the glyph is the ROW's (`fontMetrics.accidentalGlyph` reads the table — its spec holds every row to a
glyph the font has). The Keypad's `'#' 'b' 'n'` stay the armed KEY's vocabulary, translated where a
ghost draws one (`drawnSignOfKey`) and where a sign lights a key (`keyOfDrawnSign`). ✔ The three
examples drawn before and after: byte-identical. ⚠️ Left as they are: the note KEY strings (`'c#/4'`)
still carry the label code — nothing draws from it (only `KeyRow.key`'s name and an unread tablature
`intValue`); a sign without a code would simply leave it out.

## 4. Part 2 — the keys

Every key follows Sibelius for the first build (his word), as recorded key by key in
`docs/research/sibelius-keypad.md` §3c. Each phase ends with his UI check.

⭐ **The Keypad is ONE door onto the signs, not the list of them** (his note, 2026-09-30: *"we can
have in the future an extended accidental palette containing more glyphs, or we can select and
switch things from the keypad to the palette — for the moment this palette has no UI, but it is
good to know this so the infrastructure is built"*). So the keys are built to these four rules, and
⛔ no palette UI is built:

1. **One command takes ANY sign of the table** — arm it, or toggle it on the selection. The Keypad
   calls it; a palette will call the same one. ⛔ No logic names a particular sign.
2. **A sign key is a SLOT that holds a sign id as data.** Its picture is drawn from that sign's own
   glyph, so a slot given another sign shows and does the other sign with no code changed.
3. **Which sign sits in which slot is ONE table**, Sibelius's layout as the default, behind a small
   store the panel listens to — the shape the page selection already has. A console command
   reassigns a slot, to prove it works; it is session-only and nothing saves it.
4. **The light goes by sign id.** A sign that has no key simply lights no key — it is still on the note.

A sign a palette offers is a ROW in the sign table (§2); the table can be listed in rank order,
which is what a palette would paint.

⭐ **The palette WINDOW is a pattern already built five times** (checked 2026-09-30, his prompt: *"I
think we have built this palette before"*) — Lines, Clef, Time signature, Key signature, Tuplet
(`src/windows/`): a table of rows drawn as pictures, one of them picked, and a press on ONE bus seam
that the editor answers. `windows/lines/index.ts` says it outright: *"the dialog adds a door, never
a second behaviour."* An accidental palette is a sixth of these — its rows are the sign table, its
press is the seam the Keypad's sign keys already press (rule 1) — which is why the four rules are
all the infrastructure it needs.

⛔ **The Symbols window (`z`) is NOT that palette, and nothing of it is reused for accidentals.** His
rule, 2026-09-30: *"accidental is one thing and symbol another and they should not be mixed."* A
symbol is a mark with no meaning, above the staff, taking no space; an accidental is part of the
pitch. The accidental palette is its own window, fed by the sign table only.

**K1 — `/` `*` double sharp, double flat — and the slots.** The editor's own accidental vocabulary
(armed tool, Keypad cells, the light) widens from `# b n` to the sign table's ids plus the natural.
The page's sign keys — these two and `7 8 9` — become SLOTS (the four rules above): on a selection
they toggle, with nothing selected they arm the next note, for one note. A selected double now
lights its own key. ⭐ The armed value's DOORS take a sign too, in the same step — the note ghost and
the click (`MusicEngine.renderScoreWithPreview` / `addNoteAtPosition`) and the accidental stamp's,
grace's and bracketed grace's ghosts, which still take `'#' 'b' 'n'` after M3 — so the preview always
shows what the click enters, and K4's quarter-tones arrive on a door that already takes any sign.
👁 His check includes reassigning one slot from the console, seeing an armed double sharp on the
ghost before the click, and hearing a double sharp and a double flat play two semitones from the
plain note.
✅ **Built 2026-10-10.** `Accidental` (the editor's armed / toggled / lit value, the accidental tool,
`bus.accidental`, the doors `renderScoreWithPreview` / `addNoteAtPosition` and every ghost) IS a
`DrawnSignId` — the three-key vocabulary is gone, so a double needed no line of its own (rule 1). The
slots: `windows/keypad/keypadSignSlots`, ONE table `{ / * 7 8 9 }` → doubleSharp, doubleFlat, natural,
sharp, flat (Sibelius's), named by KEY so page one's `7 8 9` and the Accidentals page's are the same
slots; a slot's picture, name, press and light are its sign's (`keypadLayouts.cellSign/cellIcon/
cellAction`, `signIcon` draws the sign's own glyph). `__keypad.slots() / slot(key, sign) / reset()`
in the console, session-only. A selected double lights its own key; a trill's printed auxiliary sign
is its own too (a double no longer reads ♯). ⚠️ The slot store is a module singleton beside
`keypadPageSelection`, for its reason — recorded in DESIGN-PRINCIPLES (the count is 8).

**K2 — `0` remove accidentals.** Runs the command that already exists (the palette's *remove
accidental*, across the selection): each note goes back to what the bar and the key say. No light.

✅ **Built 2026-10-10.** `0` is its own cell kind (`removeAccidentals`) that presses `null` on
`bus.accidental` — the palette's existing REMOVE (`setAccidental(null)`), so no new command. With
nothing selected it does nothing (default 3 below); a selected accidental glyph is removed and the
selection cleared, as a re-press of its sign does; in note entry it clears the armed accidental.

**K3 — `Enter` the accidental's parentheses.** A new display property on the pitch
(`accidentalEnclosure: 'round'`, a shape like the notehead's). The accidental is drawn as a RUN —
bracket, sign, bracket — which is also what K5 and any future list of signs need. On a note that
shows no accidental the implied one appears, in brackets (Sibelius). All three fonts have the glyphs.
The space between bracket and sign is a changeable row, researched as a follow-up — ⛔ not a blocker.

✅ **Built 2026-10-10.** `NotePitch.accidentalEnclosure: 'round'` (absent = none; `models/accidentalEnclosureOps`,
`commands/signEnclosureCommands` = `engine.signEnclosure`). `displayedAccidentals` reads it as a request to SHOW
the sign, so a note with none shows its implied one in brackets; the second press hides it again (default 2).
Drawn as a RUN by `EngravedAccidental` — E26A, the sign, E26B, at the sign's size — and priced by the same
numbers in `spacingPadding.accidentalExtent` (`enclosed`); the white is `layout/accidentalEnclosureGap`, ⭐ **his
call: LILYPOND's 0 is armed** (Gould 0.2 and MuseScore 0.175 are rows; VexFlow's ⅔-size run is a ⏳ SIZE row not
built). `Enter`: selected notes / a selected sign toggle, the selected BRACKETS come off, nothing selected does
nothing; ⭐ in NOTE ENTRY it arms them (`selectedSignEnclosure`) — the entered note is born with them in the same
undo entry, and the GHOST shows them (the armed sign, or a bracketed natural with none armed — his rule). ⭐ The
brackets are a selectable kind, `accidentalEnclosure` (his ask): each bracket has its own hit box
(`rendering/signBracketBoxes`), Delete takes them off; selecting the note or the sign lights them too. ⚠️ Main
chord heads only — not graces, fan members, bracketed graces; a head in brackets AND a bracketed accidental
draws both pairs (MuseScore skips the accidental's).

**K3b — bracketed accidentals beyond the main notes** (his ask, 2026-10-10: *"if is not planned should be
planned"*). K3 brackets a MAIN chord's accidentals only. The same field, the same op and the same `Enter` reach:
- **grace notes** — their accidentals are drawn by `GracePass` (a sign string, not an `EngravedAccidental`) and
  priced by `layout/graceRoom`: both learn the run, at the grace's size; the op's lookup asks `graceNotes: true`;
- **fan members** — `FanPass` draws and packs its members' signs (`chordAccidentalColumns`, `FanPass.ts:164`
  measures a sign's width): the run joins both; the lookup asks `fanMembers: true`;
- **bracketed graces** — drawn by `BracketedGracePass`, priced by `layout/bracketedRoom`, which already puts
  the grace in E26A/E26B: ⚠️ a bracketed accidental INSIDE a bracketed grace is brackets in brackets — what to
  draw there is UNKNOWN (no book on disk shows it), a question for him before it is built.
Each surface also files the two bracket boxes (`rendering/signBracketBoxes`) so they select alone, and its ghost
shows them. ⚠️ And the head-in-parentheses case: a parenthesised head (`enclosure`) with a bracketed accidental
draws both pairs today — MuseScore skips the accidental's (`parentNoteHasParentheses`); his call.

✅ **Built 2026-10-10 — graces and fan members.** The op finds a grace's and a fan member's pitch
(`findSlot` with `graceNotes` / `fanMembers`); the field travels in `cloneGraceFresh` / a member's copy and
projects onto a grace's flat note. `GracePass` stamps the run at `layout/accidentalEnclosureGap.accidentalRunOffsets`
(the table numbers the room uses; `graceRoom.drawnSigns` prices it); `FanPass` measures and stamps it through
`EngravedAccidental` (`runOffsets`) and packs it by its real width. Both file each bracket as an
`accidentalEnclosure` box, so it selects alone; a selected grace / member lights its brackets with the rest of its ink.
⏳ **Still open — his calls:** (A) a bracketed grace's accidental (brackets in brackets / skip / refuse); (B) a
parenthesised head with a bracketed accidental (both pairs today). ⏳ Not built: arming them for a GRACE stamp's
entry, and the grace ghost.

**K4 — `5` `6` `2` `3` the quarter-tones.** Four rows in the sign table, four ink rows, and four
more slots holding them. ✅ They are Gould's own table of "fixed symbols" (p. 96, *"recommended that
all four … are used"*), and in the bar they behave as a sharp does — Gould p. 98: *"an ordinary
accidental must cancel a microtone"*, and without one the next notes stay altered. ⛔ No book gives a
number for their gap or their chord column, so their ink rows start from the glyphs' own boxes. Drawn from Bravura when the score's font lacks them (decision E). Sound,
for now, as Sibelius without its plug-in: the nearest normal note.

✅ **Built 2026-10-10.** Four rows in `utils/alterationSigns` on the odd ranks — `threeQuarterTonesFlatZimmermann`
−3, `quarterToneFlatStein` −1, `quarterToneSharpStein` +1, `threeQuarterTonesSharpStein` +3 (codes VexFlow's: `db`
`d` `+` `++`) — four rows in `equalTemperament` (±½ → the letter, ±1½ → ±1: Sibelius without its plug-in), four
ink rows in `spacingPadding` (Bravura's boxes + the 0.30 sp the measured rows carry), the four glyphs in the
generated font tables (Leipzig and Sebastian DRAW all four — no Bravura borrowing needed). The Keypad's `5 6 2 3`
are SLOTS holding them (`keypadSignSlots`), named by Sibelius's words. 🚨 Found on his first press: the note KEY
string (`'ad/3'`) was refused by `engrave/notes/keyLines` — its parser now reads the four codes, and
`EngravedAccidental.drawn.test.ts` draws every sign of the table through the real renderer so a new row cannot
slip past again.

**K5 — `4` `1` ♮♯ and ♮♭.** A second display property (`naturalBefore`): the note stays a plain sharp
or flat and a natural is drawn in front, composed from the score's own font. Offered only on a note
that cancels a double earlier in the bar (decision C); anywhere else the key does nothing.

✅ **Built 2026-10-10 — and NOT as written above.** ⭐ His rule (that day): `4` and `1` *"should behave like normal
accidental"* — the user's choice, ⛔ no "only where it cancels a double" (the engine makes no musical choice here).
So ♮♯ / ♮♭ are two more DRAWN signs (`NaturalBeforeSignId`, rows `NATURAL_BEFORE_SIGNS` in `utils/alterationSigns`),
armed, toggled, lit and ghosted through the SAME command as ♯ and ♭ (`setNoteAccidental`, `armedDisplay` at every
entry door, `showsArmedSign` for the toggle), slots `4` `1`. The pitch stores the plain sign and
`NotePitch.naturalBefore` (decision C stands: a drawing choice, ⛔ never a sign of its own); any other sign pressed
takes the natural off, and so does Remove. The bar's rule is untouched — `displayedAccidentals` only answers ♮♯ / ♮♭
where it would have answered ♯ / ♭. Drawn with the FONT's precomposed pair (E268 / E267 — all three faces draw
them, MuseScore's form), so no gap number was needed; room rows from Bravura's boxes + 0.30 sp. ⚠️ Main notes only
(not graces / fan members — K3b's surfaces).

**K6 — quarter-tones heard (low priority, decision D).** The tuning answers half steps and the
instrument detunes. WebAudioFont's player should take it — read in its source, ⛔ not yet heard.

✅ **Built 2026-10-10.** `engine/audio/equalTemperament`'s rows are the TRUE quarter-tones: Stein's ¼♯ ¼♭ ±0.5, ¾♯ ¾♭
±1.5, and Gould's arrows (K7) the plain sign moved ±0.5 — 24-EDO. Nothing else changed: the instrument already takes
the key as it comes (`WebAudioFontInstrument.noteOn` → `queueWaveTable`, whose playback rate is
`2^((100·pitch − detune)/1200)` and whose zone lookup is an inclusive range — read in `webaudiofont/npm/src/player.ts`).
⚠️ A key number is therefore no longer always a whole piano key (60.5 = a quarter-tone above middle C). 👂 His check
is HEARING one.


**K7 — his Keypad: Gould's ARROW quarter-tones on `-` `4` `1` `0` `.`** (his ask, 2026-10-10: *"we are not
changing the accidental palette … we are adding new accidentals … but we have no enough room in the keypad so we
replace some keys (in the future we can have a wider accidental palette plus the keypad)"*). ✅ **Built 2026-10-10.**
Five rows in the sign table — `quarterToneSharpNaturalArrowUp` (E272, `-`), `threeQuarterTonesSharpArrowUp` (E274,
`4`), `quarterToneSharpArrowDown` (E275, `1`), `quarterToneFlatArrowUp` (E270, `0`), `threeQuarterTonesFlatArrowDown`
(E271, `.`) — on the ranks of the Stein signs they stand for, five tuning rows (nearest key until K6), five ink rows,
the glyphs in the generated font tables (all three faces draw them). The five keys are SLOTS: the Accidentals page
is now thirteen slots and `Enter`. ⭐ What lost a key kept its command: ♮♯ / ♮♭ (K5) are still signs, the REMOVE
(K2) is still `setAccidental(null)` — a future wider palette, or `__keypad.slot('4', 'naturalSharp')`, gives one a key
again. ⭐ And `engrave/notes/keyLines` now builds its key-string parser FROM the sign table, so a new sign's code can
never be refused there again (K4's crash). ⏭️ *"maybe in the future we make this configurable"* — the slots are
already one table (`keypadSignSlots`); configurable = a UI over it + saving it, ⛔ not built.

**Not wired:** `.` (suppress cautionary accidental) — we draw no automatic cautionary accidentals, so
it has nothing to act on. `-` is empty in Sibelius too.

## 5. Three defaults I chose — say if you want otherwise (1 decided)

1. ✅ **Decided 2026-10-10: a sign's id is its SMuFL glyph name WITHOUT the family prefix** —
   `sharp`, `doubleFlat`, `quarterToneSharpStein` (`accidental…` and Sagittal's `acc…` dropped: the
   field is already `alteration`). The full SMuFL name is the row's `glyph` column, so the drawing
   never rebuilds a glyph name from an id. We still never invent names for the 488 signs that exist.
2. **K3's second press** takes the brackets off and, if the first press had made a hidden accidental
   appear, hides it again — so the key is a clean toggle. What Sibelius does there is UNKNOWN.
3. **`Enter`, `0`, `4`, `1` do nothing with no note selected** (`0` built so, K2). Whether Sibelius arms them is UNKNOWN.

## 6. Not in this plan

Transposition (we have none, and no program solves it for an open set of signs) · **the extended
accidental palette's UI**, and saving which sign a Keypad slot holds (§4 builds only what they will
stand on) · signs a user draws himself · the tuning layer beyond the first piano-tuned table · a UI for key signatures with
quarter-tones (the model permits them after M2; ⛔ no manual read covers them) · the other ACCIDENTAL
SYSTEMS (an accidental to every pitch · only the note it precedes — Gould pp. 86–87), a per-score
choice for later · inflections written ABOVE the note (numerals, cents, small arrows — Stone p. 70),
which are not accidentals · Gould's preferred arrow-on-accidental signs, another family of rows.

## 7. How each step is checked

Unit specs beside each new module; `build:check`; the browser geometry suite (`npm run test:e2e`)
either side of M2, M3, K3, K4 and K5 — ⛔ never at the same time as the unit suite. One phase, one
commit, made when he says.
