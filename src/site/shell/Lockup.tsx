/** The brand lockup: the violet chest mark and "Chest" in the heading face. */
export function Lockup({ href = '/#top' }: { href?: string }) {
  return <a className="lockup" href={href}><img className="lockup-mark" src="/brand/mark.svg" alt="" width="40" height="40" />Chest</a>
}
