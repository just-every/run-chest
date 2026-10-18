// Bounded samples keep admission work independent of original size. Signals are evidence, never a malware verdict.
export function entropy(bytes: Uint8Array) {
 const counts = new Uint32Array(256), sample = bytes.subarray(0, 65536)
 for (const b of sample) counts[b]++
 return sample.length ? counts.reduce((sum, n) => n ? sum - n / sample.length * Math.log2(n / sample.length) : sum, 0) : 0
}
const prefix = (bytes: Uint8Array) => new TextDecoder().decode(bytes.subarray(0, 16))
export function signals(name: string, bytes: Uint8Array, prior?: Uint8Array) {
 const reasons: string[] = [], extension = name.toLowerCase().split('.').at(-1)!, magic = prefix(bytes)
 if (/^(readme.*(?:decrypt|recover)|(?:how_to_|how-)(?:decrypt|recover)|_?decrypt.*|restore_files.*|ransom_note)(?:\.|$)/i.test(name)) reasons.push('Known ransom-note filename')
 const mismatch = extension === 'pdf' ? !magic.startsWith('%PDF-') : ['docx','xlsx','pptx','odt','ods','odp','zip'].includes(extension) ? !(bytes[0] === 80 && bytes[1] === 75) : extension === 'png' ? bytes.subarray(0,8).join(',') !== '137,80,78,71,13,10,26,10' : ['jpg','jpeg'].includes(extension) ? !(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) : false
 // An initial unsupported/mislabeled upload is not a corruption incident. A replacement that loses its old signature is.
 if (prior && mismatch) {
  const old = prefix(prior)
  if ((extension === 'pdf' && old.startsWith('%PDF-')) || (['docx','xlsx','pptx','odt','ods','odp','zip'].includes(extension) && prior[0] === 80 && prior[1] === 75) || (extension === 'png' && prior[0] === 137) || (['jpg','jpeg'].includes(extension) && prior[0] === 255)) reasons.push('File signature no longer matches its extension')
 }
 if (prior && bytes.length >= 1024 && entropy(bytes) > 7.5 && entropy(bytes) - entropy(prior) > 2) reasons.push('Content entropy jumped toward random')
 return reasons
}
