import { SyncError } from './api.mjs';

// Keep the first journal watermark while walking every candidate page, including
// pages whose candidates are all hidden by current authorization.
export async function enumerateTree(api) {
  let cursor, after = '';
  const items = [], spaces = new Map();
  for (;;) {
    const page = await api.tree(after ? { cursor, after } : undefined);
    if (!Number.isSafeInteger(page?.cursor) || page.cursor < 0 ||
        !Array.isArray(page.items) || !Array.isArray(page.spaces) ||
        !(page.next === null || typeof page.next === 'string' && page.next.length <= 200 && page.next > after)) {
      throw new SyncError('invalid_server_tree');
    }
    if (cursor === undefined) cursor = page.cursor;
    else if (page.cursor !== cursor) throw new SyncError('invalid_server_tree');
    items.push(...page.items);
    for (const space of page.spaces) spaces.set(space.id, space);
    if (page.next === null) return { cursor, spaces: [...spaces.values()], items };
    after = page.next;
  }
}
