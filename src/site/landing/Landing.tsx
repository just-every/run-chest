import './art/art.css'
import './landing.css'
import { SiteFooter } from '../shell/SiteFooter'
import { SiteHeader } from '../shell/SiteHeader'
import { Hero } from './hero/Hero'
import { Arrivals } from './sections/Arrivals'
import { CloseOut } from './sections/CloseOut'
import { Closing } from './sections/Closing'
import { Folder } from './sections/Folder'
import { MoveIn } from './sections/MoveIn'
import { Pricing } from './sections/Pricing'
import { Renewal } from './sections/Renewal'
import { Road } from './sections/Road'
import { ShareOut } from './sections/ShareOut'
import { SignOff } from './sections/SignOff'

/**
 * The run site's homepage (run-chest.com), the owner-approved structure page-s1 in order: the hero, then one
 * supplier's folder from the move-in on Sat, Sep 26 to the renewal, then the closing. Static; no script.
 */
export function Landing() {
  return (
    <>
      <SiteHeader />
      <main id="top" className="landing">
        <Hero />
        <MoveIn />
        <Folder />
        <Arrivals />
        <Road />
        <Pricing />
        <ShareOut />
        <SignOff />
        <CloseOut />
        <Renewal />
        <Closing />
      </main>
      <SiteFooter />
    </>
  )
}
