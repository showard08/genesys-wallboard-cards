# Genesys Wallboard Agent Cards

Browser extension (Edge/Chrome, Manifest V3) with two features:

1. **Agent cards** — restyles the **Agent Status widget** on a Genesys Cloud
   analytics dashboard
   (`https://apps.<your-region>/directory/#/analytics/dashboards/…`) into
   large stacked status cards.
2. **Click-to-dial** — when a call is started on your dispatch site, the same
   call is offered on the agent's Genesys Cloud phone: the agent confirms a
   prompt and the extension dials it, so the number is never re-typed.

Published on the Microsoft Edge Add-ons store; updates ship automatically via
the store. MIT licensed.

## Agent cards

- Agent name on top, centred, bold
- Presence dot + status label underneath, colour-coded
- Time-in-status below that, largest text on the card; on active calls the
  phone icon + call-duration link sit under the timer
- Cards stack vertically where the table already sits; if the list overflows
  the widget it auto-scrolls down, pauses, and drifts back up

The styling is pure CSS. The widget's table is real light-DOM markup with
stable class hooks (`.widget-type-AGENT_STATUS`, `td.column-agent`,
`td.column-statusAndPresence`, `td.column-unifiedDuration`,
`.entity-v3-presence-indicator-dot.<presence>`), so `cards.css` restyles the
rows in place as flex-column cards. Because the DOM is never touched, Ember's
re-renders and per-second timers keep working.

Status colours are keyed off the presence dot's class via `:has()`
(needs Edge/Chrome 105+):

| Dot class  | Meaning                | Colour   |
|------------|------------------------|----------|
| available  | Available              | green    |
| idle       | On Queue — waiting     | teal     |
| on_queue   | On Queue — interacting | blue     |
| busy       | Busy                   | red      |
| break      | Break                  | amber    |
| meal       | Meal                   | orange   |
| away       | Away                   | grey     |
| offline    | Offline                | dim grey |

When the card list is taller than the widget, `cards.js` drives the widget's
own scroll container (35 px/s down, pause, back up); it never modifies the
widget's DOM.

## Click-to-dial

An agent starts a call the way they already do on the dispatch page —
clicking a number, the **Y** shortcut, or **CALL CUSTOMER**. The extension
reads the number (from the clicked element, or from the "Connecting to …"
popup where the dispatch app has already resolved it), shows a confirmation
dialog, and on confirm drives the Genesys Agent Workspace dialer in the other
tab via the extension's background relay.

### Security model

- **Confirm-gated**: nothing dials without a human clicking **Call** in the
  extension's own dialog (auto-cancels after 15 s). A dedupe guard stops the
  same number firing twice.
- **Number policy**: numbers must normalise to an allowed prefix (`+44` by
  default), 10–15 digits; premium/revenue-share ranges (09xx, 084x, 087x) are
  blocked. Enforced twice — on the dispatch page and independently in the
  background worker.
- **Real input only**: the flow only starts and confirms on genuine user
  events (`event.isTrusted`) — page scripts cannot synthesise a click to
  start or approve a call.
- **Tamper-resistant UI**: the dialog and toasts render inside a closed
  shadow root, so page CSS/JS cannot alter the number the agent is shown.
  What's displayed is what dials.
- **Residual risk (stated plainly)**: a compromised dispatch page can still
  display deceptive content; it cannot complete a call without a real human
  click on the extension's dialog, and cannot pass a number outside policy.

### Host configuration

The extension may only be enabled on the exact hosts listed in
`ALLOWED_HOSTS` in `sites.js`, which must match the entries in
`manifest.json → optional_host_permissions` (exact hostnames, no wildcards).
Fill both with your dispatch host and Genesys host before packing. Enabling
any other site is refused, and host permission is only ever requested for the
exact host at the user's click.

### DOM hooks it depends on

If a Genesys or dispatch update breaks dialling, re-inspect these first:

| Side     | Element             | Selector                                      |
|----------|---------------------|-----------------------------------------------|
| Dispatch | Call popup          | `.info_popup` containing text "Connecting to" |
| Dispatch | Popup body / number | `.popup_inner_inner > span`                   |
| Dispatch | Number click        | `.init-call`                                  |
| Genesys  | Open-dialer button  | `#interaction-new-call-outbound-target`       |
| Genesys  | Number field        | `input.phone-number-input`                    |
| Genesys  | Call button         | `button.make-call`                            |

