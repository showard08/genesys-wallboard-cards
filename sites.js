/* Site registration, shared by popup.js and background.js.
   No site is hard-coded: the user enables the extension on a site from the
   popup, which requests host permission for it and registers the content
   script dynamically. Enabled hostnames are kept in chrome.storage.local.

   Compliance: enabling is restricted to the exact hosts in ALLOWED_HOSTS,
   and host permission is requested for the exact host only — no wildcards. */

const SITES_KEY = 'sites';
const CONTENT_CSS = ['cards.css'];
const CONTENT_JS = ['defaults.js', 'cards.js', 'dial-dispatch.js', 'dial-genesys.js'];

/* The extension may ONLY be enabled on these exact hosts. Put your real
   iCabbi (dispatch) and Genesys hosts here — whatever shows in the address
   bar. These MUST match manifest.json → optional_host_permissions. */
const ALLOWED_HOSTS = [
  'YOUR-DISPATCH-HOST',   // e.g. dispatch.icabbi.com
  'YOUR-GENESYS-HOST',    // e.g. apps.mypurecloud.com
];

function isAllowedHost(host) {
  return ALLOWED_HOSTS.includes(host);
}

/* Match pattern for a host: the exact host only, no parent-domain wildcard.
   If the Genesys dashboard widget iframe loads from a different subdomain,
   add that exact subdomain to ALLOWED_HOSTS and optional_host_permissions
   and enable it explicitly, rather than widening this to a wildcard. */
function sitePatterns(host) {
  return [`https://${host}/*`];
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
  if (!isAllowedHost(host)) throw new Error(`Host not in allow-list: ${host}`);
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
   registrations don't survive an extension update/reload; permissions do.
   Hosts that are no longer in the allow-list are skipped. */
async function syncRegistrations() {
  for (const host of await getSites()) {
    if (isAllowedHost(host) && (await hasSitePermission(host))) {
      await registerSite(host);
    }
  }
}
