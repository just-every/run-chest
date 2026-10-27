export const CLIENT_VERSION = 'chest-sync-companion/1';

export class SyncError extends Error {
  constructor(code, status = 0) { super(code); this.code = code; this.status = status; }
}

export function client({ origin, token, allowHttp = false, fetch: fetchImpl = globalThis.fetch }) {
  let url;
  try { url = new URL(origin); } catch { throw new SyncError('invalid_origin'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !(url.protocol === 'https:' || (allowHttp && local && url.protocol === 'http:'))) {
    throw new SyncError('https_origin_required');
  }
  if (typeof token !== 'string' || !/^chest_dev_[A-Za-z0-9_-]{43}$/.test(token)) throw new SyncError('device_token_required');
  async function request(path, options = {}) {
    let response;
    try {
      response = await fetchImpl(`${url.origin}/api/chest/sync${path}`, {
        ...options, redirect: 'error', headers: { ...options.headers, authorization: `Bearer ${token}` },
      });
    } catch { throw new SyncError('network_interrupted'); }
    if (!response.ok) {
      let code = `http_${response.status}`;
      try {
        const body = await response.json();
        if (/^[a-z][a-z0-9_]{0,79}$/.test(body.error)) code = body.error;
      } catch { /* Do not include untrusted response text or credentials in errors. */ }
      throw new SyncError(code, response.status);
    }
    return response;
  }
  async function json(path, options) {
    try { return await (await request(path, options)).json(); }
    catch (error) { if (error instanceof SyncError) throw error; throw new SyncError('invalid_server_response'); }
  }
  return {
    origin: url.origin,
    tree: (page) => json('/tree' + (page ? '?' + new URLSearchParams({ cursor: String(page.cursor), after: page.after }) : '')),
    policy: folder => json(`/repair?folder=${encodeURIComponent(folder)}`),
    report: body => json('/repair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    hydrate: (item, version, offset = 0) => request(`/items/${encodeURIComponent(item)}/content?version=${encodeURIComponent(version)}`,
      { headers: offset ? { range: `bytes=${offset}-` } : {} }),
    upload: (item, base, body) => json(`/items/${encodeURIComponent(item)}/content`, {
      method: 'PUT', headers: { 'if-match': base, 'content-type': 'application/octet-stream' }, body,
    }),
  };
}

export function reasonFor(error) {
  if (error instanceof SyncError) return error.code;
  if (error?.code === 'ENOSPC' || error?.code === 'EDQUOT') return 'insufficient_cache';
  if (['EACCES', 'EPERM'].includes(error?.code)) return 'local_permission_denied';
  return 'local_io_failed';
}
