# The SLUR and the TIE — what the books say, what the engines do, and what we draw

> 📄 Written the way `docs/stem-length-research.md` and `docs/beam-slope-research.md` are written.
> ⛔ **This document builds nothing and decides nothing.** It surveys the treatises, measures their
> plates, reads the five engines at source, and ends with a table of OPEN questions that are HIS.
>
> ⚠️ **It is a survey of the BOOKS. It does not know what we decided.** Several numbers in
> `src/engine/rendering/curveStyle.ts` are already settled — the tie's height, the 0.20 sp endpoint
> lift, one weight shared between slur and tie (`docs/slur-plan.md` §13.1, §13.3, §13.8). Where a
> book disagrees with one of those, §5 reports the book's answer and says **already HIS decision**.
> ⛔ It does not re-open it.
>
> ⚠️ **Two live experiments belong to him and stay OPEN**: the `__slur` shape console knob
> (`rendering/slurShapeExperiment.ts`), and his standing judgement that *her DRAWING beats the
> formula*. Nothing below settles either.
>
> **Status 2026-09-14: researched, measured — and §8 SHIPPED a change; §§1–7 changed nothing.**
>
> ⭐⭐ **§8 (ARTICULATION ↔ SLUR) was added later the same day, from his report** — a slur over five
> staccato sixteenths drawn *"very ugly"* — and it is the one section of this document that **did**
> change code. It carries the isolation experiment that says WHY (a 0.4 sp dot moving the arc 2.3 sp),
> the four books' placement rule **and their plates measured**, the three engines' mechanisms read
> twice, and ✅ **§8.6 and §8.8, what was built**: the endpoint rule, LilyPond's `fit_factor`, and
> LilyPond's one-point accidental — with his sign-off on the first (*"the articulation slur looks
> much better now"*). ⭐⭐ **Its through-line is one sentence, earned twice in one afternoon:**
> *a rectangle grants at one x what is only true at another.* ⛔ The rest of this document still
> decides nothing.

---

## 1. The question, and why now

On **2026-09-14** the arc's INK became ours — `src/engine/engrave/curves/curveInk.ts`, the P-series
port of VexFlow's `Curve.renderCurve` into our own `paint/` primitives. That module says in as many
words what it deliberately did **not** take:

> *"⛔ **Taking the ink does NOT close the SHAPE question**: his call, 2026-09-01, was the P4a/P4b
> split applied to the curve — 'for the curve we should do it too and leave the experiment open and
> we can decide after our engine is ready' — so `__slur`'s live experiment (`CURVE_PX`, the arch
> solve, the clearance) keeps running untouched above this line."*

So the drawing is ours and the SHAPE is open by design. This is the survey that would let the shape
be chosen: what the treatises actually say and DRAW about a curve's weight, its arch, where it
attaches, and what it avoids.

⭐ **Two of the four treatises had never been asked this question.** `docs/slur-plan.md` §11.7
(2026-08-15) records Ross and Stone as *"Not obtainable (lending-restricted, so unknown rather than
silent)"*. Both have been on disk since **2026-08-18**. Ross has a whole chapter — *Ties, slurs and
phrase marks*, printed pp. 136–143 — and Stone a whole section, *Slurs and Ties:
Phrasing/Bowing/Breathing*, printed pp. 35–39. Neither had ever been read for this. That is most of
what is new here.

---

## 2. THE BOOKS

### 2.0 The sources, and how to reach each page again

| source | the slur/tie material | PDF page |
|---|---|---|
| **Gould**, *Behind Bars* | ties printed **pp. 60–72**; slurs printed **pp. 109–114** | PDF = printed **+ 20** ⇒ 80–92, 129–134 |
| **Ross**, *The Art of Music Engraving and Processing* | printed **pp. 136–143**, *Ties, Slurs, and Phrase Marks* | PDF = printed **+ 12** ⇒ 148–155 |
| **Stone**, *Music Notation in the Twentieth Century* | printed **pp. 35–39**, *Slurs and Ties* | ⚠️ **2-UP**: printed 2k / 2k+1 share PDF page **k + 11** (even LEFT, odd RIGHT) ⇒ pp. 36/37 = PDF 29, pp. 38/39 = PDF 30 |
| **Gerou & Lusk**, *Essential Dictionary of Music Notation* | slurs printed **pp. 121–127**, ties printed **pp. 143–148** | 🚨 **ALSO 2-UP, and this was never recorded**: printed P is on PDF **P/2 + 2** (even LEFT, odd RIGHT) ⇒ slurs PDF 62–65, ties PDF 73–76. The `.txt` is clean; grep it first |

⚠️ **Gerou & Lusk's own preamble** describes their rules as *"modified from the strict traditional
rules"*. Treat them as a witness with that caveat stated — they are quoted below on their own terms,
and §3 says where they part company with the other three.

❌ **MOLA's *Guidelines for Music Preparation* remain genuinely silent** on slurs and ties — checked
in full on 2026-08-15 and recorded in `reference/README.md`. ⛔ Not re-checked; nothing suggests it
changed.

---

### 2.1 ⭐⭐ GOULD, *Behind Bars* — ties pp. 60–72, slurs pp. 109–114

Quotations are from the local PDF's OCR layer, **each verified against the rendered page** at 450
dpi before being written here (the OCR mangles italics and glyphs; the prose is clean).

#### A — the shape

> p. 60, *Tie design*: *"A tie is a **tapered arc, symmetrical in shape**, which extends between two
> noteheads of identical pitch."* … *"The tie and slur (phrase mark) have the **same design**,
> although ties tend to have a **flatter arc**, to allow room for slurs and to differentiate the
> two."* … *"The tie extends from notehead to notehead: **if one or both ends point to a stem, the
> arc becomes a slur**."*

> p. 109, *Slurs → Design*: *"The slur is the **same tapered arc as the tie**, although the tie may
> have a flatter curve to allow room for slurs and to differentiate the two."* … *"When notes at the
> beginning and end of a slur are the same pitch, the slur may look identical to a tie because it
> will, like the tie, be **completely symmetrical**. When the outer pitches are different, the ends
> of the slur are at different heights and **the slur tilts between the first and last note**. Aim
> for as **consistent a curve** as possible."*

> p. 109: *"**The curve of a long slur is flattened** in order to be as close to the stave as
> possible. In fact, **a long slur may be completely flat in the middle**, since a rounded one
> extends too far from the stave."*

> p. 61, *Curve of the tie*: *"The curve of the tie should be sufficiently **round to be conspicuous
> through a stave-line**. Ideally, a **shallow tie is 1–1½ stave-spaces deep**."* … *"Ties are
> generally **confined within one stave-space** when they are very short, and when they must be
> flattened to avoid another part."* … *"The curve of a **long tie is flattened** to prevent
> excessively variable curve heights between ties."*

⛔ **THICKNESS: UNKNOWN from Gould.** She gives a thickness in stave-spaces for beams, hairpins,
tenuto lines, barlines, ledger lines and rests. For the slur and the tie she says only *"tapered
arc"*. Searched the whole tie section (pp. 60–72), the whole slur section (pp. 109–114) and the OCR
full text for `thick`, `thickness`, `weight`, `taper` in those ranges — nothing. **Measured instead,
§2.5.**

⛔ **ARCH HEIGHT for a SLUR: UNKNOWN from Gould.** No minimum, no maximum, no ratio, no table. The
only thing she constrains is the *direction* of the rule — long ⇒ flatter (p. 109) — and the fact
that the curve should sit in a stave-space (p. 110, below). The tie's *"1–1½ stave-spaces deep"* is
the only arch number in any of the four books.

#### B — where it attaches

> p. 110: *"The ends of a slur may be placed as close as **half a stave-space from the centre of
> noteheads**, including where ties are placed at the edge of noteheads (a). Where there is plenty
> of space, the tie starts and finishes at the centre of the notehead; in this case, **the slur must
> move further from the note**, so that its ends can also centre on it (b)."*

> p. 111, *Slurs at stem end*: *"Where other notes or stems will not be obstructed, **the slur may
> move slightly closer to the noteheads, beside the stems**, so as to be more conspicuous."* …
> *"Where staccato and tenuto marks fall within the slur, **the slur cannot move towards the
> noteheads but must remain at the ends of the stems**."*

> p. 111: *"When outer notes have **opposite stem directions**, move the slur at the stem end
> **towards the noteheads** so it does not tilt contrary to the direction of the pitches."* …
> *"The slur should not, however, move too close to noteheads if there is room for it to be further
> away. **It should always remain outside a beam**."*

> p. 62, *Positioning ends of tie relative to notehead*: *"Where there is **plenty of space** and no
> articulation to implement, the tie starts and finishes **at the centre of the notehead**."* …
> *"Where the tie needs to be brought closer to the notehead (e.g. to allow space for articulation),
> the ends of the tie align with the **edge of the notehead**."* … *"The tie may start **slightly
> after and finish slightly before** the notehead. When notes are in spaces, this enables the ends
> of a tie to be brought **into the same space as the notehead**."*

> p. 61: *"The tie should **almost touch each notehead**. An arc further away from the noteheads may
> be taken for a slur."*
> p. 63: *"A tie **intersects a stem only under exceptional circumstances** … In all other
> circumstances the tie should **fall short of the following stem**."*
> p. 62: *"Make ties between tightly spaced notes **as long as possible**, in order to have them
> most conspicuous."*

#### B8 — which side

> p. 110: *"When **all stems within the slur are in the same direction**, the slur is usually placed
> **between the outer noteheads**."* … *"When groups of **mixed stem direction** are encompassed by
> a slur, place the slur **above the stave**, except when a beam may be in the way."* … *"Regardless
> of stem direction, in **cramped conditions** it may sometimes be best to place a long slur above
> the stave, to be clear of dynamics."* … *"For **stemless notes**, place the slur as if the notes
> were stemmed (a). Slurs for notes on the **centre line** … are usually treated **as if the notes
> had down-stems** (b)."*

> p. 64: *"**A tie curves away from the stems** of the notes."* … *"A tie between **stemless notes**
> behaves as if stems were present."* … *Consecutive stems in opposite directions*: *"**Ties curve
> away from the middle stave-line.**"*

> p. 67: *"The **upper part** takes upward-curving ties, the **lower part** downward-curving ties"* —
> and *"This applies to **all the notes on one stem**."*
> p. 71: *"When a slur connects chords, place **ties and slurs in opposite directions** so as to be
> clearly distinguishable from one another."*
> p. 112: *"**Take all the notes within the slur into account** when determining whether the slur
> goes above or below the stave — **do not swap position between systems**."*

#### B9 — chords

> p. 63: *"**Inner ties must start after and finish before each notehead.** Outer ties may be drawn
> parallel to this, so that all ties are the same length (a). It is equally acceptable for the outer
> ties to be **full length** (b)."* … *"For close-position chords, it is best if ties **start in the
> same stave-space as the notehead**."*

> p. 65, *Tie direction on single-stemmed chords*: two notes on a stem ⇒ *"the ties curve in
> **opposite directions**"*; an **even** number ⇒ *"equal numbers of ties curve in each direction"*;
> an **odd** number ⇒ *"the **majority** of ties curve away from the stem"*.
> 🚨 And then, as a **labelled counter-example**: *"Some editions tie middle notes of both odd- and
> even-note chords **according to their position on the stave**. Ties for notes on and above the
> middle stave-line curve upwards, ties for notes below the middle line curve downwards:
> **not recommended**."* ⭐ That is **Ross's rule and Gerou & Lusk's rule**, named and rejected — see
> §3.2.

> p. 65: *"Place ties that are in the **same direction a minimum of one stave-space apart**. This
> applies to ties both on and outside the stave. One tie per stave-space prevents the ties from
> obscuring stave-lines or merging together."* ⭐ **The only inter-tie NUMBER in any book.**
> p. 66: adjacent (second-apart) notes *"are curved **away from each other** … The adjacent notes
> dictate the direction of all other ties in the chord, **overruling the usual tie-direction
> conventions** for the rest of the chord."*
> p. 69, *Tied unisons*: *"Each notehead requires its own tie … the **upper tie for the note on the
> left** and the **lower tie for the note on the right** … Ties must not overlap nor cross; it is
> better to point the ties to the 'wrong' notehead."*

#### C — what it avoids

> p. 61: *"The **centre of the curve should not coincide with a stave-line**, since the tie then
> becomes less conspicuous. This means that **ties drawn within the stave will usually cut through a
> stave-line**."*
> p. 110: *"**On a stave, the arc should be placed in a stave-space** in order to be most
> conspicuous"* — ⭐ she says it of the **SLUR** too, with an *and / not* pair.
> p. 65, *On ledger lines*: *"Either **flatten the ties** (a) or **move them horizontally further
> from the noteheads** (b) in order to avoid them touching ledger lines (c)."*
> p. 68: *"A tie should **not pass between ledger lines**. A tie by nature should be kept **as flat
> as possible**, to distinguish it from a slur. Therefore it is sometimes clearest to **break the
> tie**."* … *"When the curve of the tie is too rounded, it looks too much like a slur."*
> p. 63, with dots: *"Place the **dot within the tie** — the tie does not follow the dot. **Curve the
> tie sufficiently to avoid obscuring the dot.**"*
> p. 113, *Slurs within slurs*: *"the shorter one represents articulation, the longer one the phrase
> structure. **The shorter slur goes closest to the notes.**"*

⛔ **A CLEARANCE NUMBER for a slur over an interior note: UNKNOWN from Gould.** She states the
*constraints* — outside a beam (p. 111), the arc in a stave-space (p. 110) — and never a distance.
Searched pp. 109–114 and pp. 320–322 (*Placing slurs*, keyboard).

#### C12 — across a system break

