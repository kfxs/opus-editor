/**
 * ⭐ **COPY/PASTE OF A SELECTED ELEMENT** — the second thing the clipboard can hold. His ask,
 * 2026-08-19: *"if i select an expression i want to be able to copy with ctrl c so i can paste it in
 * other place with ctrl v"*.
 *
 * ⭐ **The clip is the MARK, not its place.** What travels is what the user typed and how it reads
 * (`text`, `placement`, the voice it governed); WHERE it lands is the separate {@link PasteAnchor}
 * argument — `utils/clip`'s own split, for its reason: a clip with no position in it is pasteable
 * anywhere, any number of times. No id travels either, so a paste is always a NEW mark rather than
 * a second reference to the copied one.
 *
 * ⭐ **A second kind is a ROW here**, not a branch somewhere else: the union grows an arm, `copyElement`
 * grows a case that reads the model, `pasteElement` grows the case that writes it. The dynamic (which
 * is what an *expression* is in this model — the mark IS its text, see `types/music.ts` `Dynamic`),
 * the TEMPO mark and the HAIRPIN travel today; a clef or a meter would slot in the same way.
 *
 * ⭐⭐ **AND THE PASTE ASKS THE KIND WHERE IT MAY LAND.** A dynamic hangs off a slot of its own lane,
 * so the generic anchor is already its answer; a tempo mark lands on an ONSET, at-or-after the
 * requested beat, because that is where its ink is engraved and a barline is never one
 * (`engine/models/tempoOps.tempoAnchorAt`, Gould p. 183). ⛔ The anchor module answers *where the
 * selection points*; what a KIND may do with that point is the kind's own rule, and it lives here.
 *
 * ⛔ **Nothing about the drawing travels.** A hand-nudged offset lives in the engraving-overrides
 * compartment keyed by the copied mark's id, and that id is exactly what a paste does not reuse —
 * so the new mark arrives at its anchor's default place, which is the honest answer: the nudge was
 * authored against other music.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { Fraction, NoteDuration, Ottava, TempoMark, TrillContinuationLabel } from '../types/music'
import type { SelectedElement } from './EditorState'
import type { PasteAnchor } from './pasteAnchor'
import { tempoAnchorAt, tempoAtStop } from '../engine/models/tempoOps'
import { fracToNumber } from '../utils/fraction'

/** A copied DYNAMIC — a level (`f`), an expression word (`dolce`) or a mix of both. */
export interface DynamicElementClip {
  kind: 'dynamic'
  /** The whole printed string, verbatim (glyphs + words) — the mark IS its text. */
  text: string
  placement: 'above' | 'below'
  /** ⭐ The SCOPE it governed — **absent = every voice of its staff**, and it travels verbatim: the
   *  paste anchor supplies the PLACE, never the scope (see {@link pasteElement}). */
  voice?: 0 | 1 | 2 | 3
}

/**
 * A copied TEMPO MARK — the mark IS its text, and what it SOUNDS travels beside it (`{unit, dots,
 * bpm}`, exactly as the model stores them: parsed from the text on every edit, never re-derived).
 * The `ClipTempo` shape the music clip already uses, minus the offset — where it lands is the
 * anchor's business, not the clip's.
 */
export interface TempoElementClip {
  kind: 'tempo'
  /** The mark exactly as printed. See `TempoMark.text`. */
  text?: string
  unit?: NoteDuration
  dots?: number
  bpm?: number
}

/**
 * A copied HAIRPIN (his ask, 2026-08-20). ⭐⭐ **Its LENGTH travels**, and that is the whole
 * difference from the two marks above: a wedge is not a point but an AMOUNT OF MUSIC, so what makes
 * it the mark it is includes how far it reaches ({@link Hairpin.length}). The paste lands its START
 * at the anchor and the extent follows, exactly as `hairpinOps.setHairpinAtSlot` moves one.
 *
 * ⛔ **The MOUTH does not travel**, nor either end's nudge: all three live in the engraving-overrides
 * compartment keyed by the copied wedge's id, and that id is what a paste never reuses. The new
 * wedge therefore opens at the automatic, length-aware aperture — the honest answer, since a
 * hand-set mouth was authored against the old wedge's length.
 */
