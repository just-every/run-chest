import { Ticks } from '../art/marks'
import { Place, Stage } from '../art/Place'
import { FileTile } from '../art/icons'
import './interlude.css'

const Envelope = () => (
  <svg viewBox="0 0 96 76" aria-hidden="true"><defs><linearGradient id="env" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2f6ff4" /><stop offset="1" stopColor="#7aa6fb" /></linearGradient></defs>
    <rect x="2" y="10" width="92" height="62" rx="9" fill="url(#env)" /><path d="M4 16 48 46 92 16" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" /><path d="M4 70 36 38M92 70 60 38" stroke="#1f56d8" strokeOpacity=".35" strokeWidth="3" />
  </svg>
)
const Camera = () => (
  <svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="cam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e9ebf0" /><stop offset="1" stopColor="#b9bdc8" /></linearGradient></defs>
    <rect x="4" y="4" width="112" height="112" rx="26" fill="url(#cam)" /><rect x="20" y="36" width="80" height="56" rx="10" fill="#2a2c33" /><path d="M42 36l6-9h24l6 9z" fill="#2a2c33" />
    <circle cx="60" cy="64" r="20" fill="#3b3e48" stroke="#9aa0ad" strokeWidth="4" /><circle cx="60" cy="64" r="11" fill="#14161c" /><circle cx="55" cy="59" r="3.5" fill="#6d7486" /><circle cx="90" cy="20" r="5" fill="#f5c228" />
  </svg>
)
const Laptop = () => (
  <svg viewBox="0 0 180 112" aria-hidden="true"><defs><linearGradient id="lap" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3c32d8" /><stop offset=".55" stopColor="#5a3cf0" /><stop offset="1" stopColor="#3a2bc6" /></linearGradient></defs>
    <rect x="24" y="4" width="132" height="88" rx="6" fill="#16151c" /><rect x="30" y="10" width="120" height="76" rx="2" fill="url(#lap)" /><path d="M110 10 150 52V10z" fill="#fff" fillOpacity=".08" />
    <path d="M6 94h168l-6 12H12z" fill="#9b9faa" /><rect x="6" y="92" width="168" height="5" rx="2.5" fill="#c7cad3" />
  </svg>
)

/** A file flying in: a page with a coloured folded corner, carrying its own content. */
function Flying({ corner, children }: { corner: string; children: React.ReactNode }) {
  return <div className="flying"><span className="flying-corner" style={{ background: corner }} />{children}</div>
}

/** Page 5: the mascot, Chest's own mark, swallowing files from email, a phone and a laptop. */
export function Interlude() {
  return (
    <section id="filed" className="interlude" aria-label="312 files filed this week">
      <div className="interlude-art">
        <Stage w={1536} h={1024} crop={{ x: 330, y: 130, w: 880, h: 700 }} label="Chest's mascot, the open violet chest with a smiling file, swallowing files from billing email, a phone photo IMG_4827.jpg and Q3-budget.xlsx from a laptop: 312 files filed this week.">
          <svg className="flight" viewBox="0 0 1536 1024" aria-hidden="true">
            <path d="M292 258c40-8 76-6 104 12" /><path d="M468 332c40 22 66 54 88 92" />
            <path d="M296 556c22-14 40-24 60-28" /><path d="M472 504c46-2 84 12 112 40" />
            <path d="M1246 296c-44 0-80 12-112 34" /><path d="M1058 386c-26 24-48 48-66 72" />
            <path d="M1046 526c-34-6-66 2-94 20" />
          </svg>
          <svg className="whoosh" viewBox="0 0 1536 1024" aria-hidden="true">
            <path d="M478 362c12 10 20 22 26 36M488 352c14 10 24 24 30 40" /><path d="M322 486c10-8 22-12 34-14M330 498c8-6 18-10 28-10" />
            <path d="M1020 440c10-12 20-20 32-26M1028 456c10-12 22-20 34-26" /><path d="M1144 598c12 10 20 24 22 40M1132 606c10 8 16 20 18 32" />
          </svg>
          <span className="mascot-glow" aria-hidden="true" />
          <Place x={540} y={352} w={456} h={456} z={3}><img className="mascot" src="/brand/mark.svg" alt="" width="456" height="456" /></Place>
          <Place x={568} y={152} w={400} h={112} z={3}>
            <div className="card counter row"><FileTile kind="doc" /><span className="counter-text"><b>312</b> files filed this week</span></div>
          </Place>
          <Place x={52} y={164} w={236} h={222} r={-6} z={2}><div className="card source"><Envelope /><span className="f21 mid">from billing@</span></div></Place>
          <Place x={74} y={538} w={236} h={232} r={-6} z={2}><div className="card source"><Camera /><span className="f21 mid">IMG_4827.jpg</span></div></Place>
          <Place x={1244} y={212} w={254} h={222} r={5} z={2}><div className="card source source-laptop"><Laptop /><span className="f21 mid">Q3-budget.xlsx</span></div></Place>
          <Place x={390} y={258} w={86} h={104} r={-14} z={2}><Flying corner="#4b8df8"><span className="flying-lines" /></Flying></Place>
          <Place x={360} y={474} w={108} h={118} r={-10} z={2}><Flying corner="transparent"><span className="flying-photo" /></Flying></Place>
          <Place x={1046} y={322} w={100} h={108} r={13} z={2}><Flying corner="#2bb36b"><span className="flying-grid" /></Flying></Place>
          <Place x={1036} y={502} w={100} h={124} r={13} z={2}><Flying corner="#ef4b45"><FileTile kind="pdf" className="flying-pdf" /></Flying></Place>
          <Ticks style={{ left: '48.8em', top: '15.6em', width: '4.4em', height: '5.4em' }} turn={-110} />
          <Ticks style={{ left: '100.4em', top: '15.6em', width: '4.4em', height: '5.4em' }} turn={-10} />
          <Ticks style={{ left: '56.2em', top: '31.2em', width: '5em', height: '5.4em' }} turn={-90} />
          <Ticks style={{ left: '91.8em', top: '31.2em', width: '5em', height: '5.4em' }} turn={0} />
          <Ticks style={{ left: '21.6em', top: '18em', width: '3.4em', height: '3.4em' }} turn={-20} />
        </Stage>
      </div>
    </section>
  )
}
