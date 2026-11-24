// Test-only Worker entry: serves the built Worker unchanged, but hands it a D1 binding that adds up the rows
// each statement reads (D1 bills `meta.rows_read`). `GET /__d1_rows` returns the total since the last call.
import app from './index.js'
let rows = 0, statements = 0, unmetered = 0, bySql = new Map()
const record = (meta, sql, values = []) => { if (Number.isFinite(meta?.rows_read)) { rows += meta.rows_read; statements++; const key = values.length && typeof values[0] === 'string' && values[0].length < 40 ? `${sql} [${values[0]}]` : sql; bySql.set(key, (bySql.get(key) ?? 0) + meta.rows_read) } else unmetered++ }
const wrap = (statement, sql, values = []) => ({
 _statement: statement, _sql: sql,
 bind: (...values) => wrap(statement.bind(...values), sql, values),
 run: async () => { const result = await statement.run(); record(result.meta, sql, values); return result },
 all: async () => { const result = await statement.all(); record(result.meta, sql, values); return result },
 raw: async () => { const result = await statement.all(); record(result.meta, sql, values); return result.results.map(Object.values) },
 first: async column => { const result = await statement.all(); record(result.meta, sql, values); const row = result.results[0]; return row === undefined ? null : column === undefined ? row : row[column] },
})
const metered = db => ({
 prepare: sql => wrap(db.prepare(sql), sql),
 batch: async statements => { const results = await db.batch(statements.map(s => s._statement)); results.forEach((r, i) => record(r.meta, statements[i]._sql)); return results },
 exec: sql => db.exec(sql),
})
const through = env => ({ ...env, DB: metered(env.DB) })
export default {
 ...app,
 fetch(request, env, execution) {
  if (new URL(request.url).pathname === '/__d1_rows') { const report = { rows, statements, unmetered, top: [...bySql].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sql, n]) => ({ rows: n, sql: sql.replace(/\s+/g, ' ').slice(0, 160) })) }; rows = statements = unmetered = 0; bySql = new Map(); return Response.json(report) }
  return app.fetch(request, through(env), execution)
 },
 scheduled: (controller, env, execution) => app.scheduled(controller, through(env), execution),
}
