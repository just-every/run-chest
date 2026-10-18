import type { Row } from '../model'
import type { PublicLink, Link } from '../files/model'
export type LinkScope = { item: string; by: string; intended: string[]; automatic: boolean; lastScan: string | null }
export type Finding = { id: string; kind: 'public-link'|'link'; revision: string; item: string; name: string; audience: string; affected: string[]; reasons: string[]; version: string | null; folder: boolean; outcomes: { succeeded: number; refused: number; failed: number }; repairs: string[] }
export type Repair = { item: string; link: string; kind: 'public-link'|'link'; action: string; by: string; at: string; automatic: boolean; before: Row<PublicLink|Link>; afterRevision: string; undone: string | null; notice: string }
