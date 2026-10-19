// The hero's cards: the co-edited contract, the share link and the versions.
import { FileTile, Icon, More } from '../art/icons'
import { Avatar, Cursor } from '../art/marks'

/**
 * The Acme Supply contract with Dana's and Luis's cursors on two highlighted clauses. The lines break where the desk
 * broke them; each arrow hangs below its highlight and its name tag lands past the end of the shorter line beneath.
 */
export function ContractCard() {
  return (
    <div className="card contract">
      <div className="row contract-head">
        <FileTile kind="doc" />
        <div className="stack grow"><b className="f16 ink nowrap">Acme Supply Contract</b><span className="f13 dim nowrap">Contract · Updated 2h ago</span></div>
        <span className="avatars"><Avatar initial="D" tone="violet" /><Avatar initial="L" tone="green" /><span className="avatar avatar-grey" aria-hidden="true">+</span></span>
      </div>
      <p className="f15 clause">3. Payment Terms</p>
      <p className="f15 clause-text">Acme Supply shall invoice monthly for all <br />products and services provided under this <br />agreement. <mark className="hl-violet">Payment is due within 30 days<Cursor name="Dana" tone="violet" className="cursor-dana" /></mark> <br />of the invoice date.</p>
      <p className="f15 clause clause-2">4. Term and Termination</p>
      <p className="f15 clause-text clause-green"><mark className="hl-green">Either party may end this agreement<Cursor name="Luis" tone="green" className="cursor-luis" /></mark> <br />with 30 days’ written notice.</p>
    </div>
  )
}

/** "Share link · expires Oct 31 · 3 of 10 downloads". */
export function ShareLinkCard() {
  return (
    <div className="card share-link row">
      <span className="round-ico"><Icon name="link" /></span>
      <div className="stack grow"><b className="f16 ink">Share link</b><span className="f13 mid nowrap">expires Oct 31<span className="then"><span className="sep"> · </span>3 of 10 downloads</span></span></div>
      <More />
    </div>
  )
}

const versions = [
  { v: 'v7', at: 'Oct 28, 2026, 11:06 AM', approved: true },
  { v: 'v6', at: 'Oct 24, 2026, 3:15 PM' },
  { v: 'v5', at: 'Oct 9, 2026, 7:40 PM' },
]

/** v7 (approved), v6, v5. */
export function VersionStack() {
  return (
    <div className="card version-stack">
      {versions.map(row => (
        <div className="row version-row" key={row.v}>
          <FileTile kind="doc" className="tile-sm" />
          <div className="stack grow"><b className="f15 ink">{row.v}</b><span className="f13 mid nowrap">{row.at}</span></div>
          {row.approved ? <span className="chip chip-ok f13">approved</span> : null}
          <More />
        </div>
      ))}
    </div>
  )
}
