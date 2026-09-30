# Alteration signs in the LITERATURE — Gould, Stone, Read, Karkoschka, and the systems themselves

> **Findings only.** ⛔ Nothing here is a decision. What was concluded from it, and what he decided,
> is `docs/research/alteration-signs-research.md`; the engines' source is
> `docs/research/alteration-signs-engines-research.md` and the standards and commercial programs
> `docs/research/alteration-signs-industry-research.md`.

**What this is:** the written SIGN beyond ♮ ♯ ♭ 𝄪 𝄫, as the engraving manuals and the notation
systems' own documents state it — which systems exist, what their signs are, how each sign relates to
pitch, and what conventions an engraving program must be able to express. Researched 2026-09-30.

⚠️ **Stopped early, at his request** — the pass was taking too long. What it was still chasing (what
Read 1990 says Ghent recommended for SPECIFIED quarter-tones) is marked UNKNOWN in §2.4, and §6 lists
every source that was not reached. ⛔ A gap here is not "the books are silent".

**How to read the source tags.** Every quotation carries how it was read:

- **[SCAN]** — the page was rendered from the PDF on disk (`pdftoppm`) and the wording read off the image.
- **[OCR]** — read from an OCR text layer only (dirty; wording may be off by a character).
- **[PDF-TEXT]** — a born-digital PDF's own text layer (clean, quotable).
- **[WEB]** — a web page fetched today (2026-09-30).
- **[GB-SNIPPET p. N]** — Google Books *search-within-volume* snippet, with the page number that API
  returned. `…` in a snippet is a real elision; nothing is quoted across one.
- **[IA-SNIPPET]** — archive.org full-text-search snippets, stitched by overlapping phrase queries
  (the route is described in §7). ⚠️ No page number comes back; where a page is given it was located
  separately through Google Books' page index for the same phrase. Hyphenation artefacts of the OCR
  (`nota- tion`) are silently closed.
- **[POINTER]** — Wikipedia / a wiki, used only to locate a fact; never the authority for a rule.

---

## 0. What was already in the repo (not redone)

- `docs/how-it-works/tuning-systems-and-alteration.md` — the project's position: `alter` is the
  WRITTEN accidental, a tuning system is a separate interpreter; MEI's `@accid` / `@accid.ges` split is
  the one that survives; widening `PitchAlter` to fractional semitones would be MusicXML's conflation.
- `docs/research/20c-notation-survey.md` §3 — a four-class taxonomy of microtonal systems (EDO fraction /
  conventional cent offset / JI off a just C major / JI off a Pythagorean chain), the Johnston-vs-HEJI
  7-comma clash, Sagittal's tuning-declaration requirement, HEJI v1→v2, what the FORMATS store.
- `docs/research/accidental-dot-research.md`, `accidental-dot-engines.md`, `accidental-ledger-clearance.md`
  — accidental gaps, column stacking, ledger clearance (12-EDO signs only).
- `docs/research/sibelius-keypad.md` §3c — Sibelius's quarter-tone keys (software; out of scope here).

⚠️ **Four corrections to `20c-notation-survey.md` §3 that this pass turned up** (✅ applied to that
doc the same day, each as a dated note beside the sentence it corrects):

1. It says *"Unicode L2/23-276 states it outright: 'In every case, an arrow requires explanation…'"*.
   The sentence is in L2/23-276, but it is **a forum post the proposal quotes** (Steinberg forum user
   "cpower", cited as *Anon. 2020*), not the proposal authors' own statement. [PDF-TEXT]
2. It says SMuFL glosses the range as *"Stein-Zimmermann (also known as Tartini-Couper)"*. **Not found**
   in SMuFL 1.4's `ranges.json` (description: *"Stein-Zimmermann accidentals (24-EDO)"*) nor on the
   range's page at `smufl.formats.music/latest/tables/` fetched today. Unverified.
3. The Tartini attribution is itself contested in the literature: Stone p. 68 says the sharps were
   *"first proposed in 1756 by Giuseppe Tartini"* [SCAN]; Read 1990 says *"proposed in 1754 by Giuseppi
   Tartini"* [IA-SNIPPET, pp. 19–20]; Secor & Keenan say multiple vertical strokes are *"frequently – and
   mistakenly! – attributed to Giuseppe Tartini, but) first used by Richard Stein"* (Sagittal paper p. 2)
   [PDF-TEXT].
4. The "contradiction between SMuFL and Secor–Keenan over the Sims arrow pair" is addressed by the
   Sagittal paper itself (p. 22): the clash is between *"the virtually identical Sagittal 5-comma symbol
   pair (for 1º72) and the Sims symbol pair for 2º72"* — two systems using look-alike arrows for
   different step counts, not two accounts of Sims. [PDF-TEXT]

---

## 1. Gould, *Behind Bars* (Faber, 2011) — read from the scan on disk

PDF page = printed page + 20. Pages rendered and read: **78, 79, 80, 81, 83, 86, 87, 94, 95, 96, 97,
98, 247, 504**. The *Microtones* section is printed **pp. 94–98** (index: `MICROTONES 94–8`, `quarter-tones
94–6, 97`).

### 1.1 The framing sentence (p. 94) [SCAN]

> "No pitches other than the twelve chromatic degrees of the octave have standard notation. Symbols for
> any other pitches require a written definition. Arrows are a very convenient and logical symbol to
> show the raising and lowering of pitch."

> "Either arrows or fixed symbols (see p. 96) are used to define quarter-tones (hereafter ¼-tones)."

### 1.2 Arrows — her recommendation (pp. 94–96) [SCAN]

> "An arrow can be attached to any accidental, or precede a note or accidental, pointing in the
> direction of the pitch modification. This is visually the most helpful symbol since it requires no
> memorizing.
> The recommended symbol is an arrow attached to an accidental. Ensure that the arrowhead is
> sufficiently large to be visible on the stave. It is most convenient to attach the arrowhead to the
> sharp-sign verticals that project furthest from the centre of the symbol:" (p. 94)

DRAWN under it (p. 94): three pairs — flat with up-arrow / flat with down-arrow; natural with up-arrow /
natural with down-arrow; sharp with up-arrow / sharp with down-arrow. The arrowhead sits ON a vertical
stroke of the accidental (flat: on its stem; natural: on the projecting vertical; sharp: up-arrow on the
right vertical's top, down-arrow on the left vertical's bottom). ⇒ **the arrowed natural is a sign in
its own right** — a natural is not only a canceller here.

> "An arrow alone without an accidental may represent a pitch alteration (see first example below).
> However, when a conventional accidental precedes the microtone for the same pitch in the bar, an
> accidental must confirm or cancel the altered microtonal pitch:" (p. 95)

DRAWN (p. 95): (a) a bass-clef bar in which BARE arrows stand before notes that have had no conventional
accidental, and a plain ♮ restores one of them; "and" (b) C♯ then sharp-with-down-arrow C, captioned *"second pitch is C ¼-tone sharp"*; "or" (c)
C♯ then natural-with-down-arrow C, captioned *"second pitch is C ¼-tone flat"*; **"but not"** (d) C♯ then
a BARE down-arrow C. ⇒ a bare arrow after a conventional accidental on that pitch in the bar is
ambiguous and rejected.

> "**Arrows defining all quarter-tones** ↑ = sharpen by a ¼-tone ↓ = flatten by a ¼-tone
> Arrows can be attached to any accidental. This has the advantage of making all enharmonic equivalents
> available.
> The following example shows enharmonic equivalents for each ¼-tone pitch:" (p. 95)

DRAWN: *"C ¼-tone sharp"* = C with natural-arrow-up = C with sharp-arrow-down = D with flat-arrow-down
(three spellings of one 24-EDO pitch); *"D ¼-tone flat"* likewise three spellings.

> "Thus ↑ can always be used in a sharpening context, ↓ always in a flattening context:" … "stepwise
> sharpening: use upward arrows / and not downward arrows" … "stepwise flattening: use downward arrows /
> and not upward arrows" … "The correct enharmonic equivalents make reading much easier:" … "(See also
> *Note-spelling*, p. 85.)" (p. 95)

> "There can be confusion as to whether an arrow defines an accidental as a ¼-tone or ¾-tone sharp or
> flat. The arrow modifies the given accidental by a ¼-tone in the direction of the arrow:" (p. 96)

DRAWN (p. 96): G with sharp-arrow-up = *"a ¼-tone sharper than G♯, not G ¼-tone sharp, which would
be"* G with natural-arrow-up; B with flat-arrow-down = *"a ¼-tone flatter than B♭, not B ¼-tone flat,
which would be"* B with natural-arrow-down.

⇒ **Three-quarter tones in her arrow system are composites by construction**: ¾ sharp = ♯ + ↑, ¾ flat =
♭ + ↓. There is no separate ¾ sign; the arrow is an operator on the conventional sign.

### 1.3 "Fixed symbols" — Stein–Zimmermann (p. 96) [SCAN]

> "**Using fixed symbols** The following are 'fixed symbols' in that they cannot modify a conventional
> accidental – as arrows can. They are useful to define ¼-tones should arrows be used to define another
> microtone in the same piece (see *Other microtones*, below).
> The most commonly used symbols are:"

DRAWN table: **¼-tone sharp** = one-vertical sharp, in two variants (one crossbar "or" two crossbars);
**¾-tone sharp** = three-vertical sharp; **¼-tone flat** = reversed flat; **¾-tone flat** = reversed
flat joined to a flat.

> "The sharp symbols are especially easy to memorize as they look exactly like the degrees of sharpening
> that they represent. Signs used for a ¼-tone flat that should be avoided are: [four drawn flat-derived
> signs — a slashed/open flat and its doubled form, a filled flat and its doubled form] since these
> symbols are too similar to the flat sign. It is recommended that all four of the above fixed symbols
> are used (rather than exclusively sharp symbols, for instance) so that sharp symbols can be used in
> 'sharpening' contexts and flat symbols in 'flattening' ones."

⇒ Her vocabulary is exact and useful: an accidental is either an **operator** (the arrow, which
modifies another accidental) or a **fixed symbol** (which cannot).

### 1.4 Other microtones (pp. 96–97) [SCAN]

> "Since there are no standard symbols, individual ones must be created for microtones other than
> ¼-tones.
> The best symbols are those designed to be placed in front of a pitch, as this is the conventional
> position for accidentals – and not above the note. (Numerals to define microtones placed above the
> stave can look like fingering, and arrows above a stave appear to indicate playing direction of
> arpeggiated chords for stringed instruments.)
> The most successful symbols are modified conventional accidentals, since such signs are immediately
> recognizable as pitch adjustment. Use arrows in the first instance (see *Arrow definition*,
> opposite)." (p. 96)

> "Symbols should be as compact as possible. The further the symbol is from the note, the more difficult
> the pitch is to read. Wide symbols force short durations apart, which is unhelpful:" (p. 97)

DRAWN: a beamed group with arrow-ATTACHED sharps "rather than" the same with detached `+` signs
between accidental and note. Then:

> "(In this example, ↑ and + might be defined as, say, 'raise pitch by a sixth of a tone', double symbols
> as 'raise pitch by a third of a tone'.)
> Where possible, symbols should be attached to an accidental. Otherwise they may precede or supersede
> an accidental (but always in front of the note).
> Make symbols as simple as possible so that they are legible on the stave. They should be easily
> distinguishable from other accidentals and from each other. For example, in *Medea-senecae*, the
> ⅓-tone symbols that Xenakis uses: [sign] = ⅓-tone higher, [sign] = ⅔-tone higher, contrast well with
> the ¼-tone notation [one-vertical sharp] and [three-vertical sharp] (¾-tone)." (p. 97)

