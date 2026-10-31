import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Harmless industry-standard scanner specimen, submitted as bytes and never executed.
export const specimen=Buffer.from('WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=','base64');
export const scannerBindings={CONTENT_SCANNER_URL:'https://synthetic-chest-scanner.test/scan',CONTENT_SCANNER_TOKEN:'synthetic-chest-1'};
export function scannerReceipt(bytes){
 return {checksum:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,state:bytes.includes(specimen)?'infected':'clean',sensitive:/\bclassification\s*:\s*(?:sensitive|confidential|restricted)\b/i.test(bytes.toString()),reason:'Synthetic scanner-edge receipt',engine:'synthetic-chest-1'};
}
export async function scannerEdge(request){
 if(request.url!==scannerBindings.CONTENT_SCANNER_URL)return;
 assert.equal(request.headers.get('authorization'),'Bearer '+scannerBindings.CONTENT_SCANNER_TOKEN);
 const bytes=Buffer.from(await request.arrayBuffer()),receipt=scannerReceipt(bytes);
 assert.equal(request.headers.get('x-content-sha256'),receipt.checksum);
 return Response.json(receipt);
}
