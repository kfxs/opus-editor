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
 * which proves OUR faces win. ⭐ Since S13b the page never loads VexFlow's faces at all, which the
 * second test now checks directly.
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

test('⭐⭐ the page holds ONLY our faces — and the music renders in them, not in a fallback', async ({ score }) => {
  // ⭐ S13b (2026-09-19): nothing the page loads imports the drawing library any more, so its six embedded
  //   faces are never installed. This used to DELETE them first and check the music survived; now there is
  //   nothing to delete, which is the stronger statement — checked, so a re-introduced import is caught.
  const result = await score.evaluate(async () => {
    await window.__h.render()
    await document.fonts.ready
    const ctx = document.createElement('canvas').getContext('2d')!
    const gClef = (family: string) => { ctx.font = `120px ${family}`; return ctx.measureText('\uE050').width }
    const foreign = [...document.fonts].filter(face => !window.__h.isOwnFontFace(face)).map(f => `${f.family} ${f.weight}`)
    return { bravura: gClef('Bravura'), fallback: gClef('NoSuchFontAnywhere'), foreign, left: [...document.fonts].map(f => `${f.family} ${f.weight}`) }
  })
  expect(result.foreign, 'no face on the page that we did not install').toEqual([])
  expect(result.left.sort()).toEqual(['Academico bold', 'Academico normal', 'Bravura normal'])
  expect(Math.abs(result.bravura - result.fallback), '⛔ not the fallback box').toBeGreaterThan(1)
})
