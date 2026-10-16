/** Copy with the desk's line breaks: each "\n" breaks the line on wide screens and is a plain space on phones. */
export function prose(text: string) {
  return text.split('\n').flatMap((line, index) => (index ? [' ', <br key={index} className="desk-br" />, line] : [line]))
}
