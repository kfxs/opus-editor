# Sibelius 6's KEYPAD — what the panel is, and what every key of the second and sixth layouts does

> **FINDINGS, not a plan.** This records what Sibelius 6 *does*, because our Keypad is a picture of
> that panel (`src/windows/keypad/`, and `docs/how-it-works/keypad.md` for ours). ⛔ Nothing here is a
> decision about what OUR keys will do — the Grace page in particular is DRAWN and **nothing is
> wired**; every one of its keys is `momentary` and a click only logs its action.
>
> **Confidence markers, meant literally:**
> **✅ verbatim** — quoted from a rendered page of the Sibelius 6 Reference in this research.
> **🔶 inference** — our reading of the Reference's examples or of its own layout pattern, marked as
> such at each use.
> **⛔ UNKNOWN** — the Reference does not answer it and we did not guess (`CLAUDE.md`: the honest
> report is UNKNOWN, never a plausible rule with no source behind it).

Researched 2026-09-23 while drawing the Grace page, by reading the book itself. §3 (the second
layout) is where the depth is — that is the page we were drawing; §3c (the sixth, accidentals) was
added 2026-09-30 the same way; §5 says plainly which layouts have NOT been researched, so nobody
reads silence as coverage.

## 0. The source, and the route that works

**Sibelius 6 Reference Guide** (Avid, 6 April 2010, 746 pp):
`https://resources.avid.com/SupportFiles/Sibelius/6/reference.pdf`

- ⚠️ **The working filename is lowercase `reference.pdf`.** `…/Sibelius_Reference.pdf` is a 404.
- ⚠️ **Render the pages; do not trust text extraction.** This PDF's font makes the arrow glyphs
  (↑↓←→) extract as the digits `0`/`1`/`2`/`3`, so an extracted *"hit 0"* can be a lie. Every `0`
  quoted below was read off a rendered page.
- Cross-checks used: Sibelius Reference 2018.6 (for the note-value range), a teaching hand-out that
  labels every key (secondhand), and the SMuFL glyph names (`w3c.github.io/smufl` now 301s to
  `smufl.formats.music`; `smufl.org/version/…` answers 403).

The layout figure on **p. 16** matches the Sibelius 6 screenshot we drew from, cell for cell.

## 1. The panel

Three parts, and only the middle one is the numpad:

- **Six TABS along the top** — the layout selector, one per layout, each drawn with a picture off
  that layout (F7…F12). ✅ p. 17: *"If a note has characteristics that are not on the currently
  selected Keypad layout, the tabs for the relevant Keypad layouts will also be illuminated in
  blue."*
- **The 4 × 5 GRID** — the numeric keypad itself, 17 positions (three merged keys: `+` tall,
  `Enter` tall, `0` wide). Two of them are the same on every layout: the mouse-pointer button
  top-left, and the layout-navigation buttons in the `+` position.
- **The VOICE ROW along the bottom** — `1 2 3 4 All`, shortcut **Alt**+1–4. Not numpad keys. It is
  part of a gesture, not decoration: the bar rest (§4) is put in *the voice chosen there*.

## 2. The rules the whole panel runs on

- ✅ **Sticky** (p. 9): *"All of these buttons stay pressed down for successive notes until you
  re-choose them, with the exception of the accidentals on the first and sixth Keypad layouts."*
- ✅ **Several layouts at once** (p. 9): *"You can choose buttons from more than one layout at once —
  they'll all be applied to the note/chord when you input it."*
- ✅ **The lights report the SELECTION** (p. 17): *"selecting a dotted quarter note rest will make the
  quarter note, rest and rhythm dot buttons on the Keypad light up."*
- ✅ **Layout navigation** (p. 16): *"click ▶ on the Keypad to cycle through the layouts in order
  (shortcut `+`), and click ◀◀ to return to the first Keypad layout (shortcut F7, also Shift-+ on
  Windows or `–` on Mac)."*
