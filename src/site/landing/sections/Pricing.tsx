import { sectionCopy } from '../copy'
import { AppFile, Icon, type IconName } from '../art/icons'
import { Avatar, Cursor, Ticks } from '../art/marks'
import { Section } from '../Section'
import './pricing.css'

const tools: (IconName | '|')[] = ['bold', 'italic', 'underline', '|', 'alignLeft', 'bullets', 'download', '|', 'table', 'dots']

/** page-06: Pricing.xlsx open in the browser, Luis fixing the wrap price Dana flagged, and the three file kinds. */
export function Pricing() {
  return (
    <Section id="pricing" copy={sectionCopy.pricing} layout="right" className="pricing">
      <figure className="pricing-art" aria-label="Pricing.xlsx open in the browser with Dana and Luis editing: pallet wrap corrected from $18.00 to $12.00 a unit, 120 for $1,440.00; corner boards 400 at $0.85, $340.00; freight $180.00; total $1,960.00. Dana's comment, wrap is $12 per the Oct 2 quote, is resolved after Luis's fix. Saved, 2 people editing. Below, Acme MSA.docx, Pricing.xlsx and Q4 supplier review.pptx.">
        <div className="card sheet-window">
          <p className="term-dots" aria-hidden="true"><i /><i /><i /></p>
          <div className="sheet-top">
            <div className="sheet-name"><AppFile kind="sheet" className="sheet-badge" /><b className="f26 ink">Pricing.xlsx</b></div>
            <span className="sheet-tools" aria-hidden="true">{tools.map((tool, index) => tool === '|' ? <i key={index} /> : <Icon key={tool} name={tool} />)}</span>
          </div>
          <div className="sheet-body">
            <div className="sheet-grid" role="table" aria-label="Pricing">
              <div className="sheet-row sheet-cols" role="row"><span /><span>A</span><span>B</span><span>C</span><span>D</span></div>
              <div className="sheet-row sheet-heads" role="row"><span>1</span><b>Item</b><b>Qty</b><b>Unit</b><b>Total</b></div>
              <div className="sheet-row" role="row"><span>2</span><span>Pallet wrap</span><span>120</span><span className="cell-edit">$12.00 <s>$18.00</s></span><span>$1,440.00</span></div>
              <div className="sheet-row" role="row"><span>3</span><span>Corner boards</span><span>400</span><span>$0.85</span><span>$340.00</span></div>
              <div className="sheet-row" role="row"><span>4</span><span>Freight</span><span>1</span><span>$180.00</span><span>$180.00</span></div>
              <div className="sheet-row sheet-total" role="row"><span>5</span><b>Total</b><span /><span /><b className="cell-sum">$1,960.00</b></div>
              <div className="sheet-row sheet-empty" role="row"><span>6</span><span /><span /><span /><span /></div>
              <Cursor name="Luis" tone="green" className="cursor-on-unit" />
              <Cursor name="Dana" tone="violet" className="cursor-on-total" />
            </div>
            <aside className="sheet-thread">
              <p className="thread-note"><Avatar initial="D" tone="violet" /><span className="f15"><b>Dana</b> · Wrap is $12 per the Oct 2 quote. <span className="mention">@Luis</span></span></p>
              <p className="thread-note"><Avatar initial="L" tone="green" /><span className="f15"><b>Luis</b> · Fixed.</span></p>
              <span className="chip chip-ok f15 resolved"><Icon name="check" className="ico" />Resolved</span>
            </aside>
          </div>
          <p className="sheet-foot f15 mid"><span className="dot-live" aria-hidden="true" />Saved · 2 people editing</p>
        </div>
        <ul className="kinds">
          <li className="card"><AppFile kind="word" /><span className="f15 ink">Acme MSA.docx</span></li>
          <li className="card"><AppFile kind="sheet" /><span className="f15 ink">Pricing.xlsx</span></li>
          <li className="card"><AppFile kind="slides" /><span className="f15 ink">Q4 supplier review.pptx</span></li>
        </ul>
        <svg className="kinds-arrow" viewBox="0 0 70 80" aria-hidden="true"><path d="M64 76C48 66 30 40 22 6" /><path d="M10 18 21 4l12 12" /></svg>
        <Ticks className="kinds-ticks-l" turn={-100} />
        <Ticks className="kinds-ticks-r" turn={10} />
      </figure>
    </Section>
  )
}