export interface HairpinElementClip {
  kind: 'hairpin'
  /** Which wedge: 'cresc' opens to the right, 'dim' closes to the right. */
  type: 'cresc' | 'dim'
  /** How much music it covers, in quarter-note beats — the same unit as `Hairpin.length`. */
  length: Fraction
  placement: 'above' | 'below'
  /** ⭐ The SCOPE it governed — absent = every voice of its staff, and it travels verbatim, exactly
   *  as a dynamic's does ({@link DynamicElementClip.voice}). */
  voice?: 0 | 1 | 2 | 3
}

/**
 * A copied OTTAVA (his ask, 2026-08-21). ⭐ The wedge's shape and for the wedge's reason: an octave
 * bracket is not a point but an AMOUNT OF MUSIC, so how far it reaches is part of what makes it the
 * mark it is, and the paste lands its BEGINNING at the anchor with the extent following.
 *
 * ⭐⭐ **`shift` IS THE WHOLE STATEMENT** — one signed number carrying the size AND the side (+1 = 8va
 * above, −2 = 15mb below; see {@link Ottava.shift}). ⛔ There is no `placement` to travel beside it,
 * and copying one would be the mistake that type exists to prevent: a stored side could contradict
 * the stored shift.
 *
 * ⛔ **And no `voice`**, unlike the dynamic and the wedge: an octave line governs the whole STAFF, so
 * there is no scope to carry. The anchor's staff is the only placement question a paste asks.
 *
 * ⛔ Nothing about the drawing travels — both ends' nudges and the shared height are overrides keyed
 * by the copied bracket's id, and a paste never reuses one.
 */
export interface OttavaElementClip {
  kind: 'ottava'
  /** How much music it covers, in quarter-note beats — the same unit as `Ottava.length`. */
  length: Fraction
  /** Octaves of displacement, signed: the size and the side in one number. */
  shift: Ottava['shift']
}

/**
 * A copied SLUR — its SPAN and which side it was drawn on (his ask, 2026-08-20).
 *
 * ⭐⭐ **A slur's identity is two NOTE IDS, and those mean nothing anywhere else** — which is why a
 * curve could not travel at all until now, where a wedge could. What travels instead is *"a slur
 * over this much music"*, and the paste resolves the two ends against the destination's own notes
 * (`engine/models/slurOps.slurSpanAt`). ⚠️ A rule, not a promise: the destination's rhythm is its
 * own, so the span may cover a different number of notes there — the same approximation the
 * hairpin's `length` makes.
 *
 * ⛔ **The arc's SHAPE does not travel** — its endpoint nudges and its hand-pulled control points are
 * overrides keyed by the copied slur's id, and a single element arrives at its anchor's default
 * (the rule of 2026-08-20: a PASSAGE keeps the shaping, a lone element does not).
 */
export interface SlurElementClip {
  kind: 'slur'
  /** How much music it covered, in quarter beats. See {@link slurOps.slurSpanOf}. */
  span: Fraction
  /** ⭐ Only when it was DECIDED: an absent placement lets the renderer read the stems, and copying
   *  an absence is what reproduces that. */
  placement?: 'above' | 'below'
}

/**
 * A copied TRILL (his ask, 2026-08-20). ⭐ The slur's shape, for the slur's reason: its identity is a
 * NOTE plus an extent, and a note id means nothing anywhere else — so what travels is *"a trill over
 * this much music"* and the paste resolves the far end against the destination's own notes
 * (`MusicEngine.createTrillOverSpan`).
 *
 * ⭐⭐ **The three ways it READS travel with it** — which side it is on, how a continuation system
 * labels it, and whether it draws its line at all. Those are decisions the engraver made about THIS
 * mark, exactly as a dynamic's `placement` is; ⛔ what does not travel is where the ink was nudged,
 * which was authored against other music (the compartment is keyed by the copied id, and a paste
 * never reuses one).
 *
 * ⚠️ **A span of ZERO is the one-note trill**, whose extent is its own note's sounding duration —
 * absent by design ({@link Trill.endNoteId}), and reproduced by asking for no end at all.
 */
