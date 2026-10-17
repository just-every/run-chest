// The hero's paper: the receipt photo uploading from a phone and the scanned NDA read into fields. Each sheet is a
// blank plate redrawn with 12ui from the approved hero (public/site/receipt.webp, scan-paper.webp); every word on it
// is HTML set over the paper.
import { FileTile } from '../art/icons'

const receiptLines: [string, string][] = [['Office Supplies', '$152.40'], ['Shipping', '$12.00'], ['Tax', '$14.44']]

/** The Acme Supply receipt photographed on a phone, its printing set over the blank plate. */
export function ReceiptCard() {
  return (
    <div className="card receipt-frame">
      <div className="receipt-photo">
        <img className="photo" src="/site/receipt.webp" alt="" width="212" height="244" />
        <div className="receipt-print">
          <p className="receipt-name">ACME SUPPLY</p>
          <p>123 Market St<br />San Francisco, CA 94105</p>
          <p className="receipt-date">10/14/2026 9:12 AM</p>
          <dl>
            {receiptLines.map(([item, amount]) => <div key={item}><dt>{item}</dt><dd>{amount}</dd></div>)}
            <div className="receipt-total"><dt>Total</dt><dd>$178.84</dd></div>
          </dl>
        </div>
      </div>
    </div>
  )
}

/** "Uploading 62% · Receipt 2026-10-14.jpg". */
export function UploadCard() {
  return (
    <div className="card upload-card row">
      <svg className="ring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" /><circle className="ring-done" cx="24" cy="24" r="19" pathLength="100" strokeDasharray="62 100" /></svg>
      <div className="stack"><b className="f165 ink nowrap">Uploading 62%</b><span className="f14 dim nowrap">Receipt 2026-10-14.jpg</span></div>
    </div>
  )
}

/** NDA.pdf, scanned: the typed agreement on paper with the date, party and amount boxed where they were read. */
export function NdaCard() {
  return (
    <div className="card nda-card">
      <div className="row nda-head"><FileTile kind="pdf" /><div className="stack"><b className="f16 ink">NDA.pdf</b><span className="f13 dim">Scanned · 3 pages</span></div></div>
      <div className="scan">
        <p className="scan-title">Non-disclosure agreement</p>
        <p className="scan-text">Acme Supply Co.<span className="then"><span className="sep"> · </span>Harbor Freight</span></p>
        <dl className="scan-fields">
          <div><dt>Date:</dt><dd><span className="field">Oct 1, 2026</span></dd></div>
          <div><dt>Party:</dt><dd><span className="field field-wide">Acme Supply Co.</span></dd></div>
          <div><dt>Amount:</dt><dd><span className="field">$50,000</span></dd></div>
        </dl>
        <p className="scan-text">Signed by both parties, Oct 1, 2026.</p>
      </div>
    </div>
  )
}

/** "Filed W-9 Acme Supply.pdf → Vendors / Acme / Tax · Undo". */
export function FiledToast() {
  return (
    <div className="card toast row">
      <FileTile kind="doc" className="tile-sm" />
      <div className="stack grow"><span className="f14 ink">Filed W-9 Acme Supply.pdf <span aria-hidden="true">→</span></span><span className="f13 dim">Vendors / Acme / Tax</span></div>
      <span className="f14 undo">Undo</span>
    </div>
  )
}
