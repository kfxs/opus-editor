# 20th- and 21st-century notation — a SURVEY of what a model may one day have to say

> **This is a SURVEY, for orientation. It is not a plan, and nothing in it is committed work.**
> No feature here is scheduled, costed, or agreed. Its only job is to let a future decision be taken
> with the shape of the territory already known — so that when one of these arrives, it arrives as a
> MODULE and a row in a table (`CLAUDE.md`), not as a field bolted onto `Note`.
>
> **Findings only**, in the manner of `docs/spacing-model-research.md`. ⛔ Do not treat any "what a
> model must be able to say" sentence as a design decision — it is a *constraint statement*, the
> thing a design would have to satisfy.
>
> **Three confidence markers, used throughout and meant literally:**
> **✅ verified** — read off a cited page in this session.
> **🔶 attributed but UNCONFIRMED** — a specific, plausible, named source, which this session ran out
> of search budget before re-checking. **Do not quote a 🔶 claim without opening its source first.**
> **⚠️ / 🚨 flagged** — a known gap, contradiction or trap, described in place.
>
> 🚨 **§4 and §5 carry a provenance warning of their own — read it before using either.**

Written 2026-08-13, prompted by a question about a Spanish-language notation treatise. §1 answers
that question; §2 onwards is the survey proper. **§11 is the only part with a conclusion in it.**
**Appendix B lists everything that could NOT be verified** — read it before quoting anything here
back at anyone.

---

## 1. The book — ✅ IDENTIFIED

**Jesús Villa-Rojo, *Notación y grafía musical en el siglo XX*. Madrid: Iberautor Promociones
Culturales / Fundación Autor (SGAE), 2003. 395 pp. ISBN 84-8048-496-9 / 978-84-8048-496-1.**

The half-remembered *"villarobos"* is **Villa-Rojo** — a Spanish composer and clarinettist (b.
Brihuega, Guadalajara, 24 February 1940), founder in 1975 of the **LIM** (Laboratorio de
Interpretación Musical), twice winner of the Premio Nacional de Música (1973, 1994), and the author
of *El clarinete y sus posibilidades* (Alpuerto, 1975/1984) — a catalogue of extended clarinet
technique. That second book matters here: the man who wrote the notation treatise had already spent
a decade needing symbols that did not exist. ✅ All of this is verified against Dialnet, the
publisher's own library (Instituto Autor), the author's site, and Spanish booksellers — see Sources.

**Confidence: very high.** Title, author, publisher, year and ISBN agree across the publisher's
foundation, Dialnet, and five independent bookshops. The surname garble is small (Villa-Rojo →
"villarobos") and the title match is exact on both distinctive words, *notación* and *grafía*.

**Contents** — ten parts, verified from the Instituto Autor record and a bookseller's index with
page numbers:

| part | p. |
|---|---|
| Prólogo · Introducción (orígenes, nuevas ideas musicales, nuevos signos gráficos) | — |
| Nueva concepción instrumental | — |
| Estructuración | — |
| **Aleatoriedad fundamental** | 179 |
| **Sonido y acción teatral** | 211 |
| **Grafía y plasticidad como propuesta sonora** | 239 |
| **Notación y nuevos instrumentos** | 263 |
| **Pedagogía y participación** | 297 |
| **El sonido representado gráficamente** | 349 |
| Partituras estudiadas · Bibliografía · Índice onomástico | 375 / 385 / 391 |

⚠️ **What I could NOT verify: the book's actual arguments.** No full text, no scanned index beyond
the chapter list, no scholarly review was reachable. So this survey **does not quote it** and does
not attribute any rule to it. What its table of contents *does* establish — and this is the one
thing it contributes below — is its **axis of organisation**: Villa-Rojo sorts 20th-century notation
by *what the composer was trying to specify* (aleatoriedad, acción teatral, grafía as sound
proposal, new instruments), **not** by symbol shape. That is the same axis this survey uses, and
§2 shows it is the axis the German-language tradition reached first.

An Italian translation exists: *Notazione e grafia musicale nel XX secolo*, Zecchini Editore,
Varese, 2013 — per the author's own list of writings.

### The near-miss worth recording

**Ana María Locatelli de Pérgamo, *La notación de la música contemporánea: teoría y ejemplos
gráficos*** (Melos / Ricordi Americana, Buenos Aires, ✅ 1973; still in print, and awarded Argentina's
Premio Fondo Nacional de las Artes) surfaced in the search and is a genuine peer of the Villa-Rojo —
thirty years older, and it ends with an **appendix of contemporary graphic signs sorted by *alturas,
intensidades, ritmos, timbres*** ✅, i.e. by *which parameter the sign controls*. Same axis again
(§2). It is *not* the user's book — the title lacks *grafía*, and no part of the author's name
resembles "villarobos" — but it is the other Spanish-language entry in this literature and is listed
so the search does not have to be repeated.

---

## 2. ⭐⭐ The spine: Karkoschka's four kinds — a taxonomy BY WHAT IS DETERMINED

Erhard Karkoschka, *Das Schriftbild der Neuen Musik* (Moeck, Celle, 1966; English as *Notation in
New Music: A Critical Guide to Interpretation and Realisation*, trans. Ruth Koenig, Universal
Edition / Praeger, 1972) sorts new notation into **four kinds**, and the sort is by *how much the
score determines*, not by how it looks:

| Karkoschka's kind | what the score fixes | what a model would have to be able to say |
|---|---|---|
| **Exact notation** (*Präzise Notation*) | everything — pitch and time are single values | what we already say, extended in RANGE (§3, §4) |
| **Frame notation** (*Rahmennotation*) | a *bounded set*; the performer picks inside it | a value can be an **INTERVAL or a SET**, not a scalar |
| **Indicative notation** (*Hinweisende Notation*) | a *character* or *tendency*, no bounds | a symbol may carry **no value at all**, only prose |
| **Musical graphics** (*Musikalische Grafik*) | nothing measurable; the image is the stimulus | the page may hold **ink that is not an event** |

⭐ **This is the single most useful frame in the whole literature for our purposes, because it is
already a statement about data.** The four kinds are four different answers to *"what does this mark
resolve to?"* — one value, a range, a word, nothing. Every axis below lands in one of them, and the
cost of the axis is set by which one.

Three footnotes. ✅ The four names and their order come from the **published contents listing of
Koenig's translation**, which gives Part 2 ("Present practice") as *Exact notation · Frame notation ·
Indicative notation · Musical graphics · The notation of electronic music* — so the **fifth**
section is a medium, not a determinacy level, and is left out of the table for that reason. ⚠️ **The
glosses in the right-hand column above are MINE**, inferred from the category names; I never reached
the book's own definitions, and a later research pass could not source the taxonomy at all. ⚠️ **A
claim that Karkoschka credits Bogusław Schäffer with "frame notation" appeared in drafting and is
NOT sourced — treat it as false until checked.** ⚠️ **Where proportional notation sits among the
four is undetermined** — "frame" means *choice within a boundary*, which is not the same as *space
equals time*, and a proportional score can be perfectly determinate.

Read it alongside the two English-language codifications that followed:

- **Kurt Stone, *Music Notation in the Twentieth Century: A Practical Guidebook*** (Norton, 1980,
  357 pp.). Stone ran the **Index of New Musical Notation** and the **International Conference on
  New Music Notation (1974)**, where ~80 musicians from 18 countries were polled for consensus on
  which of the proliferating devices actually worked in performance. ⭐ Stone is therefore not a
  catalogue of what exists but a **recommendation of what to standardise** — the closest thing the
  period has to a normative reference, and the one an editor should follow where it speaks.
- **Gardner Read, *Music Notation: A Manual of Modern Practice*** (2nd ed., Allyn & Bacon /
  Taplinger, 1969, 482 pp.), plus his two survey volumes — ***20th-Century Microtonal Notation***
  (Greenwood, 1990, 198 pp.) and ***Source Book of Proposed Music Notation Reforms*** (Greenwood,
  1987). Read is the **inventory**: chronological, exhaustive, deliberately non-normative.
- **Elaine Gould, *Behind Bars: The Definitive Guide to Music Notation*** (Faber Music, 2011, 704
  pp.), whose third part carries chapters on **electroacoustic and aleatoric music**. Gould is our
  standing reference for the *engraving* of all of this (`docs/spacing-model-research.md` already
  quotes her p. 39), and is the most recent codification that a publisher actually enforces.

⚠️ **The literature is old and the practice is not.** Stone is 1980, Read's microtonal survey 1990.
The only *living* codification of contemporary symbols is **SMuFL**, which is why it is used below
as the reality check on every axis: if a practice has a SMuFL range, it is settled enough that
somebody will eventually ask for it.

### ⚠️ A repo-fact fresh today: BOTH primary specs have moved host

**The `w3c.github.io` URLs for SMuFL and MusicXML are dead links behind redirects.** Observed
2026-08-13, independently, three times in this session ✅:

- `w3c.github.io/smufl/…` → `w3c-cg.github.io/smufl/…` → **`smufl.formats.music`**
- `w3c.github.io/musicxml/…` → `w3c-cg.github.io/musicxml/…` → **`musicxml.formats.music`**

The GitHub repositories likewise moved from `w3c/*` to **`w3c-cg/*`**, maintained by the **W3C Music
Notation Community Group**. Two URLs that remain stable and are used in preference throughout this
file: the frozen **MusicXML 4.0 snapshot** at `www.w3.org/2021/06/musicxml40/` ✅ and the
machine-readable **`raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/ranges.json`** ✅ (132
ranges), from which Appendix A is taken.

SMuFL's latest published version is **1.40, March 2021** ✅ — ⚠️ the release date is given as the
15th on the spec's own version-history page and the 20th on `smufl.org`'s news post; one of them is
wrong and it does not matter which.

⭐ Per `reference_repo_fact_comments_need_a_check`: **these are repo facts, and repo facts rot.** If
a link here 404s, follow the redirect chain before concluding the thing is gone.

---

## 3. PITCH beyond 12-EDO

### 3.1 What the practice is

An accidental stops being one of five values and becomes a member of one of **a dozen mutually
incompatible systems**. The systems differ not in how they look but in **what one sign means**, and
they fall into four semantic classes ✅:

| class | one accidental means | systems |
|---|---|---|
| **A — a fraction of a whole tone / an EDO step** | a rational fraction of 200 ¢ | **Hába** (*Neue Harmonielehre…*, 1927; ¼, ⅓, ⅙, 1/12 tones) · **Wyschnegradsky** (*Manuel d'harmonie à quarts de ton*, 1932; 11 up + 11 down at 1/12 tone = 16⅔ ¢ = 72-EDO) · **Maneri–Sims** (Ezra Sims, 1970s; three pairs at 1/12, 1/6, 1/4 tone, **compounding** with ♯/♭) |
| **B — a fixed cent offset, by convention only** | ±50 ¢, no tuning theory attached | **Stein–Zimmermann** / **Tartini–Couper** — the de-facto quarter-tone standard |
| **C — a JI ratio off a *just C major* base** | multiply the frequency by a rational constant | **Ben Johnston** |
| **D — a JI ratio off a *Pythagorean chain of fifths*** | multiply the frequency by a rational constant | **HEJI** (Sabat / von Schweinitz) · **Sagittal** (Secor & Keenan) |

⭐⭐ **The C/D split is the fact that decides the model.** The same prime gets a *different comma*
depending on the base: prime 7 is **36/35 (48.77 ¢) in Johnston** but **64/63 (27.26 ¢) in
HEJI/Sagittal** ✅, because Johnston's unaltered minor seventh is 9/5 and HEJI's is 16/9. And
Johnston's "7" **lowers**, it does not raise ✅ (SMuFL: `accidentalJohnstonSeven` = *"Seven (lower by
36:35)"*).

⛔ **So semantics may NEVER be keyed off the glyph.** Tartini's half-sharp (1756) means 50 ¢ in
Stein–Zimmermann and 27.3 ¢ in HEJI. Stein's reversed flat means 50 ¢ in one and 33/32 ≈ 53.3 ¢ in
the other. ✅ Worse, the **arrow modifiers have no fixed value at all** — Unicode L2/23-276 states
it outright: *"In every case, an arrow requires explanation in the performing directions, so it has
**no assumed meaning** other than 'some kind of alteration in this or that direction.'"* ✅

**A naming fact worth recording because it is universally misremembered:** the "Zimmermann" of
*Stein–Zimmermann* is **Bernd Alois Zimmermann the composer** (1918–1970), who used the reversed
flats — not the publisher. Richard Stein (1882–1942) contributed the half-sharps in his *Zwei
Konzertstücke* Op. 26; both were anticipated by **Tartini in 1756**. ✅ SMuFL itself glosses the
range as *"Stein-Zimmermann (also known as Tartini-Couper)"* ✅.

