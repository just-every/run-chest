import { esc } from '../ui-shared'

export function restrictedPreviewPanel(d: any) {
 const current = d.versions.find((v: any) => v.id === d.item.current)
 if (!current) return ''
 return `<section class="office-panel"><h2 class="section-title">Preview</h2><iframe class="office-frame" title="File preview" sandbox="allow-scripts allow-same-origin" src="/api/chest/items/${esc(d.id)}/rendered-preview/${esc(current.id)}"></iframe></section>`
}