(A three-system Xenakis *Medea-senecae* cello extract follows — the only real-score plate in the
section; it mixes the ⅓/⅔ signs, Stein sharps, and ordinary ♭ ♮ ♯.)

> "**Arrow definition** An arrow may be used to notate microtones other than the ¼-tone. The pitch
> modification of the arrow must always be defined. Arrows will represent one of the following
> definitions:
> • Modify the pitch by a single given interval (e.g. of ⅓-, ⅕-, ⅙-tone, etc.)
> • Modify the pitch within a given interval (e.g. by up to ¼-tone; between ⅛ and ¼-tone)
> • Modify the pitch slightly
> Arrows should have one meaning only in a piece. Introduce a second symbol if there are two different
> divisions of the tone (e.g. ⅓- and ¼-tones)." (p. 97)

⇒ This is the strongest single statement in the manuals that **the arrow's value is a per-piece
definition** — and that the value may be a fixed step, a RANGE, or deliberately vague.

### 1.5 Cancelling (p. 98) [SCAN]

> "**Cancelling microtonal alteration** If using conventional accidental practice, an ordinary
> accidental must cancel a microtone (the second and fourth notes in the second example remain
> microtonally altered):"

DRAWN: (1) four notes on one pitch: natural-arrow-down, plain ♮, natural-arrow-up, plain ♮; (2) the same
four with only the 1st and 3rd carrying signs — so notes 2 and 4 stay altered.

⇒ (a) Under conventional practice a microtonal accidental **holds for the bar** exactly like an
ordinary one. (b) What cancels it is an **ordinary** accidental (♮, or ♯/♭ as the case is). (c) The
sentence is conditional — *"If using conventional accidental practice"* — i.e. the duration rule is a
choice of the score (§1.7).

### 1.6 What Gould does NOT say (checked, not skipped)

- **Microtonal accidentals in key signatures: nothing.** *Key signatures* is pp. 91–94; p. 94 (read)
  has *Unconventional key signatures* — *"Any sharp or flat may be selected as a key signature to alter
  all octaves of the selected pitches"* (*"Bartók uses many unconventional key signatures in the
  Mikrokosmos piano pieces"*), and *"An instrument on two (or more) staves can take an individual key
  signature for each stave"* — and the word *microtone* does not occur in pp. 91–94 (OCR grep + p. 94
  scan). The index has no such entry.
- **Spacing or stacking of microtonal accidentals in chords: nothing specific.** Only p. 97's *"as
  compact as possible … Wide symbols force short durations apart"*. *Arranging accidentals for chords*
  (p. 87 ff.) speaks of sharps, naturals and flats only.
- **Tartini / Stein / Zimmermann by name: not named** in pp. 94–98; she calls them "fixed symbols".
- **Eighth-tones, JI, EDO systems, non-Western accidentals: not covered.**

### 1.7 The accidental conventions she does state [SCAN]

- p. 78: *"An accidental holds good for the duration of a bar. It applies only to the pitch at which it
  is written: each additional octave requires a further accidental."* · *"An accidental holds good only
  in the clef in which it is written."* · p. 79: *"An accidental holds good only for the stave in which
  it is written."*
- **p. 81, *Cancelling accidentals — Double flats and double sharps*:** *"When a double flat is
  cancelled by a single flat, and a double sharp by a single sharp, the traditional practice of placing
  a natural sign before these is redundant, since a single flat or sharp sign cannot mean anything
  else:"* — DRAWN as "traditional practice" (𝄫 → ♮♭, 𝄪 → ♮♯) vs "contemporary practice" (𝄫 → ♭, 𝄪 → ♯).
- p. 83: *"When highly chromatic music requires many cautionary accidentals to be used, it is always
  helpful to explain the accidental practice in the preface: e.g. 'accidentals apply through the bar,
  but are repeated for ease of reading'. Otherwise performers may query whether an accidental applies
  only to the note it precedes (see Accidental systems, p. 86)."* Same page, two more POSITIONS for an
  accidental: *"where horizontal space is limited, to place cautionary (but not essential) accidentals
  directly above their notes"* (drawn), and *"Editorial additions may, alternatively, be given as
  small-sized accidentals above their notes"*; *"On a chord, each accidental takes a separate pair of
  brackets."*
- **p. 86, *Accidental systems*:** *"The traditional system of accidental use … has been considered
  inadequate in certain contexts and replaced accordingly. In densely chromatic idioms, unbarred and
  unmetred music, a reader might well expect an unconventional accidental system to be implemented. To
  avoid ambiguity in such cases it is a good idea to state in a preface when using traditional
  practice, e.g. 'accidentals hold good throughout the bar'."* Then the alternatives:
  **"An accidental to every pitch"** (Second Viennese School; *"music so dense with accidentals looks
  forbiddingly difficult"*) and **"An accidental applies only to the note it precedes"** — *"Adopt this
  system only when there is sufficient time for performers to learn the music in advance … This system
  uses only sharp and flat signs, if strictly implemented, since a note without an accidental is a
  'natural' pitch. … It is advisable, however, to add a natural sign (if applicable) for an altered
  immediately repeated note, for safety"*; and a **modified** form: *"an accidental applies only to the
  note it precedes except in the case of an immediately repeated note or pattern of pitches, and notes
  joined by a beam."*
- p. 87: *"It is absolutely essential that an unconventional system is used consistently."* · *Music
  without barlines*: *"use an accidental to apply to the note it precedes, to an immediately repeated
  note and within a beamed group."*
- **p. 504, front matter — *Notation conventions*:** *"Explain any special notation, including: •
  non-standard symbols • unconventional accidental systems (see Accidental systems, p. 86) • symbols
  used for microtonal accidentals (see Microtones, p. 94) • special tunings …"* and *"Do not assume that
  the musicians will be familiar with any (even slightly) unconventional notation. Although they may be
  conversant with the following symbols, they need to know that their interpretation agrees with the
  composer's intentions:"* — and one of the three symbols DRAWN under that sentence is **a note with an
  arrowed flat**.
- p. 247 (*Woodwind and brass — Microtones*): *"in general, it is best to spell microtones according to
  the musical context. If it is the case that the player must bend a pitch up or down to achieve the
  required microtone, notate the microtone according to how the player will approach it. For example,
  where a pitch must be flattened, notate the microtone with a downward arrow from the semitonal
  pitch"*.
- Other mentions [OCR only — pages not rendered, wording not checked against the scan]: brass,
  harmonic-series notes — *"Microtonal accidentals may be used, to indicate the tuning of harmonics that
  differ from equal temperament … although these are for the benefit of the score reader and are not
  required by the player"*; harp scordatura (running head p. 369) — *"Microtonal accidentals should
  precede the string pitch in a score. They are helpful in a part although not strictly necessary"*;
  guitar scordatura — *"it is unnecessary to include the resultant microtones once the unconventional
  tuning has been indicated, provided that the scordatura string is always labelled"*; strings, natural
  harmonics — *"it is unnecessary to indicate microtone accidentals for them"*. ⇒ in these cases the
  TUNING is declared once and the written notes carry no microtonal sign at all.

---

## 2. The other manuals

### 2.1 Kurt Stone, *Music Notation in the Twentieth Century* (Norton, 1980) — scan on disk

The PDF is 2-up: PDF n = printed 2n−22 / 2n−21. Rendered and read: PDF 37, 38, 39, 44, 45, 46, 65 =
printed **52–57, 66–71, 108–109**. *Microtones* is printed **pp. 67–71**.

What the book's authority is [OCR, preface]: *"All new notational devices and procedures endorsed or
recommended by the Ghent Conference are included in the present volume, along with many others which
could not be discussed in Ghent, but were dealt with subsequently in consultation with professional
musicians in the U.S."* ⇒ ⛔ **which of his microtone recommendations are the Conference's and which are
his own is UNKNOWN** from the book (the Conference Report, *Interface* 4/1, 1975, was not reached).

**p. 67 [SCAN]** — *"Quarter tones are used in different ways. They may be ornamental inflections of a
given pitch; part of a quarter-tone scale or other set of pitches that includes quarter tones; one of a
number of microtonal divisions, such as sixth, quarter, and third tones. Because of this diversity, some
quarter-tone notations may be more appropriate than others, depending on the musical and notational
contexts in which they occur."*

*"2. Arrowed accidentals for ornamental inflections, scales, and other sets of pitches"* — DRAWN: an
ascending scale with arrow-attached sharps, a descending one with arrow-attached flats, and *"Quarter-tone
naturals:"* (natural with up-arrow, natural with down-arrow). *"This system shows that there are two or
more ways in which a quarter-tone pitch can be notated … similar to the enharmonics of traditional
notation"*. *"The choice of the most appropriate accidentals depends on the kind of music in question
and the harmonic context (if any) in which the pitches occur. Thus, in music based on any kind of tonal
relationships, the up and down directions from tone to tone—the tonal gravity—should be reflected in the
'grammar' of the notation"*.

**p. 68 [SCAN]** — *"it must be remembered that string players tend to differentiate between sharps and
flats (F-sharp versus G-flat, for example) and that wind players, too, often use different fingerings
for similar differentiations, even in atonal music."*

*"3. Other quarter-tone accidentals — Among the many quarter-tone accidentals invented over the years
there is none with identical alterations for both sharps and flats except the arrow system shown above.
Nor is any system quite as self-explanatory. But since the approach to the use of microtones—whether as
structural components (scale steps) with or without tonal implications, or as ornamental 'bendings'—is
still in flux, it seems somewhat premature to propose notational standard procedures at this time
without at least providing a glance at a few alternatives for structural quarter tones. … Thus, among
the signs for quarter-tone sharps, the oldest and actually most convincing are those first proposed in
1756 by Giuseppe Tartini: [one-, two-, three-vertical sharps, the first captioned (¼), the third (¾)]"*.
*"The advantage of such notation is that it is easier to write and read than the arrowed accidentals.
Its disadvantage is that it lacks quarter and three-quarter flats."*

**p. 69 [SCAN]** — *"As for quarter-tone flats, no method comparable in practicality and explicitness to
either the arrows or the Tartini system has evolved so far, although there is no dearth of inventions.
… None of these flats conveys as clearly as the Tartini sharps whether it lowers the pitch by one or by
three quarters. Besides, the first three flats can easily be mistaken for carelessly written regular
ones … There is, however, one practical quarter-tone flat—a regular flat written backward—which is not
likely to be mistaken. It has not been included above because it is part of a system which functions
well and which, in fact, has already attained near standard status in atonal music for woodwinds. This
system uses Tartini's one-quarter sharp and the backward one-quarter flat just mentioned. Unfortunately,
it does not include three-quarter sharps or flats because its quarter-tone accidentals can be used only
on natural pitches (white keys). Thus a certain amount of enharmonic manipulating is necessary.
Nevertheless, the system is highly recommended where appropriate, i.e., in a strictly nontonal context.
The enharmonics function as follows: a ¾-sharp C must be notated as a ¼-flat D; a ¾-flat D must be
notated as a ¼-sharp C"*.

**p. 70 [SCAN]** — *"B. Exact Pitches: Other Microtones — 1. Microtone numerals. A microtonal pitch
other than a quarter tone should be notated with small numerals, with arrows at the top or bottom to
show the direction of the microtone from the written pitch: [3 with up-arrow] = one-third tone higher
than the written pitch; [6 with down-arrow] = one-sixth tone lower than the written pitch; etc. The
numerals should be placed above rather than in front of the notes. If double or triple stops occur,
such as in string instruments, one numeral applies to both or all three notes. If, however, different
microtonal alterations are desired for such simultaneous notes, the respective numerals should be
placed above one another in corresponding order … In cases where altered and unaltered notes are mixed,
double stemming should be employed and the numerals placed at the stem-end of the note(s) to be
altered"*.

*"2. Quarter-tone numerals. If quarter tones occur along with other microtones in a given composition,
it is essential to notate all micro alterations according to the same system, i.e., to use the
microtonal numerals for the quarter tones also"*.

*"N.B.: Never use more than one system of notation in any one composition, or, at least, in any one
movement. Also, no matter which system is used, it must be explained at the beginning of the composition
or movement, and not only in the score, but in the parts (if any) as well."*

*"C. Approximate Pitches — 1. Constant pitches. Slightly higher or lower than the note"* — DRAWN as a
small arrow ABOVE the note; p. 71: *"N.B.: The arrows must be quite small and thin so that they will not
be confused with the larger, heavier arrows used for other purposes"*.

**p. 76 [OCR]** — *Microtonal trills*: *"A microtonal accidental must be placed in front of the main
note, or above the [tr] of the trill sign, or in front of the parenthetical trill note-head, depending
on the desired pitches"*.

**pp. 54–56 [SCAN]** — *"C. Double Sharps and Double Flats. A single natural suffices to cancel a double
accidental. If a double sharp or flat is to be reduced to a single sharp or flat, no natural is needed,
only the single accidental"* (p. 54, with a drawn *(not ♮♭)* / *(not ♮♯)*). · *"H. Note-for-Note
Accidentals. The discussion of accidentals should not be concluded without mentioning one radically
different trend which is gaining prominence and may eventually win out over the system explained above.
This trend reduces accidentals to a minimum. Its basic rules are: 1. Accidentals affect only those notes
which they immediately precede. 2. Accidentals are not repeated on tied notes unless the tie goes from
line to line or page to page. 3. Accidentals are not repeated for repeated notes unless one or more
different pitches intervene. 4. If a sharp or flat pitch is followed directly by its natural form, a
natural is used … 5. Cautionary accidentals or naturals (in parentheses) may be used to clarify
ambiguities, but should be held to a minimum."* (pp. 55–56). · **p. 53 [SCAN]** *"Although traditionally
the barline at the end of a measure automatically cancels all non–key-signature accidentals (except for
tied notes), in more recent music, accidentals not canceled in their own measure are usually canceled in
the measure following"* · *"Accidentals should not only be canceled for notes on identical pitch levels,
but for the entire pitch class (i.e., at any octave level)"* · *"In multistaff notation for a single
player … the staves should not be treated separately, as was formerly customary. Accidentals should be
canceled regardless of the staff in which they occur"*. (These are rules about writing the cancelling
NATURAL generously; p. 54 shows an accidental still belongs to its own octave.)

