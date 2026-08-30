/* Service worker: keeps the dynamically registered content scripts in place
   across extension updates/reloads and browser restarts, and relays DIAL
   requests from the dispatch page to the Genesys Agent Workspace tab.

   Security model for the relay — the service worker is the privileged
   chokepoint, so it trusts nothing it is sent:
     1. The DIAL sender is authenticated: it must come from a real top-level
        tab whose https hostname is BOTH user-enabled AND in the enterprise
        policy allow-list. Content scripts on other pages, subframes, or
        stale registrations can't start a dial.
     2. The number is independently re-normalised and re-validated here with
        the same shared rules (security.js) the dispatch page used. Even if
        dispatch-side validation were bypassed or refactored away, a
        non-policy number cannot reach Genesys.
     3. DIAL_RESULT is only accepted from the tab the request was sent to.
     4. Exactly ONE Genesys tab is targeted per request (active tab
        preferred, then most recently accessed) so two open Workspace tabs
        can never both place the call. */

importScripts('sites.js', 'security.js');

const { normaliseNumber, validNumber } = globalThis.AGENT_CARDS_SECURITY;

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
const pendingDials = new Map();          // reqId -> { dispatchTabId, targetTabId, timer }

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'DIAL') {
    handleDial(msg, sender);
  } else if (msg?.type === 'DIAL_RESULT' && msg.reqId) {
    const entry = pendingDials.get(msg.reqId);
    if (!entry) return;
    // Only the tab we actually sent this request to may answer for it
    if (sender.tab?.id !== entry.targetTabId) return;
    clearTimeout(entry.timer);
    pendingDials.delete(msg.reqId);
    notifyDispatch(entry.dispatchTabId, { ok: msg.ok, reason: msg.reason });
  }
});

/* A DIAL request is only honoured from a top-level frame of a tab whose
   hostname is user-enabled AND policy-allowed. Everything else is dropped
   before the number is even looked at. */
async function senderIsTrustedDispatch(sender) {
  if (sender.tab?.id == null) return false;         // not from a tab at all
  if (sender.frameId !== 0) return false;           // dial-dispatch.js only runs top-frame
  let host;
  try {
    const url = new URL(sender.url || '');
    if (url.protocol !== 'https:') return false;
    host = url.hostname;
  } catch (e) {
    return false;
  }
  if (!(await getSites()).includes(host)) return false;
  return isAllowedHost(host);                        // enterprise policy is the final word
}

async function handleDial(msg, sender) {
  if (!(await senderIsTrustedDispatch(sender))) return; // silent drop: nothing to notify
  const dispatchTabId = sender.tab.id;

  // Independent re-validation — do NOT trust the content script's checks
  const number = normaliseNumber(msg.number);
  if (!validNumber(number)) {
    notifyDispatch(dispatchTabId, { ok: false, reason: 'invalid' });
    return;
  }

  relayDial(number, dispatchTabId, sender.url);
}

async function relayDial(number, dispatchTabId, senderUrl) {
  // Candidate tabs: every enabled site EXCEPT the dispatch host itself
  const senderHost = new URL(senderUrl).hostname;
  const patterns = (await getSites())
    .filter((h) => h !== senderHost)
    .flatMap(sitePatterns);
  let tabs = [];
  if (patterns.length) { try { tabs = await chrome.tabs.query({ url: patterns }); } catch (e) {} }
  const candidates = tabs.filter((t) => t.id != null);
  if (!candidates.length) { notifyDispatch(dispatchTabId, { ok: false, reason: 'no-tab' }); return; }

  // Exactly one target: the active tab if it's a candidate, else the most
  // recently accessed one — deterministic, and two Workspace tabs can never
  // both place the call.
  const target =
    candidates.find((t) => t.active) ||
    candidates.slice().sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];

  const reqId = crypto.randomUUID();
  const timer = setTimeout(() => {
    pendingDials.delete(reqId);
    notifyDispatch(dispatchTabId, { ok: false, reason: 'no-dialer' });
  }, DIAL_TIMEOUT_MS);
  pendingDials.set(reqId, { dispatchTabId, targetTabId: target.id, timer });

  chrome.tabs.sendMessage(target.id, { type: 'DIAL', number, reqId }, () => void chrome.runtime.lastError);
}

function notifyDispatch(tabId, status) {
  if (tabId != null) chrome.tabs.sendMessage(tabId, { type: 'DIAL_STATUS', ...status }, () => void chrome.runtime.lastError);
}
