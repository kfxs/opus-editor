/**
 * ⭐ **Every armed ROW that changes a WIDTH, as one list** — read by BOTH keys that must move when one
 * is re-armed: the width-cache fingerprint (`layout/MeasureWidthCache.laneFingerprint`) and the
 * renderer's LAYOUT key (`rendering/ScoreRenderer`). Each was a hand-kept copy of this list; a row in
 * one and not the other hands back memoised widths, or skips the re-cast, and the knob reports a
 * success that moved nothing (`reference_render_width_key_vs_shape_key`).
 *
 * ⛔ A new width knob adds its generation HERE, once.
 */
import { spacingGeneration } from './spacing'
import { headerGapGeneration } from './headerAccidentalLadder'
import { clefMeterGapGeneration } from './clefMeterGap'
import { barlineMeterGapGeneration } from './barlineMeterGap'
import { dotGapGeneration } from './dotGap'
import { restDotGapGeneration } from './restDotGap'
import { dotFlagGeneration } from './dotFlag'
import { dotVoiceGeneration } from './dotVoice'
import { accidentalGapGeneration } from './accidentalGap'
import { graceSizeGeneration } from './graceRoom'
import { bracketedGeneration } from './bracketedRoom'
import { cueSizeGeneration } from './cueSize'
import { graceSlashGeneration } from '@/engine/engrave/notes/graceGroup'
import { musicFontGeneration } from '@/engine/fonts/musicFont'
import { textFontGeneration } from '@/engine/fonts/textFont'

export function widthRowGenerations(): number[] {
  return [
    // The armed SPACING law — his experiment, 2026-09-01.
    spacingGeneration(),
    // The armed header-gap row (2026-09-02): closing the gap before an accidental makes a bar narrower.
    headerGapGeneration(),
    // The clef→meter and barline→meter rows: every header narrower or wider.
    clefMeterGapGeneration(),
    barlineMeterGapGeneration(),
    // The DOT gap (2026-09-14): bought per dot (`rendering/format/dotPlacement.reserveDotRoom`).
    dotGapGeneration(),
    // …and a REST's (2026-09-25, `layout/restDotGap`): the same purchase, from the rest's own table.
    restDotGapGeneration(),
    // …and whether a stem-up FLAG pushes them (2026-09-25, `layout/dotFlag`): a pushed dot is further out.
    dotFlagGeneration(),
    // …and which way a two-part line note's dot goes (`layout/dotVoice`) — ⚠️ NOT a width: here for the
    //    SHAPE key, like the slash below, so a re-arm re-engraves the bars it changes.
    dotVoiceGeneration(),
    // The ACCIDENTAL gap: `accidentalExtent` prices a sign's room from it.
    accidentalGapGeneration(),
    // The GRACE size (2026-09-22): a grace's room is its heads at that size (`layout/graceRoom`).
    graceSizeGeneration(),
    // The BRACKETED grace's size and bracket form (2026-09-23): its room is its head and brackets.
    bracketedGeneration(),
    // The CUE size and its ledger row (2026-09-24): a cue slot's room is its ink at that size.
    cueSizeGeneration(),
    // …and the no-flag SLASH (2026-09-22) — ⚠️ NOT a width: in this list because the fingerprint is
    // also the SHAPE key, and a re-armed slash must re-engrave the bars that draw one.
    graceSlashGeneration(),
    // The chosen MUSIC face — glyphs measured on the canvas are width inputs, and because the SHAPE
    // key embeds the fingerprint, this is also what re-engraves every bar in the new face.
    musicFontGeneration(),
    // The chosen TEXT face: a bar's words are drawn inside its group too.
    textFontGeneration(),
  ]
}
