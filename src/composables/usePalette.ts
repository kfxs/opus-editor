import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { ArticulationType, NoteDuration, Accidental } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'

interface PaletteDeps {
  selectedTool: Ref<'entry' | 'selection'>
  selectedNoteId: Ref<string | null>
  selectedArticulationNoteId: Ref<string | null>
  selectedArticulationType: Ref<string | null>
  // Shared palette refs — declared in App.vue, written to by useSelection on note select
  selectedDuration: Ref<NoteDuration>
  selectedAccidental: Ref<Accidental | null>
  selectedDots: Ref<number>
  engine: Ref<MusicEngine | null>
  renderScore: () => void
  renderPreview: (coords: { x: number; y: number }) => void
  getLastMousePosition: () => { x: number; y: number } | null
  selectNote: (id: string | null) => void
}

export function usePalette(deps: PaletteDeps) {
  const {
    selectedTool, selectedNoteId,
    selectedArticulationNoteId, selectedArticulationType,
    selectedDuration, selectedAccidental, selectedDots,
    engine, renderScore, renderPreview, getLastMousePosition, selectNote,
  } = deps
  const selectedAccent = ref(false)
  const selectedStaccato = ref(false)
  const selectedTenuto = ref(false)
  const pendingTieFromNoteId = ref<string | null>(null)
  const tupletMode = ref<boolean>(false)

  // Combined pending articulations for entry mode note creation
  const pendingArticulations = computed<ArticulationType[] | undefined>(() => {
    const arts: ArticulationType[] = []
    if (selectedAccent.value) arts.push('accent')
    if (selectedStaccato.value) arts.push('staccato')
    if (selectedTenuto.value) arts.push('tenuto')
    return arts.length ? arts : undefined
  })

  // --- Functions ---

  function setDuration(duration: NoteDuration) {
    selectedDuration.value = duration
    // Reset dots when changing duration
    selectedDots.value = 0
    // Clear tuplet mode when changing duration - user likely wants a new note value
    tupletMode.value = false
    // If a note is selected in selection mode, update its duration (and remove dots)
    if (selectedNoteId.value && engine.value && selectedTool.value === 'selection') {
      engine.value.updateNote(selectedNoteId.value, { duration, dots: 0 })
      renderScore()
    } else if (selectedTool.value === 'selection') {
      // Switch to entry mode when pressing duration in selection mode with nothing selected
      selectedTool.value = 'entry'
      const pos = getLastMousePosition()
      if (pos) renderPreview(pos)
    }
  }

  function setAccidental(accidental: Accidental | null) {
    // Toggle behavior: if same accidental is already selected, deselect it
    const newValue = selectedAccidental.value === accidental ? null : accidental
    selectedAccidental.value = newValue
    // If a note is selected in selection mode, update its accidental.
    // forceAccidental is only set when the user presses the same accidental that is already
    // stored on the note but suppressed by measure rules (palette showed nothing). In that
    // case they're explicitly asking to override the suppression. Any real change (e.g.
    // natural → sharp) follows standard measure rules without forcing.
    if (selectedNoteId.value && engine.value && selectedTool.value === 'selection') {
      const note = engine.value.getNote(selectedNoteId.value)
      if (newValue === null) {
        if (note?.forceAccidental) {
          // Was force-shown → remove force only, goes back to suppressed (accidental stays)
          engine.value.updateNote(selectedNoteId.value, { forceAccidental: undefined })
        } else {
          // Naturally shown (not forced) → remove the accidental entirely, note becomes natural
          engine.value.updateNote(selectedNoteId.value, { accidental: undefined, forceAccidental: undefined })
        }
      } else if (newValue === 'n') {
        // Natural/becuadro: always make the note natural AND force-show the ♮ sign.
        // Whether the note had a sharp/flat or was already natural, the result is the same:
        // the ♮ sign is visible. Press ♮ again to hide it (toggle-off removes forceAccidental).
        engine.value.updateNote(selectedNoteId.value, { accidental: undefined, forceAccidental: true })
      } else {
        // Set #/b: force-show if re-pressing the same accidental that's currently suppressed.
        const forceAccidental = newValue === note?.accidental ? true : undefined
        engine.value.updateNote(selectedNoteId.value, { accidental: newValue, forceAccidental })
      }
      renderScore()
      // Re-sync palette to the effective displayed accidental after the update.
      selectNote(selectedNoteId.value)
    } else if (selectedTool.value === 'selection') {
      // Switch to entry mode when pressing accidental in selection mode with nothing selected
      selectedTool.value = 'entry'
      const pos = getLastMousePosition()
      if (pos) renderPreview(pos)
    } else if (selectedTool.value === 'entry') {
      // Re-render ghost note with new accidental
      const pos = getLastMousePosition()
      if (pos) renderPreview(pos)
    }
  }

  function toggleAccent() {
    if (selectedTool.value === 'selection' && selectedNoteId.value && engine.value) {
      // Selection mode: toggle on the note immediately
      engine.value.toggleArticulation(selectedNoteId.value, 'accent')
      engine.value.updateUndoNoteId(selectedNoteId.value)
      renderScore()
    } else {
      // Entry mode: arm/disarm the pending accent for the next note entry
      selectedAccent.value = !selectedAccent.value
      const pos = getLastMousePosition()
      if (pos) renderPreview(pos)
    }
  }

  function toggleStaccato() {
    if (selectedTool.value === 'selection' && selectedNoteId.value && engine.value) {
      engine.value.toggleArticulation(selectedNoteId.value, 'staccato')
      engine.value.updateUndoNoteId(selectedNoteId.value)
      renderScore()
    } else {
      selectedStaccato.value = !selectedStaccato.value
      const pos = getLastMousePosition()
      if (pos) renderPreview(pos)
    }
  }

  function toggleTenuto() {
    if (selectedTool.value === 'selection' && selectedNoteId.value && engine.value) {
      engine.value.toggleArticulation(selectedNoteId.value, 'tenuto')
      engine.value.updateUndoNoteId(selectedNoteId.value)
      renderScore()
    } else {
      selectedTenuto.value = !selectedTenuto.value
      const pos = getLastMousePosition()
      if (pos) renderPreview(pos)
    }
  }

  function toggleTie() {
    if (!selectedNoteId.value || !engine.value) return

    if (selectedTool.value === 'entry') {
      // Entry mode: arm/disarm the pending tie
      if (pendingTieFromNoteId.value === selectedNoteId.value) {
        // Already armed for this note — disarm
        pendingTieFromNoteId.value = null
      } else {
        pendingTieFromNoteId.value = selectedNoteId.value
      }
      renderScore()
    } else {
      // Selection mode: toggle tie between this note and the next note of same pitch
      engine.value.toggleTie(selectedNoteId.value)
      renderScore()
    }
  }

  function toggleDot() {
    // Toggle between 0 (no dot) and 1 (dotted)
    const newValue = selectedDots.value > 0 ? 0 : 1
    selectedDots.value = newValue
    // If a note is selected in selection mode, update its dots
    if (selectedNoteId.value && engine.value && selectedTool.value === 'selection') {
      engine.value.updateNote(selectedNoteId.value, { dots: newValue })
      renderScore()
    } else if (selectedTool.value === 'selection') {
      // Switch to entry mode when pressing dot in selection mode with nothing selected
      selectedTool.value = 'entry'
      const pos = getLastMousePosition()
      if (pos) renderPreview(pos)
    } else if (selectedTool.value === 'entry') {
      // Re-render ghost note with new dot
      const pos = getLastMousePosition()
      if (pos) renderPreview(pos)
    }
  }

  function toggleTuplet() {
    // Toggle tuplet mode on/off
    tupletMode.value = !tupletMode.value
    // Disable dots when enabling tuplet mode (tuplets don't use dots)
    if (tupletMode.value) {
      selectedDots.value = 0
    }
  }

  function resetPaletteToDefaults() {
    selectedDuration.value = 'q'
    selectedAccidental.value = null
    selectedDots.value = 0
    selectedAccent.value = false
    selectedStaccato.value = false
    selectedTenuto.value = false
    pendingTieFromNoteId.value = null
  }

  // --- Toolbar button active states ---
  // In selection mode: reflect the selected note's actual state.
  // In entry mode: reflect the pending palette state.

  const selectedNoteHasAccent = computed(() => {
    if (selectedTool.value === 'selection' && engine.value) {
      if (selectedArticulationNoteId.value) {
        return selectedArticulationType.value === 'accent'
      }
      if (selectedNoteId.value) {
        const note = engine.value.getNote(selectedNoteId.value)
        return note?.articulations?.includes('accent') ?? false
      }
    }
    return selectedAccent.value
  })

  const selectedNoteHasStaccato = computed(() => {
    if (selectedTool.value === 'selection' && engine.value) {
      if (selectedArticulationNoteId.value) {
        return selectedArticulationType.value === 'staccato'
      }
      if (selectedNoteId.value) {
        const note = engine.value.getNote(selectedNoteId.value)
        return note?.articulations?.includes('staccato') ?? false
      }
    }
    return selectedStaccato.value
  })

  const selectedNoteHasTenuto = computed(() => {
    if (selectedTool.value === 'selection' && engine.value) {
      if (selectedArticulationNoteId.value) {
        return selectedArticulationType.value === 'tenuto'
      }
      if (selectedNoteId.value) {
        const note = engine.value.getNote(selectedNoteId.value)
        return note?.articulations?.includes('tenuto') ?? false
      }
    }
    return selectedTenuto.value
  })

  const selectedNoteHasTie = computed(() => {
    // In entry mode, glow if tie is armed (pending)
    if (selectedTool.value === 'entry' && pendingTieFromNoteId.value) return true
    // In selection mode (or no pending), reflect the selected note's tiedTo
    if (!selectedNoteId.value || !engine.value) return false
    const note = engine.value.getNote(selectedNoteId.value)
    return !!note?.tiedTo
  })

  return {
    // State
    selectedAccent,
    selectedStaccato,
    selectedTenuto,
    pendingTieFromNoteId,
    tupletMode,
    pendingArticulations,
    // Functions
    setDuration,
    setAccidental,
    toggleAccent,
    toggleStaccato,
    toggleTenuto,
    toggleTie,
    toggleDot,
    toggleTuplet,
    resetPaletteToDefaults,
    // Toolbar button active states
    selectedNoteHasAccent,
    selectedNoteHasStaccato,
    selectedNoteHasTenuto,
    selectedNoteHasTie,
  }
}