**p. 108 [SCAN]** — *"Notational ingenuity and daring are all very well, but with the possible exception
of implicit graphics, notation must never be confused with the musical substance as such."* · *"Even
microtones can be indicated quite satisfactorily with the help of a few modified traditional accidentals
or with 'bent' horizontal lines and the like."* · p. 109: *"The multitude of duplications and/or
ambiguities among the new signs and symbols, no matter in which system they occur, is impractical and
confusing and should be reduced as much as possible."*

### 2.2 Gould vs Stone — where they agree and where they flatly disagree

| question | Stone 1980 | Gould 2011 |
|---|---|---|
| quarter-tones, first choice | arrowed accidentals (*"none … quite as self-explanatory"*) | arrow attached to an accidental (*"the recommended symbol"*) — **agree** |
| Stein/Tartini sharps | *"oldest and actually most convincing"* | *"especially easy to memorize"* — **agree** |
| reversed flat | the one *"practical quarter-tone flat"* | in her "most commonly used" table — **agree** |
| ¾ flat | none accepted; his recommended set has NO ¾ signs (enharmonic respelling instead) | reversed-flat + flat, and *"all four … fixed symbols"* recommended — **disagree** |
| microtones other than ¼ | **numerals with arrows, ABOVE the note** (*"above rather than in front"*) | **in front of the note, NOT above** (*"numerals … above the stave can look like fingering"*) — 🚨 **direct contradiction** |
| scope of one sign | a numeral above may apply to a whole chord | each sign precedes its note |
| one system per piece | *"Never use more than one system of notation in any one composition"* (said of numerals vs signs) | two sign families in one piece is what fixed symbols are FOR (*"should arrows be used to define another microtone in the same piece"*) — **differ in emphasis** |
| legend | *"must be explained at the beginning … in the parts … as well"* | *"require a written definition"* — **agree** |
| standard status | *"somewhat premature to propose notational standard procedures"* | *"No pitches other than the twelve … have standard notation"* — **agree** |

### 2.3 Gardner Read, *Music Notation: A Manual of Modern Practice* (2nd ed., 1969)

⛔ Not on disk. Reached only through snippets. *Quarter-Tones* is pp. 145–146 (ch. 9, *Accidentals and
Key Signatures*), with a *Table of Quarter-Tone Symbols* (Example 9-43).

- [GB-SNIPPET p. 145] *"Contemporary composers have done considerable experimenting with microtonal
  music, based on the division of the octave into quarter-tones rather than the conventional
  half-steps."* · *"… necessary to invent symbols to indicate microtones. The necessity is even more
  acute now that the woodwind and brass instruments are required by avant-garde composers to produce
  various microtonal intervals (see Example 20-21)"*.
- [IA-SNIPPET + GB-SNIPPET p. 146, stitched at the page turn] *"Rather than create an entirely new set
  of symbols for the 24 quarter-tones of the octave, most of the composers using these microtones have
  continued to employ traditional flats and sharps, but with modified forms and new auxiliary signs
  placed before conventional note-heads. A few of these are shown in the Table of Quarter-Tone
  Symbols."* The table's rows (from snippets) are *"sharped note to be played a quarter-tone high / low"*,
  *"flatted note to be played a quarter-tone high / low"*, *"natural note to be played a quarter-tone
  high / low"* — i.e. the arrowed-accidental scheme (at least these six rows; the table itself was not
  seen).
- [GB-SNIPPET p. 146] *"As the German term for quarter-tones is Zwischentöne (literally,
  'between-tones'), Berg placed a large letter Z on the stem of each note to be so played"* · *"Should
  quarter-tone music become more generally adopted, a stabilized notation will doubtless follow."*
- [GB-SNIPPET p. 393] *"… illustrated notations for quarter-tones is used, a brief footnote of
  explanation would be in order."*

### 2.4 Gardner Read, *20th-Century Microtonal Notation* (Greenwood, 1990) — the survey

⛔ Not on disk; archive.org's copy is lending-only (`/download/` 401, search-inside "Item not
available"). Reached through archive.org's full-text SEARCH (snippets) with pages located via Google
Books. What came back:

- **His stance** [IA-SNIPPET; p. 3 per GB]: *"… philosopher Spinoza's oft-quoted remark: 'None do I praise
  or condemn, I merely study.' But praise and condemnation are both concomitant parts of any profitable
  examination of microtonal notation in our century, for which no apology is required. The lack of an
  essential consensus on a suitable, standardized notation for the different microtones that are
  acoustically possible, especially when combined with the conventional chromatics in clear tonal
  contexts …"* — ⚠️ so Read does **not** claim pure neutrality (Polansky's "investigator" reading,
  quoted in the repo's survey, is a reviewer's gloss).
- **The field's constant** [IA-SNIPPET; p. 9]: *"… microtones are based on the conventional accidentals,
  as will be evident in the many examples detailed in each chapter. Our problem, then, is not so much to
  manage the anachronism of microtonal symbology on the traditional staff as it is to reach an essential
  consensus on the clearest and most logical sign for each degree of microtonal division of the half and
  whole step when used as a momentary embellishment."*
- **His classification of quarter-tone signs** [IA-SNIPPET; p. 17]: *"Current quarter-tone symbology is
  divided into four methods of construction: (1) modifications of the traditional accidentals, with or
  without appended arrow signs, (2) auxiliary numerals specifying the microtonal inflection desired, (3)
  shaped noteheads to distinguish one microtone from another, (4) abstract signs related to standard
  noteheads or to accompanying accidentals."* And the example categories [IA-SNIPPET]: *"1) Notations
  based on modified accidentals, mainly sharps and flats. 2) Arrows attached to the standard accidentals,
  including naturals. 3) Arrow-signs placed before, after, over, or under the noteheads or the
  accidentals"* (the list continues to eight; the rest was not retrieved).
- **On arrows** [IA-SNIPPET]: *"The reliance on arrow-signs is twofold in contemporary microtonal scores:
  First, when attached to the standard natural, sharp, and flat, and second, when placed in proximity to
  notehead, note-stem …"* · *"Of these three last categories, the first is by far the one most preferred
  by today's composers of microtonal music. It would appear that the use of additional arrow-signs or
  other auxiliary markings is not ordinarily condoned by the majority of these notators"*.
- **On the Stein signs** [IA-SNIPPET; pp. 19–20] (⚠️ which pair "the latter two" points at cannot be
  told from the snippet — the glyphs are OCR noise): *"(semi-sharp) and (sesqui-sharp), (semi-flat) and
  (sesqui-flat). Actually, the latter two signs were not new, as both were proposed in 1754 by Giuseppi
  Tartini. In our own time they have become staples in the notation of many microtonalists, sometimes as
  three-quarter-tone indicators …"*
- **On Ghent 1974** [IA-SNIPPET; p. 20]: *"For unspecified microtones, their size spontaneously chosen by
  the player or singer at the time of performance, the conference members recommended using only small
  arrow-signs set above the noteheads in question (see Example 5:39-13)."* Also p. 20: *"… Conference on New
  Musical Notation, convening in Ghent, Belgium, in the fall of 1974, issued its own recommendations;"* —
  ⛔ the text after that semicolon (what was recommended for SPECIFIED quarter-tones) was **not
  retrieved: UNKNOWN**.
- **Ghent on figures, and what practice did with it** [IA-SNIPPET; p. 80 per GB]: *"… International
  Conference on New Musical Notation (Ghent, 1974). The conference members did suggest, however, placing
  the figures over the noteheads in question rather than in conjunction with the various accidentals."*
  [IA-SNIPPET; pp. 104–105 per GB]: *"… yet require considerable vertical space over the staff (Example
  3:17-11). It is significant that in spite of these endorsements made by the notational authorities at
  the Ghent conclave, very few composers have since adopted these recommended signs or the manner in
  which they are used. Instead, the majority have continued to place their signs in front …"* (snippet
  ends). ⇒ Stone's numerals-above-the-note (p. 70) IS the Ghent line, and Read (1990) reports that
  composers did not follow it — which is where Gould (2011, p. 96) lands. ⚠️ Stitched snippets; the
  surrounding paragraphs were not read.
- ⛔ Whether Read discusses cancellation or key signatures: two searches (`"cancel"`, `"key signature"`)
  returned no hits in the full-text index. That is a negative from a search index over OCR, **not** a
  reading of the book: **UNKNOWN**.

### 2.5 Erhard Karkoschka, *Notation in New Music* (1966; tr. Koenig 1972)

⛔ Not on disk; archive.org lending-only. [GB-SNIPPET]s:

