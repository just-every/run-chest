import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { requireAdmin } from '../administration/roles'
import { owner } from '../access'
import { insist, now, id } from '../model'
import { sessionPredicate } from '../store'
import { seal, unseal } from '../seal'
import { DEFAULTS, ReaderError, transcribe, type Provider, type ReaderConfig } from './provider'
import { SAMPLE_PNG, SAMPLE_TEXT } from './sample'
import { requeue } from './jobs'
// Reading scans uses the installation's own AI model key. The owner enters it on People & settings; it is sealed at
// rest and never sent back to a browser. PDF text layers are read without any key. RER Managed hosting has no
// outbound connection for seed integrations yet, so there the card says so in one plain line. The key lives in its
// own table, which archives exclude like other credentials.
const PURPOSE = 'ai-reader-key'
export type ReaderSetting = { provider: Provider; endpoint: string; model: string; workspace: string; keySealed: string; keyHint: string; updatedBy: string; updatedAt: string }
const saved = async (env: Bindings): Promise<ReaderSetting | null> => { const r: any = await env.DB.prepare('SELECT * FROM chest_reader WHERE id=1').first(); return r ? { provider: r.provider, endpoint: r.endpoint, model: r.model, workspace: r.workspace, keySealed: r.key_sealed, keyHint: r.key_hint, updatedBy: r.updated_by, updatedAt: r.updated_at } : null }
// One owner-only write and its audit row, refused unless the owner's session is still live.
async function asOwner(env: Bindings, s: Session, statement: D1PreparedStatement, action: string) {
 const p = sessionPredicate(s)
 await env.DB.batch([env.DB.prepare(`INSERT INTO chest_assert(ok) SELECT CASE WHEN (${p.sql}) THEN 1 ELSE 0 END`).bind(...p.params), statement, env.DB.prepare('INSERT INTO chest_audit VALUES(?,?,?,?,?,?)').bind(id(), s.operator.email, action, 'reader', '{}', now()), env.DB.prepare('DELETE FROM chest_assert')])
}
export const MANAGED_LINE = 'Not available yet on RER Managed hosting: it has no outbound connection for AI providers. PDF text is still read; scans and photos are read on a self-hosted install.'
export const managed = (env: Bindings) => String(env.MAIL_PROVIDER) === 'rer'
export type ReaderState = { config: ReaderConfig } | { unavailable: string } | { missing: string }
export async function readerState(env: Bindings): Promise<ReaderState> {
 if (managed(env)) return { unavailable: MANAGED_LINE }
 const row = await saved(env)
 if (!row) return { missing: 'Scans and photos need an AI model key. The owner adds one under Reading scans on People & settings.' }
 const key = await unseal(env.SESSION_SECRET, PURPOSE, row.keySealed)
 if (!key) return { missing: 'The saved AI key cannot be opened on this installation; the owner adds it again under Reading scans.' }
 const { provider, endpoint, model, workspace } = row
 return { config: { provider, endpoint, model, key, workspace } }
}
export async function readerView(env: Bindings) {
 const row = await saved(env), state = await readerState(env)
 return { saved: row ? (({ keySealed, ...rest }) => rest)(row) : null, unavailable: 'unavailable' in state ? state.unavailable : null, missing: 'missing' in state ? state.missing : null, defaults: DEFAULTS }
}
const optional = (v: unknown, name: string, max: number) => { if (v === undefined || v === null || v === '') return ''; insist(typeof v === 'string' && v.length <= max && !/[\x00-\x1f]/.test(v), `invalid_${name}`); return v.trim() }
export async function saveReader(env: Bindings, s: Session, input: any) {
 await requireAdmin(env,s,'service-settings'); insist(!managed(env), 'reader_unavailable_on_managed', 409)
 const provider = input.provider; insist(provider === 'anthropic' || provider === 'openai', 'invalid_provider')
 const endpoint = optional(input.endpoint, 'endpoint', 300) || DEFAULTS[provider as Provider].endpoint
 insist(/^https:\/\/[^\s/]+\/\S*$/.test(endpoint), 'invalid_endpoint')
 const model = optional(input.model, 'model', 120) || DEFAULTS[provider as Provider].model; insist(model, 'model_required')
 const workspace = provider === 'anthropic' ? optional(input.workspace, 'workspace', 120) : ''
 const row = await saved(env), entered = optional(input.key, 'key', 400)
 // Changing the provider details keeps the saved key unless a new one is entered.
 insist(entered || row, 'key_required')
 const sealed = entered ? await seal(env.SESSION_SECRET, PURPOSE, entered) : row!.keySealed, hint = entered ? `…${entered.slice(-4)}` : row!.keyHint
 await asOwner(env, s, env.DB.prepare('INSERT INTO chest_reader(id,provider,endpoint,model,workspace,key_sealed,key_hint,updated_by,updated_at) VALUES(1,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET provider=excluded.provider,endpoint=excluded.endpoint,model=excluded.model,workspace=excluded.workspace,key_sealed=excluded.key_sealed,key_hint=excluded.key_hint,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(provider, endpoint, model, workspace, sealed, hint, s.operator.email, now()), 'reader.save')
 // Files that waited for a key are read now.
 await requeue(env)
 return readerView(env)
}
export async function removeReader(env: Bindings, s: Session) {
 await requireAdmin(env,s,'service-settings'); insist(await saved(env), 'not_found', 404)
 await asOwner(env, s, env.DB.prepare('DELETE FROM chest_reader WHERE id=1'), 'reader.remove')
 return readerView(env)
}
export async function testReader(env: Bindings, s: Session) {
 await requireAdmin(env,s,'service-settings'); const state = await readerState(env)
 if (!('config' in state)) return { ok: false, message: 'unavailable' in state ? state.unavailable : state.missing }
 try {
  const bytes = Uint8Array.from(atob(SAMPLE_PNG), c => c.charCodeAt(0))
  const t = await transcribe(state.config, { mediaType: 'image/png', bytes, width: 520, height: 90 }, 'this sample line', 60_000)
  const ok = t.text.includes(SAMPLE_TEXT)
  return { ok, message: ok ? `Working: ${state.config.model} read the sample line “${t.text.slice(0, 80)}”.` : `The model answered but misread the sample line: “${t.text.slice(0, 80)}”.` }
 } catch (e) { return { ok: false, message: e instanceof ReaderError ? e.message : 'The AI model could not be reached.' } }
}
