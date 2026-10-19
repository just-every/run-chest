import { sectionCopy } from '../copy'
import { FileTile, Icon } from '../art/icons'
import { keep } from '../Prose'
import { Section } from '../Section'
import './renewal.css'

/** page-10: a year on, "net 30 acme" finds the payment clause, the delivery note's terms and the invoice. */
export function Renewal() {
  return (
    <Section id="renewal" copy={sectionCopy.renewal} layout="right" className="renewal">
      <figure className="renewal-art" aria-label="Search for net 30 acme: 3 results in 0.2 s. Contract.docx v7, approved, in Vendors / Acme Supply: §3 Payment is due within 30 days of the invoice date. Delivery_note_scan.jpg, scanned, in Delivery photos: Terms Net 30, Acme Supply Co. Invoice-0042.pdf in Invoices: Net 30, due Nov 1, 2026. Behind it, the printed supply agreement and invoice the words were read from.">
        <div className="paper paper-contract">
          <b className="f18">Supply Agreement · Acme Supply Co.</b>
          <p className="f16">§2 Delivery. Supplier ships within 5 <br />business days of each order.</p>
          <p className="f16">§3 Payment is due within <mark>30 days</mark> of <br />the invoice date.</p>
          <p className="f16 paper-desk">§4 Either party may end this agreement <br />with 30 days’ written notice.</p>
        </div>
        <div className="paper paper-invoice">
          <b className="f20">ACME SUPPLY CO.</b>
          <p className="f17">Invoice 0042 · Oct 2, 2026</p>
          <p className="f17">Pallet wrap, corner boards, freight</p>
          <p className="f17">Total $4,180.00</p>
          <p className="f17">Terms: <mark>Net 30</mark></p>
          <p className="f17">Due Nov 1, 2026</p>
        </div>
        <div className="card search-card">
          <p className="search-box"><Icon name="search" className="ico" /><span className="f24 ink">net 30 acme</span></p>
          <p className="f16 dim search-count">3 results · 0.2 s</p>
          <ul className="hits">
            <li><FileTile kind="doc" className="hit-tile" /><span className="hit-text"><b className="f20 ink">Contract.docx<span className="hit-tag"><span className="sep">{'\u00a0·\u00a0'}</span>{keep('v7 · approved')}</span></b><span className="f18 dim">{keep('Vendors / Acme Supply')}</span><span className="f18 mid">§3 Payment is due within <mark>30 days</mark> of the invoice date</span></span></li>
            <li><FileTile kind="image" className="hit-tile hit-photo" /><span className="hit-text"><b className="f20 ink">Delivery_note_scan.jpg<span className="hit-tag"><span className="sep">{'\u00a0·\u00a0'}</span>scanned</span></b><span className="f18 dim">Delivery photos</span><span className="f18 mid">Terms: <mark>Net 30</mark> · Acme Supply Co.</span></span></li>
            <li><FileTile kind="pdf" className="hit-tile hit-pdf" /><span className="hit-text"><b className="f20 ink">Invoice-0042.pdf</b><span className="f18 dim">Invoices</span><span className="f18 mid"><mark>Net 30</mark> · due Nov 1, 2026</span></span></li>
          </ul>
        </div>
      </figure>
    </Section>
  )
}
