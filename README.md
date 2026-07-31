# Opus Score Editor

A music score editor built with VexFlow and WebAudioFont.

[Live demo](https://kfxs.github.io/opus-editor/)

Work in progress — this is an experiment under development.

## Features

- Note entry by clicking the staff
- Chords, ties, tuplets, and articulations
- Time signatures, including changes mid-score and pickup bars
- Clefs (treble, bass, alto, tenor), including mid-measure changes
- Automatic rests, beaming, and stem direction
- Playback
- Undo and redo
- Save and load as JSON

## Tech Stack

- No UI framework — plain TypeScript and the DOM (Vue was removed; see docs/remove-vue-plan.md)
- VexFlow 5 — notation rendering
- WebAudioFont — sampled General-MIDI audio playback (samples fetched from CDN at play time)
- Tailwind CSS — styling
- Vite — build
- Vitest and Playwright — testing

## Running it

Requires Node.js 20.14.0 or higher.

```bash
npm install
npm run dev        # start the dev server
npm run build      # production build
npm run test       # unit tests
npm run test:e2e   # end-to-end tests
```

## License

Copyright (C) 2026 Kiko Faxas

Licensed under the GNU Affero General Public License v3.0 or later. See [LICENSE](LICENSE).
