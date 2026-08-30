/* Service worker: keeps the dynamically registered content scripts in place
   across extension updates/reloads and browser restarts. */

importScripts('sites.js');

chrome.runtime.onInstalled.addListener(() => {
  syncRegistrations();
});

chrome.runtime.onStartup.addListener(() => {
  syncRegistrations();
});

// Re-sync registrations when IT updates the policy allow-list
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'managed' && changes.allowedHosts) syncRegistrations();
});

const DIAL_TIMEOUT_MS = 12000;
const pendingDials = new Map();          // reqId -> { dispatchTabId, timer }

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'DIAL' && msg.number) {
    relayDial(msg.number, sender.tab?.id);
  } else if (msg?.type === 'DIAL_RESULT' && msg.reqId) {
    const entry = pendingDials.get(msg.reqId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pendingDials.delete(msg.reqId);
    notifyDispatch(entry.dispatchTabId, { ok: msg.ok, reason: msg.reason });
  }
});

async function relayDial(number, dispatchTabId) {
  const patterns = (await getSites()).flatMap(sitePatterns);
  let tabs = [];
  if (patterns.length) { try { tabs = await chrome.tabs.query({ url: patterns }); } catch (e) {} }
  const targets = tabs.filter((t) => t.id != null);
  if (!targets.length) { notifyDispatch(dispatchTabId, { ok: false, reason: 'no-tab' }); return; }

  const reqId = crypto.randomUUID();
  const timer = setTimeout(() => {
    pendingDials.delete(reqId);
    notifyDispatch(dispatchTabId, { ok: false, reason: 'no-dialer' });
  }, DIAL_TIMEOUT_MS);
  pendingDials.set(reqId, { dispatchTabId, timer });

  for (const t of targets) {
    chrome.tabs.sendMessage(t.id, { type: 'DIAL', number, reqId }, () => void chrome.runtime.lastError);
  }
}

function notifyDispatch(tabId, status) {
  if (tabId != null) chrome.tabs.sendMessage(tabId, { type: 'DIAL_STATUS', ...status }, () => void chrome.runtime.lastError);
}
