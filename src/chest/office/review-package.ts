import { unzipSync, zipSync, strToU8 } from 'fflate/browser'
import { OfficeArchive } from './archive'
import { attr, elements, parseXml, serializeXml, type Element, type Node } from './xml'
import { insist } from '../model'

export type ReviewRecord = { key:string; author:string; value:string; kind:'comment'|'ins'|'del'; part:string; id:string }
const mainNs = /(?:wordprocessingml|spreadsheetml|presentationml)/
const tracked = new Set(['ins','del','moveFrom','moveTo','rPrChange','pPrChange','tblPrChange','trPrChange','tcPrChange','sectPrChange','numberingChange'])
export function packageParts(bytes:Uint8Array) {
 new OfficeArchive(bytes)
 return unzipSync(bytes)
}
const isXml=(path:string)=>/\.(xml|rels)$/i.test(path)
const nodeName=(node:Element)=>`{${node.namespaceURI??''}}${node.localName}`
export function canonical(node:Node):string {
 if(node.nodeType===3||node.nodeType===4)return node.nodeValue??''
 if(node.nodeType!==1)return Array.from(node.childNodes).map(canonical).join('')
 const e=node as Element,attributes=Array.from(e.attributes).filter(a=>a.namespaceURI!=='http://www.w3.org/2000/xmlns/').map(a=>[`{${a.namespaceURI??''}}${a.localName}`,a.value]).sort(([a],[b])=>a.localeCompare(b))
 return JSON.stringify([nodeName(e),attributes,Array.from(e.childNodes).filter(n=>n.nodeType===1||n.nodeType===3&&!!n.nodeValue?.trim()||n.nodeType===4).map(canonical)])
}
function visit(node:Node,fn:(e:Element)=>void){for(const e of elements(node)){fn(e);visit(e,fn)}}
export function reviewRecords(bytes:Uint8Array):ReviewRecord[]{
 const parts=packageParts(bytes),records:ReviewRecord[]=[],keys=new Set<string>()
 for(const [part,bytes]of Object.entries(parts))if(isXml(part)){
  const doc=parseXml(bytes)
  visit(doc,e=>{
   const name=e.localName??'',ns=e.namespaceURI??''
   insist(!['threadedComment','threadedComments'].includes(name),'review_change_unsupported',409)
   if(mainNs.test(ns)&&tracked.has(name)){
    insist(['ins','del'].includes(name),'review_change_unsupported',409)
    const id=attr(e,'id'),author=attr(e,'author');insist(id&&author,'invalid_review_author',403)
    records.push({key:`${part}#${name}:${id}`,id,part,kind:name as 'ins'|'del',author,value:canonical(e)})
   }
   if((name==='comment'&&/wordprocessingml/.test(ns))||(name==='cm'&&/presentationml/.test(ns))||(name==='comment'&&/spreadsheetml/.test(ns))){
    const id=attr(e,'id')||attr(e,'idx')||attr(e,'ref'),author=/wordprocessingml/.test(ns)?attr(e,'author'):/spreadsheetml/.test(ns)?Array.from(doc.getElementsByTagName('*')).filter(x=>x.localName==='author')[Number(attr(e,'authorId'))]?.textContent??'':Array.from(parseXml(parts['ppt/commentAuthors.xml']??strToU8('<authors/>')).getElementsByTagName('*')).find(x=>x.localName==='cmAuthor'&&attr(x,'id')===attr(e,'authorId'))?.getAttribute('name')??''
    insist(id&&author,'invalid_review_author',403);records.push({key:`${part}#comment:${id}`,id,part,kind:'comment',author,value:canonical(e)})
   }
  })
 }
 for(const record of records){insist(!keys.has(record.key),'duplicate_review_identifier',409);keys.add(record.key)}
 return records
}
export function projectReview(bytes:Uint8Array,decisions:Map<string,'accept'|'reject'>=new Map(),stripAll=false):Uint8Array{
 const parts=packageParts(bytes),removed=new Set<string>()
 for(const path of Object.keys(parts))if(/(?:^|\/)(?:comments?\d*|commentAuthors|commentsExtended|commentsIds|people)\.xml$/i.test(path))removed.add(path)
 for(const [path,bytes]of Object.entries(parts))if(isXml(path)&&!removed.has(path)){
  const doc=parseXml(bytes)
  const walk=(parent:Node,restoring=false)=>{for(const e of elements(parent)){
   const name=e.localName??'',ns=e.namespaceURI??''
   if(/wordprocessingml/.test(ns)&&['trackRevisions','revisionView','proofState','rsids'].includes(name)){parent.removeChild(e);continue}
   for(const a of Array.from(e.attributes))if(/wordprocessingml/.test(a.namespaceURI??'')&&a.localName.startsWith('rsid'))e.removeAttributeNode(a)
   if(mainNs.test(ns)&&['commentRangeStart','commentRangeEnd','commentReference','annotationRef'].includes(name)){parent.removeChild(e);continue}
   if(e.localName==='Relationship'&&/comments|commentAuthors|people/.test(attr(e,'Type'))||e.localName==='Override'&&removed.has(attr(e,'PartName').replace(/^\//,''))){parent.removeChild(e);continue}
   if(mainNs.test(ns)&&['ins','del'].includes(name)){
    const decision=stripAll?'reject':decisions.get(`${path}#${name}:${attr(e,'id')}`)
    if(decision){
     if((name==='ins')===(decision==='accept')){walk(e,name==='del');while(e.firstChild)parent.insertBefore(e.firstChild,e)}
     parent.removeChild(e);continue
    }
   }
   if(mainNs.test(ns)&&name==='delText'&&restoring){
    const t=doc.createElementNS(ns,`${e.prefix??'w'}:t`);for(const a of Array.from(e.attributes))t.setAttributeNS(a.namespaceURI,a.name,a.value);t.textContent=e.textContent;parent.replaceChild(t,e);continue
   }
   walk(e,restoring)
  }}
  walk(doc)
  visit(doc,e=>{if(mainNs.test(e.namespaceURI??'')&&e.localName==='r'&&elements(e).every(c=>c.localName==='rPr'))e.parentNode?.removeChild(e)})
  if(path.endsWith('.rels')&&!elements(doc.documentElement).length)removed.add(path)
  else parts[path]=serializeXml(doc)
 }
 for(const path of removed)delete parts[path]
 return zipSync(parts)
}
const protectedPart=(path:string)=>path.startsWith('customXml/')||/\.(?:bin|vba|png|jpe?g|gif|svg|emf|wmf|mp3|mp4|wav|ttf|woff2?)$/i.test(path)&&!path.startsWith('docProps/')
export function protectedPartsEqual(a:Uint8Array,b:Uint8Array){
 const left=packageParts(a),right=packageParts(b)
 for(const path of new Set([...Object.keys(left),...Object.keys(right)]))if(protectedPart(path)){
  const x=left[path],y=right[path];if(!x||!y)return false
  if(isXml(path)){if(canonical(parseXml(x))!==canonical(parseXml(y)))return false}
  else if(x.length!==y.length||!x.every((v,i)=>v===y[i]))return false
 }
 return true
}
// Compare engine-normalized packages without exporter clocks, ZIP metadata or namespace prefixes.
export function packageSignature(bytes:Uint8Array):string{
 const parts=packageParts(bytes),values:unknown[]=[]
 for(const path of Object.keys(parts).filter(p=>!p.endsWith('/')).sort()){
  if(isXml(path)){
   const doc=parseXml(parts[path]);visit(doc,e=>{
    if(path==='docProps/core.xml'&&['created','modified','lastModifiedBy','revision','lastPrinted'].includes(e.localName??'')||path==='docProps/app.xml'&&['TotalTime','Pages','Words','Characters','CharactersWithSpaces','AppVersion'].includes(e.localName??''))e.parentNode?.removeChild(e)
   });values.push([path,canonical(doc)])
  }else {let binary='';for(let offset=0;offset<parts[path].length;offset+=8192)binary+=String.fromCharCode(...parts[path].subarray(offset,offset+8192));values.push([path,btoa(binary)])}
 }
 return JSON.stringify(values)
}

// Preserve source parts that this engine demonstrably omits during its ordinary export.
// A changed or newly added protected part still fails the role validation below.
export function retainOmittedParts(source:Uint8Array,content:Uint8Array,engineSource:Uint8Array){
 const before=packageParts(source),after=packageParts(content),normalized=packageParts(engineSource);let restored=false
 for(const [path,value]of Object.entries(before))if(protectedPart(path)&&!after[path]&&!normalized[path]){after[path]=value;restored=true}
 return restored?zipSync(after):content
}
