# Fonts

Chest self-hosts four families under the SIL Open Font License 1.1, each with
its license beside it. The WOFF2 files come from Fontsource's distributions
(`@fontsource-variable/inter`, `@fontsource-variable/archivo`,
`@fontsource/ibm-plex-mono`, `@fontsource-variable/caveat`, 5.3.0).

- `inter/`: Inter with its weight (100–900) and optical size (14–32) axes,
  Latin and Latin Extended. The run site and the brand lockup: headings at
  weight 800 with tight tracking (the browser picks the display cut from the
  font size), body text at 400–500. Upstream: https://github.com/rsms/inter.
- `archivo/`: Archivo with its weight (100–900) and width (62–125%) axes,
  Latin and Latin Extended. The app's headings (width 80, weight 800) and body
  text until the app screens move to the approved look.
  Upstream: https://github.com/Omnibus-Type/Archivo.
- `plex-mono/`: IBM Plex Mono 400 and 500 for filenames, dates, emails,
  checksums, IDs and the terminal. Upstream: https://github.com/IBM/plex.
- `caveat/`: Caveat (variable weight), Latin only, for handwriting: sticky
  notes and the filled-in fields of a scan. Upstream:
  https://github.com/googlefonts/caveat.

`fonts.css` declares every face once. `public/rer-theme.css` imports it, so any
page that links the theme (the app, sign-in, setup, the Lobby and the run site)
gets the faces; `src/base/font-head.ts` preloads the Latin Archivo file and the
run site preloads the Latin Inter file. `Archivo Compact` is the same Archivo
file fixed at width 80, for documents that only read `--rer-font-heading`.
