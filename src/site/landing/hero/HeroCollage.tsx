import { Arrow, Sticky, Ticks } from '../art/marks'
import { Place, Stage } from '../art/Place'
import { ContractCard, ShareLinkCard, VersionStack } from './cards'
import { PhotosCard } from './PhotosCard'
import { FiledToast, NdaCard, ReceiptCard, UploadCard } from './ScanCards'

/**
 * Option F: the live folder collage, every card a real piece of a business's files. Stage origin: desk (280, 84).
 * Pieces sit where the desk drew them, nudged only so none covers another's words: the share link starts below the
 * contract (Luis's tag stays visible) and the approved pill has its own room beside the date. On a phone the
 * contract, share link, versions, upload and filing stack as whole cards.
 */
export function HeroCollage() {
  return (
    <Stage w={1256} h={900} flow className="hero-collage" label="A team's files in Chest: a contract two people are editing, a receipt uploading, a share link, a version history, a scanned NDA read into fields, and a W-9 filed on its own.">
      <Place x={424} y={28} w={424} h={452} r={-4} z={3} phone={1}><ContractCard /></Place>
      <Place x={896} y={40} w={256} h={296} r={6} z={2} phone={false}><ReceiptCard /></Place>
      <Place x={872} y={311} w={276} h={94} r={4} z={4} phone={4}><UploadCard /></Place>
      <Place x={812} y={438} w={380} h={366} r={4} z={2} phone={false}><NdaCard /></Place>
      <Place x={452} y={498} w={352} h={86} r={-2.5} z={4} phone={2}><ShareLinkCard /></Place>
      <Place x={452} y={600} w={352} h={192} r={-1} z={3} phone={3}><VersionStack /></Place>
      <Place x={618} y={810} w={350} h={74} z={5} phone={5}><FiledToast /></Place>
      <Place x={150} y={604} w={240} h={254} r={-7.5} z={3} phone={false}><PhotosCard /></Place>
      <Place x={20} y={674} w={122} h={134} r={-11} z={4} phone={false}><Sticky className="hero-sticky">Q4<br />launch<br />assets</Sticky></Place>
      <Arrow kind="short" style={{ left: '12.4em', top: '72.6em', width: '4.6em', height: '2.6em', zIndex: 5 }} />
      <Arrow kind="hook" style={{ left: '40.2em', top: '47.4em', width: '4.6em', height: '9em', zIndex: 5 }} />
      <Arrow kind="both" style={{ left: '97.6em', top: '80.4em', width: '10.6em', height: '5.8em', zIndex: 5 }} />
      <Ticks style={{ left: '117.4em', top: '8.4em' }} turn={20} />
      <Ticks style={{ left: '114.6em', top: '50.2em' }} turn={10} />
      <Ticks style={{ left: '57.6em', top: '80.6em', width: '3.4em', height: '5em' }} turn={-100} />
    </Stage>
  )
}
