# Fonts

Chest self-hosts three families under the SIL Open Font License 1.1, each with
its license beside it. The WOFF2 files come from Fontsource's distributions
(`@fontsource-variable/inter`,
`@fontsource/ibm-plex-mono`, `@fontsource-variable/caveat`, 5.3.0).

- `inter/`: Inter with its weight (100–900) and optical size (14–32) axes,
  Latin and Latin Extended. The run site, the brand lockup and the app: headings at
  weight 800 with tight tracking (the browser picks the display cut from the
  font size), body text at 400–500. Upstream: https://github.com/rsms/inter.
- `plex-mono/`: IBM Plex Mono 400 and 500 for filenames, dates, emails,
  checksums, IDs and the terminal. Upstream: https://github.com/IBM/plex.
- `caveat/`: Caveat (variable weight), Latin only, for handwriting: sticky
  notes and the filled-in fields of a scan. Upstream:
  https://github.com/googlefonts/caveat.

`fonts.css` holds Chest's look beyond its theme: its own tokens and the rules
that dress Base's pages. Every face is declared once in `public/rer-theme.css`,
beside the theme tokens: rer's theme reader takes only those two, and the
installer serves the files the faces name. Every page that links the theme (the
app, sign-in, setup, the Lobby and the run site) links `fonts.css` too;
`src/base/font-head.ts` and the run site preload the Latin Inter file.
