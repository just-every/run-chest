import { fontHead } from '../base/font-head'
import { iconHead } from '../brand-icons'
import { headers } from './api'
import { esc } from './ui-shared'

// The app's own documents: two scripts (/chest-upload.js, uploads with progress and resume; /chest-read.js, reading progress), styles only from this origin (rer-theme.css tokens, chest.css components,
// chest-app.css layout). The top bar is the lockup (the violet chest mark and the wordmark), the nav (current item
// on a manila pill), who is signed in and "Sign out" (a form: signing out revokes the session server-side); at phone
// width all of it sits behind one "Menu".
export const policy="default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; script-src 'self'; connect-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'"
export const head=(title:string)=>`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${iconHead}${fontHead}<link rel="stylesheet" href="/rer-theme.css"><link rel="stylesheet" href="/chest.css"><link rel="stylesheet" href="/chest-app.css"><script src="/chest-upload.js" defer></script><script src="/chest-read.js" defer></script>`
const section=(path:string)=>path.startsWith('/app/admin')?'admin':path.startsWith('/app/archive')?'archive':path.startsWith('/app/audit')?'audit':/^\/app\/(files|spaces|items|shared|requests|notices|devices|links)(\/|$)/.test(path)?'files':'library'
export function page(body:string,me:{name:string,email:string,role:string},path='/app'){
 const current=section(path),link=(key:string,href:string,label:string)=>`<a href="${href}"${key===current?' aria-current="page"':''}>${label}</a>`
 const nav=link('files','/app/files','Files')+link('library','/app','Library')+(me.role==='owner'?link('admin','/app/admin','People &amp; settings')+link('archive','/app/archive','Move-in'):'')+link('audit','/app/audit','Audit')
 return new Response(`<!doctype html><html lang="en"><head>${head('Chest · Document library')}</head><body class="app"><header class="app-bar"><a class="wordmark" href="/app"><img class="wordmark-mark" src="/brand/mark.svg" alt="" width="34" height="34"><span data-rer-name>Chest</span></a><details class="app-menu"><summary>Menu</summary><div class="app-menu-panel"><nav class="app-nav" aria-label="Chest">${nav}</nav><p class="app-who">${esc(me.name)} · <span class="mono">${esc(me.email)}</span></p><form class="app-signout" method="post" action="/app/signout"><button>Sign out</button></form></div></details></header><main class="app-main">${body}</main></body></html>`,{headers:{...headers,'content-type':'text/html; charset=utf-8','content-security-policy':policy}})
}
// A refused action reads like sign-in: the wordmark above one card (styled by rer-theme.css), and the way back.
export function refusedPage(data:{error?:string,message?:string},status:number){
 return new Response(`<!doctype html><html lang="en" class="rer-themed"><head>${head('Chest action refused')}</head><body><main><p class="brand"><span data-rer-name>Chest</span></p><h1>Action refused</h1><p class="mono">${esc(data.error)}</p>${data.message?`<p>${esc(data.message)}</p>`:''}<p>The operation was not accepted. Return to the library to review the current record.</p><a class="action" href="/app">Library</a></main></body></html>`,{status,headers:{...headers,'content-type':'text/html; charset=utf-8'}})
}
