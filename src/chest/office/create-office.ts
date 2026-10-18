import type { BuiltinTemplate, Cell } from './create-gallery'
import type { Extension } from './create-model'
import { ns, pack, rels, types, x, xml } from './create-package'
import { presentation } from './create-presentation'
export function column(index: number) { let result = ''; for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result; return result }
function word(template?: BuiltinTemplate) {
 const paragraphs = template?.paragraphs ?? ['']
 return pack({
  '[Content_Types].xml': types([['word/document.xml', 'wordprocessingml.document.main'], ['word/styles.xml', 'wordprocessingml.styles']]),
  '_rels/.rels': rels([['rId1', 'officeDocument', 'word/document.xml']]),
  'word/_rels/document.xml.rels': rels([['rId1', 'styles', 'styles.xml']]),
  'word/document.xml': xml(`<w:document xmlns:w="${ns}/wordprocessingml/2006/main"><w:body>${paragraphs.map((p, i) => `<w:p>${i === 0 && template ? '<w:pPr><w:pStyle w:val="Title"/></w:pPr>' : ''}<w:r><w:t xml:space="preserve">${x(p)}</w:t></w:r></w:p>`).join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`),
  'word/styles.xml': xml(`<w:styles xmlns:w="${ns}/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="17365D"/></w:rPr></w:style></w:styles>`),
 })
}
function cell(value: Cell, address: string) {
 if (typeof value === 'number') return `<c r="${address}"><v>${value}</v></c>`
 if (typeof value === 'object') return `<c r="${address}"><f>${x(value.formula)}</f><v>${value.value}</v></c>`
 return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${x(value)}</t></is></c>`
}
function spreadsheet(template?: BuiltinTemplate) {
 const rows = template?.rows ?? [['']], lastColumn = column(Math.max(0, ...rows.map(r => r.length - 1))), lastRow = Math.max(1, rows.length)
 return pack({
  '[Content_Types].xml': types([['xl/workbook.xml', 'spreadsheetml.sheet.main'], ['xl/worksheets/sheet1.xml', 'spreadsheetml.worksheet'], ['xl/styles.xml', 'spreadsheetml.styles']]),
  '_rels/.rels': rels([['rId1', 'officeDocument', 'xl/workbook.xml']]),
  'xl/workbook.xml': xml(`<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`),
  'xl/_rels/workbook.xml.rels': rels([['rId1', 'worksheet', 'worksheets/sheet1.xml'], ['rId2', 'styles', 'styles.xml']]),
  'xl/worksheets/sheet1.xml': xml(`<worksheet xmlns="${ns}/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="8" width="20" customWidth="1"/></cols><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((c, j) => cell(c, `${column(j)}${i + 1}`)).join('')}</row>`).join('')}</sheetData></worksheet>`),
  'xl/styles.xml': xml(`<styleSheet xmlns="${ns}/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
 })
}
export function createOffice(extension: Extension, template?: BuiltinTemplate) {
 return extension === 'docx' ? word(template) : extension === 'xlsx' ? spreadsheet(template) : presentation(template)
}