- p. 2: *"Familiar examples of extension are the signs for quarter-tones and sixth tones as proposed by
  Alois Hába more than two generations ago, and which are still used today in varied forms"* — followed
  by Hába's tables (quarter-tones; sixth-tones; p. 3 twelfth-tones 1/12 … 11/12).
- p. 2, on why Hába's finer divisions drop the sharp/flat distinction: *"… every division of the
  whole-tone into more than two chromatic values must proceed from such a very exact temperament that
  enharmonic equivalents differing by the value of a comma no longer apply. This renders the difference
  between sharpening and flattening meaningless. The logical consequence of this is that absolutely all
  accidentals are meaningless in this …"* (snippet ends).
- p. 25 (*Micro-intervals*, under Kagel's *Sexteto de cuerdas* — arrowed accidentals): *"This way of
  notating quarter-tones is especially convenient, as it embraces all accidentals (including the
  natural), and represents the procedure in an illustrative way."*
- p. 27 (Kopelent, *Third String Quartet*): *"[The] symbol for flattening the pitch is inconvenient, as
  it is not clearly differentiated from the normal ♭. It does not occur anywhere in the score, only in
  the explanation"*. Also p. 27: *"… symbols can also be generally recommended for traditional music
  (compare ZIMMERMANN: Présence)"* (the subject of that sentence is outside the snippet).
- The book catalogues per-score sign tables (Bussotti *Siciliano*, *Phrase à trois*; Kagel; Penderecki
  *Anaklasis*; Kopelent; Zimmermann *Présence*; Evangelisti) — each with its own legend.

⇒ Karkoschka (1966) agrees with Stone (1980) and Gould (2011) on the arrowed accidental, and for the
same reason: it works on all three of ♯ ♮ ♭.

### 2.6 Ross, Gerou & Lusk, MOLA, Chlapik

- **Ted Ross, *The Art of Music Engraving and Processing*** (on disk): **no mention** — the clean OCR text
  has zero hits for *microton-*, *quarter-tone*, *quarter tone*. He names five accidentals (sharp, flat,
  natural, double flat, double sharp). (Searched the text layer; pages not read.)
- **Gerou & Lusk, *Essential Dictionary of Music Notation*** (on disk): **no mention** of microtones
  (zero hits). But **p. 4 [SCAN]** states the conventional premise every composite system breaks:
  *"ONE ACCIDENTAL PER NOTE — Do not use multiple accidentals on one note. (A double-flat is a single
  accidental.)"* · *"The lowest a note can be lowered is a 𝄫. The highest a note can be raised is a 𝄪."* ·
  *"Any accidental is cancelled when a new accidental appears on the like pitch."* · *"Notice that only
  the flat (not ♮♭) is needed to change from a double-flat to a flat."*
