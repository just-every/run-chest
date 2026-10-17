import type { OfficeArchive } from './archive'
import { attr, descendants, escape, relationships, type Element } from './xml'

export function imageRenderer(archive: OfficeArchive, part: string) {
  const links = relationships(archive, part)
  let total = 0
  return (container: Element): string => {
    const images: string[] = []
    for (const reference of [...descendants(container, 'blip'), ...descendants(container, 'imagedata')]) {
      const id = attr(reference, 'embed') || attr(reference, 'id')
      const link = links.find(item => item.id === id && item.type === 'image')
      if (!link || !archive.has(link.target)) continue
      const bytes = archive.get(link.target)
      let mime = ''
      if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) mime = 'image/png'
      else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = 'image/jpeg'
      else if (String.fromCharCode(...bytes.subarray(0, 6)) === 'GIF89a' || String.fromCharCode(...bytes.subarray(0, 6)) === 'GIF87a') mime = 'image/gif'
      else if (String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') mime = 'image/webp'
      if (!mime) { images.push('<span>[Unsupported embedded image]</span>'); continue }
      total += bytes.length
      if (total > 6 * 1024 * 1024) throw new Error('Office embedded images exceed the 6 MB preview limit')
      let binary = ''
      for (let at = 0; at < bytes.length; at += 8192) binary += String.fromCharCode(...bytes.subarray(at, at + 8192))
      const description = descendants(container, 'docPr')[0] ?? descendants(container, 'cNvPr')[0]
      const alt = attr(description, 'descr') || attr(description, 'name') || 'Embedded image'
      images.push(`<img alt="${escape(alt)}" src="data:${mime};base64,${btoa(binary)}" style="max-width:100%;height:auto">`)
    }
    return images.join('')
  }
}
