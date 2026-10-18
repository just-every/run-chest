// Run genuine tagged application source with the currently supported installer runtime.
// The tag's tracked package and application files remain untouched.
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
const require=createRequire(import.meta.url),runtime=dirname(require.resolve('@runeditrun/rer/package.json'));
const installer=new Set(['@runeditrun/rer/operator-installer','@runeditrun/rer/local/state','@runeditrun/rer/adapter','@runeditrun/rer/deploy','@runeditrun/rer/portability']);
export async function resolve(specifier,context,nextResolve) {
 if(installer.has(specifier))return nextResolve(pathToFileURL(require.resolve(specifier)).href,context);
 let path;
 try{path=specifier.startsWith('file:')?fileURLToPath(specifier):specifier}catch{}
 if(path && !path.startsWith(runtime) && /[/\\]@runeditrun[/\\]rer[/\\](global|bin)[/\\]rer\.mjs$/.test(path))return nextResolve(new URL('./upgrade-runtime-entry.mjs',import.meta.url).href,context);
 return nextResolve(specifier,context);
}
