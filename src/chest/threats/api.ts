import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist } from '../model'
import { canAdmin, requireAnyAdmin } from '../administration/roles'
import { historyView, pauseSubject, resumeSubject } from './activity'
import { policyView, savePolicy } from './policy'
import { quarantineView, releaseScan } from './quarantine'
import { removeScanner, saveScanner, scannerView, testScanner } from './scanner'
// /api/chest/threats: the content threats console. Security-scope admins see quarantine, alerts, pauses and the rules
// they may tune; service-settings admins connect the scanner.
export async function consoleView(env: Bindings, s: Session) {
 const security = await requireAnyAdmin(env, s, 'sharing-security').then(() => true, () => false), service = await canAdmin(env, s, 'service-settings')
 insist(security || service, 'admin_required', 403)
 return { scanner: await scannerView(env), canConnect: service, security, quarantine: security ? await quarantineView(env, s) : [], history: security ? await historyView(env, s) : { alerts: [], pauses: [] }, policy: security ? await policyView(env, s) : null }
}
export async function threatsExecute(env: Bindings, s: Session, method: string, parts: string[], input: any): Promise<unknown> {
 if (parts[0] !== 'threats') return undefined
 const [, head, key, verb] = parts, post = method === 'POST'
 if (method === 'GET' && !head) return consoleView(env, s)
 if (post && head === 'scanner' && !key) return saveScanner(env, s, input)
 if (post && head === 'scanner' && key === 'remove') return removeScanner(env, s)
 if (post && head === 'scanner' && key === 'test') return testScanner(env, s)
 if (post && head === 'policy' && !key) return savePolicy(env, s, input)
 if (post && head === 'quarantine' && key && verb === 'release') return releaseScan(env, s, key, input)
 if (post && head === 'pauses' && !key) return pauseSubject(env, s, input)
 if (post && head === 'pauses' && key && verb === 'resume') return resumeSubject(env, s, key)
 insist(false, 'not_found', 404)
}
