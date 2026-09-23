# Sibelius 6's KEYPAD — what the panel is, and what every key of the second layout does

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
layout) is where the depth is — that is the page we were drawing; §5 says plainly which layouts have
NOT been researched, so nobody reads silence as coverage.

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

## 5. The other five layouts — ⛔ NOT RESEARCHED

Only the second layout was read key by key, because that is the page we were drawing. What this
research touched of the others, and nothing more:

| layout | what we know |
|---|---|
| **F7** first, "common notes" | ✅ its `0` is the rest button (§4). Its shape we know from the screenshot and from our own `noteEntry` page: articulations · accidentals · durations · tie · rest · dot. ⛔ Its keys were not read out of the Reference. |
| **F9** third, Beams/Tremolos | ⛔ not researched here. Ours (`beamsTremolos`) was built earlier and IS wired — `docs/how-it-works/keypad.md`. |
| **F10** fourth, articulations | ⛔ not researched. |
| **F11** fifth, jazz articulations | ✅ ONE fact: **arpeggios and repeat bars live here**, not on F8 (p. 17). |
| **F12** sixth, accidentals | ✅ ONE fact: its parentheses button brackets **the accidental alone** (p. 77) — ⚠️ not the same key as F8's round bracket, which brackets the note and takes the accidental inside (§3b). ✅ Also, with F7, the one layout whose accidentals are NOT sticky (p. 9). |

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
