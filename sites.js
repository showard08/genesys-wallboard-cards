/* Site registration, shared by popup.js and background.js.
   No site is hard-coded: the user enables the extension on a site from the
   popup, which requests host permission for it and registers the content
   script dynamically. Enabled hostnames are kept in chrome.storage.local.

   Compliance: the hosts the extension may be enabled on are delivered by
   enterprise policy (chrome.storage.managed → "allowedHosts"), never shipped
   in the package. On a machine without the policy the list is empty, so the
   public store package is inert outside the organisation. Host permission is
   requested for the exact host only — no wildcards. */

const SITES_KEY = 'sites';
const CONTENT_CSS = ['cards.css'];
const CONTENT_JS = ['defaults.js', 'cards.js', 'dial-dispatch.js', 'dial-genesys.js'];

/* Allowed hosts come from enterprise policy. IT sets the extension policy
   value "allowedHosts" (a JSON array of exact hostnames) via GPO/Intune. */
async function getAllowedHosts() {
  try {
    const { allowedHosts } = await chrome.storage.managed.get('allowedHosts');
    return Array.isArray(allowedHosts) ? allowedHosts : [];
  } catch (e) {
    return [];
  }
}

async function isAllowedHost(host) {
  return (await getAllowedHosts()).includes(host);
}

/* Match pattern for a host: the exact host only, no parent-domain wildcard.
   If the Genesys dashboard widget iframe loads from a different subdomain,
   have IT add that exact subdomain to the policy and enable it explicitly. */
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
  if (!(await isAllowedHost(host))) throw new Error(`Host not in policy allow-list: ${host}`);
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

/* Re-register every enabled site that is still in the policy allow-list and
   that we still hold permission for. Dynamic registrations don't survive an
   extension update/reload; permissions do. Hosts removed from the policy are
   unregistered so a policy change takes effect without user action. */
async function syncRegistrations() {
  for (const host of await getSites()) {
    if ((await isAllowedHost(host)) && (await hasSitePermission(host))) {
      await registerSite(host);
    } else {
      await unregisterSite(host);
    }
  }
}
