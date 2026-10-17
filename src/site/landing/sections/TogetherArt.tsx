import { FileTile, Icon, type IconName } from '../art/icons'
import { Avatar, Cursor, Ticks } from '../art/marks'
import { Place, Stage } from '../art/Place'

const tools: (IconName | '|')[] = ['bold', 'italic', 'underline', '|', 'alignLeft', 'alignCenter', 'alignRight', '|', 'bullets', 'chevronDown', '|', 'link', 'comment', '|', 'dots']

/**
 * Page 3, bottom: the Acme Supply contract open in the browser, Dana and Luis editing, Dana's comment. Each cursor is
 * drawn twice: floating at its highlight as on the desk, and as an inline tag after the words for the phone column,
 * where the lines wrap anywhere.
 */
export function TogetherArt() {
  return (
    <Stage w={860} h={440} flow className="together-art" label="Acme Supply Contract open as a Word document in the browser, Dana and Luis editing at once, and Dana's comment: Can we cap this at 30 days?">
      <Place x={0} y={0} w={771} h={440}>
        <div className="card editor">
          <div className="row editor-head">
            <FileTile kind="word" />
            <b className="f17 ink grow">Acme Supply Contract</b>
            <span className="avatars"><Avatar initial="D" tone="violet" /><Avatar initial="L" tone="blue" /></span>
            <span className="share-btn f15"><Icon name="users" /> Share</span>
            <Icon name="chevronDown" />
          </div>
          <div className="row editor-tools f135">
            <span className="tool-select">Normal text <Icon name="chevronDown" /></span><i className="tool-sep" />
            <span className="tool-select tool-font">Inter <Icon name="chevronDown" /></span><i className="tool-sep" />
            <span className="tool-select">11 <Icon name="chevronDown" /></span><i className="tool-sep" />
            {tools.map((tool, index) => tool === '|' ? <i className="tool-sep" key={index} /> : <Icon name={tool} key={index} />)}
          </div>
          <div className="editor-page">
            <p className="doc-title">Acme Supply Contract</p>
            <p className="doc-h">1. Term</p>
            <p className="doc-p">This Agreement shall commence on the Effective Date and shall continue for a term of <span className="bind"><mark className="hl-blue">three (3) years<Cursor name="Dana" tone="blue" className="cursor-doc" /></mark>,<Cursor name="Dana" tone="blue" className="cursor-doc cursor-inline" /></span> unless earlier terminated in accordance with Section 12.</p>
            <p className="doc-h doc-h2">2. Payment</p>
            <p className="doc-p">Customer shall pay all undisputed invoices <mark className="hl-amber">within 30 <b>days</b></mark> of receipt. Late payments may be subject to interest at the rate of <span className="bind">1<span className="caret-at">.<Cursor name="Luis" tone="amber" className="cursor-doc" /></span>5%<Cursor name="Luis" tone="amber" className="cursor-doc cursor-inline" /></span> per month.</p>
          </div>
          <div className="card comment">
            <div className="row comment-head"><Avatar initial="D" tone="violet" /><b className="f14 ink">Dana</b><span className="f12 dim">2m ago</span></div>
            <p className="f14 ink">Can we cap this at 30 days?</p>
          </div>
        </div>
      </Place>
      <Ticks style={{ left: '81.2em', top: '7.8em', width: '3.6em', height: '3.6em' }} turn={-70} />
    </Stage>
  )
}
