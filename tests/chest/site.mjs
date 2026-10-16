// The run site (run-chest.com) as a visitor meets it: built by the real `rer build --site`, then walked from `/`.
// From the homepage a visitor reaches /run and /docs, every docs page is reachable from /docs, every same-origin
// link and asset resolves to a built file, and no page or stylesheet asks a third party for anything.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {join,dirname,posix} from 'node:path';

const root=process.cwd(),site=join(root,'dist/site');
execFileSync('pnpm',['exec','rer','build','--site'],{cwd:root,stdio:'inherit'});
const files=dir=>readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?files(path):[path]});
const built=files(site);
// Pretty URLs as the static host serves them: /run -> run.html, /docs/x -> docs/x.html, /fonts/a.woff2 as is.
const resolve=url=>{const path=decodeURIComponent(url.split('#')[0].split('?')[0]);if(path==='/')return join(site,'index.html');for(const candidate of [path,`${path}.html`,`${path}/index.html`]){const file=join(site,candidate);if(existsSync(file)&&statSync(file).isFile())return file}return null};
const pageFor=path=>{const file=resolve(path);assert.ok(file&&file.endsWith('.html'),`${path} is a built page`);return readFileSync(file,'utf8')};
const attrs=(html,name)=>[...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`,'g'))].map(m=>m[1].replace(/&amp;/g,'&'));
const anchors=html=>[...html.matchAll(/<a\s[^>]*href="([^"]*)"/g)].map(m=>m[1].replace(/&amp;/g,'&'));
const external=url=>/^(https?:)?\/\//.test(url);

const home=pageFor('/');
for(const target of ['/run','/docs'])assert.ok(anchors(home).includes(target),`the homepage links ${target}`);
const docsHome=pageFor('/docs');
const docsPages=built.filter(file=>file.startsWith(join(site,'docs')+'/')&&file.endsWith('.html')).map(file=>'/docs/'+posix.basename(file,'.html'));
assert.ok(docsPages.length>0,'the docs have pages');
for(const page of docsPages)assert.ok(anchors(docsHome).includes(page),`/docs links ${page}`);

const pages=built.filter(file=>file.endsWith('.html'));
for(const file of pages){
  const html=readFileSync(file,'utf8'),name=file.slice(site.length);
  for(const url of [...anchors(html),...attrs(html,'src'),...[...html.matchAll(/<link\s[^>]*href="([^"]*)"/g)].map(m=>m[1])]){
    if(url.startsWith('#')||url.startsWith('mailto:'))continue;
    if(external(url))continue; // outbound links (source, demo) are fine; fetched resources are checked below
    assert.ok(url.startsWith('/'),`${name} uses a root-relative URL: ${url}`);
    assert.ok(resolve(url),`${name} links ${url}, which the site does not have`);
  }
  for(const tag of html.matchAll(/<(script|img|link|source)\s[^>]*>/g))for(const url of [...attrs(tag[0],'src'),...attrs(tag[0],'href')])if(!/rel="(canonical|alternate)"/.test(tag[0]))assert.ok(!external(url),`${name} fetches ${url} from a third party`);
}
for(const file of built.filter(file=>file.endsWith('.css'))){
  const css=readFileSync(file,'utf8');
  for(const [,raw] of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)){
    if(raw.startsWith('data:'))continue;
    assert.ok(!external(raw),`${file.slice(site.length)} fetches ${raw} from a third party`);
    const url=raw.startsWith('/')?raw:posix.join(posix.dirname(file.slice(site.length)),raw);
    assert.ok(resolve(url),`${file.slice(site.length)} uses ${raw}, which the site does not have`);
  }
  for(const [,href] of css.matchAll(/@import\s+url\(\s*['"]?([^'")]+)/g))assert.ok(!external(href),`${file.slice(site.length)} imports ${href} from a third party`);
}
console.log(`Run site passed: ${pages.length} pages from /, /run and /docs; every same-origin link and asset resolves; nothing loads from a third party.`);
