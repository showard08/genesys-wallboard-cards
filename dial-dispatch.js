/* Runs on the dispatch site. Two hooks feed the dialer:
     1. Click on a `.init-call` number (driver Device/Mobile) — no popup appears.
     2. The "Connecting to …" popup (customer call via number, "y" shortcut, or
        the CALL CUSTOMER menu item) — where the number is already resolved.
   A short dedupe means the same number can't dial twice if both ever fire.
   No-ops on any page without those elements. */
(() => {
  if (globalThis.__agentDialDispatchLoaded) return;
  globalThis.__agentDialDispatchLoaded = true;

  // ── Dedupe: ignore a repeat of the same number within 3s ────────────────
  let lastDial = { number: null, at: 0 };
  function sendDial(number) {
    const now = Date.now();
    if (number === lastDial.number && now - lastDial.at < 3000) return;
    lastDial = { number, at: now };
    toast(`Dialing ${number}…`, 'pending');
    chrome.runtime.sendMessage({ type: 'DIAL', number });
  }

  // ── Hook 1: driver number click (no popup) ──────────────────────────────
  document.addEventListener('click', (e) => {
    const el = e.target.closest('.init-call');
    if (!el) return;
    const raw = (el.textContent || '').trim();
    if (!raw) return;                                              // skip empty spans
    const number = raw.replace(/[^\d+]/g, '').replace(/^00/, '+'); // 0044… → +44…
    if (number.replace(/\D/g, '').length >= 6) sendDial(number);
  }, true);

  // ── Hook 2: "Connecting to …" popup (customer / "y" / CALL CUSTOMER) ─────
  const handled = new WeakSet();

  function extractNumber(popup) {
    const body = popup.querySelector('.popup_inner_inner');
    if (!body || !/connecting to/i.test(body.textContent)) return null; // ignore driver-info card etc.
    for (const span of body.querySelectorAll('span')) {
      const t = (span.textContent || '').trim();
      if (t.includes('@')) continue;                 // skip the extension/email span
      const cleaned = t.replace(/[^\d+]/g, '');
      if (cleaned.replace(/\D/g, '').length >= 6) return cleaned.replace(/^00/, '+');
    }
    return null;
  }

  function handlePopup(popup) {
    if (!popup || handled.has(popup)) return;
    const number = extractNumber(popup);
    if (!number) return;
    handled.add(popup);
    sendDial(number);
  }

  for (const p of document.querySelectorAll('.info_popup')) handlePopup(p);

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.('.info_popup')) handlePopup(node);
        node.querySelectorAll?.('.info_popup').forEach(handlePopup);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // ── Outcome toast ───────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== 'DIAL_STATUS') return;
    if (msg.ok)                        toast('Call started', 'ok');
    else if (msg.reason === 'no-tab')  toast('Genesys isn’t open in this browser', 'err');
    else if (msg.reason === 'no-line') toast('Pick your outbound queue in Genesys, then click again', 'err');
    else                               toast('Open Genesys Agent Workspace, then click again', 'err');
  });

  let toastEl, toastTimer;
  function toast(text, kind) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText =
        'position:fixed;z-index:2147483647;bottom:20px;right:20px;padding:10px 14px;' +
        'border-radius:8px;font:600 13px/1.3 system-ui,sans-serif;color:#fff;' +
        'box-shadow:0 4px 12px rgba(0,0,0,.25);max-width:260px;transition:opacity .2s;pointer-events:none';
      document.body.appendChild(toastEl);
    }
    toastEl.style.background = { pending: '#2563eb', ok: '#16a34a', err: '#dc2626' }[kind] || '#333';
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (toastEl) toastEl.style.opacity = '0'; }, kind === 'pending' ? 15000 : 4000);
  }
})();