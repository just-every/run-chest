import { HeroCollage } from './HeroCollage'
import { heroCopy } from '../copy'
import { prose } from '../Prose'
import './hero.css'

/** Page 1: "Every file, where it should be." beside the live folder collage. */
export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title" className="two-tone"><span className="ink-part">Every file,</span><br />where it<br />should be.</h1>
        <p className="hero-sub">{prose(heroCopy.sub)}</p>
        <p className="hero-free">100% free, open source alternative to <strong>Google Drive</strong>, <strong>Dropbox</strong> and <strong>Box</strong></p>
        <div className="hero-actions">
          <a className="btn" href="/run">Run Chest <span className="arrow" aria-hidden="true">→</span></a>
          <a className="text-link" href={heroCopy.demo}>Try the demo</a>
          <a className="text-link" href="/docs">Read the docs</a>
        </div>
      </div>
      <div className="hero-art"><HeroCollage /></div>
    </section>
  )
}
