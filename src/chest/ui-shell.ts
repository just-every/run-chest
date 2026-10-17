import { fontHead } from '../base/font-head'
import { iconHead } from '../brand-icons'
import { headers } from './api'
import { avatar, esc, icon } from './ui-shared'
import type { LineName } from '../ui/icons'

// The app's own documents: two scripts (/chest-upload.js, uploads with progress and resume; /chest-read.js, reading progress), styles only from this origin (rer-theme.css tokens, chest.css components,
// chest-app.css shell and page layout, then one sheet per area). The shell is a sidebar: the lockup (the violet chest
// mark and the wordmark), the nav in two groups (files, then the library and its administration) with the current
// place on a pale violet pill, then who is signed in and "Sign out" (a form: signing out revokes the session
// server-side). At phone width the sidebar becomes a top bar and all of it sits behind one "Menu".
export const policy="default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; script-src 'self'; connect-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'"
export const head=(title:string)=>`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${iconHead}${fontHead}<link rel="stylesheet" href="/rer-theme.css"><link rel="stylesheet" href="/chest.css"><link rel="stylesheet" href="/chest-app.css"><link rel="stylesheet" href="/chest-files.css"><link rel="stylesheet" href="/chest-library.css"><link rel="stylesheet" href="/chest-read.css"><script src="/chest-upload.js" defer></script><script src="/chest-read.js" defer></script>`
const sections:[RegExp,string][]=[[/^\/app\/files\/trash$/,'trash'],[/^\/app\/shared$/,'shared'],[/^\/app\/links$/,'links'],[/^\/app\/requests(\/|$)/,'requests'],[/^\/app\/notices$/,'notices'],[/^\/app\/devices$/,'devices'],[/^\/app\/(files|spaces|items)(\/|$)/,'files'],[/^\/app\/admin/,'admin'],[/^\/app\/archive/,'archive'],[/^\/app\/audit/,'audit']]
const section=(path:string)=>sections.find(([test])=>test.test(path))?.[1]??'library'
export function page(body:string,me:{name:string,email:string,role:string},path='/app',waiting=0){
 const current=section(path),link=(key:string,href:string,label:string,name:LineName,badge='')=>`<a href="${href}"${key===current?' aria-current="page"':''}>${icon(name)}<span>${label}</span>${badge}</a>`
 const files=link('files','/app/files','Files','folder')+link('shared','/app/shared','Shared with me','users')+link('links','/app/links','Links','link')+link('requests','/app/requests','Access requests','shield',waiting?` <span class="nav-count">${waiting}</span>`:'')+link('notices','/app/notices','Notices','bell')+link('devices','/app/devices','Sync devices','sync')+link('trash','/app/files/trash','Trash','trash')
 const library=link('library','/app','Library','book')+(me.role==='owner'?link('admin','/app/admin','People &amp; settings','gear')+link('archive','/app/archive','Move-in','inbox'):'')+link('audit','/app/audit','Audit','list')
 return new Response(`<!doctype html><html lang="en"><head>${head('Chest · Document library')}</head><body class="app"><header class="app-bar"><a class="wordmark" href="/app/files"><img class="wordmark-mark" src="/brand/mark.svg" alt="" width="36" height="36"><span data-rer-name>Chest</span></a><details class="app-menu"><summary>${icon('menu')}<span>Menu</span></summary><div class="app-menu-panel"><nav class="app-nav" aria-label="Chest"><div class="nav-group">${files}</div><div class="nav-group">${library}</div></nav><div class="app-foot"><p class="app-who">${avatar(me.name)}<span><strong>${esc(me.name)}</strong><span class="app-email">${esc(me.email)}</span></span></p><form class="app-signout" method="post" action="/app/signout"><button>${icon('logout')}<span>Sign out</span></button></form></div></div></details></header><main class="app-main">${body}</main></body></html>`,{headers:{...headers,'content-type':'text/html; charset=utf-8','content-security-policy':policy}})
}
// A refused action reads like sign-in: the wordmark above one card (styled by rer-theme.css), and the way back.
export function refusedPage(data:{error?:string,message?:string},status:number){
 return new Response(`<!doctype html><html lang="en" class="rer-themed"><head>${head('Chest action refused')}</head><body><main><p class="brand"><span data-rer-name>Chest</span></p><h1>Action refused</h1><p class="mono">${esc(data.error)}</p>${data.message?`<p>${esc(data.message)}</p>`:''}<p>The operation was not accepted. Return to the library to review the current record.</p><a class="action" href="/app">Library</a></main></body></html>`,{status,headers:{...headers,'content-type':'text/html; charset=utf-8'}})
}