### Required Genesys setting (per agent)

Genesys won't enable its call button until the outbound line / On Behalf of
Queue is set. Enable each agent's user setting to auto-fill the default
outbound line/queue (or have them select their queue once so it's
remembered). Without it, dials fail with a "pick your outbound queue" toast.

## Install

**From the store (normal use):** install from the Microsoft Edge Add-ons
listing. IT can force-install and lock it via the `ExtensionInstallForcelist`
policy using the store ID.

**From source (development):** clone the repo, fill in the hosts (see Host
configuration), then `edge://extensions` → Developer mode → Load unpacked.

Then enable it per site — it runs nowhere until you do:

1. **Genesys tab** — open your Genesys Cloud tab (dashboard for the cards,
   Agent Workspace for dialling), click the extension's toolbar icon and
   press **Add current tab's site**; accept the permission prompt.
2. **Dispatch tab** — repeat on your dispatch site (needed for click-to-dial;
   skip if you only want the cards).

Click-to-dial needs **both** sites enabled and both tabs open. Enabled
hostnames are stored locally in the browser profile; look-and-feel settings
sync with the profile.

## Settings

Click the toolbar icon. Everything saves as you change it and applies live —
no reload. Settings sync via `chrome.storage.sync`.

| Setting | What it does |
|---|---|
| Card style | **Large boxes** — grid, name/status/timer stacked. **Compact rows** — thin rows, timer right. |
| Cards per row | Grid columns in large style (1–4). |
| Text size | Scales the whole card (80–160%). |
| Auto-scroll + speed + pause | Drift down/up when the list overflows. |
| Blue glow / pulse | The glow on Interacting cards. |
| Show call timer instead of status timer | Promote the call timer on Interacting cards. |

**Reset** restores the defaults in `defaults.js`.

## Troubleshooting click-to-dial

| Toast / message | Meaning · fix |
|---|---|
| **Call started** | Working — Genesys is ringing. |
| **Pick your outbound queue in Genesys…** | Agent's outbound line isn't auto-filling — enable the Genesys user setting. |
| **Open Genesys Agent Workspace, then click again** | No Genesys tab answered in time — open Workspace, or raise `DIAL_TIMEOUT_MS` in `background.js`. |
| **Genesys isn't open in this browser** | No enabled Genesys tab open. |
| **Ignored a number not allowed by policy / Blocked: number not allowed by policy** | The number failed the prefix/length/premium checks — adjust the policy constants if it's legitimate. |
| **"…isn't one" when adding a site** | Host isn't in `ALLOWED_HOSTS` — add it there and to the manifest. |
| **No toast at all** | Extension isn't enabled on the dispatch host, or the popup markup changed — re-inspect the DOM hooks. |

## Releases

Versions are tagged in this repo and published to the Edge Add-ons store
automatically by the GitHub Action in `.github/workflows/publish.yml`:

1. Bump `version` in `manifest.json` (must match the tag).
2. `git commit -am "x.y.z" && git tag x.y.z && git push && git push --tags`
3. The workflow zips the extension, uploads it via the Edge Publish API, and
   submits it for certification; it goes live to installed users
   automatically once approved.

Requires repo secrets `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY`
(from Partner Center — note the API key's expiry date).

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest; host permissions pinned to the two configured hosts. |
| `background.js` | Re-registers enabled sites on install/startup; relays and re-validates dial requests between tabs. |
| `sites.js` | Per-site registration + `ALLOWED_HOSTS`. |
| `popup.html` / `popup.js` | Settings popup and site enable/remove. |
| `defaults.js` | Default card settings. |
| `cards.css` / `cards.js` | Card styling + auto-scroll. |
| `dial-dispatch.js` | Dispatch-side: number capture, validation, confirm dialog. |
| `dial-genesys.js` | Genesys-side: drives the Agent Workspace dialer. |
| `icon-*.png` | Toolbar/store icons. |

## Licence

MIT — see `LICENSE`.