**Sagittal is the only system designed as a superset** — its accidentals are *"prime-number commatic
alterations to tones in a Pythagorean series"* usable to notate *"both rational intervals … and
equal divisions of the octave"* ✅, and it reproduces Tartini–Couper and Bosanquet as special cases.
But it carries its own warning: the cent sizes *"apply only to rational or JI tunings … In various
ETs these commas … may be either larger or smaller than their rational sizes, or they may **vanish
altogether**"*, and *"it is necessary that sufficient information be provided in a score to specify
the particular tuning that is intended, along with a pitch reference"* ✅. **Sagittal is undecodable
without a score-level tuning declaration.**

⚠️ **HEJI v1 → HEJI2 (2020) is a breaking change of MEANING, not of shapes.** In v1 the higher
primes modified lower-prime signs compositely (17 modified the 5-limit sign); in v2 every prime gets
an independent comma off the Pythagorean spine. **The same glyph denotes a different pitch in a v1
and a v2 document** ✅. Anything storing HEJI must version-stamp it.

### 3.2 Who codified it

**Gardner Read, *20th-Century Microtonal Notation* (Greenwood, 1990)** is the survey — five chapters
organised by *how the octave divides* (quarter/three-quarter; eighth/sixteenth; third/sixth/twelfth;
fifth-tones and 31-tone; extended and compressed scales) ✅. His complaint, verbatim from the
publisher's synopsis: *"**no consensus has yet been reached** about the clearest and most logical
notation for each degree of microtonal division … This lack of an essential consensus on a suitable,
standardized notation system has, in some cases, **hampered the complete integration of
microtonalism into western music**."* ✅ Larry Polansky's *Leonardo Music Journal* review (1991) adds
the nuance that **Read documents rather than prescribes** — *"not prosecution, defense or judge but
rather the effective investigator"* — and objects that Read treats 12-TET as a given when *"Twelve-tone
equal temperament itself is a 'microtonality', one of many."* ✅

### 3.3 ⭐ What a model must be able to say

> ***"This notehead is displaced from its nominal by an amount whose AUTHORITY is a named tuning
> system — and the glyph that shows it is a separate fact from the number that sounds it."***

The corollaries, each forced by a source above:

- **The glyph and the tuning are two fields.** ✅ Only **MusicXML** and **MuseScore** separate them:
  MusicXML's `<alter>` is `xs:decimal` semitones (*"Decimal values like 0.5 (quarter tone sharp) are
  used for microtones"*) and is **independent** of `<accidental smufl="…">`; MuseScore's `Note.tuning`
  is a free cents value not driven by the accidental at all. **MEI has no numeric microtonal
  attribute on `<note>`** — its `@pnum` is *"a base-40 or MIDI note number"*, which cannot hold a
  quarter tone; its whole temperament vocabulary is four tokens (`equal`, `just`, `mean`,
  `pythagorean`). ✅
- **⛔ No format stores a RATIO.** Not MusicXML, MEI, LilyPond, Dorico or MuseScore ✅. HEJI, Johnston
  and Sagittal survive a round-trip only as *glyph names*, their tuning lost or hand-re-encoded as
  cents. **This is the open gap in the whole field**, and the reason `class C/D` systems are
  effectively un-interchangeable today.
- **The alteration is a RATIONAL fraction of a whole tone, not a float.** LilyPond gets this right —
  `ly:make-pitch`'s alter is *"a rational number of 200-cent whole tones"* ✅, an exact Scheme
  rational. ⭐ That is the same instinct as our own `Fraction` invariant, arriving at pitch instead of
  time. LilyPond is also candid: *"There are no generally accepted standards for denoting quarter
  tone accidentals, so LilyPond's symbols do not conform to any standard."* ✅
- **Dorico's answer is worth knowing and worth NOT copying wholesale.** A *tonality system* = an EDO
  count + a set of accidentals + a key signature; each accidental carries an integer **"pitch
  delta"** in EDO divisions, and fine resolution is bought by choosing a huge EDO (12000-EDO = 0.1 ¢)
  ✅. It is clean, and it **cannot represent a ratio** — everything quantises.
- **The system is POSITIONAL.** Per `DESIGN-PRINCIPLES.md` §6's test — *can it vary at a point in the
  score?* — a piece can change temperament mid-piece, so a `score.tuningSystem` field would be
  exactly the forbidden shape, silently meaning "the system at bar 1 beat 0".
- **Key signatures are a list, not a count.** MusicXML's non-traditional `<key>` is 0..n
  `(key-step, key-alter, key-accidental)` triples **in left-to-right order**, and `<key-alter>` is
  `semitones` so it is fractional-capable ✅. MEI's `@sig` has a literal **`mixed`** token for exactly
  this, with `<keyAccid>` children each pinned by pitch-name *or raw staff location* ✅. ⭐ The
  sharpest difference: **MusicXML carries a NUMBER in the key signature; MEI carries only a SYMBOL.**
  A reader of MEI who does not know the token `1qs` gets nothing quantitative. Store the number.
- ⚠️ **Not verified:** Johnston's ratios for primes 17/19 (computable, not read printed) and **nothing
  published at all for 23/29/31**; a contradiction between SMuFL and Secor–Keenan over whether the
  Sims arrow pair is 1° or 2° of 72-EDO. Do not encode those from this document.

---

## 4. TIME beyond the barline

> 🚨🚨 **PROVENANCE WARNING — §4 and §5 only. Read this before using either section.**
>
> These two sections were **drafted before the research pass on time and indeterminacy returned**,
> and were then reconciled against it. The reconciliation found agreement on the *format* claims
> (MusicXML, MEI, LilyPond, Dorico, MuseScore, SMuFL) and on **Lombardi's feathered-beam result**,
> which is the most load-bearing finding here — those are solid.
>
> ⚠️ But it also found that a number of **musicological** claims below — the Ghent 1974 report's
> wording, the Berio *Sequenza I* re-notation, the Getty commentaries, the Feldman and Cage
> secondary literature, the Lutosławski letter — **could not be re-confirmed**, because the
> session's search budget was exhausted by then. Each such claim is now marked 🔶 rather than ✅.
> **A 🔶 claim is plausible and specifically attributed but UNCONFIRMED in this session; do not
> quote one without checking it.** Appendix B lists them all.
>
> ⛔ Nothing in §4/§5 should be treated as settled fact on the strength of this file alone.

### 4.1 The split that must be made first

Two different things share the name "proportional", and conflating them is the first modelling
error ✅:

- **(a) proportional SPACING** — ordinary note-value symbols, laid out so x-distance ∝ duration.
  A **layout policy**. LilyPond: *"a type of horizontal spacing in which each note consumes an amount
  of horizontal space exactly equivalent to its rhythmic duration"*; MuseScore calls a spacing ratio
  of 2.0 *"effectively, 'space-time notation'"*. **Every engraver has this**, and so, in effect, do
  we — it is a number in the spacing rule (`docs/spacing-model-plan.md`).
- **(b) proportional NOTATION** — the rhythmic-value symbol is **abandoned**; x-position and line
  length are the only carriers of duration. **Only LilyPond has a primitive for this** (the
  `DurationLine` grob) ✅.

⭐⭐ **And they are indistinguishable from the graphics alone, which has bitten a major composer.**
Berio's *Sequenza I* was published in 1958 in spatial notation; the 1992 Universal Edition version,
approved by Berio, **re-notates it in conventional rhythm** because flautists read the spacing as a
licence when he had intended it to be rhythmically exact 🔶. **Spacing is a rendering choice; freedom
is a separate flag; they must never be the same field.**

### 4.2 Who codified it — and the non-decision that is the real finding

The authority is the **International Conference on New Musical Notation, Ghent, 22–25 October
1974** — organised by Kurt Stone's **Index of New Musical Notation**, ~80 delegates from 17–18
countries voting on close to 400 signs, published in *Interface* 4/1 (1975), and reportedly **readable in full
online** 🔶. Delegates included Earle Brown, Haubenstock-Ramati, Karkoschka, Crumb and Wuorinen.

Its §II splits duration into exactly the two worlds a model needs — **symbolic durational notation**
vs **proportionate durational notation** 🔶 — and adopts **two rival duration-line conventions "as
equal alternatives"**: *duration beams* (thick, beam-like) and *note-head extensions* (thinner, and
*"best suited for single lines"*), both taking an **arrow head at a system break** 🔶. A coarse
residue of note values survives as a hint, not as the carrier: *"White and black note-heads may be
used for relatively long and short values, respectively."* 🔶

⭐⭐ **And then it declines to standardise the scale.** Verbatim, §II.2.C:

> *"On the issues of timing indications (by metronome marks, by seconds, by beat dividers, etc.) and
> of mixtures of different timing methods, **no preferences were adopted. Instead, decisions should
> be from case to case**."* 🔶

**That is a documented non-decision by the field's own standards body, and it is worth more to us
than a standard would be** — it says the scale marking is *authored data*, not a constant. What is
attested in practice: Cage's *4′33″* Kremen manuscript writes *"1 page = 7 inches = 56″"* 🔶;
Warfield says a proportionate score *"should have a special indication"* of reading speed 🔶; timing
brackets are prescribed for **local** scale changes (*"If temporary changes in the proportionate
spacing become necessary, timing brackets should be used"*) 🔶 — i.e. a **ranged override**, not a
global.

⛔ **Naming trap:** "time ruler" is not an engraving term (every hit is DAW software) and
"chronometric notation" is not either. The attested names are **"time scale"** and
**"space-equals-time scale"** 🔶.

### 4.3 Unmeasured and senza misura

| | mechanism | verdict |
|---|---|---|
| **MusicXML** | `<senza-misura>` inside `<time>`; its string content **is the symbol to draw**, e.g. `X` ✅ | removes the **meter**, never the **spine** |
| | `<measure>` is **MANDATORY** — `<part>` requires one or more ✅ | ⭐ you can never escape the bar |
| | `<bar-style>none</bar-style>` ✅ | the barline can vanish |
| **MEI** | ⭐ **`<staff>` may sit DIRECTLY inside `<section>`** ✅ | genuinely unmeasured music, no `<measure>` at all |
| | `<measure>@metcon` — *"the relationship between the content of a measure and the prevailing meter"* ✅ | a bar can declare itself non-conforming |
| | `<meterSig>@sym` ✅ | ⛔ has **no** open-meter value |
| **LilyPond** | `\cadenzaOn`/`\cadenzaOff` — music between them *"does not count toward the length of a measure"*; disables bar demarcation, numbering, accidental reset, auto-beaming **and auto line breaks** ✅ | |
| **Dorico** | **open meter**, typed `X`; *"no restrictions on meter, beaming, or beats"*; *"you must input barlines and add beats manually"*; three display styles ✅ | ⭐ the three styles map **exactly** onto SMuFL: nothing / `timeSigX` U+E09C / `timeSigOpenPenderecki` U+E09D |
| **MuseScore** | no open meter — a nominal meter plus an **Actual** duration, marked with a small `+`/`−` ✅ | |
| **Finale** | ⚠️ **discontinued 26 Aug 2024** ✅ after 35 years; MakeMusic now resells Dorico. Historical data point only. | |

⚠️ **A premise worth correcting because it is a natural guess:** MusicXML's `<measure implicit="yes">`
is **not** a free-measure hook — it means *"the measure number should never appear"* ✅, a numbering
flag for pickups. The genuinely relevant attribute is **`@non-controlling`**: *"the left barline in
this measure does not coincide with the left barline of measures in other parts"* ✅ — the only
sanctioned way to say *these parts are not vertically aligned here*.

### 4.4 Feathered / accelerando beams — ⭐⭐ the over-determination result

We already draw these (`docs/fanned-beams-plan.md`, `FanPass`), so this is the axis where the survey
has something to say about work that exists.

**The convention** (Gould, and Dorico verbatim): *"The slowest part of the phrase is where the beams
converge, and the fastest is where the beams are the most spread out"*, with two beams vs three
indicating the magnitude of change ✅. Kurt Stone's rule for the metered case: place **a horizontal
bracket over the beam with a notehead giving the full duration** ✅.

**How the formats store it — all four store the DRAWING only:** MusicXML `<beam fan="accel|rit|none">`
(*"The fanning factor affects all the beams in a beaming group"*); MEI `@form ∈ acc|rit|norm|mixed`;
MuseScore *"not supported in playback"* ✅. **LilyPond alone splits it in two**: `Beam.grow-direction`
is the *drawing* and `\featherDurations` is the *timing*, separately overridden ✅ — with the candid
admission that *"the spacing in printed output only approximately represents note durations, while
MIDI output remains exact"*.

🚨 **A live MEI trap:** `@form`'s gloss **REVERSED between v3/v4 and v5**. v3/v4 said *acc* means the
beams get *"progressively closer together toward the end"*; v5 says *acc* means *"progressively more
distant toward the end"* ✅. **v5 agrees with Gould and Dorico**, so this reads as a correction — but
a file authored against v3/v4 carries the opposite intent, and nothing in the file says which.

⭐⭐ **The real finding is that a feathered beam is over-determined.** Paul Lombardi, *"Feathered
Beams"*, *Journal MusMat* V/2 (2021), read in full ✅:

> *"This notation specifies note values at the beginning and ending of the beamed group, a gradual
> transition … and in some cases, a precisely specified total duration. This notation, however, does
> not indicate exactly how to execute the gradual transition… **This lack of information means that
> the notation is inherently indeterminate. However, the specificity of the notation disguises this
> indeterminacy.** Furthermore, in some cases, the various specific requirements … may be **so
> contradictory that they are impossible to realize in practice**."* ✅

A feathered beam asserts **four** facts — start value, end value, note count, total span — and they
are generally inconsistent. Lombardi works Crumb's *Night Music I* (5 notes, 𝅘𝅥𝅰→♪, inside one
quarter) and shows the three uniform ways to force a fit **contradict each other**: keep-first gives
a final note near a 16th (contradicting the written 8th); keep-last gives the **first note a negative
duration**; keep-slope makes the first note nearly a 256th ✅. The transition curve is a further free
choice — linear vs quadratic vs spline give totals of 0.656 w / 0.543 w / 0.436 w for the *same*
written beam ✅.

