import type { Ref, ComputedRef } from 'vue'
import type { ArticulationType, Accidental, NoteDuration } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'

interface RendererDeps {
  engine: Ref<MusicEngine | null>
  // Shared palette refs
  selectedDuration: Ref<NoteDuration>
  selectedAccidental: Ref<Accidental | null>
  selectedDots: Ref<number>
  pendingArticulations: ComputedRef<ArticulationType[] | undefined>
  pendingTieFromNoteId: Ref<string | null>
  // Highlight functions from useHighlight
  applySelectionHighlight: () => void
  applyArticulationHighlight: () => void
  applyAccidentalHighlight: () => void
  applyTupletSelectionHighlight: () => void
  applyKeyboardCursor: () => void
}

export function useRenderer(deps: RendererDeps) {
  const {
    engine,
    selectedDuration, selectedAccidental, selectedDots,
    pendingArticulations, pendingTieFromNoteId,
    applySelectionHighlight, applyArticulationHighlight,
    applyAccidentalHighlight, applyTupletSelectionHighlight, applyKeyboardCursor,
  } = deps

  function renderScore() {
    if (!engine.value) return
    engine.value.clearCanvas()
    engine.value.renderScore()

    applySelectionHighlight()
    applyArticulationHighlight()
    applyAccidentalHighlight()
    applyTupletSelectionHighlight()
    applyKeyboardCursor()

    // Draw dangling tie arc if a tie is armed
    if (pendingTieFromNoteId.value) {
      engine.value.renderPendingTie(pendingTieFromNoteId.value)
    }
  }

  function renderPreview(coords: { x: number; y: number }) {
    if (!engine.value) return
    engine.value.renderScoreWithPreview(
      coords,
      selectedDuration.value,
      selectedAccidental.value || undefined,
      selectedDots.value,
      pendingArticulations.value
    )
    applySelectionHighlight()
    applyArticulationHighlight()
    applyAccidentalHighlight()
    applyTupletSelectionHighlight()
    applyKeyboardCursor()
  }

  return { renderScore, renderPreview }
}
