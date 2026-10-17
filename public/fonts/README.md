# Fonts

Chest self-hosts three families under the SIL Open Font License 1.1, each with
its licence beside it. The WOFF2 files come from Fontsource's distributions
(`@fontsource-variable/inter`, `@fontsource/ibm-plex-mono`,
`@fontsource-variable/caveat`, 5.3.0).

- `inter/`: Inter with its weight (100–900) and optical size (14–32) axes,
  Latin and Latin Extended. Every page: the run site, the brand lockup, the
  app, sign-in and setup. Headings at weight 750–860 with tight tracking (the
  browser picks the display cut from the font size), body text at 400–600.
  Upstream: https://github.com/rsms/inter.
- `plex-mono/`: IBM Plex Mono 400 and 500 for checksums, IDs, raw JSON and the
  terminal. Upstream: https://github.com/IBM/plex.
- `caveat/`: Caveat (variable weight), Latin only, for handwriting: sticky
  notes and the filled-in fields of a scan in the run site's drawings.
  Upstream: https://github.com/googlefonts/caveat.

`fonts.css` declares every face once. `public/rer-theme.css` imports it, so any
page that links the theme (the app, sign-in, setup, the Lobby and the run site)
gets the faces; `src/base/font-head.ts` and the run site preload the Latin
Inter file.