> p. 112: *"At the end of a system, the slur **finishes just short of the last barline**, and not
> beyond it. At the beginning of the new system, the slur **starts after the clef, key signature and
> time signature, but before any accidental**. The incomplete slur should look **clearly
> open-ended**, or each side of the system break will appear to take a separate slur."*
> p. 112: *"**The whole slur should tilt in the direction of the pitches.** A slur starting on the
> last note of a system or finishing on the first note of a system must be **angled in the direction
> of the final pitch on the new system**, so as to look clearly open-ended (this **differentiates an
> open-ended slur from an open-ended tie**)."*
> p. 65: *"A tie stops short of the last barline of a system. At the start of a new system the tie
> begins after the clef, key signature and time signature. **Tie direction remains consistent** over
> the system break … Over a system break, the **open-ended tie keeps its symmetrical shape**. This
> symmetrical curve ensures it is not mistaken for a slur nor a glissando line"* — the counter-example
> beside it is labelled **"ties too flat"**.

⭐⭐ **So Gould distinguishes the two halves by KIND, not by matching them**: the broken slur must be
*angled*, the broken tie must stay *symmetrical*, and that difference is the whole point — it is what
tells the reader which one they are looking at.

---

### 2.2 ⭐⭐ ROSS, *The Art of Music Engraving and Processing* — printed pp. 136–143

**Never read for this question before.** Ross's chapter is a hand-engraver's, so much of it is about
the *compass* and the *template*; what survives the translation is a set of rules stated more
bluntly than anywhere else, plus a **drawn** correct/incorrect pair for the tie's own profile.

#### A — the shape

> p. 136: *"With one exception, **a tie is always horizontal** (in the case of the enharmonic change
> of notation, a tie may or may not be horizontal). If a tie is in the staff, **the center of its
> curve falls in a space**, and does not touch the staff-lines above or below. A tie usually extends
> **from notehead to notehead, but does not touch them**. It is also possible for the tie to extend
> **from stem to notehead**."*

🚨 That last clause is a **direct contradiction of Gould p. 60** (*"if one or both ends point to a
stem, the arc becomes a slur"*), and Ross prints an example of it. See §3.2.

> pp. 136–137, with an **INCORRECT** figure: *"**A tie is not crescent-shaped**, as many copyists and
> autographers lead one to believe; rather, it is **slightly curved**, and has a **thick center which
> gradually tapers to uniformly thin ends**."*

> p. 137: *"The tie is always drawn from left to right, with its loop directed upward … Put
> **gradually increasing pressure** on the compass as the quill reaches the center of the tie. The
> flexible point allows **the center of the tie to widen**."*

> pp. 140–141: *"**A long slur is a straight line with both ends bending uniformly towards the
> enclosed notes.**"*

⭐⭐ That sentence is Ross's independent statement of Gould p. 109's *"a long slur may be completely
flat in the middle"* — **two books, and Ross's is the more literal of the two**.

> pp. 139–140: *"The short slur is constructed in the same way as a tie, although its function is
> entirely different. Whereas **the tie is always horizontal, the short slur follows the rise or fall
> of the notes it connects**."*

⛔ **THICKNESS as a NUMBER: UNKNOWN from Ross.** He is explicit that the centre is thick and the ends
uniformly thin, and gives no stave-space figure — unlike his stem, beam, wedge and repeat-sign
numbers. Searched pp. 136–143 and the index entry *ties*. **Measured instead, §2.5.**
⛔ **ARCH HEIGHT as a NUMBER: UNKNOWN from Ross.** *"Slightly curved"*, *"the center … clearly within
a space"*, and no figure.

#### B — where it attaches

> p. 141: *"**Long slurs always start and end over or under the center of a notehead.** When the
> beginning or ending of the long slur is over a stem, then **the stem itself serves as the starting
> or terminating point**."* … *"When a slurred passage ends in tied notes, the long slur extends to
> **the second note of the tie**."* … *"Long slurs are **never left 'hanging' in blank space**; they
> must always have a definite place of termination."*
> p. 140: *"A short slur may go **from stem to stem**."* … *"Quite often slurs on flagged notes
> create problems. It is much clearer to place them **out of the way of the staff and flags** as
> would be done with a beam."* … *"Ties may be placed **within** beamed notes. Short slurs, however,
> usually **link the outsides** of beamed notes."*
> p. 142: *"Two notes of the same pitch can be **tied, but never slurred**."*

#### B8/B9 — which side, and chords

> p. 138: *"In single-part music the tie goes above or below the notehead, **according to the stem
> direction**: if the stems point upward, then the tie is placed **below** the notehead … if the
> stems point downward, then the tie is put **above** the notehead."* … *"**Imagine whole notes as
> stemmed**, and draw the ties for them in the same way as for stemmed notes."*
> p. 140: *"if a short slur connects two or more notes with stems in the same direction, then the
> slur is placed **on the notehead end**. If the stems of a group of notes are going in **opposite
> directions, the short slur always goes on top**."*
> p. 140: *"If tied notes appear in a chord structure that is also notated with a short slur, then
> the loops of the tie and slur should be aimed in the **opposite directions**."*
> p. 140: *"**A single slur is sufficient** to show legato for a progression of chords (some
> proofreaders and editors, however, demand a slur for each pair of notes)."*

> p. 138, chords: *"the **highest** note has its tie **above** its notehead, and the **lowest** note
> has its tie **below** its notehead. The **inner** notes have their ties placed **according to their
> location in the staff**: usually notes **above the middle staff line** have ties above their
> noteheads; notes **below the middle staff line** have ties below their noteheads. If not all notes
> on a stem are tied, then the **uppermost tied** notes have their tie above, and the **lowest tied**
> notes below."*

🚨 The inner-note rule is exactly what **Gould p. 65 labels *not recommended***. §3.2.

> p. 139: *"To keep ties and noteheads from conflicting, it is sometimes necessary to **rearrange the
> established pattern** for the placement of ties"* (suspensions), and *"**Keep dotted notes from
> interfering with ties** by either slightly raising or lowering the dots, or by **starting the ties
> after the dots**."*

#### C — what it avoids

> p. 137: *"**The center of a tie should fall clearly within a space** and touch a staff line only
> when unavoidable."*
> p. 137: *"A tie for notes that are **far apart** will not fit between the staff lines. To make up
> for this, **the ends of the tie must pass through the staff lines**, leaving the center of the tie
> clearly within a space."*
> pp. 139–140, with a **NOT CLEAR / CLEAR** pair: *"A short slur usually must cross staff lines;
> therefore make the contrast of the short slur and the horizontal staff lines obvious by **letting
> the slur clear the staff**."*
> p. 142: *"**Marcato accents are placed outside of a tie.** Staccato dots and tenuto accents are
> usually placed **within** the tie or slur."*

⛔ **SYSTEM BREAK: UNKNOWN from Ross.** His only statement near it is *"Long slurs are never left
'hanging' in blank space"* (p. 141), which is about a slur with no end note, not about a line break.
Searched pp. 136–143 in full, plus `grep -n` over the extracted full text for `line to line`,
`system`, `next line`, `continued` in that range. Nothing.

---

### 2.3 ⭐⭐ STONE, *Music Notation in the Twentieth Century* — printed pp. 35–39, **and §11 at pp. 42–43** (§8.7)

**Never read for this question before**, and it turns out to be the book with the most
*system-break* content of the four.

#### A — the shape

❌ **Stone gives NO shape numbers at all**: no thickness, no arch height, no endpoint gap. His section
is entirely about POSITION, DIRECTION and the line break. Checked the whole of pp. 35–39 and the
index entries *Slurs and Ties*, *Phrasing*, *Articulation signs in combination with slurs and ties*.
⛔ Do not check again for a shape number.

#### B8 — which side

> p. 36: *"The placement of slurs and ties above, below, or within the staff is governed by the
> positions of the note-heads: **if they point up, the slurs or ties must be above the notes; if the
> note-heads point down, so must the slurs and ties**."*
> p. 36: *"In mixtures of up and down note-heads, **the slurs must be placed above the notes, even if
> only one single note-head points up** in the group to be slurred."*
> p. 37: *"The curve of a tie is governed by the up or down positions of the two tied note-heads.
> **If both tied note-heads point down, the tie also curves downward**, regardless of the position of
> the slur, which is governed by the total phrase."* … *"**If one or both of the tied note-heads
> point up, the tie curves upward.**"* … *"If the **stem directions change** in the course of a
> series of tied notes, the directions of the ties' curvatures **must change accordingly**."*
> p. 37: *"Slurs and ties on **whole notes** are treated **as if the notes had stems**."*

🚨🚨 **READ THE PLATE BEFORE READING THAT SENTENCE.** As prose it appears to invert everybody else —
"note-heads point down ⇒ tie curves downward" reads as *stem down ⇒ tie below*, which is the opposite
of Gould, Ross and Gerou & Lusk. **It is not.** Rendered at 300 dpi (printed p. 37 = the RIGHT half
of PDF 29) and read as a picture, his *"both note-heads point down"* example draws **stems UP with
the tie BELOW the heads** — i.e. Stone's *"the note-head points down"* means *the head hangs at the
bottom of its stem*, not *the stem points down*. ⭐ **With that reading Stone says exactly what the
other three say: the curve goes on the NOTEHEAD side, away from the stem.** The same plate is also
his illustration of the tie/slur split — the tie below (away from the stems), the phrase slur above
(*"governed by the total phrase"*).

⭐ This is the *"a SCAN beats an OCR"* rule paying off in the opposite direction from usual: the
picture did not overturn the sentence, it **disambiguated** a sentence that would otherwise have been
written up as a fourth opinion.

> p. 39, *Slurs and ties in double-stemmed notation*: *"In such cases, **all rules given so far are
> suspended**, since in double stemming, **all slurs must be at the stem-ends** of the upstemmed and
> downstemmed parts, respectively, and **all ties, although close to the notes, must curve in the
> direction of the respective stems**."*

#### C12 — across a system break: Stone is the fullest source

> p. 37: *"At the end of a line, **neither slurs nor ties should extend beyond the barline**."*
> p. 38: *"If the line ends with a **change of time signature**, the slurs and ties still extend only
> to the barline and **not beyond**."* … *"If the line ends with a **change of clef**, the slurs and
> ties should **stop just before the new clef**."*
> p. 38: *"At the beginning of the next line, the slurs or ties begin **just after the clef**."* …
> *"If there is a **new time signature**, the slurs and ties begin **just after it**."* … *"If there
> is a **key signature**, the slurs and ties begin **just after it**."*
> p. 38: *"The up or down positions of ties and slurs going from one line to the next are governed by
> **the complete phrase, regardless of the break** from line to line. **This will occasionally result
> in wrong-looking slur and/or tie positions**"* — with a drawn COMPLETE PHRASES / END OF LINE / NEXT
> LINE triptych.

⭐ That last one is Gould p. 112's *"do not swap position between systems"* from a second source, and
Stone is the only writer who admits out loud that obeying it **looks wrong** on one of the two halves.

#### Other

> p. 37: *"tied notes **ought to be included under the slur**, since the slur should always embrace
> the entire passage in question"*, and the chained slur-per-tie alternative is *"**not
> recommended**, because it often makes the phrasing difficult to recognize."*
> p. 36: dotted phrasing slurs *"should be placed **above the music** to prevent interference with
> dynamics and vocal texts. Only if differently phrased parts appear on the same staff should dotted
> slurs be placed above and below."*
> p. 38: *slur-to-slur notation* — chain slurring on a shared note, *"used when a phrase ends on a
> note which also represents the beginning of the next phrase."*

---

### 2.4 GEROU & LUSK, *Essential Dictionary* — slurs pp. 121–127, ties pp. 143–148

⚠️ Their preamble calls their rules *"modified from the strict traditional rules"*. Read accordingly.

#### A — the shape

❌ **No thickness, no arch height, no gap — as numbers.** They give one *procedural* arch rule, which
no other book states and which is a real answer to "what does a long tie do":

> p. 145: *"**Adjust curve for longer ties. Raise or lower the center of the curve to the next
> space.**"*

⭐ i.e. the tie's depth is **quantised to whole stave-spaces**: it grows by one space at a time so that
its belly always lands in a space. That is a different mechanism from Gould's continuous *"flatten
the long tie"* and from every engine's `√length` — see §3.2.

> p. 148: *"Whenever possible, **maintain the curve of a tie in uncommon situations. It should look
> like a tie, not a slur.**"*
> p. 143: *"The shape of a tie is somewhat similar to a slur, but the placement, positioning and use
> of ties and slurs are different; **the two should not be confused**."*

#### B — where it attaches

> p. 144: *"**Begin to the right of the notehead. End to the left of the next notehead. The tie does
> not touch the noteheads.**"* and p. 143: *"**Begin and end on the same horizontal level.**"*
> p. 144: *"**Ties should never collide with augmentation dots.** Begin the tie to the **right of an
> augmentation dot**."*
> p. 123, slurs on the notehead side: *"the beginning and ending of the slur should be **centered on
> the notehead**. **It should not touch the notehead.**"*
> p. 123, slurs on the stem side: *"Place the beginning of the slur so it starts **mid-stem (to the
> right of the stem, never begin to the left, crossing the stem)**. In some cases the slur may begin
> at the **end of the stem**."* … *"**Begin at the end of the stem if beaming is involved. Never cross
> the beam with a slur.**"* … *"Place the end of the slur so it **slopes towards the notehead, away
> from the end of the stem**. **Center the slur on the notehead.**"*

#### B8/B9 — which side, and chords

> p. 121: *"The **stemming** of the notes is the main factor … **When stems extend up, the slur is
> placed under, on the notehead side. When stems extend down, the slur is placed over, on the
> notehead side. When stems are in both directions, the slur is always placed over.**"*
> p. 122: *"If the notes are **whole notes, imagine the stems!**"* and *"If the phrase is
> **substantially long**, the slur may be placed **over, regardless of stem direction**."*
> p. 145: *"**Curve ties opposite of stem direction.** Stem down — curve above notehead. Stem up —
> curve below notehead."* … *"**For mixed stem direction, the tie is always placed above.**"*
> pp. 121 / 145: two parts on one staff ⇒ slurs and ties **above for the upper, below for the lower**.
> p. 147, chords: *"**Highest note — tie is above. Lowest note — tie is below.** Notes between highest
> and lowest **on the middle line and above, ties are above. Below the middle line, ties are
> below.**"* … *"For intervals of a **2nd**, ties will be in **opposite directions** whenever
> possible."* … *"If some notes are not tied within the chords, the **uppermost tied note has the tie
> above**; the **lowermost tied note has the tie below**."*
> p. 147: *"**Align ends of ties within a chord.** Tie ends for intervals of a 2nd should be adjusted
> if possible."*
> p. 126: *"When slurs and ties are both involved in a chord progression …, position the **slur
> opposite to the tie and at a noticeable angle**."*
> p. 124, *slur direction*: *"If the direction of the phrase **ascends**, the slur will slope upward.
> If the direction of the phrase **descends**, the slur will slope downward."* … *"When a slur begins
> and ends on the **same note**, the slur can remain on the **same horizontal level**."*
> p. 127, *elisions*: *"one slur might end at the same point where another slur begins. The two slurs
> **share the center of the notehead (elide) without touching each other**."*

