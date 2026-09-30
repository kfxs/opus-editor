# Alteration signs in three engines' SOURCE — LilyPond, MuseScore, Verovio (MEI)

> **Findings only.** ⛔ Nothing here is a decision. What was concluded from it, and what he decided,
> is `docs/research/alteration-signs-research.md`; the standards and the commercial programs are
> `docs/research/alteration-signs-industry-research.md`.

**What this is:** how three engines model a note's pitch ALTERATION — what is stored, how far the
sign vocabulary goes, whether a user can add a sign, where a sign becomes a sounding pitch, how the
bar's accidental rule copes with more than five alterations, key signatures, transposition, and
several signs on one note. Researched 2026-09-30, for the design of a score model in which *the
symbol is score content and the tuning is a separate interpreter* (his framing, recorded in
`docs/how-it-works/tuning-systems-and-alteration.md`).

⚠️ **Read from source, not run.** The trees are the ones on disk in `~/dev/engine-sources`; no engine
was built, nothing was rendered. Every behavioural statement marked [INF] is derived from code paths.

**Checkouts studied** (from `git log -1`; the `.log` files beside them only say "Cloning into …"):

| engine | commit | date | version |
|---|---|---|---|
| LilyPond | `beedbfa0752ae51daede7cc4ff04a25a0c39683f` | 2026-08-03 | `VERSION`: 2.27.3 (dev; stable 2.26.0) |
| MuseScore | `929d1e99d729e273cb6466fed98e082339106b1a` | 2026-08-18 | master (MuseScore Studio) |
| Verovio | `efff0bc992416d6af3f616bd5745f18bc3bfe933` | 2026-08-18 | develop, after 6.2.0; MEI schema 6.0-dev `6da4dd5…` (`libmei/mei/mei-commit.txt`) |

