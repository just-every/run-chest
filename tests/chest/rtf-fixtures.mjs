// Actual RTF originals, including payload groups that must never become searchable text.
export const rtfPhrase = 'Cobalt résumé café — 雪 😀';
export const rtf = (phrase = String.raw`Cobalt r\u233?sum\u233? caf\'e9 \emdash  \u-26902? \u-10179?\u-8704?`) => Buffer.from(String.raw`{\rtf1\ansi\ansicpg1252\deff0{\fonttbl{\f0\fnil Arial;}}{\info{\title synthetic-chest-private-metadata}}\f0 ${phrase}\par Escaped \{braces\} and \\slash\tab next\par {\uc2 Unicode \u233ab value} {\v synthetic-chest-hidden-text}{\*\unknown synthetic-chest-unknown-data}{\pict synthetic-chest-picture-payload}{\object{\objdata synthetic-chest-object-payload}\bin6 {\}abc}{\field{\*\fldinst synthetic-chest-field-instruction}{\fldrslt Displayed field}} {\upr{synthetic-chest-ansi-alternative}{\*\ud Unicode alternative}}}`, 'latin1');

export const privateRtf = Buffer.from(String.raw`{\rtf1\ansi Visible harbor text {\xe private-index-token}{\tc private-contents-token}{\tcn private-unnumbered-token} remains visible.}`, 'latin1');
export const symbolPhrase = 'ΑΒΓ αβγ ∀∃∞';
export const symbolRtf = Buffer.from(String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0\fnil Arial;}{\f1\ftech\fcharset2 Symbol;}}\f0 Harbor {\f1 ABG abg \'22\'24\'a5} plain text.}`, 'latin1');
