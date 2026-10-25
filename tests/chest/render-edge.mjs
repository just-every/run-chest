import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';

// A configured renderer at its network edge; retain its exact input to prove version choice.
export async function renderEdge(){
 const origin='https://synthetic-chest-render.test',document=await PDFDocument.create();
 document.addPage([400,500]).drawText('synthetic-chest-1',{x:40,y:400});
 const pdf=await document.save(),png=await readFile('tests/chest/scan-nda.png'),inputs=[];
 return {inputs,bindings:{COLLABORA_URL:origin},edge:async request=>{
  if(new URL(request.url).origin!==origin)return;
  assert.equal(request.method,'POST');
  const format=new URL(request.url).pathname;assert.ok(['/cool/convert-to/pdf','/cool/convert-to/png'].includes(format));
  const data=(await request.formData()).get('data'),bytes=Buffer.from(await data.arrayBuffer());
  if(format.endsWith('/pdf'))inputs.push(bytes);
  else assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);
  return new Response(format.endsWith('/pdf')?pdf:png,{headers:{'content-type':format.endsWith('/pdf')?'application/pdf':'image/png'}});
 }};
}
