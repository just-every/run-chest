import { sectionCopy } from '../copy'
import { FileTile, Icon } from '../art/icons'
import { keep } from '../Prose'
import { Section } from '../Section'
import './road.css'

/** The nine dock photos on Luis's phone (public/site/dock/, cleaned from page-05 by 12ui); three carry captions. */
const photos: [string, string?][] = [['loading-dock', 'IMG_4471.HEIC'], ['shipping-label', 'IMG_4472.HEIC'], ['damaged-carton'], ['clipboard'], ['forklift'], ['warehouse-racks'], ['pallet-jack'], ['packing-material', 'IMG_4478.HEIC'], ['pallet-row']]

const finderRows: { name: string; kind: 'folder' | 'image' | 'doc'; state: 'local' | 'cloud'; note?: string; menu?: boolean }[] = [
  { name: 'Legal', kind: 'folder', state: 'local', menu: true },
  { name: 'Tax', kind: 'folder', state: 'local' },
  { name: 'Invoices', kind: 'folder', state: 'cloud' },
  { name: 'Delivery photos', kind: 'image', state: 'cloud', note: '45 of 48 · on demand' },
  { name: 'Contract.docx', kind: 'doc', state: 'local', note: 'v5' },
]

function Photo({ name, caption }: { name: string; caption?: string }) {
  return (
    <span className="dock-photo">
      <picture>
        <source type="image/avif" srcSet={`/site/dock/${name}-200.avif 200w, /site/dock/${name}-400.avif 400w`} sizes="(max-width: 760px) 30vw, 110px" />
        <img src={`/site/dock/${name}-200.webp`} srcSet={`/site/dock/${name}-200.webp 200w, /site/dock/${name}-400.webp 400w`} sizes="(max-width: 760px) 30vw, 110px" alt="" width="200" height="278" loading="lazy" decoding="async" />
      </picture>
      {caption ? <span className="f11 dock-caption">{caption}</span> : null}
    </span>
  )
}

/** page-05: Luis offline on a flight and at the dock: the Mac's sync popover and Finder, and the phone's upload. */
export function Road() {
  return (
    <Section id="road" copy={sectionCopy.road} layout="left" className="road">
      <figure className="road-art" aria-label="On Fri, Oct 9 Chest on Luis's Mac is up to date: Contract.docx was edited offline on the flight, Dana changed it too, both were kept and Luis chose v5. In Finder, Vendors / Acme Supply shows folders kept on the Mac or in the cloud, with Free up space. His phone shows Delivery photos: 45 of 48 uploaded, 3 waiting for Wi-Fi.">
        <div className="menubar" aria-hidden="true">
          <span className="menubar-chest"><Icon name="cloud" /></span><Icon name="wifi" /><span className="battery" /><span className="f14 ink menubar-date">Fri Oct 9</span><span className="f14 ink">7:42 PM</span>
        </div>
        <div className="card popover">
          <p className="pop-row"><Icon name="checkCircle" className="ico pop-ok" /><span className="f15"><b>Chest</b>{keep(' · Up to date')}</span></p>
          <p className="pop-row"><FileTile kind="doc" className="tile-xs" /><span className="f15"><b>Contract.docx</b>{keep(' · edited offline on the flight')}</span></p>
          <p className="pop-row pop-conflict"><span className="pop-alert" aria-hidden="true">!</span><span className="f15">Conflict: Dana changed it too</span></p>
          <p className="pop-row"><Icon name="checkCircle" className="ico pop-ok" /><span className="f15"><b>Kept both</b>{keep(' · Luis chose v5')}</span></p>
          <p className="pop-row"><Icon name="cloud" className="ico pop-cloud" /><span className="f15"><b>Delivery photos</b>{keep(' · 45 of 48 · on demand')}</span></p>
          <p className="pop-foot dim"><span className="f13">{keep('Last synced 7:42 PM · 0 errors')}</span></p>
        </div>
        <div className="card finder">
          <div className="finder-bar"><span className="term-dots" aria-hidden="true"><i /><i /><i /></span><Icon name="chevronLeft" className="ico finder-nav" /><b className="f15 ink">Acme Supply</b></div>
          <div className="finder-body">
            <div className="finder-side">
              <span className="f12 dim finder-label">Favorites</span>
              <span className="f14 mid">Recents</span>
              <span className="f14 mid">Desktop</span>
              <span className="f12 dim finder-label">Locations</span>
              <span className="f14 finder-chest"><img src="/brand/mark.svg" alt="" width="18" height="18" />Chest</span>
            </div>
            <ul className="finder-list">
              {finderRows.map(row => (
                <li key={row.name} className={row.menu ? 'is-selected' : undefined}>
                  <span className="finder-row">
                    <FileTile kind={row.kind} className="tile-xs" />
                    <span className="f14 ink grow">{row.name}</span>
                    {row.note ? <span className="f13 dim">{keep(row.note)}</span> : null}
                    {row.state === 'local' ? <Icon name="checkCircle" className="ico state-local" label="On this Mac" /> : <Icon name="cloud" className="ico state-cloud" label="In Chest, opens on demand" />}
                  </span>
                  {row.menu ? <span className="finder-menu"><span className="f13">Keep downloaded</span><span className="f13 is-hot">Free up space</span><span className="f13">Copy Chest link</span></span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <svg className="road-arrow" viewBox="0 0 90 60" aria-hidden="true"><path d="M4 18C28 2 64 4 80 40" /><path d="M70 34l10 9 5-13" /></svg>
        <div className="phone">
          <div className="phone-screen">
            <p className="phone-status" aria-hidden="true"><span className="f14 ink">4:18</span><span className="island" /><span className="phone-icons"><span className="bars" /><Icon name="wifi" /><span className="battery" /></span></p>
            <Icon name="chevronLeft" className="ico phone-back" />
            <p className="phone-title">Delivery photos</p>
            <div className="dock-grid">{photos.map(([name, caption]) => <Photo key={name} name={name} caption={caption} />)}</div>
            <span className="phone-progress" aria-hidden="true"><i /></span>
            <p className="f14 mid phone-note">{keep('45 of 48 uploaded · 3 waiting for Wi-Fi')}</p>
          </div>
        </div>
      </figure>
    </Section>
  )
}
