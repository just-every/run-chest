// Selection IDs remain in this tab across folder/search navigation. Every name/action is authorized on the server.
(() => {
 const key='chest-selected-items',forms=[...document.querySelectorAll('.bulk-selection')];let selected;
 try{const raw=JSON.parse(sessionStorage.getItem(key)||'[]');selected=new Set(Array.isArray(raw)?raw.filter(x=>typeof x==='string').slice(0,1000):[])}catch{selected=new Set()}
 const save=()=>{try{sessionStorage.setItem(key,JSON.stringify([...selected]))}catch{};for(const form of forms){form.querySelector('[data-selection-count]').textContent=`${selected.size} selected across folders and search`;for(const input of form.querySelectorAll('input[name=items]'))input.checked=selected.has(input.value)}};
 for(const form of forms){
  for(const input of form.querySelectorAll('input[name=items]')){input.checked=selected.has(input.value);input.addEventListener('change',()=>{if(input.checked)selected.add(input.value);else selected.delete(input.value);save()})}
  form.querySelector('[data-clear-selection]').addEventListener('click',()=>{selected.clear();save()});
  form.addEventListener('submit',event=>{if(!selected.size){event.preventDefault();form.querySelector('[data-selection-count]').textContent='Choose at least one file or folder.';return}event.preventDefault();const url=new URL('/app/bulk',location.origin);for(const id of selected)url.searchParams.append('items',id);location.assign(url.href)});
 }
 document.querySelector('.app-signout')?.addEventListener('submit',()=>{try{sessionStorage.removeItem(key)}catch{}});save();
 const job=document.querySelector('[data-bulk-job][data-bulk-pending=true]');if(!job)return;
 const run=async()=>{let previous=-1;
  while(true){
   const response=await fetch('/api/chest/bulk/'+encodeURIComponent(job.dataset.bulkJob)+'/run',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
   if(!response.ok)throw Error('The job paused. Use Resume remaining items to try with your current access.');
   const result=await response.json();if(result.state!=='pending'){selected.clear();save();location.reload();return}
   if(result.done===previous)throw Error('No further items were recorded. Use Resume remaining items after checking the service.');previous=result.done;
   job.querySelector('[role=status]').textContent=`Working · ${result.done} of ${result.total} checked · ${result.refused} refused`;
  }
 };
 run().catch(error=>{job.querySelector('[role=status]').textContent=error.message||'The connection ended. Resume the stored job to continue.'});
})();