export interface TrillElementClip {
  kind: 'trill'
  /** How much music it covered, in quarter beats. 0 = the one-note trill. */
  span: Fraction
  /** ⭐ Only when it was DECIDED — an absent placement is the default `above`. */
  placement?: 'above' | 'below'
  /** How a continuation system labels it — `(tr)` by default, so only a departure travels. */
  continuationLabel?: TrillContinuationLabel
  /** ⭐ The BARE `tr`: no wavy line at all. It is how the mark reads, so it travels. */
  extension?: 'none'
}

/** One copied on-score element. Grows an arm per kind that learns to travel. */
export type ElementClip =
  | DynamicElementClip | TempoElementClip | HairpinElementClip | SlurElementClip
  | TrillElementClip | OttavaElementClip

/** What the element clipboard needs off the engine — a Pick, so a spec needs no renderer. */
export type ElementClipEngine = Pick<MusicEngine,
  'getDynamicById' | 'addDynamic' | 'staffIdForIndex'
  | 'getTempoMarkById' | 'addTempoMark' | 'removeTempoMark' | 'getScore' | 'runBatch'
  | 'getHairpinById' | 'addHairpin'
  | 'getSlurById' | 'slurSpanOf' | 'createSlurOverSpan'
  | 'getTrillById' | 'trillSpanBeats' | 'createTrillOverSpan'
  | 'getOttavaById' | 'addOttava'>

/** The clip for the currently selected element, or null when that kind cannot travel (yet). */
export function copyElement(engine: ElementClipEngine, element: SelectedElement | null): ElementClip | null {
  if (element?.kind === 'dynamic') {
    const dynamic = engine.getDynamicById(element.id)
    if (!dynamic) return null
    return { kind: 'dynamic', text: dynamic.text, placement: dynamic.placement ?? 'below', voice: dynamic.voice }
  }
  if (element?.kind === 'hairpin') {
    const hairpin = engine.getHairpinById(element.id)
    if (!hairpin) return null
    return {
      kind: 'hairpin',
      type: hairpin.type,
      length: hairpin.length,
      placement: hairpin.placement ?? 'below',
      ...(hairpin.voice !== undefined ? { voice: hairpin.voice } : {}),
    }
  }
  if (element?.kind === 'ottava') {
    const ottava = engine.getOttavaById(element.id)
    if (!ottava) return null
    return { kind: 'ottava', length: ottava.length, shift: ottava.shift }
  }
  if (element?.kind === 'slur') {
    const slur = engine.getSlurById(element.id)
    const span = engine.slurSpanOf(element.id)
    if (!slur || !span) return null
    return { kind: 'slur', span, ...(slur.placement !== undefined ? { placement: slur.placement } : {}) }
  }
  if (element?.kind === 'trill') {
    const trill = engine.getTrillById(element.id)
    const span = engine.trillSpanBeats(element.id)
    if (!trill || !span) return null
    return {
      kind: 'trill',
      span,
      ...(trill.placement !== undefined ? { placement: trill.placement } : {}),
      ...(trill.continuationLabel !== undefined ? { continuationLabel: trill.continuationLabel } : {}),
      ...(trill.extension !== undefined ? { extension: trill.extension } : {}),
    }
  }
  if (element?.kind === 'tempo') {
    const mark = engine.getTempoMarkById(element.id)
    if (!mark) return null
    return {
      kind: 'tempo',
      ...(mark.text !== undefined ? { text: mark.text } : {}),
      ...(mark.unit !== undefined ? { unit: mark.unit } : {}),
      ...(mark.dots !== undefined ? { dots: mark.dots } : {}),
      ...(mark.bpm !== undefined ? { bpm: mark.bpm } : {}),
    }
  }
  return null
}

/**
 * Write the clip at `anchor` and answer what should now be SELECTED — the new mark, so a paste
 * leaves you holding what you just made (the note paste's rule). Null when the write was refused.
 */
