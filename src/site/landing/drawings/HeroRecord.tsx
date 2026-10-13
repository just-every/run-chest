import { Folder, Icon } from '../../shell/Icon'
import { Callout } from './Callout'

/** The hero drawing: a Chest record whose new version waits for review while the approved one stays current. */
export function HeroRecord() {
  return (
    <figure className="hero-drawing" aria-label="A Chest record: a new version waits for review while the approved version stays current.">
      <Folder className="folder-hero">
        <div className="record-head">
          <p className="record-title">Public liability certificate</p>
          <p className="record-relation">Supplier <span aria-hidden="true">·</span> Kestrel Freight</p>
        </div>
        <ol className="record-rows">
          <li className="record-row">
            <Callout n={1}>{'Upload the\nnew one'}</Callout>
            <Icon name="document" /><span className="mono record-file">liability-2027.pdf</span><span className="chip">Submitted</span>
          </li>
          <li className="record-row record-row-current">
            <Callout n={2}>{'Everyone still\nopens this one'}</Callout>
            <Icon name="document" /><span className="mono record-file">liability-2026.pdf</span><span className="tab tab-cobalt record-tab">Current approved</span>
          </li>
          <li className="record-row record-row-action">
            <Callout n={3}>{'Approve it.\nNow it’s current.'}</Callout>
            <span className="btn btn-approve record-approve">Approve this exact version</span>
          </li>
        </ol>
      </Folder>
    </figure>
  )
}
