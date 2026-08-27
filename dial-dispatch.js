/* Runs on the dispatch site. When a `.init-call` number is clicked, sends it to
   the background relay (which forwards to the Genesys tab) and shows a toast
   with the outcome. No-ops on any page without `.init-call`. */
(() => {
  if (globalThis.__agentDialDispatchLoaded) return;
  globalThis.__agentDialDispatchLoaded = true;

  document.addEventListener('click', (e) => {
    const el = e.target.closest('.init-call');
    if (!el) return;
    const raw = (el.textContent || '').trim();
    if (!raw) return;                                              // skip empty spans
    const number = raw.replace(/[^\d+]/g, '').replace(/^00/, '+'); // 0044… → +44…
    toast(`Dialing ${number}…`, 'pending');
    chrome.runtime.sendMessage({ type: 'DIAL', number });
  }, true);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== 'DIAL_STATUS') return;
    if (msg.ok)                        toast('Call started', 'ok');
    else if (msg.reason === 'no-tab')  toast('Genesys isn’t open in this browser', 'err');
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