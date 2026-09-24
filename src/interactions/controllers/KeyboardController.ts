import { dbg } from '@/utils/debug'
import type { ArticulationType, Note, PitchStep, PitchAlter, Fraction, Score } from '../../types/music'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { EditorState } from '../state/EditorState'
import { activeVoiceToModel, armedTool, armedNormalSide, armedTupletM, spendArmedTuplet } from '../state/EditorState'
import { navBeatMap, type FlatNote } from '../../utils/beatMap'
import { graceHostId } from '../walks/graceStops'
import { continuingStamp, gracePitchesAt, typeGraceAtCaret } from '../stamps/graceKeyboard'
import { getMeasureNotes } from '../../utils/musicUtils'
import { measureCapacityFrac } from '../../utils/measureCapacity'
import { fracToNumber, fracEq, fracFromInt, fracSub } from '../../utils/fraction'
import { spellingToMidi, accidentalToAlter, formatPitch } from '../../utils/pitchSpelling'
import { entryAlteration } from '../../engine/models/entryAlteration'
import { fitRestDuration } from '../../utils/durations'
import { staffOf, voiceOf } from '@/utils/lanes'

/** Natural (no-accidental) semitone offsets for each step letter */
const STEP_SEMITONES: Record<PitchStep, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

/** Letter → PitchStep mapping */
const LETTER_TO_STEP: Record<string, PitchStep> = {
  c: 'C', d: 'D', e: 'E', f: 'F', g: 'G', a: 'A', b: 'B',
}

/**
 * Handles keyboard note/rest entry.
 * Framework-agnostic: reads/writes EditorState directly, no Vue/React/Angular imports.
 */
export class KeyboardController {
  constructor(
    private getEngine: () => MusicEngine | null,
    private state: EditorState,
    private getPendingArticulations: () => ArticulationType[] | undefined,
    private renderScore: () => void,
    private setSelectedNote: (id: string | null) => void,
    private getContextPitch: () => number,
    // Scroll the viewport so the just-entered/advanced note stays visible. Called AFTER
    // renderScore() so the note's fresh bbox is in the registry (mirrors navigateNote's
    // select→render→scroll order). Defaults to a no-op for headless/test construction.
    private scrollSelectedNoteIntoView: () => void = () => {},
  ) {}

  /**
   * Enter a note by letter key (a–g).
   * In selection mode: edits the selected note in place and switches to keyboard entry mode.
   * In entry mode: places a new note at the cursor position and advances it.
   */
  enterNoteByLetter(letter: string): void {
    const engine = this.getEngine()
    if (!this.state.selectedNoteId || !engine) return
    if (this.state.selectedTool !== 'selection' && this.state.selectedTool !== 'entry') return

    const step = LETTER_TO_STEP[letter]
    if (!step) return
    this.disarmRestOnNoteEntry()

    if (this.state.selectedTool === 'entry') {
      this.enterNoteAtCursorPosition(step)
      return
    }

    // Selection mode: edit in place, then switch to keyboard mode
    const reference = this.getContextPitch()
    const naturalPitchClass = STEP_SEMITONES[step]
    const k = Math.round((reference - naturalPitchClass) / 12)
    const targetMidi = naturalPitchClass + 12 * k
    const octave = Math.floor(targetMidi / 12) - 1

    // A measure rest's duration is the nominal 'w' (= "fill the bar"), not a real
    // chosen value, so converting it to a note must NOT inherit 'w' (a redonda
    // that overflows any non-4/4 bar). Use the armed palette duration instead;
    // the bar's remainder is rest-filled downstream. Normal rests keep their own
    // duration (replace a quarter rest with a quarter note).
    const selected = engine.getNote(this.state.selectedNoteId)
    // The letter lands where the selected note already is, so the key and the bar's accidentals are
    // read THERE — the same rule as entry ({@link entryAlteration}), armed accidental first.
    const alter: PitchAlter = selected
      ? entryAlteration(
        engine.getScore(), { measure: selected.measure, beat: selected.beat, staff: selected.staff },
        step, octave, this.state.selectedAccidental,
      )
      : accidentalToAlter(this.state.selectedAccidental)
    const measureRestDuration = selected?.isMeasureRest
      ? { duration: this.state.selectedDuration, dots: this.state.selectedDots }
      : {}

    const updatedNote = engine.updateNote(this.state.selectedNoteId, {
      step,
      alter,
      octave,
      isRest: false,
      ...measureRestDuration,
      ...(this.state.selectedAccidental === 'n' && { forceAccidental: true }),
    })

    dbg(`✓ KeyboardEntry (edit-in-place) | ${formatPitch({ step, alter, octave })} dur:${updatedNote.duration} measure:${updatedNote.measure} beat:${fracToNumber(updatedNote.beat).toFixed(3)}`)

    this.state.selectedAccidental = null
    this.state.selectedTool = 'entry'
    this.renderScore()
    this.scrollSelectedNoteIntoView()
  }

