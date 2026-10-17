import { featureCopy } from '../copy'
import type { FeatureProps } from '../Feature'
import { AgentsArt } from './AgentsArt'
import { MoveInArt } from './MoveInArt'
import { TeamsArt } from './TeamsArt'
import { SearchArt } from './SearchArt'
import { ShareArt } from './ShareArt'
import { SyncArt } from './SyncArt'
import { TogetherArt } from './TogetherArt'
import { VersionsArt } from './VersionsArt'
import './sync-share.css'
import './search-together.css'
import './versions-agents.css'
import './movein-teams.css'

/** Pages 2 to 4 of the desk, two ideas per page, the drawing alternating sides. Geometry in desk pixels. */
export const pairs: FeatureProps[] = [
  { id: 'sync', ...featureCopy.sync, art: <SyncArt />, side: 'right', height: 530, copy: { x: 92, y: 122, w: 660 }, at: { x: 590, y: 40 }, size: 88, leadSize: 22.5 },
  { id: 'sharing', ...featureCopy.sharing, art: <ShareArt />, side: 'left', height: 494, copy: { x: 876, y: 78, w: 620 }, at: { x: 80, y: 30 }, size: 95, leadSize: 23 },
  { id: 'search', ...featureCopy.search, art: <SearchArt />, side: 'right', height: 530, copy: { x: 100, y: 106, w: 640 }, at: { x: 740, y: 40 }, size: 78, leadSize: 26, tracked: true, panels: [{ x: 34, y: 28, w: 1468, h: 494 }] },
  { id: 'together', ...featureCopy.together, art: <TogetherArt />, side: 'left', height: 494, copy: { x: 958, y: 90, w: 540 }, at: { x: 84, y: 36 }, size: 80, leadSize: 25, tracked: true, panels: [{ x: 34, y: 10, w: 1468, h: 470 }] },
  { id: 'versions', ...featureCopy.versions, art: <VersionsArt />, side: 'right', height: 530, copy: { x: 101, y: 128, w: 660 }, at: { x: 760, y: 80 }, size: 90, leadSize: 25, panels: [{ x: 36, y: 92, w: 902, h: 446 }] },
  { id: 'agents', ...featureCopy.agents, art: <AgentsArt />, side: 'left', height: 494, copy: { x: 828, y: 90, w: 660 }, at: { x: 60, y: 60 }, size: 98, leadSize: 25 },
]

/** Page 6 of the desk: moving in, and the team's rules. */
export const settled: FeatureProps[] = [
  { id: 'move-in', ...featureCopy.moveIn, art: <MoveInArt />, side: 'right', height: 505, copy: { x: 143, y: 92, w: 640 }, at: { x: 790, y: 40 }, size: 79, leadSize: 26, tracked: true, panels: [{ x: 55, y: 28, w: 730, h: 477 }, { x: 785, y: 28, w: 695, h: 477 }] },
  { id: 'teams', ...featureCopy.teams, art: <TeamsArt />, side: 'left', height: 519, copy: { x: 833, y: 104, w: 640 }, at: { x: 60, y: 20 }, size: 80, leadSize: 26, tracked: true, panels: [{ x: 55, y: 0, w: 695, h: 490 }, { x: 750, y: 0, w: 730, h: 490 }] },
]
