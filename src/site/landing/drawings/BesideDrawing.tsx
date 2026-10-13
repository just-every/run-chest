// The open folder's front panel: low on the left, raised on the right under a 45° shoulder.
const front = '<svg viewBox="0 0 380 260" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M8 46h206c5 0 8-2 10-6l14-30c2-5 6-8 12-8h122c5 0 8 3 8 8v244c0 5-3 6-8 6H8c-5 0-8-1-8-6V54c0-5 3-8 8-8z"/></svg>'

/** Section 6: a loose draft sheet, a cobalt arrow, and a manila folder tabbed Approved. */
export function BesideDrawing() {
  return (
    <div className="beside">
      <span className="beside-draft" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      <span className="beside-folder">
        <span className="beside-back" aria-hidden="true" />
        <span className="beside-sheet" aria-hidden="true" />
        <span className="tab tab-cobalt beside-tab">Approved</span>
        {/* Drawn in the folder's own coordinates: from above the draft's corner into the folder's mouth, under the front flap's edge. */}
        <svg className="beside-arrow" viewBox="-40 -240 380 360" aria-hidden="true" focusable="false"><path d="M64 -76C96 -158 196 -150 166 84M184 62L166 84L154 59" /></svg>
        <span className="beside-front" aria-hidden="true" dangerouslySetInnerHTML={{ __html: front }} />
      </span>
    </div>
  )
}
