/* Settings popup: loads from chrome.storage.sync, saves on every change.
   The content script (cards.js) listens for storage changes and applies
   them to the wallboard immediately. Also manages which sites the
   extension is enabled on (see sites.js). */

const $ = (id) => document.getElementById(id);

// ── Sites ────────────────────────────────────────────────────────────────

// Looked up when the popup opens so the click handler can call
// permissions.request() straight away (it must run inside a user gesture).
let currentTab = null;
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  currentTab = tab || null;
});

function siteMsg(text, isError = false) {
  $('siteMsg').textContent = text;
  $('siteMsg').classList.toggle('error', isError);
}

async function renderSites() {
  const list = $('sites');
  list.textContent = '';
  const sites = await getSites();

  if (!sites.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Not enabled anywhere yet. Open your Genesys dashboard tab, then click the button.';
    list.appendChild(li);
    return;
  }

  for (const host of sites) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'host';
    name.textContent = host;
    name.title = host;
    li.appendChild(name);

    if (!(await hasSitePermission(host))) {
      // e.g. permission declined, or revoked from the browser's extension page
      const warn = document.createElement('span');
      warn.className = 'warn';
      warn.textContent = 'no access';
      li.appendChild(warn);
      const enable = document.createElement('button');
      enable.className = 'small';
      enable.textContent = 'Enable';
      enable.addEventListener('click', () => enableSite(host));
      li.appendChild(enable);
    }

    const remove = document.createElement('button');
    remove.className = 'small';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeSite(host));
    li.appendChild(remove);
    list.appendChild(li);
  }
}

async function enableSite(host, tab = null) {
  if (!(await isAllowedHost(host))) {
    siteMsg(`"${host}" isn't in the extension policy. Ask IT to add it to the allowed hosts.`, true);
    return;
  }
  const granted = await chrome.permissions.request({ origins: sitePatterns(host) });
  if (!granted) {
    siteMsg('Permission was declined — nothing changed.', true);
    return;
  }
  await registerSite(host);
  const sites = await getSites();
  if (!sites.includes(host)) await setSites([...sites, host]);

  // Inject into the open tab right now so it works without a reload
  if (tab?.id != null) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id, allFrames: true }, files: CONTENT_CSS });
      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: CONTENT_JS });
    } catch (e) {
      // Not fatal — it'll load on the next page load
    }
  }
  siteMsg(`Enabled on ${host}.`);
  renderSites();
}

async function removeSite(host) {
  await unregisterSite(host);
  await setSites((await getSites()).filter((h) => h !== host));
  try {
    await chrome.permissions.remove({ origins: sitePatterns(host) });
  } catch (e) {
    // Fine — the registration is gone regardless
  }
  siteMsg(`Removed ${host}. Reload that tab to clear the styling.`);
  renderSites();
}

$('addSite').addEventListener('click', () => {
  let host;
  try {
    const url = new URL(currentTab?.url || '');
    if (url.protocol !== 'https:') throw new Error('not https');
    host = url.hostname;
  } catch (e) {
    siteMsg('Switch to your Genesys dashboard tab (an https:// page) and try again.', true);
    return;
  }
  enableSite(host, currentTab);
});

renderSites();

// ── Settings ─────────────────────────────────────────────────────────────

function render(s) {
  document.querySelector(`input[name="style"][value="${s.style}"]`).checked = true;
  $('columns').value = String(s.columns);
  $('fontScale').value = String(s.fontScale);
  $('autoScroll').checked = s.autoScroll;
  $('scrollSpeed').value = String(s.scrollSpeed);
  $('edgePause').value = String(s.edgePause);
  $('callGlow').checked = s.callGlow;
  $('glowPulse').checked = s.glowPulse;
  $('callTimerReplaces').checked = s.callTimerReplaces;
  $('wallboard').checked = s.wallboard;
  $('wallboardHeight').value = String(s.wallboardHeight);
  refresh();
}

function read() {
  const num = (id, fallback) => {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    style: document.querySelector('input[name="style"]:checked').value,
    columns: parseInt($('columns').value, 10),
    fontScale: num('fontScale', AGENT_CARDS_DEFAULTS.fontScale),
    autoScroll: $('autoScroll').checked,
    scrollSpeed: num('scrollSpeed', AGENT_CARDS_DEFAULTS.scrollSpeed),
    edgePause: num('edgePause', AGENT_CARDS_DEFAULTS.edgePause),
    callGlow: $('callGlow').checked,
    glowPulse: $('glowPulse').checked,
    callTimerReplaces: $('callTimerReplaces').checked,
    wallboard: $('wallboard').checked,
    wallboardHeight: parseInt($('wallboardHeight').value, 10),
  };
}

// Derived UI state: value labels, dependent rows greyed out
function refresh() {
  $('fontScaleValue').textContent = Math.round(parseFloat($('fontScale').value) * 100) + '%';
  const compact = document.querySelector('input[name="style"]:checked').value === 'compact';
  $('columnsRow').classList.toggle('disabled', compact);
  for (const row of document.querySelectorAll('[data-depends]')) {
    row.classList.toggle('disabled', !$(row.dataset.depends).checked);
  }
}

let savedTimer;
function save() {
  refresh();
  chrome.storage.sync.set(read(), () => {
    $('saved').classList.add('show');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => $('saved').classList.remove('show'), 1200);
  });
}

chrome.storage.sync.get(AGENT_CARDS_DEFAULTS, (stored) => {
  render({ ...AGENT_CARDS_DEFAULTS, ...stored });
});

for (const el of document.querySelectorAll('section input, section select')) {
  el.addEventListener('input', save);
  el.addEventListener('change', save);
}

$('reset').addEventListener('click', () => {
  chrome.storage.sync.set(AGENT_CARDS_DEFAULTS, () => render({ ...AGENT_CARDS_DEFAULTS }));
});
