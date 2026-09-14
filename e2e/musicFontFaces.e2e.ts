import { test, expect } from './fixtures'

/**
 * ⭐⭐ **THE SCORE IS DRAWN IN THE FONTS WE SHIP — not the copies VexFlow's import installs.**
 * S1 of `docs/vexflow-removal-map.md`; the module is `engine/rendering/musicFontFaces`.
 *
 * Until this step nothing in the repo installed a font face: the page had Bravura only because
 * importing VexFlow registers six embedded faces (Bravura, Academico ×2, Gonville, Petaluma, Petaluma
 * Script — listed in a live page). Removing the package would have blanked every glyph, and no jsdom
 * test could have seen it.
 *
 * ⚠️ Why the proof takes two tests: Bravura's advances are the SAME in VexFlow's copy and in our
 * `.otf` (measured glyph for glyph), so measuring the music cannot tell the two apart. Academico
 * can — its builds differ ("Tempo I" in bold: 498 px at 120 px in VexFlow's copy, 489 px in ours) —
 * which proves OUR faces win. And deleting every face that is not ours proves the music does not
 * need VexFlow's at all.
 */

test('⭐ words are set in OUR Academico — the face we ship wins over the copy embedded in the drawing library', async ({ score }) => {
  const widths = await score.evaluate(async () => {
    await window.__h.render()
    // The file we ship, under a name nothing else uses — the reference the page must agree with.
    const shipped = new FontFace('AcademicoAsShipped', 'url(/opus-editor/fonts/AcademicoBold.otf)', { weight: 'bold' })
    await shipped.load()
    document.fonts.add(shipped)
    const ctx = document.createElement('canvas').getContext('2d')!
    const width = (font: string) => { ctx.font = font; return ctx.measureText('Tempo I').width }
    return { page: width('bold 120px Academico'), shipped: width('bold 120px AcademicoAsShipped') }
  })
  expect(widths.page, 'the page’s Academico measures like public/fonts/AcademicoBold.otf').toBeCloseTo(widths.shipped, 3)
})

test('⭐⭐ the music still renders with every face that is NOT ours deleted from the page', async ({ score }) => {
  const result = await score.evaluate(async () => {
    await window.__h.render()
    const ctx = document.createElement('canvas').getContext('2d')!
    const gClef = (family: string) => { ctx.font = `120px ${family}`; return ctx.measureText('').width }
    const before = gClef('Bravura')
    let deleted = 0
    for (const face of [...document.fonts]) {
      if (!window.__h.isOwnFontFace(face)) { document.fonts.delete(face); deleted++ }
    }
    await document.fonts.ready
    return { before, after: gClef('Bravura'), fallback: gClef('NoSuchFontAnywhere'), deleted, left: [...document.fonts].map(f => `${f.family} ${f.weight}`) }
  })
  expect(result.deleted, 'the drawing library’s embedded faces were there to delete').toBeGreaterThan(0)
  expect(result.left.sort()).toEqual(['Academico bold', 'Academico normal', 'Bravura normal'])
  expect(result.after, 'Bravura still measures as Bravura').toBeCloseTo(result.before, 3)
  expect(Math.abs(result.after - result.fallback), '⛔ not the fallback box').toBeGreaterThan(1)
})
