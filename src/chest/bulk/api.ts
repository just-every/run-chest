import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist } from '../model'
import { archive } from './archive'
import { cancelJob, createJob, jobs, ownedJob, runJob, viewJob } from './jobs'
export async function bulkExecute(env: Bindings, request: Request, s: Session, method: string, parts: string[], input: any, _url: URL): Promise<any> {
 if (parts[0] !== 'bulk') return undefined
 if (method !== 'GET' && method !== 'HEAD') insist(request.headers.get('origin') === env.AUTH_ORIGIN && request.headers.get('sec-fetch-site') !== 'cross-site', 'invalid_origin', 403)
 const [,key,action] = parts
 if (parts.length === 1 && method === 'GET') return { jobs: await jobs(env,s) }
 if (parts.length === 1 && method === 'POST') return createJob(env,s,input)
 if (key && parts.length === 2 && method === 'GET') return viewJob(env,s,await ownedJob(env,s,key))
 if (key && parts.length === 3 && method === 'POST' && action === 'run') return runJob(env,s,key,input)
 if (key && parts.length === 3 && method === 'POST' && action === 'cancel') return cancelJob(env,s,key)
 if (key && parts.length === 3 && method === 'GET' && action === 'archive') return archive(env,s,key)
 insist(false,'not_found',404)
}