#### C — what it avoids

> p. 145: *"**Avoid touching staff lines. Place the center of the curve in a 'space.'**"*
> p. 145: *"**Ends of ties may cross staff lines — it is better to cross even slightly, than to just
> touch a staff line.**"* ⭐ The most explicit statement anywhere that a curve *touching* a line is
> worse than a curve *crossing* one.
> p. 148: *"If a **time signature interrupts a tie, break the tie** to avoid colliding with the time
> signature."*

#### C12 — across a system break

> p. 125: *"**Align the end of the slur with the end of the staff.** The slur **ends at an angle**
> (ascending or descending) at the end of the staff."* … *"Continue the slur in the lower staff
> **immediately after the key signature (or clef)**, also **at an angle**. Be sure the first note is
> **far enough to the right so that it is very clear that the slur does not begin on the note**."* …
> *"If the slur is over the staff it **remains over** when continuing on the next staff."* … *"The
> direction of the slur (ascending or descending) **continues logically** in the following staff."*
> p. 146, ties: *"**Align end of tie with end of staff.** Continue tie in the lower staff
> **immediately after the key signature (or clef)**."* … *"**Beginning and ending points always remain
> on the same horizontal level.**"*

⭐ Note the **slur/tie split again, from a fourth source**: the broken slur *ends at an angle*, the
broken tie *stays level*.

---

### 2.5 ⭐⭐ THE PLATES, MEASURED — because three of the four books give no number

Rendered with `pdftoppm -r 450` and measured by per-column ink profile; the staff-space scale was
taken from the five staff lines of the figure itself, so every figure is measured on its own ruler.

#### Gould, printed p. 61 (PDF 81) — 1 sp = **20.1 px**; her staff line measures **0.106 sp**

| figure | tie span | apex over the tip chord | total ink depth (tip → far edge) | belly |
|---|---|---|---|---|
| *"will usually cut through a stave-line"*, 1st | 6.96 sp | **0.87 sp** | 1.04 sp | 0.27 sp |
| the same, 2nd (the *"or"*, confined to one space) | 4.47 sp | **0.32 sp** | 0.45 sp | — |
| the *"or"* below it, tie above two heads | 2.68 sp | **0.30 sp** | 0.40 sp | — |

#### ⭐⭐ Gould, printed p. 62 (PDF 82) — the controlled experiment

Her three figures on this page draw the **same two-note tie three times**, changing only the endpoint
rule. 1 sp = **20.06 px**; the two notehead centres are 8.5 sp apart in every one.

| her caption | tie ink span | **apex over its own chord** | tip above the head centre | belly | where the tip ink lands |
|---|---|---|---|---|---|
| *"the centre of the notehead"* | 8.13 sp | **1.52 sp** | 1.17 sp | **0.30 sp** | head centre **+0.27 / −0.07 sp** |
| *"the edge of the notehead"* | 6.88 sp | **0.97 sp** | 1.12 sp | **0.30 sp** | head **edge ±0.15 sp** |
| *"slightly after … slightly before"* | 5.48 sp | **0.47 sp** | 0.62 sp | **0.30 sp** | **0.80–0.90 sp beyond** the head's edge |

⚠️ **The caveat that matters**: a tapered tip has no measurable end — the ink fades out before the
mathematical endpoint. So "tip above the head centre" is an upper bound on where the *visible* ink
starts, not the endpoint the engine would author; the *apex over the chord* row is measured between
two visible tips and is the sounder of the two.

**What that table says, and it is new:**

1. ⭐⭐ **Her DRAWING states her endpoint sentence exactly.** *"Centre of the notehead"* draws the tip
   over the head's centre to within a quarter space; *"edge of the notehead"* draws it on the edge to
   within 0.15 sp. This is the rarer case where the plate simply **confirms** the prose.
2. ⭐⭐ **The three variants differ in HEIGHT as much as in x** — 1.52 → 0.97 → 0.47 sp of apex on the
   same two notes. Moving the tips inward flattens the tie by a factor of three. **No book says this
   and no engine models it**: in all five engines the arch is a function of length (or a constant)
   and the endpoint rule is a separate decision.
3. ⭐⭐ **It resolves what `docs/slur-plan.md` §13.2 left open.** §13.2 could not decide whether
   *"a shallow tie is 1–1½ stave-spaces deep"* (p. 61) meant the apex over the chord or the total
   reach from the notehead, because *no engine draws 1 sp of apex at an ordinary length*. Her own
   plate draws **0.97 sp and 1.52 sp of apex over the chord** on an 8.5 sp tie — i.e. **the two ends
   of her stated band, measured the first way.** Under that reading every engine, and ours, is
   flatter than she draws. ⛔ §13.1 is HIS decision and is not re-opened by this; the measurement is
   reported, not applied.
4. ⭐ **Her belly measures 0.30 sp** (by ink mass, ≈2.8× her own staff line) — identical on all three
   variants and on p. 61. See §3.1.

#### Ross, printed p. 137 (PDF 149) — 1 sp = **25 px** ⚠️ a coarse photo-reproduction; ink bleeds

| figure | tie span | apex over the tip chord | belly |
|---|---|---|---|
| *"the center of a tie should fall clearly within a space"*, tie A | ≈1.9 sp | ≈**0.34 sp** | ≈0.24 sp |
| the same, tie B | ≈3.2 sp | ≈**0.44 sp** | ≈0.28 sp |

⚠️ Ross's staff lines measure 0.16–0.24 sp on this scan against Gould's 0.106 — the plate is a
photograph of a printed page and everything is fatter. **Read these as ratios, not as absolutes**:
his belly is ≈1.2–1.4× his own staff line where Gould's is ≈2.8×. ⛔ I would not carry Ross's
absolute 0.24–0.28 sp into a decision.

#### What was NOT measured, and why

⛔ **Gould's SLUR arch, as a length→height table: UNKNOWN.** Her p. 109 *"and / not"* pair for the
long slur and her p. 110–112 slur figures were rendered and profiled, and the arcs there run over
noteheads, stems and beams inside the same x-window, so a per-column ink profile cannot separate the
curve from the music without hand-tracing each one. The p. 111 pair already scanned in
`reference/gould-scans/` is the one slur plate in this project that has been measured, and what it
showed is on record: **her drawing disagreed with the formula attributed to her.** Re-measuring the
slur's arch against span is a real piece of work and it was not done today.

---

## 3. UNANIMITY AND DISAGREEMENT

### 3.1 ⭐ Where the books agree — this part is not a taste call

| # | the rule | Gould | Ross | Stone | Gerou & Lusk |
|---|---|---|---|---|---|
| 1 | The curve is a **tapered arc**: thick at the belly, pinching to points | p. 60 | pp. 136–137 (+ an INCORRECT crescent) | — | p. 143 (by reference to the slur) |
| 2 | **Slur and tie are the same design**; the tie is the flatter of the two | pp. 60, 109 | pp. 136, 139–140 | — | pp. 121, 143 ("should not be confused") |
| 3 | A **tie is level**; a **slur tilts with the melodic line** | pp. 60, 109 | pp. 136, 139–140 | p. 37 | pp. 143, 124 |
| 4 | The curve goes on the **notehead side, away from the stems** | pp. 110, 64 | pp. 138, 140 | p. 37 (⚠️ read the plate, §2.3) | pp. 121, 145 |
| 5 | **Mixed stem directions ⇒ above** | p. 110 | p. 140 | p. 36 | pp. 121, 145 |
| 6 | **Stemless / whole notes**: place as if they were stemmed | p. 110 (slur), p. 64 (tie) | p. 138 | p. 37 | pp. 122, 145 |
| 7 | The curve's **belly must sit in a stave-space**, never along a line | pp. 61 (tie), **110 (slur)** | p. 137 (tie), pp. 139–140 (slur) | — | p. 145 |
| 8 | A **long** curve is **flatter** | p. 109 (slur), p. 61 (tie) | pp. 140–141 (*"a straight line with both ends bending"*) | — | ⚠️ **the opposite** — p. 145, see §3.2 |
| 9 | **A slur never crosses a beam** — it stays outside | p. 111 | p. 140 | — | p. 123 (twice, *"Never cross the beam with a slur"*) |
| 10 | At a **system break** the curve stops **short of the barline** and resumes **after the clef/key/meter** | p. 112 (slur), p. 65 (tie) | — (UNKNOWN) | pp. 37–38 (the fullest) | pp. 125, 146 |
| 11 | **Direction does not change** across a system break | p. 112 | — | p. 38 (*"will occasionally result in wrong-looking … positions"*) | p. 125 |
| 12 | The broken **slur** half is **angled**; the broken **tie** half stays **level/symmetrical** | pp. 112, 65 | — | — | pp. 125, 146 |
| 13 | A **tie and a slur on the same music go in opposite directions** | p. 71 | p. 140 | p. 37 (drawn) | p. 126 |
| 14 | **Two parts on one staff**: upper curves above, lower below | p. 67 | p. 139 | p. 39 | pp. 121, 145 |
| 15 | **Ties dodge augmentation dots** | p. 63 (dot *inside* the tie) | p. 139 | — | p. 144 |

⭐ Rows 7, 9, 10, 11 and 12 are unanimous among every book that speaks to them, with no dissent
anywhere — and **rows 7 and 12 are the two that our code answers least completely** (§5).

### 3.2 ⚠️ Where they disagree

| the question | the split |
|---|---|
| ⭐⭐ **An INNER tie in a chord** | **Gould p. 65 names the other rule and rejects it.** She: an even number of ties ⇒ equal numbers each way, an odd number ⇒ the majority away from the stem, and *"some editions tie middle notes … according to their position on the stave … **not recommended**"*. **Ross p. 138 and Gerou & Lusk p. 147 are that rejected rule**, stated as the norm: above the middle line ⇒ tie above, below ⇒ below. ⇒ **2 books vs 1, with the 1 having read the 2.** |
| ⭐⭐ **May a tie end on a STEM?** | **Gould p. 60: no, definitionally** — *"if one or both ends point to a stem, **the arc becomes a slur**"*. **Ross p. 136: yes**, with a drawn example — *"It is also possible for the tie to extend from stem to notehead"*. Gould p. 63 allows a tie to *intersect* a stem only *"under exceptional circumstances"*. |
| ⭐⭐ **What a LONG tie does** | **Gould p. 61 and Ross pp. 140–141: flatter.** **Gerou & Lusk p. 145: deeper, in whole-space steps** — *"Adjust curve for longer ties. Raise or lower the center of the curve to the next space."* Their mechanism is not a flattening at all; it keeps the belly in a space by growing the arch. ⚠️ This is exactly the kind of rule their preamble warns is *"modified"*. |
| **A slur ending at a stem** | **Gould p. 111 and Gerou & Lusk p. 123: the slur may come *closer* to the noteheads beside the stem** (Gould) / *"starts mid-stem, to the right of the stem"* (G&L) — i.e. **mid-stem is allowed**. **Ross p. 141: the stem TIP** — *"the stem itself serves as the starting or terminating point"*. |
| **A long slur's side** | **Gould p. 110 and Gerou & Lusk p. 122 agree against stem direction** in one case only: a *long* slur / *"substantially long"* phrase may go **above regardless**, for room. Ross and Stone do not offer the exception. |
| **Double-stemmed slurs** | **Stone p. 39: at the STEM-ENDS**, *"all rules given so far are suspended"*. Gould p. 67 states the double-stem rule only for **ties** (upper up, lower down). No contradiction — but Stone is the only source for the slur half of it. |
| **Where a broken half resumes** | **Gould p. 112: after clef/key/meter but BEFORE any accidental** — the only book that names the accidental. Stone p. 38 and G&L p. 125 say *"just after the clef / key signature"* and stop there. |

### 3.3 ⛔ What NO book answers — UNKNOWN, with what was checked

