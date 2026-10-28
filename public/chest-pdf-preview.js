const root=document.querySelector('[data-pdf-comparison]');
if(root){
 const status=root.querySelector('[role="status"]'),canvas=root.querySelector('canvas'),text=root.querySelector('[data-page-text]'),previous=root.querySelector('[data-previous]'),next=root.querySelector('[data-next]');
 let page=1,total=0,busy=false,pdf;
 async function show(target){
  if(busy)return;busy=true;previous.disabled=next.disabled=true;canvas.hidden=true;text.textContent='';status.textContent='Loading PDF page…';
  try{
   // A fresh original request rechecks current access before every newly selected page.
   const response=await fetch(root.dataset.source,{cache:'no-store',credentials:'same-origin'});
   if(!response.ok)throw Error(`Preview unavailable (${response.status}). Reopen the file to check access.`);
   if(Number(response.headers.get('content-length'))>32*1024*1024)throw Error('This original exceeds the browser preview limit. Download it to compare locally.');
   const data=new Uint8Array(await response.arrayBuffer());
   if(data.length>32*1024*1024)throw Error('This original exceeds the browser preview limit. Download it to compare locally.');
   const {getDocument}=await import('/chest-pdfjs.mjs');
   pdf??=await getDocument({data,isEvalSupported:false,useSystemFonts:true}).promise;total=pdf.numPages;
   if(!Number.isSafeInteger(target)||target<1||target>total)throw Error('Page not found.');
   const original=await pdf.getPage(target),base=original.getViewport({scale:1}),scale=Math.min(2,Math.max(.1,(root.clientWidth-16)/base.width)),viewport=original.getViewport({scale}),ratio=Math.min(devicePixelRatio||1,2);
   canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
   await original.render({canvasContext:canvas.getContext('2d'),viewport,transform:[ratio,0,0,ratio,0,0],annotationMode:0}).promise;
   text.textContent=(await original.getTextContent()).items.map(item=>item.str??'').join(' ');
   page=target;canvas.hidden=false;canvas.dataset.rendered='true';canvas.setAttribute('aria-label',`PDF page ${page}`);status.textContent=`Page ${page} of ${total}`;
  }catch(error){canvas.hidden=true;status.textContent=error.message||'PDF preview failed.';total=0}
  finally{busy=false;previous.disabled=!total||page===1;next.disabled=!total||page===total}
 }
 window.addEventListener('pagehide',()=>{void pdf?.destroy()});
 previous.addEventListener('click',()=>show(page-1));next.addEventListener('click',()=>show(page+1));show(1);
}
