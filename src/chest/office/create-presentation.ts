import type { BuiltinTemplate } from './create-gallery'
import { ns, pack, rels, types, x, xml } from './create-package'
const drawing = `${ns}/drawingml/2006/main`, presenting = `${ns}/presentationml/2006/main`
const namespaces = `xmlns:p="${presenting}" xmlns:a="${drawing}" xmlns:r="${ns}/officeDocument/2006/relationships"`
const group = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
const colorMap = 'accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"'
function textBox(id: number, title: boolean, lines: string[], color: string) {
 return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${title ? 'Title' : 'Content'}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="${title ? 685800 : 2057400}"/><a:ext cx="10820400" cy="${title ? 1066800 : 3810000}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${lines.map(line => `<a:p><a:r><a:rPr lang="en-US" sz="${title ? 3600 : 2200}"${title ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${title ? color : '333333'}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${x(line)}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`).join('')}</p:txBody></p:sp>`
}
function theme(color: string) {
 const colors = { dk1: '000000', lt1: 'FFFFFF', dk2: '333333', lt2: 'F2F4F7', accent1: color, accent2: 'ED7D31', accent3: 'A5A5A5', accent4: 'FFC000', accent5: '4472C4', accent6: '70AD47', hlink: '0563C1', folHlink: '954F72' }
 const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>', line = `<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr">${fill}<a:prstDash val="solid"/><a:miter lim="800000"/><a:headEnd type="none" w="med" len="med"/><a:tailEnd type="none" w="med" len="med"/></a:ln>`
 return xml(`<a:theme xmlns:a="${drawing}" name="Chest"><a:themeElements><a:clrScheme name="Chest">${Object.entries(colors).map(([name, value]) => `<a:${name}><a:srgbClr val="${value}"/></a:${name}>`).join('')}</a:clrScheme><a:fontScheme name="Calibri"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Chest"><a:fillStyleLst>${fill.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${line.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${fill.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`)
}
export function presentation(template?: BuiltinTemplate) {
 const slides = template?.slides ?? [[]], color = template?.color ?? '17365D'
 const overrides: [string, string][] = [['ppt/presentation.xml', 'presentationml.presentation.main'], ['ppt/slideMasters/slideMaster1.xml', 'presentationml.slideMaster'], ['ppt/slideLayouts/slideLayout1.xml', 'presentationml.slideLayout'], ['ppt/theme/theme1.xml', 'theme'], ...slides.map((_, i): [string, string] => [`ppt/slides/slide${i + 1}.xml`, 'presentationml.slide'])]
 const parts: Record<string, string> = {
  '[Content_Types].xml': types(overrides),
  '_rels/.rels': rels([['rId1', 'officeDocument', 'ppt/presentation.xml']]),
  'ppt/presentation.xml': xml(`<p:presentation ${namespaces}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle></p:presentation>`),
  'ppt/_rels/presentation.xml.rels': rels([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ...slides.map((_, i): [string, string, string] => [`rId${i + 2}`, 'slide', `slides/slide${i + 1}.xml`])]),
  'ppt/slideMasters/slideMaster1.xml': xml(`<p:sldMaster ${namespaces}><p:cSld name="Chest"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${group}</p:spTree></p:cSld><p:clrMap ${colorMap}/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`),
  'ppt/slideMasters/_rels/slideMaster1.xml.rels': rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']]),
  'ppt/slideLayouts/slideLayout1.xml': xml(`<p:sldLayout ${namespaces} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${group}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`),
  'ppt/slideLayouts/_rels/slideLayout1.xml.rels': rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]),
  'ppt/theme/theme1.xml': theme(color),
 }
 slides.forEach((lines, i) => {
  parts[`ppt/slides/slide${i + 1}.xml`] = xml(`<p:sld ${namespaces}><p:cSld><p:spTree>${group}${lines.length ? textBox(2, true, lines.slice(0, 1), color) + textBox(3, false, lines.slice(1), color) : ''}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`)
  parts[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']])
 })
 return pack(parts)
}