| the question | checked |
|---|---|
| **Slur/tie THICKNESS as a number** | Gould pp. 60–72, 109–114 + full-text grep for `thick`; Ross pp. 136–143 + index *ties*; Stone pp. 35–39 + index; G&L pp. 121–127, 143–148. ⇒ **The only published numbers are SMuFL's (`engravingDefaults`) and the five engines' — §4.** Measured off the plates in §2.5. |
| **Slur ARCH HEIGHT as a number or law** | the same ranges. Gould constrains only the *direction* (long ⇒ flatter). ⇒ **UNKNOWN from the books.** The length→height table in `docs/slur-plan.md` §11.7 (0.7 / 1.7 / 3 / 3.25 sp) is a working engraver's, from the notat.io forum thread `t=107`, recorded there on 2026-08-15; ⚠️ **it is second-hand and was not re-verified today.** |
| **A clearance NUMBER between a slur and a note it passes over** | Gould pp. 109–114 and pp. 320–322; Ross pp. 136–143; G&L pp. 121–127. All four state the *constraint* (outside the beam, clear of the staff, don't obscure) and none a distance. ⇒ **UNKNOWN from the books; every number we use for this is an engine's.** |
| **A clearance NUMBER between a curve and a staff line** | same ranges. All four say the belly goes in a *space*; none says how far from the line. ⇒ **UNKNOWN from the books.** |
| **A MAXIMUM SLANT for a slur** | Gould pp. 109–112; Ross pp. 139–141; Stone pp. 35–39; G&L pp. 124–125. Every one of them says only that the slur **follows the melodic line**. ⇒ **UNKNOWN — there is no published maximum**, which is what `SLUR_MAX_SLANT_DEG`'s own comment already says. |
| **Whether the two halves of a broken curve should MATCH** | Gould p. 112 / p. 65; Stone p. 38; G&L pp. 125, 146. All four constrain each half's *own* shape (angled for a slur, level for a tie) and its *direction*; **none asks the two halves to agree in height or curvature.** ⇒ the repo's belief is **confirmed from the books as well as from the engines** (§4). |
| **Ross on the system break** | pp. 136–143 read in full + full-text grep for `line to line`, `next line`, `system`. ⇒ **UNKNOWN — Ross is silent.** ⛔ Do not check again. |
| **Stone on any shape number** | pp. 35–39 in full + index. ⇒ **Nothing.** ⛔ Do not check again. |

---

## 4. THE ENGINES

Five, read at source. Units are stated per engine, and every row carries `file:line`.
⚠️ **Line numbers drift.** Two of the numbers this repo had recorded were off by one when re-read
today — `src/tie.cpp:381/391` are now **`:380`/`:390`**, expressions unchanged. Verify before citing.

### 4.1 LilyPond — `~/dev/engine-sources/lilypond`, HEAD `beedbfa0`

⚠️ **Unit trap**: LilyPond's *thickness* properties are **multiples of the staff-line thickness**, not
staff spaces, and several `tie-details` keys are in **half** staff-spaces (the source comment
`// in half-space`, `lily/tie-details.cc:61`).

| row | value | where |
|---|---|---|
| **thickness** | `thickness` **1.2**, `line-thickness` **0.8**, *both in units of the staff line* — and the default staff line is 0.5 pt = **0.10 sp** (`scm/paper.scm:52-64`) | `scm/define-grobs.scm:3184`/`:3179` (Slur), `:3906`/`:3904` (Tie), `:2849`/`:2843` (PhrasingSlur) |
| **drawn thickness** | tip = the pen = **0.08 sp**; belly = `0.75 × 1.2 + 0.8` staff-lines = **0.17 sp**. The 0.75 is the cubic's midpoint fraction, ⚠️ derived, not stated in the source — and `scm/define-grob-properties.scm:1351` *claims* `thickness` is the full arc separation, which the code does not do | `lily/lookup.cc:394-458`, `bezier_sandwich` `:483-516` |
| **arch law** | `h(w) = h_inf · (2/π) · atan(π·w·r₀ / (2·h_inf))` — an **atan asymptote**. `h` is the CONTROL height; drawn apex = 0.75 h | `lily/bezier-bow.cc:28-38` |
| **its parameters** | Slur `height-limit` **2.0 sp** / `ratio` **0.25**; PhrasingSlur 2.0 / 0.333; **Tie 1.0 / 0.333**. ⇒ slur apex → 1.50 sp at ∞, tie apex → **0.75 sp** at ∞ | `scm/define-grobs.scm:3177`,`:3181`; `:2842`,`:2846`; `:3881`,`:3891` |
| ⚠️ **a real asymmetry** | the slur's `h_inf` is multiplied by `staff_space_` (`slur-scoring.cc:709-719`); **the tie's is not** (`tie-details.cc:50`). On a small staff the two scale differently | as cited |
| **indent** | `indent = 2h_inf − q²·max_fraction/(w+q)`, `max_fraction = 1/3.1` — the inset **grows with length** to fight *"hookiness at the end"* (its own word) | `lily/bezier-bow.cc:111-115` + the comment `:78-104` |
| **apex centred?** | yes, by construction; `eccentricity` exists and **defaults to 0** and is read nowhere else. The only real asymmetry is a horizontal nudge for tilted slurs: `−dir · headWidth · sin(angle)/3`, commented *"TODO: parameter"* | `slur-configuration.cc:176-190`; `slur-scoring.cc:781-793` |
| **slur endpoint** | the **note HEAD** — head extent **+ 0.5 sp** (`slur-scoring.cc:556-557`), x at the head's centre; **+0.15 sp more** if that lands on a staff line (`:652-655`) |  |
| **…switching to the stem** | during enumeration: if the stem points the slur's way and `stem_y.widen(0.25 sp)` contains the candidate, x becomes the stem's far edge **∓ 0.3 sp** | `slur-scoring.cc:738-760` |
| **tie endpoint** | ⭐ **a SKYLINE, not a point** — head boxes, dots, stem (+`ss/20`), flag, chord-mates and accidentals, padded `skyline-padding` 0.05 sp; above the top head the box's near edge is **3/4 across the head**. Then **both tips pull back by `note-head-gap` 0.2 sp** | `tie-formatting-problem.cc:116-261`, `:72-87`, `:580` |
| **tie vs stem** | clamped to the stem's far edge ∓ `stem-gap` **0.35 sp** | `:591-607` |
| **slur side** | DOWN unless some rest-free note column has a **downward** stem ⇒ UP | `lily/slur.cc:47-70` |
| **tie side** | opposite the stem; **both stems up ⇒ DOWN**; stems conflicting ⇒ falls through to `neutral-direction` (**UP**). ⭐ Its own comment cites **Wanske p. 231** and **Ross p. 136ff** by name, and then asks *"And why not return UP if both stems are DOWN?"* | `lily/tie.cc:84-127` |
| **chord ties** | one `Tie` per head, all in a `TieColumn` solved **together**: lowest ⇒ `sign(position)`, top ⇒ UP, seconds pushed apart, then a 1-opt search with `tie-tie-collision-penalty` 25 at **0.45 sp** and `tie-column-monotonicity-penalty` 100 | `tie-formatting-problem.cc:1024-1083`, `:871-882` |
| ⭐⭐ **staff lines** | **the tie is a SEARCH.** Tip on a line ⇒ move by `tip-staff-line-clearance` 0.45 half-sp = **0.225 sp**; a short tie inside the staff ⇒ `center_tie_vertically`; a taller tie's **apex** near a line ⇒ move by `center-staff-line-clearance` 0.6 half-sp = **0.3 sp**. Plus 15 scoring terms, two of them staff-line penalties (weight 5) | `tie-formatting-problem.cc:521-561`, `:753-791` |
| **slurs and staff lines** | the same idea for slurs: `gap-to-staffline-inside` **0.2 sp** / `-outside` **0.1 sp**, plus half the curve's own thickness at that t | `slur-configuration.cc:41-89` |
| **under a slur** | note heads get `free-head-distance` **0.3 sp**; nested slurs `free-slur-distance` 0.8 sp; everything else the grob's extents widened by the curve's thickness. **⛔ LEDGER LINES ARE NOT AVOIDED** — grepped, no handling | `slur-scoring.cc:672-693`, `:880-881` |
| **system break** | ⭐ **`broken_trend_offset` NO LONGER EXISTS** (only in `ChangeLog-2.1`). The halves are **fully independent**; the only thing crossing the break is the **direction** (*"the direction of the post-break slur must be the same as the pre-break slur"*). And a broken half is FREER: `steeper-slope-factor`, `non-horizontal-penalty` and `same-slope-penalty` are all switched off | `slur-scoring.cc:90-109`, `:276-278`; `slur-configuration.cc:505`,`:516`,`:519` |
| **slur = tie weight?** | ✅ **identical** — 1.2 / 0.8 for both, through textually identical print code (`lily/tie.cc:220` carries `/* TODO: merge with Slur::print. */`) | as cited |

### 4.2 MuseScore — `~/dev/engine-sources/MuseScore`, HEAD `929d1e99`

Unit: `Spatium(x)` = x staff spaces; `styleAbsolute()` returns px already scaled.

| row | value | where |
|---|---|---|
| **thickness (nominal)** | `slurEndWidth`/`tieEndWidth` **0.05 sp**, `slurMidWidth`/`tieMidWidth` **0.21 sp**, dotted 0.10 sp | `style/styledef.cpp:605-611` |
| ⭐ **thickness (DRAWN)** | **0.29 sp** at the belly, 0.05 at the tips. `midThickness` offsets the **control points**, so the belly separation is 1.5× it, plus a centred `endWidth` stroke: `1.5 × 0.16 + 0.05`. ✅ The repo's 0.29-vs-0.21 finding is **verified** | `slurtielayout.cpp:2986-2991`, `:3238`; `tdraw.cpp:2707-2712` |
| **short-curve thinning** | midThickness ramps **linearly 0.10 → 0.16 sp between 1 sp and 4 sp** of length, and it applies to **slurs too** (the function is on `SlurTieSegment`) | `slurtielayout.cpp:3222-3255` |
| **slur arch law** | `h_control = √(L/4) = 0.5·√L sp`, **no clamp**; ×0.75 over beams. Drawn apex ≈ **0.375·√L sp** | `slurtielayout.cpp:2910-2932` |
| **tie arch law** | `h_control = clamp(0.3 + 0.3·√|L−1|, 0.3, 2.0) sp` — the cap bites at **L ≈ 33 sp** | `:2699-2702`; `styledef.cpp:628-629` |
| **shoulder width** | a 4-row table on length: `<2 ⇒ 0.60`, `<10 ⇒ 0.50`, `<18 ⇒ 0.60`, else **0.70** (fraction of the span) — the plateau **widens with length**, which is its long-slur flattener | `slurtielayout.cpp:2812`,`:2821-2829` |
| **apex centred?** | yes — `c1 = c(1−W)/2`, `c2 = c(1+W)/2`, equal heights. The lean is entirely from `avoidCollisions` and user drags. A tie between two notes on the same line is **forced horizontal** | `:2833-2837`; `forceHorizontal` `:2191-2205` |
| **slur endpoint, head side** | the notehead **centre** in x, **0.9 sp outward from the head's centre** in y (0.75 on tab) ⇒ ≈0.4 sp of white past the head's edge | `:605-614` |
| **slur endpoint, stem side** | the stem tip, **0.5 sp back down the stem**, and `max(0.35·mag, 0.2) sp` clear of it horizontally. ✅ `stemOffsetX = 0.35` confirmed | `:397-402`, `:528-531` |
| ⭐ **the mixed-stem float** | the endpoint **slides along the stem** by half the note-position differential — with the comment `// see for example Gould p. 111` **at two sites** | `:691`, `:828` |
| **tie endpoint** | **both, by case.** OUTSIDE tie (the shipped default): x = the notehead's **optical centre** (mean of SMuFL `cutOutNW/NE`), inset **0.1 sp**; y = the head's **edge**, +**0.20 sp** outward (`TODO: style`). INSIDE tie: x = the head's **edge**, inset 0.2 sp; y = the head's centre. 0.45 sp when a neighbour stands beside it | `:1746-1763`, `:1768-1785` |
| **slur side** | explicit wins; cross-staff beam ⇒ up; else **opposite the start chord's stem**; **multiple voices ⇒ voice 1 up, others down** (stem side); **mixed stems ⇒ up** | `:2605-2675` |
| **tie side** | multi-voice ⇒ **stem side**; single note with **stems disagreeing ⇒ UP**, else opposite the stem; a chord ⇒ a **pivot** at the only tied unison/second, otherwise the side with **fewer** ties | `:3051-3168` |
| **chord ties** | `tiePlacementSingleNote` and `tiePlacementChord` both default **OUTSIDE**. Only the top-with-up / bottom-with-down tie is "outer" and keeps its optical-centre x; **inner ties run the full shape scan and are shortened**. Stacked ties closer than **0.15 sp** are split about their midpoint, **snapped to the nearest half-line**, and their ARCS reshaped | `:3172-3199`; `tie.cpp:460-475`; `:2526-2603` |
| ⭐⭐ **staff lines** | two stages. (1) an **endpoint** within `badIntersectionLimit` **0.15 sp** of a line ⇒ both endpoints translate clear. (2) the **arc**: `badArcIntersectionLimit` is **0.1 sp under 3 sp of length, 0.15 sp otherwise**; it then **grows or shrinks the arc** — whichever moves less — capped at `maxArcCorrection` **0.75 × height**, and only the overflow translates the tie. A *small* tie (<2.0 sp long, <0.7 sp tall) is moved bodily into a space instead | `:2392-2502`, `:2454`, `:2486` |
| **under a slur** | per-item minimum clearance: **note 0.4 sp**, articulation 0.20, everything else 0.1. Arc clearance `clamp(0.04·L·cos²θ, 0.1, 0.5) sp`. Up to 30 iterations alternating SHAPE and ENDPOINT passes. ⛔ **Ledger lines are explicitly REMOVED from a slur's obstacle list** (`item->isLedgerLine()`), though ties handle them at a 0.4 sp margin | `:1328-1356`, `:1359-1369`, `:1029-1158`, `:1270`; `:2361-2390` |
| **slant** | ⭐ **there is no `slurMaxSlope` style** — grepped; the only slope style in the file is `tupletMaxSlope`. A slur's slant is whatever its anchors give. `STEEP_LIMIT` 45° forces endpoint adjustment; `SLANT_REDUCTION_ANGLE` 5° / `SLANT_REDUCTION_LENGTH` 8 sp bias which end moves | `:1097-1131` |
| **system break** | **independent halves.** Each is its own segment with its own `computeBezier` + `avoidCollisions`; the only couplings are the shared direction and two constants: `continuedSlurOffsetY` **0.4 sp** and `continuedSlurMaxDiff` **2.5 sp** (a clamp *within* one half). `constrainLeftAnchor` pins a stub half's open end to **0.25 sp**. A broken **tie**'s open end simply **copies the other end's y** — each half is flat at its own note's height | `:60-333`, `:62-65`, `:165-167`, `:317-319`; `:1594-1595`, `:1659-1661` |
| **slur = tie weight?** | ✅ the shipped defaults are equal (four independent styles, same values) and both feed one `computeMidThickness` | `styledef.cpp:605-611` |
| ⚠️ a dead knob | `Sid::slurMinDistance` / `tieMinDistance` (0.5 sp) appear in the style dialog but have **no layout consumer** — grepped all of `src/` | `styledef.cpp:616-617` |

### 4.3 Verovio — `~/dev/engine-sources/verovio`, 6.3.0 (`efff0bc`)

⚠️ **Unit**: Verovio's `m_drawingUnit` is **HALF a staff space** (`options.cpp:2144` converts staff
spaces → MEI units by ×2). Every option below is therefore doubled to get its sp value.

