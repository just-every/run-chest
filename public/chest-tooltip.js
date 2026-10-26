// Icon controls expose the same short label after 300 ms hover and immediately on keyboard focus.
(() => {
 const tip = document.createElement('div'); tip.id = 'chest-tooltip'; tip.className = 'chest-tooltip'; tip.role = 'tooltip'; tip.hidden = true; document.body.append(tip);
 let timer, active, focused, hovered;
 const hide = () => { clearTimeout(timer); if (active) { const ids = (active.getAttribute('aria-describedby') || '').split(/\s+/).filter(x => x && x !== tip.id); if (ids.length) active.setAttribute('aria-describedby', ids.join(' ')); else active.removeAttribute('aria-describedby'); } active = null; tip.hidden = true; };
 const show = control => {
  hide(); if (!control.isConnected) return; active = control; tip.textContent = control.dataset.tooltip; tip.hidden = false;
  const ids = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean); control.setAttribute('aria-describedby', [...ids, tip.id].join(' '));
  const box = control.getBoundingClientRect(), bounds = tip.getBoundingClientRect();
  tip.style.left = Math.max(8, Math.min(innerWidth - bounds.width - 8, box.left + (box.width - bounds.width) / 2)) + 'px';
  tip.style.top = Math.max(8, box.bottom + bounds.height + 12 > innerHeight ? box.top - bounds.height - 6 : box.bottom + 6) + 'px';
 };
 for (const control of document.querySelectorAll('[data-tooltip]')) {
  control.addEventListener('pointerenter', () => { hovered = control; clearTimeout(timer); timer = setTimeout(() => show(control), 300); });
  control.addEventListener('pointerleave', () => { if (hovered === control) hovered = null; clearTimeout(timer); if (focused !== control) hide(); });
  control.addEventListener('focus', () => { focused = control; show(control); });
  control.addEventListener('blur', () => { focused = null; hide(); });
 }
 document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
 // Keyboard focus can scroll the page after the focus event. Keep its label positioned and visible.
 const reposition = () => {
  if (focused && document.activeElement === focused) show(focused);
  else if (hovered?.isConnected && hovered.matches(':hover')) {
   const control = hovered; if (active === control) show(control);
   else { clearTimeout(timer); timer = setTimeout(() => { if (hovered === control) show(control); }, 300); }
  } else hide();
 };
 document.addEventListener('scroll', reposition, true); window.addEventListener('resize', reposition);
})();
