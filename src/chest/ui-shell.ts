import { fontHead } from '../base/font-head'
import { iconHead } from '../brand-icons'
import { headers } from './api'
import { esc } from './ui-shared'
import { problemWords } from './ui-problems'
import { rail, type Rail } from './ui-rail'
import { icons } from '../ui/icons'
// The app's own documents: its scripts (/chest-upload.js, uploads with progress and resume; /chest-read.js, reading
// progress; chest-bulk.js, the selection; chest-time.js, local times; chest-office.js), styles only from this origin
// (fonts/fonts.css and rer-theme.css tokens, chest.css components, chest-app.css shell and pages, chest-files.css the folder browser, chest-tools.css page-specific tools).
// The picked app look: a 240 px left rail (the lockup, the files nav, the team spaces, the workspace pages, sync,
// storage and who is signed in) and a top bar (breadcrumb, search, New, Upload and Share). At phone width the rail
// sits behind one "Menu".
export const policy="default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; script-src 'self'; connect-src 'self'; frame-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:"
export const head=(title:string)=>`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${iconHead}${fontHead}<link rel="stylesheet" href="/rer-theme.css"><link rel="stylesheet" href="/chest.css"><link rel="stylesheet" href="/chest-app.css"><link rel="stylesheet" href="/chest-files.css"><link rel="stylesheet" href="/chest-tools.css"><link rel="stylesheet" href="/chest-organisation.css"><script src="/chest-upload.js" defer></script><script src="/chest-read.js" defer></script><script src="/chest-ask.js" defer></script><script src="/chest-office.js" defer></script><link rel="stylesheet" href="/chest-bulk.css"><script src="/chest-bulk.js" defer></script><script src="/chest-time.js" defer></script><script src="/chest-tooltip.js" defer></script><script src="/chest-keyboard.js" defer></script><link rel="stylesheet" href="/chest-office.css">`
const titles={apps:'Connected apps',files:'Files',library:'Library',admin:'People & settings',archive:'Move in',audit:'Audit',notices:'Notices',shared:'Shared with me',requests:'Requests',links:'Links',trash:'Trash',mine:'My files',administration:'Administration'}
const section=(path:string):keyof typeof titles=>path.startsWith('/app/integrations')?'apps':path.startsWith('/app/administration')?'administration':path.startsWith('/app/admin')||path.startsWith('/app/erasure')?'admin':path.startsWith('/app/archive')||path.startsWith('/app/move-in')?'archive':path.startsWith('/app/audit')?'audit':path==='/app/notices'?'notices':path==='/app/shared'?'shared':path.startsWith('/app/requests')?'requests':path==='/app/links'?'links':path==='/app/files/trash'?'trash':path.startsWith('/app/spaces/personal')?'mine':/^\/app\/(bulk|upload-protection|collection|transfers|templates|files|spaces|items|ownership|devices|filing|storage)(\/|$)/.test(path)?'files':'library'
export type Crumb={label:string,href?:string}
export type Bar={crumbs?:Crumb[],new?:string,upload?:string,share?:string}
export type Me={name:string,email:string,role:string,rail?:Rail}
const crumbs=(list:Crumb[])=>`<nav class="crumbs" aria-label="Breadcrumb"><ol>${list.map((c,i)=>`<li>${i?`<span class="crumb-sep" aria-hidden="true">${icons.chevron}</span>`:''}${c.href&&i<list.length-1?`<a href="${esc(c.href)}">${esc(c.label)}</a>`:`<span aria-current="page">${esc(c.label)}</span>`}</li>`).join('')}</ol></nav>`
// New, Upload and Share act on the open folder or file; elsewhere New and Upload go to My files.
function actions(bar:Bar,me:Me){
 const mine=me.rail?`/app/spaces/${me.rail.personal}`:'/app/files'
 const create=bar.new??`<a class="btn btn-sm" href="${mine}#new">${icons.plus}<span>New</span></a>`
 return `<div class="bar-actions">${create.replace('<summary class="btn">','<summary class="btn btn-sm">'+icons.plus)}<a class="btn btn-outline btn-sm" href="${esc(bar.upload??`${mine}#upload`)}">${icons.upload}<span>Upload</span></a>${bar.share?`<a class="btn btn-outline btn-sm" href="${esc(bar.share)}">${icons.share}<span>Share</span></a>`:''}</div>`
}
export function page(body:string,me:Me,path='/app',bar:Bar={}){
 const current=section(path)
 // Without a breadcrumb from the page, the top bar names the page by its own heading.
 const heading=/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(body)?.[1].replace(/<[^>]+>/g,'').replace(/&(amp|lt|gt|quot|#39);/g,(_,e)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"} as Record<string,string>)[e]).trim()
 const top=`<div class="topbar">${crumbs(bar.crumbs??[{label:heading||titles[current]}])}<form class="bar-search" method="get" action="/app/files/search" role="search"><label><span class="bar-search-icon" aria-hidden="true">${icons.search}</span><span class="sr-only">Search file names and the words inside files</span><input name="q" type="search" placeholder="Search names and text inside files"></label></form>${actions(bar,me)}</div>`
 return new Response(`<!doctype html><html lang="en"><head>${head(`${titles[current]} · Chest`)}</head><body class="app"><div class="shell"><header class="rail"><a class="wordmark" href="/app/files"><img class="wordmark-mark" src="/brand/mark.svg" alt="" width="30" height="30"><span data-rer-name>Chest</span></a><details class="app-menu"><summary>${icons.menu}<span>Menu</span></summary><div class="app-menu-panel">${me.rail?rail(me.rail,me,current,path):''}</div></details></header><div class="work">${top}<main class="app-main">${body}</main></div></div></body></html>`,{headers:{...headers,'content-type':'text/html; charset=utf-8','content-security-policy':policy}})
}
// A refused action reads like sign-in: the wordmark above one card (styled by fonts/fonts.css's html.rer-themed rules), and the way back.
export function refusedPage(data:{error?:string,message?:string},status:number,back='/app/files'){
 return new Response(`<!doctype html><html lang="en" class="rer-themed"><head>${head('Not done · Chest')}</head><body><main><p class="brand"><span data-rer-name>Chest</span></p><h1>That was not done</h1><p>${esc(data.message??problemWords(data.error))}</p><a class="action" href="${esc(back.startsWith('/app')?back:'/app/files')}">Go back</a><p class="quiet mono">Code: ${esc(data.error)}</p></main></body></html>`,{status,headers:{...headers,'content-type':'text/html; charset=utf-8'}})
}
