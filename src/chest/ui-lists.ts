import { esc } from './ui-shared'
// A list's filters (U20, H16): one quiet control opens them, and the ones that are set show as chips above the list,
// each a link that clears just that filter. Nothing here is a form of its own: `body` is the page's own GET form.
export function filterFold(body: string, applied = 0) {
 return `<details class="filter-fold"><summary class="btn btn-outline btn-sm">Filters${applied ? ` <span class="filter-count">${applied}</span>` : ''}</summary><div class="filter-body">${body}</div></details>`
}
// `defs` maps each filter's query name to its label; a chip reads "Label: value" and removes that name from the address.
export function filterChips(path: string, params: URLSearchParams, defs: Record<string, string>) {
 const set = Object.keys(defs).filter(k => params.get(k))
 const chip = (k: string) => { const rest = new URLSearchParams(params); rest.delete(k); rest.delete('cursor'); const q = rest.toString(); return `<a class="chip chip-filter" href="${esc(path + (q ? `?${q}` : ''))}">${esc(defs[k])}: ${esc(params.get(k))}<span aria-hidden="true">×</span><span class="sr-only"> (clear)</span></a>` }
 return { applied: set.length, chips: set.length ? `<p class="filter-chips">${set.map(chip).join('')}</p>` : '' }
}
// Filters first, then the chips: the strip above a list.
export function filterBar(path: string, params: URLSearchParams, defs: Record<string, string>, body: string, lead = '') {
 const { applied, chips } = filterChips(path, params, defs)
 return `<div class="filter-bar">${lead}${filterFold(body, applied)}</div>${chips}`
}
