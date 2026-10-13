import { SiteFooter } from '../shell/SiteFooter'
import { SiteHeader } from '../shell/SiteHeader'
import { Hero } from './Hero'
import { Section } from './Section'
import { sections } from './sections'
import './landing.css'
import './drawings/drawings.css'

/** The run site's homepage (run-chest.com): the hero, eight sections in order, the footer. Static; no script. */
export function Landing() {
  return (
    <>
      <SiteHeader />
      <main id="top" className="landing">
        <Hero />
        {sections.map((section, index) => <Section key={section.id} {...section} side={index % 2 ? 'left' : 'right'} />)}
      </main>
      <SiteFooter />
    </>
  )
}