  /**
   * Place a note at the cursor position (the beat after selectedNoteId).
   * Overwrites whatever is there, filling leftover space with rests.
   * Handles measure overflow via tie splitting. Advances selectedNoteId.
   */
  /**
   * Where the next keyboard entry should land, given the cursor's position in its
   * voice-scoped beat stream. Returns the next slot when it's in the SAME measure;
   * otherwise — the cursor is on this voice's last slot in the current measure —
   * flows into the immediately-following measure's downbeat so entry continues into
   * the next bar even when this voice has no content there yet (it gets materialised
   * on placement). Returns null only at the genuine end of the score.
   *
   * This makes secondary-voice entry behave like voice 1: voice 1's stream has a slot
   * (a rest) in every measure, so it never stalls at a barline; a sparse voice would,
   * without this boundary fallback.
   */
  private nextEntryPosition(
    currentNote: FlatNote,
    beats: FlatNote[],
    currentIndex: number,
    score: Score,
  ): { targetMeasure: number; targetBeat: Fraction } | null {
    const nextBeat = beats[currentIndex + 1]
    if (nextBeat && nextBeat.measureNumber === currentNote.measureNumber) {
      return { targetMeasure: nextBeat.measureNumber, targetBeat: nextBeat.beat }
    }
    const nextMeasure = score.measures
      .filter(m => m.number > currentNote.measureNumber)
      .sort((a, b) => a.number - b.number)[0]
    if (!nextMeasure) return null // genuine end of score
    return { targetMeasure: nextMeasure.number, targetBeat: fracFromInt(0) }
  }

  /**
   * Typing a NOTE says what you are entering, and it is not rests — so the armed rest stamp goes,
   * and the Keypad's `0` unlights with it. The lit key is a claim about what the next thing entered
   * will be; a typed letter settles that, and leaving it armed would leave the panel saying "rests"
   * while notes come out.
   *
   * Stays in ENTRY mode, unlike a re-press of the key (which disarms all the way back to selection):
   * you are still typing, just typing notes. The armed LENGTH is untouched — the quarter you were
   * resting is the quarter you are now noting.
   *
   * Only the rest tool. The other eight place things with the MOUSE, and a typed note says nothing
   * about whether the next CLICK still puts a clef down; this one competes with typing itself.
   */
  private disarmRestOnNoteEntry(): void {
    if (!armedTool(this.state, 'rest')) return
    this.state.selectedMarkingTool = null // reassign, never mutate — the Proxy traps the SET
    dbg('[Keyboard] a note was typed → the rest stamp disarms')
  }

