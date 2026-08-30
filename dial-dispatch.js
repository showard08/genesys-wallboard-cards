/* Dispatch-side hook for click-to-dial. Hardened build.
   - Reads the number from a driver `.init-call` click OR the "Connecting to …"
     popup (customer / "y" / CALL CUSTOMER).
   - Validates against an allow-list AND a premium-rate deny-list.
   - Requires a genuine human click (event.isTrusted) both to start the flow
     from a number click and to confirm the dial — page scripts cannot forge
     isTrusted, so injected code cannot click "Call" for the agent.
   - Renders its confirm dialog and toast inside a CLOSED shadow root, so page
     CSS/JS cannot restyle them or alter the number the agent is shown.
   - Dedupes so the same number can't fire twice.
   Residual risk (documented): a compromised dispatch page can still DISPLAY a
   deceptive prompt or fake popup; it cannot complete a call without a real
   human click on this extension's own dialog, cannot change the number that
   dialog dials, and cannot pass a number outside the allow-list — which the
   background worker independently re-checks. */
(() => {
  if (globalThis.__agentDialDispatchLoaded) return;
  globalThis.__agentDialDispatchLoaded = true;

  // The call popup renders in the top frame; ignoring subframes shrinks the
  // attack surface. (If your dispatch app runs inside an iframe, remove this.)
  if (window !== window.top) return;

  // ── Number validation ───────────────────────────────────────────────────
  // Shared rules from security.js (loaded before this file — see CONTENT_JS
  // in sites.js). The service worker independently re-checks with the SAME
  // functions, so this page-side check is UX, not the security boundary.
  const { normaliseNumber, validNumber } = globalThis.AGENT_CARDS_SECURITY;

  // ── Extension-owned UI root (closed shadow DOM) ─────────────────────────
  // Page styles/scripts can't reach inside a closed shadow root, so what the
  // agent sees in our dialog is what actually gets dialled.
  let shadow = null;
  function uiRoot() {
    if (shadow && shadow.host.isConnected) return shadow;
    const host = document.createElement('div');
    host.style.setProperty('display', 'block', 'important');
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('z-index', '2147483647', 'important');
    shadow = host.attachShadow({ mode: 'closed' });
    document.documentElement.appendChild(host);
    return shadow;
  }

  // ── Dedupe + confirm gate ───────────────────────────────────────────────
  let lastDial = { number: null, at: 0 };
  let confirming = false;

  async function offerDial(raw) {
    const number = normaliseNumber(raw);
    if (!validNumber(number)) { toast('Ignored a number not allowed by policy', 'err'); return; }

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
    if (!e.isTrusted) return;                 // synthetic clicks can't start a dial
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

  // ── Confirm dialog (inside the closed shadow root) ──────────────────────
  function confirmCall(number) {
    return new Promise((resolve) => {
      const root = uiRoot();
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)';
      const box = document.createElement('div');
      box.style.cssText = 'background:#fff;color:#111;border-radius:12px;padding:20px 22px;max-width:320px;font:400 14px/1.4 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3);text-align:center';
      const title = document.createElement('div');
      title.style.cssText = 'font-weight:700;margin-bottom:6px';
      title.textContent = 'Place call?';
      const msg = document.createElement('div');
      msg.style.cssText = 'margin-bottom:16px';
      msg.append('Dial ');
      const strong = document.createElement('span');
      strong.style.fontWeight = '700';
      strong.textContent = number;             // textContent — the number can't inject markup
      msg.append(strong, ' on your Genesys phone?');
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:10px;justify-content:center';

      let timer;
      const cleanup = () => { clearTimeout(timer); wrap.remove(); document.removeEventListener('keydown', onKey, true); };
      const onKey = (e) => {
        if (!e.isTrusted) return;              // only real key presses count
        if (e.key === 'Escape') { e.preventDefault(); cleanup(); resolve(false); }
        if (e.key === 'Enter')  { e.preventDefault(); cleanup(); resolve(true); }
      };
      const mkBtn = (label, bg, fg, val) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = `flex:1;padding:9px 12px;border:0;border-radius:8px;font:600 14px system-ui,sans-serif;cursor:pointer;background:${bg};color:${fg}`;
        b.addEventListener('click', (e) => {
          if (!e.isTrusted) return;            // page scripts can't click for the agent
          cleanup(); resolve(val);
        });
        return b;
      };
      row.append(mkBtn('Cancel', '#e5e7eb', '#111', false), mkBtn('Call', '#16a34a', '#fff', true));
      box.append(title, msg, row);
      wrap.append(box);
      wrap.addEventListener('click', (e) => {
        if (!e.isTrusted) return;
        if (e.target === wrap) { cleanup(); resolve(false); }
      });
      document.addEventListener('keydown', onKey, true);
      root.appendChild(wrap);
      timer = setTimeout(() => { cleanup(); resolve(false); }, 15000); // auto-cancel
    });
  }

  // ── Outcome toast (inside the closed shadow root) ───────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== 'DIAL_STATUS') return;
    if (msg.ok)                          toast('Call started', 'ok');
    else if (msg.reason === 'no-tab')    toast('Genesys isn\u2019t open in this browser', 'err');
    else if (msg.reason === 'no-line')   toast('Pick your outbound queue in Genesys, then click again', 'err');
    else if (msg.reason === 'invalid')   toast('Blocked: number not allowed by policy', 'err');
    else                                 toast('Open Genesys Agent Workspace, then click again', 'err');
  });

  let toastEl, toastTimer;
  function toast(text, kind) {
    const root = uiRoot();
    if (!toastEl || !toastEl.isConnected) {
      toastEl = document.createElement('div');
      toastEl.style.cssText =
        'position:fixed;z-index:2147483646;bottom:20px;right:20px;padding:10px 14px;' +
        'border-radius:8px;font:600 13px/1.3 system-ui,sans-serif;color:#fff;' +
        'box-shadow:0 4px 12px rgba(0,0,0,.25);max-width:260px;transition:opacity .2s;pointer-events:none';
      root.appendChild(toastEl);
    }
    toastEl.style.background = { pending: '#2563eb', ok: '#16a34a', err: '#dc2626' }[kind] || '#333';
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (toastEl) toastEl.style.opacity = '0'; }, kind === 'pending' ? 15000 : 4000);
  }
})();