- **MOLA, *Guidelines for Music Preparation*** (current PDF fetched, whole text extracted, 17.8 KB):
  **nothing** on microtones; the word *accidental* occurs once (*"horns, tuned percussion, and timpani
  use any required accidentals rather than a key signature"*).
- **Chlapik, *Die Praxis des Notengraphikers*** — ⛔ **UNKNOWN** (no digital copy known; per
  `reference/README.md`).
- **Boosey & Hawkes house manual** — ⛔ **UNKNOWN**.

### 2.7 Do the manuals agree?

Yes on four things, across 45 years (Karkoschka 1966 → Read 1969 → Stone 1980 → Read 1990 → Gould 2011):
(1) there is **no standard**; (2) the accepted family is **modified conventional accidentals placed
before the note**; (3) the **arrow attached to ♯ ♮ ♭** is the most self-explanatory quarter-tone device;
(4) whatever is used **must be explained in the score**. They disagree on the ¾-flat, on numerals above
the note, and on mixing systems in one piece (§2.2). ⚠️ And current PRACTICE has moved past Gould: the
Unicode proposal L2/23-276 (2023) calls the Stein–Zimmermann set *"the most common standard in music
notation for quarter-tone accidentals"* and notes that *"The basic accidentals with arrows were
historically used for quarter tones but are now generally used for even smaller intervals"*; arrows on
both basic and Stein–Zimmermann signs are *"'becoming the norm' for eighth-tones (Greffin-Klein n.d.),
although it is not unknown to use them for twelfth-tones instead (Chahin 2017). When used for
eighth-tones, this creates a degree of redundancy: a half-sharp with an up-arrow, for example, is
equivalent to a normal sharp with a down-arrow. There is no redundancy however when arrows indicate
twelfth-tones."* [PDF-TEXT]

---

## 3. The systems

Columns asked for: (a) inventory, (b) one sign per note or a combination, (c) what a sign means in
pitch, (d) fixed meaning or dependent on a declared tuning.

### 3.1 Quarter-tone and other equal-division signs

**Stein–Zimmermann** — sources: Gould p. 96 [SCAN]; Stone pp. 68–69 [SCAN]; Unicode L2/23-276
[PDF-TEXT]; SMuFL 1.4 `steinZimmermannAccidentals24Edo` U+E280–E285 [WEB]; Sagittal paper p. 3 n. 5.
(a) half sharp, sharp-and-a-half, reversed flat, reversed-flat-and-flat (+ SMuFL "narrow" variants;
Gould's two half-sharp variants). Attribution (Sagittal paper n. 5, citing Read 1990): *"Stein, Richard
H., 1909, Zwei Konzertstücke, cello & piano, op. 26 … Stein's own sesquiflat symbol confusingly
consisted of two of his semiflat symbols (the backwards flats) and so has been replaced with the more
logical combination of backwards and forwards flats due to Bernd Alois Zimmerman (1961)."*
(b) ONE sign per note. Unicode: the ¾-flat is *"treated as an atomic character, just like the
double-flat would be"*; *"it sometimes appears with its component parts disconnected … and sometimes
with them connected (i.e. sharing a stem)"*. (c) ±¼ / ±¾ tone — 24-EDO steps, by convention.
(d) ⚠️ **Not fixed across systems**: the same glyphs are the 11-limit quartertone 33/32 (≈53.3 ¢) in HEJI
(§3.2), one *koma* in Turkish AEU (§3.3), a substitute for Sagittal's 11-diesis; and with arrows added
they extend to eighth- or twelfth-tones ("Extended Stein-Zimmermann", SMuFL U+E290–E29C).

**Tartini–Couper** — sources: Stone p. 68 (Tartini sharps, three signs: ¼, ½, ¾) [SCAN]; Sagittal paper
p. 5 (Couper); SMuFL `accidentalThreeQuarterTonesFlatTartini`, `…FlatCouper` in "Other accidentals".
(b) one sign per note; (c) 24-EDO. Couper's contribution per Secor & Keenan: *"Mildred Couper's merging
of two laterally mirrored 'stemmed' symbols to create a third symbol representing the combined
alteration of the first two"* — *"a backwards-flat semi-flat symbol (representing a quartertone, 1º24)
is merged with a conventional flat symbol (representing a semitone, 2º24) to produce a sesqui-flat
(3º24) symbol."* ⛔ Tartini's and Couper's own texts: not read — **UNKNOWN** beyond these reports.

**Arrow accidentals ("Gould arrow quartertone", SMuFL U+E270–E27B)** — Gould pp. 94–96, Stone p. 67,
Karkoschka p. 25, Read 1969 table. (a) ♭ ♮ ♯ (and 𝄫 𝄪) each with ↑ or ↓, plus the bare ↑ ↓. SMuFL names
them by resulting pitch: *"Quarter-tone flat"* (flat-arrow-up), *"Three-quarter-tones flat"*
(flat-arrow-down), *"Five-quarter-tones sharp"* (double-sharp-arrow-up) … (b) one COMPOSED glyph, or a
bare arrow + nothing; conceptually sign + operator. (c) in Gould/Stone: ±¼ tone relative to the
carrying accidental. (d) ⚠️ explicitly definable: Gould p. 97 (⅓, ⅕, ⅙; a range; "slightly"); HEJI
(syntonic comma, §3.2); eighth-tones in current practice.

**Bussotti** — SMuFL "Other accidentals": *"Quarter tone sharp (Bussotti)"* U+E472, *"Three quarter
tones sharp (Bussotti)"* U+E474; Karkoschka pp. 25, 27 list his per-piece sign tables (*Siciliano*:
*"Symbols for natural – sharpening by quarter-tone – sharpening by semitone – sharpening by
three-quarter-tone – flattening by semitone"*; *Phrase à trois*). (b) one per note; (c) 24-EDO; (d)
per-score legend. ⛔ Bussotti's scores themselves: not seen.

**Wyschnegradsky** — SMuFL `wyschnegradskyAccidentals72Edo` U+E420–E435 (22 signs: 1/12 … 11/12 tone
sharp, 1/12 … 11/12 tone flat); Unicode L2/24-090: *"Invented by microtonal pioneer Ivan Wyschnegradsky
(1893–1979) for 72 equal temperament (twelfth-tones). The quarter-tone sharp symbols overlap with the
Stein-Zimmermann accidentals … The flats past a semitone are best treated as atomic characters,
analogous to the double flat."* (b) ONE sign per note — a complete replacement ladder in which the
6/12 sign IS the semitone. (c) fixed fraction of a tone = 72-EDO step count. (d) fixed. ⛔ His *Manuel
d'harmonie à quarts de ton* (1932): not read — **UNKNOWN** for his own cancellation rules.

**Hába** — SMuFL supplement U+EE64–EE69 (six quarter-tone signs); Karkoschka pp. 2–3 [GB-SNIPPET]
(quarter-, sixth-, twelfth-tone tables); Unicode L2/24-090: *"Hába also proposed twelfth-tone
accidentals, but these conflict with Arabic accidentals and Wyschnegradsky's accidentals, and have not
come into general use."* (b) one per note; (c) fraction of a tone; (d) fixed. Karkoschka's gloss (p. 2):
at such fine divisions *"the difference between sharpening and flattening"* becomes *"meaningless"*.
⛔ *Neue Harmonielehre* (1927) itself: not read.

**Carrillo (*Sonido 13*)** — Cannon-Brown, *Music Theory Online* 30.4 (2024), ¶2.6 [WEB]: *"Carrillo
notated his microtonal music with an original system … he represented pitches as natural numbers—pitch
classes, essentially—within an eight-octave range, with C always equal to 0. On a central, one-line
staff, Carrillo placed all pitches belonging to the register of Middle C, and above and below that
staff, in relation to two small ledger lines, he placed pitches of other registers."* ⇒ **not an
accidental system at all**: no staff position + alteration; the number IS the pitch class in the chosen
division (0–95 for sixteenth-tones). (d) the number's meaning depends on the declared division.

**Sims / Maneri–Sims (72-EDO)** — ezrasims.info [WEB]: *"requires the user to learn only 3 new signs, and
their inversions"* (1/12, 1/6, 1/4 tone lowered / raised) *"or in combination with the standard sharps
and flats … and are, with the natural sign, sufficient to describe any note of a 72-note division of the
octave."* · *"By adding only three symbols and using them alone or in combination with traditional
accidentals …"*. SMuFL implementation note: *"These glyphs may be used alone and to the left of the
standard 12-EDO accidentals."* (b) **COMBINATION**: [Sims sign] + [♯/♭]. (c) fixed 72-EDO steps off the
12-EDO pitch. (d) fixed to 72-EDO — Secor & Keenan's criticism is exactly that (p. 20): *"Players fluent
with the Sims notation must realize that if they are asked to play in systems other than 72-EDO, then
there is a real possibility that they would be required to read another notation"*.

**Xenakis** — Gould p. 97 [SCAN]: ⅓-tone and ⅔-tone higher signs in *Medea-senecae*, used beside Stein
sharps and ordinary accidentals in one score. SMuFL U+E470–E471. (b) one per note; (c) third-tones
(18-EDO steps); (d) per-score legend.

**Ferneyhough** — SMuFL "Other accidentals" U+E48A–E48F: one-third-tone sharp/flat, two-third-tones
sharp/flat, one-quarter-tone sharp/flat *"(Ferneyhough)"*. ⛔ **"Ferneyhough-style eighth-tone arrows"
as such: UNKNOWN** — no Ferneyhough score or preface was reached. The general practice (arrows on
Stein–Zimmermann signs = eighth-tones) is documented in L2/23-276 (§2.7).

**Stockhausen** — SMuFL `stockhausenAccidentals` U+ED50–ED5E (24-EDO): raised/lowered ♭ ♮ ♯, and
notably *"Repeated flat, note in space / on line"*, *"Repeated sharp …"* — a distinct sign for a
REPEATED accidental. Catalogue fact only; ⛔ his own explanation not read.

### 3.2 Just intonation

**HEJI — (Extended) Helmholtz-Ellis JI Pitch Notation** (Sabat & von Schweinitz 2004; rev. Sabat &
Nicholson 2020). Sources: the 2020 LEGEND (DiVA PDF) and the 2004 text (`masa.plainsound.org/pdfs/
notation.pdf`, dated *"2004 (rev. 2018)"*), both [PDF-TEXT]; Sabat's 2009 *informal introduction*.

(a) ♭ ♮ ♯ (𝄫 𝄪) are the **Pythagorean** series — 2020 legend: *"notate a series of perfect fifths above /
below a reference — 3/2 ≈ ±702.0 cents … each new accidental therefore represents 7 fifths, or an
alteration by one apotome — 2187/2048 ≈ ±113.7 cents"*. Then one sign-pair per prime: 5 = arrows attached
to the Pythagorean accidental (81/80 ≈ 21.5 ¢; double and triple arrows for 2, 3 commas); 7 = Tartini's
sign (64/63 ≈ 27.3 ¢; doubled ≈ 54.5 ¢); 11 = Stein's quartertone signs (33/32 ≈ 53.3 ¢); 13 =
*"thirdtone"* signs (27/26 ≈ 65.3 ¢); 17, 19, 23, 29, 31, 37, 41, 43, 47; plus *"TEMPERED NOTES"* signs.
⭐ The 2020 legend CREDITS other people's signs and gives each a new fixed ratio: 7 *"(symbols proposed by
Giuseppe Tartini)"*, 11 *"(Richard H. Stein)"*, 13 *"(Gérard Grisey)"*, 23 *"(James Tenney / John Cage)"*,
31 *"32/31 ≈ ±55.0 cents (Alinaghi Vaziri)"* — the Persian koron/sori —, 37 *"(Ivan Wyschnegradsky)"*, 41
*"(Ben Johnston)"*. The glyph travels; the meaning is assigned by the system.
(b) **COMPOSABLE** — 2004 text: *"Each prime factor making up a ratio is associated with a specific
family of accidental signs, allowing the ratio to be directly deduced from the combined accidentals."*
The 5-limit arrow is fused onto ♭ ♮ ♯; the higher-prime signs stand as SEPARATE signs beside it (SMuFL
names them `accidentalCombining…`), so one note may carry two, three or more signs, in a row.
(c) each sign = a fixed **ratio** (a comma) applied to a Pythagorean pitch. (d) fixed — but see (e).
(e) 🚨 **The definitions changed between versions.** 2004: 17-limit sign = *"notate an alteration of the
5-limit accidental by one 17-limit schisma (16/17)·(16/15) = (256/255) ≈ ± 6.8 cents"*; 2020: *"alteration
of 2187/2048 by one 17-limit schisma — 2187/2176 ≈ ±8.7 cents"*. Same sign, different ratio ⇒ a HEJI
score's meaning depends on which legend it follows.
(f) **A number beside the sign is part of the system.** 2004: *"Cents indications placed above or below
the accidentals provide an alternative method of specifying pitch, and are to be read in relation to
the twelve Equal Tempered semitones."* 2020: *"HEJI accidentals may be combined with an indication of
their deviation in cents from equal temperament as read on a tuning meter; ♮A 440 Hz is usually defined
to be ±0 cents. If this deviation exceeds ±50 cents, the nearest tempered pitch-class may be added:
e.g. … could include the annotation … placed above or below its accidental."* · *"TEMPERED NOTES | may
be combined with cents deviations to notate free microtonal pitches … indicate the respective 24-edo
quartertone; show which pitch is assigned as reference (deviation of 0 cents)"*.
(g) Open-ended by design — 2020: *"Custom indications for high primes or arbitrary enharmonic
substitutions may be devised or derived algorithmically by defining ratio alterations from nearby
Pythagorean notes and representing these using symbols (accidentals)."*
(h) Transposition — 2004: *"an exact and fully transposable Just Intonation notation, which can also
include irrational and tempered intervals."*
⛔ HEJI's cancellation / duration convention: not stated in either legend — **UNKNOWN**.

**Ben Johnston** — sources: Kyle Gann, *How to Use Ben Johnston's Just Intonation Notation* [WEB];
SMuFL `johnstonAccidentalsJustIntonation` U+E2B0–E2B7; Xenharmonic wiki [POINTER]. ⛔ Johnston's own
writings (*Maximum Clarity*) and Fonville, *Perspectives of New Music* 29/2 (1991): not reached.

(a) `+` / `−` (81/80), ♯ / ♭ (**25/24**), `7` / inverted 7 (36/35), ↑ / ↓ (33/32), `13` / inverted 13
(65/64), then 17, 19, 23, 29, 31. SMuFL: *"Plus (raise by 81:80)"*, *"Seven (lower by 36:35)"*, *"Up
arrow (raise by 33:32)"*, *"Thirteen (raise by 65:64)"*.
(b) **COMPOSABLE** — Gann: *"These accidentals can be combined to create pitches with sometimes very
elaborate names … By convention the plus or minus is kept separate, and to the right of the other
accidentals. Means of combining accidentals have not yet been entirely standardized."* His worked
example is a note named *"A-thirteen-flat-down-arrow"*. SMuFL: *"These glyphs are intended for combining
with the standard 12-EDO accidentals."*
(c) each sign = a ratio — Gann: *"every accidental multiplies a pitch's frequency by some defined
constant … a sharp (#) multiplies a pitch by 25/24"*.
(d) 🚨 **The NATURALS carry tuning** — Gann: *"It is assumed in this notation that F-A-C, C-E-G, and G-B-D
are perfectly tuned major triads of 4:5:6."* ⇒ *"while F-C-G-D and A-E-B are all perfect fifths of 3/2,
D up to A is not 3/2, but 40/27"*. So the plain letter names are a just C-major scale, not a chain of
fifths; the same ♯ is 25/24 (70.7 ¢) here and 2187/2048 (113.7 ¢) in HEJI; the same B♭ is a different
pitch. Gann on the difference: *"HEJI … and HEWM … both start with the Pythagorean scale instead of the
Ptolemaic sequence, so that pluses and minuses never apply to perfect fifths"*.
(e) No enharmonics — Gann: *"No two non-identical pitches, no matter how close, can ever have the same
notation; no two pitches differently notated can ever be the same pitch."* · *"There are no enharmonic
equivalents in this notation."*

**Sagittal** — Secor & Keenan, *Sagittal: A Microtonal Notation System* (Xenharmonikôn 18; PDF © 2006,
2021, 26 pp.) [PDF-TEXT]; SMuFL Sagittal ranges + implementation note [WEB].

(a) a superset of arrow-like signs in tiers — SMuFL ranges: Spartan single-shaft (16) and multi-shaft
(38), Athenian (40), Trojan "12-EDO relative" (24), Promethean (30 + 64), and three tiers of **accidental
diacritics** (Herculean 4, Olympian 4, Magrathean 20). ♯ and ♭ keep their place: *"The Sagittal notation
uses a conventional staff on which the natural notes are in a single series of fifths, with sharps and
flats (and doubles thereof) indicating tones that are members of that same series, regardless of the
particular tonal system being notated. Therefore, if the notation is used for just intonation, these
notes will indicate a Pythagorean tuning. For an equal division of the octave, they will indicate the
tones in a series built on that division's best approximation of a fifth."* (p. 2)
(b) **Two flavours, by design** (pp. 3–4): *"The Evo(lutionary) or mixed-symbol flavor retains existing
sharp and flat symbols and uses only the new single-shaft Sagittal symbols in combination with these"*;
*"The Revo(lutionary) or pure flavor discards the existing single and double sharp and flat symbols and
replaces them with Sagittal single and double apotome symbols that mean exactly the same thing."* So
Evo = up to two signs per note, Revo = exactly one: *"there is a one-to-one relationship between the
two."* SMuFL: *"Sagittal accidentals are not intended to be combined with one another"*; single-shaft
signs are used *"alone, and to the left of the standard"* flats/sharps; *"The standard accidentalNatural
is used alone in both mixed and pure variants, but only to cancel a previous accidental."* Plus optional
diacritics (accent marks) on a sign. The authors' stated reason for one-sign-per-note (p. 5): *"the
avoidance of the clutter resulting from multiple side-by-side microtonal symbols, such as occur in the
notational systems of Bosanquet, Ben Johnston, and Paul Rapoport, and most recently in the 'Extended
Helmholtz-Ellis JI Pitch Notation'"*; and the chord problem with Evo (p. 12): *"if a situation is
encountered where the first note is altered by only a single Sagittal symbol and the second by only a
sharp or flat, a certain ambiguity occurs: do the two symbols together alter one or both notes, or does
the left one alter one note and the right one the other?"*
(c) each sign = a **prime comma** in JI, *"or its equivalent number of degrees in a temperament"* (p. 2).
(d) 🚨 **Tuning-dependent by design.** p. 15: *"the comma sizes in cents, as listed for the various
symbols in Table 1, apply only to rational or JI tunings … In various EDOs these commas are represented
by intervals that may be either larger or smaller than their rational sizes, or they may vanish
altogether."* p. 23: *"the 5 comma is ≈16.7 cents in 72-EDO, but it is ≈14.3 cents in 84-EDO and 12.5
cents in 96-EDO. And outside this group the size of the 5 comma (relative to a system's best fifth) can
get considerably larger, e.g., ≈54.5 cents in 22-EDO."*
(e) **Trojan** is the deliberately tuning-blind subset (p. 18): *"it must cater to those who prefer to
notate tunings relative to 12-tone equal temperament … one may freely ignore this fact and simply
consider the symbols as representing particular fractions of a semitone or tone. We call this the
12-Relative or Trojan symbol set"* — yet *"in some cases the same symbol is used for several slightly
different fractions of a tone; for example the left barb is used for 1/12, 1/14 and 1/16 of a tone."*
(f) SMuFL note on ambiguity inside one system: *"An accidental can often be used to represent
alternative commas that differ by 2 cents or less. In such cases the intended comma ratio may be
determined by the note to which it is applied, or by the musical context. Alternatively, diacritics …
may be added to distinguish these commas."*

**Partch — ratios.** *Genesis of a Music* [GB-SNIPPET p. 198]: the instruments' notations are *"written
in ratios, and those that are not so written are immediately translatable into ratios by the assiduous
student."* ⇒ no accidental; the ratio itself is written. ⛔ Only this snippet was read.

**Bosanquet / Wilson** — SMuFL "Other accidentals": *"Syntonic/Didymus comma (80:81) up (Bosanquet)"*,
*"Wilson plus (5 comma up)"*. Secor & Keenan p. 4: *"Bosanquet's use of sloping lines to indicate
commatic alterations"*. Catalogue facts.

### 3.3 Non-Western practice on the staff

**Turkish — Arel-Ezgi-Uzdilek (AEU).** Sources: Karl Signell, *Makam: Modal Practice in Turkish Art
Music* (1977/1986) [GB-SNIPPET]; SMuFL `arelEzgiUzdilekAeuAccidentals` U+E440–E447; Unicode L2/24-090
[PDF-TEXT + rendered pp. 5–6]; Wikipedia *Turkish makam* [POINTER].

(a) Signell p. 24: *"six accidentals to express the necessary inflections to produce the intervals of
all the scales from this fundamental scale: (1) koma diyezi … raises one comma (2) bakiye diyezi ♯ …
raises four commas (3) küç. müc. diyezi … raises five commas (4) koma bemolü … lowers one comma (5)
bakiye bemolü … lowers four commas (6) küç. müc. bemolü ♭ … lowers five commas"* (the snippet's glyphs
are OCR noise except `#` and `b`, which sit beside *bakiye diyezi* and *küç. müc. bemolü* respectively).
SMuFL adds *büyük mücenneb* sharp and flat (eight signs).
(b) one sign per note. (c) a count of (Holdrian) commas, 9 to the whole tone, in a 24-of-53 pitch set.
(d) 🚨 **Three things the score model must not assume:**
  - **♯ and ♭ are not mirror images.** The plain ♯ glyph is *bakiye* = **4 commas**; the plain ♭ glyph is
    *küçük mücenneb* = **5 commas** (Signell p. 24; the MuseScore-forum summary surfaced by search says
    the same: *"The Bakiye (sharp) appears identical to the common Sharp (♯) sign while the Küçük
    mücenneb (flat) appears identical to the common Flat (♭) sign"*).
  - **The Stein quarter-tone glyphs mean one comma here.** Wikipedia [POINTER]: *"the commonly used
    quarter-tone symbols … are used in this system to indicate a tone's adjusting with a koma, not a
    quarter-tone, like in Arabic maqam and Helmholtz-Ellis notation."*
  - **One glyph, two traditions, two values.** Unicode L2/24-090 proposes ONE character, *"MUSICAL SYMBOL
    FLAT WITH STROKE [SMuFL U+E442 and U+ED33] = bakiye flat = Arabic quarter-tone flat"* — 4 commas
    (≈90 ¢) in one tradition, 50 ¢ in the other.
(e) **Sign ≠ practice, stated by the ethnography.** Signell p. 38: *"In general, the Ezgi-Arel notation
system is accurate and practical, again, within limits. Sometimes, the literal value of the accidentals
can deviate at least one comma (23 cents) from common practice."*
(f) **Key signatures.** Signell p. 25: *"The accidentals required for the basic scale of the makam of a
composition are written into a key signature, as shown in Example 5"*; p. 26: *"It can be assumed that
the accidentals in key signatures used throughout this dissertation will apply to all octaves, unless
otherwise indicated"*.
**Turkish folk music** — SMuFL `turkishFolkMusicAccidentals` U+E450–E457: *"1-comma sharp", "2-comma
sharp", "3-comma sharp", "5-comma sharp"; "1-comma flat", "2-comma flat", "3-comma flat", "4-comma
flat"* — a ♯/♭ carrying a NUMBER; asymmetric inventory (5 vs 4). Catalogue fact; ⛔ no treatise read.
⛔ Arel's / Ezgi's own treatises and Yarman's critique: not reached — **UNKNOWN**.

**Arabic.** Sources: Scott Marcus, *Music in Egypt* (OUP, 2007) [GB-SNIPPET]; SMuFL `arabicAccidentals`
U+ED30–ED38 (nine: Arabic double flat, ¾ flat, half-tone flat, ¼ flat, natural, ¼ sharp, sharp, ¾ sharp,
double sharp); L2/24-090 fig. 11–12 (tables of accidentals from Iraqi and Egyptian theory books).
(a)–(c) Marcus p. 19: *"To build the various maqāmāt Arab music uses a scalar system that recognizes
twenty-four notes per octave."* p. 22: *"… equal tempered (the quarter-step intervals are all of equal
size), the 'half-flat' and 'half-sharp' designations can be seen as accurate descriptions of the notes'
theoretical positions"*. (b) one sign per note.
(d) 🚨 **The sign is 24-EDO in theory; the sound is per-maqām.** Marcus p. 26: *"[the] equal-tempered
half-flat third, E half-flat, occurs 350 cents above a C tonic, the slightly raised E half-flat of maqām
rāst will be higher than 350 cents, possibly as high as, say, 365 cents."* p. 27: *"Interestingly,
others were content to accept the equal-tempered understanding. One famous Cairo ʿūd player maintained,
for example, that there is only one intonation for the E half-flat pitch, no matter what maqām was being
played, declaring, 'sīkāh is sīkāh!'"* ⇒ the SAME written E-half-flat has different sounding values by
context, and musicians disagree on whether it does.
⛔ Marcus, *Arab Music Theory in the Modern Period* (1989) and his *Asian Music* 1993 article: not
reached.

**Persian — koron and sori.** Hormoz Farhat, *The Dastgāh Concept in Persian Music* (CUP, 1990)
[GB-SNIPPET]; SMuFL U+E460–E461 (*"Koron (quarter tone flat)"*, *"Sori (quarter tone sharp)"*).
(a) two signs. (b) one per note. (c)–(d) 🚨 **the inventor's meaning and the scholar's meaning differ**:
p. 10: *"… koron and sori which he [Vaziri] invented to indicate the microtonal lowering and raising of
tones, although, as used by him and his school, they are meant to lower and raise a pitch by an exact
quarter-tone."* p. 26: *"Koron stands for the flattening of a pitch by a microtone. This name and its
symbol were devised by Ali Naqi Vaziri. Although Mr Vaziri's theories have been controversial and to a
great extent refuted in recent years (chapter 2), I see no reason why this symbol and its name, which
have been adopted and used …"* · *"Sori: This stands for a pitch raised by a microtone, also devised by
Vaziri."* And the size is a range — p. 16: *"A smaller neutral tone can fluctuate between 125 and 145
cents, the mean for which can be taken as 135 cents."*; pp. 25–26: the neutral 2nd *"is unstable and may
vary from about 125 cents to 170 cents"*. ⇒ Farhat **keeps the sign while rejecting the tuning theory it
was invented for** — the cleanest sign/sound separation in this whole survey. (SMuFL's gloss "quarter
tone flat" is Vaziri's reading; and HEJI 2020 reuses the glyph for 32/31.)
⛔ Persian key signatures with koron: a search of Farhat for "key signature" returned nothing —
**UNKNOWN**.

### 3.4 EDO notations — the same ♯, a different size

- Secor & Keenan p. 2 (above): ♯/♭ denote **position in the chain of fifths**, *"regardless of the
  particular tonal system"*; footnote 4: the apotome is *"a generic term designating the chromatic
  semitone occurring in any temperament or division of the octave"*; *"Such is the case with 72-EDO,
  where the apotome (or sharp/flat) is 6º"*. ⇒ a ♯ is 1 step of 19-EDO and 3 of 22-EDO (wiki
  quotes below), 6 of 72-EDO (Secor & Keenan), and 2 of 31-EDO (⚠️ my arithmetic, not a quotation: seven
  18-step fifths less four octaves).
- **Ups and downs** (Kite Giedraitis, 2014) — Xenharmonic wiki via the Wayback Machine [WEB]: *"The up
  symbol '^' and the down symbol 'v' indicate raising/lowering a note … by one EDOstep."* · *"19edo is
  easy to notate because 7 fifths reduced by 4 octaves adds up to one EDOstep. C♯ is right next to C, and
  the keyboard runs C, C♯, D♭, D, D♯, E♭, E etc. Conventional notation works perfectly with 19edo as long
  as you remember that C♯ and D♭ are different notes."* · *"The solution is to use the sharp symbol to
  mean 'raised by 7 fifths', and to use the up-arrow symbol to mean 'sharpened by one EDOstep'. 22edo can
  be written C – Db – ^Db – vD – D …"* · *"there's 3 ups to a sharp"*.
  (b) **COMBINATION and STACKING**: *"For staff notation, put an arrow to the left of the note and any
  sharp or flat it might have"*; *"In larger edos, triple-arrows, quadruple-arrows, etc. can occur."*
  (c)–(d) a step of whatever EDO is declared — purely tuning-relative.
  Cancellation: *"Like sharps and flats, an arrow applies to any similar note that follows in the
  measure. … There are several possible ways to handle this issue. The default is the simplest way, to
  explicitly specify both arrows and accidentals every time. Thus any accidental or arrow cancels any
  previous ones. An arrow by itself implies a natural sign."* (⚠️ contrast Gould p. 95, who rejects a
  bare arrow after a conventional accidental.)
  Key signatures: *"19edo has the key of B𝄫 with a key signature of B𝄫 E𝄫 A♭ D♭ G♭ C♭ F♭. Some edos have
  upped/downed tonics, e.g. 24edo has the key of vD with a key signature of F♯ C♯ (v). The (v) is a
  'global down' that downs all 7 notes"*. SMuFL supplement: U+EE60–EE63 *"Accidental up / down / more /
  less"*.
  Its own statement of the split: *"Conventional notation is generated by the octave and the 5th, and
  the notation (not the tuning itself) is rank-2."* · *"A chord quality like 'major' refers not to the
  sound but to the function of the chord."*
- **31-EDO** — Wikipedia [POINTER]: fingering *"is precisely the same as it is in any other syntonic
  tuning (such as 12 EDO), so long as the notes are spelled properly—that is, with no assumption of
  enharmonicity"*; *"The five 'double flat' notes and five 'double sharp' notes may be replaced by half
  sharps and half flats, similar to the quarter tone system"* (so a Stein half-sharp = 1 step of 31 =
  38.7 ¢ there). ⛔ Fokker's own notation papers: not read. ⛔ 53-EDO and 72-EDO Wikipedia pages: rate-
  limited / not used.

### 3.5 Historical and annotation-style notations

- **Vicentino's dots (1555)** — Jonathan Wild, *Music Theory Online* 20.2 (2014), ¶6 [WEB]: *"The pitch
  midway between D and D♯ is notated in Vicentino's musical examples as a D with a dot above the
  notehead; the dot indicates a raise in pitch of a fifth-tone."* n. 7: *"this notation should
  nonetheless be understood conceptually as E♭ raised by a fifth-tone: (E-flat)-dot rather than
  (E-dot)-flat."* ¶9: a second sign for the quarter-comma pitches — *"a comma placed above the note
  head"*. ⇒ a pitch sign ABOVE the notehead, combinable with a conventional accidental.
  And the per-score-legend point, n. 21: *"Anthoine de Bertrand … In the Avertissement au lecteur placed
  at the beginning of his Second livre des Amours de Ronsard, in which he borrows Vicentino's
  superscript dot notation, Bertrand writes that the enharmonic dots in one of his works raise the pitch
  of a note by a quarter-tone (he adds that those who are unable to perform them accurately may ignore
  them!)."* — the same dot, a different value, declared in a preface, in the 16th century.
- **Meantone split keys / enharmonic notation** — Wild ¶8: the archicembalo's manuals carry D♭ *and* C♯,
  B♯, E♯; ⇒ in meantone the SPELLING is the pitch; nothing extra is written.
- **Cents above the note** — Secor & Keenan p. 21: *"a notation devised by Johnny Reinhard … consists of
  using 24-EDO notation (a variation of Stein's symbols) with numbers (i.e., signed integers) written
  above each note to indicate the number of cents by which that note should be altered to obtain the
  desired pitch. In essence, this is a notation for 1200-EDO"*; p. 22: *"it could be useful for a string,
  wind, or voice part in Sagittal notation to have the cents deviation from a 12-EDO pitch placed above
  the notes"*. HEJI legends (§3.2 f). *Oxford Handbook of Spectral Music* [GB-SNIPPET p. 186], on
  Tenney: *"deviations from equal temperament (if any) are indicated in cents above the note heads."*
  ⛔ **Grisey's and Haas's own score prefaces were not reached — UNKNOWN**; a web-search summary says Haas
  writes cent deviations and partial numbers, but no primary text was read (the Hasegawa PDF 404'd).
- **Berg's Z** — Read 1969 p. 146 (above): a letter on the STEM marks a quarter-tone.
- **Shaped noteheads** as a microtone carrier — Read 1990's method (3) (§2.4).

### 3.6 Summary table

| system | signs on one note | what a sign means | relation to ♯ / ♭ |
|---|---|---|---|
| Gould arrows | one composed glyph (accidental + arrow), or bare arrow | per-piece definition; default ±¼ tone | arrow is an OPERATOR on ♭ ♮ ♯ |
| Stein–Zimmermann | one | 24-EDO step by convention (⚠️ other values in HEJI, AEU, 31-EDO) | replaces ♯/♭; "fixed symbols" |
| Tartini sharps + backward flat (Stone) | one | 24-EDO | white-key pitches only; no ¾ signs |
| extended Stein–Zimmermann | one composed glyph | eighth- OR twelfth-tones — per score | arrow on SZ or on ♯/♭ |
| Wyschnegradsky | one | fixed n/12 tone (72-EDO) | a full replacement ladder |
| Hába | one | fixed ¼, ⅙, 1/12 tone | replaces |
| Sims / Maneri | one, or Sims sign + ♯/♭ | fixed 72-EDO step | COMBINES, to the left |
| Xenakis, Bussotti, Ferneyhough, Penderecki… | one | per-score legend | replace |
| Carrillo | none — a number instead of a notehead | pitch class in the declared division | n/a |
| HEJI | several (Pythagorean+arrow fused; one sign per higher prime) + optional cents | fixed RATIO per sign (⚠️ versioned) | ♯/♭ = Pythagorean apotome 2187/2048 |
| Johnston | several (numerals, arrows, ♯/♭, then +/− last) | fixed RATIO per sign | ♯/♭ = 25/24; NATURALS = just C major |
| Sagittal Revo | exactly one (+ optional diacritic) | a comma — size depends on declared tuning | replaces ♯/♭ with own apotome signs |
| Sagittal Evo | Sagittal sign + ♯/♭ | same | COMBINES, to the left |
| ups and downs | n arrows + ♯/♭ | 1 step of the declared EDO | ♯ = 7 fifths in that EDO |
| AEU (Turkish) | one | a count of commas (53-division); practice deviates | ♯ = 4 commas, ♭ = 5: NOT mirrors |
| Turkish folk | ♯/♭ with a number | n commas | numbered |
| Arabic | one | 24-EDO in theory; per-maqām in practice | own ladder incl. ¼ and ¾ |
| Persian | one | "a microtone" (Farhat); exact ¼ (Vaziri) | beside ♯/♭ |
| Vicentino | dot / comma ABOVE the notehead, plus any ♯/♭ | ⅕ tone (Bertrand: ¼ tone) | combines |
| cents annotation | a number above/below | cents from 12-EDO (or 24-EDO) pitch | added to any of the above |
| Stone numerals | numeral+arrow ABOVE; may govern a chord | 1/n tone | beside ordinary accidentals |
| Partch | a ratio | itself | n/a |

---

## 4. What the conventions demand of a notation program (each with its source)

**R1 — A sign's pitch meaning is declared per score; the program cannot know it from the glyph.**
Gould p. 94 (*"Symbols for any other pitches require a written definition"*), p. 97 (*"The pitch
modification of the arrow must always be defined"*), p. 504; Stone p. 70 (*"it must be explained at the
beginning of the composition or movement … in the parts (if any) as well"*); Read 1969 p. 393 (*"a brief
footnote of explanation would be in order"*); Secor & Keenan p. 23; Karkoschka p. 27 (a sign that occurs
*"only in the explanation"*); Bertrand's 16th-c. *Avertissement* (Wild n. 21).

**R2 — The same glyph has different values in different systems, so sign identity and pitch value are
two facts.** Stein half-sharp: 50 ¢ (24-EDO) / 33/32 (HEJI) / one koma (AEU) / one step of 31-EDO. The ♯:
100 ¢ / 2187/2048 (HEJI) / 25/24 (Johnston) / n steps (EDO) / 4 commas (AEU). Flat-with-stroke: bakiye
vs Arabic ¼ flat (L2/24-090). The arrow: ¼ tone (Gould) / 81/80 (HEJI) / ⅛ or 1/12 tone (L2/23-276) /
*"slightly"* (Gould p. 97). Koron: exact ¼ (Vaziri) / "a microtone" (Farhat) / 32/31 (HEJI).

**R3 — One note may carry SEVERAL accidental signs, in a defined order.** HEJI (*"the combined
accidentals"*); Johnston (Gann: combined, *"the plus or minus is kept separate, and to the right"*; *"Means
of combining accidentals have not yet been entirely standardized"*); Sims (*"alone or in combination"*;
SMuFL *"to the left of the standard 12-EDO accidentals"*); Sagittal Evo; ups and downs (arrows left of
the ♯/♭, stackable); traditional ♮♯ / ♮♭ (Gould p. 81). MEI's own remark: `<accid>` is for *"when
multiple accidentals occur on a single note"*. ⚠️ Conventional practice forbids it (Gerou & Lusk p. 4:
*"Do not use multiple accidentals on one note"*), and Sagittal Revo exists to restore one-per-note — so
"one or many" is a property of the SYSTEM in use.

**R4 — An accidental may be a composed sign: a conventional sign with an attached modifier.** Gould
p. 94 (*"an arrow attached to an accidental"* — recommended), p. 97 (*"Where possible, symbols should be
attached to an accidental. Otherwise they may precede or supersede an accidental (but always in front of
the note)"*); Stone p. 67; Karkoschka p. 25; HEJI's 5-limit arrows; Couper's merged stems (Secor & Keenan
p. 5). Attached, preceding and superseding are three distinct layouts of the same content.

**R5 — A pitch inflection may be written OUTSIDE the accidental position.** Numerals with arrows above
the note (Stone p. 70 — and Gould p. 96 argues against); cents above or below (HEJI; Reinhard; Tenney);
dot or comma above the notehead (Vicentino); small arrows above noteheads for unspecified inflections
(Stone p. 70; Ghent per Read 1990 p. 20); a letter on the stem (Berg); shaped noteheads (Read 1990
method 3); and, for ordinary signs, cautionary or editorial accidentals *"directly above their notes"*
(Gould p. 83). Stone p. 70: one numeral above may govern **all notes of a chord**, or numerals stack *"above
one another in corresponding order"*.

**R6 — The natural is a full accidental that can itself be modified.** Gould p. 94 (natural-with-arrow
drawn), p. 96; Stone p. 67 (*"Quarter-tone naturals"*); Karkoschka p. 25 (*"embraces all accidentals
(including the natural)"*); HEJI (natural with arrows). Versus Sagittal, where the natural is *"used
alone … but only to cancel"*.

**R7 — How long an accidental holds is a per-score convention, not a fact of notation.** Gould pp. 86–87
(traditional / accidental to every pitch / accidental applies only to the note it precedes / the
modified form with repeated notes and beamed groups; unbarred music) — and p. 86: state it in the
preface even when it is the traditional one; Stone pp. 55–56 (note-for-note accidentals, five rules).
For microtones: Gould p. 98 — *"If using conventional accidental practice, an ordinary accidental must
cancel a microtone"*; p. 95 — after a conventional accidental on that pitch, *"an accidental must
confirm or cancel the altered microtonal pitch"*, a bare arrow will not do. Ups-and-downs' default is
the opposite (*"An arrow by itself implies a natural sign"*). ⚠️ Also a matter of house convention: how far a
cancelling natural is owed — Gould p. 79 (*"An accidental holds good only for the stave in which it is
written"*) vs Stone p. 53 (cancel *"for the entire pitch class (i.e., at any octave level)"* and
*"regardless of the staff"*; and *"in the measure following"*).

**R8 — Reducing a double accidental: both styles exist.** Traditional ♮♭ / ♮♯ vs contemporary ♭ / ♯ —
Gould p. 81 (the natural *"is redundant"*), Stone p. 54 (*"no natural is needed"*), Gerou & Lusk p. 4
(*"only the flat (not ♮♭) is needed"*). All three manuals take the modern side; SMuFL still ships
*"Natural flat"* and *"Natural sharp"* (U+E267, E268) because the old engraving exists.

**R9 — A key signature is an arbitrary list of signs at staff positions, and may hold non-standard
signs.** Gould p. 94 (*"Any sharp or flat may be selected as a key signature"*; Bartók; one signature per
stave of one instrument); Signell p. 25 (makam signatures built from AEU accidentals); ups-and-downs
(double flats in a signature; a parenthesised global arrow). ⛔ No engraving MANUAL read here addresses
microtonal signs in key signatures — Gould is silent (checked), Stone/Read: UNKNOWN.

**R10 — Enharmonic spelling is content; no equivalence may be assumed.** Gould p. 95 (arrows *"making all
enharmonic equivalents available"*; ↑ in sharpening contexts, ↓ in flattening), p. 247; Stone pp. 67–69
(*"the tonal gravity … should be reflected in the 'grammar' of the notation"*; string and wind players
distinguish F♯ from G♭; in the Tartini/backward-flat system *"a ¾-sharp C must be notated as a ¼-flat
D"*); Gann (*"There are no enharmonic equivalents in this notation"*); 19/31-EDO (C♯ ≠ D♭). ⇒ a
transposition or respelling routine is system-specific: HEJI is *"fully transposable"*; in Johnston a
transposition by letter needs `+`/`−` bookkeeping because D–A is 40/27 (Gann); in ups-and-downs *"interval
arithmetic is always preserved"*.

**R11 — Sharp-side and flat-side inventories need not mirror each other.** AEU (♯ = 4 commas, ♭ = 5);
Turkish folk (sharps 1, 2, 3, 5; flats 1, 2, 3, 4); Tartini sharps with no flats (Stone p. 68); Stone's
recommended set with no ¾ signs (p. 69); HEJI 2020's footnote that primes 17 and 47 *"favour a rising
spelling"*.

**R12 — A sign has glyph VARIANTS that mean the same thing.** Gould p. 96 (two half-sharps, "or");
L2/23-276 (*"graphic variants with one and three diagonal crossbars and two verticals"*; the ¾-flat
joined or disconnected; *"the filled reversed flat is merely a glyph variant"*); SMuFL's narrow reversed
flats. So there are three layers — meaning / sign / glyph — not two.

**R13 — A sign system can be versioned.** HEJI 2004 vs 2020 (§3.2 e).

**R14 — When the signs are tuning-relative, the tuning and a reference pitch are declared at score
level.** Secor & Keenan p. 23: *"it is necessary that sufficient information be provided in a score to
specify the particular tuning that is intended, along with a pitch reference."* HEJI 2020: *"show which
pitch is assigned as reference (deviation of 0 cents)"*. Gould p. 504 lists *"special tunings"* beside
the accidental legend.

**R15 — An inflection may be inexact on purpose.** Gould p. 97 (*"within a given interval"*; *"Modify the
pitch slightly"*); Stone p. 70 (*"Slightly higher or lower than the note"*); Ghent via Read 1990 p. 20
(*"unspecified microtones, their size spontaneously chosen by the player"*); Farhat (koron = *"a
microtone"*, 125–170 ¢).

**R16 — Compactness is an engraving rule for these signs.** Gould p. 97: *"Symbols should be as compact
as possible. The further the symbol is from the note, the more difficult the pitch is to read. Wide
symbols force short durations apart"*; p. 94: *"Ensure that the arrowhead is sufficiently large to be
visible on the stave."* Stone p. 71: arrows *"quite small and thin"*. Secor & Keenan p. 21: many symbol
pairs *"may require the use of slightly larger staves than usual for the parts"*. ⛔ **No source gives a
number** for a microtonal accidental's gap, width or chord-column behaviour — UNKNOWN in every book read.

**R17 — Microtonal accidentals occur on things other than noteheads.** Trill signs and parenthesised
trill notes (Stone p. 76); scordatura string labels (Gould, strings); key signatures (R9).

---

## 5. Does the literature itself separate the SIGN from the SOUND?

Yes — repeatedly, and from independent directions.

- **Secor & Keenan (Sagittal), p. 3:** *"We can continue to call these new symbols sharps and flats with
  semi-, sesqui-, and double- prefixes added as appropriate, inasmuch as it is only the symbols that are
  changing, not their names or meanings."* — sign and meaning named as separate things.
  **p. 23:** *"The important thing to keep in mind is that Sagittal symbols indicate harmonic
  relationships relative to a chain of fifths rather than fixed melodic intervals."* and *"Since the
  Sagittal notation symbolizes intervals that are allowed to vary in size to accommodate many different
  tunings, it is necessary that sufficient information be provided in a score to specify the particular
  tuning that is intended, along with a pitch reference."* **p. 13:** reading one notation in another
  tuning *"requires a knowledge of musical acoustics that the average musician cannot be expected to
  possess, the limitations for doing this reside with the player more than with the notation."* **p. 20:**
  *"it would also be possible to have software that could translate one notation into another and then
  print any given part in whatever notation a player is comfortable with."* [PDF-TEXT]
- **Gould p. 94:** *"Symbols for any other pitches require a written definition."* p. 97: *"The pitch
  modification of the arrow must always be defined."* — the sign is empty until the score defines it.
  And p. 504 lists *"symbols used for microtonal accidentals"* and *"special tunings"* as two separate
  items to explain. [SCAN]
- **Stone p. 108** [SCAN]: *"notation must never be confused with the musical substance as such."* (Said
  of notation and music in general, not of accidentals in particular.)
- **Farhat p. 26:** keeps Vaziri's koron and sori — *"I see no reason why this symbol and its name …"* —
  while calling the theory behind them *"to a great extent refuted"*, and redefines the sign as
  flattening *"by a microtone"*. [GB-SNIPPET]
- **Signell p. 38:** *"the literal value of the accidentals can deviate at least one comma (23 cents)
  from common practice."* [GB-SNIPPET]
- **Marcus pp. 22, 26–27:** the half-flat is an *"accurate description of the notes' theoretical
  positions"*, while the sounding E half-flat of rāst is *"higher than 350 cents"*. [GB-SNIPPET]
- **Ups and downs (Xenharmonic wiki):** *"the notation (not the tuning itself) is rank-2"*; *"A chord
  quality like 'major' refers not to the sound but to the function of the chord."* [WEB]
- **HEJI 2004:** two parallel descriptions on one note — the accidentals give the RATIO, and *"Cents
  indications placed above or below the accidentals provide an alternative method of specifying pitch"*.
  [PDF-TEXT]
- **Gann on Johnston:** *"notation is only a means to an end"*. [WEB]
- **The forum post quoted in Unicode L2/23-276:** *"In every case, an arrow requires explanation in the
  performing directions, so it has no assumed meaning other than 'some kind of alteration in this or
  that direction.'"* (⚠️ a practitioner's statement quoted by the proposal, not the proposal's own.)
- **Encoding standards** (formats, not treatises): MEI v5 — `accid`: *"Captures a written accidental"*;
  `accid.ges`: *"Records the performed pitch inflection"* [WEB]. SMuFL's implementation note for Sagittal:
  *"the intended comma ratio may be determined by the note to which it is applied, or by the musical
  context."* ⛔ **SMuFL has no general statement** that accidentals are notational rather than tuning
  statements — none was found on the range pages read; its range NAMES (*"(24-EDO)"*, *"(72-EDO)"*,
  *"(just intonation)"*) and glyph descriptions (*"raise by 81:80"*) in fact bind a nominal tuning to each
  glyph. ⛔ MusicXML's `<accidental>` page: 403 today — not re-read.

⚠️ **One counter-current to record honestly.** Two systems are built so that the sign IS the sound:
Johnston (*"No two non-identical pitches … can ever have the same notation; no two pitches differently
notated can ever be the same pitch"*) and HEJI (a ratio *"directly deduced from the combined
accidentals"*). Even there the mapping is a property of the SYSTEM (Johnston's just C major vs HEJI's
Pythagorean chain; HEJI 2004 vs 2020), never of the glyph alone — which is his split, one level
up: the score holds the signs and names the system; the system holds the ratios.

---

## 6. UNKNOWN — and what was tried

| source | status | what was tried |
|---|---|---|
| Gardner Read, *20th-Century Microtonal Notation* (1990) | **snippets only**; book not read | archive.org item is lending-only (`_djvu.txt` → 401; `fulltext/inside.php` → "Item not available"); ✅ archive.org FTS search gives ~100-char snippets, chained by phrase; ✅ Google Books `id=3okYAQAAIAAJ` returns page numbers but EMPTY snippets. His per-system inventories, his own recommendations, and the Ghent quarter-tone recommendation: UNKNOWN |
| Gardner Read, *Music Notation* (1969) | snippets pp. 145–146, 393 | Google Books `id=NWUJAQAAMAAJ` search-within works with pages; archive.org lending-only |
| Karkoschka, *Notation in New Music* | snippets pp. 2–3, 25, 27 | Google Books `id=O4MYAQAAIAAJ`; archive.org lending-only |
| Ghent 1974 Conference Report (*Interface* 4/1, 1975) | **UNKNOWN** | not searched for directly; Stone does not separate the Conference's microtone decisions from his own |
| Ben Johnston's writings; Fonville 1991 (*PNM* 29/2) | **UNKNOWN** | JSTOR; not attempted beyond search. Gann's page + SMuFL used instead |
| Hába *Neue Harmonielehre*; Wyschnegradsky *Manuel*; Tartini 1754/56; Couper | **UNKNOWN** (second-hand only) | via Karkoschka, Unicode L2/24-090, Stone, Secor & Keenan |
| Grisey / Haas score prefaces (cents, sixth-/twelfth-tones) | **UNKNOWN** | `music.arts.uci.edu` PDFs (Hasegawa; Haas *5 Theses*; Skinner) all 404 |
| Ferneyhough's eighth-tone arrows | **UNKNOWN** | only SMuFL glyph names (⅓, ⅔, ¼ tone) |
| Arel / Ezgi / Uzdilek treatises; Yarman | **UNKNOWN** | Signell snippets + SMuFL + Unicode used |
| Marcus 1989 / 1993; Fokker on 31-tone notation | **UNKNOWN** | Marcus 2007 snippets used |
| Chlapik; Boosey & Hawkes house manual | **UNKNOWN** | per `reference/README.md`: no digital copy known |
| Xenharmonic wiki (live) | 403 (Cloudflare) via curl AND WebFetch | ✅ Wayback `id_` form works (gzip) |
| sagittal.org PDF | curl 403 | ✅ WebFetch retrieved the binary; `pdftotext` on it is clean |
| plainsound.org legend URLs | the old `www.plainsound.org/pdfs/…` paths 404 | ✅ `masa.plainsound.org/pdfs/notation.pdf`, `…/legend.pdf`; 2020 legend at `diva-portal.org/smash/get/diva2:1869939/FULLTEXT03.pdf` |
| SMuFL | `www.smufl.formats.music` does not resolve | ✅ `smufl.formats.music/latest/tables/<range>.html` + `raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/{ranges,glyphnames}.json` |
| Open University (Marcus-based page); MusicXML reference | 403 today | — |
| Wikipedia API | several pages 429 (rate limit) | used only as pointers anyway |

Checked-and-empty (not UNKNOWN): Ross (text layer, zero hits), Gerou & Lusk (zero hits for microtones),
MOLA guidelines (whole PDF), Gould on microtonal key signatures and on microtonal chord stacking.

---

## 7. Routes — ✅ recorded in `reference/README.md` (2026-09-30 section)

1. **archive.org full-text SEARCH works on lending-only books** even though download and search-inside
   do not:
   `https://archive.org/services/search/beta/page_production/?service_backend=fts&user_query=%22<phrase>%22%20AND%20identifier%3A<id>&page_type=search_results&hits_per_page=5&page=1`
   → `response.body.hits.hits[].highlight.text[]`, ≤5 snippets of ~100 characters around the phrase,
   `{{{…}}}` marking the hit. No page numbers. Slow (10–30 s a query; a 400 now and then). Chaining — query the
   last four words of a snippet to get the next one — rebuilds whole sentences. Worked for
   `20thcenturymicro0000read`, `musicnotationman0000read`, `notationinnewmus0000kark`.
2. **Google Books search-within gives PAGE NUMBERS even for no-preview volumes** (sometimes with empty
   snippets) — so route 1's text and route 2's page can be joined. IDs: Read 1990 `3okYAQAAIAAJ`; Read
   1969 `NWUJAQAAMAAJ`; Karkoschka `O4MYAQAAIAAJ`; Farhat `NiMhWnYDuQMC`; Signell `JHMHAQAAMAAJ`; Marcus
   2007 `wzAJAQAAMAAJ`; Partch `WRCEympsgLEC`. The old feed `https://www.google.com/books/feeds/volumes?q=…`
   still answers and is how the IDs were found (the `googleapis` v1 route is the quota-dead one).
3. Gould's *Microtones* is printed **pp. 94–98** (PDF 114–118); *Accidental systems* pp. 86–87;
   *Cancelling accidentals* p. 81; the preface checklist p. 504. Stone's *Microtones* is printed
   **pp. 67–71** = PDF 44 (right half) – 46; his *Accidentals* pp. 53–56 = PDF 37 (right) – 39 (left).
4. ✅ **Everything this pass fetched is kept in the library** (his ask, 2026-09-30: *"it would be good
   to have that in reference instead of tmp so we don't lose it"*): `reference/microtonal/` — the
   PDFs (Sagittal, HEJI 2004 and 2020, Unicode L2/23-276 and L2/24-090, MOLA), the web pages as
   fetched (`web/`, including the stitched Read and Karkoschka snippets), and the rendered Gould and
   Stone pages (`page-scans/`). Each has its row in `reference/README.md`.
