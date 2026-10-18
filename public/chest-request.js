(() => {
 const form=document.querySelector('[data-request-upload]');if(!form)return;
 const status=form.querySelector('[data-request-progress]'),meter=form.querySelector('[data-request-meter]'),pause=form.querySelector('[data-request-pause]'),button=form.querySelector('button[type="submit"],button.action');
 let controller=null;
 const endpoint=form.action.replace(/\/$/,'');
 async function call(path,options={}) {
  const response=await fetch(endpoint+path,{credentials:'same-origin',...options,headers:{accept:'application/json',...options.headers},signal:controller.signal});
  const value=await response.json();if(!response.ok)throw new Error(value.message||value.error||'Upload failed.');return value;
 }
 pause.addEventListener('click',()=>controller?.abort());
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(controller)return;
  const selected=Array.from(form.elements.files.files);if(!selected.length)return;
  const data=new FormData(form),replace=String(data.get('replace')||'');
  if(selected.length>10||replace&&selected.length!==1){status.textContent=replace?'Choose one file to replace this submission.':'Choose up to ten files.';return;}
  controller=new AbortController();button.disabled=true;pause.hidden=false;meter.hidden=false;
  const filing=Object.fromEntries([...data].filter(([k,v])=>(k==='schema'||k.startsWith('typed:'))&&typeof v==='string'));
  try {
   const receipts=[];
   for(let index=0;index<selected.length;index++) {
    const file=selected[index];status.textContent=`Starting ${file.name} (${index+1} of ${selected.length})…`;
    let upload=await call('/uploads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:file.name,size:file.size,lastModified:file.lastModified,submitterName:String(data.get('name')||''),email:String(data.get('email')||''),checklist:String(data.get('checklist')||''),replace,filing})});
    const done=new Set(upload.parts);let received=upload.received;
    meter.value=Math.floor(received*100/file.size);status.textContent=`${file.name} · ${meter.value}% received`;
    for(let n=1;n<=Math.ceil(file.size/upload.partSize);n++) {
     if(done.has(n))continue;
     upload=await call(`/uploads/${encodeURIComponent(upload.id)}?part=${n}`,{method:'POST',headers:{'content-type':'application/octet-stream'},body:file.slice((n-1)*upload.partSize,Math.min(n*upload.partSize,file.size))});
     received=upload.received;meter.value=Math.floor(received*100/file.size);status.textContent=`${file.name} · ${meter.value}% received`;
    }
    status.textContent=`Verifying ${file.name}…`;
    receipts.push(await call(`/uploads/${encodeURIComponent(upload.id)}`,{method:'POST'}));
   }
   status.replaceChildren(document.createTextNode('Upload complete. '));
   for(const receipt of receipts){const link=document.createElement('a');link.href=endpoint+'/receipt/'+encodeURIComponent(receipt.id);link.textContent=`${receipt.files.map(f=>f.name).join(', ')} · ${receipt.status}`;status.append(link,document.createElement('br'));}
   if(receipts.length===1)window.location.assign(endpoint+'/receipt/'+encodeURIComponent(receipts[0].id));
  }catch(error){status.textContent=error.name==='AbortError'?'Upload paused. Choose Upload to continue from the parts already received.':`${error.message} Choose Upload to try again from the parts already received.`;}
  finally{controller=null;button.disabled=false;pause.hidden=true;}
 });
})();
