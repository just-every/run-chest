import type { Field,Schema } from './model'
import { esc } from './ui-shared'
// Typed fields as real inputs: each document type is a radio choice that opens its own fields (text, date, number,
// and a Yes/No select for boolean). The pages carry no script, so every type's inputs are in the form, named
// `typed:<type id>:<field name>`, and CSS shows only the chosen type's. The server keeps only the chosen type's values
// and validates them exactly as before (fields.ts); nothing here admits or rejects a value.
const prefix=(schema:string)=>`typed:${schema}:`
function input(schema:string,f:Field,value:unknown){
 const name=esc(prefix(schema)+f.name),label=`<span class="field-label">${esc(f.name)} <span class="field-hint">· ${f.required?'required':'optional'}</span></span>`,current=value===undefined||value===null?'':String(value)
 if(f.type==='boolean')return `<label class="field">${label}<select name="${name}"><option value="">${f.required?'Choose':'Not set'}</option><option value="true"${value===true?' selected':''}>Yes</option><option value="false"${value===false?' selected':''}>No</option></select></label>`
 const type=f.type==='date'?'date':f.type==='number'?'number':'text'
 return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(current)}"${type==='number'?' step="any"':type==='text'?' maxlength="4000"':' class="mono"'}></label>`
}
export function typedFields(schemas:{id:string,payload:Schema}[],doc:{schema?:string,fields?:Record<string,unknown>}){
 const chosen=doc.schema||schemas[0]?.id
 return `<fieldset class="types"><legend class="field-label">Document type</legend>${schemas.map(r=>{const on=r.id===chosen
  return `<div class="type-choice"><label class="check"><input type="radio" name="schema" value="${esc(r.id)}"${on?' checked':''} required> ${esc(r.payload.name)}</label>${r.payload.fields.length?`<div class="form-grid type-fields">${r.payload.fields.map(f=>input(r.id,f,on?doc.fields?.[f.name]:undefined)).join('')}</div>`:''}</div>`}).join('')}</fieldset>`
}
// The chosen type's submitted inputs as a fields object. Empty inputs are left out; a number that does not parse
// stays text so validation reports it.
export function typedValues(schema:{id:string,payload:Schema},input:Record<string,string>){
 const fields:Record<string,unknown>={}
 for(const f of schema.payload.fields){const raw=input[prefix(schema.id)+f.name];if(raw===undefined||raw.trim()==='')continue
  fields[f.name]=f.type==='number'&&Number.isFinite(Number(raw))?Number(raw):f.type==='boolean'?raw==='true'?true:raw==='false'?false:raw:raw}
 return fields
}

// An upload-request recipient supplies values for the destination's fixed type, without choosing another type.
export function fixedTypeFields(schema:{id:string,payload:Schema},fields:Record<string,unknown>={}) {
 return `<fieldset class="types"><legend class="field-label">${esc(schema.payload.name)}</legend><input type="hidden" name="schema" value="${esc(schema.id)}"><div class="form-grid">${schema.payload.fields.map(f=>input(schema.id,f,fields[f.name])).join('')}</div></fieldset>`
}