| row | value (MEI units → **sp**) | where |
|---|---|---|
| **thickness** | `slurMidpointThickness` 0.6 → **0.30 sp**; `slurEndpointThickness` 0.1 → **0.05 sp**; `tieMidpointThickness` 0.5 → **0.25 sp**; `tieEndpointThickness` 0.1 → **0.05 sp** | `options.cpp:1487`,`:1475`,`:1561`,`:1557` |
| ⭐⭐ **and it is EXACT** | `CalcThickBezier` moves only the control points, rotated by the control polygon's **angle bisector** (so thickness is normal to the curve), and the two edge curves **share the endpoints**; `GetBezierThicknessCoefficient` then subtracts the pen so the belly measures the option exactly | `boundingbox.cpp:1033-1071`, `:945-958` |
| **SMuFL** | Verovio maps `engravingDefaults` onto all four — but only from the `engravingDefaults` option, ⚠️ **not automatically from the loaded font's metadata** | `options.cpp:2101-2126`, `:2143-2144` |
| **slur arch law** | `h = clamp(dist/5, 1.2u, 3u) × slurCurveFactor` ⇒ control height **0.6 sp floor, 1.5 sp ceiling**, the ceiling reached at a **7.5 sp** span. Drawn apex 0.45 → **1.125 sp** | `devicecontext.cpp:75-79` |
| **…and its indent** | `offset = dist / baseVal`, `baseVal = 6.0` under 2 sp, `8 − log₂(ratio)` between 2 and 16 sp, `3.0` above ⇒ the inset **widens with length**, like MuseScore's shoulder table | `devicecontext.cpp:55-62` |
| ⭐ **tie arch law** | **a CONSTANT**: `height = (1.6 − staffLineWidth) × unit` = 1.45 u = **0.725 sp** of control rise ⇒ **0.544 sp of apex at every width**, shoulders fixed at ¼ and ¾. ⭐⭐ The only place in any engine where a curve's shape reads the **staff-line thickness**, and its comment says why: *"to make sure that the tie does not overlap with them"* | `tie.cpp:224-226`, `:233-237` |
| **apex centred?** | yes initially — the curve is rotated onto its chord, made symmetric, rotated back. The lean comes from `AdjustSlursFunctor` steps 4–5; `slurSymmetry` (default **0.0**) can force the two control shifts equal | `slur.cpp:1145-1155`; `adjustslursfunctor.cpp:186-210`, `:670-671` |
| **max slant** | `slurMaxSlope` default **60°** (range 30–85), applied by **moving the higher endpoint**, not rotating | `options.cpp:1483`; `slur.cpp:567-596` |
| **slur endpoint** | decided **per end**, from that end's own stem. Head side ⇒ `GetDrawingTop`. Beamed or flagged ⇒ the **stem/beam tip**. ⭐ A plain stem-up unbeamed quarter ⇒ **beside the stem**: `x += 1 sp`, `y = head + 1.5 sp`. Then a flat **+0.625 sp** at both ends | `slur.cpp:669-721`, `:1000-1004` |
| **mixed stems** | forced **Above** before the endpoints are chosen, so a mixed-stem slur legitimately touches a head at one end and a beam at the other | `calcslurdirectionfunctor.cpp:89-99` |
| **tie endpoint** | ⚠️ **`src/tie.cpp:380` and `:390`** (the repo had `:381/:391`): `startPoint.x += r1 + unit/2`, `endPoint.x -= r2 + unit/2` — the head's **outer edge + 0.25 sp**, i.e. **inward from the edge** by a quarter space. Vertically **0.25 sp** from the head centre | `tie.cpp:380`,`:390`,`:215-216` |
| **short tie** | under `(1 + tieMinLength) unit + r1 + r2`, the x inset is **skipped entirely** (centre to centre over both heads) and the tie is pushed **a further 0.5 sp** away | `tie.cpp:359-360`, `:217-220` |
| **tie side** | `@curvedir` → layer stem → **chord position** (below for lower, above for upper, away from the stem for a centre note) → stem up ⇒ below → above/below staff centre | `tie.cpp:479-515` |
| **chord ties** | one per note. **Only the OUTER tie** gets the dot/flag avoidance pass — its own comment says *"there should be no issue of inner tie moving up"*. Inner ties get horizontal treatment only | `tie.cpp:253-256`, `:527-528`, `:266-345` |
| **staff lines** | ⭐ the tie's height constant (above) and **nothing else**. The slur has **no staff-line rule at all** | `tie.cpp:226`; `slur.cpp:210-211` |
| **under a slur** | `slurMargin` default 1.0 u = **0.5 sp** ✅ confirmed. The obstacle list is `{ACCID, ARTIC, CHORD, CLEF, DOT, DOTS, FLAG, GLISS, NOTE, STEM, TUPLET_BRACKET, TUPLET_NUM}` — ⛔ **no ledger lines**, and ties are excluded with the comment *"Ties should be handled separately"* | `options.cpp:1478-1480`; `slur.cpp:210-211` |
| ⭐⭐ **system break** | all three recorded snippets **verified**. *"Make sure that broken slurs do not look like ties"* — `if ((abs(y1−y2) < 2·unit) && (abs(x1−x2) < 2·staffSize)) y2 = y1 + 2·sign·unit` at **`slur.cpp:942-946`** and mirrored at **`:975-979`**. Units: **1 sp** of height, **8 sp** of width. `pitchDiff · unit / 2` = **a quarter space per diatonic step**, at `:930`,`:938`,`:963`,`:971`. The two halves share the slur's **pitch data** but never each other's geometry; a whole-system middle flattens to the staff edge. A broken **tie** keeps its full arch and a tie spanning a whole system is **refused** | as cited; `tie.cpp:139-143`,`:449` |
| **slur = tie weight?** | ❌ **no** — the tie's belly is deliberately **5/6** of the slur's (0.25 vs 0.30 sp); the tips are equal | `options.cpp:1487`,`:1561` |

### 4.4 VexFlow 5.0.0 — `node_modules/vexflow/build/esm/src/`

> ⚠️ 2026-09-19: the package is removed; the same build is kept at
> `~/dev/engine-sources/vexflow-5.0.0-npm/package/build/esm/src/`, where the citations below still hold.

Numbers are **pixels**; VexFlow's staff space is `Tables.STAVE_LINE_DISTANCE = 10` px, so **1 sp = 10 px**.

| row | value | where |
|---|---|---|
| **classes** | `Curve extends Element` (the slur — **there is no `slur.js`**), `StaveTie extends Element`, `TabTie extends StaveTie` (which **does** override the shape: `cp1 9`, `cp2 11`, `yShift 3`) | `curve.js:8`, `stavetie.js:3`, `tabtie.js:14-17` |
| **slur thickness** | `thickness: 2` px added to the **control** y ⇒ belly fill 1.5 px, plus a 1 px stroke ⇒ ≈**0.25 sp** of ink; tips = the stroke = **0.10 sp** | `curve.js:23`, `:56-62` |
| **tie thickness** | no thickness option exists: the belly is `cp2 − cp1 = 12 − 8 = 4` px at the controls, and a *quadratic* reaches half of that ⇒ **0.20 sp**; tips **0** (fill only, `stroke: 'none'`). A **short** tie (`cp1Short 2` / `cp2Short 8`) is **0.30 sp** — flatter AND fatter | `stavetie.js:12-16`, `:85-92` |
| **arch law** | ⭐ **both are CONSTANTS.** `Curve` `cps: [{y:10},{y:10}]` ⇒ apex **0.75 sp** at any span. `StaveTie` edges at 4 px and 6 px from the chord ⇒ apex **0.4–0.6 sp** at any span | `curve.js:23`,`:53-56`; `stavetie.js:85-86` |
| **apex centred?** | always, both — `StaveTie` even measures both control y's from `(firstY+lastY)/2` and puts the control x at the exact midpoint, so a tie between different heights is still symmetric | `curve.js:44-48`; `stavetie.js:79`,`:85-86` |
| ⚠️ **taper is vertical** | neither class rotates the thickness offset to the curve's normal, so **a steep VexFlow slur thins out**. (Verovio does rotate; MuseScore and LilyPond offset perpendicular to the chord) | `curve.js:56-58`; `stavetie.js:88-90` |
| **slur endpoint** | an **option, not a rule**: `position` / `positionEnd` ∈ {`NEAR_HEAD`, `NEAR_TOP`}, both defaulting to `NEAR_HEAD`, read off `Stem.getExtents()`. `yShift: 10` px = **1.0 sp** away; `xShift: 0` | `curve.js:5-6`,`:23`,`:64-125` |
| **tie endpoint** | the notehead **EDGE with zero padding** — `StaveNote.getTieRightX/getTieLeftX` **override** the base `Note` versions, dropping the base's ±2 px pad. `yShift: 7` px = **0.7 sp**, `tieSpacing: 0` | `stavenote.js:496-507`; `stavetie.js:20-21` |
| **side** | just the stem, and ⚠️ **the LAST note wins** in both classes. `direction === 0` degenerates to a flat zero-thickness tie | `curve.js:93`,`:103`,`:122`; `stavetie.js:24-37` |
| **chord ties** | `firstIndexes`/`lastIndexes` draw one curve per index pair, but **every curve shares the same `cp1`, `cp2`, `yShift`, `direction` and the same two x's** — inner ties are the outer tie translated in y. No per-note direction, no avoidance | `stavetie.js:46-93` |
| **avoidance** | ⛔ **none, of anything.** Neither file reads a staff line, a ledger line, a notehead or any other element | grepped both files |
| **system break** | ⛔ **none.** `isPartial()` exists on both and is **called nowhere in the library** — it is an API for the caller. A half-curve keeps the **full** arch and falls back to the stave's own `startX`/`endX`, **not** inset from the barline | `curve.js:37-39`, `:96-110`; `stavetie.js:58-60`,`:115-126`; `stave.js:91-96` |

### 4.5 ⚠️ Belle — read, and deliberately NOT counted as a witness

`~/dev/engine-sources/belle` has a slur/tie engraver (`include/belle-phrasing.h`,
`include/belle-shapes.h`). ⛔ **`reference/README.md` forbids citing Belle for a convention** — *"Do
not cite Belle for a notehead's spacing, a slur's shape, a barline's thickness … Belle would only be
a fourth opinion with no plate behind it."* That standing rule is respected here. For completeness,
and **not as evidence**:

- `Shapes::Music::AddSlur(path, a, b, inSpaceHeight, relativeArchHeight, relativeArchWidth, shMaxThickness, shMinThickness)` — `belle-shapes.h:1058-1064`.
- The arch is an **unbounded power law**: `archHeight = relativeArchHeight · width^0.8` — `belle-shapes.h:1070-1071`. Slur `Arch = 0.15 × 1.5 = 0.225` (`belle-phrasing.h:273`), tie `Arch = 0.15` (`:166`) ⇒ **the tie is 2/3 the slur's arch**, the same ratio as LilyPond's `height-limit` 1.0 vs 2.0.
- Both are drawn with `shMaxThickness 0.3 sp`, `shMinThickness 0.1 sp` (`belle-phrasing.h:168`, `:274-275`) — ⚠️ which happens to be exactly what **we** draw.

---

## 5. ⭐⭐ WHAT WE DRAW TODAY, against the books

From `src/engine/rendering/curveStyle.ts` (authored in staff spaces), `slurArchHeight.ts`,
`tieEndpoints.ts`, `tieStaffLineClearance.ts` and `engrave/curves/curveInk.ts`.

