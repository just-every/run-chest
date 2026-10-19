import { sectionCopy } from '../copy'
import { Icon } from '../art/icons'
import { keep } from '../Prose'
import { Section } from '../Section'
import './share-out.css'

const pack: [string, string][] = [['Password', 'on'], ['Expires', 'Oct 31'], ['Downloads', '3 of 10'], ['Opened by priya@acme.example', '2 times']]
const received = ['Delivery_schedule_Q4.pdf', 'Bank_details_form.pdf']

const Next = () => <svg className="share-next" viewBox="0 0 48 24" aria-hidden="true"><path d="M3 15c12-4 26-5 40-3" /><path d="M35 5l9 7-9 7" /></svg>

/** page-07: the contract pack out by link, the onboarding papers in by file request, and a big upload that resumed. */
export function ShareOut() {
  return (
    <Section id="share-out" copy={sectionCopy.shareOut} layout="center" className="share-out">
      <figure className="share-cards" aria-label="Contract pack, 4 files: password on, expires Oct 31, 3 of 10 downloads, opened twice by priya@acme.example, with Revoke. A file request for the delivery schedule and bank details form saves to Vendors / Acme Supply / Onboarding: 2 of 2 received. Site survey.mp4, 4.2 GB: the connection dropped at 61% and the upload resumed where it stopped, saved to Ops / Site surveys.">
        <div className="card share-card">
          <b className="f22 ink">Contract pack · 4 files</b>
          <dl className="pack-rows">
            {pack.map(([label, value]) => <div key={label}><dt className="f15 dim">{label}</dt><dd className="f15 ink">{value}</dd></div>)}
          </dl>
          <span className="revoke f15">Revoke</span>
        </div>
        <Next />
        <div className="card share-card">
          <b className="f22 ink">File request</b>
          <p className="f15 ink request-ask">Upload your delivery schedule and bank details form</p>
          <p className="f15 dim">Saves to {keep('Vendors / Acme Supply / Onboarding')}</p>
          <ul className="request-files">{received.map(name => <li key={name}><Icon name="checkCircle" className="ico" /><span className="f15 ink">{name}</span></li>)}</ul>
          <b className="f16 received">2 of 2 received</b>
        </div>
        <Next />
        <div className="card share-card">
          <b className="f22 ink">Site survey.mp4 · 4.2 GB</b>
          <span className="upload-bar" aria-hidden="true"><i /><em /></span>
          <p className="f15 upload-drop">Connection dropped at 61%</p>
          <p className="f15 upload-resumed">{keep('Resumed where it stopped · 4.2 GB uploaded')}</p>
          <p className="f15 dim upload-dest">Saved to Ops / Site surveys</p>
        </div>
      </figure>
    </Section>
  )
}