### 4.5 ⭐ What a model must be able to say

> ***"A duration may be a written symbol, a number of seconds, or neither — and where several written
> facts over-determine a passage, the model names which one is AUTHORITATIVE."***

- **Two timelines, not one.** MEI's `att.duration.ges` already carries **`@dur.real` — "Duration in
  seconds, e.g., 1.732"** ✅, alongside `@dur` (written), `@dur.ges`, `@dur.metrical`, `@dur.ppq`,
  `@dur.recip`; and `@tstamp.real` is an **ISO clock reading** `HH:MM:SS.ss` ✅. MusicXML has **no
  seconds anywhere in the note model** — `<duration>` is *"a positive number specified in division
  units"* — and a 2016 proposal to allow millisecond durations **was not adopted** ✅. ⭐ Proportional
  notation is exactly the case where the *written* duration is absent and the *real* one is
  authoritative; MEI has already blessed that split.
- **A duration LINE is a spanner with broken pieces, not one graphic.** Ghent's only system-break
  ruling is the arrow head 🔶 — the sounding event is split at the break like a tie. LilyPond's
  `DurationLine` confirms the break needs its own geometry: `minimum-length-after-break` (6 staff
  spaces) is a **different property** from `minimum-length` (2) ✅, and `bound-details` carries
  `left-broken`/`right-broken`. Styles: `beam` (default), `line`, `dashed-line`, `dotted-line`,
  `zigzag`, `trill`, `none`; end markers are hooks (beam style only) or arrows ✅.
