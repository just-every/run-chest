import { details } from '../copy'
import { Icon } from '../art/icons'
import './details.css'

const mark = (kind: string) => kind === 'curl' ? <svg className="detail-mark" viewBox="0 0 50 40" aria-hidden="true"><path d="M44 6c0 14-12 26-30 26" /><path d="M20 24l-7 8 9 5" /></svg>
  : kind === 'undo' ? <svg className="detail-mark" viewBox="0 0 50 40" aria-hidden="true"><path d="M8 14c10-8 26-6 28 6 1 8-4 14-10 16" /><path d="M6 6l2 9 9-2" /></svg>
  : <svg className="detail-mark" viewBox="0 0 50 40" aria-hidden="true"><path d="M10 12l9-8M12 21h14M10 30l9 7" /></svg>

/** Page 8: "Also included", six quiet details as cards with tinted icons. */
export function Details() {
  return (
    <section id="details" className="details" aria-labelledby="details-title">
      <p className="eyebrow details-eyebrow">Also included</p>
      <h2 id="details-title">The quiet details<span className="dot">.</span></h2>
      <ul className="detail-grid">
        {details.map(item => (
          <li className="detail" key={item.title}>
            <span className={`detail-ico tone-${item.tone}`}><Icon name={item.icon} /></span>
            {mark(item.mark)}
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