export function pasteElement(engine: ElementClipEngine, clip: ElementClip, anchor: PasteAnchor): SelectedElement | null {
  switch (clip.kind) {
    case 'dynamic': {
      // ⭐⭐ **THE CLIP'S SCOPE WINS, and an absent one stays absent.** The anchor says WHERE the
      // mark lands — its measure, beat and staff — but not what it governs: scope is a property of
      // the mark, like `placement`, and it is what you copied. ⚠️ This used to read
      // `anchor.voice ?? clip.voice ?? 0`, so a staff-wide `f` pasted onto a voice-2 note came back
      // scoped to voice 2, and onto anything else came back scoped to voice 1 — a copy could never
      // reproduce a staff-wide mark. See docs/dynamic-voice-scope-plan.md (his call is owed here).
      const staffId = engine.staffIdForIndex(anchor.staff)
      const created = engine.addDynamic(anchor.measure, {
        beat: anchor.beat,
        text: clip.text,
        ...(clip.voice !== undefined ? { voice: clip.voice } : {}),
        placement: clip.placement,
        ...(staffId ? { staffId } : {}),
      })
      return created ? { kind: 'dynamic', id: created.id } : null
    }
    case 'hairpin': {
      // ⭐ The generic anchor IS a wedge's answer: a hairpin begins on a slot of its own lane, the
      // same address a dynamic hangs off — ⛔ unlike a tempo mark, which must find an ONSET because
      // its ink is engraved on one.
      //
      // ⚠️ **The LENGTH is taken as it was copied**, ⛔ never trimmed to what is left in the score: a
      // span running past the music is clamped where it is READ (`hairpinOps.hairpinSpan`), so a
      // wedge pasted near the end draws short and grows back if it is moved home — where trimming
      // here would quietly throw the music away.
      const staffId = engine.staffIdForIndex(anchor.staff)
      const created = engine.addHairpin(anchor.measure, {
        beat: anchor.beat,
        length: clip.length,
        type: clip.type,
        placement: clip.placement,
        ...(clip.voice !== undefined ? { voice: clip.voice } : {}),
        ...(staffId ? { staffId } : {}),
      })
      return created ? { kind: 'hairpin', id: created.id } : null
    }
    case 'ottava': {
      // ⭐ The generic anchor IS a bracket's answer, exactly as it is a wedge's: an octave line
      // begins on a slot of its own lane. ⛔ Not a NOTE (the slur's and the trill's rule) — a bracket
      // governs a REGION, so it needs a place rather than a notehead.
      //
      // ⚠️ **The LENGTH is taken as it was copied**, ⛔ never trimmed to what is left in the score: a
      // span running past the music is clamped where it is READ (`ottavaOps.ottavaSpan`), so a
      // bracket pasted near the end draws short and grows back if it is moved home.
      //
      // ⚠️ **A paste onto an occupied beat REPLACES** — `addOttava`'s upsert, the clef's rule and not
      // the wedge's: one (beat, staff) may hold at most one octave line, or no reader could say which
      // displacement is true (docs/ottava-plan.md §7.8). ⭐ It needs no batch here, since that op is
      // one write and records one undo entry.
      const staffId = engine.staffIdForIndex(anchor.staff)
      const created = engine.addOttava(anchor.measure, {
        beat: anchor.beat,
        length: clip.length,
        shift: clip.shift,
        ...(staffId ? { staffId } : {}),
      })
      return created ? { kind: 'ottava', id: created.id } : null
    }
    case 'slur': {
      // 🚨 **A slur needs a NOTE, and the anchor must NAME one** — ⛔ not merely point at a place.
      // His two reports, 2026-08-20: a paste into an empty bar drew a slur anyway (an address
      // resolves forward until it finds music), and *"for slurring a note we should be really close
      // to the bbox of that note"*. The anchor carries `noteId` when the selection was a note or the
      // click landed on one (`pasteAnchor`); when it does not, there is nothing to slur and this
      // says so.
      if (!anchor.noteId) return null
      const created = engine.createSlurOverSpan(anchor.noteId, clip.span, clip.placement)
      return created ? { kind: 'slur', id: created.id } : null
    }
    case 'trill': {
      // 🚨 **A trill needs a NOTE, and the anchor must NAME one** — the slur's rule, and its two
      // reports: an address resolves forward until it finds music, so a paste into an empty bar would
      // ornament a note bars away. A trill is a sign ON a notehead; if the pointer was not on one,
      // there is nothing to trill and this says so.
      if (!anchor.noteId) return null
      const created = engine.createTrillOverSpan(anchor.noteId, clip.span, {
        ...(clip.placement !== undefined ? { placement: clip.placement } : {}),
        ...(clip.continuationLabel !== undefined ? { continuationLabel: clip.continuationLabel } : {}),
        ...(clip.extension !== undefined ? { extension: clip.extension } : {}),
      })
      return created ? { kind: 'trill', id: created.id } : null
    }
    case 'tempo': {
      // ⭐⭐ **THE ANCHOR IS THE TEMPO'S OWN, not the generic slot** (his ask): a tempo mark lands on
      // an ONSET — the same stops its walk uses — resolved AT-OR-AFTER the requested beat, because
      // that is where its ink is engraved (`engine/models/tempoOps.tempoAnchorAt`, Gould p. 183).
      // ⛔ A barline is never one of them, whatever the selection was.
      const stop = tempoAnchorAt(engine.getScore(), { measure: anchor.measure, beat: anchor.beat })
      if (!stop) return null
      // ⚠️ At most ONE mark per beat (docs/tempo-marks-plan.md §4). A paste REPLACES the sitting
      // mark, which is what the music clip's own paste does with it (`rebarOps.restoreBeatAnchors`)
      // — and the two writes are one undo step, so a Ctrl+Z puts the old mark back.
      const sitting = tempoAtStop(engine.getScore(), stop)
      let created: TempoMark | null = null
      engine.runBatch(`Paste tempo mark at measure ${stop.measure}`, () => {
        if (sitting) engine.removeTempoMark(sitting.id)
        created = engine.addTempoMark(stop.measure, {
          beat: stop.beat,
          ...(clip.text !== undefined ? { text: clip.text } : {}),
          ...(clip.unit !== undefined ? { unit: clip.unit } : {}),
          ...(clip.dots !== undefined ? { dots: clip.dots } : {}),
          ...(clip.bpm !== undefined ? { bpm: clip.bpm } : {}),
        })
      })
      return created ? { kind: 'tempo', id: (created as TempoMark).id } : null
    }
    default:
      throw new Error(`Unhandled element clip: ${JSON.stringify(clip)}`)
  }
}

