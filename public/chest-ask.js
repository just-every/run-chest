// Render provider output as text nodes; citations link to current-authority original routes.
for (const panel of document.querySelectorAll('[data-ask]')) {
 const form = panel.querySelector('[data-ask-form]'), output = panel.querySelector('[data-ask-result]'), policyBox = panel.querySelector('[data-ask-policy]');
 let policyAt = null;
 panel.addEventListener('toggle', async () => {
  if (!panel.open) return;
  try { const response = await fetch(`/api/chest/${panel.dataset.askKind}/${encodeURIComponent(panel.dataset.ask)}/ask`), data = await response.json(); policyBox.replaceChildren();
   if (!response.ok || !data.policy?.enabled) { line('p', !response.ok ? 'The original text is unavailable or restricted. Try again after reading completes.' : 'Ask is off. The owner enables it in Settings.', policyBox); policyAt = null; return; }
   policyAt = data.policy.revision; line('p', `Provider terms: ${data.policy.providerRetention}. Residency: ${data.policy.residency}. Maximum estimated USD ${data.policy.maxUsd} per run. Questions and answers are not saved.`, policyBox);
  } catch { policyAt = null; line('p', 'Could not load the current data policy.', policyBox); }
 });
 const line = (tag, value, parent = output) => { const e = document.createElement(tag); e.textContent = value; parent.append(e); return e; };
 form.querySelector('[name=budgetUsd]').step = '0.001';
 form.addEventListener('submit', async event => {
  event.preventDefault(); output.replaceChildren(); const button = form.querySelector('button'); button.disabled = true; line('p', 'Reading approved evidence…');
  try {
   const values = new FormData(form), response = await fetch(`/api/chest/${panel.dataset.askKind}/${encodeURIComponent(panel.dataset.ask)}/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: values.get('question'), policyAt, budgetUsd: Number(values.get('budgetUsd')), fields: String(values.get('fields')).split(',').map(f => f.trim()).filter(Boolean), includeHistory: values.has('includeHistory'), approve: values.has('approve') }) });
   const result = await response.json(); output.replaceChildren();
   if (!response.ok) { const reasons = { ask_disabled_by_owner: 'The owner has not enabled Ask in Settings.', ask_provider_policy_review_required: 'The reader configuration changed. The owner must approve its data policy again in Settings.', matching_provider_quote_required: 'The owner needs to enter matching provider and model rates in Settings.', run_budget_too_small: 'This evidence exceeds the approved estimate. Choose a smaller scope or approve a higher budget.', ask_policy_changed_review_again: 'The data policy changed. Close and reopen Ask to review it again.', file_not_yet_readable: 'This file has no readable text yet.', download_restricted: 'This file’s original text is restricted.', access_required: 'Your access to this evidence changed.', run_budget_exceeds_policy: 'This budget exceeds the owner’s limit.' }; line('p', reasons[result.error] || 'The run was refused. Review access, data policy and budget before trying again.'); return; }
   line('h3', result.state === 'done' ? 'Evidence answer' : 'No answer accepted');
   const cite = (citations, parent) => { for (const c of citations) { const source = result.sources?.find(p => p.id === c.source); if (!source) continue; const p = line('p', '', parent), a = document.createElement('a'); a.className = 'link'; a.href = source.href; a.textContent = `${source.name} · page ${source.page} · version ${source.version}`; p.append(a); line('blockquote', c.quote, parent); line('p', `Read by ${source.method}${source.confidence === null ? '' : ` · ${Math.round(source.confidence * 100)}% confidence`}`, parent); } };
   for (const claim of result.claims || []) { const section = document.createElement('section'); output.append(section); line('p', claim.text, section); cite(claim.citations, section); }
   for (const f of result.fields || []) { const section = document.createElement('section'); output.append(section); line('p', `${f.name}: ${f.value ?? 'No supported value'}`, section); cite(f.citations, section); }
   if (result.uncertainty) line('p', result.uncertainty);
   if (result.skipped?.length) { line('h3', 'Evidence limits'); const list = document.createElement('ul'); output.append(list); for (const s of result.skipped) line('li', `${s.name}: ${s.reason}`, list); }
   const cost = result.cost; if (result.state !== 'done' && cost?.status) line('p', `Provider response: ${cost.status}`); line('p', `Provider cost: ${cost?.usd === null || cost?.usd === undefined ? 'unknown; the provider may bill this attempt' : `estimated USD ${cost.usd.toFixed(6)}`} · ${cost?.input ?? 'unknown'} input tokens · ${cost?.output ?? 'unknown'} output tokens`);
   if (result.policy) line('p', `${result.policy.provider} · ${result.policy.model} · retention: ${result.policy.providerRetention} · residency: ${result.policy.residency}`);
  } catch { output.replaceChildren(); line('p', 'The request did not complete. Its provider cost may be unknown. No answer was accepted.'); }
  finally { button.disabled = false; }
 });
}
