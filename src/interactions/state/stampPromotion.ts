/**
 * ⭐ **What a DURATION PRESS does to the armed marking tool** — extracted from `PaletteController`
 * (it is a switch over every `MarkingTool` kind, and a hub may not hold one: `CLAUDE.md`, *"a new
 * feature adds a MODULE"*). Pure over the state: the press disarms whatever was armed, and the
 * stamps with an entry-mode home carry their value over first.
 */
import type { EditorState } from './EditorState'

/**
 * A duration press ends the armed marking tool — but two of the four stamps have somewhere to GO
 * first: their armed value becomes the NOTE-ENTRY armed value, which is the "accidental +
 * duration" and "dot + duration" (dotted quarter) flows. Returns the dots to arm, because
 * `PaletteController.setDuration`'s own reset would otherwise eat the dot promotion.
 *
 * Every kind is listed rather than defaulted, so a NINTH tool cannot be added without deciding
 * here whether it has an entry-mode home — the compiler asks.
 */
export function promoteStampToNoteEntry(state: EditorState): number {
  const armed = state.selectedMarkingTool
  state.selectedMarkingTool = null // whatever it was, a duration press disarms it
  switch (armed?.kind) {
    case 'articulation':
      state.accent = armed.types.includes('accent')
      state.staccato = armed.types.includes('staccato')
      state.tenuto = armed.types.includes('tenuto')
      return 0
    case 'accidental':
      state.selectedAccidental = armed.sign
      return 0
    case 'dot':
      return 1 // the ONLY promotion that carries dots; a plain press must still clear a stale one
    case 'rest':
      // UNREACHABLE: setDuration returns before this for any tool that uses the armed length —
      // a duration press retunes the armed rest rather than ending it. Listed because the switch
      // is exhaustive, and answering "no entry-mode home" is also the truth: the rest tool has
      // nowhere to be promoted TO. Placing rests with the mouse is not a property of a note.
      return state.selectedDots
    case 'grace':
    case 'bracketedGrace':
      // UNREACHABLE for the rest's reason: it reads the armed length, so a duration press retunes it.
      return state.selectedDots
    case 'tremolo':
      // The mark HAS an entry-mode home now (§10): pick a duration with a tremolo stamp armed and
      // you get note entry wearing that mark — "mark, then length" reaching the same place as
      // "length, then mark". Its own field, not `selectedDots`, so it returns 0 like the rest.
      state.selectedTremolo = armed.tremolo
      return 0
    case 'headEnclosure':
      // ⭐ Its entry-mode home (P4b), the tremolo's: brackets, then a length ⇒ note entry wearing them.
      state.selectedEnclosure = armed.shape
      return 0
    case 'fan':
      // It HAS a length, unlike the four below — and still promotes nothing. The feather's length
      // is the GESTURE's, typed in the dialog that armed it; a duration press is a statement about
      // the next NOTE, and it already carries the value it wants. Retuning the feather from a key
      // would also make the dialog's answer overrulable from outside it, which is the thing the
      // tool carrying its own length exists to prevent (see MarkingTool's `fan` member).
      return 0
    case 'tie':          // valueless — there is no armed entry-mode tie to become
    case 'slur':         // valueless too: a slur is a span between notes, not a property of one
    case 'ottava':       // a span too, and its length is the MUSIC's — the hairpin's answer exactly
    case 'pedal':        // …and the pedal: how long the damper is down is a fact about the MUSIC
    case 'hairpin':      // a span as well — and its length is the MUSIC's, never the armed one
    case 'trill':        // an ornament ON a note, whose extent is the ties' — nothing to carry
    case 'clef':         // the five below place OBJECTS, not note properties: nothing to carry
    case 'timeSignature':
    case 'keySignature': // a BOUNDARY statement about a bar — no note property, and no length
    case 'dynamic':
    case 'dynamicEntry': // places a text mark, not a note property — nothing to promote to
    case 'tempo':
    case 'tempoEntry':   // places a tempo mark — nothing to promote to (like `tempo`)
    case 'barline':      // a BOUNDARY between bars — not a property of a note, and it has no length
    case 'group':        // a sign beside the STAVES — not a note property, and no length to carry
    case undefined:      // nothing was armed: a plain duration press, which clears a stale dot
      // Dropping a stale accidental here is deliberate: an INTENTIONAL one arms the stamp (and so
      // lands in the 'accidental' case above), meaning one that survives to here can only be left
      // over from an earlier note-entry session.
      state.selectedAccidental = null
      return 0
  }
}
