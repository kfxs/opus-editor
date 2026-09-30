# Alteration signs and tuning — the standards, the interchange formats, the commercial programs

> **Findings only.** ⛔ Nothing here is a decision. What was concluded from it, and what he decided,
> is `docs/research/alteration-signs-research.md`; the SOURCE of LilyPond, MuseScore and Verovio is
> `docs/research/alteration-signs-engines-research.md`.

**What this is:** how MusicXML, MEI, SMuFL and MNX model an accidental and its sound, what the
tuning formats (Scala, MTS, MIDI 2.0 …) can and cannot carry, and the documented models of Dorico,
Finale, Sibelius and others. Researched 2026-09-30. Scope: standards, formats and vendors'
documentation — ⛔ not engine source (the sibling file) and ⛔ not the engraving literature.

**How to read this file.** Every claim is tagged:

- **[Q]** = quoted or read directly from the primary source named (schema file, spec page, vendor doc).
- **[I]** = my inference from those sources — not stated by them.
- **UNKNOWN** = could not be reached or confirmed; what was tried is said.

Primary files were downloaded and parsed locally (not summarised by a model) for MusicXML (XSD),
MEI (ODD source), SMuFL (metadata JSON), MNX (JSON schema + issue threads via the GitHub API),
Dorico and Finale (vendor help pages), the MIDI Tuning and MIDI 2.0 UMP specs (PDF → text),
Scala (format pages), AnaMark `.tun` (PDF), MTS-ESP (client header), Ableton ASCL (help-centre API).

⚠️ Repo move: the W3C Music Notation CG repos are now under **`w3c-cg/`** (`w3c-cg/musicxml`,
`w3c-cg/mnx`, `w3c-cg/smufl`); `w3c/…` redirects. The MNX docs moved to `w3c-cg.github.io/mnx/docs/`.

---

## 1. MusicXML 4.0

Source: `schema/musicxml.xsd` at tag `v4.0` of `w3c-cg/musicxml`
(https://raw.githubusercontent.com/w3c/musicxml/v4.0/schema/musicxml.xsd), plus the reference pages
under https://www.w3.org/2021/06/musicxml40/.

### 1.1 `<pitch>` and `<alter>`

[Q] `pitch` complexType: *"Pitch is represented as a combination of the step of the diatonic scale, the
chromatic alteration, and the octave."* Sequence: `step` (A–G), `alter` (type `semitones`,
`minOccurs="0"`), `octave`.

[Q] `semitones` simpleType (restriction of `xs:decimal`): *"The semitones type is a number representing
semitones, used for chromatic alteration. A value of -1 corresponds to a flat and a value of 1 to a
sharp. Decimal values like 0.5 (quarter tone sharp) are used for microtones."*

[Q] `<alter>` reference page (https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/alter/):
*"The `<alter>` element represents chromatic alteration in number of semitones (e.g., -1 for flat, 1
for sharp). Decimal values like 0.5 (quarter tone sharp) are used for microtones."*

[Q] Tutorial, "MIDI-Compatible Part" (https://www.w3.org/2021/06/musicxml40/tutorial/midi-compatible-part/):
*"The `<pitch>` element requires an `<alter>` element, even if the accidental is already in the key
signature. Although the `<alter>` element does not change how the pitch is notated, it ensures proper
playback and transposition. This is why the E-flat contains an `<alter>` element, though there is no
accidental on the note. Alter values of -2 and 2 can be used for double-flat and double-sharp. Decimal
values can be used for microtones (e.g., 0.5 for a quarter-tone sharp), but not all programs may
convert this into MIDI pitch-bend data."*

The same `semitones` type is reused for `key-alter`, `tuning-alter`, `pedal-alter`, `root-alter`
(`harmony-alter`), `bend-alter` and `<transpose><chromatic>` [Q].

### 1.2 `<accidental>` and the full `accidental-value` enumeration (41 values)

[Q] `accidental` complexType: *"The accidental type represents actual notated accidentals. Editorial
and cautionary indications are indicated by attributes. Values for these attributes are "no" if not
present. Specific graphic display such as parentheses, brackets, and size are controlled by the
level-display attribute group."* Content: `accidental-value`. Attributes: `cautionary` (yes-no),
`editorial` (yes-no), `parentheses` (yes-no), `bracket` (yes-no), `size` (`symbol-size`: `full` |
`cue` | `grace-cue` | `large`), the `print-style` group (position, font, color), and `smufl`
(`smufl-accidental-glyph-name`).

[Q] In `<note>` the element is declared `<xs:element name="accidental" type="accidental" minOccurs="0"/>`
— i.e. **at most one per note in 4.0**.

[Q] `accidental-value` documentation: *"The accidental-value type represents notated accidentals
supported by MusicXML. In the MusicXML 2.0 DTD this was a string with values that could be included.
The XSD strengthens the data typing to an enumerated list. The quarter- and three-quarters-
accidentals are Tartini-style quarter-tone accidentals. The -down and -up accidentals are quarter-tone
accidentals that include arrows pointing down or up. The slash- accidentals are used in Turkish
classical music. The numbered sharp and flat accidentals are superscripted versions of the accidental
signs, used in Turkish folk music. The sori and koron accidentals are microtonal sharp and flat
accidentals used in Iranian and Persian music. The other accidental covers accidentals other than
those listed here. It is usually used in combination with the smufl attribute to specify a particular
SMuFL accidental. The smufl attribute may be used with any accidental value to help specify the
appearance of symbols that share the same MusicXML semantics."*

[Q] The enumeration, in schema order (41):

| family (my grouping [I]) | values | n |
|---|---|---|
| standard 12-EDO | `sharp`, `natural`, `flat`, `double-sharp`, `sharp-sharp`, `flat-flat`, `natural-sharp`, `natural-flat`, `triple-sharp`, `triple-flat` | 10 |
| Tartini-style quarter-tones | `quarter-flat`, `quarter-sharp`, `three-quarters-flat`, `three-quarters-sharp` | 4 |
| arrow quarter-tones | `sharp-down`, `sharp-up`, `natural-down`, `natural-up`, `flat-down`, `flat-up`, `double-sharp-down`, `double-sharp-up`, `flat-flat-down`, `flat-flat-up`, `arrow-down`, `arrow-up` | 12 |
| Turkish classical ("slash") | `slash-quarter-sharp`, `slash-sharp`, `slash-flat`, `double-slash-flat` | 4 |
| Turkish folk (superscript number) | `sharp-1`, `sharp-2`, `sharp-3`, `sharp-5`, `flat-1`, `flat-2`, `flat-3`, `flat-4` | 8 |
| Persian | `sori`, `koron` | 2 |
| escape hatch | `other` | 1 |

Note [Q]: there is **no `sharp-4` and no `flat-5`** (mirrors SMuFL's Turkish folk range: 1/2/3/5-comma
sharp, 1/2/3/4-comma flat). `double-sharp` (𝄪) and `sharp-sharp` (♯♯) are distinct *signs* with the
same alter.

[Q] `smufl-accidental-glyph-name`: *"…used to reference a specific Standard Music Font Layout (SMuFL)
accidental character. The value is a SMuFL canonical glyph name that starts with one of the strings
used at the start of glyph names for SMuFL accidentals."* Pattern:
`(acc|medRenFla|medRenNatura|medRenShar|kievanAccidental)(\c+)`.

### 1.3 How `<alter>` and `<accidental>` may disagree — the intended division of labour

- [Q] `<note>` documentation: *"The MusicXML format distinguishes between elements used for sound
  information and elements used for notation information (e.g., tie is used for sound, tied for
  notation)… Having these two types of information available can make interchange easier, as some
  programs handle one type of information more readily than the other."*
- [Q] Tutorial, "Notation Basics": *"A fundamental part of MusicXML is the distinction between
  elements that primarily represent the sound of the music versus those that represent its
  appearance."* and *"The `<accidental>` element represents actual notated accidentals."*
- [Q] Nothing in the XSD constrains `<accidental>` against `<alter>` — they are two independent
  elements; the schema cannot express the relation. **[I]** So: `alter` = SOUND (total alteration,
  present even when no sign is printed — key signature, earlier in bar), `accidental` = the SIGN
  printed on this note (absent = no sign printed). They "disagree" routinely and legitimately: E♭ in
  E♭ major has `alter=-1` and no `<accidental>`; a cautionary ♮ has `alter=0` and
  `<accidental cautionary="yes">natural</accidental>`; and any microtonal sign whose meaning the
  exporter does not know can carry any `alter`.
- [Q] Michael Good (MusicXML editor), w3c-cg/musicxml issue #263 (2018-06-14), on Helmholtz-Ellis:
  *"`<accidental smufl="accidentalFlatThreeArrowsUp">other</accidental>` — If one of MusicXML's
  standard accidental values matches the sound but not the appearance, you can use that value
  instead of "other". You will want the `<alter>` element to specify the microtonal value in addition
  to the `<accidental>` element for the best chance that applications can interpret one or the other
  correctly."*
- [Q] Good, mnx issue #180 (2017): *"The absence of an `<accidental>` element is how you say 'Here
  there shall be no accidental' in MusicXML"* and *"Clarifying and perhaps simplifying the
  relationship between the accidental and alter elements could be a topic for MNX."* Good, mnx #153
  (2019): *"Omitting the attribute to indicate the absence of an accidental is what MusicXML does,
  but it has proven to be one of the more error-prone decisions."*
- [Q] A real-world casualty recorded in mnx #20 (mogenslundholm, 2017): the SymbTr makam corpus
  writes two *different-sounding* B-quarter-flats as `alter=-0.41509434` and `alter=-0.18867924`
  (2/53 and 1/53 of an octave in semitones) — the 53-EDO tuning is baked into every note's decimal.

### 1.4 `<key>` — non-traditional form

[Q] `key` = choice of `traditional-key` (`cancel?`, `fifths`, `mode?`) **or** an unbounded sequence of
`non-traditional-key` groups, followed by `key-octave*`. `non-traditional-key`: *"represents a single
alteration within a non-traditional key signature. A sequence of these groups makes up a
non-traditional key signature"* = `key-step` (step), `key-alter` (semitones — *"represented with
semitones in the same manner as the alter element"*), `key-accidental?` (*"indicates the accidental to
be displayed in the key signature, represented in the same manner as the accidental element. It is
used for disambiguating microtonal accidentals."*; content `accidental-value` + `smufl` attribute, no
formatting attributes). `key-octave` (`number`, `cancel`) places each element in an octave. `key` has
an optional `number` (staff) attribute.

