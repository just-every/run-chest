// Native details keep Enter and Space activation. Escape dismisses the nearest
// open disclosure without clearing its form, and returns to its visible summary.
(() => {
 const summaryOf = details => details.querySelector(':scope > summary');
 const visibleSummary = details => summaryOf(details)?.getClientRects().length > 0;
 document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const details = event.target.closest('details[open]');
  if (!details || !visibleSummary(details)) return;
  details.open = false;
  summaryOf(details).focus();
  event.preventDefault();
 });
 // A phone navigation sheet or popup must not cover the next keyboard control
 // after Tab leaves it. Inline forms stay open until explicitly dismissed.
 document.addEventListener('focusin', event => {
  for (const details of document.querySelectorAll('.app-menu[open], .menu[open], .bar-actions > details[open]')) {
   if (visibleSummary(details) && !details.contains(event.target)) details.open = false;
  }
 });
})();