- ✅ **The mouse-pointer button clears the selection** (§1.7): *"You can also click on the mouse
  pointer button at the top left-hand corner of the Keypad, which is handy if you are working with an
  interactive whiteboard or tablet PC."* Same as Esc; on all six layouts.
- ✅ **`0` means "non-thing"** on every layout (p. 17): *"The **0** key is appropriately used for
  'non-things' – either rests or for removing all articulations/accidentals."*

## 3. The second layout ("More notes", F8) — the 17 keys

The numpad grid, and what Sibelius puts on it:

| key | Sibelius's name | picture | what it does | kind |
|---|---|---|---|---|
| NumLock | mouse-pointer button | arrow | clears the selection (same as Esc). On **all six** layouts ✅ | click-only; a Windows key binding is ⛔ UNKNOWN (NumLock is the OS's) |
| `/` | **Appoggiatura** | small 8th note, no slash | grace note without the slash ✅ | toggle, sticky |
| `*` | **Acciaccatura** | small 8th note, slashed | grace note with the slash ✅ (p. 127 prints both buttons with these captions) | toggle, same family |
| `-` | **Pre-bend note** | notehead in round brackets | the bracketed grace note that starts a guitar pre-bend: *create it → `J` for the bend → the second note* ✅ | toggle, same family |
| `7` | 512th note | note, 7 flags | note value 🔶 | radio |
| `8` | **Breve** ("double note") | `‖o‖` | 2 whole notes ✅ | radio |
| `9` | **Long** (longa) | square head, stem down right | 4 whole notes ✅ | radio |
| `+` ◀◀ | back to the first layout | ◀◀ | ✅ *"click ▶ on the Keypad to cycle through the layouts in order (shortcut `+`), and click ◀◀ to return to the first Keypad layout (shortcut F7, also Shift-+ on Windows)"* (p. 16) | momentary |
| `+` ▶ | next layout | ▶ | as above ✅ | momentary |
| `4` | 64th note | note, 4 flags | note value 🔶 | radio |
| `5` | 128th note | note, 5 flags | note value 🔶 | radio |
| `6` | 256th note | note, 6 flags | note value 🔶 | radio |
| `1` | **Round bracket** | `( )` | parentheses round the notehead — see §3 ✅ | toggle |
| `2` | **Double dot** | `..` | second augmentation dot ✅ | radio with F7's single dot |
| `3` | **Triple dot** | `...` | third augmentation dot ✅ | radio, same set |
| `Enter` | **Cue-size** | full-size note over cue-size note, split by a stroke | makes the selection cue size (75 % of full); sticky during input; re-choosing restores full size; works on notes, rests, lines, symbols, staff text ✅ | toggle |
| `0` (wide) | **Bar rest** | whole rest hanging from a leger line | a bar rest in one voice — see §4 ✅ | action |
| `.` | **Slide** | short rising diagonal | the guitar slide between this note and the next ✅ | toggle |

⚠️ **Sibelius splits the tall `+` into two half-buttons** (◀◀ above, ▶ below). Our pad keeps ONE
tall `+` (the page-turn), because our panel is a picture of the NUMPAD, where `+` is one tall key.

⚠️ **Arpeggios are NOT on this layout** — they are on the fifth (F11, jazz articulations), p. 17.

✅ **Everything on F8 is sticky** (p. 9): *"All of these buttons stay pressed down for successive
notes until you re-choose them, with the exception of the accidentals on the first and sixth Keypad
layouts"* — and *"You can choose buttons from more than one layout at once — they'll all be applied
to the note/chord when you input it."*

### What the Reference does NOT name

It names, verbatim: acciaccatura, appoggiatura, pre-bend note, round bracket, slide, cue-size, bar
rest, the mouse-pointer button, ◀◀ and ▶. **It never names the six note-value keys** — that part of
p. 16 is a picture only.

🔶 **How the note values were pinned** (inference, high confidence, ⛔ not a quoted sentence):
(a) the ink in each icon rises monotonically by about one flag per step, `4 → 5 → 6 → 7`, with `7`
the longest stack; (b) F7 follows *key n = n flags* (1 = 8th, 2 = 16th, 3 = 32nd) and F8 continues
it; (c) the 2018.6 Reference states the product's range as *"512th note (7 beams) to double breve
(4 × duration of whole note)"*; (d) two secondhand sources give the same assignment.

## 3a. The pre-bend note (`-`) — what it draws ON THE STAFF

**A grace-SIZED, STEMLESS black notehead inside round brackets. No stem, no flag, no slash.**

- ✅ p. 130: *"first, from the second Keypad layout (shortcut F8), create the grace note (…) or
  pre-bend note (…, shortcut `–` on Windows, `*` on Mac); hit **J** to create a bend; then create the
  second note. On a tab staff, a pre-bend is represented by a vertical arrow."*
- ✅ The "Pre-bend and release" passage contrasts both with the *"full-size note"* that follows, and
  its example prints them side by side: a bare bracketed notehead, then a ♯ acciaccatura that plainly
  has stem, flag AND slash, then the full note.
- ✅ Grace size is **60 %** of full (p. 124: *"Grace notes are normally a bit smaller than cue notes
  (60% of full size instead of 75%)"*). 🔶 Measured off the rendered example: bracketed head ≈ 0.65 of
  the full head beside it.
- 🔶 **The brackets belong to the pre-bend note**, not to the `1` key: the recipe never mentions
  adding brackets, and the only places pp. 130–131 send you to the round-bracket key are for OTHER
  notes on a TAB staff. ⛔ The Reference never says this in so many words.

## 3b. The round bracket (`1`) — general, and it swallows the accidental

✅ p. 165, §2.25 Noteheads, "Notes in parentheses", the whole entry:

> You can add parentheses (round brackets) to any notehead (including grace notes) using the button
> on the second Keypad layout (shortcut **F8**). The parentheses will automatically adjust to enclose
> accidentals, etc.

So it is **not** guitar-scoped (the guitar chapter is one *use* of it, p. 130), and the brackets
grow to take an accidental inside.

- **Chords:** the Reference's unit is *the notehead*. ⛔ UNKNOWN from Avid; secondhand, it brackets
  each notehead of a chord.
- **Rests:** ⛔ UNKNOWN — the entry says "notehead" and rests are not mentioned.
- ⚠️ **Not the same as F12's parentheses button**, which brackets the **accidental alone**
  (p. 77, §2.1 Accidentals). F8-`1` brackets the note and takes the accidental with it.

## 3c. The sixth layout ("Accidentals", F12) — the 17 keys

Researched 2026-09-30 while drawing our `accidentals` page. ⚠️ **A different copy of the book than
§0's**: the 6.1 Reference (31 August 2009),
`https://hub.sibelius.com/download/documentation/pdfs/sibelius610-reference-en.pdf` — so its page
numbers are NOT the ones quoted elsewhere in this file (§2.1 Accidentals is pp. 75–79 there). ⚠️ And
the quotes below were taken from the EXTRACTED text, not from rendered pages — §0's warning applies
(an arrow glyph extracts as a digit). The two that name a key — *"the 0 key"* and *"shortcut ."* —
are backed by the button pictures printed beside them (rendered: the wide key, and the crossed
bracketed key) and by the ManuScript command list; the rest name no key.

Its figure (p. 16) matches the Sibelius 6 screenshot we drew from, cell for cell.

| key | Sibelius's name | picture | what it does | confidence |
|---|---|---|---|---|
| NumLock | mouse-pointer button | arrow | clears the selection — every layout (§2) | ✅ |
| `/` | **Double sharp** | 𝄪 | *"Obtain these from the sixth Keypad layout just like normal accidentals."* | ✅ text · 🔶 the key (by position + ManuScript's `keypad_/`) |
| `*` | **Double flat** | 𝄫 | the same | ✅ · 🔶 key |
| `-` | — | EMPTY | nothing, and nothing can be put there — Spreadbury: *"Nor can you add any symbols to the blank spots on the final Keypad layout."* | ✅ (forum) |
| `7` `8` `9` | **Natural · Sharp · Flat** | ♮ ♯ ♭ | the first layout's three keys again | ✅ *"choose an accidental from the first or sixth Keypad layout"* · 🔶 that they are the SAME command (ManuScript has one `natural` / `sharp` / `flat`) |
| `+` ◀◀ / ▶ | first layout / next layout | | every layout (§2) | ✅ |
| `4` | **Natural sharp** | ♮♯ | ⚠️ NOT a free accidental — see "The two cancelling signs" below | ✅ name (third-party diagram) · behaviour below |
| `1` | **Natural flat** | ♮♭ | the same, for a double flat | as `4` |
| `5` | **Quarter sharp** | sharp with ONE upright | an accidental like any other; transposes and respells | ✅ |
| `6` | **Quarter flat** | reversed flat | the same | ✅ |
| `2` | **Three quarter sharp** | sharp with THREE uprights | the same | ✅ |
| `3` | **Three quarter flat** | reversed flat + flat | the same | ✅ |
| `Enter` | **Bracket accidental** ("the parentheses button") | `( )` | round brackets on the ACCIDENTAL of the selected note(s) — see below | ✅ |
| `0` (wide) | **Remove accidentals** | an accidental, crossed out | *"Removing lots of accidentals: Select the notes in question, then, from the sixth Keypad layout (shortcut F12), choose the 0 key on the numeric keypad or the corresponding button shown on the right."* | ✅ |
| `.` | **Suppress cautionary accidental** | a bracketed accidental, crossed out | *"You can hide an automatic cautionary accidental by selecting the note on which the cautionary accidental appears, and choosing the Suppress cautionary accidental button (shortcut .) on the sixth Keypad layout"* | ✅ |

🔶 The key for `1`–`6` and the top row is read off the POSITION in the figure; the Reference names
the key only for `0`, `.`, `7 8 9` and the navigation. Names in bold are from a third-party labelled
diagram and the later ManuScript command list — ⛔ Sibelius 6's own tooltips are UNKNOWN; its
Reference names only "Suppress cautionary accidental" and "the parentheses button".

### How an accidental key behaves (both layouts)

- ✅ **On a selection**: *"Select the note(s) in question, then choose an accidental from the first or
  sixth Keypad layout."* A whole chord: *"double-click one of the notes in the chord and then choose
  an accidental."*
- ✅ **The same key again takes it off**: *"Select the note(s) in question, then choose the accidental
  from the Keypad again, to switch it off."*
- ✅ **Nothing selected arms the NEXT note**: *"you can give it an accidental at the same time by
  choosing one from the first or sixth Keypad layout (shortcuts F7/F12) before putting the note into
  the score."*
- ✅ **One-shot** — the one exception to "sticky" (§2): an armed accidental serves one note.
- ✅ **The light reports the selection**, and a sign that lives on another layout lights that layout's
  TAB (§1).
- 🔶 **One accidental per note** — never said in words. ManuScript gives a note ONE `Accidental`
  value (2, 1, 0, −1, −2 and the four halves ±0.5, ±1.5), and keeps the brackets / the hiding apart
  from it, as an `AccidentalStyle` (normal · hidden · cautionary · bracketed).
- ⛔ UNKNOWN: whether pressing a DIFFERENT accidental replaces the one there in one press; what
  pitch a note takes when its accidental is switched off or removed by `0` (one secondhand hint: it
  falls back to the key signature); a MIXED selection (the Reference's rule — the key lights only for
  what all share, and a press gives it to all — is stated for the accent).

### The two cancelling signs (`4`, `1`)

- ✅ *"The symbols ♮♭ and ♮♯ are occasionally used instead of ♭ and ♯ when canceling a double-flat
  or sharp earlier in the bar."*
- ✅ Spreadbury (help-centre thread): *"You can't change the function of the natural-sharp and
  natural-flat symbols, I'm afraid, so they'll only appear in the situations in which they will
  currently appear"* — a user in the same thread reports they *"seem to only function on a note that
  is preceded by a note with the appropriate double sharp or double flat."*
- ⛔ UNKNOWN: what the key does with no double accidental before the note (greyed? nothing? a plain
  sharp/flat?).

### The parentheses button (`Enter`)

- ✅ *"To manually add parentheses to an accidental on a selected note (or group of notes), choose the
  parentheses button from the sixth Keypad layout (shortcut F12)."* Round only — square brackets are
  not on the Keypad.
- ✅ **On a note that shows none, the implied accidental APPEARS, bracketed** (Avid KB): *"just select
  the note and choose the ( ) button … Sibelius will fill in the implied accidental for you."*
- ✅ **A toggle** (Scoring Notes, on a passage): *"this will bracket all of the accidentals… Select the
  key again, and the brackets will disappear, except for the ones that should be there (if any)
  according to your Engraving Rules."*
- ⚠️ Not F8's round bracket (§3b), which brackets the NOTE and takes the accidental inside.
- ⛔ UNKNOWN: whether it — or `.`, or `0` — arms anything when nothing is selected.

### Quarter-tones: drawn, transposed, respelled — and silent

- ✅ *"Quarter-tones transpose automatically … What's more, Sibelius will respell quarter-tones."*
- ✅ They do not SOUND on their own: *"A plug-in to make quarter-tones play back called Quarter-tone
  Playback is included with Sibelius"* — it writes hidden MIDI pitch bends, and *"only one pitch bend
  command is possible at a time per instrument, so that different notes in a chord cannot be retuned
  by different amounts."* Until it is run (Robert Puff): *"A natural and a quarter-sharp sound the
  same pitch"* — likewise sharp / three-quarter sharp, flat / quarter flat, double flat /
  three-quarter flat.
- ✅ The signs are slots, not shapes: *"The first nine symbols on the Accidentals row of the Create ▸
  Symbol dialog correspond to the symbols on the sixth Keypad layout … the Keypad will still show
  the original symbol but will input your new one."*

### Later versions

✅ The layout is the same picture in the 2018.6 Reference (Sibelius | Ultimate) and the text is
unchanged in 2022.3, where `.` is "Suppress auto cautionary accidental". In the mid-tier products
the four quarter-tone keys are blank. 🔶 "Unchanged in 7" is inferred — no Sibelius 7 Reference was read.

### Sources for this section

- Sibelius 6 Reference 6.1 (URL above): §1.1 Note input, §1.2 Keypad, §2.1 Accidentals, §5.17
  Properties, the Quarter-tone Playback plug-in, §8.17 Edit Symbols
- ManuScript Language Guide 2022.3 — `https://resources.avid.com/SupportFiles/Sibelius/2022.3/ManuScript_Language_Guide.pdf`
  (command ids, the `Accidental` and `AccidentalStyle` constants)
- "Sibelius Keypad Layers", Dan Bishop (a labelled diagram, secondhand) — `https://gcsetime.com/wp-content/uploads/2021/09/Sibelius-Keypad-Layers.pdf`
- Sibelius help centre, "Sib. 6.1: customizing accidentals on keypad layout 6" (Spreadbury's reply) — `http://www.sibelius.com/cgi-bin/helpcenter/chat/chat.pl?com=thread&start=475497&groupid=3&guest=1`
- Avid KB, "How to input Cautionary accidentals in Sibelius" — `https://kb.avid.com/pkb/articles/en_US/how_to/en359699`
- Scoring Notes, "Reset accidentals in Sibelius" — `https://www.scoringnotes.com/tips/reset-accidentals-in-sibelius/`
- Robert Puff, "Sibelius Quick Tip: Quarter-tone playback" — `https://ofnote.nycmusicservices.com/sibelius-quick-tip-quarter-tone-playback/`
- ⛔ DEAD on the day: three Sibelius forum threads on bracket / courtesy accidentals (t=3155, t=3618,
  t=72269) answered 403 and have no Wayback copy — unread, not "silent".

### What OUR page draws

Bravura, as §6: `/` E263 · `*` E264 · `7 8 9` E261 E262 E260 · `4` `accidentalNaturalSharp` E268 ·
`1` `accidentalNaturalFlat` E267 · `5` `accidentalQuarterToneSharpStein` E282 · `6`
`accidentalQuarterToneFlatStein` E280 · `2` `accidentalThreeQuarterTonesSharpStein` E283 · `3`
`accidentalThreeQuarterTonesFlatZimmermann` E281 · `Enter` `accidentalParensLeft/Right` E26A E26B ·
`0` a flat under a cross · `.` a flat in those parentheses under the same cross (the cross is two
bare stems, E210, turned each way — a stack, baked). ⚠️ `Enter` is `parenthesised accidental` on our
pad, not "bracket accidental" — the §6 reason. ⭐ `7 8 9` are wired as page one's three keys; ⛔ the
other twelve are a picture and only log (`docs/how-it-works/keypad.md`).

## 4. The two `0` keys — a rest vs a BAR REST

✅ p. 17 sums both up: *"The **0** key is appropriately used for 'non-things' — either rests or for
removing all articulations/accidentals."*

**F7 `0` — the rest button.** A silence of *whatever note value is armed*, which is why its icon is a
generic quarter-plus-eighth pair.

- ✅ p. 10: *"To input a rest of the selected note value, simply hit **0** on the **F7** Keypad
  layout. (To continue creating rests of the same note value, keep hitting **0**.)"*
- ✅ p. 14, on a selected note: *"To turn a note, chord or passage into rests, simply hit **Delete**,
  or choose the rest button (shortcut **0**) on the first Keypad layout. The subtle difference … is
  that when turning a passage into rests, **Delete** consolidates the rests … whereas **0** just
  turns each note into an individual rest (which is less useful)."*
- ✅ It lights as a STATE (p. 17): *"selecting a dotted quarter note rest will make the quarter note,
  rest and rhythm dot buttons on the Keypad light up."*
- ⛔ UNKNOWN: whether it LATCHES during typed input. With the mouse it is armed and you keep
  clicking; typed input is described as one press = one rest.

**F8 `0` — the bar rest.** A different OBJECT: "this bar is silent", per voice, centred.

- ✅ p. 91, the figure caption: *"Although they look identical, be aware that a **bar rest is not the
  same as a whole note (semibreve) rest**. Bar rests are centered in the bar, while whole note rests
  go at the left of the bar, in the same place a whole note itself would go."* The figure is a 3/2
  system — where a whole rest is two half-notes of silence hard against the meter with a beat still
  to fill, and the bar rest is the whole bar.
- ✅ p. 91, the recipe, which is VOICE-SCOPED: *"Select a note or rest in the bar · Hit **N** … · Go
  to the second Keypad layout (F8) · **Choose the voice you want the bar rest to go in**, using the
  buttons at the bottom of the keypad (Alt+1–4) · Choose the bar rest button (shortcut **0**). This
  can be used either to create a bar rest in a voice that didn't previously exist, or to turn notes
  back into a bar rest in one voice only. **However, this only deletes notes or rests and leaves
  other objects alone.**"*
- ✅ p. 92: it cannot be dragged left or right (*"because – let's face it – it's not all that
  useful"*); its width is the bar's (move the barline); ↑/↓ move it; **in 4/2 and 3/1 Sibelius draws
  a BREVE bar rest** instead, switchable in Engraving Rules; hiding it gives a blank bar.
- ✅ p. 10: deleting a rest **or a bar rest** leaves it unchanged and moves the caret past it.
- ✅ p. 160: *"A multirest is an abbreviation for several consecutive **bar rests**"* — never of
  whole rests.
- ⛔ UNKNOWN: whether selecting a bar rest lights F7's rest button, F8's bar-rest button, or both.
  What IS known (p. 17): *"If a note has characteristics that are not on the currently selected
  Keypad layout, the tabs for the relevant Keypad layouts will also be illuminated in blue."*

⛔ **UNKNOWN: can both `0`s be "on" at once, and which wins?** The Reference never addresses it.
What bounds the question: neither `0` is a pending modifier (p. 9's sticky list — accidentals,
articulations, ties/dots, grace/cue, tremolos/beams, jazz — does not include either rest button);
both are described as acting NOW (*"hit 0 … to input a rest"*); and they make different objects on
different layouts.

## 5. The other layouts — ⛔ NOT RESEARCHED, but for the sixth

Only the second and the sixth layouts were read key by key, because those are the pages we were
drawing. What this research touched of the others, and nothing more:

| layout | what we know |
|---|---|
| **F7** first, "common notes" | ✅ its `0` is the rest button (§4). Its shape we know from the screenshot and from our own `noteEntry` page: articulations · accidentals · durations · tie · rest · dot. ⛔ Its keys were not read out of the Reference. |
| **F9** third, Beams/Tremolos | ⛔ not researched here. Ours (`beamsTremolos`) was built earlier and IS wired — `docs/how-it-works/keypad.md`. |
| **F10** fourth, articulations | ⛔ not researched. |
| **F11** fifth, jazz articulations | ✅ ONE fact: **arpeggios and repeat bars live here**, not on F8 (p. 17). |
| **F12** sixth, accidentals | ✅ **researched 2026-09-30 — §3c**, key by key. |

⛔ Do not read the gaps as "the layouts are simple" — they are gaps. The route in §0 is cheap to
re-walk.

## 6. What OUR page draws, key by key

Bravura throughout (`KeypadWidget`'s `MUSIC_FONT`), each codepoint read out of
`public/fonts/Bravura.otf` before use — ⚠️ the Keypad's font stack is a fixed constant and does NOT
follow the music-font switch.

| key | our picture | glyph(s) |
|---|---|---|
| `/` | appoggiatura | `graceNoteAppoggiaturaStemUp` E562 |
| `*` | acciaccatura | `graceNoteAcciaccaturaStemUp` E560 |
| `-` | bracketed grace ⚠️ **our name** | `noteheadParenthesis` E0CE + `noteheadBlack` E0A4 (a stack) |
| `7` `4` `5` `6` | 512th / 64th / 128th / 256th | E1E3 · E1DD · E1DF · E1E1, ONE size so the heads match and only the flag stack grows |
| `8` | breve | `noteheadDoubleWhole` E0A0 |
| `9` | longa | `noteheadDoubleWholeSquare` E0A1 + `stem` E210 (a stack — SMuFL names no longa note) |
| `1` | parenthesised note ⚠️ **our name** | E0CE alone, its own size |
| `2` `3` | double / triple dot | `augmentationDot` E1E7 ×2, ×3 (a stack, so the spacing is ours) |
| `Enter` | cue size | flat+whole head, full size over cue size, cut by `graceNoteSlashStemUp` E564 **rotated** |
| `0` | bar rest | `restWholeLegerLine` E4F4 |
| `.` | gliss ⚠️ **our name** | E564 |

⚠️ **Three of our names are deliberately NOT Sibelius's.** Sibelius names the first two keys for ONE use —
the guitar pre-bend and the guitar slide — but the same bracketed grace note is how a trill says
which note to trill to, and the same line between two notes is a glissando wherever it is not a
guitar slide. So the keys are `bracketed grace` and `gliss` on our pad: the name says what the key
IS, and neither has to be renamed the first time the other use arrives. The third, `1`, is
Sibelius's "round bracket": that names the SIGN, and the key is what it does to a note — puts it in
parentheses — so it is `parenthesised note` (the spelling the trill's `(tr)` label already uses, and
⛔ not "bracketed", which here means the staff bracket and the bracketed grace). ⛔ §1–§4 above keep
Sibelius's names, because that is what the book says.

The stacked drawings are `bake` recipes: they draw from BAKED OUTLINES once `npm run bake:keypad`
has run, so a browser zoom cannot re-lay the glyphs (`docs/how-it-works/keypad.md`). ⚠️ A recipe
missing from `KEYPAD_BAKE_RECIPES`, or a change to `bakeRecipeKey`'s shape, silently drops a picture
back to the live text form — both happened while drawing this page, on 2026-09-23.
