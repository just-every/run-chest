import { insist } from '../model'
// Restore to a date takes the wall-clock time a person reads on their own clock, with its time zone named beside it.
// The moment is found by reading the zone's offset at that wall time (twice, so a daylight-saving change is honoured).
const offset = (t: number, zone: string) => {
 const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(t).map(x => [x.type, x.value]))
 return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000
}
export function zoned(local: unknown, zone: unknown) {
 insist(typeof local === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local), 'invalid_point')
 insist(typeof zone === 'string' && zones().includes(zone), 'invalid_zone')
 const wall = Date.parse(`${local}Z`); insist(Number.isFinite(wall), 'invalid_point')
 const first = wall - offset(wall, zone)
 return new Date(wall - offset(first, zone)).toISOString()
}
export const zones = () => ['UTC', ...(Intl as any).supportedValuesOf('timeZone').filter((z: string) => z !== 'UTC')] as string[]