### 1.5 `<accidental-mark>`

[Q] *"An accidental-mark can be used as a separate notation or as part of an ornament. When used in
an ornament, position and placement are relative to the ornament, not relative to the note."* Content
`accidental-value`; attributes `parentheses`/`bracket`/`size`, print-style, `placement`, `smufl`, id.
Allowed directly in `<notations>` and (unbounded) inside `<ornaments>`.

### 1.6 Tuning: `<scordatura>`, `<staff-tuning>` — and no tuning system

- [Q] `scordatura`: *"Scordatura string tunings are represented by a series of accord elements,
  similar to the staff-tuning elements. Strings are numbered from high to low."* `accord` and
  `staff-tuning` (*"specifies the open, non-capo tuning of the lines on a tablature staff"*) share the
  `tuning` group = `tuning-step`, `tuning-alter?` (semitones), `tuning-octave`. Also `pedal-tuning`
  (harp). These are **string pitches**, not temperaments.
- [Q] Grep of the 4.0 XSD: the word `temperament` occurs **0** times; `cents` does not occur as a
  unit; every occurrence of `tuning` is `staff-tuning` / `accord` / `pedal-tuning` / the `tuning`
  group. `midi-instrument` = channel, name, bank, program, unpitched, volume, pan, elevation — no
  tuning field. `<sound>` = tempo, dynamics, jumps, pedals, etc. — no tuning field.
- **Conclusion [I from the grep]: MusicXML 4.0 has NO tuning-system concept.** The only vehicle for
  non-12-EDO sound is the decimal `alter` on every note.

### 1.7 MusicXML 4.1 (in development) — multiple accidentals per note

[Q] w3c-cg/musicxml issue #605 "Support multiple accidentals" (infojunkie, 2025-10-09) → PR #682,
**merged 2026-08-07**. The development schema (`gh-pages` branch, header says "MusicXML 4.1") now has
`<xs:element name="accidental" type="accidental" minOccurs="0" maxOccurs="unbounded">` and the same
for `key-accidental`, with the new sentence: *"In the case of multiple accidentals per note,
accidentals are displayed in the same order they appear in the MusicXML document, i.e. left to
right."* The issue's argument: Sagittal "mixed" mode, HEJI and Johnston notation all put several
signs on one note, and *"SMuFL expects those accidentals to be combined"*. ⚠️ 4.1 is not released.

---

## 2. MEI 5 (read from the ODD source at tag `v5.1`)

Source: https://github.com/music-encoding/music-encoding/tree/v5.1/source/modules (`MEI.xml`,
`MEI.shared.xml`, `MEI.gestural.xml`, `MEI.visual.xml`, `MEI.analytical.xml`,
`MEI.externalsymbols.xml`, `MEI.usersymbols.xml`, `MEI.stringtab.xml`) and `source/docs/*.xml`
(the Guidelines).

### 2.1 `data.ACCIDENTAL.WRITTEN` — 36 values

[Q] `data.ACCIDENTAL.WRITTEN` = union of four sub-types:

| sub-type | values (with the schema's own descriptions) | n |
|---|---|---|
| `.basic` — "Written standard accidental values" | `s` Sharp · `f` Flat · `ss` Double sharp (written as 2 sharps) · `x` Double sharp (written using croix) · `ff` Double flat · `xs` Triple sharp (croix followed by a sharp) · `sx` Triple sharp (sharp followed by a croix) · `ts` Triple sharp (written as 3 sharps) · `tf` Triple flat · `n` Natural · `nf` Natural + flat; used to cancel preceding double flat · `ns` Natural + sharp; used to cancel preceding double sharp | 12 |
| `.extended` — "Written quarter-tone accidental values" | `su` `sd` `fu` `fd` `nu` `nd` `xu` `xd` `ffu` `ffd` (sharp/flat/natural/double-sharp/double-flat "modified by arrow", up or down) · `1qf` 1/4-tone flat · `3qf` 3/4-tone flat · `1qs` 1/4-tone sharp · `3qs` 3/4-tone sharp | 14 |
| `data.ACCIDENTAL.aeu` — "Arel-Ezgi-Uzdilek (AEU) accidental values (written and gestural/performed)" | `bms` Büyük mücenneb (sharp) · `kms` Küçük mücenneb (sharp) · `bs` Bakiye (sharp) · `ks` Koma (sharp) · `kf` Koma (flat) · `bf` Bakiye (flat) · `kmf` Küçük mücenneb (flat) · `bmf` Büyük mücenneb (flat) | 8 |
| `data.ACCIDENTAL.persian` — "Persian accidental values (written and gestural/performed)" | `koron` (quarter tone flat) · `sori` (quarter tone sharp) | 2 |

Note [I]: MEI's written basic set distinguishes more *spellings of the same sign-meaning* than
MusicXML (three triple-sharps: `xs`, `sx`, `ts`).

### 2.2 `data.ACCIDENTAL.GESTURAL` — 23 values

| sub-type | values | n |
|---|---|---|
| `.basic` — "Gestural/performed accidental values" | `s` `f` `ss` `ff` `ts` `tf` `n` | 7 |
| `.extended` — "Gestural/performed quarter-tone accidental values" | `su` Three quarter-tones sharp · `sd` Quarter-tone sharp · `fu` Quarter-tone flat · `fd` Three quarter-tones flat · `xu` Five quarter-tones sharp · `ffd` Five quarter-tones flat | 6 |
| `data.ACCIDENTAL.aeu` | (same 8) | 8 |
| `data.ACCIDENTAL.persian` | (same 2) | 2 |

⚠️ [I] The gestural side is **still an enumeration, not a number**: no cents, no ratio. It collapses
glyph variants (`x`/`ss` → `ss`; `1qs` and `sd` → `sd`) but it cannot express a tuning. Verovio's
maintainer-side comment in issue #1167 confirms the mapping is lossy in the other direction:
*"there's no 1:1 mapping between written and gestural accidentals… e.g. ACCIDENTAL_WRITTEN_1qf (which
is mapped to ACCIDENTAL_GESTURAL_fu)"* (infojunkie, 2026-06-03).

### 2.3 Where the attributes sit

- [Q] `att.accidental`: `@accid` (data.ACCIDENTAL.WRITTEN) — *"Captures a written accidental."*
- [Q] `att.accidental.ges`: `@accid.ges` (data.ACCIDENTAL.GESTURAL) — *"Records the performed pitch
  inflection."*
- [Q] On `<note>`, `@accid` arrives through **`att.note.anl`** (the *analytical* class is a member of
  `att.accidental`), `@accid.ges` through `att.note.ges`. On `<accid>`, `@accid` is *logical*
  (`att.accid.log` ∈ `att.accidental`).
- [Q] `att.pitch.ges`: `@oct.ges` — *"Records performed octave information that differs from the
  written value."*; `@pname.ges` (pattern `[a-g]|none`) — *"Contains a performed pitch name that
  differs from the written value."*; `@pnum` (nonNegativeInteger) — *"Holds a pitch-to-number mapping,
  a base-40 or MIDI note number, for example."*
- [Q] `att.transposition`: `@trans.diat` + `@trans.semi` — *"Diatonic transposition requires both…
  in order to distinguish the difference, for example, between a transposition from C to C♯ and one
  from C to D♭."*

### 2.4 The `<accid>` element

[Q] *"Records a temporary alteration to the pitch of a note."* Remarks: *"An accidental may raise a
pitch by one or two semitones or it may cancel a previous accidental or part of a key signature.
This element provides an alternative to the accid and accid.ges attributes on the note element. The
element may be used when specific display info, such as size or color, needs to be recorded for the
accidental **or when multiple accidentals occur on a single note**. The func attribute can be used to
differentiate between the accidental's functions, such as 'cautionary' or 'editorial'."*

Attributes [Q]:
- logical: `@accid`; `@func` = `caution` | `edit`; plus control-event attributes.
- gestural: `@accid.ges`.
- visual (`att.accid.vis`): `@enclose` (`data.ENCLOSURE` = `paren` | `brack` | `box` | `none`),
  `@place` (staff-relative, e.g. above for editorial/ficta), `@onstaff`, `@loc`/`@ploc`/`@oloc`,
  color, typography, `@ho`/`@vo`, `@x`/`@y`; and the two glyph overrides:
  - `att.extSym`: `@glyph.auth` (suggested value `smufl` — "Standard Music Font Layout"),
    `@glyph.uri`, `@glyph.name`, `@glyph.num` (hex code point, *"e.g., "#xE000" or "U+E000""*).
    Guidelines ch. 2 [Q]: *"Externally-defined symbols may be referenced using a glyph.name or
    glyph.num attribute from the att.extSym attribute class. Both attributes refer to Standard Music
    Font Layout (SMuFL) characters, if not specified differently by the glyph.auth and glyph.uri
    attributes."*
  - `att.altSym`: `@altsym` — *"Provides a way of pointing to a user-defined symbol. It must contain
    a reference to an ID of a symbolDef element elsewhere in the document."* (user-drawn symbols in a
    `symbolTable`).

### 2.5 `<keySig>` / `<keyAccid>`

