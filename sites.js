/* Site registration, shared by popup.js and background.js.
   No site is hard-coded: the user enables the extension on a site from the
   popup, which requests host permission for it and registers the content
   script dynamically. Enabled hostnames are kept in chrome.storage.local. */

const SITES_KEY = 'sites';
const CONTENT_CSS = ['cards.css'];
const CONTENT_JS = ['defaults.js', 'cards.js', 'dial-dispatch.js', 'dial-genesys.js'];

/* Match patterns for a host. The dashboard widgets load in an iframe that
   can be served from a sibling subdomain, so alongside the exact host we
   also cover its parent domain (apps.example.com → *.example.com). */
function sitePatterns(host) {
  const patterns = [`https://${host}/*`];
  const labels = host.split('.');
  if (labels.length >= 3) {
    patterns.push(`https://*.${labels.slice(1).join('.')}/*`);
  }
  return patterns;
}

function siteScriptId(host) {
  return `agent-cards:${host}`;
}

async function getSites() {
  const stored = await chrome.storage.local.get(SITES_KEY);
  return stored[SITES_KEY] || [];
}

async function setSites(sites) {
  await chrome.storage.local.set({ [SITES_KEY]: sites });
}

async function isRegistered(host) {
  const scripts = await chrome.scripting.getRegisteredContentScripts({
    ids: [siteScriptId(host)],
  });
  return scripts.length > 0;
}

async function registerSite(host) {
  const id = siteScriptId(host);
  if (await isRegistered(host)) {
    await chrome.scripting.unregisterContentScripts({ ids: [id] });
  }
  await chrome.scripting.registerContentScripts([
    {
      id,
      matches: sitePatterns(host),
      allFrames: true,
      matchOriginAsFallback: true,
      css: CONTENT_CSS,
      js: CONTENT_JS,
      runAt: 'document_idle',
      persistAcrossSessions: true,
    },
  ]);
}

async function unregisterSite(host) {
  if (await isRegistered(host)) {
    await chrome.scripting.unregisterContentScripts({ ids: [siteScriptId(host)] });
  }
}

async function hasSitePermission(host) {
  return chrome.permissions.contains({ origins: sitePatterns(host) });
}

/* Re-register every enabled site we still hold permission for. Dynamic
   registrations don't survive an extension update/reload; permissions do. */
async function syncRegistrations() {
  for (const host of await getSites()) {
    if (await hasSitePermission(host)) {
      await registerSite(host);
    }
  }
}
