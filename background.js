/* Service worker: keeps the dynamically registered content scripts in place
   across extension updates/reloads and browser restarts. */

importScripts('sites.js');

chrome.runtime.onInstalled.addListener(() => {
  syncRegistrations();
});

chrome.runtime.onStartup.addListener(() => {
  syncRegistrations();
});
