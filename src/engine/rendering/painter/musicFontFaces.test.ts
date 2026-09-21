import { describe, it, expect, vi, afterEach } from 'vitest'

/**
 * ⚠️ The claim that matters — the page DRAWS with our faces — is a browser fact, asserted in
 * `e2e/musicFontFaces.e2e.ts`. What a unit test can hold is the registration's own contract: every
 * row goes in, from the file we ship, once, and a failed load never hangs the gate behind it.
 *
 * The module memoizes, so each case imports a fresh copy.
 */
class FakeFace {
  constructor(public family: string, public source: string, public descriptors: FontFaceDescriptors, private fails = false) {}
  load() {
    return this.fails ? Promise.reject(new Error('404')) : Promise.resolve(this)
  }
}

function stubPage(fails = false) {
  const added: FakeFace[] = []
  vi.stubGlobal('FontFace', class extends FakeFace {
    constructor(family: string, source: string, descriptors: FontFaceDescriptors) { super(family, source, descriptors, fails) }
  })
  vi.stubGlobal('document', { fonts: { add: (face: FakeFace) => added.push(face) } })
  return added
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('registerMusicFontFaces', () => {
  it('resolves where there is no font loading API at all (node, jsdom)', async () => {
    const { registerMusicFontFaces } = await import('./musicFontFaces')
    await expect(registerMusicFontFaces()).resolves.toBeUndefined()
  })

  it('⭐ installs the faces the page opens with — the words and Bravura — from the files we ship', async () => {
    const added = stubPage()
    const { registerMusicFontFaces, isOwnFontFace } = await import('./musicFontFaces')
    const { FONT_FILES } = await import('@/engine/fonts/fontFiles')
    await registerMusicFontFaces()
    // ⛔ Not Leipzig, Sebastian, Edwin or Nepomuk: a face nobody chose is not fetched (`loadMusicFont`).
    const opening = FONT_FILES.filter(row => row.family === 'Academico' || row.family === 'Bravura')
    expect(added.map(face => [face.family, face.descriptors.weight, face.descriptors.display]))
      .toEqual(opening.map(row => [row.family, row.weight, row.display]))
    expect(added[0].source).toMatch(/^url\(.*fonts\/Bravura\.otf\)$/)
    expect(added.every(face => isOwnFontFace(face as unknown as FontFace))).toBe(true)
  })

  it('installs once per page', async () => {
    const added = stubPage()
    const { registerMusicFontFaces } = await import('./musicFontFaces')
    const first = registerMusicFontFaces()
    expect(registerMusicFontFaces()).toBe(first)
    await first
    expect(added).toHaveLength(3)
  })

  it('⭐ a chosen music face is installed on demand, once', async () => {
    const added = stubPage()
    const { registerMusicFontFaces, loadMusicFont, isOwnFontFace } = await import('./musicFontFaces')
    await registerMusicFontFaces()
    await loadMusicFont('Leipzig')
    await loadMusicFont('Leipzig')
    await loadMusicFont('Bravura')
    expect(added.map(face => face.family)).toEqual(['Bravura', 'Academico', 'Academico', 'Leipzig'])
    expect(added[3].source).toMatch(/^url\(.*fonts\/Leipzig\.otf\)$/)
    expect(isOwnFontFace(added[3] as unknown as FontFace)).toBe(true)
  })

  it('a face that fails to load does not hang the gate behind it', async () => {
    stubPage(true)
    const { registerMusicFontFaces } = await import('./musicFontFaces')
    await expect(registerMusicFontFaces()).resolves.toBeUndefined()
  })

  it('a face somebody else installed is not ours', async () => {
    stubPage()
    const { isOwnFontFace } = await import('./musicFontFaces')
    expect(isOwnFontFace(new FakeFace('Bravura', 'url(data:…)', {}) as unknown as FontFace)).toBe(false)
  })
})
