import type { Ctx, Who } from './access'
import { descend, start } from './access'
import { live } from './model'

// Explain this person's current access using the same path walk as enforcement.
// A restricted ancestor's name is included only when this person can open it.
export function accessExplanation(ctx: Ctx, w: Who) {
 const reasons: string[] = [], grants = (rows: { principal: string; role: string; expires?: string }[], source: string) => {
  for (const g of rows.filter(g => w.principals.includes(g.principal) && live(g))) {
   const group = w.groups.find(r => r.id === g.principal)
   reasons.push(`${g.role.replace('_', ' ')} through ${group ? `group “${group.payload.name}”` : 'your named access'} ${source}${g.expires ? ` until ${g.expires}` : ''}.`)
  }
 }
 let state = start(ctx.space.payload, w)
 if (ctx.space.payload.kind === 'personal' && ctx.space.payload.owner === w.email) reasons.push('You own this personal area.')
 else grants(ctx.space.payload.members, `in space “${ctx.space.payload.name}”`)
 if (state.noDownload) reasons.push('The space turns off downloads for viewers and commenters.')
 for (const node of ctx.chain) {
  state = descend(state, node, w, ctx.links)
  if (node.payload.restricted && !state.manager) reasons.length = 0
  const source = state.role ? `on “${node.payload.name}”` : 'on an ancestor'
  if (node.payload.restricted) reasons.push(`Inherited access stops ${source}; space managers keep their access.`)
  grants(node.payload.grants, source)
  for (const link of ctx.links.filter(l => l.payload.item === node.id && (l.payload.discoverable || w.opened.includes(l.id)))) reasons.push(`${link.payload.role.replace('_', ' ')} through ${link.payload.discoverable ? 'a discoverable organization link' : 'an organization link you opened'} ${source}. Revoking it ends that access.`)
  if (node.payload.noDownload) reasons.push(`Downloads are turned off for viewers and commenters ${source}.`)
 }
 if (!ctx.space.payload.settings.editorSharing && ctx.space.payload.kind === 'team') reasons.push('Only space managers may share from this space.')
 return reasons
}