  /**
   * SPACE in keyboard entry: TYPE a rest of the current duration at the cursor and move on — the
   * typewriter's space bar. Fires WHENEVER you are entering, armed or not: with the rest stamp lit
   * it is the tool's keyboard half; without it, it is the fast-entry shortcut — type letters for
   * notes, tap SPACE for a rest of the same length, keep typing (MuseScore's "rest of the current
   * duration"). Either way the length is the armed palette duration — the length your next note
   * would be — so the rest tool need not be selected first. Returns whether it consumed the key, so
   * SPACE keeps its other meaning (entering entry mode from a selection) untouched.
   *
   * The stamp places with the mouse, at a beat you point to; this places at the caret, at the beat
   * that comes next, and the two share the rule that matters — {@link fitRestDuration}, so what a
   * barline does to a rest is one answer, not two.
   *
   * A rest is capped at the barline, never split: an overflowing NOTE splits and ties across it, and
   * a tied rest is not a thing. So the length is trimmed to what the bar has left ("the longest
   * value available, single dot included" — three beats is a dotted half). The caret then lands
   * wherever the entry ended, which puts it at the next bar's downbeat exactly when the rest finished
   * the bar — no rule of its own, just where the typewriter left the carriage.
   *
   * The armed length is NOT consumed: SPACE again types the same rest, which is what makes it a
   * typewriter rather than a one-shot.
   */
  enterRestAtCursor(): boolean {
    const engine = this.getEngine()
    if (this.state.selectedTool !== 'entry') return false
    if (!this.state.selectedNoteId || !engine) return false

    // What YOU armed — fitted against the bar's remainder below. The caret no longer clobbers the
    // palette (moveCaretTo keeps it), so nothing has to put this back afterwards.
    const armedDuration = this.state.selectedDuration
    const armedDots = this.state.selectedDots

    const score = engine.getScore()
    // Continue the cursor note's own voice/staff (see enterNoteAtCursorPosition).
    const cursorNote = engine.getNote(this.state.selectedNoteId)
    const cursorVoice = cursorNote ? voiceOf(cursorNote) : activeVoiceToModel(this.state.activeVoice)
    const cursorStaff = cursorNote ? staffOf(cursorNote) : this.state.activeStaff
    const { allFlat, beats } = navBeatMap(score, this.state.selectedNoteId, cursorVoice, cursorStaff)

    const currentNote = allFlat.find(n => n.id === this.state.selectedNoteId)
    if (!currentNote) return false
    const currentKey = `${currentNote.measureNumber}:${currentNote.beat.num}/${currentNote.beat.den}`
    const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat.num}/${n.beat.den}` === currentKey)
    if (currentIndex === -1) return false

    const next = this.nextEntryPosition(currentNote, beats, currentIndex, score)
    if (!next) {
      dbg('[Keyboard] rest: cursor is at the end of the score')
      return true // consumed: the tool IS armed, there is simply nowhere to go
    }
    const { targetMeasure, targetBeat } = next

    const measure = score.measures.find(m => m.number === targetMeasure)
    if (!measure) return true
    const available = fracSub(measureCapacityFrac(measure), targetBeat)
    const fitted = fitRestDuration(armedDuration, armedDots, available)
    if (!fitted) {
      dbg(`[Keyboard] rest: no room at m${targetMeasure} b${fracToNumber(targetBeat).toFixed(3)}`)
      return true
    }
    const capped = fitted.duration !== armedDuration || fitted.dots !== armedDots
    if (capped) {
      dbg(`[Keyboard] rest: ${armedDuration}${'.'.repeat(armedDots)} exceeds the ${fracToNumber(available).toFixed(3)} beat(s) left in m${targetMeasure} → ${fitted.duration}${'.'.repeat(fitted.dots)}`)
    }

    const newRest = engine.addNoteAtBeat({
      duration: fitted.duration,
      measure: targetMeasure,
      beat: targetBeat,
      isRest: true,
      ...(fitted.dots && { dots: fitted.dots }),
      // ⭐ Entry CUE armed ⇒ a cue rest (cue-size-plan — entry takes what is armed).
      ...(this.state.selectedCue && { cue: true as const }),
      ...(cursorVoice && { voice: cursorVoice }),
      ...(cursorStaff && { staff: cursorStaff }),
    })
    if (!newRest) {
      dbg('[Keyboard] rest: addNoteAtBeat returned null')
      this.renderScore()
      return true
    }

    dbg(`✓ KeyboardEntry | REST ${newRest.duration}${'.'.repeat(newRest.dots ?? 0)} measure:${newRest.measure} beat:${fracToNumber(newRest.beat).toFixed(3)}`)
    // The caret follows what was just typed, so the next SPACE lands after it. moveCaretTo (the
    // injected caret setter) does NOT re-arm the palette from the rest it lands on — a cap is not a
    // choice — so a barline-trimmed rest never redefines the armed length. See
    // SelectionController.moveCaretTo.
    this.setSelectedNote(newRest.id)

    this.renderScore()
    this.scrollSelectedNoteIntoView()
    return true
  }

  /**
   * SPACE in selection mode on a selected note: start keyboard entry FROM it (the palette already holds
   * its value — the selection synced it). ⭐ On a note that carries a stamp's STATUS — a GRACE, its
   * form — that stamp is armed too, so the letters go on typing what was selected (his ask, 2026-09-22;
   * `../stamps/graceKeyboard.continuingStamp`). @returns whether entry started.
   */
  startEntryAtSelection(): boolean {
    if (this.state.selectedTool !== 'selection' || !this.state.selectedNoteId) return false
    this.state.selectedTool = 'entry'
    const engine = this.getEngine()
    const stamp = engine ? continuingStamp(engine, this.state.selectedNoteId) : null
    if (stamp) this.state.selectedMarkingTool = stamp
    return true
  }

  enterNoteAtCursorPosition(step: PitchStep): void {
    const engine = this.getEngine()
    if (!this.state.selectedNoteId || !engine) return

    const score = engine.getScore()
    // Keyboard entry CONTINUES the voice of the note the cursor sits on — you're
    // extending that voice's stream, so the new note (and the cursor's advance)
    // must stay in it, not in whatever voice the palette toggle last held. Fall
    // back to the active voice only when the cursor note has no resolvable voice.
    const cursorNote = engine.getNote(this.state.selectedNoteId)
    // ⭐ A GRACE as the caret (the stamp leaves it there): the letter typed is its MAIN note — entered
    //    AT the main note's place, not after it (his rule, 2026-09-22; `./keyboardCaret` draws it).
    const graceHost = graceHostId(score, this.state.selectedNoteId)
    const cursorVoice = cursorNote ? voiceOf(cursorNote) : activeVoiceToModel(this.state.activeVoice)
    // Keyboard entry also CONTINUES the cursor note's staff (falling back to the active staff
    // when the cursor note has none), so a run of entered notes stays on one staff.
    const cursorStaff = cursorNote ? staffOf(cursorNote) : this.state.activeStaff
    const { allFlat, beats } = navBeatMap(score, graceHost ?? this.state.selectedNoteId, cursorVoice, cursorStaff)

    const currentNote = allFlat.find(n => n.id === (graceHost ?? this.state.selectedNoteId))
    if (!currentNote) {
      dbg('[Cursor] enterNoteAtCursorPosition: currentNote not found for id', this.state.selectedNoteId)
      return
    }
    const currentKey = `${currentNote.measureNumber}:${currentNote.beat.num}/${currentNote.beat.den}`
    const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat.num}/${n.beat.den}` === currentKey)
    if (currentIndex === -1) {
      dbg('[Cursor] enterNoteAtCursorPosition: beat not found in beatMap for key', currentKey)
      return
    }

    const next = graceHost
      ? { targetMeasure: currentNote.measureNumber, targetBeat: currentNote.beat }
      : this.nextEntryPosition(currentNote, beats, currentIndex, score)
    if (!next) {
      dbg('[Cursor] enterNoteAtCursorPosition: cursor is at end of score, nowhere to place note')
      return
    }
    const { targetMeasure, targetBeat } = next

    dbg(`[Cursor] position: m${currentNote.measureNumber} beat:${fracToNumber(currentNote.beat).toFixed(4)} (${currentNote.isRest ? 'rest' : `${currentNote.step ?? '?'}${currentNote.octave ?? ''}`}${currentNote.tupletId ? ' tuplet' : ''}) → targeting m${targetMeasure} beat:${fracToNumber(targetBeat).toFixed(4)}`)

    // The octave is the nearest to the note the caret sits on — the GRACE's own pitch, after a grace.
    const reference = graceHost && cursorNote ? cursorNote : currentNote
    const referenceMidi = (!reference.isRest && reference.step)
      ? spellingToMidi(reference.step, reference.alter!, reference.octave!)
      : this.getContextPitch()
    const naturalPitchClass = STEP_SEMITONES[step]
    const k = Math.round((referenceMidi - naturalPitchClass) / 12)
    const targetMidi = naturalPitchClass + 12 * k
    const octave = Math.floor(targetMidi / 12) - 1
    // ⭐ The armed accidental if there is one, else what is in force at the target — the bar's
    //   running accidental, else the KEY. A typed F in G major is an F♯ that draws no sign
    //   ({@link entryAlteration}); it used to be an F♮ wearing a natural (plan §3.1).
    // ⚠️ After the octave, which the LETTER alone decides — nothing above reads the alteration.
    const alter: PitchAlter = entryAlteration(
      score, { measure: targetMeasure, beat: targetBeat, staff: cursorStaff },
      step, octave, this.state.selectedAccidental,
    )

    // ⭐ The GRACE stamp armed: the letter types a GRACE there instead (`../stamps/graceKeyboard`).
    if (armedTool(this.state, 'grace')) {
      const grace = typeGraceAtCaret(engine, this.state, this.state.selectedNoteId,
        { measure: targetMeasure, beat: targetBeat, voice: cursorVoice, staff: cursorStaff },
        { step, alter, octave, ...(this.state.selectedAccidental === 'n' && { forceAccidental: true }) })
      if (!grace) return
      this.state.selectedAccidental = null // one note's accidental, as for a typed note
      this.setSelectedNote(grace)
      this.renderScore()
      this.scrollSelectedNoteIntoView()
      return
    }

    const existingTuplet = engine.getTupletAtBeat(targetMeasure, targetBeat, cursorVoice, cursorStaff)
    dbg(`KeyboardEntry RAW | ${step}${alter !== 0 ? (alter > 0 ? '#' : 'b') : ''} dur:${this.state.selectedDuration} measure:${targetMeasure} beat:${fracToNumber(targetBeat).toFixed(3)} tuplet:${this.state.armedTuplet ? `${this.state.armedTuplet.numNotes}:${this.state.armedTuplet.notesOccupied}` : 'off'} existingTuplet:${existingTuplet ? existingTuplet.id : 'none'}`)

    const measure = score.measures.find(m => m.number === targetMeasure)
    if (!measure) return

    let newNote: Note | null

    if (this.state.armedTuplet && !existingTuplet) {
      const result = engine.createTupletAtBeat(
        targetMeasure,
        fracToNumber(targetBeat),
        this.state.selectedDuration,
        { step, alter, octave },
        this.state.armedTuplet.numNotes,
        // M from the METER at the caret, not from the keypress — see armedTupletM.
        armedTupletM(
          this.state.armedTuplet,
          this.state.selectedDuration,
          this.state.selectedDots,
          measure.timeSignature,
          targetBeat,
        ),
        cursorVoice,
        cursorStaff,
        // The armed dot IS the tuplet's unit dot — 'a dotted quarter' is one armed value, not two.
        this.state.selectedDots,
        armedNormalSide(this.state.armedTuplet),
        this.state.armedTuplet.format,
      )
      newNote = result ? result.firstNote : null
      // The group exists now, so the ratio has been spent — the notes that follow fill it through
      // the ordinary path below, which joins the tuplet at that beat. Only on success.
      if (newNote) spendArmedTuplet(this.state)
    } else {
      // The note continues the cursor note's voice. An existing tuplet found here
      // is already in that voice (getTupletAtBeat is voice-scoped), so joining it
      // stays in the same stream.
      const entryVoice = cursorVoice
      newNote = engine.addNoteAtBeat({
        step,
        alter,
        octave,
        duration: this.state.selectedDuration,
        measure: targetMeasure,
        beat: targetBeat,
        dots: this.state.selectedDots || undefined,
        isRest: false,
        articulations: this.getPendingArticulations(),
        // The armed entry tremolo (docs/plans/tremolo-plan.md §10) — the typed note is born wearing it,
        // exactly as the clicked one is.
        ...(this.state.selectedTremolo !== null && { tremolo: this.state.selectedTremolo }),
        // …and the armed entry BRACKETS (parenthesised-note-plan P4b).
        ...(this.state.selectedEnclosure !== null && { enclosure: this.state.selectedEnclosure }),
        // …and entry CUE (cue-size-plan).
        ...(this.state.selectedCue && { cue: true as const }),
        ...(this.state.selectedAccidental === 'n' && { forceAccidental: true }),
        ...(existingTuplet && { tupletId: existingTuplet.id }),
        ...(this.state.selectedBeam !== 'auto' && { beam: this.state.selectedBeam }),
        ...(entryVoice && { voice: entryVoice }),
        ...(cursorStaff && { staff: cursorStaff }),
      })
    }

    if (!newNote) {
      dbg('✗ KeyboardEntry | placement failed')
      this.renderScore()
      return
    }

    // Follow the tie chain to the last note so the cursor lands after all tied continuations.
    //
    // RE-READ the head first. `addNoteAtBeat` returns a flat PROJECTION built when the note was
    // created, and a split attaches its ties afterwards (spanningNoteOps.placeSpanningNote: addNote → updateNote
    // tiedTo) — so the returned object's `tiedTo` is `undefined` no matter what the model says. The
    // walk below seeded from it, found no tie, and left the cursor on the HEAD: type a whole note
    // across a barline and the caret landed inside the note you had just typed, so the next one
    // overwrote its own tail. The loop's later hops already read from the score; only the seed was
    // stale, which is why this looked like it worked.
    const scoreAfter = engine.getScore()
    let lastNote = engine.getNote(newNote.id) ?? newNote
    let safetyLimit = 16
    while (lastNote.tiedTo && safetyLimit-- > 0) {
      const tied = scoreAfter.measures.flatMap(m => getMeasureNotes(m)).find(n => n.id === lastNote.tiedTo)
      if (!tied) break
      lastNote = tied
    }
    if (lastNote.id !== newNote.id) {
      dbg(`[Keyboard] Tie chain: cursor advanced to last tied note id=${lastNote.id} measure=${lastNote.measure} beat=${fracToNumber(lastNote.beat).toFixed(3)}`)
    }

    // Clear the armed accidental after each entered note (a sharp lasts one note, not forever).
    // ⚠️ OPEN UX CALL, not a settled rule: this differs from duration/dots, which persist until the
    // user changes them. Kept for now (user decision 2026-07-18); to make the accidental persist too,
    // delete this one line — moveCaretTo no longer syncs it back, so it will simply stick.
    this.state.selectedAccidental = null

    dbg(`[Cursor] → cursor lands on: m${lastNote.measure} beat:${fracToNumber(lastNote.beat).toFixed(4)} (${lastNote.isRest ? 'rest' : `${lastNote.step}${lastNote.octave}`}${lastNote.tupletId ? ' tuplet' : ''})`)
    // A SPLIT IS NOT A CHOICE — a whole entered on beat 2 of 4/4 becomes a dotted half tied to a
    // quarter, and the caret lands on the QUARTER. moveCaretTo keeps the palette (you armed a whole;
    // you still have a whole) rather than re-arming it to the tail. See SelectionController.moveCaretTo.
    this.setSelectedNote(lastNote.id)

    this.renderScore()
    this.scrollSelectedNoteIntoView()
  }

  /**
   * Add a note to the chord at the selected note's position (Shift + letter key).
   * New note's pitch is >= the highest pitch already in the chord.
   * Falls back to enterNoteByLetter if a rest is selected.
   */
  addChordNoteByLetter(letter: string): void {
    const engine = this.getEngine()
    if (!this.state.selectedNoteId || !engine) return
    if (this.state.selectedTool !== 'selection' && this.state.selectedTool !== 'entry') return

    const step = LETTER_TO_STEP[letter]
    if (!step) return
    this.disarmRestOnNoteEntry() // Shift+letter is still typing a note — see enterNoteByLetter

    const note = engine.getNote(this.state.selectedNoteId)
    if (!note) return

    if (note.isRest) {
      this.enterNoteByLetter(letter)
      return
    }

    const score = engine.getScore()
    const measure = score.measures.find(m => m.number === note.measure)
    // Stack onto the selected note's OWN voice — both the existing-pitch scan and the
    // new note must stay in that voice, or the chord note lands in voice 1 by default.
    const noteVoice = voiceOf(note)
    const noteStaff = staffOf(note)
    // ⭐ A FANNED MEMBER is its OWN chord (docs/plans/fanned-beam-pitches-plan.md §2 P3): the pitches
    // already stacked here are the member's, not the slot's. Resolving this positionally — the
    // ordinary path below — reads the whole slot and then adds to `slot.notes`, which put the new
    // note on the group's FIRST head (his report).
    const memberPitches = engine.fanMemberPitches(this.state.selectedNoteId)
    // ⭐ …and a GRACE is its own chord too: stack on ITS pitches, add to IT (a grace chord).
    const gracePitches = gracePitchesAt(engine, this.state.selectedNoteId)
    const chordMidis = (gracePitches ?? memberPitches ?? (measure ? getMeasureNotes(measure, score) : [])
      .filter(n => !n.isRest && fracEq(n.beat, note.beat) && voiceOf(n) === noteVoice && staffOf(n) === noteStaff))
      .map(n => spellingToMidi(n.step!, n.alter!, n.octave!))
    const baseMidi = chordMidis.length > 0
      ? Math.max(...chordMidis)
      : spellingToMidi(note.step!, note.alter!, note.octave!)

    const naturalPitchClass = STEP_SEMITONES[step]
    const k = Math.ceil((baseMidi - naturalPitchClass) / 12)
    let targetMidi = naturalPitchClass + 12 * k
    if (targetMidi === baseMidi) targetMidi += 12
    const octave = Math.floor(targetMidi / 12) - 1
    // Same rule as plain entry — a chord note is still keyboard entry (see the note below on the
    // armed accidental), so the key must default it identically or a stacked F in G major alone
    // would come out natural.
    const alter: PitchAlter = entryAlteration(
      score, { measure: note.measure, beat: note.beat, staff: noteStaff },
      step, octave, this.state.selectedAccidental,
    )

    const spelledForce = this.state.selectedAccidental === 'n' ? { forceAccidental: true } : {}
    const newNote = gracePitches
      ? engine.grace.addGracePitch(this.state.selectedNoteId, { step, alter, octave, ...spelledForce })
      : memberPitches
      ? engine.addFanMemberPitch(this.state.selectedNoteId, { step, alter, octave })
      : engine.addChordNote({
        step,
        alter,
        octave,
        duration: note.duration,
        measure: note.measure,
        beat: note.beat,
        dots: note.dots,
        isRest: false,
        tupletId: note.tupletId,
        voice: noteVoice,
        ...(noteStaff && { staff: noteStaff }),
        // ⭐ Entry CUE armed ⇒ the chord is cue (its slot's; cue-size-plan — entry takes what is armed).
        ...(this.state.selectedCue && { cue: true as const }),
      })
    if (!newNote) return
    // Clear the armed accidental after the note, same as enterNoteAtCursorPosition — a chord note is
    // still keyboard entry, so the accidental must behave identically (one note, not sticky). Without
    // this, chord entry would keep the sharp while plain entry drops it: two rules, one confusing UX.
    this.state.selectedAccidental = null
    this.setSelectedNote(newNote.id)
    this.renderScore()
    this.scrollSelectedNoteIntoView()
  }
}
