[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/RizkyRizk/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/RizkyRizk/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Leonida Poster Lab — GTA-style cover maker

Turn any photo into a GTA-style multi-panel cover and export it as a PNG.
Runs fully offline in a desktop browser from its own static files; photos
never leave the machine.

## Try it

Serve `app/` with any static file server and open `index.html`:

```sh
node serve.ts        # serves app/ at http://localhost:8080
```

(or `python3 -m http.server --directory app 8080`).

## What it does

- **4 layouts** — Quad Grid (2×2), Duo Split, Triple Strip, Hero Solo.
- **4 colour grades** — Vice Sunset, Neon Nights, Palm Noir (black-and-white
  with a pink punch), Golden Hour. Each grade washes the photos and paints
  the title band.
- **Any photo** — upload your own images (or drop them on the preview),
  one per panel or the same photo across all panels. Click a panel to select
  it, drag to move the photo, scroll or use the slider to zoom, nudge with
  the arrow keys. Three illustrated sample photos ship under `app/samples/`.
- **Caption** — edit the big Anton title and the Bebas Neue subtitle; the
  title shrinks to fit and is drawn with a dark outline over the band.
- **Export** — one click writes a PNG in Square 1080×1080, Portrait
  1080×1350 or Wide 1920×1080, ready to post.

## Files

- `main.ts` — entrypoint: copies `app/` and `screenshots/` to `/output` and
  writes `dossier.json` with the vendored make.fun library.
- `app/index.html`, `app/style.css`, `app/cover.js` — the editor (plain
  static files, no build step, no network).
- `app/fonts/` — Anton and Bebas Neue, SIL Open Font License (`OFL.txt`).
- `app/samples/` — three illustrations drawn for this app with PIL.
- `screenshots/` — 4 screenshots: the exported wide cover first, then the
  editor with a photo loaded, then the square and portrait covers.

## Originality

An original design: no Rockstar Games logo, artwork, character or font.
Lettering uses Anton and Bebas Neue (OFL). Sample pictures are original
illustrations, not photos of real people and not game artwork.

## License

MIT — see `LICENSE`.
