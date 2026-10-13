import { AccessDrawing } from './drawings/AccessDrawing'
import { BesideDrawing } from './drawings/BesideDrawing'
import { DatesDrawing } from './drawings/DatesDrawing'
import { ExportDrawing } from './drawings/ExportDrawing'
import { FilingDrawing } from './drawings/FilingDrawing'
import { FreeDrawing } from './drawings/FreeDrawing'
import { StartDrawing } from './drawings/StartDrawing'
import { VersionsDrawing } from './drawings/VersionsDrawing'
import type { SectionProps } from './Section'

/** The sections in page order, with their exact copy (SPEC §1.3). */
export const sections: Omit<SectionProps, 'side'>[] = [
  { id: 'free', heading: 'Free for the whole library.', line: 'Chest is 100% free and open source. It’s MIT licensed, so it’s yours to use, change and run.', label: 'A folder holding the MIT License.', drawing: <FreeDrawing /> },
  { id: 'filing', heading: 'File it once. Find it fast.', line: 'Give each document a type, an owner and a supplier, customer or project. Search by title or any field.', label: 'A filed record: search, document type, supplier, owner and review date.', drawing: <FilingDrawing /> },
  { id: 'versions', heading: 'Every original, kept.', line: 'A replacement adds a new version. The old one stays, with who approved it and when.', label: 'Three versions of a certificate; the 2026 version is current approved.', drawing: <VersionsDrawing /> },
  { id: 'access', heading: 'The right people, and only them.', line: 'Let people and groups read, edit or review. Remove someone, and their access ends everywhere.', label: 'The effective readers of one document.', drawing: <AccessDrawing /> },
  { id: 'dates', heading: 'Renewals you won’t miss.', line: 'Set a review date and an expiry date. Chest lists what’s due and records who checked it.', label: 'Review and expiry work: one due, one upcoming, one completed with evidence.', drawing: <DatesDrawing /> },
  { id: 'beside', heading: 'Try it beside your drive.', line: 'Drafts can stay where your team writes them. File the approved records in Chest.', label: 'A loose draft, and an arrow to a folder tabbed Approved.', drawing: <BesideDrawing /> },
  { id: 'export', heading: 'Take the whole library with you.', line: 'One export holds every original, version, decision and grant. Restore it into a fresh Chest.', label: 'The whole library bundled in one folder, tabbed library.rer.', drawing: <ExportDrawing /> },
  { id: 'start', heading: 'Put your records in order.', label: 'A folder of filed records.', drawing: <StartDrawing />, closing: true },
]
