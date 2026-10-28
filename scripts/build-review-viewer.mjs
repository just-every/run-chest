import {copyFile,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
// Publish the already pinned PDF renderer with its licence; never fetch a remote viewer.
const modulePath=fileURLToPath(import.meta.resolve('unpdf/pdfjs'));
await copyFile(modulePath,new URL('../public/chest-pdfjs.mjs',import.meta.url));
const licence=await readFile(new URL('../LICENSE',new URL('.',import.meta.resolve('unpdf'))),'utf8');
await writeFile(new URL('../public/chest-pdfjs.LICENSE.txt',import.meta.url),licence+'\n'+await readFile(new URL('../docs/licenses/pdfjs.txt',import.meta.url),'utf8'));
