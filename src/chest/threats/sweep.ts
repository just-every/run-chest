import type { Bindings } from '../../auth.server'
import { pruneActivity } from './activity'
import { sweepScans } from './scanner'
// Scheduled and after signed-in requests: scan waiting originals and drop activity older than any window.
export async function sweepThreats(env: Bindings) {
 try { await Promise.all([sweepScans(env), pruneActivity(env)]) } catch (e) { console.error('chest threats', e) }
}