| # | number | **ours** | the books | verdict |
|---|---|---|---|---|
| 1 | slur/tie **belly** | **0.22 sp** — `engravingDefault('slurMidpointThickness')`, Bravura's | ⛔ **no book gives a number.** Gould's own plate measures **0.30 sp** (§2.5); Ross's ≈0.24–0.28 on a bleeding scan. Engines: LilyPond 0.17 · MuseScore 0.29 drawn · Verovio 0.30 slur / 0.25 tie · VexFlow 0.25 · Bravura 0.22 | **inside a published range, at its lower-middle.** ⚠️ Gould's plate is the highest single datum and it is 0.30 — the number we sat at until `§12 Phase 4`. **Open**, §6 |
| 2 | slur/tie **tip** | **0.10 sp** — Bravura's `slurEndpointThickness` | no book; Bravura 0.10, LilyPond 0.08, MuseScore/Verovio 0.05, VexFlow 0.10 / 0 | **matches** the font's own number |
| 3 | **one weight for both** | one `CURVE.thickness` | Gould pp. 60/109 *"the same design"* — but *"the tie may have a flatter curve"* is about the ARCH, not the weight. LilyPond and MuseScore share one; **Verovio makes the tie 5/6** | ✅ **already HIS decision** (§13.6/§13.8), and the books do not contradict it |
| 4 | **slur arch law** | LilyPond's exactly — `h = 2.0 · (2/π)·atan(π·0.25·w/(2·2.0))`, `slurHeightLimit` 2.0, `SLUR_HEIGHT_RATIO` 0.25 | ⛔ **no book gives a law.** Gould p. 109 + Ross pp. 140–141 constrain only the direction: **long ⇒ flatter**, *"a straight line with both ends bending"* | **matches the books' one constraint** — an asymptote is the only one of the five laws that goes flat in the limit (MuseScore's √L and Belle's w^0.8 do not). ✅ **already HIS decision**, 2026-08-16 |
| 5 | **tie arch** | **0.53 sp** of control rise ⇒ a **0.40 sp** drawn apex, constant at every width | 🚨 Gould p. 61 *"a shallow tie is 1–1½ stave-spaces deep"* — and **her plate draws 0.97 sp and 1.52 sp of apex over the chord** on an 8.5 sp tie (§2.5). Gerou & Lusk p. 145 makes it grow with length in whole-space steps. Engines: LilyPond ≤0.75, Verovio 0.544 constant, MuseScore 0.45→1.50 | ⛔ **already HIS decision** (§13.1: *"if we are flatter than musescore i can tell you i already prefer what we have"*). **⚠️ The new fact is that her measured plate is 2.4–3.8× our apex, and the §13.2 ambiguity that protected the decision is now resolved against it.** Reported, not applied — §6 |
| 6 | **tie endpoint x** | the head's **centre ± 0.25 sp** (Verovio's, read at `tie.cpp:380/390`) | ⭐⭐ **Gould p. 62 draws all three answers, labelled**: centre (roomy), edge (when closer is needed), and beyond the edge (to bring the tips into the head's own space). Ross p. 136 *"notehead to notehead, but does not touch them"*; G&L p. 144 *"to the right of the notehead … to the left of the next"* | **ours is her FIRST case** — the one she says applies *"where there is plenty of space"*. ⚠️ **We have only that one case**; the other two are a length/context rule we do not implement |
| 7 | **tie endpoint y** | **0.70 sp** from the head centre = **0.20 sp** clear of its edge | Gould p. 61 *"should almost touch each notehead"*; MuseScore's `yOffset` 0.20 sp exactly | ✅ **already HIS decision** and confirmed at source; ⛔ do not touch |
| 8 | **slur endpoint lift** | `slurLift` **1.0 sp** from the head centre | Gould p. 110: the **minimum** is *"half a stave-space from the centre of noteheads"*. MuseScore 0.9 sp, LilyPond 0.5 sp + 0.15 off a line, Verovio 0.625 sp past the top, VexFlow 1.0 sp | **above her floor, at the top of the engines' range.** Not wrong; not chosen against anything |
| 9 | **slur endpoint x on the stem side** | `slurStemDodge` **0.35 sp** (MuseScore's), overshoot capped at 1.0 sp | Gould p. 111 (*"beside the stems"*), G&L p. 123 (*"mid-stem, to the right of the stem"*) — ⚠️ **Ross p. 141 says the stem TIP instead** | **matches Gould and G&L; Ross dissents** (§3.2) |
| 10 | **which side** | stems ⇒ notehead side; mixed ⇒ above; stemless by pitch; voice parity; ties away from the clef's middle line on opposite stems | **unanimous in all four books** (§3.1 rows 4–6, 14) — and the middle-line tiebreak is **Gould p. 64**, which no engine implements | ✅ **matches, and on the one row where we are alone we are alone WITH the book** (§13.5) |
| 11 | **a tie vs a STAFF LINE** | `tieLineClearance` 0.15 sp says when, `tieLineApexClearance` 0.3 sp says how far, `tieLineMaxGrowth` 0.75 caps it; the repair **grows the arc** | ⭐ **all four books** (§3.1 row 7) — Gould p. 61, Ross p. 137, G&L p. 145, and the repair Gould names is exactly *"sufficiently round"* | ✅ **matches, and it is the one place where book, engine majority and our code all line up** |
| 12 | **a SLUR vs a staff line** | ⛔ **nothing** | 🚨 **Gould p. 110 says it of the slur too** — *"On a stave, the arc should be placed in a stave-space in order to be most conspicuous"*, with an *and / not* pair. Ross pp. 139–140 draws a **NOT CLEAR / CLEAR** pair for exactly this. LilyPond has `gap-to-staffline-inside` 0.2 / `-outside` 0.1 sp; MuseScore nudges endpoints off lines at ≈0.23 sp | ⛔ **a gap: two books and two engines, and we have no rule.** §6 |
| 13 | **a slur over interior notes** | `slurObstacleMargin` 0.1 → 0.5 sp on MuseScore's length ratio 0.04 | ⛔ **no book gives a number** (§3.3); MuseScore 0.4 sp per note + the same ratio, Verovio 0.5 sp flat, LilyPond 0.3 sp | **matches the engines**, with no book to check against |
| 14 | **ledger lines under a slur** | via the same obstacle list | ⚠️ **Gould p. 65 and p. 68 legislate ties vs ledger lines** (*flatten, or move horizontally, or break the tie*) and say nothing about slurs. **LilyPond and MuseScore both EXCLUDE ledger lines from a slur's obstacles**; MuseScore handles them for ties at 0.4 sp | ⛔ **unexamined on our side** — we do not distinguish. §6 |
| 15 | **broken slur, the open end** | leans `brokenSlurTiltPerStep` **0.25 sp/step** (Verovio's), min rise 1.0 sp under an 8 sp span, max rise 2.0 sp (ours), max slope 0.5, `curveFromHeader` **0** | ⭐ **Gould p. 112** (*"angled in the direction of the final pitch … this differentiates an open-ended slur from an open-ended tie"*), G&L p. 125 (*"ends at a slight angle"*, *"continues at a slight angle"*), Stone p. 38 | ✅ **matches the books' rule, with Verovio's numbers.** ⛔ No book gives a number here |
| 16 | **the two halves matching** | independent | **no book asks them to match** (§3.3); no engine makes them | ✅ **the repo's belief is confirmed on both sides** |
| 17 | **broken TIE** | the same primitive since Phase 3b, so the weight no longer changes at a break | Gould p. 65 *"the open-ended tie keeps its symmetrical shape"*, with **"ties too flat"** as the counter-example; G&L p. 146 *"always remain on the same horizontal level"* | ✅ **matches** |
| 18 | **where a half resumes** | `curveFromHeader` **0** — flush at the header's ink, HIS eye, 2026-08-16 | Gould p. 112: *"after the clef, key signature and time signature, **but before any accidental**"*; Stone p. 38 and G&L p. 125 agree minus the accidental | ✅ **already HIS decision.** ⚠️ **the accidental clause is unimplemented** and only Gould states it |
| 19 | **a tie in a CHORD** | one per pitch, direction by position; ⛔ no inter-tie spacing, no inner-tie shortening | 🚨 **Gould p. 65: ties in the same direction a MINIMUM OF ONE STAVE-SPACE apart** — the only such number in any book. Gould p. 63: *"inner ties must start after and finish before each notehead"*. Gould p. 66: adjacent notes **overrule** the rest of the chord. LilyPond scores tie-vs-tie at 0.45 sp, MuseScore splits at 0.15 sp and snaps to half-lines; **Verovio and VexFlow have nothing** | ⛔ **the largest unclosed gap between the books and our code**, and it is a book number, not an engine one. §6 |
| 20 | **a tie vs a DOT** | ⛔ nothing found | Gould p. 63 (*"place the dot within the tie … curve the tie sufficiently"*), Ross p. 139, G&L p. 144 — **three books**. MuseScore has `tieDotsPlacement`, LilyPond `dot-collision-clearance` 0.25 sp, Verovio shifts past the dots | ⛔ **a gap: three books and three engines.** §6 |
| 21 | **a tie may not end on a stem** | our tie attaches to heads only | Gould p. 60 (it *"becomes a slur"*), p. 63 (*"fall short of the following stem"*) — ⚠️ **Ross p. 136 permits it** | **matches Gould**, against Ross |
| 22 | **max slant** | `SLUR_MAX_SLANT_DEG` **60** — Verovio's, taken by him 2026-08-16 | ⛔ **no book caps a slur's angle** (§3.3) — all four say only *follow the melodic line* | ✅ correctly documented in the code as *"Verovio's default, adopted by him"*, ⛔ never as an engraving rule. **Nothing in this survey changes that** |
| 23 | **taper is applied vertically** | our arch is lifted vertically (which is why `SLUR_CONTROL_ANGLE` and MuseScore's `cos²θ` stay unused) | — | ⚠️ **Verovio rotates its thickness to the curve's normal** (`boundingbox.cpp:1043-1052`); VexFlow does not, and a steep VexFlow slur visibly thins. Ours inherits VexFlow's choice. A real difference nobody has looked at |

---

## 6. ⏳ THE DECISION TABLE — the open rows, and they are HIS

⛔ No recommendations, no phases, no ordering. Each row is a question, with what the survey found
behind it.

| # | the question | what the survey put behind it |
|---|---|---|
| 1 | **Is 0.22 sp the right belly, now that Gould's own plate measures 0.30?** | Her p. 61 and p. 62 ties both measure **0.30 sp** by ink mass — the top of the published range, and the number we drew until §12 Phase 4 moved us to Bravura's 0.22. Ross's plate is ≈0.24–0.28 on a scan that fattens everything. ⛔ No book states a number; this is a choice between a FONT's default and a PLATE's measurement |
| 2 | **Does the tie's arch stay a constant 0.40 sp?** | §13.1 settled this as HIS call and it is not re-opened here. What is new: §13.2's *"maybe 'deep' means the total reach"* escape is **closed** — Gould's p. 62 plate draws **0.97 and 1.52 sp of apex over the chord**, the two ends of her own stated band, measured the first way. Every engine and ours are flatter than she draws |
| 3 | **Should a tie's arch depend on its LENGTH at all?** | Two engines say no (Verovio constant, ours constant); LilyPond and MuseScore say yes. **The books disagree with each other**: Gould p. 61 and Ross pp. 140–141 say a *long* curve gets FLATTER; Gerou & Lusk p. 145 say it gets DEEPER, one stave-space at a time, so the belly stays in a space |
| 4 | ⭐⭐ **Should a SLUR keep its belly out of a staff line, the way our tie does?** | **Gould p. 110 says so of the slur in as many words**, with an *and / not* pair; **Ross pp. 139–140** draws a **NOT CLEAR / CLEAR** pair for it. LilyPond spends two named constants on it (0.2 / 0.1 sp), MuseScore nudges slur endpoints off lines at ≈0.23 sp. We have the rule for the tie and **nothing for the slur** |
| 5 | ⭐⭐ **Do ties in a chord need a minimum separation?** | **Gould p. 65: *"a minimum of one stave-space apart"*, ties on and off the stave alike** — the only inter-tie number in any book, and we have none. LilyPond penalises at 0.45 sp, MuseScore splits at 0.15 sp and snaps the pair's midpoint to a half-line. Verovio and VexFlow do nothing |
| 6 | **Do INNER ties in a chord shorten, and by which rule do they take their direction?** | Gould p. 63 (*"inner ties must start after and finish before each notehead"*) and p. 66 (adjacent notes **overrule** the chord's usual directions). ⚠️ **The direction rule is the one real three-way split in this survey**: Gould's even/odd/majority rule vs Ross p. 138 and G&L p. 147's position-on-the-staff rule, **which Gould prints and labels *not recommended*** |
| 7 | **Should a tie move for an augmentation DOT?** | Three books (Gould p. 63, Ross p. 139, G&L p. 144) and three engines. Gould's answer is the interesting one — *the dot goes inside the tie, and the tie curves more* rather than the tie moving |
| 8 | **Should the tie's endpoint rule be one case or three?** | Gould p. 62 draws **three**, labelled, for the same two notes — centre / edge / beyond-the-edge — and the choice is driven by room and by articulation, not by taste. We implement the first only. ⭐ Her plate also shows the three differ in **depth** by a factor of three, which no engine models |
| 9 | **Do ledger lines belong in a slur's obstacle list?** | ⚠️ **LilyPond and MuseScore both deliberately exclude them for slurs** while legislating them for ties; Gould pp. 65/68 legislates them for ties only, with three different remedies (flatten · move horizontally · break the tie). We do not distinguish |
| 10 | **Should the arch's thickness be measured normal to the curve rather than vertically?** | Verovio rotates the offset by the control polygon's bisector so a steep slur keeps its weight; VexFlow — and therefore our ported `curveInk` — offsets vertically, so a steep slur thins. ⛔ No book, no plate; a rendering-quality question |
| 11 | **Does a broken half resume BEFORE an accidental?** | **Gould p. 112 is the only source that says so** (*"after the clef, key signature and time signature, **but before any accidental**"*) — and LilyPond implements it literally, by putting `avoid-slur 'inside` on Accidental, which is not in the bound's own column. Stone and G&L stop at the clef/key |
| 12 | **May a tie ever end on a stem?** | Gould p. 60 says that makes it a slur, by definition. **Ross p. 136 prints one.** Ours is Gould's |

---

## 7. ⛔ UNKNOWN — and exactly where it was looked for

- **A slur's thickness, from any treatise** — Gould pp. 60–72 and 109–114 (+ OCR full-text grep for `thick`), Ross pp. 136–143 (+ index *ties*), Stone pp. 35–39 (+ index), G&L pp. 121–127 and 143–148. **None gives one.** The four numbers in circulation are SMuFL's and the engines'.
- **A slur's arch height, from any treatise** — the same ranges. Gould constrains the direction only.
- **Any clearance distance** — between a curve and a staff line, or between a slur and the music under it. All four books state the constraint and none a number.
- **A maximum slant** — none of the four caps a slur's angle.
- **Ross on the system break** — silent; pp. 136–143 read in full plus a full-text grep. ⛔ Do not check again.
- **Stone on any shape number** — silent; pp. 35–39 plus his index. ⛔ Do not check again.
- **Gould's SLUR arch as a measured length→height table** — ⛔ **not measured today.** Her slur plates run the arc over noteheads, stems and beams in the same x-window, so a column ink profile cannot separate curve from music without hand-tracing. The p. 111 pair in `reference/gould-scans/` is the only slur plate this project has measured. **A real piece of work, not done.**
- **Gedan, *Notenschrift für Fortgeschrittene*** — quoted in `docs/slur-plan.md` §11.7 (2026-08-15) for the melodic-direction rule and the two labelled faults. ⛔ **It is not in `reference/`** and was not re-read today; that material is second-hand here.
- **The practitioner's length→height table** (0.7 / 1.7 / 3 / 3.25 sp) and the Finale/Sibelius figures in §11.7 — from the notat.io forum, ⛔ **not re-verified today**.
- **Wanske, *Musiknotation*** — LilyPond's tie-direction comment cites *"[Wanske p231]"* by name (`lily/tie.cc:86`). ⛔ **Not on disk, never fetched.** A fifth treatise that two of our sources point at (Wanske here, Ross via LilyPond's same comment) and that this library does not hold.

---

## 8. ⭐⭐ ARTICULATION ↔ SLUR — added 2026-09-14, from his report

### 8.0 The report, and the correction it needed

> *"the slur at bar 2 looks very ugly"* … *"the staccato is bending the slur but in any case the
> staccato ink is so small and even the bbox that i don't know why it bends the slur so much"*

Five sixteenths (C♯5 D♯5 E♮5 F♭5 G♯5), every one carrying a **staccato** dot, one slur over all five.
⚠️ It was first read as an ACCIDENTAL problem — his own first message said so and was a misspelling,
and the briefs that went out carried the error. **The measurement below settles it the other way:
the articulation is the dominant term**, and the accidental's role is real but secondary and of a
different kind. ⭐ *Measure before ranking* applied to a bug report as much as to a library.

### 8.1 ⭐⭐ WHAT WE DRAW — measured four ways, same five pitches, same slur

Isolated by rendering the same bar four times and changing one thing (`e2e` probe, Chromium):

| accidentals | staccato | obstacle lift c0 / c1 | control height | apex above staff | launch angle |
|---|---|---|---|---|---|
| — | — | **0 / 0** | 19.8 px | 1.93 sp | 34.5° |
| ✔ | — | 8.8 / 3.6 | 28.4 px | 2.26 sp | 45.6° |
| — | ✔ | 14.3 / 4.4 | 34.1 px | 2.44 sp | 49.8° |
| ✔ | ✔ | **46.8 / 22.7** | **66.4 px** | **4.26 sp** | **67.3°** |

🚨 **The two are SUPER-ADDITIVE: 8.8 + 14.3 = 23, together 46.8.** Twice the sum.

⭐ **One obstacle drives every case, and it is the SECOND note** — never the first, never the
accidental-heavy middle:

```
both:        t=0.109   box top 51.00   deficit 12.37   × 3.8 leverage  →  46.8 px
accid only:  t=0.109   box top 61.04   deficit  2.33   × 3.8           →   8.8 px
stacc only:  t=0.234   box top 51.00   deficit  6.45   × 2.2           →  14.3 px
```

#### 🚨🚨 Why 0.4 sp of ink moves the arc 2.3 sp — three findings, and none of them is the dot's size

Measured through our own ruler (`sceneInkBox`, P6a) on the D♯, the second note:

```
the note's obstacle box   x 210.3 … 235.1   top 51.0    ← ONE rectangle, 24.8 × 32.9 px
  the sharp's own ink     x 210.3 … 220.3   top 56.0
  the dot's own ink       x 227.3 … 231.3   top 51.0    ← 4 × 4 px = 0.4 × 0.4 sp
```

1. ⛔ **The obstacle is a BOUNDING BOX, not ink.** The dot sets the top of the whole rectangle, so a
   0.4 sp dot becomes a **2.5 sp-wide wall** at the dot's height. His instinct was exactly right: the
   ink is tiny, and the ink is not what the solver reads.
2. 🚨 **The slur meets that wall where the dot ISN'T.** The curve climbs left to right, so its worst
   deficit inside the box is at the box's **left edge** — which is the *accidental's* left edge. The
   real ink there is 5 px lower and the dot is 17 px to the right. **The arc is lifted to clear a dot
   at an x the dot does not occupy.**
3. 🚨 **And that left edge is the worst place on the curve to be pushed.** It falls at t = 0.109,
   where a control point contributes only 26% of its own height. Gain **3.8×**.

⇒ ⭐⭐ **THE ACCIDENTAL'S REAL COST IS HORIZONTAL, NOT VERTICAL.** Its ink hangs LEFT of its own
notehead, so it widens the box leftward by ~1.3 sp and drags the collision from t = 0.234 to
t = 0.109 — out of the part of the curve that can move and into the part that cannot. The staccato
supplies the HEIGHT, the accidental supplies the REACH, and the single rectangle multiplies them.

⚠️ **The existing guard missed it by 5%.** `SLUR_OBSTACLE_MAX_LIFT_RATIO = 4` exists for exactly this
divergence, but it was calibrated for *"an obstacle the endpoint sits on top of"*, where the gain
goes to infinity. This one has a gain of **3.8** and sails under the ceiling.

⚠️ **And the symptom has a name in our own code.** `rendering/slurArchHeight` records that the height
law was replaced on 2026-08-16 partly to kill a 61° launch angle — LilyPond's source calls it *"a
certain hookiness at the end"* — and that LilyPond's law brings it to 43°. **The obstacle lift
re-creates it at 67°, unbounded.** ⇒ a bound on the arch that the obstacle solve can walk straight
past is not a bound.

### 8.2 THE BOOKS — the PLACEMENT rule is settled, by four of them

| source | printed p. | the rule |
|---|---|---|
| **Gould** | 121 | *"The smallest signs go closest to the notehead"* … *"Usually, **only tenuto lines and staccato marks may go inside the first and last notes of a slur**"* |
| **Gould** | 122 | *"**Articulation marks in the middle of a slur go inside the slur.** Accents at the beginning and end of a slur usually go outside the slur, so that the slur can remain closer to the noteheads."* |
| **Gould** | 122 | the horizontal anchor: *"Centre a slur on a stem. With the addition of a tenuto line between the slur and a stem, centre the slur, like the tenuto line, on the notehead (**when there is a staccato dot, the slur centres on the stem**)."* |
| **Ross** | 130 | *"With the exception of the beginning and ending of a phrase, all marks or articulation should appear **inside of a slur**."* ⚠️ His plate draws only accents and fermatas outside — the blanket wording overstates his own drawing |
| **Stone** | 42 | *"In slurred passages with accents and other articulation signs, the slur should **begin and end between the note-head (or stem-end) and the accent**. All other accents, etc., should be **covered by the slur**."* |
| **Stone** | 43 | *"**Staccato dots and tenuto lines in slurred passages, unlike accents, should all appear between the note-heads (or stem-ends) and the slur** (this applies equally to the first and last notes)."* |
| **Gerou & Lusk** | 128 | *"The beginning or ending of a slur is placed **outside staccato and tenuto** marks. **Center** over or under the articulation"*; *"**Articulations between** the beginning and ending notes remain inside the slur"* |

#### ⭐⭐ 8.2a THE PLATES, MEASURED — because none of the four states a distance

Calibration = each figure's own five staff lines, `pdftoppm -r 450`, ink profile. **Gap = clear
white, ink edge to ink edge.**

| plate | PDF | 1 sp | marks ↔ slur: first / middle / last | slur apex | bulges? |
|---|---|---|---|---|---|
| **Gould 121** upper — 3 tenuto under a slur | 141 | 20.13 px | **0.60 / 1.34 / 0.60 sp** | 2.73 sp | none |
| **Gould 121** lower — 3 staccato under a slur | 141 | 20.13 px | **0.65 / 1.19 / 0.55 sp** | 2.16 sp | none |
| **Gould 122** — accents out, dots inside | 142 | 19.90 px | **0.60 / 1.21 / 0.60 sp** | 2.69 sp | none |
| **Gould 111** | 131 | 20.10 px | **0.70 / 2.19 / 0.65 sp** | 3.58 sp | none |
| **Ross 142** tenuto pair | 154 | 25.25 px | **0.20 / — / 0.24 sp** | 1.64 sp | none |
| **Ross 142** staccato pair, same music | 154 | 25.25 px | **0.16 / — / 0.36 sp** | 1.82 sp | none |
| **Stone 43** — descending 16ths, 4 dots | 32 R | 21.40 px | **0.51 / 0.56 / 0.61 sp** | — | none |
| **G&L 128** | 66 L | 38.50 px | dots **0.36**; tenuto **0.73 / 0.78 / 1.06 sp** | — | none |

⭐⭐ **Gould's three independent plates agree to 0.05 sp: ≈0.6 sp at the ENDS, ≈1.2–1.3 sp at the
apex.** ⇒ the gap is a **residual of one even arc**, tightest where the slur lands — ⛔ not a
clearance applied per mark. Cross-book the number is TASTE: Ross 0.2 · Stone 0.55 · Gould 0.6 ·
G&L 0.8. Other numbers off the same plates: slur ink 0.35 sp at the apex; staccato dot Ø 0.40 sp;
dot→notehead clear gap 0.55 sp.

⭐⭐ **NO PLATE IN ANY OF THE FOUR BOOKS BULGES OVER AN INDIVIDUAL MARK** — every slur's inner edge is
monotone from tip to apex and back. **The marks buy the slur one step of height, once.**

#### ⭐⭐ 8.2b THE MARKS' OWN ALIGNMENT — a ROW is drawn, and labelled as the ERROR

> **Gould p. 119**, *Distance from noteheads*: *"Articulation marks are best placed **a consistent
> distance from each notehead**, so that the eye can follow them most easily"* — with an *and / not*
> pair.

⭐ Measured (PDF 139): in the **not** drawing the three marks sit at a common centre — **y 74.0 to the
pixel** — while the noteheads step; in the **and** drawing they step with the notes. ⇒ **the marks
follow the CONTOUR**, and all eight plates do.
⚠️ **But the contour is QUANTISED, not offset**: Gould 121's heads are 1.0 sp apart and her marks only
**0.5 sp** apart, because of p. 119's other rule — *"Place articulation marks no closer than the first
clear stave-space from the note. Centre tenuto lines and staccato dots in a stave-space."*

#### 8.2c STACCATO vs TENUTO

⭐ **Vertically identical**: Gould p. 119 centres both in a stave-space; Stone p. 5 *"Tenuto lines are
spaced like staccato dots"*; Ross's own side-by-side pair measures 1.64 vs 1.82 sp of apex, inside his
scan's noise. ⭐ **The real difference is HORIZONTAL** — Gould p. 122, and her plate engraves it: with
a tenuto the slur's end centres on the **notehead**, with a staccato dot on the **stem** (measured on
PDF 142: right tip at x 374 against a stem at 361.5 and a head centre at 373).
⚠️ **Stone p. 43 adds one exception the rest do not**: *"in cases of very wide, slurred intervals…
the first or last **accent** should be placed between the note-head and the slur"* — accents only.

⭐⭐ **SETTLED: staccato dots and tenuto lines go INSIDE the slur, including on the first and last
notes.** Accents and fermatas go outside at the ends, inside in the middle. So the height the marks
add is legitimate — ⛔ **what is not legitimate is adding it per mark, at the wrong x, amplified.**

### 8.3 🚨 THE BOOKS ON THE SHAPE — and a CITATION THAT WAS MISAPPLIED (corrected 2026-09-14)

⛔ **An earlier draft of this section made Gould p. 111 the operative rule for this bug. It is not,
and HE caught it** (*"in my example the slur is not on the stem side"*):

> Gould p. 111, under the heading ***Slurs at stem end***: *"Where other notes or stems will not be
> obstructed, the slur may move slightly closer to the noteheads, beside the stems, so as to be more
> conspicuous."* … *"Where staccato and tenuto marks fall within the slur, **the slur cannot move
> towards the noteheads but must remain at the ends of the stems**."*

⭐ The whole passage is about a slur on the **STEM** side, and what the marks forbid is the *inward*
move toward the noteheads. **Both of his cases put the slur on the NOTEHEAD side** (stems down with
the slur above; stems up with the slur below), where there is no such inward move to forbid. ⇒ the
sentence is true and irrelevant here. ⚠️ *A rule being right is not its door being open.*

**What the books DO give for the notehead side:**
- the marks are **inside** the slur — §8.2, four sources, and that is settled;
- the curve should be even — Gould p. 109 *"Aim for as consistent a curve as possible"*, Ross
  pp. 140–141 *"a straight line with both ends bending uniformly"*. ⚠️ General shape statements,
  ⛔ **not** articulation-specific.

⛔⛔ **AND THAT IS THE WHOLE OF IT. No book on disk states how a slur clears articulation marks on the
notehead side.** §2.1 C already recorded the same negative for an interior note. The rule has to come
from the engines (§8.4), from measured plates, or from his eye — and it must be labelled as whichever
it is.

⚠️ ⛔ **THE GAP IS STILL UNKNOWN.** No book gives a distance between the marks and the slur. §2.1 C
already records the same negative for an interior note. MuseScore's **0.20 sp** (§4.2) is the only
number in the field.

### 8.4 THE ENGINES — nobody drops the obstacle; everybody discounts the EDGE

| | obstacle set | edge handling | anti-spike |
|---|---|---|---|
| **LilyPond** | accidental included but reduced to **ONE point chosen by the glyph's shape** (`slur-scoring.cc:865-877`), penalty **3** against `head-encompass-penalty` **1000** (`layout-slur.scm:21-34`); staccato is `avoid-slur . inside` (`script.scm:397-403`) | ⭐⭐ the two **extreme note-columns contribute no avoid-point at all** (`slur-scoring.cc:666-671`); anything within **`close-to-edge-length` 2.5 sp** is dropped from the height fit (`slur-configuration.cc:112-119`) | the arch is a **closed form** obstacles may only SCALE, capped at `max_h` — the largest height keeping `\|bez'(0)\| < \|bez'(.5)\|`, so **a spike is geometrically unrepresentable** (`:165-194`) |
| **MuseScore** | full shapes; a *"Remove items that the slur shouldn't try to avoid"* filter drops ledgers, text, endCR articulations, other voices, fermatas, ornament accidentals (`slurtielayout.cpp:1264-1319`) | endCR items dropped; accidentals also dropped at system-break continuations (`:170-172`) | shape sampled into ~20 rects (`npoints = 20`), `MAX_ITER` 30, step clamped to **1.5 sp** (`:1424-1435`), and *"Enforce non-ugliness rules / 1) Slur cannot be taller than it is wide"* (`:1140-1144`) |
| **Verovio** | full shapes, `ACCID` first in the class list (`slur.cpp:209-212`); start/end **elements** exempt but ⛔ not their accidentals | ⭐ only obstacles with `\|0.5 − ratio\| < 0.45` contribute — *"Ignore obstacles close to the endpoints, because this would result in very large shifts"* (`adjustslursfunctor.cpp:604-607`) | partial-shift radius with quadratic fade (`:876-900`); `AdjustSlurShape` re-imposes min angle, convexity, `p1.x ≤ c1.x ≤ c2.x ≤ p2.x` (`:687-766`) |
| **Finale** (⚠️ settings only, from `musxdom`; the algorithm is **UNKNOWN**) | `slurAvoidAccidentals` is a **toggle** with its own `slurAcciPadding`, plus a per-slur `SlurAvoidAccidentalsState {Auto, Off, On}` | — | `maxSlurLift`, `maxSlurStretch`, `maxSlurAngle`, `slurSymmetry`, `articAvoidSlurAmt` exist as named limits |

#### ⭐⭐ 8.4a A RUN OF MARKS — all three reduce it to ONE quantity (second reading, 2026-09-14)

| | how a RUN of marks is answered | the ends | order |
|---|---|---|---|
| **LilyPond** | ⭐⭐ **ONE scalar `fit_factor`** — the largest ratio over every avoid-point — scaling the whole arch: `height = max(height, min(height * ff, max_h))` (`slur-configuration.cc:93-132`, `:191-195`) | obstacles within `close-to-edge-length` **2.5 sp** are skipped by the fit (`:112-119`); attachment range pre-widened by `encompass-object-range-overshoot` 0.5 sp | per type: `avoid-slur inside` ⇒ the SLUR yields and the mark never moves; `outside`/`around` ⇒ the MARK moves (`slur.cc:372-402`) |
| **MuseScore** | collisions collapse to three booleans (left/mid/right) driving the two control points, `0.30 sp` per iteration, ≤ `MAX_ITER` 30 (`slurtielayout.cpp:1010-1090`) | the tip moves **outside** the first/last staccato/tenuto by `slurTipToArticVertDist` **0.5 sp**, x re-anchored to the mark's centre (`:889-923`); `leftBalance` drops 0.4 → **0.1** when a mark is present | marks placed (passes 1–2) → slur → `layoutArticulations3` moves **only the outside marks on the slur's own end chords** (`chordlayout.cpp:1172-1175`) |
| **Verovio** | every box becomes a linear constraint on the two control heights; **one** weighted-average solve satisfies all, clamped toward symmetry (`adjustslursfunctor.cpp:559-682`) | ⭐ a named case — the **"portato slur"**: a boundary note with an inside artic re-anchors the endpoint to the note's drawing top (`slur.cpp:688-696`, `:1058-1086`); obstacles in the outer 5 % ignored | outside artics → outside artics on boundary notes pushed clear of the slur → slur (`page.cpp:418-552`) |

**Clearance numbers, slur→mark:** MuseScore **0.20 sp** (`articulationClearance`), LilyPond
`extra-encompass-free-distance` **0.3 sp** (a demerit, not a constraint), Verovio one global
`slurMargin` = **0.5 sp** for every obstacle class (⛔ no ARTIC row exists).
**Which marks sit inside:** LilyPond staccato/staccatissimo/tenuto/**marcato** inside, accent and
fermata `around`; MuseScore and Verovio staccato/staccatissimo/tenuto inside, accent and marcato
outside. ⚠️ Marcato is the one they disagree about.
**Anti-spike:** LilyPond `max_h` from `|bez'(0)| < |bez'(.5)|`; MuseScore *"Slur cannot be taller than
it is wide"* + the tangent rule; Verovio a 30° minimum control angle and 3° convexity.
⛔ **No engine has an articulation ROW**; LilyPond's `Script_row` groups one timestep only.

⭐⭐ **The line that matters: no engine solves this by removing the obstacle. All three solve it by
discounting the EDGES** — and two of the three additionally bound the SHAPE so that no obstacle,
however mismeasured, can produce a spike. We do neither.

⭐ **Layout ORDER, where it was found:** MuseScore lays articulations *close to the note* first
(`articulation.cpp:264-271`, `isStaccato() || isTenuto()`), then slurs, then `layoutArticulations3`
— *"Called after layouting slurs // Fix up articulations that need to go outside the slur"*
(`chordlayout.cpp:1172-1175`). Verovio fixes the same order in `page.cpp:386-420`.

### 8.5 ⛔ THE ACCIDENTAL — closed, as a side question

**No treatise on disk states that a slur clears an accidental.** Gould's slur section mentions the
word once, and horizontally: p. 112, *"the slur starts after the clef, key signature and time
signature, **but before any accidental**"*. The only two COLLISION rules in the book resolve by
changing SIDE, never by raising the arc:

> p. 130 (grace notes): *"A slur should always be **placed above the notes** when it would otherwise
> collide with the accidentals of a measured value."*
> p. 71 (ties): *"**Curve a tie away** from an added note with an accidental, so that the two do not
> collide."*

⇒ our arch's response to an accidental — *lift* — has **no source behind it** in this library.

⚠️ **REOPENED THE SAME DAY — see §8.8.** Closing it *"as a side question"* was right about the BOOKS
and wrong about the code: three hours later he reported the accidentals themselves grazing the slur.
⭐ The engines all DO treat an accidental as an obstacle (§8.4); what none of them uses is a
rectangle.

### ✅ 8.6 WHAT WAS BUILT (2026-09-14) — two mechanisms, two jobs

⭐⭐ **His specification was one sentence** — *"they should not change the slur angle but move it up a
little"* — and it took two changes, because the marks at the ENDS and the marks in the MIDDLE reach
the curve by different routes.

**1. `rendering/slurArticulationEndpoint.ts` — the ENDS move the ENDPOINT.** A staccato or tenuto on
the first or last note stands between that note and the slur, so the endpoint's lift is measured from
the MARK rather than from the notehead, plus `CURVE.slurArticulationGap` **0.5 sp**
(MuseScore's `slurTipToArticVertDist`; Verovio's portato re-anchor is the same rule spelled
differently). ⭐ Moving the ends TRANSLATES the curve, and a translation cannot change its shape —
the property the whole-curve offset override already relies on.

**2. `rendering/slurObstacles.ts` — the MIDDLE scales the WHOLE arch.** Verovio's two-control solve
is replaced by LilyPond's single `fit_factor` (§8.4a), multiplying both control heights by one
number. ⛔ With it goes `SLUR_OBSTACLE_MAX_LIFT_RATIO`, **deleted rather than tuned**: it was a
ceiling of 4 written for an obstacle the endpoint sits on top of, and his case came in at **3.8**,
passing under it while spending 4.68 sp of control height to buy 1.24 sp of clearance. ⭐ Its job is
done instead by `SLUR_EDGE_DISCOUNT_SPACES` **2.5 sp** — LilyPond's `close-to-edge-length`, which
removes the obstacle rather than capping the answer. *A ceiling the bad case fits under is not a
bound.*

#### ⭐ Measured, both configurations (his two scores)

| slur ABOVE, five staccato 16ths | apex | launch | controls | ratio |
|---|---|---|---|---|
| as he reported it | 4.26 sp | 67.3° | 66.4 / 32.3 | 2.06 |
| + the endpoint rule only | 3.33 sp | 55.0° | 39.8 / 11.5 | 3.45 |
| **+ the fit factor (shipped)** | **2.78 sp** | **35.9°** | **20.1 / 9.1** | **2.21** |
| *his own hand-tuned target* | — | — | *24.8 / 11.5* | *2.15* |
| the same bar with no marks | 1.93 sp | 34.5° | 19.8 / 9.8 | 2.02 |

⭐⭐ **The launch angle is back to the plain arch's and the ratio matches his to 0.06.** ⚠️ We sit
~0.5 sp LOWER than his hand-drag — that is SIZE, not shape, and its knob is the endpoint gap: ours is
MuseScore's 0.5 sp where **Gould's own plates draw 0.6** (§8.2a). ⏭️ His call.

⭐ **The slur BELOW (the same figure an octave down) was solved by the endpoint rule alone** — its
obstacle factor is 1, and its control ratio went 0.28 → 0.59 against the auto arch's 0.49.
🚨 There the articulation is **100 % of the cause**: with the slur below, the accidentals are above
and to the left of the noteheads and reach nothing.

#### ⚠️ One change beyond the reported bug, stated rather than buried

A slur over notes with **accidentals but no marks** used to take a small lift (8.8 / 3.6 px) and now
takes none — it renders identically to plain notes (1.92 vs 1.93 sp of apex). ⭐ That follows the
books (§8.5: no treatise says a slur clears an accidental; Gould's two collision rules change SIDE,
never height) and it follows the edge discount, but it was not what he reported. ✅ He looked and
accepted it: *"the articulation slur looks much better now"*.

#### ⏳ STILL OPEN

1. **The gap number.** Ours 0.5 sp (MuseScore). Gould's plates 0.6; Stone 0.55; Ross 0.2; G&L 0.8.
   ⏭️ **And the last note's own accidental**, which no rule reaches: §8.8's reverted experiment.
2. **The mid-run clearance**, unchanged at `slurObstacleMarginMin/Max` 0.1–0.5 sp; MuseScore's
   articulation row is 0.20 sp and we do not distinguish marks from noteheads there.
3. **The horizontal rule is NOT built** — Gould p. 122 and her plate: with a tenuto the slur's end
   centres on the notehead, with a staccato dot on the **stem** (§8.2c). We always centre on the note.
4. **Marcato's side** — LilyPond keeps it inside, MuseScore and Verovio put it outside (§8.4a).

### 8.7 ⚠️ A correction to §2.3's heading

Stone's slur/tie material does **not** stop at printed p. 39: **§11 *Slurs and ties in combination
with articulation signs* is printed pp. 42–43 (PDF 32)**, and it is the fullest statement in the
library of the ends rule. The 2-UP formula in `reference/README.md` (`PDF n = printed 2n−22 / 2n−21`)
is correct and was used to reach it.

### ✅ 8.8 THE ACCIDENTALS — the same afternoon, the same shape of fault (2026-09-14)

> *"in this case is accidental that are almost colliding with the slur; the angle of the slur looks
> good to me, but the distance is not optimal"*

Five sixteenths, accidentals, **no** articulations. Measured, the arc passed **0.03 sp** from a flat
and INSIDE the sharps either side.

#### 🚨🚨 The first diagnosis was WRONG, and the record says so

⛔ I reported that *"VexFlow's note box under-reports the accidental's ink by half a staff space"*.
**It does not.** Instrumented before our own post-processing, `StaveNote.getBoundingBox()` gave
`61 · 56 · 51 · 42 · 41` against our scene ink's `61 · 56 · 51.4 · 42.4 · 41`. ⭐ The short box was
produced **one line later, by us**.

#### ⭐⭐ The real cause: a NOTCH earned at one corner, granted at every x

`rendering/accidentalCutOut` let a curve dip into the notch in an accidental's outline — Verovio's
rule, and right in principle. ⛔ It applied the notch's DEPTH to the whole **rectangle**:

| sign | where its notch starts | what we granted |
|---|---|---|
| sharp | x = 0.84 of a 0.996-wide glyph — the rightmost **16 %** | 0.504 sp everywhere |
| natural | x = 0.192 | 0.588 sp everywhere |
| **flat** | x = 0.252 of 0.904 — the right 72 % | **1.100 sp** everywhere, including over the ascender at its LEFT |

⭐⭐ *A rectangle grants at one x what is only true at another* — **the second time in one afternoon**
(§8.1 is the first, with a staccato dot). ⇒ the sentence is not about articulations; it is about
rectangles.

#### ⭐⭐ LilyPond's answer, adopted whole — HIS call

`lily/slur-scoring.cc:865-877`: an accidental is **one POINT**, its x chosen by the glyph's own shape,
consumed at `slur-configuration.cc:429` as `extents_[X_AXIS].linear_combination (idx_)`.

```cpp
if (alt == FLAT_ALTERATION || alt == DOUBLE_FLAT_ALTERATION) xp = LEFT;
else if (alt == SHARP_ALTERATION)   xp = 0.5 * dir_;
else if (alt == NATURAL_ALTERATION) xp = -dir_;
```

⭐ **A flat is met at its LEFT — its tall ascender** — which is the exact opposite of granting it the
notch, and the flat is the sign his eye caught. ⚠️ **The point carries the glyph's FULL reach**:
LilyPond expresses the notch by choosing WHERE TO STAND, ⛔ never by lowering the obstacle.
⚠️ `dir_` is the opposite sign to ours (theirs +1 = above); converted once, in
`rendering/slurAccidentalPoint`, ⛔ not left for a reader to trip on.
⚠️ **The double sharp is OURS** — LilyPond's table has three branches and no `##`; we put it at the
centre and label it as ours in the module and the spec.

⇒ ✅ `rendering/slurAccidentalPoint.ts`; the note now contributes its head/stem/beam box **without**
accidentals, plus one point per accidental. ⛔ `rendering/accidentalCutOut.ts` **and its spec are
DELETED** — the tuck was the fault, not a tuning.
⭐ `slurArchFit` gained one branch with it: a **degenerate** obstacle is measured at the nearest
sample. That is what makes a point an obstacle at all — and it quietly fixed a latent fault, since a
box narrower than the sampling step used to fall between two samples and be ignored.

#### ⭐ Measured, against his own hand-tuned override

| accidental | before | **now** | his override |
|---|---|---|---|
| D♯ | −0.30 sp | **−0.08** | −0.05 |
| E♮ | +0.35 | **+0.82** | +0.67 |
| **F♭** | −0.03 | **+0.41** | +0.37 |
| G♯ | −0.17 | **−0.05** | +0.32 |
| **shape ratio** | 2.04 | **2.04** | **2.04** |

⭐⭐ Three of four on his override, the flat nearly exact, and **the arch is untouched** — a uniform
scale of ×1.427, ratio 2.04 either side. ⏳ The last note's sharp still grazes at −0.05 sp.

#### ⏭️ TRIED AND REVERTED — the endpoint clearing its own accidental

The G♯ sits inside the span, under the curve, and inside the edge band the solver discounts, so
nothing clears it. Extending the endpoint rule to a note's own accidental (with an x test, so the
START note's — which stands before the first head — is left alone) **fixes it and costs more than it
buys**: only ONE end has an accidental inside the span, so only one end rises and the arch TILTS.

| | point rule only | + the endpoint | his hand-tuned |
|---|---|---|---|
| the D♯ near the start | −0.08 sp | **−0.22** | −0.05 |
| the G♯ at the end | −0.05 | +0.66 | +0.32 |
| **shape ratio** | **2.04** | **2.95** | **2.04** |

⛔ Reverted on his standing rule (*"they should not change the slur angle"*) and on his own look at
it: *"no the endpoint is too far now"*. ⭐ The account stays in `slurArticulationEndpoint`'s header so
the next reader does not re-run it. ⏭️ The variant that would NOT tilt is to give BOTH endpoints the
larger of the two lifts, so the curve translates — ⛔ a further invention with no engine behind it,
and his to ask for.
