import {zipSync, strToU8} from 'fflate';
const pack = parts => zipSync(Object.fromEntries(Object.entries(parts).map(([k,v]) => [k,strToU8(v)])));
const rel = (type,target,id) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
const rels = body => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
const types = body => `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>${body}</Types>`;
const override = (part,type) => `<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.${type}+xml"/>`;
const p = text => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
export const docx = () => pack({
 '[Content_Types].xml':types(override('word/document.xml','wordprocessingml.document.main')),
 '_rels/.rels':rels(rel('officeDocument','word/document.xml','rId1')),
 'word/document.xml':`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p('Harbor renewal agreement')}${p('Payment within thirty days.')}<w:tbl><w:tr><w:tc>${p('Service')}</w:tc><w:tc>${p('Annual fee')}</w:tc></w:tr><w:tr><w:tc>${p('Warehouse support')}</w:tc><w:tc>${p('$12,500')}</w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>`,
 'customXml/item1.xml':'<custody>keep this unedited part</custody>'
});
export const xlsx = () => pack({
 '[Content_Types].xml':types(override('xl/workbook.xml','spreadsheetml.sheet.main')+override('xl/worksheets/sheet1.xml','spreadsheetml.worksheet')+override('xl/worksheets/sheet2.xml','spreadsheetml.worksheet')),
 '_rels/.rels':rels(rel('officeDocument','xl/workbook.xml','rId1')),
 'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Renewals" sheetId="1" r:id="rId1"/><sheet name="Forecast" sheetId="2" r:id="rId2"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels':rels(rel('worksheet','worksheets/sheet1.xml','rId1')+rel('worksheet','worksheets/sheet2.xml','rId2')+rel('sharedStrings','sharedStrings.xml','rId3')),
 'xl/sharedStrings.xml':'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Harbor logistics</t></si></sst>',
 'xl/worksheets/sheet1.xml':'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>12500</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Renewal total</t></is></c><c r="B2"><f>B1*2</f><v>25000</v></c></row></sheetData></worksheet>',
 'xl/worksheets/sheet2.xml':'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>October forecast</t></is></c><c r="B1"><v>27500</v></c></row></sheetData></worksheet>'
});
const slide = text => `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
export const pptx = () => pack({
 '[Content_Types].xml':types(override('ppt/presentation.xml','presentationml.presentation.main')+override('ppt/slides/slide5.xml','presentationml.slide')+override('ppt/slides/slide2.xml','presentationml.slide')),
 '_rels/.rels':rels(rel('officeDocument','ppt/presentation.xml','rId1')),
 'ppt/presentation.xml':'<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId5"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>',
 'ppt/_rels/presentation.xml.rels':rels(rel('slide','slides/slide5.xml','rId5')+rel('slide','slides/slide2.xml','rId2')),
 'ppt/slides/slide5.xml':slide('Harbor quarterly review'), 'ppt/slides/slide2.xml':slide('Next quarter priorities')
});
