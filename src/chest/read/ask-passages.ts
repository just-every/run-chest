// Keep quotations short and verbatim while preserving their original page.
export function askPassages(text: string): string[] {
 if (text.length > 20000) return [text]
 const chunks: string[] = []
 let start = 0
 while (start < text.length) {
  let end = Math.min(start + 1200, text.length)
  if (end < text.length) {
   const boundary = Math.max(text.lastIndexOf('\n', end - 1), text.lastIndexOf(' ', end - 1))
   if (boundary > start + 600) end = boundary + 1
  }
  const chunk = text.slice(start, end)
  if (chunk.trim()) chunks.push(chunk)
  start = end
 }
 return chunks
}
