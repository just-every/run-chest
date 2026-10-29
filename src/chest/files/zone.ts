import { insist } from '../model'
// Restore to a date takes the wall-clock time a person reads on their own clock, with its time zone named beside it.
// The moment is found by reading the zone's offset at that wall time (twice, so a daylight-saving change is honoured).
const offset = (t: number, zone: string) => {
 const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(t).map(x => [x.type, x.value]))
 return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000
}
export function zoned(local: unknown, zone: unknown) {
 insist(typeof local === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(local), 'invalid_point')
 insist(typeof zone === 'string' && zones().includes(zone), 'invalid_zone')
 const wall = Date.parse(`${local}Z`); insist(Number.isFinite(wall), 'invalid_point')
 const first = wall - offset(wall, zone)
 return new Date(wall - offset(first, zone)).toISOString()
}
// A date picked for an expiry or deadline ends at the last moment of that day on the person's own clock. Forms send
// the browser's zone (chest-time.js fills the hidden field); without it the day ends in UTC.
export function dayEnd(day: string, zone: unknown) {
 return new Date(Date.parse(zoned(`${day}T23:59:59`, zone === undefined || zone === '' ? 'UTC' : zone)) + 999).toISOString()
}
export const zones = () => ['UTC', ...(Intl as any).supportedValuesOf('timeZone').filter((z: string) => z !== 'UTC')] as string[]
// The wall-clock time a moment shows in a zone, as a datetime-local value ("2026-10-18T22:00"); a value that is not a
// moment with an offset (or a zone that does not exist) passes through unchanged.
export function wallClock(value: string, zone: string) {
 if (!/(Z|[+-]\d\d:?\d\d)$/.test(value) || !Number.isFinite(Date.parse(value)) || !zones().includes(zone)) return value
 const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(Date.parse(value)).map(x => [x.type, x.value]))
 return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}
// A form's from/to typed on the person's own clock (with its zone beside) as UTC moments, for the reports that read them.
export function utcRange(params: URLSearchParams) {
 const out = new URLSearchParams(params), zone = params.get('zone') || 'UTC'
 for (const key of ['from', 'to']) { const v = params.get(key); if (v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) out.set(key, zoned(v, zone)) }
 out.delete('zone')
 return out
}