[Q] `@sig` / `@keysig` = `data.KEYFIFTHS` (pattern `mixed|0|([1-9]|1[0-2])[f|s]`). Remark: *"Mixed key
signatures, e.g., those consisting of a mixture of flats and sharps (Read, p. 143, ex. 9-39), and key
signatures with unorthodox placement of the accidentals (Read, p. 141) can be encoded using the keySig
element."* `<keyAccid>` — *"Accidental in a key signature."* — carries `@accid` + `@pname`/`@oct`
(or `@loc`, or `@x`/`@y`; one is required by Schematron), `@form` (`implicit` — *"Only performed
values (sharp, flat, natural) allowed"* | `explicit` — *"All enharmonic (written) values allowed"*),
and the same visual overrides (`@enclose`, `@glyph.*`, `@altsym`). `@cancelaccid` on keySig =
`none` | `before` | `after` | `before-bar`.

### 2.6 Tuning attributes

- [Q] `att.tuning` (member of `att.scoreDef.ges` and `att.staffDef.ges` — *gestural* domain):
  `@tune.Hz` — *"Holds a value for cycles per second, i.e., Hertz, for a tuning reference pitch."*;
  `@tune.pname` — *"Holds the pitch name of a tuning reference pitch, i.e., the central tone of a
  tuning system."*; `@tune.temper` (`data.TEMPERAMENT`) — *"Provides an indication of the tuning
  system, just, for example."*
- [Q] `data.TEMPERAMENT` — **4 values only**: `equal` (Equal or 12-tone temperament) · `just` (Just
  intonation) · `mean` (Meantone intonation) · `pythagorean` (Pythagorean tuning).
- [Q] `<tuning>` — *"Describes the tuning of an instrument."* Remark: *"At this point, the tuning
  element has been worked out for string instruments only."* Children `<course>` (each with `@pname`,
  `@oct`, `@accid`); `@tuning.standard` = `guitar.standard` | `guitar.drop.D` | `guitar.open.D` |
  `guitar.open.G` | `guitar.open.A` | `lute.renaissance.6` | `lute.baroque.d.major` |
  `lute.baroque.d.minor`. String tuning, not temperament.

### 2.7 How the Guidelines explain written vs gestural

[Q] Guidelines v5, Introduction, "Musical Domains" (quoting SMDL): *"gestural domain — …how and when
components of the logical domain is rendered in a specific performance… 'the information added by
performers,' or 'how the music actually sounds during particular performances.'"* and *"visual
domain — …'how the music actually looks in some particular edition.'"* Then MEI's own position:
*"Very often, MEI prioritizes the visual domain over the gestural domain by (partly) conflating the
logical and the visual domains. For example, MEI utilizes the pname (pitch name) attribute on notes
to capture the written pitch of a note, whereas the sounding pitch may be described with the
pname.ges attribute. Here, the logical and visual domains go without a special indication, whereas
the gestural domain is identified by a special suffix."* and *"Many attributes carry a suffixed .log
(logical), .ges (gestural), .vis (visual), or .anl (analytical) in their name."*

⚠️ **Finding:** the v5.1 Guidelines prose contains **no passage specifically about `accid` vs
`accid.ges`** — I grepped `source/docs/01…14` for `accid.ges`: zero hits in the chapters' prose
(chapter 2 only lists `accid` in a `specList` with an editorial-accidental example). The split is
explained only by the general domain text above plus the one-line attribute descriptions.

[Q] A sharper statement of the distinction, by an MEI board member in issue #1167 (ahankinson,
2026-06-03): *"MEI is a bit more specific in what we mean by written. There is the logical
definition, which is the musical structure, and then there is the visual definition, which is the
actual graphical representation. This is separated because a `<note pname="d" accid="s" />` may not
actually have a written (that is, visual) accidental if, for example, D# is in the key signature…
The pitch is still a D#, but there may not actually be an accidental visible."*

### 2.8 The live MEI design discussion — issue #1167 "Support arbitrary tunings" (open, v6 milestone)

https://github.com/music-encoding/music-encoding/issues/1167 — 26 comments, last 2026-07.
This is, with MNX #184, the most direct industry discussion of "symbol in the score, tuning as
interpreter". Summary [Q unless marked]:

