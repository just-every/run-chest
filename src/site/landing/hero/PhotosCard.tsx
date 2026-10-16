import { FileTile } from '../art/icons'

/** The "Product Photos · 8 files" print, two more prints fanned behind it. */
export function PhotosCard() {
  return (
    <div className="photos">
      <span className="card photos-back photos-back-2" aria-hidden="true" />
      <span className="card photos-back" aria-hidden="true"><img className="photo" src="/site/photos.webp" alt="" width="196" height="144" /></span>
      <div className="card photos-front">
        <img className="photo photos-img" src="/site/photos.webp" alt="" width="196" height="144" />
        <div className="row photos-label"><FileTile kind="image" className="tile-sm" /><div className="stack"><b className="f15 ink">Product Photos</b><span className="f13 dim">8 files</span></div></div>
      </div>
    </div>
  )
}
