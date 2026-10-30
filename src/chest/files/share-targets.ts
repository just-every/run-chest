import type { Bindings } from '../../auth.server'
import { allowed, everything, who } from './access'
// The files and folders a person may share, named by their place ("Vendors / Acme / Tax"), for forms that start from
// the whole Chest instead of one page: a delivery package, a file request.
export async function shareTargets(env: Bindings, w: Awaited<ReturnType<typeof who>>, only?: 'folder') {
 const all = await everything(env, w)
 const name = (id: string): string => { const e = all.get(id); return e ? (e.row.payload.parent ? `${name(e.row.payload.parent)} / ` : `${e.space.payload.kind === 'personal' ? 'My files' : e.space.payload.name} / `) + e.row.payload.name : '' }
 return [...all.values()].filter(e => !e.state.trash && allowed(e, 'share') && (only ? e.row.payload.type === 'folder' : allowed(e, 'download'))).map(e => ({ id: e.row.id, label: name(e.row.id) })).sort((a, b) => a.label.localeCompare(b.label))
}
