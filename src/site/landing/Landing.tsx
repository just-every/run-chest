import './art/art.css'
import './landing.css'
import { SiteFooter } from '../shell/SiteFooter'
import { SiteHeader } from '../shell/SiteHeader'
import { Feature } from './Feature'
import { Hero } from './hero/Hero'
import { pairs, settled } from './sections'
import { Closing } from './sections/Closing'
import { Details } from './sections/Details'
import { Interlude } from './sections/Interlude'
import { Ownership } from './sections/Ownership'

/** The run site's homepage (run-chest.com), the desk's page-01 … page-09 in order. Static; no script. */
export function Landing() {
  return (
    <>
      <SiteHeader />
      <main id="top" className="landing">
        <Hero />
        {pairs.map(section => <Feature key={section.id} {...section} />)}
        <Interlude />
        {settled.map(section => <Feature key={section.id} {...section} />)}
        <Ownership />
        <Details />
        <Closing />
      </main>
      <SiteFooter />
    </>
  )
}
