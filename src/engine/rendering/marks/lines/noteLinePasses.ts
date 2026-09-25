/**
 * ⭐ **THE LINES DRAWN FROM ONE NOTEHEAD TO ANOTHER, after the notes** — run by `ScoreRenderer` right
 * after the ties, before the slurs plan.
 *
 * ⭐ A LIST, so a new note-to-note line is a row here and ⛔ not a call (and a kind word) in
 * `ScoreRenderer`, whose `lint:hubs` count may only fall (`CLAUDE.md`: a new feature adds a MODULE).
 * Its first member is the glissando (docs/plans/glissando-plan.md P1).
 */
import type { Score } from '@/types/music'
import type { RenderPass } from '../../RenderPass'
import { renderGlissandi } from './GlissandoRenderer'

const NOTE_LINE_PASSES: ReadonlyArray<(pass: RenderPass, score: Score) => void> = [
  renderGlissandi,
]

export function renderNoteLines(pass: RenderPass, score: Score): void {
  for (const draw of NOTE_LINE_PASSES) draw(pass, score)
}