**Evidence labels used below**
- **[SRC]** read in source at the cited path:line (paths relative to each engine's root).
- **[INF]** my inference from reading that source — NOT executed, NOT rendered. Nothing in this report was run.
- **[DOC]** the engine's own documentation on disk.
- **[WEB]** fetched from the web (only two items: Verovio option page, Ekmelily source).
- **UNKNOWN** = could not be found or confirmed; what was tried is stated.

---

## 0. The one-paragraph answer

The three engines sit at three different points:

- **LilyPond stores a NUMBER and derives the SIGN.** A pitch is `(octave, notename, rational alteration)`; the glyph is looked up *from the number* in a per-context alist. There is no symbol in the music at all. Sound is exact and free; the sign is a function of the sound. Two signs for the same sound, or one sign with two sounds, need fake numbers.
- **MuseScore stores a SIGN (a closed enum of 146) and hard-wires its SOUND.** Standard accidentals are *derived* from the tonal pitch class (`tpc`); everything else is a user-placed `Accidental` object whose enum value carries a fixed cent offset from a compiled-in table. There is no tuning object. 48 of the signs (the whole Helmholtz-Ellis set + 3 enharmonic signs) have neither a semitone value nor a cent offset and are graphics only.
- **MEI / Verovio stores a SIGN and, separately, optionally the SOUND** (`@accid` written vs `@accid.ges` gestural), and the sign can be an enum value **or** any SMuFL glyph (`@glyph.name` / `@glyph.num`). Verovio 6.1 added the only real **tuning interpreter** of the three: an external tuning file (Ableton `.ascl` = Scala + note names) whose note names are `letter + SMuFL glyph name(s)`, so *the same written symbol means a different frequency under a different tuning file*. That is structurally the design he describes.

---

## 1. LilyPond

### 1.1 Data model of a pitch alteration  (Q1)

**[SRC]** `lily/include/pitch.hh:27-47`

```cpp
/*
  A "tonal" pitch.  This is a pitch used in diatonal western music
  (24 quartertones in an octave), as opposed to a frequency in Hz or a
  integer number of semitones.
  Pitch is lexicographically ordered by (octave, notename, alteration).
*/
class Pitch : public Simple_smob<Pitch> {
  ...
  int octave_;
  int notename_;
  Rational alteration_;
  Scale *scale_;
```

- ONE field, a **rational number of whole tones** (`1/2` = sharp, `1/4` = quarter-sharp, `1` = double sharp). Constants: `lily/pitch.cc:292-296` (`FLAT_ALTERATION (-1, 2)`, `DOUBLE_SHARP_ALTERATION (1)`).
- There is **no symbol field**. "The written sign" does not exist in the music; it is computed at engraving time.
- `scale_` is not per-note data in practice: every `Pitch` constructor takes the session global — `lily/pitch.cc:34` `scale_ = unsmob<Scale> (Lily::default_global_scale);`.
- Sounding height is `scale_->tones_at_step (notename_, octave_) + alteration_` (`lily/pitch.cc:72-76`).
- A note event additionally carries two booleans that are about DISPLAY, not pitch: `force-accidental` (`!`) and `cautionary` (`?`) — read at `lily/accidental-engraver.cc:224` and `:233-236`.

**Sign derivation** — **[SRC]** `scm/output-lib.scm:1144-1156`

```scheme
(define-public (accidental-interface::calc-alteration grob)
  (ly:pitch-alteration (ly:event-property (event-cause grob) 'pitch)))

(define-public (accidental-interface::calc-glyph-name grob)
  (let* ((alteration (ly:grob-property grob 'alteration))
         (alist (ly:grob-property grob 'alteration-glyph-name-alist))
         (glyph (assv-ref alist alteration)))
    (or glyph
        (begin
          (ly:warning (G_ "no glyph name for alteration ~a in \
alteration-glyph-name-alist; try defining one in alterationGlyphs")
                      alteration)
          "noteheads.s1cross"))))
```

The `Accidental` grob's properties are `alteration` → `glyph-name` → `stencil`, each a callback of the previous (`scm/define-grobs.scm:35-55`). The alist is installed per context by `Alteration_glyph_engraver` from the context property `alterationGlyphs` (`scm/scheme-engravers.scm:1277-1285`; property doc `scm/define-context-properties.scm:63-65`: *"Alist mapping alterations to accidental glyphs. Alterations are given as exact numbers, e.g., -1/2 for flat. This applies to all grobs that can print accidentals."*), falling back to the paper default `ly/paper-defaults-init.ly:186-187`.

### 1.2 Built-in vocabulary  (Q2)

**[SRC]** `scm/output-lib.scm:1162-1175` — the default table has exactly **9** alterations:

```scheme
(define-public standard-alteration-glyph-name-alist
  '((0 . "accidentals.natural") (-1/2 . "accidentals.flat") (1/2 . "accidentals.sharp")
    (1 . "accidentals.doublesharp") (-1 . "accidentals.flatflat")
    (3/4 . "accidentals.sharp.slashslash.stemstemstem")
    (1/4 . "accidentals.sharp.slashslash.stem")
    (-1/4 . "accidentals.mirroredflat")
    (-3/4 . "accidentals.mirroredflat.flat")))
```

i.e. 5 standard + Stein-Zimmermann-style quarter tones. Other shipped tables:

| table | file:line | content |
|---|---|---|
| `makam-alteration-glyph-name-alist` / `makamGlyphs` | `scm/output-lib.scm:1181-1192`, `ly/makam.ly:144-160` | Turkish, alterations in **1/9 tone** (`KOMA 1/9`, `BAKIYE 4/9`, `KUCUK 5/9`, `BUYUKMUCENNEB 8/9`, `EKSIK-IKI 5/18`, `EKSIK-UC 6/18` — `ly/makam.ly:28-34`) |
| `turkishMakamGlyphs` | `ly/turkish-makam.ly:165-180` | Turkish again, but alterations redefined in **1/12 tone** (72-ET): `KOMA 1/12 % KOMA 1/9`, `BAKIYE 5/12 % 4/9`, `KUCUK 6/12 % 5/9` (`ly/turkish-makam.ly:27-33`) |
| `TwentyFourTETglyphs` | `ly/arabic.ly:126-138` | 24-TET, same numbers as the default, but `-1/4` → `accidentals.flat.slash` instead of the mirrored flat |
| `persianGlyphs` | `ly/persian.ly:128-140` | koron `-3/10`, sori `1/5`, plus tuning-only variants (below) |
| hufnagel / medicaea / vaticana / mensural / kievan | `scm/output-lib.scm:1194-1216` | ancient, 2–3 entries each |

Glyph inventory in the Emmentaler font **[SRC]** `mf/feta-sharps.mf`, `feta-flats.mf`, `feta-naturals.mf` (`fet_beginchar` lines; naming scheme documented at `mf/feta-accidentals.mf:30-40`): sharp, doublesharp, sharp with 1/2/3 slashes × 1/2/3 stems (5 variants), flat, flatflat, flat.slash, flat.slashslash, flatflat.slash, mirroredflat, mirroredflat.flat, mirroredflat.backslash, natural, and **arrowup / arrowdown / arrowboth** on each of sharp, flat, natural (9), plus sori/koron (`feta-sori-koron`, input at `mf/feta-accidentals.mf:55`) and 5 figured-bass variants → about **27 modern accidental glyphs**, 8 ancient ones (`mf/parmesan-accidentals.mf`).

- Arrow glyphs EXIST in the font but are in **no** shipped alteration table — a user must map them (doc example below).
- **No** Helmholtz-Ellis, Sagittal, Johnston, Wyschnegradsky, sixth/eighth/twelfth-tone glyphs. Tried: `grep -rn "HEJI|Helmholtz|ekmel|Sagittal"` over `Documentation/en`, `scm`, `ly`, `input/regression` → no hit.
- **[DOC]** `Documentation/en/notation/pitches.itely:479-484`: *"There are no generally accepted standards for denoting quarter tone accidentals, so LilyPond's symbols do not conform to any standard."*
- **[DOC]** `Documentation/en/notation/contemporary.itely:49-56`: the "Microtonal notation" section is an **empty stub** (`@ignore Discussion of microtones other than quarter tones, alternative notations (arrows, slash-flats), etc. @end ignore`).

### 1.3 User-defined accidentals  (Q3)

Two independent user hooks, both plain data:

1. **New pitch names with arbitrary rational alterations** — **[SRC]** `ly/makam.ly:42-140`: `(cc . ,(ly:make-pitch -1 0 KOMA))` … then `(set! language-pitch-names (append language-pitch-names (list `(makam . ,makamPitchNames))))` and `\language "makam"`.
2. **A custom alteration→glyph alist** — **[DOC]** `Documentation/en/notation/pitches.itely:3152-3165`:
   ```lilypond
   alterationGlyphs =
     #'((-1/2 . "accidentals.flat.arrowdown")
        (0 . "accidentals.natural.arrowup")
        (1/2 . "accidentals.sharp.arrowup"))
   ```

A user-defined alteration **is a real accidental**: it is just another rational, so it goes through the same accidental-state rule (§1.5), the same key-signature machinery (§1.6), transposition (§1.7) and MIDI (§1.4). That is the strength of the model.

The limit: the glyph must be a **glyph name of the music font** (`fm->find_by_name (glyph_name)`, `lily/accidental.cc:127`). A sign the font lacks needs a stencil override, which is outside the alist mechanism.

### 1.4 Symbol → sounding pitch  (Q4)

There is no mapping, because the number IS the sound:

- **[SRC]** `lily/midi-item.cc:306-316` — `Midi_note::get_fine_tuning` takes `tone_pitch() * 2`, subtracts the rounded semitone, multiplies by `PITCH_WHEEL_SEMITONE`; `:327-349` emits a pitch-wheel event before the note-on. **[DOC]** `Documentation/en/notation/input.itely:4141-4142`: *"Microtones but not microtonal chords. A MIDI player that supports pitch bending will also be required."* (pitch bend is per channel).
- **Scale**: `lily/scale.cc:32-36` — `ly:make-scale`: *"a vector of rational numbers, each of which represents the number of 200-cent tones of a pitch above the tonic."* The default is `scm/lily.scm:633` `(define-session default-global-scale (ly:make-scale #(0 1 2 5/2 7/2 9/2 11/2)))`, replaceable with `ly:set-default-scale` (`scm/lily.scm:640-647`: *"This determines the tuning of pitches with no accidentals or key signatures … Alterations are calculated relative to this scale. The number of pitches in this scale determines the number of scale steps that make up an octave."*).
  - It is **one global per session**, not per score or staff. The source itself flags it: `scm/lily.scm:625-631` *"TODO: This is somewhat fishy … changing the default scale might cause some existing pitches to refer to an unprotected scale."*
  - `\makeDefaultScale` does **not** exist in this tree (`grep -rn makeDefaultScale .` → nothing). No `.ly` on disk calls `ly:set-default-scale` or `ly:make-scale` other than the default (`grep --include=*.ly`).
  - `Scale::tones_at_step` hard-codes the octave: `lily/scale.cc:76-77` *"There are 6 tones in an octave."*

**Can two staves interpret the same sign differently?** For SOUND: **no** — the alteration number is in the note. For GLYPH: **yes** — `alterationGlyphs` is a context property, so two staves can draw the same number differently. This is exactly the inverse of "the symbol is content, the tuning is the interpreter".

**The cost of number-keyed signs, shown by LilyPond's own files:**

- *Same sign, several sounds → several fake numbers.* `ly/makam.ly:151-156` maps both `-5/18` and `-6/18` to the same glyph; `ly/turkish-makam.ly:174-175` maps both `(- EKSIK-BAKIYE)` and `(- CEYREK)` to `accidentals.mirroredflat.backslash`.
- *Tuning nuance with NO sign → a number mapped to the empty string.* `ly/persian.ly:26-30` defines `VLAT -1/10`, `FVLAT -3/5`, `SVLAT 2/5`; the glyph table `:128-140` has `(-1/10 . "")`, `(-3/5 . "accidentals.flat")`, `(2/5 . "accidentals.sharp")`. **[DOC]** `Documentation/en/notation/world.itely:754-760`: `v` = *"20 cent flat-tuned note ("vlat", not notated)"*, `fv` = *"flat, tuned 20 cents down (notated as a normal flat)"*. (The same table also contains a duplicate key: `(-3/5 . "accidentals.flat")` at `:135` and `(-3/5 . "")` at `:137`; `assv` takes the first.)
- *The number chooses the glyph, so a system re-uses numbers.* In `ly/turkish-makam.ly` `KUCUK = 6/12 = 1/2`, i.e. numerically the ordinary sharp, and is drawn `accidentals.sharp.slashslashslash.stem`, while the plain `accidentals.sharp` glyph is assigned to `BAKIYE = 5/12` (`:27-33`, `:165-180`). The plain sharp sign therefore means 83 cents in that file and 100 cents in every other.

### 1.5 Accidental display rules  (Q5)

State: a context property alist. **[SRC]** `scm/define-context-properties.scm:926-929`: `localAlterations` — *"The key signature at this point in the measure. The format is the same as for keyAlterations, but can also contain ((octave . name) . (alter barnumber . measureposition)) pairs."* It is seeded from `keyAlterations` (`lily/accidental-engraver.cc:504-509`) and updated after each note with the note's rational (`:392-395`, `:425-426`).

The rule — **[SRC]** `scm/music-functions.scm:1782-1791`:

```scheme
(let* ((prev-alt (extract-alteration previous-alteration))
       (this-alt (ly:pitch-alteration pitch)))
  (if (or (and all-naturals (eq? #f previous-alteration)) (not (= this-alt prev-alt)))
      (begin
        (set! need-accidental #t)
        (if (and (not (= this-alt 0))
                 (and (< (abs this-alt) (abs prev-alt))
                      (> (* prev-alt this-alt) 0)))
            (set! need-restore #t))))))
```

- Pure **numeric comparison**, so it generalises to any number of alterations for free. "What cancels a quarter-sharp?" → whatever the alist gives for alteration `0` (the natural).
- "Double-sharp → sharp": `need-restore` is true whenever the new alteration has the same sign and smaller magnitude. It is turned into ink only if the context property `extraNatural` is set (`lily/accidental-engraver.cc:272-276` → grob property `restore-first`); default `#t` in `Staff` (`ly/engraver-init.ly:919`), `#f` in the ancient contexts and in `persian.ly:151`. The natural is **not a distinct sign**: `lily/accidental.cc:131-143` prepends the `accidentals.natural` glyph to the stencil (with its own comment: *"this isn't correct for ancient accidentals"* — the natural glyph name is hard-coded, not taken from the alist).
  - **[INF]** The same branch fires for 3/4-sharp → 1/4-sharp, producing natural + quarter-sharp; nothing in the rule knows about semitone-sized steps.
- Rules are pluggable: `autoAccidentals` / `autoCautionaries` are lists of procedures `(context pitch barnum) → (need-restore . need-accidental)` (`lily/accidental-engraver.cc:152-195`, `scm/define-context-properties.scm:82-133`); `\accidentalStyle` selects among ~20 presets in `accidental-styles` (`scm/music-functions.scm:1940ff`).
- Cautionary / forced / parenthesised / suggested are **separate from the alteration**:
  - per note: `force-accidental`, `cautionary` event properties (`lily/accidental-engraver.cc:224-236`);
  - a different GROB TYPE, `AccidentalCautionary` with `(parenthesized . #t)` (`scm/define-grobs.scm:57-77`), chosen at `lily/accidental-engraver.cc:293-296`; parentheses are two font glyphs glued on (`lily/accidental.cc:32-43`, `:145-146`);
  - `AccidentalSuggestion` above the note for musica ficta (`scm/define-grobs.scm:96-123`, context property `suggestAccidentals`);
  - hidden: ordinary grob `\omit` / `transparent`.

### 1.6 Key signatures  (Q6)

**[SRC]** `scm/define-context-properties.scm:494-499`: `keyAlterations` — *"an alist containing (step . alter) or ((octave . step) . alter), where step is a number in the range 0 to 6 and alter a fraction"*. So a key signature is an open list of (step, rational), optionally octave-specific — any alteration on any step.

- `\key d \bayati`-style: a mode is just such an alist (`ly/arabic.ly:27-35`, `ly/persian.ly:158-238`).
- Print ORDER is a separate list, `keyAlterationOrder` (`lily/key-engraver.cc:174-184`); entries missing from it produce *"Incomplete keyAlterationOrder for key signature"* (`:196-197`). Each microtonal include file has to ship its own order (`ly/persian.ly:243ff`, `ly/turkish-makam.ly` "key alteration order").
- Glyphs come from the same alteration alist (`lily/key-signature-interface.cc:67-79`; missing → warning *"No glyph found for alteration"* and the entry is skipped).
- Vertical position comes from `sharp-positions` / `flat-positions` style tables via `key-signature-interface::alteration-positions` (`scm/output-lib.scm:1082`). **UNKNOWN**: how a quarter-tone alteration picks between the sharp and the flat position table — that function was located but not read.
- Feed into the note rule: `keyAlterations` is copied into `localAlterations` at each change (`lily/accidental-engraver.cc:107-128`, `:504-509`); the rule in §1.5 then compares numbers. Cancellation on key change is numeric too (`lily/key-engraver.cc:87-98`).
- **[DOC]** `Documentation/snippets/non-traditional-key-signatures.ly`: *"For microtonal scales where a "sharp" is not 100 cents, alter refers to the alteration as a proportion of a 200-cent whole tone."*

### 1.7 Transposition  (Q7)

**[SRC]** `lily/pitch.cc:125-135`:

```cpp
void Pitch::transpose (Pitch delta) {
  Rational new_alter = tone_pitch () + delta.tone_pitch ();
  octave_ += delta.octave_;
  notename_ += delta.notename_;
  alteration_ += new_alter - tone_pitch ();
  normalize_octave ();
}
```

Exact rational arithmetic; works for any alteration. What breaks **[INF]**: the result is a number, and the sign is a lookup of that number — a transposition that lands on an alteration absent from the alist prints the warning and the fallback glyph `noteheads.s1cross` (§1.1). E.g. in `makam.ly` units, D + 4/9 transposed up an equal-tempered minor second lands on E − 1/18, which no table contains. It is closed only under intervals the notation system itself is closed under.

### 1.8 Several accidentals on one note  (Q8)

Not modelled. One `Accidental` grob per note head (`lily/accidental-engraver.cc:257-279`), one `glyph-name` string, one `find_by_name`. The only composition in core is natural-prefix (`restore-first`) and parentheses. A Helmholtz-Ellis stack would need one precomposed font glyph per combination, or a stencil override.

**Ekmelily / Ekmelos — NOT ON DISK.** **[WEB, low confidence — summarised by a small model from `github.com/tr-igem/ekmelily`, `README.md` and `ly/ekmel-main.ily`]**: README: *"An extension for LilyPond that supports variable accidentals and key signatures for the notation of microtonal music in several tunings."* It keeps LilyPond's rational alteration, adds a tuning table (`ekmTuning`: alteration code → rational) and notation-style tables (`ekmNotations`: alteration → a LIST of glyph code points, so one accidental may be several glyphs), user commands `\ekmelicStyle` / `\ekmelicUserStyle`, default font "Ekmelos", and it works by **overriding the stencil** of `Accidental`, `AccidentalCautionary`, `KeySignature`, `KeyCancellation`, `TrillPitchAccidental`, `AmbitusAccidental`, `AccidentalSuggestion`. Its project site (`www.ekmelic-music.at`) did not resolve today. **UNKNOWN**: which tunings it ships (the README does not list them).

### 1.9 Glyph source  (Q9)

Not SMuFL. LilyPond's own glyph names (`accidentals.sharp.slashslash.stem`) defined in MetaFont (`mf/feta-*.mf`); the tables are the alists in `scm/output-lib.scm:1162-1216` and the `ly/*.ly` includes. The only SMuFL mention found is a comment in the font build script (`mf/gen-emmentaler.fontforge.py:111`: *"as we add support for the Standard Music Font Layout (SMuFL)"*).

### 1.10 What they got right / what hurts  (Q10)

**Right.** One rational gives exact arithmetic everywhere — transposition, key signatures, accidental rules, MIDI — with no special cases for "microtonal". User extension is plain data (two alists). The display rule is a list of pluggable procedures. Cautionary/forced/suggested are orthogonal to the alteration.

**Hurts.** The sign is a *function of the number*, so the model cannot say "this sign, whatever it is worth": (a) one sign with several tunings needs several fake numbers (`-5/18` and `-6/18`); (b) a tuning nuance with no sign needs a number mapped to `""` (Persian vlat); (c) one sound with two possible signs is impossible inside one context; (d) the number re-uses glyphs across systems (the plain sharp = 5/12 in `turkish-makam.ly`); (e) a missing table entry degrades to a warning and a cross notehead. The scale is a session global with a hard-wired 6-tone octave. One glyph per accidental. MIDI microtones are pitch bend, so no microtonal chords. The glyph set is small and non-standard by the docs' own admission, and the manual's "Microtonal notation" section is empty. Everything beyond quarter tones lives in a third-party extension that replaces the accidental stencils wholesale.

---

## 2. MuseScore

### 2.1 Data model  (Q1)

A note has FOUR pitch-related things. **[SRC]** `src/engraving/dom/note.h:537-545`:

```cpp
mutable int m_tpc[2] = { Tpc::TPC_INVALID, Tpc::TPC_INVALID };   // tonal pitch class  (concert/transposing)
mutable int m_pitch = 0;      // Note pitch as midi value (0 - 127).
mutable double m_centOffset = 0.0; // Pitch offset in cents (100 cents = 1 semitone)
...
double m_tuning = 0.0;      // pitch offset in cent, playable only by internal synthesizer
Accidental* m_accidental = nullptr;
```

- `tpc` = position on the line of fifths, **triple flat to triple sharp**, 35 values (`src/engraving/dom/pitchspelling.h:37-49`). This is the SPELLING for the 7 standard alterations; the alteration is derived (`tpc2alter`) as an `AccidentalVal`, `-3..3` semitones (`src/engraving/types/types.h:1058-1068`).
- `m_accidental`: **at most ONE** `Accidental` element, a child object with its own fields — **[SRC]** `src/engraving/dom/accidental.h:320-324`:
  ```cpp
  AccidentalType m_accidentalType = AccidentalType::NONE;
  AccidentalBracket m_bracket = AccidentalBracket::NONE;
  AccidentalRole m_role = AccidentalRole::AUTO;
  bool m_isSmall = false;
  int m_stackingOrderOffset = 0;
  ```
- `AccidentalType` is a closed enum (§2.2). `AccidentalRole` = `AUTO` ("layout created accidental") / `USER` ("user created accidental") (`types.h:1053-1056`).
- `m_centOffset` is **derived from the accidental's type**: `Accidental::setAccidentalType` → `note()->setCentOffset(Accidental::subtype2centOffset(t))` (`src/engraving/dom/accidental.cpp:385-391`), also on add/remove (`src/engraving/dom/note.cpp:1404-1407`, `:1470-1473`).
- `m_tuning` is a free per-note cents value set by the user/plugin.

So the written sign and the sounding alteration are **two mechanisms glued by a table**:
- standard signs: NOT stored as a sign — generated by layout from `tpc` versus the bar's state (`role == AUTO`);
- every other sign: stored as an `Accidental` object (`role == USER`), sound = fixed table lookup.

The split is a single comparison — **[SRC]** `accidental.h:278`: `static bool isMicrotonal(AccidentalType t) { return t > AccidentalType::FLAT3; }`. Note this puts `NATURAL_FLAT`, `NATURAL_SHARP`, `SHARP_SHARP` on the "microtonal" side.

Serialisation: an `<Accidental>` element with `bracket`, `role`, `small`, `subtype` (`src/engraving/rw/write/twrite.cpp:691-701`); the subtype is written by SMuFL glyph NAME (`Accidental::name2subtype` / `subtype2name` via `SymNames`, `accidental.cpp:288-291`, `:359-374`).

### 2.2 Built-in vocabulary  (Q2)

**[SRC]** `src/engraving/dom/accidental.h:36-213` — the enum; the parallel table `ACC_LIST` at `src/engraving/dom/accidental.cpp:53-226` (`struct Acc { AccidentalVal offset; double centOffset; SymId sym; }`, `:44-50`). Counted: **147 entries = NONE + 146 signs**. Both carry the comment *"NOTE: keep this in sync with …"* (`accidental.h:35`, `accidental.cpp:52`).

| group (enum comment) | count | cent offsets in `ACC_LIST` |
|---|---|---|
| standard: FLAT, NATURAL, SHARP, SHARP2, FLAT2, SHARP3, FLAT3 | 7 | 0 — pitch is in `AccidentalVal` |
| NATURAL_FLAT, NATURAL_SHARP, SHARP_SHARP | 3 | 0; `AccidentalVal` FLAT / SHARP / SHARP2 |
| "Gould arrow quartertone" (`*_ARROW_UP/DOWN`, ARROW_UP, ARROW_DOWN) | 12 | ±50, ±150, ±250 |
| "Stein-Zimmermann" | 4 | ±50, ±150 |
| "Arel-Ezgi-Uzdilek (AEU)" | 4 | −89, −44, +56, +89 |
| "Extended Helmholtz-Ellis accidentals (just intonation)" — 1/2/3 arrows × 5 base signs × up/down (30), septimal 1–2 commas (4), undecimal + tridecimal quartertone (4) | 38 | **all 0** |
| HE "equal tempered" (5 + 2 quarter) | 7 | **all 0** |
| 17 / 19 / 23 / 31 / 53-limit schisma/comma pairs | 10 | ±6.8, ±3.4, ±16.5, ±1.7, ±10.9 |
| EQUALS_ALMOST, EQUALS, TILDE (enharmonic signs) | 3 | 0 |
| Persian SORI, KORON | 2 | +33, −67 |
| Wyschnegradsky 1…11 twelfths | 22 | ±17 … ±183 (6/12 = `AccidentalVal::FLAT/SHARP`, 0 cents) |
| "(Spartan) Sagittal" | 26 | ±17 … ±100 |
| "Turkish folk music" 1–5 comma | 8 | ±22.2 … 111.1 |

Totals from the table (counted by script): **86 entries with a non-zero cent offset, 61 with 0**; only **11** carry a non-NATURAL `AccidentalVal`; **50 are `NATURAL, 0`** — i.e. `NONE`, the natural itself, and **48 signs with no pitch effect at all** (45 Helmholtz-Ellis + 3 enharmonic signs).

Not present: Johnston, Bosanquet, full (non-Spartan) Sagittal, Arabic-specific signs beyond quarter tones, sixth/eighth tones other than Wyschnegradsky twelfths. **[INF]** from the enum; no separate grep was needed.

The palette exposes them directly: `src/palette/internal/palettecreator.cpp:338-345` loops `for (int i = int(AccidentalType::FLAT); i < end; ++i)` with `end = AccidentalType::END` for the full palette, `SHARP3` for the basic one.

### 2.3 User-defined accidentals  (Q3)

**None as a real accidental.** `AccidentalType` is a compiled `enum class … : unsigned char`; adding a sign means editing the enum AND `ACC_LIST` in lockstep.

What a user CAN do:
- attach any SMuFL glyph to a note as a `Symbol` element (`src/engraving/dom/symbol.h:40-46`, *"Symbol constructed from builtin symbol"*; a `Note` accepts `SYMBOL` children, `src/engraving/dom/note.cpp:746`, `:1372`). **[INF]** It is a graphic: it is not in `ACC_LIST`, so it has no cent offset, no role in the bar state, and is not placed by `AccidentalsLayout`.
- set the note's `tuning` in cents by hand or by plugin — `src/engraving/api/v1/elements.h:1426-1427`: `/// The tuning of this note, in cents.  API_PROPERTY_T(qreal, tuning, TUNING)`.

### 2.4 Symbol → sounding pitch  (Q4)

The mapping lives in the compiled symbol table (`ACC_LIST.centOffset`) plus a per-note manual override. **There is no tuning / temperament / scale object** anywhere in the score model.

- **[SRC]** `src/engraving/dom/note.cpp:2725-2728`: `double Note::playingTuning() const { return m_tuning + m_centOffset; }`
- consumed at `src/engraving/playback/renderingcontext.h:120` → `notePitchLevel(tpc, octave, tuningCents)` (`src/engraving/playback/utils/pitchutils.h:132-139`: `result += tuningFactor * muse::mpe::PITCH_LEVEL_STEP`).
- the legacy MIDI path uses `note->tuning()` and a pitch-wheel function (`src/engraving/compat/midi/compatmidirenderinternal.cpp:239`, `:256-260`).
- MusicXML export special-cases four types and lets `tuning` override them (`src/importexport/musicxml/internal/export/exportmusicxml.cpp:4295-4312`: `case AccidentalType::MIRRORED_FLAT: microtonalAlter = -0.5;` … `// Override accidental with explicit note tuning`).

**Can two scores or two staves interpret the same sign differently?** No. A Stein quarter-sharp is +50 cents in every score; AEU `FLAT_SLASH` is −44 everywhere. The only escape is setting `tuning` on every note individually.

Consequences readable straight from the table:
- **[SRC+INF]** The 45 Helmholtz-Ellis signs with `AccidentalVal::NATURAL, 0` are graphics. Applying `FLAT_ONE_ARROW_DOWN` runs `EditNote::changeAccidental` → `acc = Accidental::subtype2value(accidental)` = NATURAL → `pitch = line2pitch(...) + int(acc)`, `tpc = step2tpc(step, acc)` (`src/engraving/editing/editnote.cpp:368-376`): the note becomes the **natural** pitch with 0 cents while showing a flat-with-arrow.
- **[SRC+INF]** Composite signs carry their whole offset in cents, not in the tpc: `FLAT_ARROW_UP` = `AccidentalVal::NATURAL, -50` (`accidental.cpp:67`), so "B quarter-flat" is stored as *B natural minus 50 cents* wearing a flat-arrow glyph.
- The reverse lookup is lossy: `Accidental::centOffset2Subtype` returns the FIRST type with that offset (`accidental.cpp:311-320`); +50 is shared by `NATURAL_ARROW_UP`, `SHARP_ARROW_DOWN`, `ARROW_UP`, `SHARP_SLASH`, Wyschnegradsky 3/12 and four Sagittal signs. `value2MicrotonalSubtype` handles only ±1 quarter and says so: `// TODO: more general implementation` (`accidental.cpp:328-331`).

### 2.5 Accidental display rules  (Q5)

State: **[SRC]** `src/engraving/dom/key.h:107-128` — `AccidentalState`, *"Contains a state for every absolute staff line"*: `uint8_t m_state[MAX_ACC_STATE = 75]; // (0 -- 4) | TIE_CONTEXT` plus `m_forceRestateAccidental`. Each line holds ONE `AccidentalVal` in 4 bits — it can only ever represent the 7 semitone alterations.

Rule: **[SRC]** `src/engraving/dom/note.cpp:2194-2299` `Note::updateAccidental(AccidentalState* as)`:

```cpp
// don't touch accidentals that don't concern tpc such as
// quarter tones
if (!(m_accidental && Accidental::isMicrotonal(m_accidental->accidentalType()))) {
    AccidentalVal accVal = tpc2alter(tpc());
    ...
    if ((accVal != absLineAccVal) || hidden() || as->tieContext(eAbsLine) || as->forceRestateAccidental(eAbsLine)) {
        as->setAccidentalVal(eAbsLine, accVal, ...);
        acci = Accidental::value2subtype(accVal);
        ... else if (acci == AccidentalType::NONE) { acci = AccidentalType::NATURAL; }
```
and for everything else (`:2287-2295`):
```cpp
} else {
    // microtonal accidentals playback as naturals
    // in 1.X, they had no effect on accidental state of measure
    // ultimately, they should probably get their own state
    // for now, at least change state to natural, so subsequent notes playback as might be expected
    // this is an incompatible change, but better to break it for 2.0 than wait until later
    AccidentalVal accVal = Accidental::subtype2value(m_accidental->accidentalType());
    as->setAccidentalVal(absLine, accVal, m_tieBack != 0 && m_accidental == 0);
}
```

So:
- **The display rule does not generalise beyond the 7 standard alterations — by design it excludes the rest.** Non-standard signs are never auto-generated, never auto-cancelled, and are always shown (`editnote.cpp:386-392`: *"precautionary or microtonal accidental — either way, we display it unconditionally"*). The source says it wants *"their own state"* and does not have it.
- **What cancels a quarter-sharp?** **[INF]** Nothing automatic. After a quarter-sharp C the line's state is set to NATURAL, so a following plain C in the bar has `accVal == absLineAccVal` and gets **no** natural sign, and its own `m_centOffset` is 0 — it plays natural while the page still reads quarter-sharp. The user must add the natural.
- **Double-sharp → sharp**: the auto path produces `value2subtype(SHARP)` = a plain sharp. `NATURAL_SHARP` / `NATURAL_FLAT` exist only as user-placed types; outside the enum/table they are referenced only by MusicXML, MEI and braille import/export (`grep -rn "NATURAL_FLAT|NATURAL_SHARP|SHARP_SHARP" src`). **No style option** for it: the `*ccidental*` entries in `src/engraving/style/styledef.cpp:267-293` are all distances and stacking switches.
- Cautionary / bracketed / forced ARE separate properties of the accidental object: `AccidentalBracket { NONE, PARENTHESIS, BRACKET, BRACE /* deprecated */ }` (`accidental.h:219-224`); `role` USER keeps an accidental the rule would remove (`note.cpp:2268-2284`: *"remove this if it was AUTO … keep it, but update type if needed"*); `small`; hidden via the generic `visible`. Brackets are drawn as extra glyphs around the main one, except five precomposed SMuFL paren glyphs (`src/engraving/rendering/score/tlayout.cpp:544-620`).

### 2.6 Key signatures  (Q6)

**[SRC]** `src/engraving/dom/key.h:40-56`, `:94-99`:

```cpp
struct CustDef {
    int degree = 0;             // scale degree
    SymId sym = SymId::noSym;
    Spatium xAlt = 0.0_sp;    // x position alteration in spatium units (default symbol position is based on index)
    int octAlt = 0;       // octave alteration
};
class KeySigEvent { ...
    Key m_concertKey = Key::INVALID;               // -7 -> +7
    Key m_key = Key::INVALID;
    KeyMode m_mode = KeyMode::UNKNOWN;
    bool m_custom = false;
    std::vector<CustDef> m_customKeyDefs;
```

A standard key is an integer −7…+7; a custom one is a list of **(scale degree, SMuFL symbol, x nudge, octave)**. Note `CustDef.sym` is a raw `SymId`, not an `AccidentalType` — the key signature and the note use different vocabularies. Saved as `<CustDef><sym>name</sym><def degree xAlt octAlt/>` (`src/engraving/rw/write/twrite.cpp:2288-2296`). Built in the master palette key editor from the accidentals palette (`src/palette/widgets/keyedit.cpp:346`, `:383-419`).

How it feeds the note rule — **[SRC]** `src/engraving/dom/key.cpp:356-374`:

```cpp
void AccidentalState::init(const KeySigEvent& keySig) {
    init(keySig.key());
    if (keySig.custom()) {
        for (const CustDef& d : keySig.customKeyDefs()) {
            SymId sym = keySig.symInKey(d.sym, d.degree);
            int degree = keySig.degInKey(d.degree);
            AccidentalVal a = sym2accidentalVal(sym);
            ... m_state[i] = static_cast<uint8_t>(int(a) - int(AccidentalVal::MIN));
```

`sym2accidentalVal` returns the table's semitone offset (`accidental.cpp:232-240`), which is NATURAL for every microtonal sign. **[INF]** So a quarter-flat in a custom key signature is drawn, but it leaves the line's state at NATURAL and nothing applies its cents to the notes: `grep -rln "customKeyDefs|CustDef" src` finds only `key.cpp`, layout, read/write, `keyedit.cpp` and the MusicXML importer — no playback consumer.

Layout hack worth noting: whether a custom symbol is laid out on the flat or sharp line pattern is decided by a substring of its glyph name — `bool flat = std::string(SymNames::nameForSymId(sym).ascii()).find("Flat") != std::string::npos;` (`src/engraving/rendering/score/tlayout.cpp:3574`, same in `keyedit.cpp:405`).

### 2.7 Transposition  (Q7)

Transposition is `tpc` arithmetic. `grep -n "accidental|Accidental|centOffset|tuning" src/engraving/editing/transpose.cpp` → **no hit**: nothing there touches the accidental object.

**[INF]** Therefore a non-standard `Accidental` rides along unchanged with its cent offset. The PITCH stays right (tpc moved, cents kept) but the GLYPH can become wrong: "B quarter-flat" = B-natural tpc + `FLAT_ARROW_UP` (−50); up a major second the tpc is C♯, the accidental is still `FLAT_ARROW_UP`, and `updateAccidental` accepts it because its table offset still equals `m_centOffset` (`note.cpp:2213-2218`) — the page shows a flat-arrow on a C♯ note that sounds C♯ −50, which should read sharp-arrow-down. Not executed; derived from the code paths cited.

Two admissions in source:
- `src/engraving/dom/ornament.cpp:293-296`: *"If mainNote has microtonal accidental, don't clone it to the ornament note because microtonal intervals are not supported."*
- custom key signatures DO have a purpose-built "transposition table for microtonal accidentals" (`src/engraving/dom/key.cpp:36ff`, `symInKey` `:435-457`): ordered runs of symbols separated by `noSym`, index ±1 per key step; a symbol outside the table returns `SymId::noSym` (*"sym is not transposable (it is not in table)"*) and layout falls back to *"add key accidental followed by untranslated symbol"* (`tlayout.cpp:3584`).

### 2.8 Several accidentals on one note  (Q8)

One pointer: `Accidental* m_accidental` (`note.h:545`). Combinations exist only as **precomposed enum values mapped to precomposed SMuFL glyphs** — `NATURAL_SHARP` → `accidentalNaturalSharp`, `FLAT_ONE_ARROW_DOWN` → `accidentalFlatOneArrowDown`, etc. The HE "combining" signs (`accidentalCombiningLower17Schisma` …) are in the enum as stand-alone types, but nothing can combine them with a base accidental on the same note. `LayoutData::syms` is a vector (`accidental.h:291-299`) but it is filled only with left bracket + main + right bracket (`tlayout.cpp:586-618`).

### 2.9 Glyph source  (Q9)

SMuFL throughout. `SymId` enum: `src/engraving/types/symid_p.h` (480 lines matching `accidental|accSagittal`); names ↔ ids in `src/engraving/types/symnames.cpp`; SMuFL metadata `fonts/smufl/glyphnames.json`. The accidental ↔ glyph table is `ACC_LIST` (`src/engraving/dom/accidental.cpp:53-226`).

### 2.10 What they got right / what hurts  (Q10)

**Right.** The accidental is a first-class object with its own properties, cleanly separate from *which* sign it is: `role` (AUTO vs USER) is exactly the distinction between "the rule put this here" and "the user did"; `bracket`, `small`, visibility, stacking offset. SMuFL names are the persistent identity (files store the glyph name, not the enum integer). A large ready-made vocabulary. Custom key signatures are an open list of (degree, symbol).

**Hurts.** (1) Two regimes split by `t > FLAT3`: standard signs derived from `tpc`, everything else bolted on — and the bolt-on side has no bar state (the source's own *"they should probably get their own state"*), no auto-cancel, no generation. (2) Sound is a **fixed compiled cent table**, so there is no tuning concept and no way for two scores to differ; 48 signs are silent, including the whole Helmholtz-Ellis set. (3) Composite signs put the entire offset in cents and leave the `tpc` natural, so spelling and sign disagree and transposition can leave the wrong glyph. (4) The enum and the table must be edited in lockstep; reverse lookups (`centOffset2Subtype`, `value2MicrotonalSubtype`) are ambiguous or quarter-tone-only. (5) The key signature speaks `SymId` while the note speaks `AccidentalType`, bridged by a table that collapses every microtone to NATURAL, and by a `"Flat"` substring test. (6) One accidental per note. Issue-tracker numbers: only `see #25910` (an Xcode assert workaround, `key.cpp:409`) was found near this code — **UNKNOWN** which tracker issues cover "real tuning support"; no issue reference appears in the accidental sources.

---

## 3. Verovio / MEI

Two layers to keep apart: **what MEI lets you encode** (the schema, `libmei/mei/mei-all_compiled.odd`) and **what Verovio does with it**.

### 3.1 Data model  (Q1)

**MEI [SRC]** — line numbers in `libmei/mei/mei-all_compiled.odd`:

| attribute / element | definition |
|---|---|
| `@accid` (`att.accidental`, :28753) | *"Captures a written accidental."* — `data.ACCIDENTAL.WRITTEN` |
| `@accid.ges` (`att.accidental.ges`, :23715) | *"Records the performed pitch inflection."* — `data.ACCIDENTAL.GESTURAL` |
| `<accid>` element (:32610) | *"Records a temporary alteration to the pitch of a note."* Remarks: *"This element provides an alternative to the accid and accid.ges attributes on the note element. The element may be used when specific display info, such as size or color, needs to be recorded for the accidental **or when multiple accidentals occur on a single note**."* |
| `@func` (`att.accid.log`, :28734) | `caution` = *"Cautionary accidental."*, `edit` = *"Editorial accidental."* |
| `@enclose` (`att.enclosingChars`, :29625) | `paren`, `brack`, `box`, `none` (`data.ENCLOSURE`, :17447) |
| `@glyph.name`, `@glyph.num` (`att.extSym.names`, :23050) | *"Glyph name."* / *"Numeric glyph reference in hexadecimal notation, e.g., "#xE000" or "U+E000". N.B. SMuFL version 1.18 uses the range U+E000 - U+ECBF."* |
| `@glyph.auth`, `@glyph.uri` (`att.extSym.auth`, :23027) | the vocabulary the glyph comes from; suggested value `smufl` |
| `@altsym` (`att.altSym`, :35448) | *"Provides a way of pointing to a user-defined symbol. It must contain a reference to an ID of a symbolDef element elsewhere in the document."* |
| `@pname.ges`, `@oct.ges`, `@pnum` (`att.pitch.ges`, :24193) | performed pitch name / octave; *"a pitch-to-number mapping, a base-40 or MIDI note number, for example."* |
| `@tune.Hz`, `@tune.pname`, `@tune.temper` (`att.tuning`, :31969-31981) | reference pitch in Hz; *"the central tone of a tuning system"*; *"an indication of the tuning system, just, for example."* |

So in MEI the written sign and the sounding alteration are **two separate fields**, both on the same `<accid>` (or as `@accid` / `@accid.ges` on `<note>`), and the sign has three levels of openness: enum value → any glyph of an external authority → a symbol drawn in the document.

**Verovio [SRC]** `include/vrv/accid.h:29-41`:

```cpp
class Accid : public LayerElement, public OffsetInterface, public PositionInterface,
              public AttAccidental, public AttAccidentalGes, public AttAccidLog, public AttColor,
              public AttEnclosingChars, public AttExtSymAuth, public AttExtSymNames,
              public AttPlacementOnStaff, public AttPlacementRelEvent {
```

`@accid`/`@accid.ges` on a `<note>` are turned into an `Accid` child flagged `IsAttribute(true)`; mixing both forms warns (`src/note.cpp:187-195`: *"Having both @accid or @accid.ges and <accid> child will cause problems"*).

### 3.2 Built-in vocabulary  (Q2)

**[SRC]** value lists extracted from the ODD (same in `libmei/dist/atttypes.h:88-125`, `:28-52`, `:174-193`):

- `data.ACCIDENTAL.WRITTEN.basic` (:16302) — **12**: `s`, `f`, `ss` (*"Double sharp (written as 2 sharps)"*), `x` (*"written using croix"*), `ff`, `xs`, `sx`, `ts`, `tf`, `n`, **`nf`** (*"Natural + flat; used to cancel preceding double flat."*), **`ns`** (*"Natural + sharp; used to cancel preceding double sharp."*)
- `data.ACCIDENTAL.WRITTEN.extended` (:16344) — **14**: arrows `su sd fu fd nu nd xu xd ffu ffd` (*"Sharp note raised by quarter tone (sharp modified by arrow)"* …), and `1qf 3qf 1qs 3qs` (*"1/4-tone flat accidental"* …)
- `data.ACCIDENTAL.aeu` (:16394) — **8**: `bms kms bs ks kf bf kmf bmf`
- `data.ACCIDENTAL.persian` (:16429) — **2**: `koron`, `sori`
- → **36 written values.**
- `data.ACCIDENTAL.GESTURAL` — basic (:16446) 7: `s f ss ff ts tf n`; extended (:16473) 6: `su` *"Three quarter-tones sharp"*, `sd` *"Quarter-tone sharp"*, `fu` *"Quarter-tone flat"*, `fd` *"Three quarter-tones flat"*, `xu` *"Five quarter-tones sharp"*, `ffd` *"Five quarter-tones flat"*; + aeu 8 + persian 2 → **23 gestural values**. The gestural side is an ENUM too, not a number: MEI has no cents/ratio field for an accidental.
- `data.TEMPERAMENT` (:19536) — 4: `equal`, `just`, `mean`, `pythagorean`.

Verovio's drawing table **[SRC]** `src/accid.cpp:244-282` `Accid::GetAccidGlyph` has cases for 32 of the 36; **`xu`, `xd`, `ffu`, `ffd` have no case and return 0** (no glyph). Triple-sharp variants share one glyph (`// Missing in SMuFL`).

No Helmholtz-Ellis / Sagittal / Wyschnegradsky / Johnston **enum values** — but all of them are reachable through `@glyph.name` (§3.3). Verovio ships `data/tuning-glyphnames.json` with **475** SMuFL name → code point entries (starts with `accSagittal…`).

### 3.3 User-defined / extensible accidentals  (Q3)

**[SRC]** `src/accid.cpp:284-334` `Accid::CreateSymbolStr`:

```cpp
// If there is glyph.num, prioritize it
if (glyphNum != 0) { code = glyphNum; if (!resources->GetGlyph(code)) code = 0; }
// If there is glyph.name (second priority)
else if (!glyphName.empty()) { code = resources->GetGlyphCode(glyphName); if (!resources->GetGlyph(code)) code = 0; }
...
if (!code) { ... code = Accid::GetAccidGlyph(accid); }
```

So any glyph the loaded music font has can be an accidental, by name or code point, and it falls back to the enum glyph when the font lacks it.

Is it a *real* accidental? Mostly yes, with holes:
- It is laid out as an accidental (same element, same `AdjustAccidXFunctor`), takes `@enclose`, `@func`, colour, placement.
- It works in **key signatures**: `KeyAccid` also carries `AttExtSymAuth` / `AttExtSymNames` and calls the same `CreateSymbolStr` (`include/vrv/keyaccid.h`, `src/keyaccid.cpp:68-72`).
- It is understood by the **custom tuning** (§3.4), which *prefers* the glyph name over the enum.
- Holes: **the draw routine bails out when there is no `@accid`** — `src/view_element.cpp:267` `if (!accid->HasAccid() || staff->IsTablature()) { … SetEmptyBB … return; }`, and layout collects only `accid->HasAccid()` (`src/adjustaccidxfunctor.cpp:146`). A glyph-only `<accid glyph.name="…"/>` is not drawn. The MusicXML importer papers over it: `src/iomusxml.cpp:4071-4076` — `if (accid->HasGlyphName()) { accid->SetGlyphAuth("smufl"); if (!accid->HasAccid()) { accid->SetAccid(ACCIDENTAL_WRITTEN_n); } }` — i.e. a dummy natural is written so the glyph shows.
- Transposition and the default MIDI path ignore the glyph (§3.4, §3.7).
- `@altsym` / `<symbolDef>`: MEI allows it on `<accid>` (`att.accid.vis` is a member of `att.altSym`, read from the ODD), but Verovio's `Accid` does **not** inherit `AltSymInterface` — only `note`, `rest` and control elements do (`grep -rln AltSymInterface include/vrv`). So a document-drawn accidental symbol is not supported by Verovio.

### 3.4 Symbol → sounding pitch  (Q4)

Three mechanisms, in increasing generality.

**(a) Default: an integer semitone from the two enums.** **[SRC]** `src/note.cpp:822-872` — `GetMIDIPitch` uses `@pnum` if present, else pitch class + `GetChromaticAlteration()`, which asks only the FIRST accid (`GetDrawingAccid()` = `FindDescendantByType(ACCID)`, `:214-222`) and calls `TransPitch::GetChromaticAlteration(accidGes, accidW)`. That function (`src/transposition.cpp:95-137`) has every microtonal case commented out:

```cpp
// case ACCIDENTAL_GESTURAL_fd: return -1.5;
case ACCIDENTAL_GESTURAL_f: return -1;
// case ACCIDENTAL_GESTURAL_fu: return 0.5;
...
// case ACCIDENTAL_WRITTEN_1qs: return 0.5;
```
→ by default **microtones play as the unaltered or semitone pitch**.

There is no pass that derives `accid.ges` from the key signature for MEI input: the only `SetAccidGes` call sites are importers, the editor toolkit and transposition (`grep -rn SetAccidGes src`). **[INF]** MEI input must itself encode `accid.ges` on notes altered by the key signature, otherwise they play natural.

**(b) MEI `@tune.*` on `<scoreDef>`.** **[SRC]** `src/midifunctor.cpp:955-996`: `@tune.temper` → one of four canned MIDI temperament messages (`makeTemperamentEqual / Bad(100.0, …) / Meantone / Pythagorean`, keyed on `@tune.pname`); `@tune.Hz` → an MTS key-tuning message retuning all keys to `pow(2, (i-69)/12) * tuneHz`. These retune the 12 MIDI keys; they do not read accidentals.

**(c) `CustomTuning` — a real tuning interpreter keyed by SYMBOL** (CHANGELOG 6.1.0: *"Support for ASCL custom tuning (MusicXML import and MIDI output)"*). **[SRC]** `src/customtuning.cpp`:

- input: an Ableton `.ascl` text — a Scala scale plus `! @ABL NOTE_NAMES …` and `REFERENCE_PITCH` comment lines, parsed by the bundled Surge `tuning-library` (`include/tuning-library/TuningsImpl.h:1119-1150`; it errors if the name count differs from the scale size);
- `CreateNoteMapping` (`:82-121`), quoted header comment:
  ```
   * Map the tuning note names to MEI notes.
   * - Convert accidentals from MusicXML or MEI to SMuFL
   * - Detect enharmonics separated by `/`
   * - Detect multiple accidentals separated by `+`
   * - Ignore natural accidental
  ```
  Each scale degree's name becomes a key `LETTER + smuflGlyphName (+ smuflGlyphName …)`.
- `GetMIDIPitch(note)` (`:175-227`) builds the same key from the note: for **every** `<accid>` descendant, take `@glyph.name` if present, else the glyph of `@accid`, else the glyph of `@accid.ges`; join with `+`; look it up; return the scale degree's MIDI key. On a miss it logs *"… not mapped"* and falls back to (a). (Source carries a `// FIXME! Special case` for a B on scale degree 0.)
- output: `src/midifunctor.cpp:961-972` sends one MTS `KeyTuningsByFrequency` with `tuneCustom.frequencyForMidiNote(i)` for keys 1–127 — so an N-note scale is spread over consecutive MIDI keys.
- where the tuning comes from: the toolkit option `tuningFile` (`src/options.cpp:1862-1864`: *"A custom tuning definition or filepath to apply to the MIDI output"*, default `""`; **[WEB]** confirmed on `book.verovio.org/toolkit-reference/toolkit-options.html` as `--tuning-file <string>`), applied in `src/doc.cpp:474-503`; or a MusicXML `<play><other-play type="tuning-ableton">` (`src/iomusxml.cpp:4139-4153`); stored as a C++ member of `ScoreDef` (`include/vrv/scoredef.h:255-257`, `:311`).

**Can two scores interpret the same sign differently?** With (c), **yes** — the same `accidentalQuarterToneSharpStein` on C is whatever frequency the supplied tuning assigns to `CaccidentalQuarterToneSharpStein`. Per `scoreDef`, so in principle per section. **Per staff: no** — the tuning hangs on `ScoreDef`, not `StaffDef` [INF from the member's location].

**[INF]** The tuning is not part of the MEI document: `grep "CustomTuning|m_customTuning" src/iomei.cpp` → no hit, so it is neither read from nor written to MEI; it lives in the option or in MusicXML.

### 3.5 Accidental display rules  (Q5)

**For MEI input Verovio computes nothing**: the encoding states which accidentals are written (`@accid`) and which are only sounding (`@accid.ges`); Verovio draws the former. `--show-hidden` can visualise the latter: `Accid::InitShowAccidGes` adds a child accid converted with `AccidentalGesturalToWritten` (`src/accid.cpp:115-125`, `src/preparedatafunctor.cpp:62-76`, option text `src/options.cpp:1144`: *"Display <space>, <mSpace> and invisible or gestural elements"*).

- `nf` / `ns` are **distinct written values**, so "natural-sharp or plain sharp" is a fact of the encoding, not a style option.
- Cautionary / editorial / bracketed / placement are **separate attributes**, independent of which sign: `@func="caution|edit"`, `@enclose="paren|brack"` (drawn as SMuFL bracket glyphs around the code, `src/accid.cpp:320-332`), `@place="above|below"` + `@onstaff` for ficta-style accidentals laid out as a floating object (`src/view_element.cpp:291-346`).

**Where Verovio does compute a state** — importers and the editor toolkit — the state is **a map from staff position to a written SYMBOL**, not a number. **[SRC]** `include/vrv/vrvdef.h:406`: `typedef std::map<int, data_ACCIDENTAL_WRITTEN> MapOfOctavedPitchAccid;`, filled from the key signature (`src/keysig.cpp:199-221`). Rule, `src/editortoolkit_shared.cpp:1446-1456`:

```cpp
if (accid != ACCIDENTAL_WRITTEN_NONE) {
    if (accid != ACCIDENTAL_WRITTEN_n || previousAccid != ACCIDENTAL_WRITTEN_NONE) {
        actualAccid = accid;
        isImplicit = (accid == previousAccid);
    }
}
else if (previousAccid != ACCIDENTAL_WRITTEN_NONE) { actualAccid = previousAccid; }
```

then `isImplicit` → write `@accid.ges`, else `@accid` (`:1407-1414`). Symbol equality needs no ordering of alterations, so it extends to any number of signs; **[INF]** it knows nothing of `@glyph.name`, and it has no "restore" notion (no automatic `ns`/`nf`).

The MusicXML importer shows why a symbol-keyed tuning *needs* a symbol-keyed state — `src/iomusxml.cpp:3155-3225` keeps `m_alterAccids`, keyed by pitch name + alter, holding the list of accidentals last printed for it, and re-attaches them invisibly to later notes that print none:

> *"Because gestural accidentals do not map 1:1 to written accidentals, we may be losing information if we rely only on gestural accidentals to look up tuning tones. Instead, we set the accidental's SMuFL glyph name to whatever was carried over. The custom tuning will always choose the SMuFL glyph over the written or gestural accidentals."* (`:3186-3189`)

### 3.6 Key signatures  (Q6)

MEI: `<keySig sig="3s">` shorthand **or** `<keySig>` with `<keyAccid>` children (*"Accidental in a key signature."*, ODD :33601; it must have `@x/@y`, `@pname/@oct` or `@loc`). Verovio `KeyAccid` = pitch + `AttAccidental` + `AttEnclosingChars` + ext-sym attributes (`include/vrv/keyaccid.h`); `keyAccid@oct` support is new in 6.2.0 (CHANGELOG).

- One internal form: the `@sig` shorthand is **expanded into generated `KeyAccid` children** (`src/keysig.cpp:176-192`); if real children exist, `@sig` is ignored with a warning (`:193-196`).
- Staff position: `@loc` if given, else from pname/oct with a per-clef octave table (`src/keyaccid.cpp:74-85`).
- Feeds the accidental state as a symbol: `mapOfPitchAccid[(keyAccid->GetPname() + oct * 7)] = keyAccid->GetAccid();` for 10 octaves (`src/keysig.cpp:205-211`). **[INF]** only the enum value, not the `@glyph.name`.

### 3.7 Transposition  (Q7)

**[SRC]** Integer chromatic alteration only (`TransPitch(pname, accid, oct)`, base-40-style interval classes). `src/note.cpp:880-909` `UpdateFromTransPitch` overwrites the accid with `tp.GetAccidGes()` / `tp.GetAccidWritten()`, which can only return `tf ff f n s x xs` (`src/transposition.cpp:211-225`). Source comment: `// TODO: Check the case of both existing but having unequal values.`

**[INF]** A note with `accid="1qs"` enters with alteration 0 (the case is commented out) and leaves with a standard sign: **the microtonal sign is lost**, while an `@glyph.name` on the same element is left in place and now contradicts `@accid`. Key signatures: only `@sig` is transposed (`src/transposefunctor.cpp:52-76`); `keyAccid` children are not visited. Not executed.

### 3.8 Several accidentals on one note  (Q8)

**MEI**: explicitly allowed (the `<accid>` remark quoted in §3.1).

**Verovio [SRC]**:
- import: MusicXML loops over all `<accidental>` and `<accidental-mark>` children, one `Accid` each (`src/iomusxml.cpp:3122-3127`);
- layout: `src/adjustaccidxfunctor.cpp:101-126` — *"Zig-zag processing, taking into consideration multiple accidentals per note … don't zig-zag if the next accidental belongs to current note to preserve order"*;
- drawing: each `Accid` is drawn by `View::DrawAccid`;
- tuning: all accids of a note are joined with `+` (§3.4c);
- but `Note::GetDrawingAccid()` returns only the first, so default MIDI and transposition see one.

So: a **list of accidental elements, each one glyph, placed side by side in document order** — no ligature or composite-glyph logic. Rendered output was **not checked** (nothing was run): UNKNOWN how good the spacing is, and whether HEJI-style tight stacking is achieved.

### 3.9 Glyph source  (Q9)

SMuFL. Code-point enum `include/vrv/smufl.h` (`SMUFL_E260_accidentalFlat = 0xE260` …; 34 accidental entries — only those the code names). Enum → glyph: `src/accid.cpp:244-282`. Name → code point for tuning: `data/tuning-glyphnames.json` (475). Arbitrary glyphs resolve through the loaded font's resources (`resources->GetGlyphCode(glyphName)`), fonts in `data/` (Bravura, Leipzig, Leland, Petaluma, Gootville).

### 3.10 What they got right / what hurts  (Q10)

**Right.** (1) Written and sounding are two fields, so an unprinted accidental still has a home. (2) The sign is open-ended in layers: enum → `@glyph.name`/`@glyph.num` with a named authority → `@altsym`; the same attributes serve notes and key signatures. (3) Function (`@func`), enclosure (`@enclose`) and placement are attributes independent of the sign. (4) One key-signature form internally (`@sig` expands to `keyAccid`s). (5) Multiple accidentals per note are a list. (6) `CustomTuning` is the only thing in the three engines that matches "symbol in the score, tuning outside it": the tuning file names its degrees by letter + glyph names, enharmonics by `/`, stacks by `+`, and is supplied from outside the document. (7) Where a state is kept, it is keyed by symbol.

**Hurts.** (1) The *gestural* side is an enum with names nearly identical to the written one but different meanings (`su` written = "sharp raised by a quarter tone"; `su` gestural = "three quarter-tones sharp"), and the conversions are full of `/* To verified */` (`libmei/addons/att.cpp:954-991`); one looks wrong against MEI's own definitions — `ACCIDENTAL_WRITTEN_1qs → ACCIDENTAL_GESTURAL_su` and `3qs → sd` (`:985`, `:987`), i.e. quarter-sharp mapped to three-quarter-sharp and vice versa **[INF from comparing with ODD :16473]**. Triple sharps/flats collapse to double (`/* To verified - triple sharp missing in gestural ? */`), although `ts`/`tf` do exist in the gestural enum. (2) MEI has no numeric sounding value for an accidental — beyond the enum you need `@pnum` or an external tuning. (3) Default MIDI and transposition are integer-semitone; microtones are silently dropped or overwritten. (4) A glyph-only accid is not drawn; importers add a dummy natural. (5) Four enum values have no glyph. (6) The tuning is not serialisable to MEI and is keyed by SMuFL *name* — tied to one glyph authority. (7) The MusicXML "carried-over accidentals" map is the price of the design: once pitch is looked up by symbol, every note that prints nothing still has to know which symbol governs it.

---

## 4. Comparison table

| | LilyPond | MuseScore | Verovio / MEI |
|---|---|---|---|
| **1. What is stored on the note** | one `Rational alteration_` in whole tones; no symbol | `tpc` (35 spellings, ±3) + optional ONE `Accidental{type enum, bracket, role, small}` + derived `centOffset` + manual `tuning` cents | `<accid>` child(ren): `@accid` (written enum) + `@accid.ges` (gestural enum) + `@glyph.name/num` + `@func` + `@enclose` |
| sign and sound: one field or two | ONE — sign derived from the number | two mechanisms, glued by a compiled table | TWO explicit fields |
| **2. Built-in vocabulary** | 9 alterations by default; ~27 modern glyphs; Turkish 1/9 + 72-ET, 24-TET Arabic, Persian as include files; no HE/Sagittal | 146 signs: Gould arrows, Stein-Zimmermann, AEU, extended HE, 17–53-limit, Persian, Wyschnegradsky, Spartan Sagittal, Turkish folk | 36 written / 23 gestural enum values: arrows, 4 Stein-Zimmermann, AEU, Persian; anything SMuFL via glyph name |
| **3. User-defined sign** | yes, as data: a new rational + an alist entry; fully real; glyph must be in the font | no (closed enum). Only a `Symbol` graphic or per-note `tuning` | yes: `@glyph.name` / `@glyph.num`; real for layout, key sig, custom tuning — not for default MIDI or transposition; `@altsym` unsupported on accid |
| **4. Symbol → sound** | none needed: the number is the sound; global `Scale`; MIDI pitch bend | fixed cent per enum value in `ACC_LIST`; 48 signs have no pitch effect; no tuning object | default: integer semitone; `@tune.temper` 4 presets; **`CustomTuning`** (.ascl, keyed by letter + glyph names) |
| same sign, different sound in two scores | no (but same number, different glyph per staff: yes) | no | yes, per tuning file / scoreDef; not per staff |
| **5. Display rule with many signs** | numeric compare against `localAlterations`; generalises fully; pluggable rule procedures | 4-bit semitone state per line; non-standard signs excluded, always shown, never auto-cancelled | none for MEI (encoding says it); importers/editor keep a symbol-keyed map |
| double-sharp → sharp | `extraNatural` context property → natural glyph prepended at print | plain sharp; `NATURAL_SHARP` is a manual type; no style option | `ns` / `nf` are distinct written values |
| cautionary / brackets / forced | separate: note flags `!` `?`, `AccidentalCautionary` grob, `parenthesized`, `AccidentalSuggestion` | separate: `bracket`, `role` AUTO/USER, `small`, visible | separate: `@func`, `@enclose`, `@place`/`@onstaff` |
| **6. Key signature** | alist `(step . rational)` or `((octave . step) . rational)` + `keyAlterationOrder` | int −7..7, or custom `CustDef{degree, SymId, xAlt, octAlt}`; microtones → NATURAL in state, no sound | `@sig` or `<keyAccid>` list (pname/oct/loc + accid + glyph); `@sig` expands to keyAccids |
| **7. Transposition** | exact rational; sign may fall off the table → warning + cross glyph | tpc-based; microtonal accidental rides along unchanged → glyph can go wrong | integer semitone; microtonal written value overwritten; keyAccids untouched |
| **8. Several accidentals per note** | no; natural-prefix + parens only (Ekmelily: glyph list, not on disk) | no; precomposed enum values → precomposed SMuFL glyphs | yes: list of `<accid>`, laid out side by side, joined by `+` for tuning |
| **9. Glyph keys** | own names, `scm/output-lib.scm:1162-1216` | SMuFL, `src/engraving/dom/accidental.cpp:53-226` | SMuFL, `src/accid.cpp:244-282`, `data/tuning-glyphnames.json` |

---

## 5. Design lessons for "the symbol is score content, the tuning is a separate interpreter"

1. **Do not key the sign on a number (LilyPond), and do not weld a number to the sign (MuseScore).** Both fail the same test from opposite sides: LilyPond needs `-5/18` and `-6/18` for one glyph and `(-1/10 . "")` for a sign-less nuance; MuseScore makes a Stein quarter-sharp +50 cents for every score ever and leaves the Helmholtz-Ellis set silent. The note should name a SYMBOL; its worth belongs to the interpreter.

2. **The interpreter's input is (step, symbol-list, octave), not (step, number)** — Verovio's `CustomTuning` key is `letter + glyphName(+glyphName…)`, with `/` for enharmonic aliases of one degree. This is the Scala-with-note-names shape the project's own tuning doc already points at; `.ascl` is a concrete existing format to read.

3. **Once pitch is looked up by symbol, the accidental STATE of the bar must be symbol-valued too.** Every note that prints nothing still needs to know which symbol governs it. Verovio's MusicXML importer had to invent `m_alterAccids` for exactly this; MuseScore's 4-bit semitone state is why its microtones sit outside the rule ("they should probably get their own state"). Verovio's `map<position, writtenAccid>` with *equality* as the test is the form that scales — it needs no ordering of alterations.

4. **But a "restore" rule (double-sharp → sharp, or 3/4 → 1/4) needs more than equality** — it needs to know that one sign is "the same direction, smaller". LilyPond gets this from the number for free; a symbol model has to get it from a property of the symbol table (or from the interpreter), and it should be an option like `extraNatural`, not a separate sign — unless the user wrote it, in which case MEI's `ns`/`nf` and MuseScore's `NATURAL_SHARP` show it also has to exist as a writable sign.

5. **Keep "which sign" apart from "why and how it is shown".** All three agree, which makes it the safest finding here: cautionary/editorial function, enclosure, forced/hidden, size, and *who put it there* (MuseScore `role` AUTO vs USER; MEI `@accid` vs `@accid.ges`) are properties of the accidental occurrence, never new symbols.

6. **An accidental is a LIST of signs, in order.** MEI allows several `<accid>`; Verovio lays them out in document order and joins them for tuning; Ekmelily maps one alteration to a list of glyphs. MuseScore's single pointer forces one precomposed enum value per combination (30 HE arrow types for 5 bases) and still cannot attach a 17-limit schisma to a flat.

7. **One vocabulary for notes and key signatures, and one internal form.** MuseScore's key signature speaks `SymId` while notes speak `AccidentalType`, bridged by a table that flattens microtones to NATURAL and by a `"Flat"` substring test. LilyPond and MEI use the same entry type in both places; Verovio expands the `fifths`-style shorthand into explicit entries so there is one reader — the same conclusion as the project's *"`fifths` is the shorthand, never the storage"*.

8. **Transposition is the operation that exposes the model, and nobody has it right for open symbol sets.** LilyPond is exact but can land on a number with no sign; MuseScore moves the spelling and leaves the sign; Verovio discards the sign. With symbol-as-content, transposition needs the symbol table to say what each sign becomes (or to refuse) — it cannot be derived from the symbols alone. Decide early whether that knowledge belongs to the symbol system, to the tuning, or is simply refused outside the standard seven.

Smaller points: identify a sign by a **stable name under a named authority** (MuseScore files store the SMuFL name, MEI has `@glyph.auth`) rather than an enum ordinal; MuseScore's "keep in sync" enum + table pair is the maintenance trap to avoid — one table, total over the vocabulary. And a glyph-only accidental must be drawable without a dummy standard sign (Verovio's `SetAccid(n)` workaround).

---

## 6. Open / UNKNOWN

- **Nothing was executed or rendered.** Every behavioural statement tagged [INF] is derived from reading code paths. In particular: MuseScore's wrong glyph after transposing a microtonal note; MuseScore's missing natural after a quarter-sharp; Verovio dropping a microtonal `@accid` on transposition; Verovio's apparent `1qs`↔`3qs` gestural swap; how well Verovio spaces several accidentals on one note.
- **LilyPond**: how `key-signature-interface::alteration-positions` (`scm/output-lib.scm:1082`) chooses a vertical position for a non-standard alteration — located, not read. Whether any shipped file changes the global scale — none found by grep, so the feature looks unexercised in-tree.
- **Ekmelily / Ekmelos**: not on disk; what is written in §1.8 comes from a small-model summary of its GitHub source, and its list of supported tunings is UNKNOWN (README silent, project site unreachable today).
- **MuseScore**: no issue-tracker reference for tuning support appears in the accidental sources; the "long-standing request" was not verified. How MEI import in MuseScore treats `accid.ges` was not read. The MusicXML exporter was read only around the `alter` lines.
- **MEI**: the `att.keyAccid.*` classes and `keyAccid@form` (`implicit` / `explicit`, ODD :33601) were seen but not followed; MEI's guidelines prose (as opposed to the schema) was not consulted. Whether MEI 6 plans a numeric gestural alteration is UNKNOWN.
- **Verovio**: whether `CustomTuning` can differ per staff was judged only from where the member lives (`ScoreDef`). The `.ascl` note-name grammar was read from Verovio's regexes, not from Ableton's specification.
- Not studied at all: Helmholtz-Ellis/Sagittal *semantics* (which combinations are legal, stacking order), Dorico's tonality-system model (not on disk), and MusicXML's `<accidental smufl="…">` beyond what the two importers reveal.
