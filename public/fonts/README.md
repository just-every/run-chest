# Fonts

Chest self-hosts three families under the SIL Open Font License 1.1, each with
its licence beside it. The WOFF2 files come from Fontsource's distributions
(`@fontsource-variable/archivo`, `@fontsource/ibm-plex-mono`,
`@fontsource-variable/caveat`, 5.3.0).

- `archivo/`: Archivo with its weight (100–900) and width (62–125%) axes, Latin
  and Latin Extended. Headings use width 80 and weight 800; body text width 100.
  Upstream: https://github.com/Omnibus-Type/Archivo.
- `plex-mono/`: IBM Plex Mono 400 and 500 for filenames, dates, emails,
  checksums and IDs. Upstream: https://github.com/IBM/plex.
- `caveat/`: Caveat (variable weight), Latin only, for the landing drawings'
  hand-inked callouts. Upstream: https://github.com/googlefonts/caveat.

`fonts.css` declares every face once. `public/rer-theme.css` imports it, so any
page that links the theme (the app, sign-in, setup, the Lobby and the run site)
gets the faces; `src/base/font-head.ts` preloads the Latin Archivo file.
`Archivo Compact` is the same Archivo file fixed at width 80, for documents that
only read `--rer-font-heading`.
