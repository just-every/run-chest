// Presence is ephemeral and every heartbeat is authorized again on the server. Changes never write on a timer.
for (const panel of document.querySelectorAll('[data-office-item]')) {
 const endpoint = `/api/chest/items/${encodeURIComponent(panel.dataset.officeItem)}`;
 const status = panel.querySelector('.office-presence');
 let stopped = false, refreshing = false, submitting = false, previousComments;
 // A remote version must not discard work in this editor or any other form on the file page.
 const controls = [...document.querySelectorAll('input, textarea, select')];
 const initial = new Map(controls.map(input => [input, {value: input.value, checked: input.checked}]));
 const hasUnsavedInput = () => controls.some(input => {
  const before = initial.get(input);
  return input.isConnected && (input.value !== before.value || input.checked !== before.checked || input.files?.length);
 });
 document.addEventListener('submit', () => { submitting = true; }, {capture: true});
 async function refresh() {
  if (stopped || refreshing || submitting || document.visibilityState === 'hidden') return;
  refreshing = true;
  try {
   const response = await fetch(endpoint + '/presence', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({mode: panel.dataset.officeMode})});
   if (!response.ok) { status.textContent = 'Presence is unavailable. Reload to check your access.'; return; }
   const result = await response.json();
   status.textContent = result.people.length ? result.people.map(p => `${p.name} · ${p.mode}`).join(' · ') : 'You are the only person here.';
   const view = await fetch(endpoint);
   if (view.ok) {
    const data = await view.json();
    if (stopped || submitting) return;
    if (data.item.current !== panel.dataset.officeVersion) {
     if (!hasUnsavedInput()) { location.reload(); return; }
     // Keep the editing form's original base version so the server still merges or refuses stale edits.
     const frame = panel.querySelector('.office-frame');
     const source = endpoint + '/office-preview/' + encodeURIComponent(data.item.current);
     if (frame.getAttribute('src') !== source) frame.setAttribute('src', source);
     const note = panel.querySelector('.office-updates');
     note.replaceChildren(document.createTextNode('The current version changed. The preview shows the new version; your unsaved input is kept. Saving reconciles your edits with the current version and refuses conflicts. '));
     const reload = document.createElement('a'); reload.href = location.href; reload.textContent = 'Discard unsaved input and load current version'; note.append(reload);
     return;
    }
    const signature = JSON.stringify(data.comments.map(c => c.id));
    if (previousComments !== undefined && signature !== previousComments) {
     const note = panel.querySelector('.office-updates'); note.replaceChildren(document.createTextNode('New comments. '));
     const reload = document.createElement('a'); reload.href = location.pathname; reload.textContent = 'Refresh to read'; note.append(reload);
    }
    previousComments = signature;
   }
  } catch { status.textContent = 'Presence is unavailable while the connection is offline.'; }
  finally { refreshing = false; }
 }
 refresh();
 const timer = setInterval(refresh, 12000);
 document.addEventListener('visibilitychange', refresh);
 window.addEventListener('pagehide', () => {
  stopped = true; clearInterval(timer);
  fetch(endpoint + '/presence', {method:'POST', keepalive:true, headers:{'content-type':'application/json'}, body:JSON.stringify({mode:panel.dataset.officeMode, leave:true})}).catch(() => {});
 });
}
