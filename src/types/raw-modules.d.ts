/**
 * Vite's `?raw` import suffix: import a file's source as a string.
 * Used by {@link WebAudioFontInstrument} to load the WebAudioFont player script.
 */
declare module '*?raw' {
  const content: string
  export default content
}
