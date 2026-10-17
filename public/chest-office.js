// Presence is ephemeral and every heartbeat is authorized again on the server. Changes never write on a timer.
for (const panel of document.querySelectorAll('[data-office-item]')) {
 const endpoint = `/api/chest/items/${encodeURIComponent(panel.dataset.officeItem)}`;
 const status = panel.querySelector('.office-presence');
 let stopped = false, previousComments;
 async function refresh() {
  if (stopped || document.visibilityState === 'hidden') return;
  try {
   const response = await fetch(endpoint + '/presence', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({mode: panel.dataset.officeMode})});
   if (!response.ok) { status.textContent = 'Presence is unavailable. Reload to check your access.'; return; }
   const result = await response.json();
   status.textContent = result.people.length ? result.people.map(p => `${p.name} · ${p.mode}`).join(' · ') : 'You are the only person here.';
   const view = await fetch(endpoint);
   if (view.ok) {
    const data = await view.json(), signature = JSON.stringify(data.comments.map(c => c.id));
    if (previousComments !== undefined && signature !== previousComments) {
     const note = panel.querySelector('.office-updates'); note.replaceChildren(document.createTextNode('New comments. '));
     const reload = document.createElement('a'); reload.href = location.pathname; reload.textContent = 'Refresh to read'; note.append(reload);
    }
    previousComments = signature;
   }
  } catch { status.textContent = 'Presence is unavailable while the connection is offline.'; }
 }
 refresh();
 const timer = setInterval(refresh, 12000);
 document.addEventListener('visibilitychange', refresh);
 window.addEventListener('pagehide', () => {
  stopped = true; clearInterval(timer);
  fetch(endpoint + '/presence', {method:'POST', keepalive:true, headers:{'content-type':'application/json'}, body:JSON.stringify({mode:panel.dataset.officeMode, leave:true})}).catch(() => {});
 });
}
