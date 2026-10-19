/** Copy with the desk's line breaks: each "\n" breaks the line on wide screens and is a plain space on phones. */
export function prose(text: string) {
  return text.split('\n').flatMap((line, index) => (index ? [' ', <br key={index} className="desk-br" />, line] : [line]))
}

/** Ties each " · ", " → " and " / " to the words on both sides, so a wrapped line never starts or ends on one. */
export const keep = (text: string) => text.replace(/ ([·→/]) /g, ' $1 ')
