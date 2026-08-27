/* Drives the Agent Workspace dialer on request. Injected everywhere but only
   acts where the dialer exists; stays silent otherwise, so background.js's
   timeout can tell the dispatch page that Workspace isn't open. */
(() => {
  if (globalThis.__agentDialGenesysLoaded) return;
  globalThis.__agentDialGenesysLoaded = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(sel, ms) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const el = document.querySelector(sel); if (el) return el; await sleep(100); }
    return null;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'DIAL' && msg.number) dial(msg.number, msg.reqId);
  });

  async function dial(number, reqId) {
    const opener = await waitFor('#interaction-new-call-outbound-target', 6000);
    if (!opener) return;                    // wrong frame / Workspace not open — stay silent

    let input = null;
    for (let i = 0; i < 2 && !input; i++) {
      opener.click();
      input = await waitFor('input.phone-number-input', 2500);
    }
    if (!input) return report(reqId, { ok: false, reason: 'no-input' });

    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, number);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: number.slice(-1) }));

    const t0 = Date.now(); let btn = null;
    while (Date.now() - t0 < 3000) {
      const b = document.querySelector('button.make-call');
      if (b && !b.disabled && b.getAttribute('aria-disabled') !== 'true' && !b.className.includes('disabled')) { btn = b; break; }
      await sleep(100);
    }
    if (btn) { btn.click(); report(reqId, { ok: true }); }
    else {
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
      input.dispatchEvent(new KeyboardEvent('keyup',   { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
      report(reqId, { ok: true, reason: 'enter-fallback' });
    }
  }

  function report(reqId, result) {
    if (reqId) chrome.runtime.sendMessage({ type: 'DIAL_RESULT', reqId, ...result });
  }
})();