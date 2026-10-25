import { zipSync, strToU8 } from 'fflate/browser'
import { packageParts } from './review-package'
import { attr, elements, parseXml, serializeXml } from './xml'

// Recording is enabled in the document before the editor accepts the first keystroke.
// CheckFileInfo also forces recording on and hides its toggle for this role.
export function trackedSource(bytes:Uint8Array):Uint8Array {
 const parts=packageParts(bytes),ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
 const settings=parseXml(parts['word/settings.xml']??strToU8(`<w:settings xmlns:w="${ns}"/>`))
 for(const node of Array.from(settings.getElementsByTagNameNS(ns,'trackRevisions')))node.parentNode?.removeChild(node)
 settings.documentElement.appendChild(settings.createElementNS(ns,'w:trackRevisions'))
 parts['word/settings.xml']=serializeXml(settings)
 const types=parseXml(parts['[Content_Types].xml'])
 if(!elements(types.documentElement).some(e=>attr(e,'PartName')==='/word/settings.xml')){
  const node=types.createElementNS(types.documentElement.namespaceURI,'Override');node.setAttribute('PartName','/word/settings.xml');node.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml');types.documentElement.appendChild(node)
 }
 parts['[Content_Types].xml']=serializeXml(types)
 const rels=parseXml(parts['word/_rels/document.xml.rels']??strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'))
 if(!elements(rels.documentElement).some(e=>attr(e,'Type').endsWith('/settings'))){
  const ids=new Set(elements(rels.documentElement).map(e=>attr(e,'Id')));let id='chestReviewSettings';while(ids.has(id))id+='1'
  const node=rels.createElementNS(rels.documentElement.namespaceURI,'Relationship');node.setAttribute('Id',id);node.setAttribute('Type','http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings');node.setAttribute('Target','settings.xml');rels.documentElement.appendChild(node)
 }
 parts['word/_rels/document.xml.rels']=serializeXml(rels)
 return zipSync(parts)
}
