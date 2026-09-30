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

**M1 — C♯ and D♭ are two pitches (the bug, its own commit).** The *"is this pitch already here"*
sites — mouse entry, grace pitches, bracketed graces, entry overwrite — ask `samePitch`, which
compares letter, signs and octave. ✔ Spec per site. 👁 His check: a chord holding both C♯ and D♭.

**M2 — the storage flips.** `alter` (number) becomes `alteration` (list) on the pitch, the flat
`Note`, the entry parameters and `KeyAlteration`. The bar's accidental rule compares alterations
(it never did arithmetic, so its logic does not change). The score file's version goes up, so an old
file is **refused with a reason** rather than loaded with its accidentals silently gone.
**The three examples are re-saved in this step** (a one-off conversion script, not shipped).
⚠️ Size, said plainly: 67 source files and about 1,300 lines in 209 spec files change, almost all
mechanically (`alter: 1` → `alteration: ['accidentalSharp']`, `alter: 0` → removed).
✔ Whole unit suite, `build:check`, browser suite unchanged, and the three examples drawn before and
after compare identical. 👁 His check: the examples open and look and sound the same.

**M3 — the drawing speaks signs.** The renderer still names accidentals by five strings inherited
from VexFlow (`'#' 'b' 'n' '##' 'bb'`) in its glyph table, its column packer, its spacing rows, the
slur's accidental point and the hit box. They become sign ids and ROWS (glyph, ink extents), so a
sign the table gains can be drawn without touching those files again.
✔ No pixel moves: browser suite + the examples comparison, as M2.

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
lights its own key. 👁 His check includes reassigning one slot from the console, and hearing a
double sharp and a double flat play two semitones from the plain note.

**K2 — `0` remove accidentals.** Runs the command that already exists (the palette's *remove
accidental*, across the selection): each note goes back to what the bar and the key say. No light.

**K3 — `Enter` the accidental's parentheses.** A new display property on the pitch
(`accidentalEnclosure: 'round'`, a shape like the notehead's). The accidental is drawn as a RUN —
bracket, sign, bracket — which is also what K5 and any future list of signs need. On a note that
shows no accidental the implied one appears, in brackets (Sibelius). All three fonts have the glyphs.
The space between bracket and sign is a changeable row, researched as a follow-up — ⛔ not a blocker.

**K4 — `5` `6` `2` `3` the quarter-tones.** Four rows in the sign table, four ink rows, and four
more slots holding them. ✅ They are Gould's own table of "fixed symbols" (p. 96, *"recommended that
all four … are used"*), and in the bar they behave as a sharp does — Gould p. 98: *"an ordinary
accidental must cancel a microtone"*, and without one the next notes stay altered. ⛔ No book gives a
number for their gap or their chord column, so their ink rows start from the glyphs' own boxes. Drawn from Bravura when the score's font lacks them (decision E). Sound,
for now, as Sibelius without its plug-in: the nearest normal note.

**K5 — `4` `1` ♮♯ and ♮♭.** A second display property (`naturalBefore`): the note stays a plain sharp
or flat and a natural is drawn in front, composed from the score's own font. Offered only on a note
that cancels a double earlier in the bar (decision C); anywhere else the key does nothing.

**K6 — quarter-tones heard (low priority, decision D).** The tuning answers half steps and the
instrument detunes. WebAudioFont's player should take it — read in its source, ⛔ not yet heard.

**Not wired:** `.` (suppress cautionary accidental) — we draw no automatic cautionary accidentals, so
it has nothing to act on. `-` is empty in Sibelius too.

## 5. Three defaults I chose — say if you want otherwise

1. **A sign's name in the file is its SMuFL glyph name** (`accidentalSharp`,
   `accidentalQuarterToneSharpStein`). It is the industry's own name for the sign as DRAWN, which is
   what you decided a note stores, and it means we never invent names for the 488 signs that exist.
   The cost is longer text in the JSON.
2. **K3's second press** takes the brackets off and, if the first press had made a hidden accidental
   appear, hides it again — so the key is a clean toggle. What Sibelius does there is UNKNOWN.
3. **`Enter`, `0`, `4`, `1` do nothing with no note selected.** Whether Sibelius arms them is UNKNOWN.

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