/** A short human-readable line for the copy/paste console dump. */
export function elementClipSummary(clip: ElementClip): string {
  if (clip.kind === 'trill') {
    const beats = fracToNumber(clip.span)
    return beats > 0 ? `trill over ${beats} beats` : 'trill on one note'
  }
  if (clip.kind === 'slur') return `slur over ${fracToNumber(clip.span)} beats`
  if (clip.kind === 'hairpin') {
    return `hairpin ${clip.type} of ${fracToNumber(clip.length)} beats (${clip.placement})`
  }
  if (clip.kind === 'ottava') {
    // ⭐ Named as the READER sees it, ⛔ never "shift +1", which is the storage. ⚠️ ASCII on purpose —
    // this is a console line, not ink; the drawn numerals are SMuFL glyphs and these are the names
    // those glyphs print (`engine/rendering/ottavaStyle.OTTAVA_NUMERAL_GLYPHS`).
    const name = { 1: '8va', '-1': '8ba', 2: '15ma', '-2': '15mb', 3: '22ma', '-3': '22mb' }
    return `${name[clip.shift]} over ${fracToNumber(clip.length)} beats`
  }
  const how = clip.kind === 'dynamic' ? ` (${clip.placement})` : ''
  return `${clip.kind} "${clip.text ?? ''}"${how}`
}
