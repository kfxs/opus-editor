import { describe, it, expect } from 'vitest'
import { installUndoInvariant } from './undoInvariant'

/** The three private fields the check reads, and one method of each kind it tells apart. */
class FakeEngine {
  undoRequests = 0
  modelDirty = false
  score = { notes: [] as string[] }
  scoreModel = { getScore: () => this.score }

  private ask(): void { this.undoRequests++; this.modelDirty = true }

  addAsking(): void { this.score.notes.push('n'); this.ask() }
  addSilently(): void { this.score.notes.push('n') }
  read(): number { return this.score.notes.length }
  /** A batch: the inner writes are silent, the one ask comes at the end. */
  batchOfSilentWrites(): void { this.addSilently(); this.addSilently(); this.ask() }
  previewMarkingDirty(): void { this.score.notes.push('p'); this.modelDirty = true }
  previewForgettingDirty(): void { this.score.notes.push('p') }
  undo(): void { this.score = { notes: [] } }
  renderScore(): void { this.score.notes.push('rest'); this.modelDirty = false }
}

function armed(): FakeEngine {
  const engine = new FakeEngine()
  installUndoInvariant(engine)
  return engine
}

describe('installUndoInvariant', () => {
  it('lets a mutator that asked for its undo entry through, and a read', () => {
    const engine = armed()
    expect(() => engine.addAsking()).not.toThrow()
    expect(engine.read()).toBe(1)
  })

  it('throws, naming the method, when the score changed and nothing was asked', () => {
    expect(() => armed().addSilently()).toThrow(/MusicEngine\.addSilently changed the score/)
  })

  it('checks the OUTERMOST call only: silent inner writes are one edit with the ask at its end', () => {
    expect(() => armed().batchOfSilentWrites()).not.toThrow()
  })

  it('a preview* frame may defer its entry — but must have marked the model dirty', () => {
    expect(() => armed().previewMarkingDirty()).not.toThrow()
    expect(() => armed().previewForgettingDirty()).toThrow(/did not mark the model dirty/)
  })

  it('leaves alone what replaces the score and what the render repairs', () => {
    const engine = armed()
    engine.addAsking()
    expect(() => engine.undo()).not.toThrow()
    expect(() => engine.renderScore()).not.toThrow()
  })

  it('still returns what the method returned', () => {
    const engine = armed()
    engine.addAsking()
    expect(engine.read()).toBe(1)
  })
})