- Problem: `data.TEMPERAMENT` has 4 values. Scala has thousands.
- Rejected: embedding Scala text (*"It will put a requirement on compliant MEI parsers that they
  also support Scala code parsing"* — ahankinson).
- Proposal after the Music Encoding Conference 2026 (infojunkie, 2026-05-29; refined by ahankinson
  2026-06-02): a `<temperamentDef>` holding `<temperament xml:id label hz>` with `<interval>`
  definitions (one unit per value: `"700/900r"` ratio or `"90.57c"` cents) and an `<intervalMap>` of
  `<pitch pname="c" accid="s" interval="#int2"/>` — **i.e. a table `(pname, accid) → ratio | cents`**,
  referenced from `staffDef`/`instrDef`/`scoreDef`. Reference pitch modelled on Ableton ASCL's
  `@ABL REFERENCE_PITCH 4 9 440.0`.
- The unresolved fork — **what keys the table when the sign is not in MEI's enum**:
  - ahankinson: *"SMuFL isn't at all concerned with semantics and only visuals"*;
    `glyph.name` is *"use this glyph when rendering it"* and should have *"no effect on the pitch"*;
    prefers extending `data.ACCIDENTAL.WRITTEN`, but notes SMuFL has near-duplicates (*"e.g., E270,
    E2C6"*) and undefined effects (*"I'm not sure what the sounding effect of
    `accidentalDoubleSharpOneArrowDown` (E2C4) is"*).
  - infojunkie: *"There are ~480 accidental symbols in SMuFL… The only source of such information is
    SMuFL at the moment. Would MEI be interested to reproduce and maintain the hundreds of such
    accidentals?"*; proposes a per-document `<accidDef glyph.name="accSagittal5CommaDown"
    glyph.auth="smufl" accid="s5cd"/>` that **declares a document-local accidental id bound to a
    glyph**, usable in `@accid` and in the tuning map.
  - lpugin (Verovio): *"each of them should be distinguishable. So having a way to refer externally
    to SMuFL in tunings… might still be necessary."*
  - Multiple accidentals per pitch in the map: `paccid="s5cd sf7cd"` (list) was floated.
  - infojunkie (2026-06-09, read in full): *"not all accidentals can be considered to be additive to
    the regular 12-tet pitches. Accidentals such as the Johnston set, the Extended Helmholtz-Ellis
    set and various Sagittal sets are all based on Pythagorean (Just Intonation) tuning rather that
    equal temperament. So even though the value of each accidental is constant regardless of pitch,
    they apply to just intonation pitches rather 12-tet pitches."* Worked example: the same sign
    `accidentalFlatOneArrowDown` gives −135.19 cents (vs 12-TET) on D and −131.28 on E; the 3.91-cent
    difference is E's Pythagorean offset. **[I]** So a sign's worth *is* a constant, but only over
    the right **nominal** tuning — the interpreter needs two tables (what each of the 7 steps is
    worth, what each sign adds), or one table keyed by the whole (step + sign stack). "cents
    relative to 12-TET per sign" is not a sufficient model.
  - On completeness: *"Do we need [a mapping for every pname × accidental] … to arrive at a "fully
    defined" tuning map? — Absolutely, that's precisely what SCL+KBM and ASCL do."*
- Status: open, undecided.

---

## 3. SMuFL 1.4

Sources: metadata at tag `v1.4` of `w3c-cg/smufl` (`metadata/ranges.json`, `classes.json`,
`glyphnames.json`), spec markdown at the same tag (`markdown/specification/*.md`), rendered at
https://www.w3.org/2021/03/smufl14/. ⚠️ `gh-pages` is already ahead of 1.4 (132 ranges vs 131; class
`accidentals` 472 vs 461; since 2026-08 a YAML "canonical source of truth" under `data/ranges/*.yaml`).
Numbers below are **1.4**.

### 3.1 Accidental ranges (every range whose description contains "accidental")

| range key (ranges.json) | description | code points | glyphs |
|---|---|---|---|
| `standardAccidentals12Edo` | Standard accidentals (12-EDO) | U+E260–U+E26F | 14 |
| `gouldArrowQuartertoneAccidentals24Edo` | Gould arrow quartertone accidentals (24-EDO) | U+E270–U+E27F | 12 |
| `steinZimmermannAccidentals24Edo` | Stein-Zimmermann accidentals (24-EDO) | U+E280–U+E28F | 6 |
| `extendedSteinZimmermannAccidentals` | Extended Stein-Zimmermann accidentals | U+E290–U+E29F | 13 |
| `simsAccidentals72Edo` | Sims accidentals (72-EDO) | U+E2A0–U+E2AF | 6 |
| `johnstonAccidentalsJustIntonation` | Johnston accidentals (just intonation) | U+E2B0–U+E2BF | 8 |
| `extendedHelmholtzEllisAccidentalsJustIntonation` | Extended Helmholtz-Ellis accidentals (just intonation) | U+E2C0–U+E2FF | 60 |
| `spartanSagittalSingleShaftAccidentals` | Spartan Sagittal single-shaft accidentals | U+E300–U+E30F | 16 |
| `spartanSagittalMultiShaftAccidentals` | Spartan Sagittal multi-shaft accidentals | U+E310–U+E33F | 38 |
| `athenianSagittalExtensionMediumPrecisionAccidentals` | Athenian Sagittal extension (medium precision) accidentals | U+E340–U+E36F | 40 |
| `trojanSagittalExtension12EdoRelativeAccidentals` | Trojan Sagittal extension (12-EDO relative) accidentals | U+E370–U+E38F | 24 |
| `prometheanSagittalExtensionHighPrecisionSingleShaftAccidentals` | Promethean Sagittal extension (high precision) single-shaft accidentals | U+E390–U+E3AF | 30 |
| `prometheanSagittalExtensionHighPrecisionMultiShaftAccidentals` | Promethean Sagittal extension (high precision) multi-shaft accidentals | U+E3B0–U+E3EF | 64 |
| `herculeanSagittalExtensionVeryHighPrecisionAccidentalDiacritics` | Herculean Sagittal extension (very high precision) accidental diacritics | U+E3F0–U+E3F3 | 4 |
| `olympianSagittalExtensionExtremePrecisionAccidentalDiacritics` | Olympian Sagittal extension (extreme precision) accidental diacritics | U+E3F4–U+E3F7 | 4 |
| `magratheanSagittalExtensionInsanePrecisionAccidentalDiacritics` | Magrathean Sagittal extension (insane precision) accidental diacritics | U+E3F8–U+E41F | 20 |
| `wyschnegradskyAccidentals72Edo` | Wyschnegradsky accidentals (72-EDO) | U+E420–U+E43F | 22 |
| `arelEzgiUzdilekAeuAccidentals` | Arel-Ezgi-Uzdilek (AEU) accidentals | U+E440–U+E44F | 8 |
| `turkishFolkMusicAccidentals` | Turkish folk music accidentals | U+E450–U+E45F | 8 |
| `persianAccidentals` | Persian accidentals | U+E460–U+E46F | 2 |
| `otherAccidentals` | Other accidentals | U+E470–U+E49F | 32 |
| `medievalAndRenaissanceAccidentals` | Medieval and Renaissance accidentals | U+E9E0–U+E9EF | 6 |
| `arabicAccidentals` | Arabic accidentals | U+ED30–U+ED3F | 9 |
| `stockhausenAccidentals` | Stockhausen accidentals (24-EDO) | U+ED50–U+ED5F | 15 |
| `standardAccidentalsChordSymbols` | Standard accidentals for chord symbols | U+ED60–U+ED6F | 7 |
| `extendedHelmholtzEllisAccidentalsJustIntonationSupplement` | Extended Helmholtz-Ellis accidentals (just intonation) supplement | U+EE50–U+EE5F | 10 |
| `otherAccidentalsSupplement` | Other accidentals supplement | U+EE60–U+EE6F | 10 |
| **total** | **27 ranges** | | **488** |

Sagittal alone = 9 ranges, 240 glyphs. **Kievan**: there is no Kievan accidental *range*; two glyphs
`kievanAccidentalSharp` (U+EC3D) and `kievanAccidentalFlat` (U+EC3E) live inside the Kievan square
notation range [Q glyphnames.json].

The standard range in full [Q]: `accidentalFlat` E260 · `accidentalNatural` E261 · `accidentalSharp`
E262 · `accidentalDoubleSharp` E263 · `accidentalDoubleFlat` E264 · `accidentalTripleSharp` E265 ·
`accidentalTripleFlat` E266 · `accidentalNaturalFlat` E267 · `accidentalNaturalSharp` E268 ·
`accidentalSharpSharp` E269 · **`accidentalParensLeft` E26A · `accidentalParensRight` E26B ·
`accidentalBracketLeft` E26C · `accidentalBracketRight` E26D**. Recommended ligatures on the same
page: `accidentalFlatParens`, `accidentalNaturalParens`, `accidentalSharpParens`,
`accidentalDoubleSharpParens`, `accidentalDoubleFlatParens`; stylistic alternate
`accidentalTripleFlatJoinedStems`. Implementation note [Q]: *"Scoring applications may choose to
substitute stylistic alternate versions of the common accidentals glyphs for a better appearance on
smaller staves."*

### 3.2 Classes (classes.json, 85 classes; the accidental ones)

| class | members |
|---|---|
| `accidentals` | 461 |
| `accidentalsStandard` | 12 |
| `accidentals24EDOArrows` | 12 |
| `accidentalsSteinZimmermann` | 19 |
| `accidentalsSims` | 6 |
| `accidentalsJohnston` | 8 |
| `accidentalsHelmholtzEllis` | 70 |
| `accidentalsSagittalPure` | 39 |
| `accidentalsSagittalMixed` | 21 |
| `accidentalsSagittalAthenian` | 40 |
| `accidentalsSagittalTrojan` | 24 |
| `accidentalsSagittalPromethean` | 94 |
| `accidentalsSagittalDiacritics` | 4 |
| `accidentals72EDOWyschnegradsky` | 22 |
| `accidentalsAEU` | 8 |
| `accidentals53EDOTurkish` | 8 |
| `accidentalsPersian` | 2 |
| `accidentalsArabic` | 9 |
| `accidentalsStockhausen` | 15 |
| `tf_chordSymbolAccidentals` | 7 |
| (`combiningStaffPositions` — every glyph that is positioned on a staff position, accidentals included) | 972 |

[Q] Spec, `classes.md`: *"classes.json groups glyphs together into classes, so that software
developers can handle similar glyphs (e.g. noteheads, clefs, flags, etc.) in a similar fashion… Not
all glyphs are contained within classes, and the same glyph can appear in multiple classes."*
[Q] `ranges.md`: each range has `description`, `glyphs[]`, `range_start`, `range_end`.
[Q] `glyphnames.md`: each glyph has `codepoint`, `description`, optionally `alternateCodepoint`
(the Unicode Musical Symbols code point). I checked all 2932 entries: **those are the only three
keys that ever occur.**

⚠️ **The classes are hand-maintained and have holes** [Q by set-difference on the 1.4 JSON]: in
accidental-named ranges but **not** in class `accidentals`: `accidentalBracketLeft`,
`accidentalBracketRight` (the parens *are* in), all 10 of the HEJI supplement
(`accidentalCombiningLower29LimitComma`…), `accidentalHabaFlatThreeQuarterTonesLower`,
`accSagittal7TinasUp`, the 6 `medRen*` and the 7 `csymAccidental*`. So a table built from
`classes.accidentals` alone would silently miss glyphs; **build from `ranges.json` and use classes as
the family tag.**

### 3.3 Semantics — is there any machine-readable pitch meaning? **No.**

- [Q] There is no field for pitch, cents, ratio or EDO step anywhere in `glyphnames.json`,
  `classes.json` or `ranges.json` (verified: key sets above). The 2026 YAML source adds only
  `firstPublishedIn`, `hidden`, `implementationNotes` and per-glyph `classes`.
- [Q] What exists is **prose inside names and descriptions**, inconsistent across ranges:
  - name encodes meaning *and* origin: `accidentalQuarterToneFlatStein` — "Reversed flat
    (quarter-tone flat) (Stein)"; `accidentalThreeQuarterTonesSharpArrowUp`.
  - name encodes shape only: `accidentalSharpOneHorizontalStroke` — "One or three quarter tones
    sharp" (ambiguous by its own description); `accidentalFlatTurned`; `accidentalReversedFlatArrowUp`.
  - description carries a ratio: `accidentalJohnstonPlus` — "Plus (raise by 81:80)";
    `accidentalJohnstonSeven` — "Seven (lower by 36:35)".
  - description carries a comma name: `accidentalFlatOneArrowDown` — "Flat lowered by one syntonic
    comma"; `accidentalLowerOneSeptimalComma`.
  - description carries EDO-degree tables: `accSagittal5CommaUp` — "5 comma up, (5C), 1° up [22 27
    29 34 41 46 53 96 EDOs], 1/12-tone up" — i.e. **one glyph, different step counts in different
    EDOs**, which is exactly why the meaning cannot live on the glyph.
  - two glyphs, one stated meaning: Gould range has `accidentalQuarterToneSharpNaturalArrowUp` and
    `accidentalQuarterToneSharpArrowDown`, both described "Quarter-tone sharp".
- [Q] The range *titles* name a tuning ("(12-EDO)", "(24-EDO)", "(72-EDO)", "(just intonation)") but
  the spec says of the grouping: *"The grouping has no significance other than acting as an attempt
  to provide an overview of the included characters."* (`about/how-smufl-is-organised.md`).
- [Q] MEI board member's reading, issue #1167: *"SMuFL only defines a visual glyph, it doesn't define
  how to interpret it."*

### 3.4 Glyphs meant to be combined

- [Q] Johnston implementation note: *"These glyphs are intended for combining with the standard
  12-EDO accidentals."* (ligatures such as `accidentalJohnstonSevenFlatUp` = uniE2B3_uniE260_uniE2B4
  are listed as recommended ligatures).
- [Q] Spartan Sagittal implementation note: *"The eight pairs of single-shaft accidentals above are
  sufficient… when used alone, and to the left of the standard accidentalDoubleFlat, accidentalFlat,
  accidentalSharp, and the almost-standard accidentalLargeDoubleSharp. This is called "mixed
  Sagittal." As an alternative, the… multi-shaft Spartans… provides a complete set of stand-alone
  accidentals… This is called "pure Sagittal." The standard accidentalNatural is used alone in both
  mixed and pure variants, but only to cancel a previous accidental. Sagittal accidentals are not
  intended to be combined with one another…"*; and *"An accidental can often be used to represent
  alternative commas that differ by 2 cents or less. In such cases the intended comma ratio may be
  determined by the note to which it is applied, or by the musical context."*
- [Q] HEJI: `accidentalCombiningLower53LimitComma` etc. are named "Combining …"; the diacritics
  ranges (Herculean/Olympian/Magrathean) are add-ons to another Sagittal sign.
- [Q] Parentheses and brackets are **separate glyphs** (E26A–E26D) plus optional ligatures.

### 3.5 Metrics relevant to accidentals

- [Q] `glyphsWithAnchors`: `cutOutNE`, `cutOutSE`, `cutOutSW`, `cutOutNW` — e.g. cutOutNE = *"The
  Cartesian coordinates in staff spaces of the bottom left corner of a nominal rectangle that
  intersects the top right corner of the glyph's bounding box. This rectangle, together with those in
  the other four corners of the glyph's bounding box, can be cut out to produce a more detailed
  bounding box (of abutting rectangles), useful for kerning or interlocking symbols such as
  accidentals."*
- [Q] `bbox-cut-outs.md`: *"when stacking accidentals to the left of a chord, accidentals are arranged
  into columns, where accidentals belonging to notes separated by a wide interval (normally a seventh
  or more) are aligned in the same column… it may be possible to interlock or kern those columns…
  the bounding boxes of the accidentals can overlap, provided it is only the cut-outs that overlap."*
  Coordinates are relative to the glyph origin, in staff spaces.
- [Q] `engravingDefaults` has **no accidental-specific key** (grep of `engravingdefaults.md` for
  "accidental": no hit). Accidental metrics come from `glyphBBoxes`, `glyphAdvanceWidths` and the
  cut-out anchors only.

---

## 4. MNX (the CG's successor format — JSON since 2023)

Sources: `docs/mnx-schema.json` on `main` of `w3c-cg/mnx` (fetched 2026-09-30),
https://w3c-cg.github.io/mnx/docs/mnx-reference/, and the issue threads (GitHub API).

### 4.1 Current model

- [Q] `pitch` = `{ step: "A".."G" (required), octave: integer (required), alter: integer (optional) }`.
  The schema's `alter` def is `{"type": "integer"}` — **no decimals, so no microtones today.**
- [Q] `note.pitch` is documented as *"The note's sounded pitch."* (MNX encodes concert pitch; the
  written spelling of a transposed part is derived via `part.transposition` =
  `{interval: {halfSteps, staffDistance}, keyFifthsFlipAt?, prefersWrittenPitches?}` plus
  `note.written.diatonicDelta` — *"the number of diatonic steps to add or remove to obtain the final
  written pitch… in case of a C-flat note that you want to write for the player as a B natural, you'd
  use "diatonicDelta": -1."*)
- [Q] `accidentalDisplay` = `{ show: boolean (required), force?: boolean, enclosure?: { symbol:
  "parentheses" | "brackets" } }`.
  - `force`: *"Whether this accidental display value (either shown or hidden) was set intentionally,
    as opposed to automatically determined. This allows for the encoding of intent."*
  - `enclosure`: *"Describes the symbol that visually encloses the accidental… If this data isn't
    specified, the accidental is assumed not to have a visual enclosure."*
  - There is **no glyph / sign field**: which sign is drawn is derived from `alter`. [I] So ♯♯ vs 𝄪,
    ♮♯, or any alternative quarter-tone design cannot be expressed.
- [Q] Top-level `support.useAccidentalDisplay`: *"Does every note with a visible accidental have
  accidentalDisplay set?"* — if true, a note without `accidentalDisplay` means `{show:false}`; if
  false, the consumer uses its own algorithm.
- [Q] `key` = `{ fifths: integer, color? }` only — no non-traditional key signature.
- [Q] No tuning, temperament or cents anywhere in the schema (167 defs checked by name).
  `sound` = `{name, midiNumber}`.

### 4.2 History and arguments (chronological)

| issue | state | what was argued |
|---|---|---|
| **#8** "Rational numbers should be permitted in pitch encodings" (2017) | open | Berkovitz: ratios relative to a reference pitch (`C4*4/3`) for JI. cecilios: reals suffice, *"I would prefer not to allow ratios or other arithmetic expressions, as this complicates parsers."* |
| **#19** "Allow pitch encodings to employ cents or decimal semitones" (2017) | open | `C4+4.98…` vs cents; *"allowing only one type of units in the standard"*. notator (2019): keep a separate optional `sounding` attribute — *"The frequency information can't be located in the (graphic) pitch information since it depends on external state information (the parser's current key, transposition and measure state)."* |
| **#20** "Define scale temperament for performance purposes" (2017) | open | Berkovitz: *"An attribute of the score or of a part could define, for performance purposes, the specific tunings assigned to pitches or pitch classes, so that these do not need to be expressed as ad hoc pitch encodings across the board for each note."* Counter-position (mogenslundholm): *"Selecting a temperament should be part of the notation program and not in MNX. MNX can set every temperament by the already defined alter values."* |
| **#142** "Freely specifying the key" (2018) | open | MusicXML's `key-step`/`key-alter`/`key-accidental` wanted in MNX; *"make it clear that the accidental defines the written accidental, while the pitch-alter value affects the sounding pitch."* clnoel: `<key-step step="B" accidental="quarter-flat" alteration="-.5"/>` — *"Accidental would indicate the symbol/appearance, possibly with a SMuFL code, and alteration would define the change to the sounding pitch."* |
| **#153 / #180 / #181** (2015–2019, closed 2024) | closed | "absence = no accidental" is error-prone; need an explicit hidden/auto and a hint of intent → became `accidentalDisplay.show/force` + `support.useAccidentalDisplay`. |
| **#176 / #184** "§5.4 Chromatic Pitch Syntax" / "The note element (accidentals)" (2020) | closed 2024 as "very outdated — it deals with the older XML version" | The richest microtonal thread. notator proposed optional `accidentalGlyph` + `cents` (later `frequency`) attributes that **override** the defaults implied by `pitch`. cmloegcmluin (Sagittal): *"there's one major issue that this proposal does not address: multiple accidentals… Sagittal's Prime Factor notation, EHEJIPN, and Ben Johnston's notation all call for potentially multiple accidentals per notehead."* x31eq (author of LilyPond microtonal extensions) proposed `<note pitch="G" nominal-frequency="391.111" frequency="386.270"><accidental cents="-21.506" glyph="U+E303" ratio="80:81">b4</accidental></note>` — accidental as a child element with its own glyph + cents/ratio. notator's conclusion: *"I can't see any way to ensure that applications perform Sagittal notation correctly (with or without a frequency attribute)"*; absolute `frequency` preferred over relative `cents`. Also the scoping decision: *"This CG has decided first to develop an MNX format that describes 'basic CWMN'"* — microtones deferred as "advanced". |
| **#288** "Changing `<note>` "accidental" attribute to remove redundancy" (2022) | closed 2023 | Holovaty: `<note pitch="G#4" accidental="sharp"/>` *"It's redundant, because the specific accidental is encoded in both pitch and accidental. It enables nonsensical/undefined behavior like `<note pitch="C4" accidental="sharp"/>`"* → value set changed from glyph names to presence/semantics → `accidentalDisplay`. **This is the moment MNX deliberately left architecture C (number + symbol) for architecture A (number; sign derived).** Cuthbert's counter-case: *"sometimes the editorial accidental is different from a notated accidental. (For instance, a number of composers up to 1800 would write flat to cancel out a sharp to natural)"*. |
| **#331** "Don't use a `cautionary` attribute for accidentals" (2024) | closed | lemzwerg: "cautionary" is ambiguous (plain / parenthesised / above the note) and breaks under transposition → Holovaty (2024-05-30): *"I changed accidentals to encode the literal symbol as opposed to their semantics… we'd err on the side of practicality here, rather than pure semantics. It's much more practical to simply encode the symbol."* (= the `enclosure` object; a `"reason"` key may come later). lemzwerg's objection stands: *"you completely loose the ability to get decent transposition with this simplistic solution"*. |
| **#347** `support.useAccidentalDisplay` (2024) | merged | Who bears the accidental algorithm — producer or consumer. |
| **#388** "There should be no limit on the values of the `pitch.alter` object." (2025-02) | **open, 0 comments** | rpatters1: *"I think the MNX spec should support EDOs other than 12-EDO… Finale's limit is +/-7 (which is also too small)… It seems wrong to force exporting programs to respell the music to comply with an arbitrary restriction."* |
| **#546** number vs integer types (2026-08) | closed | Doc generator now distinguishes int/float; BPM became float. *"Microtonality (MXL allows decimal in alter; but I know representation of microtonality in MNX still has various open issues)"* — `alter` was **not** changed. |

**State (2026-09-30) [I from the above]:** MNX today is the purest "number only" model in the
industry — integer semitone `alter`, no sign field, no glyph override, fifths-only keys, no tuning.
The three 2017 issues that would add microtones (#8 ratios, #19 cents/decimals, #20 score-level
temperament) are still open and untouched since 2021; #388 is open with no replies. The group has
twice chosen the *literal symbol* over semantics for display (`enclosure`), but has not applied that
to the accidental sign itself.

---

## 5. The sound layer — tuning standards

| format | what it expresses | what it does NOT express |
|---|---|---|
| **Scala `.scl`** | [Q] One scale per file: description line, *"the number of notes"*, then one pitch per line *"either as a ratio or as a value in cents. If the value contains a period, it is a cents value, otherwise a ratio."* *"The first note of 1/1 or 0.0 cents is implicit and not in the files."* The last line is the period ("formal octave"). Archive of "over 4000 scales". (https://www.huygens-fokker.org/scala/scl_format.html) | No reference frequency, no key mapping, **no note names, no notation**. Degrees are anonymous integers 0..n. |
| **Scala `.kbm`** | [Q] Keyboard mapping: map size, first/last MIDI note to retune, *"Middle note where the first entry of the mapping is mapped to"*, *"Reference note for which frequency is given"*, the frequency, *"Scale degree to consider as formal octave"*, then the list of scale degrees per key (`x` = unmapped). (Scala help) | Maps **MIDI keys** → degrees. Nothing about staff positions or accidentals. |
| **Scala the program** (not the file) | [Q] Has "notation systems" (`SET NOTATION`, `%note(pitch,notation-system)`, Sagittal forms) that name scale degrees. | Not carried in `.scl`/`.kbm`. |
| **Ableton `.ascl`** | [Q] *"an Ableton-specific extension to the SCL file format… all Ableton-specific extensions are stored in SCL comments"*: `@ABL REFERENCE_PITCH 4 9 440.0` (octave, note index, Hz), **`@ABL NOTE_NAMES C C♯/D♭ D …`** (*"a sequence of note names for every note pitch in the tuning system"*), `NOTE_RANGE_BY_FREQUENCY/INDEX`. (help.ableton.com ASCL Specification) | Names are **labels per degree** — free strings, one per degree; enharmonics squeezed into one slot ("C♯/D♭"). Not a function from (step, accidental). |
| **AnaMark `.tun`** v2 | [Q] `[Tuning]`: `note x = integer` cents for each MIDI note 0–127 (*"No keyboard mapping supported here!"*), relative to 8.1757989… Hz; `[Exact Tuning]`: `BaseFreq` + real-valued cents per note with auto-completion for periodic scales; `[Functional Tuning]`: formulas. (mark-henning.de Tuning_File_V2_Doc.pdf) | Pure MIDI-note → frequency table. No names. |
| **MIDI Tuning Standard (MTS)** | [Q] Frequency = 3 bytes: semitone + 14-bit fraction, *"Effective resolution = 100 cents / 2^14 = .0061 cents"*. Messages: Bulk Tuning Dump Request / Bulk Tuning Dump (all 128 keys), **Single Note Tuning Change (real-time)**, bank variants (Key-Based Tuning Dump, Single Note Tuning Change with bank, real-time and non-real-time), **Scale/Octave Tuning** 1-byte form (12 bytes C…B, *"00H means -64 cents… 7FH means +63 cents"*) and 2-byte form (*"-100 cents… +100 cents (8,191 steps of .012207 cents)"*), each real-time / non-real-time, plus dumps. *"Scale/Octave Tuning is micro-tuning that is automatically repeated in every octave"*. (MIDI Tuning, updated spec; copy at musescore.org/sites/musescore.org/files/2018-06/midituning.pdf) | MIDI key number → frequency. Scale/octave form has only **12 slots per octave**, so G♯ and A♭ cannot differ — it cannot even carry meantone *spelling*. |
| **MTS-ESP** (ODDSound) | [Q client header] A master plug-in serves a tuning to clients in a DAW session: `MTS_NoteToFrequency(client, midinote, midichannel)`, `MTS_RetuningInSemitones`, `MTS_RetuningAsRatio`, `MTS_ShouldFilterNote`, `MTS_FrequencyToNote[AndChannel]`, `MTS_GetScaleName`, `MTS_GetPeriodRatio`, `MTS_GetMapSize/StartKey/RefKey`; optional multi-channel tables. | (MIDI note, channel) → frequency. A scale *name* string, no note names. |
| **MIDI 1.0 pitch bend** | Channel message. [Q by contrast, UMP spec §4.2.12]: *"The MIDI 2.0 Per-Note Pitch Bend message acts like Pitch Bend in every way, except that it applies to individual Note Numbers."* → in MIDI 1.0 one bend value per channel. | **One detune per channel**: a chord with two differently-detuned notes needs two channels. |
| **MPE** | [Q Wikipedia "MIDI"] *"MPE works by assigning each note to its own MIDI channel so that controller messages can be applied to each note individually."* | Still channel-per-note rotation (≤15 voices per zone). MPE spec text itself not fetched — UNKNOWN beyond this summary. |
| **MIDI 2.0** (UMP, M2-104-UM v1.0 §4.2.12–4.2.14) | [Q] Per-Note Pitch Bend (32-bit); **Registered Per-Note Controller #3 "Pitch 7.25"** — *"a Q7.25 fixed-point unsigned integer that specifies a pitch in semitones"*, persistent, *"can be used to define a complete tuning table for any and all 128 Note Numbers"*; **Note On attribute #3 "Pitch 7.9"** — *"When using this Attribute Type, the Note Number should be treated as a note index only; it does not imply any scale or pitch"*, resolution 1/512 semitone ≈ 0.2 cents, valid for that one note. Priority order is specified (MTS < RPNC #3 < Note-On attribute; bends are offsets). | Absolute pitch per note — everything a player needs, nothing a *reader* needs. |

**How notation programs push microtones out [Q from the docs read]:**
- MusicXML tutorial: decimal `alter`, *"but not all programs may convert this into MIDI pitch-bend data."*
- Dorico: *"For HALion virtual instruments, Dorico Pro uses VST 3 Note Expression. For all other
  instruments, including NotePerformer, Dorico Pro uses the VST 2 detune parameter."*
- Sibelius: a plug-in inserts MIDI pitch bend (see §6.2).
- Mus2 advertises its own sampler precisely to avoid *"the polyphony (number of simultaneous notes)
  limitation commonly found in other MIDI-based microtonal solutions"*.

**What is missing between a score and any of these [I]:** every tuning format above is a function
**degree-index (or MIDI key) → frequency**. None takes `(step, accidental sign(s), octave)`. So a
notation program must own a second table — **`(step, accidental stack) → degree index`** (EDO-style,
which is Dorico's and Finale's table) **or `→ ratio/cents` directly** (MEI #1167's `intervalMap`) —
plus a reference (which written pitch = which Hz). Only ASCL's `NOTE_NAMES` and Scala-the-program's
notation systems gesture at the reverse mapping, as display labels. That table is per tuning *and*
per notation system (the same 53-EDO can be written AEU, Turkish-folk, or Sagittal).

---

## 6. Commercial programs — documented models

### 6.1 Dorico (Steinberg) — "tonality systems"

Sources: archive.steinberg.help/dorico_pro/v5/en/dorico/topics/… (pages named below), the Dorico blog.

**The model, as far as the docs reveal it [Q]:**

- *"The term "tonality system" is used in Dorico Pro to encompass three crucial elements… A number
  of equal divisions of the octave, or EDO… A set of accidentals. This allows you to notate how much
  a note is raised or lowered… A key signature."* (`notation_reference_tonality_systems_c.html`)
- Defaults shipped in every project: *"Equal temperament (12-EDO)"*, *"Equal temperament (24-EDO,
  Gould arrows)"*, *"Equal temperament (24-EDO, Stein-Zimmermann)"*. [I] Note the last two: **same
  EDO, different accidental set = a different tonality system.** Notation system and tuning are
  bundled into one object.
- **Divisions are given per interval between adjacent naturals**, not as one number: *"In the
  Divisions section of the Edit Tonality System dialog, you can change the number of divisions
  assigned to each interval. The total number of divisions of an octave… is updated automatically…
  In Equal temperament, or 12-EDO, the total number of divisions is 12. There are 2 divisions between
  A and B, 1 division between B and C, and so on."* Turkish example: *"53-EDO, the division of which
  is usually spread across the notes A-A with the following number of divisions for each interval:
  9-4-9-9-9-4-9."* (`…_custom_octave_divisions_r.html`, `…_edo_c.html`)
- **An accidental** (Edit Accidental dialog) has: **Name**; **Pitch delta** — *"Allows you to set a
  value for how much the accidental raises/lowers the pitch of notes. For example, in 12-EDO, a pitch
  delta of 1 raises notes by a half-step (semitone)."* (an integer count of divisions), *"We do not
  recommend setting pitch deltas that are more than half of the total number of octave divisions"*;
  and a **composite drawing**: components of three kinds — **Glyph** (*"You can search using SMuFL or
  Unicode ranges"*, any font), **Text** (*"including numbers and other text"*), **Graphic** (SVG/PNG/
  JPG) — each with Offset X/Y, Scale, Z order, Color; **Attachments** between components (8 attachment
  points for glyphs/graphics, 11 for text); and **Cut-outs** per corner (*"mark individual corners
  within an accidental component that can overlap with other accidentals; for example, in order to
  position accidentals closer together in dense chords"* — Width/Height per NE/SE/SW/NW, i.e. SMuFL's
  cut-out model made user-editable).
- The accidental list is shown *"from lowest pitch delta at the top to highest pitch delta at the
  bottom"*. *"New custom tonality systems start with a natural accidental, which you can edit or
  delete."* *"You cannot change the pitch delta when editing the default accidentals in the default
  12-EDO and 24-EDO tonality systems."*
- **Custom key signatures** belong to the tonality system (Edit Custom Key Signature dialog): Name,
  **Root**, accidentals picked *from the tonality system*, order, and per-accidental Note and Octave
  position, shown in treble/bass/alto/tenor. Constraint: *"the number of equal divisions in the octave
  must be divisible by 12 to be able to show a standard Western key signature."*
- **Scope — positional, attached to a key signature:** *"You can change the tonality system used in
  your project at key signature changes"*; *"The tonality system is changed from the key signature
  you input until the next key signature with a tonality system change or the end of the flow."*
  *"If you do not want to show a key signature, you can input an atonal key signature."* Key
  signatures can be input for a single staff (Alt/Opt+Enter — Dorico blog tip / help "Inputting key
  signatures"). **[I]** therefore a tonality system can differ per staff and changes mid-flow; it is
  score content carried by the key-signature item, not a project setting.
- *"Each project can contain multiple custom tonality systems."* Export/import as `.doricolib`;
  "Save As Default" to the user library.
- **Playback derives from it:** *"Dorico Pro achieves full microtonal playback by calculating the
  appropriate pitch delta for every note, whether or not it is written with an accidental."*
- **Transposition:** Transpose dialog works *"according to an interval and quality or by a set number
  of octave divisions"*; *"The Transpose dialog does not allow transpositions that would result in
  impossible notations, such as sharper than a triple sharp, or that require a microtonal accidental
  that does not exist in the tonality system in p[lace]…"*; *"You can only use Respell to avoid
  double and triple sharps and flats when transposing music in tonality systems that are compatible
  with 12-EDO."* Blog (1.0.10): *"transpose by number of divisions in the octave… works both for
  12-EDO and for extended tonality systems… possible divisions ranging from -6/12 to +0/12"*.
- **Design intent, 2013** (Dorico dev diary part 4): *"allowing you to define a tuning system – in
  terms of into how many equal divisions an octave should be divided, and how many and which of those
  divisions should be given a specific accidental symbol – and a set of keys or modes using that
  tuning system – in terms of which accidentals should be included in the key signature, if any, and
  how transposition should work."* Spreadbury (comment, 2013-11-07): *"Our application's
  understanding of pitch is flexible enough to allow any number of equal divisions of the octave."*

**Limits:**
- [Q] Only equal divisions are described anywhere in the docs read; a pitch delta is a count of
  divisions. In the 2013 blog comments users asked for JI / non-equal temperaments / "MIDIfloat"
  (Torsten Anders: *"arbitrary equal divisions are a great plus, but they are also limited… just
  intonation has an infinite number of pitches per octave"*; suggested workaround *"by using
  1200-tone equal temperament you reach cent resolution"*). **[I]** No ratio/cents accidental exists
  in the documented model; true JI is only approximated by a large EDO.
- **UNKNOWN — what is stored per note.** The docs do not say. My inference, NOT confirmed: a note
  must reference the *accidental* (identity), not merely a delta, because the shipped Gould-arrow
  set needs two different signs with the same delta (SMuFL's Gould range has two glyphs both
  described "Quarter-tone sharp") and because the accidental's name/drawing is per tonality system.
  Whether the file stores `(note name, octave, accidental id)` or `(note name, octave, delta)` +
  lookup is UNKNOWN. Tried: v5 help pages for tonality systems / accidentals / transpose, the Dorico
  blog dev diaries, one forum search.
- UNKNOWN — whether two accidentals in one tonality system may share a pitch delta (implied by the
  Gould set, not stated).
- UNKNOWN — the accidental *cancellation* rule inside custom systems (does every accidental need an
  explicit "natural"?). Docs only say a new system starts with a natural.

### 6.2 Sibelius (brief)

- [secondary source — Robert Puff, "Sibelius Quick Tip: Quarter-tone playback", rpmseattle.com/of_note]
  Fixed set of accidentals incl. quarter-tones on the 6th Keypad layout; *they do not play back* —
  a three-quarter-sharp sounds as the nearest chromatic pitch until the shipped plug-in
  "Quarter-tone Playback" inserts MIDI pitch-bend messages.
- **[I]** architecture B (symbol enum) with sound bolted on afterwards by a plug-in; inherits the
  one-bend-per-channel limit.
- UNKNOWN — the exact wording of Avid's own Reference Guide (not fetched; only the secondary source
  and forum threads were found).

### 6.3 Finale — nonstandard key signatures (the classic 24/31/53-EDO route)

Sources: usermanuals.finalemusic.com/FinaleWin/Content/Finale/ `KENONDLG.htm`, `KEKEYDLG.htm`,
`KEAOADLG.htm`, `KEATTDLG.htm` (Finale is discontinued since 2024 but the manual is online).
(`KEOCTDLG.htm`, `Nonstandard_key_signatures.htm`, `Quarter-tone.htm` returned 403 — not read.)

[Q] *"you can create your own key signatures in any format, based on scales with any number of
chromatic steps between one note and the next… up to 128 linear key formats (systems of related key
signatures) or nonlinear key signatures… per document."* A **key format** is defined by five tables:

1. **KeyMap** (Key Step Map): *"how many notes will constitute an octave… You also specify how many
   of these are "diatonic" (seven in the traditional system), and where the "chromatic" steps occur
   in the scale."* **Total Steps** (*"up to 100"*), **Diatonic Steps**, and a row of squares marking
   which steps are "white keys". *"If you've established a quarter-tone key system… Finale now
   thinks that the first four notes on your keyboard are C, C-quarter-sharp, C-sharp, and
   C-three-quarter-sharp."* — i.e. an EDO with a per-interval division pattern, **the same shape as
   Dorico's Divisions**.
2. **AOrdAmt** (Accidental Order and Amount): per Unit (each accidental of the key signature): **Step
   Level** (diatonic degree from C) and **Amount** — *"the "amount" (interval) by which the pitch…
   is to be altered, in chromatic steps (not necessarily half steps)… in a quarter-tone scale… the
   Amount for a "normal" sharp or flat in the key signature is always 2 or negative 2"*.
3. **ToneCnts**: the tone centre (root) for each number of accidentals.
4. **ClefOrd**: octave placement of each key-signature accidental per clef.
5. **Attributes** (Special Key Signature Attributes): **Harmonic Reference**, **Middle Key Number**
   (MIDI key of the reference), **Symbol Font**, **Symbol List ID** — *"an array of accidental
   Amounts (where one sharp has an Amount of 1, one flat has an Amount of –1, and so on) and
   corresponding characters you want to appear in the key signature to represent them"* — and **Go
   to Key Unit** (how many scale steps between adjacent MIDI keys; *"If your synthesizer can produce
   quarter tones, however, leave the Key Unit at 1"*).

Linear vs nonlinear: a linear format is a *system* of keys generated by adding accidentals in order
(needs an odd number of diatonic steps and identical tetrachord halves); a nonlinear key signature is
one fixed signature. *"you may get unexpected results when you transpose or add chord symbols to
music in such a key system"* if the rules are not met.

**Per-note storage** [Q from the third-party musx-dom documentation of Finale's file format,
`~/dev/engine-sources/musxdom/src/musx/dom/Entries.h` — not MakeMusic's own doc]: `harmLev` —
*"Diatonic displacement relative to middle C or to the tonic in the middle C octave"*; `harmAlt` —
*"Chromatic alteration relative to the key signature. Never has a magnitude greater than +/-7."*
→ a note is **(diatonic step, integer alteration in key-map steps)**; the glyph is looked up
`amount → character(s)` in the key format's symbol list. Confirms MNX #388: *"Finale's limit is
+/-7"*.

**[I]** Model = architecture D, integer-only: the tuning (EDO + step pattern), the symbol table
(amount → font characters) and the key-signature generator are all hung on the *key signature*.
Consequences: exactly one glyph string per amount (no two signs for one amount — no Gould-vs-Stein
choice within a key format, no cautionary variant distinct by meaning); playback needs a synth that
actually has N keys per octave or Go-To-Key-Unit tricks; alteration capped at ±7 steps.

### 6.4 MuseScore 4 (docs only, brief)

[Q handbook "Properties" text reached via musescore.org/en/handbook/3/tuning-systems-microtonal-notation-system-and-playback, which now redirects to the MS4 properties page]
*"Tuning — Used to adjust the tuning of notes in cents. Only notes have the Tuning property."*
[secondary — search-result summary of the MS3 handbook page, not re-read in full] microtonal
accidental symbols are engraving-only and do not change playback; per-note cent tuning or a plug-in
does. **[I]** = sign enum + a separate free cents number per note (C/E hybrid). Source-level detail
is `docs/research/alteration-signs-engines-research.md`'s.

### 6.5 LilyPond (docs only, brief)

[Q NR 1.1.1 "Note names in other languages"] *"Some music uses microtones whose alterations are
fractions of a 'normal' sharp or flat."* — suffixes for semi-/sesqui- sharp/flat per language
(`ih`/`eh`/`isih`/`eseh`; English `qs`/`qf`/`tqs`/`tqf`). [Q NR 1.1.3 "Alternate accidental glyphs"]
*"The glyphs are controlled through the alterationGlyphs property of the Staff context… The property
may also be set to a custom associative list mapping alterations to glyph names. Alterations are
given as fractions in tones."* e.g. `((-1/2 . "accidentals.flat.arrowdown") (0 .
"accidentals.natural.arrowup") (1/2 . "accidentals.sharp.arrowup"))`. [Q] *"There are no generally
accepted standards for denoting quarter tone accidentals, so LilyPond's symbols do not conform to any
standard."* **[I]** = architecture A with a per-staff-context `alteration → glyph` table: the NUMBER
is the content and the sign is a view — one glyph per alteration value.

### 6.6 Mus2

[Q mus2.com.tr/en/explore] *"you have complete freedom to define what pitches the lines and spaces of
a staff represent–in absolute frequencies or in cents and as rationals, relative to the first pitch
of a scale. Moreover, a scale can have any number of pitches."* / *"Import symbols from vector
graphics and music fonts into Mus2 to create your own accidentals. Not only can you easily adjust
the layout and musical meaning of these symbols, you can also use them with notes and in key
signatures just like any other accidental. For a quick start, Mus2 comes with quarter tone symbols
and accidentals used in Turkish classical and folk music."* / sampler without *"the polyphony…
limitation commonly found in other MIDI-based microtonal solutions"*. Wikipedia/HandWiki: *"its own
file formats for storing scores, tunings and accidentals"*.
**[I]** the closest product to architecture E: tuning = a free list of pitches (Hz / cents /
ratios) assigned to staff positions; accidentals = user glyphs with a user "musical meaning".
UNKNOWN — the actual data model (is an accidental's meaning a cents offset, or a step count in the
tuning?), the file formats, and how tuning/accidental files bind to a score. Only the vendor's
feature page was reachable.

### 6.7 NoteAbility

**UNKNOWN.** One targeted search returned nothing about its pitch/accidental model.

---

## 7. Cross-cutting — the architectures

"Breaks" rows are **my analysis [I]** unless a source is named.

| | architecture | who | transposition | key signatures | accidental state / cancellation | playback | interchange |
|---|---|---|---|---|---|---|---|
| **A** | **Number only** — alteration is a number; the sign is derived | **MNX** (integer `alter`; `accidentalDisplay` = show / force / enclosure only). **LilyPond** (rational alteration + per-staff `alterationGlyphs` table). Our current `PitchAlter`. | Best case: spelling arithmetic on numbers. | Fifths arithmetic. MNX: `fifths` only. | Simple: compare numbers. | Trivial in 12-EDO — and **wrong outside it**, because the number is already a tuning (a ♯ = +1 semitone). | Compact; **cannot say which sign**: 𝄪 vs ♯♯, ♮♯ vs ♯, Stein vs Gould quarter-sharp, a flat used as a natural (Cuthbert, mnx #288). LilyPond's table fixes that per staff but still one glyph per number. |
| **B** | **Symbol enum only** | **Sibelius** (fixed sign set; quarter-tones mute until a plug-in adds bend). | Needs a rule per symbol ("what is a quarter-sharp up a minor third?") — a lookup table, not arithmetic. | Only with built-in sets. | Needs an "is this the same as what is in force" rule per symbol pair. | None intrinsic; needs an interpreter — which is the point, but in Sibelius it is a post-hoc plug-in. | Closed vocabulary: anything outside the enum is lost. |
| **C** | **Number + symbol side by side, free to disagree** | **MusicXML** (`alter` decimal ‖ `accidental` enum[41] + `smufl`). **MEI** (`@accid` written[36] ‖ `@accid.ges` gestural[23] ‖ `@glyph.name`/`@altsym`). **MuseScore** (sign ‖ per-note tuning cents, per docs). MNX before 2022. | Two things to transpose; importers trust one and recompute the other, differently. | MusicXML non-traditional key duplicates the pair (`key-alter` ‖ `key-accidental`). | Ambiguous which side defines "in force". MusicXML's "absent `<accidental>` = no sign" is *"one of the more error-prone decisions"* (Good, mnx #153). | Works **only if the exporter baked the tuning into every note's number** (SymbTr: `-0.41509434`). Change the tuning ⇒ rewrite every note. MEI's gestural side is an enum, so it cannot carry a tuning at all. | The proven interchange shape — and the proven failure: `<note pitch="C4" accidental="sharp"/>` *"nonsensical/undefined behavior"* (Holovaty, mnx #288); makam files un-openable correctly in Finale/MuseScore (mnx #180). |
| **D** | **Symbol + a tuning/notation table in the document** that maps symbols to steps | **Dorico** tonality system (EDO divisions per interval + accidentals{name, delta, composite drawing} + key signatures; scoped from a key signature onward). **Finale** key formats (KeyMap + AOrdAmt + symbol list `amount → characters`; note = `harmLev` + `harmAlt`). **MEI #1167 proposal** (`temperamentDef`: `(pname, accid) → ratio | cents`). | Defined inside one system (Dorico: by interval quality *or* by N divisions; refuses results whose accidental *"does not exist in the tonality system"*; Respell only when 12-EDO-compatible). Across systems: undefined. | First-class: custom signatures are built from the system's own accidentals (Dorico root + ordered accidentals with note/octave; Finale Unit/Step Level/Amount). | Defined by the table (delta 0 = natural). Finale: exactly one sign per amount. | Derived, never stored: *"calculating the appropriate pitch delta for every note, whether or not it is written with an accidental"* (Dorico). EDO-only in both products; JI only by a huge EDO. | **No standard carries the table.** MusicXML export flattens D to C (decimal `alter` + `smufl` name). `.doricolib` and Finale libraries are proprietary. |
| **E** | **Free glyph + free cents/ratio/frequency per note or per accidental** | **Mus2** (per vendor page). **MNX #184 proposals** (`accidentalGlyph` + `cents`/`frequency`; x31eq's `<accidental cents glyph ratio>`). MusicXML `other` + `smufl` + decimal `alter` used this way. | Nothing to compute with: a glyph has no algebra. | Only as a drawn list. | No rule can be derived; every case is explicit. | Exact and unconstrained (JI, non-octave). | Everything is expressible; nothing is *understood* — *"I can't see any way to ensure that applications perform Sagittal notation correctly"* (notator, mnx #184). |

**Where his framing sits [I]:** "the SYMBOL is score content; the tuning is a separate layer
that interprets it" is **D with the table moved out of the score** — B for the content plus an
external interpreter. No shipping standard does exactly that: Dorico/Finale keep the table *in* the
document bound to a key signature, and bundle two things the framing separates — **the notation
system** (which signs exist, what each is called, how it is drawn, what cancels what) and **the
tuning** (what each sign is worth). Dorico's two 24-EDO systems (Gould / Stein-Zimmermann) show they
are separable: same tuning, different sign set. MEI #1167 is converging on the separated form
(`accid` values or document-declared `accidDef`s in the music; a `temperament` table keyed by
`(pname, accid…)` referenced from staffDef/scoreDef).

**Things the sources show a symbol-first model must still decide [I]:**
1. **What a symbol is called** when it is not in a fixed enum. Options on the table: SMuFL glyph name
   as the identity (MusicXML `smufl=`, infojunkie, lpugin) vs a semantic id with the glyph as a
   *view* (ahankinson; Dorico's named accidental with a drawing). SMuFL itself has duplicates of one
   meaning and one glyph with many meanings (§3.3), which argues against glyph = identity.
2. **Stack or atom.** Johnston / HEJI / mixed Sagittal put several signs on one note. Each sign's
   value is constant but is added to a *Pythagorean* nominal, not a 12-TET one (infojunkie, MEI
   #1167, §2.8) — so "cents from 12-TET per sign" is wrong, and the steps need their own tuning.
   Dorico makes the stack one named accidental with N components; MEI and MusicXML 4.1 make it N
   accidental elements.
3. **What transposition and cancellation read.** Both need *some* ordering/size of symbols without a
   tuning — Dorico's "pitch delta in divisions" is exactly that ordinal, and it is why its
   accidentals carry a number even though the score is symbol-first.
4. **Key signatures** must be lists of (position, symbol), not a fifths number (MusicXML
   non-traditional key, MEI `keyAccid`, Dorico custom key signature, Finale AOrdAmt all agree).

### 7.1 Which standards let one note carry more than one accidental glyph

| | multiple signs on one note? |
|---|---|
| **MEI 5** | **Yes** [Q]: `<accid>` child elements — *"or when multiple accidentals occur on a single note"*. |
| **MusicXML 4.0** | **No** [Q]: `<accidental minOccurs="0">` (max 1). Workarounds: enum values that are already two signs (`natural-sharp`, `natural-flat`, `sharp-sharp`), or `other` + a SMuFL *ligature* name. `<accidental-mark>` is for marks above/below notes and in ornaments, not the note's own sign. |
| **MusicXML 4.1 (dev, unreleased)** | **Yes** [Q]: `maxOccurs="unbounded"` on `accidental` and `key-accidental`, displayed *"left to right"* in document order (PR #682, merged 2026-08-07). |
| **MNX** | **No** [Q]: no sign at all; one `accidentalDisplay`. Asked for in #184 (closed as outdated). |
| **SMuFL** | Glyph level: **designed for it** [Q] — Johnston (*"intended for combining with the standard 12-EDO accidentals"*), mixed Sagittal (Sagittal + standard sign), HEJI "combining" glyphs, Sagittal diacritics, and parentheses/brackets as separate glyphs + ligatures. |
| **Dorico** | One accidental per note, but the accidental is itself a **composite of N components** (glyph/text/graphic) with attachments [Q]. |
| **Finale** | One `amount → characters` entry per key format [Q: "corresponding characters"]; whether an entry may hold several characters is UNKNOWN (Symbol List dialog page not fetched). |
| **LilyPond** | One glyph name per alteration in `alterationGlyphs` [Q docs]; beyond that → the engines file. |

---

## 8. UNKNOWN / not verified — consolidated

1. **Dorico — what a note stores** (accidental id vs delta; §6.1). Docs silent. Tried: v5 help
   (tonality systems, accidentals, Edit Accidental, Edit Tonality System, custom key signatures,
   transpose, playback), Dorico blog dev diaries 2013/2016, one forum search.
2. **Dorico — may two accidentals share a delta; cancellation rules in custom systems; non-EDO/JI.**
   Docs describe only EDO division counts; "no ratios" is inferred from absence, not stated.
3. **Dorico — tonality system per staff**: inferred from "changes at key signatures" + single-staff
   key signatures; no sentence states it outright.
4. **Sibelius** — Avid's own reference text not fetched; model described from a secondary source.
5. **Finale** — Symbol List dialog, Accidental Octave Placement and the tutorial pages returned 403.
   Per-note fields come from third-party format documentation (musx-dom), not MakeMusic.
6. **Mus2** — data model and file formats; only the vendor feature page was reachable.
7. **NoteAbility** — nothing found.
8. **MPE** — the RP-053 spec text not fetched (Wikipedia's one-line description only). MIDI 1.0 pitch
   bend's channel scope is quoted indirectly via the MIDI 2.0 spec's contrast sentence.
9. **MEI Guidelines** — there is no dedicated prose on `accid` vs `accid.ges` in v5.1 (grep, §2.7);
   if an older Guidelines version had such a passage, I did not look.
10. **MEI #1167** — several mid-thread comments (2023-05 … 2026-06-08) were read only to their first
    1300 characters; the last one (2026-06-09) was read in full. Read the thread before relying on
    a detail of the proposed element names — they were still changing.
11. **MusicXML 4.1** — unreleased; the multiple-accidentals change is in the dev schema only.
12. **MuseScore handbook** — the MS3 microtonal page now redirects; the "symbols don't affect
    playback" statement comes from a search-result summary, not a page I read in full.
13. **SMuFL 1.5** — `gh-pages` metadata is ahead of 1.4; I did not diff beyond range/class counts.

## 9. Source index

- MusicXML 4.0 XSD — https://raw.githubusercontent.com/w3c/musicxml/v4.0/schema/musicxml.xsd
- MusicXML 4.0 reference — https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/alter/ ·
  …/elements/accidental/ · …/tutorial/midi-compatible-part/ · …/tutorial/notation-basics/
- MusicXML dev schema (4.1) — https://raw.githubusercontent.com/w3c-cg/musicxml/gh-pages/schema/musicxml.xsd
- MusicXML issues — https://github.com/w3c-cg/musicxml/issues/605 · /pull/682 · /issues/263
- MEI v5.1 source — https://github.com/music-encoding/music-encoding/tree/v5.1/source/modules ·
  …/source/docs
- MEI issue — https://github.com/music-encoding/music-encoding/issues/1167
- SMuFL 1.4 — https://www.w3.org/2021/03/smufl14/ ·
  https://raw.githubusercontent.com/w3c/smufl/v1.4/metadata/{ranges,classes,glyphnames}.json ·
  https://github.com/w3c-cg/smufl/tree/v1.4/markdown/specification
- MNX — https://raw.githubusercontent.com/w3c-cg/mnx/main/docs/mnx-schema.json ·
  https://w3c-cg.github.io/mnx/docs/mnx-reference/objects/{pitch,note,accidental-display,support,written}/ ·
  https://github.com/w3c-cg/mnx/issues/{8,19,20,142,153,176,180,181,184,288,331,388,546} · /pull/347
- Scala — https://www.huygens-fokker.org/scala/scl_format.html · https://www.huygens-fokker.org/scala/help.htm
- ASCL — https://help.ableton.com/hc/en-us/articles/10998372840220-ASCL-Specification (read through
  the help-centre JSON API; the HTML page returns 403 to scripts)
- AnaMark .tun — https://www.mark-henning.de/files/am/Tuning_File_V2_Doc.pdf
- MIDI Tuning (updated spec, copy) — https://musescore.org/sites/musescore.org/files/2018-06/midituning.pdf
- MIDI 2.0 UMP — https://amei.or.jp/midistandardcommittee/MIDI2.0/MIDI2.0-DOCS/M2-104-UM_v1-0_UMP_and_MIDI_2-0_Protocol_Specification.pdf
- MTS-ESP — https://github.com/ODDSound/MTS-ESP (Client/libMTSClient.h)
- Dorico v5 help — https://archive.steinberg.help/dorico_pro/v5/en/dorico/topics/ +
  `notation_reference/notation_reference_tonality_systems/notation_reference_tonality_systems_{c,edo_c,changing_t}.html`,
  `library/library_tonality_systems_{custom_c,custom_creating_t,custom_octave_divisions_r,custom_playback_r,custom_accidentals_c,custom_key_signatures_c,edit_tonality_system_dialog_r,edit_accidental_dialog_r,edit_custom_key_signature_dialog_r}.html`,
  `write_mode/write_mode_transposing_tools/write_mode_transpose_dialog_r.html`,
  `write_mode/write_mode_notations_input/write_mode_key_signatures_tonality_systems_accidentals_panel_r.html`
- Dorico blog — https://blog.dorico.com/2013/11/development-diary-part-four/ ·
  https://blog.dorico.com/2016/11/dorico-1-0-10-update-released-with-over-200-improvements/ ·
  https://blog.dorico.com/2019/08/tip-create-time-and-key-signatures-on-a-single-staff/
- Finale manual — https://usermanuals.finalemusic.com/FinaleWin/Content/Finale/{KENONDLG,KEKEYDLG,KEAOADLG,KEATTDLG}.htm
- Finale file-format docs (third party) — `~/dev/engine-sources/musxdom/src/musx/dom/Entries.h`, `Others.h`
- LilyPond 2.24 NR — https://lilypond.org/doc/v2.24/Documentation/notation/writing-pitches ·
  …/displaying-pitches
- Mus2 — https://mus2.com.tr/en/explore/
- Sibelius (secondary) — https://www.rpmseattle.com/of_note/sibelius-quick-tip-quarter-tone-playback/
