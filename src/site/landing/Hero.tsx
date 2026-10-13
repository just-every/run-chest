import { Actions } from './Actions'
import { HeroRecord } from './drawings/HeroRecord'

/** The hero: headline, subhead, the "100% free" line, the actions, the licence line, and the record drawing. */
export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title">The right version, every time.</h1>
        <p className="hero-sub">Chest files every document, keeps every original, and shows everyone the approved version.</p>
        <p className="hero-free">100% free, open source alternative to <span className="hero-alts"><strong>Google Drive</strong>, <strong>Dropbox</strong> and <strong>Box</strong></span></p>
        <Actions />
        <p className="hero-licence mono">Free and open source, MIT licensed.</p>
      </div>
      <HeroRecord />
    </section>
  )
}
