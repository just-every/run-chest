(() => {
 const form = document.querySelector('[data-sign-compose]'); if (!form) return;
 const json = form.querySelector('[data-fields-json]'), list = form.querySelector('[data-field-list]'), pick = form.querySelector('[data-field-signer]'), type = form.querySelector('[data-field-type]'), page = form.querySelector('[data-field-page]');
 const size = { signature: [180, 40], initials: [60, 30], date: [100, 22], text: [160, 22], checkbox: [16, 16] };
 const labels = { signature: 'Signature', initials: 'Initials', date: 'Date signed', text: 'Text', checkbox: 'Check' };
 let fields = [], next = 3;
 const emails = () => [...form.querySelectorAll('[name^="signerEmail:"]')].map(i => i.value.trim().toLowerCase()).filter(Boolean);
 function refreshSigners() { const have = emails(), keep = pick.value; pick.innerHTML = have.map(e => `<option>${e.replace(/[<&"]/g, '')}</option>`).join(''); if (have.includes(keep)) pick.value = keep; }
 const sheet = n => form.querySelector(`.sheet[data-sheet="${n}"]`);
 const NS = 'http://www.w3.org/2000/svg';
 function draw() {
  form.querySelectorAll('.sfield').forEach(b => b.remove());
  fields.forEach(f => { const s = sheet(f.page); if (!s) return; const W = Number(s.dataset.width), H = Number(s.dataset.height), g = document.createElementNS(NS, 'g'), r = document.createElementNS(NS, 'rect'), t = document.createElementNS(NS, 'text'); g.setAttribute('class', 'sfield'); r.setAttribute('x', f.x * W); r.setAttribute('y', f.y * H); r.setAttribute('width', f.w * W); r.setAttribute('height', f.h * H); t.setAttribute('x', (f.x + f.w / 2) * W); t.setAttribute('y', (f.y + f.h / 2) * H); t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'central'); t.setAttribute('font-size', '9'); t.textContent = `${labels[f.type]} · ${f.signer}`; g.append(r, t); s.appendChild(g); });
  list.innerHTML = ''; fields.forEach((f, i) => { const li = document.createElement('li'); const t = document.createElement('span'); t.className = 'mono'; t.textContent = `${labels[f.type]} · ${f.signer}`; li.appendChild(t);
   for (const [k, label] of [['page', 'Page'], ['x', 'Left %'], ['y', 'Top %']]) { const l = document.createElement('label'); l.textContent = label + ' '; const input = document.createElement('input'); input.type = 'number'; input.step = k === 'page' ? '1' : 'any'; input.min = k === 'page' ? '1' : '0'; input.value = k === 'page' ? f.page : Math.round(f[k] * 100 * 10) / 10; input.addEventListener('change', () => { f[k] = k === 'page' ? Math.max(1, Math.round(Number(input.value))) : Math.min(1 - (k === 'x' ? f.w : f.h), Math.max(0, Number(input.value) / 100)); sync(); }); l.appendChild(input); li.appendChild(l); }
   const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'btn btn-outline'; rm.textContent = 'Remove'; rm.addEventListener('click', () => { fields.splice(i, 1); sync(); }); li.appendChild(rm); list.appendChild(li); });
  json.value = JSON.stringify(fields);
 }
 const sync = () => draw();
 function place(n, x, y) { const signer = pick.value; if (!signer) return; const s = sheet(n); const [w, h] = size[type.value]; const fw = w / Number(s.dataset.width), fh = h / Number(s.dataset.height); fields.push({ signer, type: type.value, page: n, x: Math.min(Math.max(0, x - fw / 2), 1 - fw), y: Math.min(Math.max(0, y - fh / 2), 1 - fh), w: fw, h: fh, required: true }); sync(); }
 form.addEventListener('click', e => { const s = e.target.closest('.sheet'); if (!s || e.target.closest('.sfield')) return; const r = s.getBoundingClientRect(); place(Number(s.dataset.sheet), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); });
 form.querySelector('[data-add-field]').addEventListener('click', () => place(Math.max(1, Number(page.value) || 1), .3, .85));
 form.querySelector('[data-add-signer]').addEventListener('click', () => { const ol = form.querySelector('[data-signers]'), n = next++, li = document.createElement('li'); li.className = 'signer-row'; li.innerHTML = `<label>Email<input name="signerEmail:${n}" type="email" autocomplete="off"></label><label>Name<input name="signerName:${n}" autocomplete="off"></label>`; ol.appendChild(li); });
 form.addEventListener('input', e => { if (e.target.name && e.target.name.startsWith('signerEmail:')) refreshSigners(); });
 form.addEventListener('submit', () => { json.value = JSON.stringify(fields); });
 refreshSigners(); draw();
})();