- ⭐ **MEI can express the duration line generically, and its END-SYMBOL vocabulary is the one to
  copy.** `<line>` is *"a visual line that cannot be represented by a more specific, semantic
  element"*, taking `@startid`/`@endid`/`@tstamp`/`@tstamp2`, `@form` ∈ dashed|dotted|solid|wavy, and
  `@startsym`/`@endsym` from `data.LINESTARTENDSYMBOL` ✅ — whose members include `angledown` (*"90
  degree turn down"*), `angleup`, `arrow`, `arrowopen`, `arrowwhite`, `harpoonleft`, `none`. **The
  hook is `angledown`/`angleup`; the arrow is `arrow`.** So the two Ghent terminations and
  LilyPond's `DurationLine` end-styles are the *same small vocabulary*, arrived at independently.
- ⭐ **The scale is ONE reference duration, and the way you pick it is our `shortestDuration`
  problem.** LilyPond's `proportionalNotationDuration` is found *"usually by a process of trial and
  error, beginning with a duration close to the fastest (or smallest) duration in the piece"* ✅, and
  proportional output additionally requires `SpacingSpanner.uniform-stretching = #t`. ⭐⭐ Compare
  `docs/shortest-duration-plan.md` and `project_reference_duration` — *the spring is `space(shortest
  SOUNDING) × k`*. **That is the same quantity.** Proportional notation is not a new mechanism for
  us; it is our existing reference duration with the ratio driven to 1 and the note symbols removed.
- **The scale marking is authored, positional, and locally overridable** (§4.2). Never a constant.
- **The prefatory material is the structural enemy.** Clef, key and accidentals have zero duration
  and non-zero width; LilyPond needs `strict-note-spacing` and `\remove
  Separating_line_group_engraver` to hold the proportion ✅, and Ghent warns the composer from the
  other side (*"the amount of space necessary to place accidentals in front of the notes must also be
  carefully considered"*) 🔶. ⭐ This is the same fact our `docs/empty-bar-line-start` finding is about,
  seen from the opposite end.
- **"No meter" is a KIND of meter, not an absent one** — MusicXML's `<senza-misura>` lives *inside*
  `<time>` and carries the symbol to draw ✅. So `Measure.timeSignature` need not become optional.
- **A feathered beam wants a POLICY field, not a boolean.** The honest minimum, from Lombardi:
  members (N is data, not derived from the drawing), the two written endpoint values, an optional
  total span, a **fit policy** (keep-first / keep-last / keep-slope / free), a **curve**, and
  separately the *drawing* (direction, beam count). ⭐ LilyPond's two-override split is the precedent,
  and our own hairpin rule is the same instinct — *no engine stores an ANGLE, it is derived from the
  aperture*.

---

## 5. GRAPHIC and INDETERMINATE notation

### 5.1 The taxonomy that is the design brief

Cage's own frame (*Composition as Process* II, "Indeterminacy", Darmstadt 1958, in *Silence*) draws
the line at **indeterminacy with respect to PERFORMANCE**, and explicitly rules out *Music of
Changes* — chance was used in *composition*, the notation is fixed, and the performer is a
*"contractor"* ✅. The standard modern taxonomy splits three ways, and ⭐ **each third demands
something completely different**:

| kind | example | what a model owes it |
|---|---|---|
| **1. indeterminacy of composition** | *Music of Changes* | **nothing.** The output is an ordinary determinate score. |
| **2. mobile / open form** | Klavierstück XI, Boulez 3rd Sonata, *Available Forms* | **fragments + navigation rules** — §5.3 |
| **3. graphic notation** | *December 1952* | **graphics + a rubric**, not music data — §5.4 |

Lutosławski sits apart as *limited* indeterminacy and is the most encodable of the lot (§5.2).

### 5.2 What each famous score actually SPECIFIES

**⭐ The recurring primitive is a RANGE, and the interesting quantity is never stored.**

- **Cage's time brackets** (the Number Pieces): each event carries **two ranges** printed side by
  side — a start window and an end window. Sluchin & Malt model it as the quadruple
  `(s_l, s_u, e_l, e_u)`, and because the windows are symmetric and overlapping the event's figure is
  a **trapezoid** 🔶. **There is no stored duration**: it is derived from the performer's two choices
  and ranges from near-zero up to `e_u − s_l`. In *Four²*, an F4 may *"begin anywhere between 0'00"
  and 1'00" … and end anywhere between 0'40" and 1'40""* 🔶. **Fixed**: pitch, instrumentation,
  dynamics, total duration. **Free**: start, end, hence duration. The *fixed* brackets of the
  *Music for ___* corpus print two single times rather than two ranges — the **degenerate case**
  (`δ=0`), not a separate kind 🔶. And Cage *"deliberately omitted a score on many occasions"* 🔶 —
  a score view must be *synthesised* from the parts as lanes on a seconds timeline.
- **Lutosławski's ad libitum sections**: **pitch is exact, rhythm and coordination are free** 🔶. He
  *"intentionally never extended his employment of chance techniques beyond rhythm"*, and his own
  words are that controlled aleatorism enriches the music *"without limiting in the least the full
  ability of the composer to determine the definitive form of the work"* 🔶. ⭐⭐ **The String Quartet
  (1964) was published as PARTS ONLY, and the reason is a data-model argument in the composer's own
  hand**: *"The piece consists of a sequence of mobiles … Within certain points of time particular
  players perform their parts quite independently of each other … **if I did write a normal score,
  superimposing the parts mechanically, it would be false, misleading, and it would represent a
  different work**."* 🔶 A model that assumes one timeline shared by all staves **cannot represent
  it** — which is precisely why the composer refused to publish a score. The section mode (ad
  libitum vs *a battuta*) is itself data 🔶.
- **Feldman's *Projection 1* (1950)** is the most encodable work in the whole survey, and there is a
  published data model for it (Lepper & Trancón y Widemann, TENOR 2024) 🔶. The score *"only
  specifies the time position, duration, and the pitch register of the events. **The selection of the
  sounding pitches is left to the players**"*. Register is a **band** — lower/middle/upper third of
  the staff — not a value. The grid is explicitly *"for orientation only and do in no way imply
  metric emphasis or structure"*, with onsets aligned to quarters that are *"not explicitly
  represented visually"*. Timbre (ordinary / harmonic / pizzicato / sul ponticello) is carried by
  **which staff** the event is on. ⭐ And a precedent worth quoting for what NOT to store: the
  horizontal band-separator lines *"do not carry any semantics for the execution of the piece.
  **Therefore our data model does not contain this information**."* 🔶 ⚠️ Correcting a common
  premise: in the *Projections* a digit indicates **how many pitches sound simultaneously**, not how
  many attacks 🔶.
- **Bussotti's *Five Piano Pieces for David Tudor* (1959)** contains the whole determinacy spectrum
  in one opus 🔶 — Nos. 2 and 5 traditionally determinate, No. 1 a **tablature** (the five staff lines
  are the **five fingers**; `u`/`o` = fingernail vs pad), No. 3 read with the vertical axis as *"an
  unspecified range of pitches"*, and ⭐ **No. 4 the encodable one**: *"Staff 3 … asks the performer to
  calculate values for the parameters of each attack (sequence in time, frequency, duration, and
  intensity) **based on measured distances** between the drawing's dark spots and the angular staff
  lines"* 🔶. The data are geometric and the musical parameters are a *documented function* of them.
- **⭐⭐ Earle Brown's *December 1952*** is the boundary case, and the crucial fact is a **negative
  one**. Getty: the 31 rectangles *"represent sound events in time, with various intensities,
  aggregates of pitches, or durations (**though no key is supplied as to how that might work**)"* 🔶,
  and *"the page may be oriented in any direction"* 🔶. The familiar gloss — length = duration,
  thickness = loudness, height = pitch — describes **Brown's compositional procedure, not a printed
  instruction**. There is essentially no music to store: it is a **vector drawing plus rewrite rules
  on the reading frame** (start point, direction, rotation, duration).
- ⚠️ **A premise this survey could NOT support: Ligeti's *Aventures* as proportional/seconds
  notation.** No source found, and weak counter-evidence points the other way (*"Ligeti notated every
  thread of his complex textures, while other composers employed chance or vague notation"*). What
  *is* verified is an invented phonetic vocal language, triangular noteheads for audible breathing,
  and a theatrical/gestural layer 🔶. **Ligeti is the counter-example in this list, not a member.**

### 5.3 Mobile / open form — and the format answer

- **Stockhausen, *Klavierstück XI* (1956)** — **19 fragments** on one sheet, chosen by *"looking on
  the sheet without any intention and taking any fragment 'that catches his eye'"* 🔶. ⭐ **The
  interesting part is the CARRIED STATE**: *"markings for tempo, dynamics, etc. at the end of each
  fragment are to be applied to the **next** fragment"* — six tempi × six dynamics × six attack
  modes, so the same fragment has 216 renderings — and the halt rule is *"until a fragment has been
  reached for the third time"* 🔶. So: `Fragment[19] { music, exitTempo, exitDynamic, exitAttack }`,
  a realisation is a **walk** where fragment *n* renders with *n−1*'s exit triple, terminating at
  `count == 3`.
- **Boulez, *Third Piano Sonata*** — five formants, formant 3 fixed at the centre, the other four in
  two orderable pairs, and inside *Trope* a **relational constraint**: any opening *"as long as
  *Commentaire* is played either before or after *Glose*"* 🔶. Boulez's own metaphor: *"I have often
  compared this work with the plan of a city … One can choose one's own way through it, but **there
  are certain traffic regulations**"* 🔶. A directed graph with a predicate no enumeration captures
  compactly.
- **Earle Brown, *Available Forms I/II*** — through-composed events plus *"a cueing system for
  conductors to signal in-performance decisions about the order and phrasing"* 🔶; the conductor
  determines repetitions and omissions, so the **duration is variable**. ⭐ **The navigation is not in
  the file at all** — it is a live protocol. This is the case that forces separating **Score** from
  **Realisation**.
- **Haubenstock-Ramati, *Interpolation*** — *"fragments of conventional notation connected by broken
  lines, arranged so as to resemble a Calder mobile"* 🔶: literally **nodes plus drawn edges**, the
  most directly encodable open form here. **Pousseur's *Scambi*** — 32 sequences combinable by
  *"matching characteristics at the beginning and end of each sequence"* 🔶, i.e. an explicit **join
  predicate**, the closest thing to a typed connector.

**⭐⭐ The format answer: NOTHING encodes open form.**

MEI's `<app>`/`<rdg>`/`<choice>` cannot do it, for three reasons each grounded in the Guidelines ✅:
**wrong semantics** (`<app>` is defined for *"differences between varying **sources**"*, `@source`
expects a bibliographic witness; `<choice>` is for *editorial* sic/corr); **wrong cardinality**
(one-of-N at a point, whereas open form is a permutation with carried state, or a constraint, or a
live input); **wrong locus** (*"the content of every `rdg` and `lem` has to be a valid replacement
for its parent `app`"* — a substitution in a fixed spine, and open form **has no spine**).

What MEI *does* have that is closer, and worth knowing:
- **`<expansion>@plist`** — *"an ordered list of identifiers"*, e.g. `#A #End1 #A #End2` ✅. ⭐ That is
  exactly a **`Realisation`**, one concrete walk — and precisely not the rule that generates walks.
- **The facsimile module**: `<zone>` defines *"an area of interest within a surface or graphic file"*
  by `@ulx/@uly/@lrx/@lry` ✅. ⭐ **This is how graphic scores actually get encoded in MEI: the image
  is the truth and the encoding annotates regions of it.**
- **`<symbolTable>`/`<symbolDef>`** may contain `<line>`, `<curve>`, `<anchoredText>`, `<graphic>`
  and **embedded SVG** 🔶; and `model.graphicPrimitiveLike` allows drawing primitives **directly
  inside `<section>`** ✅. That is MEI's real answer for invented notation.
- ⛔ `<bracketSpan>@func` is only coloration / cross-rhythm / ligature / unspecified — **no aleatoric
  box** 🔶.

**MusicXML has nothing at all** — no variant mechanism, no fragments, no navigation, no seconds ✅.
And **no shipping program has a native aleatoric box**: Dorico, Sibelius and Finale users all build
them from lines, text and shapes 🔶.

⭐ Which is why the research world routed around the formats entirely: **Decibel ScorePlayer**
(network-synchronised scrolling proportional colour scores), **INScore** (augmented dynamic scores
driven over OSC), **MaxScore**, and **DigiScore** (ERC, 2021–26). ⚠️ **All four are named here on
recollection only — none was opened in this session.** They are, however, the right place to look
next, and the reason to look is §5.3's negative result.

### 5.3b ⭐ Two glyph facts from the late pass, both confirmed and both useful

- ⭐ **`conductorUnconducted` U+E89A — *"Unconducted/free passages"*, in the Conductor symbols range**
  ✅. This is **the closest thing to an aleatoric marking in all 132 SMuFL ranges** — one glyph. It
  is the exhaustive answer to "does the standard cover indeterminacy": no, but it does give you a
  way to *mark the passage*.
- 🚨 **There is no "Metric modulation" range** ✅ — which matters to us, because
  `docs/metric-modulation-plan.md` already ships the building-block glyphs. The two arrows live in
  **Miscellaneous symbols**: `metricModulationArrowLeft` U+EC63 and `metricModulationArrowRight`
  U+EC64 ✅. MusicXML's counterpart is `<metronome>` with `<metronome-note>` / `<metronome-relation>`
  — which *"allow for the specification of metric modulations and other metric relationships, such
  as swing tempo marks"* — plus **`<metronome-arrows>`**, which *"indicates that metric modulation
  arrows are displayed on both sides of the metronome mark"* ✅. ⭐ Note the shape: **the arrows are a
  display flag on the mark, not part of the relation.** That is the same ink-vs-meaning split the
  metric-modulation plan already assumes.

### 5.4 ⭐ What a model must be able to say

> ***"A value may be a range, a band, or unspecified — and some ink on the page is not an event at
> all."***

Three constraints, each with a source above:

1. **A field that is "sometimes free" wants a UNION, not a nullable value**: `Exact | Range | Band |
   Unspecified`. Cage needs `[startLo,startHi] × [endLo,endHi]` with duration derived; Feldman needs
   register as a band and pitch as *absent*; Lutosławski needs exact pitch with free rhythm.
2. **The discriminator for "is this music data?" is whether the graphic has a DOCUMENTED MAPPING to
   parameters.** Bussotti No. 4 has one (measured distances → four parameters) and is encodable as
   geometry plus a decoding function. *December 1952* has none — Getty says so explicitly — so the
   right storage is a **facsimile region plus free text**, never a note. Feldman's band-separator
   lines have no execution semantics and the published model **deliberately omits them**.
3. **Open form is a graph + a walk rule + carried state, and it is a DIFFERENT OBJECT from the
   score.** `Score` (fragments, each an ordinary determinate score) / `NavigationRule` /
   `Realisation` are three things. MEI's `<expansion>` is only the third, which is why it isn't
   enough.

---

## 6. EXTENDED TECHNIQUES

### 6.1 ⭐ The one structural fact: a technique is a RELATION, not a decoration

**String harmonics are the proof.** MusicXML encodes `<harmonic>` with `<natural>`/`<artificial>`
and **up to three pitch roles** ✅ — `<base-pitch>` (*"the pitch at which the string is played before
touching"*), `<touching-pitch>` (*"the pitch at which the string is touched lightly"*) and
`<sounding-pitch>` (*"the pitch which is heard"*) — with the rationale stated in the spec itself:
*"Allowing the type of pitch to be specified, combined with controls for appearance/playback
differences, allows **both the notation and the sound** to be represented."* ✅ LilyPond says the
convention plainly: *"A diamond-shaped note head generally means to **touch** the string where you
would stop the note if it were not a diamond."* ✅

⭐ So the diamond notehead does **not** mean "harmonic"; it marks **which of three roles this
notehead is playing**, and the sounding pitch is *derived* from the other two plus the string. ⚠️
And it is ambiguous without a **string index**: the same touched pitch on different strings gives
different results ✅. Sources genuinely disagree on natural harmonics (circle-over-sounding vs
diamond-at-node vs both) — Hugill: *"The notation of natural harmonics is often inconsistent."* ✅

The same shape recurs across the instruments:

- **Scordatura** — a **per-string tuning table** positioned in the score that changes the pitch→sound
  map without rewriting the notes. MusicXML `<scordatura>` holds one `<accord>` per string with
  `tuning-step`/`-alter`/`-octave` ✅; Grove: the notation is *"such that the player reads and fingers
  it as if the violin were in the normal tuning (**in effect, a species of tablature**)"* ✅.
- **Multiphonics** — a chord-shaped group that is **not derivable**; SMuFL supplies only three
  *combining stem* glyphs (`windMultiphonicsBlackStem` U+E607, `WhiteStem` E608, `BlackWhiteStem`
  E609) ✅ and the fingerings live in catalogues (Bartolozzi, *New Sounds for Woodwind*, OUP 1967 —
  *the reason multiphonics are documented as fingering charts rather than chords* ✅), not in the
  score. LilyPond's woodwind-diagram model is the clean precedent: `(instrument, region → key,
  key-state)`, **a per-instrument key table entirely outside pitch** ✅.
- **Prepared piano** — ⭐⭐ **a lookup table keyed by pitch, held entirely OUTSIDE the notation.**
  Cage's *Sonatas and Interludes* prepares **45 of 88 notes**, the front-matter table giving per
  entry `{pitch, object, which string of the unison, distance from the damper}` ✅, with distances
  *piano-relative* and a calibration instruction. The score body is ordinary notation. **No
  interchange format models preparations** ✅; SMuFL has exactly one adjacent glyph,
  `keyboardPluckInside` U+E667 *"Pluck strings inside piano (Maderna)"* ✅.
- **Brass** — two mechanisms that look adjacent and are not ✅: a **mute state change** is a printed
  word plus a playback switch (MusicXML puts `<mute>` inside `<play>`, separate from the ink), while
  a **per-note +/o toggle** is an articulation (`<stopped>`, `<open>`, `<half-muted>`, `<harmon-mute>`
  with `<harmon-closed>` ∈ closed/open/half-open). ⚠️ **Half-valve has no standard glyph** — write
  "half-valve" or "HV" ✅.
- **Percussion** — ⭐ **the staff is a legend, not a pitch space.** MusicXML's `<unpitched>` is for
  *"notes that are notated on the staff but lack definite pitch"*, with `<display-step>`/
  `<display-octave>` controlling **staff position only**, and the rule *"Notes in percussion clef
  should always use an `<unpitched>` element rather than a `<pitch>` element"* ✅. Identity comes from
  `<instrument id>` → `<score-instrument>`; sound from `<midi-unpitched>`; playing spot from
  `<stick-location>` ∈ {center, rim, cymbal bell, cymbal edge} ✅. ⭐⭐ **LilyPond's is the model worth
  copying: TWO independent tables** — `drumStyleTable` (drum name → notehead style, articulation,
  staff position) and `drumPitchTable` (drum name → MIDI pitch) ✅. *One table for ink, one for
  sound; the note stores only the instrument symbol.* Named legends ship per convention
  (`drums-style`, `agostini-drums-style`, `timbales-style`, `congas-style`…) ✅.
- **Sprechstimme keeps real, ordered pitch.** Schoenberg's 1914 *Pierrot* preface demands the
  performer *"transform it into a speech melody by **taking well into consideration the indicated
  pitches**"*, keep *"the rhythm just as precisely as he would when singing"*, and that *"the sung
  tone maintains its pitch without change, the spoken tone touches upon it but then leaves it
  immediately"* ✅ — plus an earlier draft's *"a fourth must be a wider leap than a third"*. ⭐ **The
  x is on the STEM, not the notehead** ✅ — mechanically distinct from the x-notehead of percussion.

### 6.2 ⭐⭐ Notehead SHAPE carries no meaning — the specs say so by refusing to gloss it

MusicXML's `<notehead>` *"indicates shapes other than the open and closed ovals associated with note
durations"*, with 27 values ✅. **And the spec deliberately declines to say what any of them mean.**
Its `notehead-value` page gives only *geometric* clarifications — *"The triangle shape has the tip of
the triangle pointing up"*, *"The arrow shapes differ from triangle and inverted triangle by being
centered on the stem"*, *"The left triangle shape is a right triangle with the hypotenuse facing up
and to the left"* ✅. **No semantics for cross, x, diamond, square or circled.** SMuFL's Noteheads
page says the same by omission ✅.

⭐ **That is not a gap; it is the correct answer, and it is the rule for us**: the meaning is
conventional and contextual, so **a model must store the TECHNIQUE and derive the shape — never the
reverse.** (Conventionally: x = unpitched / dead note / key click / spoken; hollow diamond = harmonic
touch-point, *always hollow regardless of duration*; slash = rhythm-only, any pitch; square/rectangle
= clusters and Lachenmann's embouchure states.)

### 6.3 ⭐ What a model must be able to say

> ***"This event carries a TECHNIQUE from a named, per-instrument vocabulary; the technique — not the
> notehead — is the stored fact, and both the ink and the sound are derived from it, sometimes via a
> table that lives outside the notation."***

- Harmonics force **three pitch roles plus a string index**, with the sounding pitch derived.
- Percussion and prepared piano force **an external, per-piece dictionary** — and LilyPond shows it
  should be *two* tables, ink and sound, not one.
- Multiphonics and woodwind fingerings force **a per-instrument key/region table with no pitch in
  it**.
- Mutes force the distinction between **a state that persists** (a span with a cancellation) and **a
  per-note toggle** (an articulation).

---

## 7. STAFF and CLEF departures

### 7.1 The staff

⭐ **The whole family hangs off one idea: the staff's line count, and what a line MEANS, are
authored data that can change mid-piece.** MusicXML puts all of it in
`<attributes><staff-details>`, and `<attributes>` *"contains musical information that typically
changes on measure boundaries"* ✅ — so **a line-count change mid-piece is just another
`<staff-details>` at that measure**.

| what | MusicXML | MEI |
|---|---|---|
| line count | `<staff-lines>` — *"usually used for a non 5-line staff"* ✅ | `<staffDef>@lines` ✅ |
| per-line appearance | `<line-detail>` — *"the appearance of each line may be individually specified"*, with `line` *"numbered from bottom to top"*, plus `width`, `color`, `line-type`, **`print-object`** ✅ | `@lines.color`, `@lines.visible` ✅ |
| tablature tuning | `<staff-tuning>` — *"the open, non-capo tuning of the lines on a tablature staff"*, plus `<capo>` and **`show-frets`** (*"numbers (0, 1, 2) or letters (a, b, c)"*) ✅ | `<tuning>` with `<course>` children; ⚠️ *"worked out for string instruments only"* ✅ |
| tab position ≠ pitch | `<fret>` (*"0 for an open string"*) + `<string>` (*"1 for the highest pitched full-length string"*) ✅ | `@tab.course` + `@tab.fret`; `<tabGrp>`, `<tabDurSym>` (*"omitted where it would repeat the previous value"*) ✅ |
| ossia | `<staff-type>ossia</staff-type>` — *"music that can be played instead of what appears on the regular staff"*; siblings `editorial`, `cue`, `alternate` (*"shares the same music … but displayed differently"*), `regular` ✅ | ⭐ a **dedicated element** `<ossia>` with `<oStaff>`/`<oLayer>` ✅ |

**LilyPond** makes the mid-piece constraint explicit and awkward: `\override
Staff.StaffSymbol.line-count` requires that *"modifications must be made before the staff is
(re)started"*, hence the `\stopStaff … \startStaff` sandwich ✅. Its `line-positions` is the
generalisation worth noting — *"A list of numbers sets each line's position. `0` corresponds to the
normal center line, and the normal line positions are `(-4 -2 0 2 4)`"* ✅ — i.e. **the line count is
really a list of positions.** ⭐ And in tab, **the fret is DERIVED**: *"By default pitches are
assigned to the lowest playing position on the fretboard … Open strings are automatically
preferred."* ✅

**Cutaway** is a Dorico concept, not a format one: *"layouts in which empty bars are entirely removed
from the layout"* ✅. And a practical case from the electroacoustic world that lands in the same
place: a **Cues stave** is built by setting the line count to **zero** and switching off brackets,
initial clefs and barlines ✅.

### 7.2 The clef

MusicXML: *"Clefs are represented by a combination of `<sign>`, `<line>`, and `<clef-octave-change>`
elements"* ✅, with signs **G, F, C, percussion, TAB, jianpu, none**. Three findings worth having:

- **Octave clefs are an INTEGER, not a separate sign.** `<clef-octave-change>` — *"used for
  transposing clefs. A treble clef for tenors would have a value of −1."* ✅ (MEI's equivalents are
  `@clef.dis` and `@clef.dis.place` ✅.) ⭐ Which matches `docs/octave-clefs-plan.md`'s framing
  exactly: *"these are ordinary clefs … Only the octave moves."*
- **Invisible clef is NOT a sign value.** `sign=none` is *"Deprecated as of MusicXML 4.0. Use the
  clef element's `print-object` attribute instead."* ✅ ⭐ A visibility flag, not a kind — the same
  distinction our PDF-export work already made (*a render has an audience*).
- **Mid-bar and barline-side placement are attributes**: `additional` (*"clefs … added to the staff
  in non-standard line positions, either to indicate cue passages, or when there are multiple clefs
  present simultaneously"*), `size` for cue clefs, and **`after-barline`** — *"Sometimes clefs at the
  start of a measure need to appear after the barline rather than before, as for cues or for use
  after a repeated section."* ✅

SMuFL's clef range carries `unpitchedPercussionClef1/2` (U+E069/E06A), `semipitchedPercussionClef1/2`
(E06B/E06C), `6stringTabClef` (E06D), `4stringTabClef` (E06E), the octave forms
`gClef15mb/8vb/8va/15ma` (E051–E054), and **two-thirds-size change forms** `gClefChange` E07A,
`cClefChange` E07B, `fClefChange` E07C ✅.

### 7.3 ⭐ What a model must be able to say

> ***"A staff has an authored number of lines whose POSITIONS are a list, each line may be
> individually styled or hidden, a line's meaning may be a pitch OR a string OR an instrument, and
> all of that may change mid-piece."***

⭐ We already know this is a model gap and have written it down: `docs/unpitched-staves-plan.md` says
the percussion clef was left out of the Clef window *"because it is a model gap and not a missing
row"*. This section is the evidence that the gap is wider than percussion — **the same field serves
tablature, single-line staves, cutaway and cue staves**, and the tablature case additionally needs
*a position that is a STRING, plus a fret number that is not a pitch*.

---

## 8. PERFORMANCE DIRECTIONS THAT ARE SPANS

### 8.1 ⭐⭐ Two idioms, and the difference is exactly the one that matters to us

- **MusicXML = paired MILESTONES.** A span is *N separate events in the stream* sharing a `number`
  level (*"distinguishes multiple X when they overlap in MusicXML document order"*), each with `type`
  ∈ start/continue/stop ✅.
- **MEI = ONE OBJECT with two anchors.** The `<octave>` guideline states the rule for the whole
  class: ***"it is a semantic error not to specify one starting and one ending type of attribute"***
  ✅ — start ∈ `@startid | @tstamp | @tstamp.ges | @tstamp.real`, end ∈ `@dur | @dur.ges | @endid |
  @tstamp2`.

⭐ **The choice is real and consequential**: a note-anchored span survives rebar; a time-anchored span
survives note deletion. MEI makes it an explicit alternative per span; we chose note-anchoring for
ties, slurs and the trill.

### 8.2 The catalogue, with the facts worth keeping

- **`<octave-shift>`** — *"indicates where notes are shifted up or down from their performed values
  because of printing difficulty"*, `size` ∈ 8 / 15 / 22 ✅. ⭐ Note the semantics: **an 8va is stored
  as a shift DOWN in the pitch data.**
- **`<pedal>`** — seven `pedal-type` values, and the vocabulary is richer than "on/off": **start**,
  **stop** (*"a pedal lift without a retake"*), **sostenuto**, **change** (*"a pedal lift and retake
  indicated with an inverted V"*), **continue** (*"more precise formatting across system breaks"*),
  **discontinue** (*"end of a pedal line that does not include the explicit lift"*), **resume**
  (*"start of a pedal line that does not include the downstroke"*) ✅. ⭐ `discontinue`/`resume` are
  the **system-break/segment vocabulary**. ⚠️ MusicXML has **no half-pedal**; MEI's `@dir` does —
  down / up / **half** / **bounce** (*"Release then immediately depress the pedal"*) ✅.
- **`<wavy-line>`** (the trill extension) — carries its playback payload on the same element:
  `start-note` (*"upper if not specified"*), `trill-step` (*"whole if not specified"*),
  `two-note-turn`, `accelerate`, `beats`, `second-beat`, `last-beat` ✅. ⭐⭐ **And there is an
  explicit mid-span barline marker**: *"The value should be `continue` whenever used within a
  `<barline>` element."* ✅ Its `smufl` attribute *"References a particular wavy line glyph from the
  SMuFL **Multi-segment lines** range"* ✅ — which is where the nine trill speeds, the glissando,
  vibrato, square-wave, sawtooth and random wiggles live, plus `beamAccelRit1`–`15` ✅.
- **`<glissando>` vs `<slide>`** — both *"indicate rapidly moving from one pitch to the other so that
  individual notes are not discerned"*, but a glissando *"sounds the distinct notes in between …
  and defaults to a wavy line"* while a slide *"is continuous … and defaults to a solid line"* ✅.
- **`<bracket>` + `<words>` + `<dashes>`** — ⭐ **`sul pont. ______` is THREE objects, not one** ✅.
  `<bracket>` carries **`line-end`** — *"whether there is a jog up or down (or both), an arrow, or
  nothing at the start or end"* — plus `end-length` for the jog ✅.
- **`<measure-repeat>`** — ⭐ *"the actual music being repeated **needs to be repeated within each
  measure** of the MusicXML file. This element specifies **the notation** that indicates the
  repeat."* ✅ The notation is not the data.
- **Note-local pseudo-spans**: `<arpeggiate>` (*"The length of the sign can be determined from the
  position attributes … used with the top and bottom notes"*, plus `unbroken` for cross-staff);
  `<bend>` (*"A single note with a bend and release will contain **two** `<bend>` elements"*);
  `<breath-mark>`; `<caesura>` (*"a slight pause … notated using a 'railroad tracks' symbol"*) ✅.
- **Dorico's *Lines*** are the generalisation the user has already asked about: a line = **body**
  (single or double lines, wedges, or **patterns of repeatable symbols**) + **caps** + **annotations**
  (as caps, centred, repeated along the duration, or hyphenated) ✅. Its playing-technique lines come
  in two kinds — a **duration line** (solid + hook cap) and a **transition line** (solid + arrow cap,
  where *"the playing technique at the start must gradually turn into the playing technique at the
  end over the duration specified by the line"*) — and *"remain strictly notational — they don't
  influence playback"* ✅.

### 8.3 ⭐ What a model must be able to say

> ***"A span is ONE object with two anchors of possibly different kinds, belonging to a lane rather
> than a bar, carrying its own semantic payload — and its division at a system break is DERIVED, not
> stored."***

Distilled, the nine facts a span needs, each drawn from a source above:

1. **kind** — the discriminant;
2. **start anchor** — note id **or** timestamp (MEI makes these explicit alternatives);
3. **end anchor** — id, timestamp, **or a duration** (MEI's `@dur`);
4. **lane** — staff + voice/layer, because a span belongs to one strand, not the bar;
5. **placement** above/below;
6. **an overlap disambiguator** — MusicXML's `number` levels exist solely so two of a kind can nest;
7. **line style and end caps** — line-type, jog/arrow, dash length;
8. **semantic payload** — `size` 8/15/22, pedal direction, trill accidentals and turn, gliss-vs-slide;
9. **whether it has playback implications at all** — Dorico's lines explicitly do not; MusicXML's
   wavy-line explicitly does.

⭐⭐ **And the tenth, which is a negative:** *neither format stores system-break segments.* MusicXML
offers `continue`/`discontinue`/`resume` as **optional formatting hints**; MEI offers nothing. The
renderer derives the split. ✅ That is exactly the conclusion our own multi-system slur work reached
independently (`docs/multisystem-slur-plan.md`) — worth recording as a rare case where the survey
**confirms a decision already taken** rather than opening one.


---

## 9. ⭐⭐ The deepest one: DECOUPLED ACTION NOTATION — where "a note" stops being the unit

Everything in §3–§8 stretches the existing model: a wider `alter`, a looser bar, an extra span kind.
This one **breaks it**, and it is worth stating separately because it is the only entry in this
survey that no amount of table-adding reaches.

Beginning with **Klaus K. Hübler** and carried on by **Brian Ferneyhough**, **Richard Barrett**,
**Franklin Cox**, **Claus-Steffen Mahnkopf** and especially **Aaron Cassidy**, the "New Complexity"
composers devised **instrumental decoupling**: the individual physical actions that jointly produce
a sound — breath, embouchure, fingering; or for strings, left-hand and right-hand motion along
separate axes — are **notated on different staves**, so that a *polyphony of actions* can be
composed. ✅ Cassidy's earlier string works give each layer of planar motion (x, y, z, for each hand)
its own staff; later works compress them onto a single multi-coloured staff. ✅

The score is then a **tablature of gesture**, not a description of sound: the notation prioritises
"the physical, bodily, and mechanical aspects of sound-production", and the pitch that results is an
*output*, not an input. ✅

⭐ **What a model must be able to say:** *"this staff is a stream of ACTIONS on one degree of freedom
of one player, and the sounding event is what several such streams jointly produce"* — i.e. the
sounding note must be **derivable from, not identical to, the notated objects**, and a staff must be
allowed to carry a parameter that is not pitch.

⛔ **Do not attempt to accommodate this by generalising `Note`.** Compare `feedback_stop_adding_fields_when_pushed_back`:
if the answer needs a `Note` with optional pitch, optional duration and an `axis` field, the model is
wrong. The honest form is a second kind of lane altogether — which is why §7's *variable-line-count
staff* and §6's *tablature* are the cheap first steps toward it, and this is the expensive last one.
It is listed for completeness and to mark the boundary of the territory, **not** because it is worth
approaching.

---

## 10. Where WE stand today — the gates already in the types

Measured in this repo today (2026-08-13), so it does not have to be measured again. These are the
places a survey item would first hit a **compile error**, which is the useful thing to know.

| gate | file | what it forbids |
|---|---|---|
| `export type PitchAlter = -2 \| -1 \| 0 \| 1 \| 2` | `src/types/music.ts:199` | ✅ **every microtone in §3.** A closed union of five integers, referenced at four sites. Widening it is a type-level change that lights up the whole engine — which is *good*: it makes the decision visible rather than silent. |
| `timeSignature: TimeSignature` — **required**, non-optional, on every `Measure` | `src/types/music.ts:1464` | ✅ **senza misura and unmetered bars (§4).** Every measure has a meter by construction; there is no representable "this bar has no meter". |
| `beat` is an exact `Fraction` | `types/music.ts`, and the Fraction/float invariant in `ARCHITECTURE.md` | ✅ **proportional / time-space notation (§4).** A position is a rational number of quarters — it cannot be a distance. ⭐ Note this is a *strength* for everything measured and a hard wall for everything spatial. |
| staff line count is never modelled — `numLines` appears only as VexFlow's `{ numLines: 0 }` on throwaway ghost staves | `src/engine/rendering/GhostRenderer.ts`, `FanGhost.ts` | ✅ **single-line and n-line staves (§7).** Already written up: `docs/unpitched-staves-plan.md` says the percussion clef was left out of the Clef window *because it is a model gap, not a missing row*. |
| the marking-tool union and `SelectedElement` union | `interactions/EditorState.ts`, `docs/marking-tools.md` | nothing — ⭐ these are the **right** shape for all of §6/§8: a new family is a new member plus a row in `ELEMENT_SPECS` / `ELEMENT_HIT_ORDER`. This survey found no practice that these two unions could not absorb. |

⚠️ Not audited: whether `src/utils/keySignature.ts` (untracked, in flight today) fixes the accidental
**order** in a way that would resist §3's non-standard key signatures. Left alone deliberately —
that work is someone else's and in progress.

---

## 11. ⭐⭐ THE ONE REAL FINDING — exactly one axis contradicts a stated principle

Read against `docs/DESIGN-PRINCIPLES.md`, the axes in this survey do **not** all cost the same kind
of thing, and the difference is not size. It is this:

| axis | relation to our principles |
|---|---|
| §3 pitch beyond 12-EDO | a **widening**. Principle 6 already tells us the shape: a tuning system can change mid-score, so it is positional, never a `Score` field. ✅ The principle is *already written* for a feature that does not exist — exactly as it was for key signatures. |
| §4 time beyond the barline (measured kinds: senza misura, unmetered bars, feathered beams) | a **widening**. ⭐ And MusicXML shows the shape: `<senza-misura>` lives **inside `<time>`** ✅ — "no meter" is modelled as *a kind of meter*, not as an absent one, and MusicXML's `<measure>` stays **mandatory** ✅ so the spine never goes away. `Measure.timeSignature` stays required; it gains a variant. (MEI goes further and lets `<staff>` sit directly in `<section>` ✅ — that is the more expensive road, and nothing in this survey requires it.) |
| §6 techniques · §7 staves · §8 spans | **widenings**, and cheap ones by our standards — a member in a union, a row in `ELEMENT_SPECS`, a module. This is what `CLAUDE.md`'s rule was built for. |
| §5 mobile / open form · §9 decoupled action notation | **out of scope, honestly.** Neither contradicts a principle — they are simply *not scores* in the sense Principle 1 means. Open form wants `Score` + `NavigationRule` + `Realisation` as three objects (§5.3); decoupling wants a lane that is not a pitch stream (§9). Both are new **document kinds**, not new fields. ⛔ Neither is reached by generalising `Note`. |
| **§4/§5 proportional, spatial and graphic notation** | ⛔ **a CONTRADICTION.** |

**Principle 3 says, verbatim: *"Forbidden: pixel coordinates, viewport, or page-layout state in the
data model or its JSON."*** ✅ Proportional notation's entire premise is that **x-position IS
duration** and musical graphics' premise is that **the image IS the content**. There is no way to
express either without putting a distance in the model. Our `beat` is an exact `Fraction` — a
rational number of quarters — and a `Fraction` cannot hold a centimetre.

⭐ **So the decision, when someone eventually asks for a graphic score, is not "how much work is
it?" It is: does Principle 3 get an exception, or does a graphic score become a DIFFERENT DOCUMENT
TYPE that our editor opens rather than a `Score` it can hold?** That question is worth having
already answered on the day it is asked, and this file exists mainly to have asked it early.

⚠️ Note the survey does *not* recommend an answer. Compare `feedback_dont_dissolve_the_container`:
naming what a "free" generalisation would destroy is the point, and what a spatial `beat` would
destroy is the Fraction/float invariant in `ARCHITECTURE.md` — which is load-bearing for rebar,
tuplets, ties and the spacing rule alike.

### And a second, smaller finding: the escape hatch

MusicXML's answer to *"a symbol we did not anticipate"* is a family of **`<other-*>` elements**
(`<other-notation>`, `<other-technical>`, `<other-articulation>`, `<other-dynamics>`,
`<other-direction>`) each of which may carry a **`smufl` attribute naming the glyph** ✅ — explicitly
so that "application interoperability [does not require] every SMuFL glyph to have a MusicXML
element equivalent". ✅

⭐ **What a model must be able to say, and the cheapest thing on this whole list:** *"here is a mark
whose MEANING I do not model, identified by its SMuFL glyph name and anchored to this position."*
That single shape absorbs a large fraction of §6 and §5 at a fraction of the cost — and it degrades
honestly, because it never pretends to know what the mark does. ⚠️ It is also a trap if it becomes
the *first* answer rather than the last: `feedback_stop_adding_fields_when_pushed_back` applies —
a mark that we *do* understand and store as an opaque glyph name is a modelling failure wearing an
escape hatch's clothes.

---

## Appendix A — SMuFL's ranges, sorted by the axis they serve

✅ Read verbatim from `metadata/ranges.json` (see Sources). This is the **reality check** referred to
throughout: a practice with its own SMuFL range has been through a standards process and has fonts
that implement it. Ranges we already draw from are marked ▪.

**Pitch beyond 12-EDO (§3) — 20 of ~130 ranges, the single largest bloc:**
`standardAccidentals12Edo` ▪ · `standardAccidentalsChordSymbols` · `gouldArrowQuartertoneAccidentals24Edo` ·
`steinZimmermannAccidentals24Edo` · `extendedSteinZimmermannAccidentals` · `stockhausenAccidentals` (24-EDO) ·
`simsAccidentals72Edo` · `wyschnegradskyAccidentals72Edo` · `johnstonAccidentalsJustIntonation` ·
`extendedHelmholtzEllisAccidentalsJustIntonation` (+ `…Supplement`) ·
`spartanSagittalSingleShaftAccidentals` · `spartanSagittalMultiShaftAccidentals` ·
`athenianSagittalExtensionMediumPrecisionAccidentals` · `trojanSagittalExtension12EdoRelativeAccidentals` ·
`prometheanSagittalExtensionHighPrecisionSingleShaftAccidentals` (+ `…MultiShaft…`) ·
`herculeanSagittalExtensionVeryHighPrecisionAccidentalDiacritics` ·
`olympianSagittalExtensionExtremePrecisionAccidentalDiacritics` ·
`magratheanSagittalExtensionInsanePrecisionAccidentalDiacritics` · `arabicAccidentals` ·
`arelEzgiUzdilekAeuAccidentals` · `persianAccidentals` · `turkishFolkMusicAccidentals` ·
`otherAccidentals` (+ `…Supplement`) · `medievalAndRenaissanceAccidentals`

⭐ **Note what that list is: it is not one microtonal system, it is a dozen mutually incompatible
ones**, several with *precision tiers* (Sagittal alone has seven ranges). This is the strongest
single argument in the survey for the §3 conclusion — a model cannot pick "the" microtonal system,
so it must store the *glyph* and the *tuning* as two independent facts.

**Time beyond the barline (§4):** `timeSignatures` ▪ · `timeSignaturesSupplement` ·
`timeSignaturesTurned` · `timeSignaturesReversed` · `holdsAndPauses` ▪ · `metronomeMarks` ▪ ·
`barlines` ▪ · `barRepeats` · `repeats` · `tuplets` ▪ (+ `…Supplement`) · `beamedGroupsOfNotes` ▪ ·
`tremolos` ▪ · `flags` ▪ · `stems` ▪

⚠️ **There is no SMuFL range for proportional or aleatoric notation as such.** The turned/reversed
time-signature ranges exist for *display*, not for meterlessness. That is not an accident — those
practices are *layouts and structures*, not glyph repertoires, which is exactly why §4/§5 are the
expensive axes and §3 is merely a wide one.

**Graphic / indeterminate (§5):** `arrowsAndArrowheads` · `multiSegmentLines` · `miscellaneousSymbols` ·
`conductorSymbols` · `analytics` · `electronicMusicPictograms`

**Extended techniques (§6):** `stringTechniques` · `windTechniques` · `brassTechniques` ·
`pluckedTechniques` · `keyboardTechniques` · `harpTechniques` · `vocalTechniques` · `handbells` ·
`chopNotation` (percussive bowing) · `guitar` · `chordDiagrams` · `fingering` (+ `…Supplement`) ·
`articulation` ▪ · `articulationSupplement` (⚠️ only 8 glyphs, all soft-accent) · `noteClusters` ·
plus **fourteen** percussion pictogram ranges (`beatersPictograms`, `bellsPictograms`,
`chimesPictograms`, `cymbalsPictograms`, `drumsPictograms`, `gongsPictograms`,
`metallicStruckPercussionPictograms`, `miscellaneousPercussionInstrumentPictograms`,
`percussionPlayingTechniquePictograms`, `shakersOrRattlesPictograms`,
`tunedMalletPercussionPictograms`, `whistlesAndAerophonesPictograms`,
`woodenStruckOrScrapedPercussionPictograms`, `electronicMusicPictograms`)

**Staff and clef departures (§7):** `staves` ▪ · `staffBracketsAndDividers` · `clefs` ▪ ·
`clefsSupplement` · `combiningStaffPositions` · `noteheads` ▪ · `noteheadsSupplement` ·
`slashNoteheads` · `roundAndSquareNoteheads` · `shapeNoteNoteheads` (+ `…Supplement`) ·
`noteNameNoteheads` (+ `…Supplement`) · `frenchAndEnglishRenaissanceLuteTablature` ·
`germanRenaissanceLuteTablature` · `italianAndSpanishRenaissanceLuteTablature` ·
`renaissanceLuteTablature` · `organGerman` · `kievanSquareNotation` · `daseianNotation` ·
`simplifiedMusicNotation` · the ten `medievalAndRenaissance*` ranges

🚩 **Two false friends, both caught by direct reading of the tables:** `techniquesNoteheads`
(U+EE70–EE7F) contains **only four Swiss-rudiment flam/doublé noteheads** ✅ — nothing to do with
extended techniques, despite the name. And **there is no "Chant" range**: plainchant is spread
across the `medievalAndRenaissancePlainchant*` ranges plus `kievanSquareNotation` and
`daseianNotation`. ⭐ This is the general lesson about SMuFL as a planning input — *the range name is
a filing label, not a semantic category*, and it must be read before it is relied on.

**Spans (§8):** `octaves` ▪? · `octavesSupplement` · `multiSegmentLines` ·
`combiningStrokesForTrillsAndMordents` · `precomposedTrillsAndMordents` · `commonOrnaments` ▪ ·
`otherBaroqueOrnaments` · `dynamics` ▪ · `beamsAndSlurs` ▪

**Not on any axis here** (listed for completeness, so the count is honest): `accordion` ·
`chordSymbols` · `figuredBass` (+ `…Supplement`) · `functionTheorySymbols` (+ `…Supplement`) ·
`scaleDegrees` · `kodalyHandSigns` · `kahnotation` (tap dance) · `lyrics` · `individualNotes` ▪ ·
`rests` ▪

---

## Appendix B — ⚠️ What this survey could NOT verify

Collected in one place so a future reader knows exactly where the floor is thin. **Do not build on
anything in this list without checking it first.**

**About the book (§1)**
- The Villa-Rojo book's **actual arguments**. No full text, no index beyond the chapter list, no
  scholarly review was reachable. Nothing in this file is attributed to it. Its bibliographic record
  and its chapter structure *are* verified.

**About the literature (§2)**
- Karkoschka's English publisher is contradictory across catalogues — **Praeger (NY)** vs
  **Universal Edition (London)**. Both appear; I did not resolve it.
- *Behind Bars*'s chapter numbering for the aleatoric/proportional material. The **three-part
  structure and the presence of electroacoustic and aleatoric chapters are verified**; a specific
  chapter number circulating online traces to a 403'd forum post. The feathered-beam convention
  quoted in §4.4 is sourced from Scoring Notes and Dorico, **not** from the book itself.
- 🚨 **Two quotations widely attributed to Kurt Stone appear to be FABRICATED** — *"if the duration of
  a half note is made equal to one inch…"* and *"Spatial notation allows for an unlimited number of
  durations…"*. Full-text search of Stone's book returns nothing for either. **Do not quote them.**
- The Ghent 1974 report's own musical **examples are images**, and the PDF has OCR damage in at least
  one sentence — so every "such as the following" figure in it, *including the scale-marking
  graphic*, is invisible to this research.

**About pitch (§3)**
- Hába's glyph shapes in the 1927 German original (read only via Battan's translation in a Unicode
  proposal); Wyschnegradsky's actual **1932** glyphs (the 2017 edition re-notates in
  Stein–Zimmermann, so a modern copy is not evidence).
- Johnston's ratios for primes **17 and 19** are computed here, not read printed; **nothing is
  published at all for 23, 29, 31**.
- A live contradiction: SMuFL assigns the **Sims** arrow pair to 1/12 tone (1°72) while Secor &
  Keenan refer to it as 2°72. Unresolved.
- MuseScore's `Note::tuning` units **in source** — `musescore.org` 403s to automated fetches, and
  the GitHub raw paths tried returned 404. Corroborated only via the plugin API and issue trackers.
- Sagittal's higher-precision cent figures — `sagittal.org` and `en.xen.wiki` are Cloudflare-blocked
  to these tools. The SMuFL diacritic values *are* verified.

**🚨 The §4/§5 provenance problem — the biggest caveat in the file**

§4 and §5 were drafted before the research pass on time and indeterminacy returned. When it did, it
**confirmed the format claims and Lombardi**, and **could not re-confirm the musicological ones**,
its search budget having run out. Everything in this block is therefore marked 🔶 in the text:

- The **Ghent 1974 report**: its online full text, the *symbolic vs proportionate* split, the two
  duration-line conventions and the arrow-at-system-break ruling, the white/black notehead hint, the
  §II.2.C "no preferences were adopted" quotation, the timing-bracket rule, and the accidental-space
  warning. The conference's *existence, date, organiser and scale* are verified via Stone's
  publisher; **its wording is not**.
- **Berio's *Sequenza I*** 1958 spatial → 1992 rhythmic re-notation. ⚠️ Load-bearing for §4.1's
  "spacing is not freedom" point, which stands on reasoning even if the example does not.
- The **Getty Scores Project** commentaries (*December 1952*'s "no key is supplied", *Projection 1*,
  Gallope on Bussotti); **Sluchin & Malt** on Cage's time brackets; **Lepper & Trancón y Widemann**,
  TENOR 2024, on Feldman's *Projections*; the **Andersen** MTO articles; **Cage's *Silence*** text;
  the **Lutosławski letter to Walter Levin** about refusing to publish a score.
- ⚠️ The late pass independently reports **Feldman's box semantics as unverified**, and reports the
  numeral in *Projection 1* as *"how many notes should be played at a certain time but not which
  ones"* — which agrees with §5.2. Treat the register-band and grid detail as the weakest part.
- ⚠️ It also reports **17 vs 19 fragments** for *Klavierstück XI* across two Wikipedia articles, and
  could not verify Boulez's formant names or the *Constellation* route rules at all.
- ⚠️ **MEI's `<app>`/`<choice>` being editorial rather than performative** is flagged by the late
  pass as *its own inference from the element definitions*, not a sourced scope statement. §5.3
  states it more confidently than that warrants.
- **Decibel ScorePlayer, INScore, MaxScore, DigiScore** — named from recollection; none opened.

**About time and indeterminacy (§4, §5)**
- 🚨 **Ligeti's *Aventures* as proportional/seconds notation is UNSUPPORTED** and the weak evidence
  points the other way. Treated in §5.2 as a counter-example for that reason.
- Where proportional notation sits inside **Karkoschka's four categories** — undetermined.
- Earle Brown's *December 1952* **instruction-sheet wording** (rotation, any direction, any length):
  consistent across three secondary sources, unverified against the original; `earle-brown.org`
  403s.
- Boulez's *Constellation* route map — the coloured ink, the arrows, the sheet count. Unverified.
- *Klavierstück XI*'s fragment count: **19** in most sources, **17** in one Wikipedia rendering.
- Feldman's numerals mean *simultaneous pitches* in the **Projections**; their meaning in the
  **Intersection** pieces is unverified.
- Whether Dorico has a documented feature actually named **"duration lines"** — not found on
  steinberg.help; only search-engine summaries. (Its **playing-technique continuation lines** *are*
  documented.)
- "Justification silently rescales time across systems" — a mechanical inference from how spacing
  and line-breaking interact, **not a sourced claim**.

**About techniques and staves (§6, §7)**
- Cage's **Table of Preparations** was not read first-hand; the field names and units above are
  corroborated in substance only.
- The **Ghent 1974** proceedings volume itself and any **PAS** percussion-notation primary document
  were not opened.
- A search result claiming SMuFL's wind **multiphonics** sit at U+E627–E629 contradicts a direct
  read of the table (U+E607–E609). **The search result is wrong**; the direct read is used.

**About us**
- Whether `src/utils/keySignature.ts` (untracked and in flight today) fixes accidental **order** in
  a way that would resist §3's non-standard key signatures. Deliberately not audited — that work
  belongs to someone else and is unfinished.

---

## Sources

Every URL consulted. ✅ = the claim in the text was read off this page; ⚠️ = consulted but the
specific claim is flagged unverified in the text.

### The book (§1)

- ✅ Dialnet, [*Notación y grafía musical en el siglo XX*](https://dialnet.unirioja.es/servlet/libro?codigo=153354) — Iberautor, Madrid, 2003, ISBN 84-8048-496-9
- ✅ Instituto Autor (the publisher's own foundation library), [book record](https://institutoautor.org/biblioteca/notacion-y-grafia-musical-en-el-siglo-xx/) — 395 pp., depósito legal M-31.709-2003, and the ten-part structure
- ✅ [Jesús Villa-Rojo — Escritos](https://villa-rojo.com/escritos-de-jesus-villa-rojo/) — the full list of his books, incl. *El clarinete y sus posibilidades* (Alpuerto, 1975/1984), *Juegos gráfico-musicales* (Alpuerto, 1982), and the Italian *Notazione e grafia musicale nel XX secolo* (Zecchini, Varese, 2013)
- ✅ [Jesús Villa-Rojo — official site](https://villa-rojo.com/) and [cronología](https://villa-rojo.com/cronologia-completa/)
- ✅ [Wikipedia (es), Jesús Villa Rojo](https://es.wikipedia.org/wiki/Jes%C3%BAs_Villa_Rojo) — b. Brihuega, 24 Feb 1940; LIM founded with Esperanza Abad and Rafael Gómez Senosiaín
- ✅ [Biblioteca Nacional de España — Villa-Rojo donates his personal archive](https://www.bne.es/es/noticias/0514-jesus-villa-rojo-dona-su-archivo-personal-a-la-bne)
- ✅ Booksellers corroborating ISBN 978-84-8048-496-1 and the 2003 date: [El Argonauta](https://www.elargonauta.com/libros/notacion-y-grafia-musical-del-siglo-xx/978-84-8048-496-1/) · [Casa del Libro](https://www.casadellibro.com/libro-notacion-y-grafia-musical-en-el-siglo-xx/9788480484961/923935) · [Agapea](https://www.agapea.com/libros/NOTACION-GRAFIA-MUSICAL-SIGLO-XX-9788480484961-i.htm) · [Todos tus libros](https://www.todostuslibros.com/libros/notacion-grafia-musical-siglo-xx_978-84-8048-496-1) · [Librería Proteo](https://www.libreriaproteo.com/libro/ver/317354-notacion-y-grafia-musica-en-el-siglo-xx.html) · [Laie](https://www.laie.es/es/libro/notacion-y-grafia-musical-en-el-siglo-xx/9788480484961/791475)
- ✅ Locatelli de Pérgamo, [*La notación de la música contemporánea*](https://www.elargonauta.com/libros/la-notacion-de-la-musica-contemporanea/978-987-611-210-9/) (Melos/Ricordi Americana, 1973)

### The standard references (§2)

- ✅ [W. W. Norton — Kurt Stone, *Music Notation in the Twentieth Century*](https://wwnorton.com/books/9780393950533) (1980) and the [Internet Archive copy](https://archive.org/details/musicnotationint0000ston_h3s0) — the Index of New Musical Notation, the 1974 International Conference
- ✅ [Karkoschka, *Notation in New Music*](https://archive.org/details/notationinnewmus0000kark) (Universal Edition/Praeger, 1972, trans. Ruth Koenig) — the four-kind taxonomy; German original [*Das Schriftbild der Neuen Musik*](https://katalog.ub.uni-heidelberg.de/cgi-bin/titel.cgi?katkey=66457728) (Moeck, Celle, 1966)
- ✅ [Gardner Read, *20th-Century Microtonal Notation*](https://archive.org/details/20thcenturymicro0000read) (Greenwood, 1990) and [*Music Notation: A Manual of Modern Practice*](https://archive.org/details/musicnotationman00read) (2nd ed. 1969)
- ✅ [Faber Music — Elaine Gould, *Behind Bars*](https://www.fabermusic.com/shop/behind-bars-the-definitive-guide-to-music-notation-p6284) and [Wikipedia's summary of its three-part structure](https://en.wikipedia.org/wiki/Behind_Bars_(book)) — incl. the electroacoustic/aleatoric chapters

### SMuFL

- ✅ [SMuFL range metadata (`ranges.json`)](https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/ranges.json) — the authoritative range list quoted throughout
- ✅ [`w3c-cg/smufl` on GitHub](https://github.com/w3c-cg/smufl) · [smufl.org](https://www.smufl.org/) · ⚠️ [SMuFL 1.4 release note](https://www.smufl.org/news/smufl-1-4-released/) (20 Mar 2021 — the last version number confirmed)
- ✅ Dead/redirecting: `https://w3c.github.io/smufl/latest/tables/index.html` → `https://w3c-cg.github.io/smufl/latest/tables/` → `http://smufl.formats.music/latest/tables/`

### MusicXML (§3, §4, §11)

- ✅ [`<alter>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/alter/) — content type `semitones`; "Decimal values like 0.5 (quarter tone sharp) are used for microtones"
- ✅ [`<senza-misura>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/senza-misura/) — a child of `<time>`; "explicitly indicates that no time signature is present"; its optional content is the symbol to draw, e.g. an X
- ✅ The escape hatches: [`<other-notation>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/other-notation) · [`<other-technical>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/other-technical/) · [`<other-articulation>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/other-articulation) · [`<other-dynamics>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/other-dynamics) · [`<other-direction>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/other-direction) — each takes a `smufl` attribute, "allowing application interoperability without requiring every SMuFL glyph to have a MusicXML element equivalent". Background: [w3c/musicxml issue #107](https://github.com/w3c/musicxml/issues/107)
- ✅ [MusicXML alphabetical index](https://www.musicxml.com/for-developers/alphabetical-index/) · [`w3c/musicxml` schema](https://github.com/w3c/musicxml/blob/gh-pages/schema/note.mod)
- ⚠️ [MEI Guidelines 5.1](https://music-encoding.org/guidelines/) — consulted, but **no MEI-specific claim is made in this file**: searching did not surface its handling of unmeasured, aleatoric or graphic notation, and I did not read the Guidelines deeply enough to assert anything.

### Microtonality (§3)

- ✅ HEJI2 official legend (2020, upd. 6.2023) — https://www.diva-portal.org/smash/get/diva2:1869939/FULLTEXT03.pdf · HEJI v1 — https://masa.plainsound.org/pdfs/notation.pdf · calculator — https://www.plainsound.org/HEJI/
- ✅ Sagittal (Secor & Keenan) — https://musescore.org/sites/musescore.org/files/2020-06/Sagittal(1).pdf · https://www.sagittal.org/sagittal.pdf
- ✅ Ben Johnston's notation, Kyle Gann — https://www.kylegann.com/BJNotation.html · Fonville, *PNM* 29/2 (1991) — https://www.sacredrealism.org/artists/catherine-lamb/the-interaction-of-tone/articles/Fonville,%20John%20-%20Ben%20Johnston's%20Extended%20Just%20Intonation,%20A%20Guide%20for%20Interpreters.pdf
- ✅ Unicode L2/23-276 — the Stein/Zimmermann/Tartini attribution and the "arrows have no assumed meaning" rule — https://www.unicode.org/L2/L2023/23276-quarter-tone-accidentals.pdf · L2/24-090 (Hába and Wyschnegradsky facsimiles) — https://www.unicode.org/L2/L2024/24090-musical-chars.pdf
- ✅ Ezra Sims, MICRO 3 font and the compounding rationale — https://ezrasims.info/microFont.htm · accidental comparison table — http://www.ekmelic-music.org/en/extra/alter.php
- ✅ Gardner Read, *20th-Century Microtonal Notation* — https://archive.org/details/20thcenturymicro0000read · publisher synopsis via https://www.abebooks.com/9780313273988/20th-Century-Microtonal-Notation-Contributions-Study-0313273987/plp · **Polansky's review**, *LMJ* 1/1 (1991) — https://eamusic.dartmouth.edu/~larry/published_articles/lmj_leonardo/lmj_read_review.pdf
- ✅ MusicXML: [`semitones`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/semitones/) · [`<accidental>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/accidental/) · [`<key>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/key/) · [`<key-alter>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/key-alter/) · [non-traditional key example](https://www.w3.org/2021/06/musicxml40/musicxml-reference/examples/key-element-non-traditional/)
- ✅ MEI: [`<accid>`](https://music-encoding.org/guidelines/v5/elements/accid.html) · [`<keySig>`](https://music-encoding.org/guidelines/v5/elements/keySig.html) · [`<keyAccid>`](https://music-encoding.org/guidelines/v5/elements/keyAccid.html) · [`<note>`](https://music-encoding.org/guidelines/v5/elements/note.html)
- ✅ LilyPond: [`ly:make-pitch`](https://lilypond.org/doc/v2.24/Documentation/internals/scheme-functions) · [writing pitches](https://lilypond.org/doc/v2.24/Documentation/notation/writing-pitches) (the "do not conform to any standard" admission)
- ✅ Dorico tonality systems / EDO / the **Pitch delta** field — https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_key_signatures/notation_reference_key_signatures_tonality_systems_c.html · .../notation_reference_key_signatures_edit_accidental_dialog_r.html · Scoring Notes on microtonal playback — https://www.scoringnotes.com/reviews/microtonal-playback-in-dorico/
- ⚠️ SMuFL 1.4 is behind HEJI2 — [w3c/smufl#126](https://github.com/w3c/smufl/issues/126); MuseScore initially failed to import HEJI from MusicXML 4 — [musescore/MuseScore#15903](https://github.com/musescore/MuseScore/issues/15903)

### Time, proportional notation and indeterminacy (§4, §5)

- 🔶⭐ **International Conference on New Musical Notation, Ghent 1974 — the full report** (eds. Sabbe, Stone, Warfield; *Interface* 4/1, 1975) — https://dn760101.eu.archive.org/0/items/new-music-notation/New-Music-Notation.pdf · NYPL's Index of New Musical Notation records — https://archives.nypl.org/mus/18608
- ✅⭐ Paul Lombardi, "Feathered Beams", *Journal MusMat* V/2 (2021), 65–90 — https://musmat.org/wp-content/uploads/2021/12/01-Lombardi-V5N2_2021.pdf
- 🔶⭐ Lepper & Trancón y Widemann, "…Feldman's *Projections*", TENOR 2024 — https://www.tenor-conference.org/proceedings/2024/15_TENOR2024_Lepper.pdf
- 🔶⭐ Sluchin & Malt, Cage's time brackets, JIM 2020 — https://creaa.unistra.fr/websites/gream/Activites/Colloque_JIM_2020_-_Pre-actes_-_SLUCHIN_Benny_-_MALT_Mikhail.pdf · MTO 23.4, Andersen on *Four²* — https://mtosmt.org/issues/mto.17.23.4/mto.17.23.4.andersen.html · MTO 26.3, Andersen on Brown's open form — https://mtosmt.org/issues/mto.20.26.3/mto.20.26.3.andersen.html
- 🔶 Getty Scores Project: [*December 1952*](https://www.getty.edu/publications/scores/object-index/301/) (the "no key is supplied" statement) · [*Projection 1*](https://www.getty.edu/publications/scores/object-index/046/) · [Gallope on Bussotti](https://www.getty.edu/publications/scores/03/commentary/)
- 🔶 Cage, *Silence* (full text) — https://archive.org/stream/silencelecturesw1961cage/silencelecturesw1961cage_djvu.txt
- 🔶 Lutosławski, String Quartet — Hyperion's note carrying his letter to Walter Levin — https://www.hyperion-records.co.uk/dw.asp?dc=W14360_67943 · Polish Music Library — https://polskabibliotekamuzyczna.pl/encyklopedia/lutoslawski-witold/?lang=en
- ✅ MusicXML: [`<senza-misura>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/senza-misura/) · [`<time>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/time/) · [`<measure>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/measure-partwise/) (the `implicit` gloss) · [`<part>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/part-partwise/) (measure is mandatory) · [`<beam>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/beam/) + [`fan`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/fan/) · the rejected milliseconds proposal — https://lists.w3.org/Archives/Public/public-music-notation-contrib/2016Apr/0018.html
- ✅ MEI: [`<staff>`](https://music-encoding.org/guidelines/v5/elements/staff.html) (contained by *section*) · [`att.duration.ges`](https://music-encoding.org/guidelines/v5/attribute-classes/att.duration.ges.html) (`@dur.real`) · [`att.timestamp.ges`](https://music-encoding.org/guidelines/v5/attribute-classes/att.timestamp.ges.html) · [`<line>`](https://music-encoding.org/guidelines/v5/elements/line.html) · [`<zone>`](https://music-encoding.org/guidelines/v5/elements/zone.html) · [`<symbolDef>`](https://music-encoding.org/guidelines/v5/elements/symbolDef.html) · [`<expansion>`](https://music-encoding.org/guidelines/v5/elements/expansion.html) · [`<app>`](https://music-encoding.org/guidelines/v5/elements/app.html) / [`<choice>`](https://music-encoding.org/guidelines/v5/elements/choice.html) · the `@form` reversal: [v5](https://music-encoding.org/guidelines/v5/attribute-classes/att.beam.vis.html) vs [v4](https://music-encoding.org/guidelines/v4/attribute-classes/att.beam.vis.html) vs [v3](https://music-encoding.org/guidelines/v3/attribute-classes/att.beamrend.html)
- ✅ LilyPond: [unmetered music / `\cadenzaOn`](https://lilypond.org/doc/v2.24/Documentation/notation/displaying-rhythms#unmetered-music) · [beams / `\featherDurations`](https://lilypond.org/doc/v2.24/Documentation/notation/beams) · [proportional notation](https://lilypond.org/doc/v2.25/Documentation/notation/proportional-notation) · [`DurationLine` grob](https://lilypond.org/doc/v2.25/Documentation/internals/durationline)
- ✅ Dorico: [types of time signature / open meter](https://archive.steinberg.help/dorico_elements/v2/en/dorico/topics/notation_reference/notation_reference_time_signatures_types_c.html) · [open-meter styles](https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_time_signatures_styles_open_meter_changing_individually_t.html) · [fanned beams](https://archive.steinberg.help/dorico/v1/en/dorico/topics/notation_reference/notation_reference_beaming_fanned_c.html) · [aleatoric box workaround (forum)](https://forums.steinberg.net/t/box-notation-work-around-aleatoric-music/831658)
- ✅ MuseScore: [non-metered measures](https://handbook.musescore.org/notation/rhythm-meter-and-measures/pickup-and-non-metered-measures) · [beams](https://handbook.musescore.org/notation/rhythm-meter-and-measures/beams) · [score size and spacing](https://handbook.musescore.org/formatting/score-size-and-spacing)
- ✅ MakeMusic sunsets Finale, 26 Aug 2024 — https://www.makemusic.com/press-room/press-releases-2024/makemusic-sunsets-finale/
- ✅ The research world's route around the formats: [TENOR proceedings](https://www.tenor-conference.org/proceedings.html) · [DigiScore (ERC)](https://digiscore.github.io/) · [Decibel ScorePlayer](https://decibelnewmusic.com/decibel-scoreplayer/) · [INScore (GRAME)](https://inscore.grame.fr/) · [MaxScore](https://www.computermusicnotation.com/)

### Techniques, staves, clefs, spans (§6, §7, §8)

- ✅ MusicXML: [`<harmonic>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/harmonic/) + [`<touching-pitch>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/touching-pitch/) + [`<sounding-pitch>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/sounding-pitch/) · [`<scordatura>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/scordatura/) / [`<accord>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/accord/) · [`<notehead>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/notehead/) + [`notehead-value`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/notehead-value/) · [`<unpitched>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/unpitched/) · [`<percussion>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/percussion/) (which **cites Kurt Stone by page**) · [`<staff-details>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/staff-details/) · [`<staff-lines>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/staff-lines/) · [`<line-detail>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/line-detail/) · [`<staff-tuning>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/staff-tuning/) · [`staff-type`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/staff-type/) · [`<clef>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/clef/) + [`clef-sign`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/clef-sign/) + [`<clef-octave-change>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/clef-octave-change/) · [`<octave-shift>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/octave-shift/) · [`<pedal>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/pedal/) + [`pedal-type`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/pedal-type/) · [`<wavy-line>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/wavy-line/) · [`<glissando>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/glissando/) / [`<slide>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/slide/) · [`<bracket>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/bracket/) · [`<measure-repeat>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/measure-repeat/) · [`<bend>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/bend/) · [`<caesura>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/caesura/)
- ✅ MEI: [`<staffDef>`](https://music-encoding.org/guidelines/v5/elements/staffDef.html) · [`<ossia>`](https://music-encoding.org/guidelines/v5/elements/ossia.html) · [`<incip>`](https://music-encoding.org/guidelines/v5/elements/incip.html) · [`<tuning>`](https://music-encoding.org/guidelines/v5/elements/tuning.html) · [tablature chapter](https://music-encoding.org/guidelines/v5/content/tablature.html) · [`<octave>`](https://music-encoding.org/guidelines/v5/elements/octave.html) (the "semantic error" rule) · [`<pedal>`](https://music-encoding.org/guidelines/v5/elements/pedal.html) · [`<trill>`](https://music-encoding.org/guidelines/v5/elements/trill.html)
- ✅ LilyPond: [modifying single staves / `line-positions`](https://lilypond.org/doc/v2.24/Documentation/notation/modifying-single-staves) · [percussion (the two tables)](https://lilypond.org/doc/v2.24/Documentation/notation/common-notation-for-percussion) · [fretted strings](https://lilypond.org/doc/v2.24/Documentation/notation/common-notation-for-fretted-strings) · [unfretted strings / harmonics](https://lilypond.org/doc/v2.24/Documentation/notation/common-notation-for-unfretted-strings) · [woodwind diagrams](http://lilypond.org/doc/v2.18/Documentation/notation/woodwind-diagrams)
- ✅ SMuFL ranges read directly: [string](http://smufl.formats.music/latest/tables/string-techniques.html) · [wind](http://smufl.formats.music/latest/tables/wind-techniques.html) · [brass](http://smufl.formats.music/latest/tables/brass-techniques.html) · [plucked](http://smufl.formats.music/latest/tables/plucked-techniques.html) · [vocal](http://smufl.formats.music/latest/tables/vocal-techniques.html) · [keyboard](http://smufl.formats.music/latest/tables/keyboard-techniques.html) · [harp](http://smufl.formats.music/latest/tables/harp-techniques.html) · [techniques noteheads](http://smufl.formats.music/latest/tables/techniques-noteheads.html) (the Swiss-rudiment false friend) · [noteheads](http://smufl.formats.music/latest/tables/noteheads.html) · [clefs](http://smufl.formats.music/latest/tables/clefs.html) · [octaves](http://smufl.formats.music/latest/tables/octaves.html) · [multi-segment lines](http://smufl.formats.music/latest/tables/multi-segment-lines.html) · [holds and pauses](http://smufl.formats.music/latest/tables/holds-and-pauses.html) · [time signatures](http://smufl.formats.music/latest/tables/time-signatures.html) · [conductor symbols](http://smufl.formats.music/latest/tables/conductor-symbols.html) · [beamed groups of notes](http://smufl.formats.music/latest/tables/beamed-groups-of-notes.html) (the second false friend)
- ✅ Bartolozzi, *New Sounds for Woodwind* (OUP 1967) — https://openlibrary.org/books/OL4115652M/New_sounds_for_woodwind · Strange & Strange, *The Contemporary Violin* (UC Press 2001) · Read, *Compendium of Modern Instrumental Techniques* (Greenwood 1993) · Read, *Source Book of Proposed Music Notation Reforms* (Greenwood 1987)
- ✅ Schoenberg's *Pierrot* preface, quoted in Byron, *MTO* 12.1 — https://mtosmt.org/issues/mto.06.12.1/mto.06.12.1.byron.html
- ✅ Hugill, *The Orchestra: A User's Manual* — [violin mutes & harmonics](https://andrewhugill.com/OrchestraManual/violin_muteharmonics.html) ("often inconsistent") · Bledsoe, [notation of extended techniques](https://helenbledsoe.com/Notation%20of%20extended%20techniques.pdf) · Cage's *Sonatas and Interludes* — https://en.wikipedia.org/wiki/Sonatas_and_Interludes
- ✅ Grove, *Scordatura* ("in effect, a species of tablature") — https://www.oxfordmusiconline.com/grovemusic/display/10.1093/gmo/9781561592630.001.0001/omo-9781561592630-e-0000041698

### Contemporary practice (§9) and what shipping editors do

- ✅ [New Music USA — "A Journey to Aaron Cassidy's Second String Quartet"](https://nmbx.newmusicusa.org/a-journey-to-aaron-cassidys-second-string-quartet) — instrumental decoupling (Hübler, Ferneyhough, Barrett, Cox, Mahnkopf), the per-axis staves, the later multi-coloured single staff
- ✅ [Aaron Cassidy — biography](https://aaroncassidy.com/bio/) and [bibliography](http://aaroncassidy.com/bibliography/) — "tablature notations that prioritize the physical, bodily, and mechanical aspects of sound-production"
- ✅ Dorico's **Lines**: [Custom lines](https://www.steinberg.help/r/dorico-pro/6.1/en/dorico/topics/library/library_lines_custom_c.html) · [custom annotations](https://www.steinberg.help/r/dorico-pro/6.1/en/dorico/topics/library/library_lines_custom_annotations_creating_t.html) · [adding text to lines](https://www.steinberg.help/r/dorico-pro/6.1/en/dorico/topics/notation_reference/notation_reference_lines/notation_reference_lines_text_adding_t.html) · [Scoring Notes, "Lines and line style editors in Dorico"](https://www.scoringnotes.com/tips/lines-and-line-style-editors-in-dorico/) — a line = **body** (single/double/wedge/pattern of repeatable symbols) + **caps** + **annotations** (as caps, centred, repeatable along the line, or hyphenated). ⚠️ The often-quoted "no playback implications" phrasing was **not** found on Steinberg's pages in this session.
- ✅ MuseScore's split of glyph from tuning: [Global microtuning and microtonal notation](https://musescore.org/en/node/323949) · [Add playback support for microtonal accidentals](https://musescore.org/en/node/281507) (accidentals carry a default `centOffset` — ±50, ±100, ±150… — which playback has historically *not* used) · [MU4 microtonal playback issue #12582](https://github.com/musescore/MuseScore/issues/12582) · third-party [xen-tuner](https://github.com/euwbah/musescore-xen-tuner) and [xentuner](https://github.com/keenanpepper/musescore-xentuner) plugins, which exist precisely because the built-in model stops at the glyph

