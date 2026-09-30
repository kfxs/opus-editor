# Alteration signs beyond ♮ ♯ ♭ — the conclusions, and what he decided

> **The summary of three research passes and of our own model's audit (2026-09-30), followed by the
> decisions he took the same day.** ⛔ Nothing is built. The evidence is in the three long files:
>
> - `docs/research/alteration-signs-engines-research.md` — the SOURCE of LilyPond, MuseScore and
>   Verovio, `file:line` behind every claim;
> - `docs/research/alteration-signs-industry-research.md` — MusicXML, MEI, SMuFL, MNX, the tuning
>   formats, and the documented models of Dorico, Finale and others;
> - `docs/research/alteration-signs-books-research.md` — the LITERATURE: Gould and Stone read from
>   the scans, Read and Karkoschka from snippets, and the systems' own documents (HEJI, Sagittal,
>   Johnston, the Turkish, Arabic and Persian signs). ⚠️ Stopped early at his request; its §6 lists
>   what was not reached. It arrived after his decisions of §6 and ⭐ **overturns none of them** — §3b.
>
> ⏭️ **The build plan that follows from §6 is `docs/plans/alteration-signs-plan.md`** — the model
> first, then the Keypad's keys one at a time.
>
> Earlier and still valid: `docs/research/20c-notation-survey.md` §3 (the four semantic classes of
> microtonal system, and why a glyph's meaning can never be keyed off the glyph) and
> `docs/how-it-works/tuning-systems-and-alteration.md` (his 2026-08-13 decision that the tuning is a
> LAYER, not score content). What Sibelius's accidentals Keypad does, key by key, is
> `docs/research/sibelius-keypad.md` §3c.

## 1. The question

His framing, 2026-09-30, which is what every source below was read against:

> *"the microtones have two components, one is the scale and the sound that is not part of the
> scoremodel, but the symbol is part of the score model"*

and the task: *"how we can manage the problem of multiples and different alteration signs."* The near
work is the accidentals page of the Keypad; the far one is *"all possible tuning systems"*.

## 2. Three engines, three answers

| | what a note stores | sign ↔ sound | a user's own sign | several signs on a note |
|---|---|---|---|---|
| **LilyPond** | ONE rational number (whole tones). No symbol at all | the glyph is LOOKED UP from the number, per staff | yes, as data — a new number and a table row | no |
| **MuseScore** | a spelling (±3) + at most ONE accidental object from a closed list of 146 | each listed sign has a FIXED cent value compiled in; no tuning object | no | no — one ready-made list entry per combination |
| **MEI / Verovio** | `@accid` (written) and `@accid.ges` (sounding), two fields; the sign may be ANY glyph by name | Verovio 6.1 reads an EXTERNAL tuning file keyed by `letter + glyph name(s)` | yes, by glyph name | yes — a list, drawn in order |

- ⭐ **Verovio's external tuning is the only thing in the three that matches his framing**: the same
  written sign is a different frequency under a different tuning file.
- ⚠️ **LilyPond shows the cost of keying the SIGN on a NUMBER**, in its own shipped files: one glyph
  needs two fake numbers (`-5/18` and `-6/18`), a tuning nuance with no sign needs a number mapped to
  the empty string, and in one Turkish file the plain ♯ glyph means 5/12 of a tone.
- ⚠️ **MuseScore shows the cost of welding a NUMBER to the sign**: a Stein quarter-sharp is +50 cents
  in every score ever, and 48 of its signs (the whole Helmholtz-Ellis set) have no pitch effect at
  all. Its non-standard signs also sit OUTSIDE the bar's accidental rule — never generated, never
  cancelled — and its own source says *"they should probably get their own state"*.
- ✅ **All three keep "which sign" apart from "why and how it is shown"**: cautionary, editorial,
  brackets, size, hidden, and who put it there (the rule or the user) are properties of the
  occurrence, never new signs. The safest finding here.
- ⚠️ **Transposition is where every model shows its seam, and none solves it for an open set of
  signs**: LilyPond is exact but can land on a number with no glyph; MuseScore moves the spelling and
  leaves the sign; Verovio discards the sign.

## 3. The standards and the products — five architectures

| | the model | who | what breaks |
|---|---|---|---|
| **A** | a NUMBER only; the sign is derived | MNX today · LilyPond · ⭐ **our `PitchAlter`** | the number already IS a tuning; cannot say WHICH sign (𝄪 or ♯♯, ♮♯, Stein or arrow) |
| **B** | a SYMBOL from a fixed list | Sibelius | closed vocabulary; no sound without an interpreter |
| **C** | number AND symbol, free to disagree | MusicXML · MEI · MuseScore | the tuning is baked into every note (a makam corpus writes `alter=-0.41509434`); importers trust one side and recompute the other. MNX **dropped** this in 2022 as *"redundant … enables nonsensical behavior"* |
| **D** | symbol + a table IN the document that says what each is worth | Dorico *tonality systems* · Finale key formats · the MEI proposal #1167 | equal divisions only, in both products; transposition defined only inside one system; no interchange format carries the table |
| **E** | a free glyph + free cents per note | Mus2 · old MNX proposals | everything is expressible, nothing is computable — no transposition, no cancelling, no key logic |

⭐ **His framing is D with the table moved OUT of the score** — B for the content, plus an external
interpreter. No shipping standard does exactly that. Dorico and Finale keep the table in the document
and bundle two things his framing separates: the NOTATION SYSTEM (which signs exist, how each is
drawn, what cancels what) and the TUNING (what each is worth). ⭐ Dorico itself proves they separate:
it ships two 24-division systems — Gould arrows and Stein-Zimmermann — **the same tuning, two sign
sets**.

Facts worth having without opening the long file:

- **Several signs on one note**: MEI yes; MusicXML 4.0 no — ⭐ but **MusicXML 4.1 (unreleased) makes
  it a list, drawn left to right** (merged 2026-08-07); SMuFL is designed for it (Johnston,
  mixed Sagittal, Helmholtz-Ellis "combining" glyphs; the parentheses are separate glyphs).
- **Vocabularies**: MusicXML 4.0 has 41 accidental values, MEI 36 written / 23 sounding — both
  include `natural-sharp` / `natural-flat` as written values.
- **SMuFL 1.4**: 27 accidental ranges, **488 glyphs**, and ⛔ **no pitch meaning anywhere in its
  metadata** — only prose in names and descriptions, inconsistently. One Sagittal glyph is described
  with a different step count for each of eight divisions of the octave. ⚠️ A table of accidental
  glyphs must be built from `ranges.json`; the `accidentals` CLASS has holes.
- **Dorico**, in one paragraph: a tonality system = divisions per interval between the naturals +
  accidentals (a name, an integer *pitch delta* in divisions, a composite drawing with editable
  corner cut-outs) + custom key signatures. It applies from a key signature onward. Playback is
  derived. Transposition **refuses** a result whose accidental *"does not exist in the tonality
  system"*. ⛔ UNKNOWN what a note stores (the docs are silent).
- ⛔ **No tuning format takes (letter, sign)**: Scala `.scl`/`.kbm`, `.tun`, the MIDI Tuning Standard,
  MTS-ESP and MIDI 2.0 all map a scale degree or a MIDI key to a frequency. So the table *this
  letter with these signs sounds like this* has to be OURS. The closest existing thing is Ableton's
  `.ascl` (Scala plus a free-text name per degree), which Verovio reads.
- ⚠️ **The plain letters need a tuning too.** In just intonation a sign's value is constant but it is
  added to a PYTHAGOREAN letter, not a piano one — the same flat-with-arrow is −135.19 cents on D and
  −131.28 on E against 12-EDO. So the interpreter reads the letter TOGETHER WITH the signs; *"cents
  from 12-EDO per sign"* is not a sufficient model.
- **The live debate** (MEI #1167, open): a temperament table keyed by `(letter, accidental)`. Its
  unresolved fork is OURS too — is a sign's identity a SMuFL GLYPH NAME, or our own id with the glyph
  as a view? SMuFL has one meaning under two glyphs and one glyph with many meanings.

## 3b. The literature — what the books and the systems themselves say

**The manuals agree on four things across 45 years** (Karkoschka 1966 → Read 1969 → Stone 1980 →
Read 1990 → Gould 2011): there is NO standard; the accepted family is modified conventional
accidentals placed BEFORE the note; an arrow attached to ♭ ♮ ♯ is the most self-explanatory
quarter-tone sign; and whatever is used must be EXPLAINED in the score.

- ⭐ **The meaning of a sign is declared per score** — Gould p. 94: *"No pitches other than the twelve
  chromatic degrees of the octave have standard notation. Symbols for any other pitches require a
  written definition."* p. 97: *"The pitch modification of the arrow must always be defined"* — and
  the definition may be one interval, a RANGE, or *"slightly"*. This is his framing in a manual's
  voice: the sign is on the page, its worth is stated elsewhere.
- ⭐ **Sibelius's four quarter-tone keys are Gould's own table** (p. 96, "fixed symbols"): the
  one-upright sharp, the three-upright sharp, the reversed flat, the reversed flat joined to a flat;
  *"It is recommended that all four of the above fixed symbols are used"*. Her FIRST choice is the
  arrow attached to an accidental (pp. 94–96), where ¾ tones are composites (♯ + ↑); a 2023 Unicode
  proposal reports that practice has since made Stein–Zimmermann the common quarter-tone standard
  and moved the arrows to eighth- and twelfth-tones.
- ⭐ **What cancels a microtone, and how long it holds** — Gould p. 98: *"If using conventional
  accidental practice, an ordinary accidental must cancel a microtone"*; her drawing shows the next
  notes STAYING altered when nothing is written. So under the traditional rule a quarter-tone holds
  for the bar and a natural cancels it — ✅ what §6 assumed is now sourced.
- ⚠️ **…but the rule itself is a per-score convention**: Gould pp. 86–87 gives three accidental
  systems (through the bar · an accidental to every pitch · only the note it precedes, with a
  modified form) and asks that the one in use be stated in the preface; Stone pp. 55–56 the same.
  Ours is the traditional one; the others are a future setting, not a contradiction.
- ✅ **♮♯ / ♮♭ is the OLD style** — Gould p. 81: after a double, the natural *"is redundant"*
  (drawn as traditional vs contemporary practice); Stone p. 54 and Gerou & Lusk p. 4 agree. So a
  plain ♯ by default, the natural in front as a choice — decision C, and what Sibelius does.
- **One sign or several is a property of the SYSTEM**: Gerou & Lusk p. 4 — *"Do not use multiple
  accidentals on one note"* — is the conventional premise; HEJI, Johnston, Sims, mixed Sagittal and
  "ups and downs" all break it on purpose, in a defined left-to-right order.
- ⚠️ **The natural is itself a sign that can be modified** — a natural with an arrow is a quarter-tone
  sign in Gould (p. 94), Stone (p. 67) and HEJI. So "a note never stores a natural" is true only of
  the LONE, plain natural; the plan says it that way.
- 🚨 **Gould and Stone contradict each other on other microtones**: Gould p. 96 — in front of the
  note, ⛔ not above (*"numerals … above the stave can look like fingering"*); Stone p. 70 — small
  numerals with arrows ABOVE the note, one of which may govern a whole chord. That is the Ghent 1974
  line, and Read 1990 reports composers did not follow it. ⇒ an inflection written above the note is
  a DIFFERENT kind of object from an accidental, and nothing in this plan models it.
- **The literature separates sign from sound in its own words** — Secor & Keenan: *"it is only the
  symbols that are changing, not their names or meanings"*, and a Sagittal score must *"specify the
  particular tuning that is intended, along with a pitch reference"*; Farhat keeps the Persian koron
  sign while calling the quarter-tone theory it was invented for *"to a great extent refuted"*;
  Signell: the Turkish accidentals' *"literal value … can deviate at least one comma … from common
  practice"*; Marcus: the Arabic half-flat is a *"theoretical position"*, sounding higher in one
  maqām than another.
- **The same glyph, several values** (the 20c survey's point, now with pages): the Stein half-sharp
  is 50 ¢ by convention, 33/32 in HEJI, one comma in Turkish practice, one step of 31; the plain ♯ is
  100 ¢, 2187/2048 in HEJI, 25/24 in Johnston, 4 commas in AEU against the ♭'s 5 — ⚠️ sharp and
  flat need not mirror each other. And HEJI's own 2004 and 2020 legends give one sign two ratios.
- ⛔ **UNKNOWN, and not "silent"**: microtonal signs in key signatures (Gould says nothing — pp. 91–94
  checked; Stone and Read not reached) · ANY number for a microtonal accidental's gap, width or chord
  column (no book read gives one — only Gould p. 97, *"as compact as possible"*) · Read 1990's
  inventories and what Ghent recommended for specified quarter-tones.

## 4. Where OUR model stands (audited in the code, 2026-09-30)

- A pitch is `{ step, alter, octave }`, `alter ∈ −2…+2` (`types/pitch.ts`) — architecture **A**.
- **Doubles are stored, drawn, spaced and played; they cannot be ENTERED.** The editor's accidental
  vocabulary is `'#' | 'b' | 'n'`, and `alterToAccidental` shows a double as a single.
- The display state is ONE boolean, `forceAccidental`. No bracketed, hidden or cautionary accidental;
  no ♮♯ (𝄪 → ♯ draws a plain ♯).
- Key signatures are already an ordered list of (letter, alter), per staff, positional — they widen
  with the note's alteration type and need no new shape.
- ⛔ No transposition exists. ⛔ No check on `alter` when a JSON file is loaded.
- Sound: the schedule carries the SPELLING; `WebAudioFontInstrument.noteOn` is the single place it
  becomes a MIDI number. Doubles therefore already sound right.
- Fonts: of our three music faces **only Bravura has the quarter-tone and ♮♯ / ♮♭ glyphs**; Leipzig
  and Sebastian have the doubles and the accidental's parentheses.

What `alter` is asked to do, and what each job really needs:

| job | needs | fits a symbolic sign? |
|---|---|---|
| which sign to draw | an identity → glyph | yes, a table row |
| the bar's running accidentals (`utils/accidentalState`) | only *"same as what is in force?"* and *"is it the natural?"* | yes — ⭐ **no arithmetic anywhere in it** |
| what a new note is born with (`entryAlteration`) | the same two questions | yes |
| tie target | equality | yes |
| key signature layout | sharp-like or flat-like, to pick the placement table | a DIRECTION per sign |
| accidental columns, spacing (`accidentalStack`, `spacingPadding`) | five sign strings, special cases for flats and double sharps | a ROW per sign |
| chord order, *"is this pitch already here?"*, nearest note, glissando direction | a height — today `spellingToMidi`, ~20 call sites in the editor and renderer | mostly only the STAFF POSITION; the sign matters only when two notes share a line |
| sound | semitones, in one place | the tuning layer's |

⭐ **So the accidental logic compares, it never computes** — which is the engines' lesson 3 seen from
inside: a bar state keyed by SYMBOL with equality as the test is the form that scales.

🚨 **A bug found on the way** (his word, 2026-09-30: *"this is not correct the editor should not do
that"*): the editor compares pitches by MIDI number, so **C♯ and D♭ count as the same pitch** — a
click on D♭ over a chord holding C♯ is refused (`NoteEntryCoordinator`, *"Same pitch collision"*),
`graceOps.addGracePitch` and `bracketedGraceOps` refuse the same way, and `entryOverwriteOps` treats
one as a replacement of the other. ⛔ Not fixed yet; the fix is to compare letter + sign + octave,
and it falls out of the model change below.

## 5. The lessons, merged

1. **The note names a SYMBOL; its worth belongs to the interpreter.** Neither key the sign on a
   number (LilyPond) nor weld a number to the sign (MuseScore).
2. **An accidental is an ordered LIST of signs.**
3. **The bar's accidental state must be symbol-valued**, tested by equality.
4. **"Which sign" is separate from "how and why it is shown"** — brackets, cautionary, hidden, size,
   forced.
5. **One vocabulary and one form for notes and key signatures.**
6. **The interpreter's input is (letter, signs, octave)** — and the letters have a tuning too.
7. **Something between the symbol and the sound is still needed for NOTATION**: an order or size of
   signs, without which a chord cannot be sorted, a double cannot be cancelled "the same way but
   smaller", and transposition cannot be defined. Dorico's *pitch delta* is exactly that, and it is
   why its accidentals carry a number although the score is symbol-first.
8. **Transposition will need the sign table to say what each sign becomes, or to refuse.**
9. **What a sign is worth is declared per score** (the books, §3b) — the legend every manual demands
   is the tuning layer's other face, and a score may one day NAME the tuning it was written for.
10. **How long an accidental holds is a convention of the score, not a fact of notation** — ours is
    the traditional one, and it should stay one rule in one place so another can be chosen later.

## 6. ⭐ What he decided (2026-09-30)

Asked one at a time; his answers, and what each one leaves open. *"if in the future we dont like this
we can take it out"* applies to all of them.

| | the question | his decision |
|---|---|---|
| **A** | one sign per note, or several? | **A LIST of signs.** Helmholtz-Ellis is not soon; the list is there so it never needs a second shape. |
| **B** | how does the editor order two notes on the same line? | **A fixed ORDER of signs in our sign table** — a rank, ⛔ not a sound. Most height questions need only the staff position. |
| **C** | is ♮♯ its own sign, or a way of drawing a ♯? | **Follow Sibelius for the first build**: the note is a plain sharp (or flat); ♮♯ / ♮♭ is a drawing choice on that note, offered where it cancels a double earlier in the bar. ⛔ UNKNOWN what Sibelius does on any other note — do nothing there until he says. |
| **D** | what does a quarter-tone sound like now? | **Not important yet** — a future sound engine will do it properly. ⭐ **Doubles must be accurate now** (they are). When convenient, **try quarter-tones by detuning, as equal quarter-tones** — low priority. |
| **E** | a font without the sign? | **Start with Bravura** for the signs Leipzig and Sebastian lack; **compose where a sign can be composed** (♮♯ is a natural beside a sharp, from the score's own font); other glyphs later. |
| **F** | what is built first? | **The MODEL first** — the note changes from the number to the list of signs, with nothing visible changing; then the Keypad's keys, one at a time. |

⭐ **And a seventh, volunteered after the plan was written** — the Keypad is one door, not the list:
*"we can have in the future an extended accidental palette containing more glyphs, or we can select
and switch things from the keypad to the palette — for the moment this palette has no UI, but it is
good to know this so the infrastructure is built."* What that asks of the build is the plan's §4:
one command for any sign, a key as a SLOT holding a sign id, one slot table, the light by sign id.

⚠️ **The model change rewrites the stored shape of EVERY pitch** — today's `alter: 1` becomes a list
of signs — so **the three example scores must be re-saved in the same step** (his word, 2026-09-30:
*"if the model change and it affects the examples we must update the examples"*):
`public/examples/gymnopedie.json`, `prelude-bwv846.json`, `syrinx.json`. No migration of old files
(the standing rule); a key signature's alterations change shape with them.

What his framing already settles, so it was not asked:

- The note stores the sign that is DRAWN: a quarter-sharp drawn Stein's way and one drawn with an
  arrow are two different signs; what each means is the tuning's business.
- Brackets, hidden and cautionary are separate from which sign it is.
- Key signatures use the notes' list of signs.
- A quarter-tone sign behaves in the bar as a sharp does: it holds to the barline, a natural cancels
  it. ✅ Sourced since: Gould p. 98 (§3b).

⛔ **And one rule he stated outright** when a shortcut of mine mixed them: *"accidental is one thing
and symbol another and they should not be mixed."* A symbol (`GlyphMark`, the Symbols window) is a
mark with no meaning; an accidental is part of the pitch. Nothing of the one is reused for the other.

⭐ **On sound, measured in the library's source, ⛔ not by ear**: WebAudioFont computes the sample's
playback rate from `100 × pitch` cents (`node_modules/webaudiofont/npm/src/player.ts:95-96`) and picks
its zone with `<=` comparisons, so a fractional pitch (60.5) should come out a quarter-tone up. Our
own `WebAudioFontInstrument` says *"fractional pitch is NOT supported here"* — that is our seam's
decision, not the library's limit.

## 7. Still open

- **From the literature** (§3b): the other ACCIDENTAL SYSTEMS (every pitch · only the note it
  precedes) as a per-score choice · inflections written ABOVE the note (numerals, cents, small
  arrows) — a different object, unmodelled · the LEGEND a score owes its reader · microtonal key
  signatures, which no manual read covers · Gould's preferred arrow signs, which are another family
  of rows the day they are wanted.
- ⚠️ **A sign has glyph VARIANTS** (Gould p. 96 draws two half-sharps, "or") — with the glyph name as
  the sign's id (next bullet) a variant is simply another sign; his to say if two drawings should
  ever count as one.
- **What a sign is CALLED in the file** — a SMuFL glyph name, or our own id with the glyph as a view
  (§3's fork). The plan takes the SMuFL name as its default and says so (§5 there); his to overrule.
- **Where a user-defined sign would live**, and where the order of §6-B lives once a sign's size
  really depends on the system (Sagittal, the arrows).
- **Transposition** over an open sign set — nobody has it; we have no transposition at all yet.
- **The Keypad's `.` key** (suppress cautionary accidental) has nothing to act on: we draw no
  automatic cautionary accidentals.
- From the reports' own UNKNOWN lists: what Dorico stores per note; Verovio's apparent swap of the
  quarter- and three-quarter-sharp in its sounding enum; Ekmelily (not on disk).
