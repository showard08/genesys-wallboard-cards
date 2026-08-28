/* Dispatch-side hook for click-to-dial.
   - Reads the number from a driver `.init-call` click OR the "Connecting to …"
     popup (customer / "y" / CALL CUSTOMER).
   - Validates it against an allow-list (not "any digits").
   - Asks the agent to confirm before anything is dialled.
   - Dedupes so the same number can't fire twice. */
(() => {
  if (globalThis.__agentDialDispatchLoaded) return;
  globalThis.__agentDialDispatchLoaded = true;

  // ── Number validation ───────────────────────────────────────────────────
  // Adjust for your dialling plan. Rejects anything that doesn't normalise to
  // an allowed number, so a stray/injected string can't become a call.
  const ALLOWED_PREFIXES = ['+44']; // add e.g. '+353' if you dial ROI
  const MIN_DIGITS = 10;            // total digits after the leading +
  const MAX_DIGITS = 15;            // E.164 ceiling

  function normaliseNumber(raw) {
    let n = (raw || '').replace(/[^\d+]/g, '');
    if (n.startsWith('00')) n = '+' + n.slice(2);        // 0044… → +44…
    else if (n.startsWith('0')) n = '+44' + n.slice(1);  // UK national 0… → +44…
    else if (n && !n.startsWith('+')) n = '+' + n;
    return n;
  }

  function validNumber(n) {
    if (!/^\+\d+$/.test(n)) return false;
    const digits = n.replace(/\D/g, '');
    if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return false;
    return ALLOWED_PREFIXES.some((p) => n.startsWith(p));
  }

  // ── Dedupe + confirm gate ───────────────────────────────────────────────
  let lastDial = { number: null, at: 0 };
  let confirming = false;

  async function offerDial(raw) {
    const number = normaliseNumber(raw);
    if (!validNumber(number)) { toast('Ignored an invalid number', 'err'); return; }

    const now = Date.now();
    if (number === lastDial.number && now - lastDial.at < 3000) return; // just dialled this
    if (confirming) return;                                             // a dialog is already open

    confirming = true;
    let ok = false;
    try { ok = await confirmCall(number); } finally { confirming = false; }
    if (!ok) return;

    lastDial = { number, at: Date.now() };
    toast(`Dialing ${number}…`, 'pending');
    chrome.runtime.sendMessage({ type: 'DIAL', number });
  }

  // ── Hook 1: driver number click (no popup) ──────────────────────────────
  document.addEventListener('click', (e) => {
    const el = e.target.closest('.init-call');
    if (!el) return;
    const raw = (el.textContent || '').trim();
    if (raw) offerDial(raw);
  }, true);

  // ── Hook 2: "Connecting to …" popup ─────────────────────────────────────
  const handled = new WeakSet();

  function extractRawNumber(popup) {
    const body = popup.querySelector('.popup_inner_inner');
    if (!body || !/connecting to/i.test(body.textContent)) return null; // ignore driver-info card
    for (const span of body.querySelectorAll('span')) {
      const t = (span.textContent || '').trim();
      if (!t || t.includes('@')) continue;   // skip the extension/email span
      if (/\d/.test(t)) return t;            // the number span
    }
    return null;
  }

  function handlePopup(popup) {
    if (!popup || handled.has(popup)) return;
    const raw = extractRawNumber(popup);
    if (!raw) return;
    handled.add(popup);
    offerDial(raw);
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

  // ── Confirm dialog ──────────────────────────────────────────────────────
  function confirmCall(number) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)';
      const box = document.createElement('div');
      box.style.cssText = 'background:#fff;color:#111;border-radius:12px;padding:20px 22px;max-width:320px;font:400 14px/1.4 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3);text-align:center';
      const msg = document.createElement('div');
      msg.style.cssText = 'margin-bottom:16px';
      msg.append('Dial ');
      const strong = document.createElement('span');
      strong.style.fontWeight = '700';
      strong.textContent = number;                 // textContent, so the number can't inject markup
      msg.append(strong, ' on your Genesys phone?');
      const title = document.createElement('div');
      title.style.cssText = 'font-weight:700;margin-bottom:6px';
      title.textContent = 'Place call?';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:10px;justify-content:center';

      let timer;
      const cleanup = () => { clearTimeout(timer); wrap.remove(); document.removeEventListener('keydown', onKey, true); };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); cleanup(); resolve(false); }
        if (e.key === 'Enter')  { e.preventDefault(); cleanup(); resolve(true); }
      };
      const mkBtn = (label, bg, fg, val) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = `flex:1;padding:9px 12px;border:0;border-radius:8px;font:600 14px system-ui,sans-serif;cursor:pointer;background:${bg};color:${fg}`;
        b.addEventListener('click', () => { cleanup(); resolve(val); });
        return b;
      };
      row.append(mkBtn('Cancel', '#e5e7eb', '#111', false), mkBtn('Call', '#16a34a', '#fff', true));
      box.append(title, msg, row);
      wrap.append(box);
      wrap.addEventListener('click', (e) => { if (e.target === wrap) { cleanup(); resolve(false); } });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(wrap);
      timer = setTimeout(() => { cleanup(); resolve(false); }, 15000); // auto-cancel
    });
  }

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
