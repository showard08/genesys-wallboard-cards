# Genesys Wallboard Agent Cards

A lightweight Microsoft Edge / Chrome Manifest V3 extension that transforms the **Genesys Cloud Agent Status widget** into a purpose-built operational wallboard.

It provides:

* **Agent status cards** — replaces the standard Agent Status table presentation with large, readable cards or compact rows.
* **Full-width Wallboard Mode** — promotes the Agent Status widget from Genesys' right-hand sidebar into a configurable full-width band across the top of the dashboard, with other widgets reflowing underneath.
* **Live status highlighting** — colour-coded presence states, active-call highlighting, timers and a dedicated **Not Responding** alert.
* **Auto-scroll** — automatically scrolls large agent lists when they don't fit in the available space.
* **Click-to-dial** — starts a call from a configured dispatch site and offers it to the agent's Genesys Cloud Agent Workspace without requiring the number to be manually re-entered.
* **Enterprise host control** — the extension is inert by default and can only be enabled on hosts explicitly authorised by enterprise policy.

The extension is designed to sit on top of Genesys Cloud rather than replace it. Genesys remains responsible for the underlying agent state and live updates; the extension provides an alternative presentation layer.

MIT licensed.

---

## Screenshots

### Standard Genesys dashboard

The normal Genesys dashboard keeps the Agent Status widget in its usual right-hand position.

### Agent Cards

The Agent Status table is restyled into readable cards while retaining the original Genesys DOM and live updates.

### Full-width Wallboard Mode

Wallboard Mode promotes the Agent Status widget to the top of the dashboard:

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                      AGENT STATUS                           │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  STEVE   │  │   BOB    │  │  SARAH   │  │   DAVE   │  │
│  │ AVAILABLE│  │   BUSY   │  │ ON QUEUE │  │  BREAK   │  │
│  │  01:42   │  │  04:31   │  │  00:52   │  │  12:18   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                 Other Genesys widgets                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

The height of the Agent Status band is configurable from **20% to 90%**.

---

# Agent Cards

The extension restyles the Genesys Cloud **Agent Status** widget without rebuilding its data or DOM.

The original table remains in place and Genesys continues to control:

* Agent presence
* Agent names
* Time in status
* Interaction state
* Call duration
* Live updates
* Ember re-renders

The extension only changes how that information is presented.

## Large boxes

Large cards display:

* Agent name
* Presence indicator
* Status
* Time in status
* Call state / call duration when interacting

Cards can be displayed in configurable columns.

```text
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│     STEVE      │  │      BOB       │  │     SARAH      │
│                │  │                │  │                │
│ 🟢 AVAILABLE   │  │ 🔴 BUSY        │  │ 🔵 ON QUEUE    │
│                │  │                │  │                │
│     12:43      │  │     04:31      │  │     00:52      │
└────────────────┘  └────────────────┘  └────────────────┘
```

## Compact rows

Compact mode provides a denser wallboard layout:

```text
┌────────────────────────────────────────────────────────────┐
│ Steve Smith                         🟢 AVAILABLE      12:43 │
├────────────────────────────────────────────────────────────┤
│ Bob Jones                           🔴 BUSY            04:31 │
├────────────────────────────────────────────────────────────┤
│ Sarah Brown                         🔵 ON QUEUE        00:52 │
└────────────────────────────────────────────────────────────┘
```

When Wallboard Mode is enabled, compact rows can also be arranged into multiple columns using the **Cards per row** setting.

---

# Status Colours

Agent cards use the Genesys presence indicator to determine their status colour.

| Genesys presence | Meaning                | Card indicator |
| ---------------- | ---------------------- | -------------- |
| `available`      | Available              | Green          |
| `idle`           | On Queue — waiting     | Teal           |
| `on_queue`       | On Queue — interacting | Blue           |
| `busy`           | Busy                   | Red            |
| `break`          | Break                  | Amber          |
| `meal`           | Meal                   | Orange         |
| `away`           | Away                   | Grey           |
| `meeting`        | Meeting                | Purple         |
| `training`       | Training               | Purple         |
| `offline`        | Offline                | Dark grey      |

The status is derived from the presence indicator's class using CSS `:has()`.

Edge/Chrome 105+ is required for the `:has()` selectors used by the extension.

---

# Interacting / Active Calls

Agents currently interacting with a call receive an optional blue visual highlight.

The extension can:

* Add a blue glow to the card.
* Pulse the glow to make active calls more noticeable.
* Promote the call timer so it replaces the normal time-in-status timer.
* Keep the normal status timer instead, if preferred.

The call glow is implemented using a CSS overlay so it can coexist with the Not Responding alert.

---

# Not Responding

Agents in a **Not Responding** state receive a dedicated red animated alert.

```text
┌──────────────────────────────┐
│                              │
│          STEVE               │
│                              │
│      🔴 NOT RESPONDING       │
│                              │
│          00:17               │
│                              │
└──────────────────────────────┘
```

The alert is intentionally difficult to miss on a large wallboard.

The extension supports multiple Genesys DOM hooks for the state:

* `not_responding` presence indicator
* `NOT_RESPONDING` status classes
* `not-responding` status classes

The animation is applied directly to the card rather than using the same `::after` layer as the Interacting glow, allowing both states to be displayed simultaneously.

---

# Wallboard Mode

Wallboard Mode is designed for large displays, TVs and dedicated operations screens.

When enabled, the Agent Status widget is moved visually from Genesys' normal right-hand sidebar position to a **full-width band across the top of the dashboard**.

The other dashboard widgets are reflowed underneath.

### Normal

```text
┌────────────────────────────────────┬───────────────┐
│                                    │               │
│         Other dashboard            │    AGENTS     │
│             widgets                │               │
│                                    │               │
└────────────────────────────────────┴───────────────┘
```

### Wallboard Mode

```text
┌─────────────────────────────────────────────────────┐
│                                                     │
│                    AGENTS                           │
│                                                     │
│   Steve      Bob      Sarah      Dave      Lisa     │
│                                                     │
│   John       Mike     Chris      Paul      Alex     │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│               Other dashboard widgets               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Wallboard height

The Agent Status area can be configured from:

* 20%
* 25%
* 30%
* 35%
* 40%
* 45%
* **50%**
* 55%
* 60%
* 65%
* 70%
* 75%
* 80%
* 85%
* 90%

The default is **50%**.

The layout is implemented using CSS grid placement rather than physically moving Genesys DOM elements. This means Genesys remains responsible for the underlying widgets and Ember re-renders continue to work normally.

---

# Auto-scroll

If the Agent Status list contains more agents than fit in the available widget height, the extension can automatically scroll the list.

The scroll behaviour:

1. Displays the top of the list.
2. Waits for the configured pause.
3. Smoothly scrolls downward.
4. Waits at the bottom.
5. Smoothly returns to the top.
6. Repeats.

The scroll operates on Genesys' existing scroll container and does not modify the widget's DOM.

Settings include:

* Enable/disable auto-scroll
* Scroll speed
* Pause at the top and bottom

Auto-scroll automatically becomes more useful in Wallboard Mode because the Agent Status widget has a configurable large viewport.

---

# Click-to-Dial

Click-to-dial allows an operator to start a call from a configured dispatch application and have the number offered to the agent's Genesys Cloud Agent Workspace.

The normal workflow is:

```text
Dispatch application
        │
        │ operator clicks number
        ▼
Extension captures number
        │
        ▼
Security validation
        │
        ▼
Confirmation dialog
        │
        │ operator clicks Call
        ▼
Background extension relay
        │
        ▼
Genesys Agent Workspace
        │
        ▼
Genesys dialer
```

The number does not need to be manually re-entered into Genesys.

The extension supports numbers obtained from:

* A clicked phone number
* The dispatch application's call popup
* Existing `CALL CUSTOMER` / call initiation flows
* The configured keyboard shortcut flow

Click-to-dial requires both the dispatch site and Genesys site to be enabled.

---

# Click-to-Dial Security

Click-to-dial is deliberately designed so that the dispatch webpage is **not trusted with the final authority to make a call**.

## Human confirmation

A call cannot be completed without a genuine user interaction with the extension's confirmation dialog.

The confirmation automatically expires after 15 seconds.

A deduplication guard also prevents the same request from being fired repeatedly.

## Number validation

Numbers are normalised and validated before being accepted.

By default:

* UK `+44` numbers are permitted.
* Numbers must contain 10–15 digits after normalisation.
* Premium/revenue-share ranges such as `09xx`, `084x` and `087x` are blocked.

Validation occurs twice:

1. On the dispatch page.
2. Independently in the background service worker.

The background worker therefore does not trust the dispatch content script's validation result.

## Trusted browser events

The flow requires genuine browser user events.

`event.isTrusted` is checked when:

* Starting the call flow.
* Confirming the call.

This prevents page JavaScript from simply synthesising the click required to approve a call.

## Tamper-resistant confirmation UI

The confirmation dialog and notifications are rendered inside a closed Shadow DOM.

This prevents page CSS and page JavaScript from changing the number presented to the operator.

The security goal is:

> **What the operator sees in the extension confirmation is what the extension sends to Genesys.**

## Background relay

The service worker acts as the privileged security boundary.

It independently validates:

* Sender origin
* Enabled hosts
* Phone number
* Request state
* Target Genesys tab

The dispatch webpage cannot directly instruct the Genesys content script to dial.

## Residual risk

A compromised dispatch webpage could still display deceptive content to an operator.

It cannot, however:

* Complete a call without the operator confirming the extension dialog.
* Bypass the number validation policy.
* Directly access the Genesys extension context.
* Change the number displayed inside the extension's confirmation UI.

---

# Enterprise Host Configuration

The extension is intentionally **inert by default**.

The extension package contains no organisation-specific hostnames.

The hosts on which the extension is permitted to operate are supplied through enterprise managed storage.

The managed policy uses:

```text
allowedHosts
```

as a JSON array of exact hostnames.

For Microsoft Edge this is configured through:

```text
HKLM\SOFTWARE\Policies\Microsoft\Edge\3rdparty\extensions\<extension-id>\policy
```

The policy is declared through `schema.json` and read by the extension using:

```javascript
chrome.storage.managed
```

## No policy = no extension

Without enterprise policy:

```text
allowedHosts = []
```

The extension cannot be enabled on any website.

This means that installing a copy of the extension outside the organisation does not automatically give it access to websites.

## Effective scope

The manifest contains broad optional HTTPS host permissions because browser extension manifests cannot have their host permission list dynamically rewritten by enterprise policy.

The **effective scope**, however, is controlled by `allowedHosts`.

The extension refuses to register a site unless its hostname is present in the managed policy.

## Live policy changes

When the enterprise policy changes:

* Newly allowed hosts can be enabled.
* Removed hosts are automatically unregistered.
* No browser restart is required.

Full deployment instructions, including force-installation, registry configuration and verification, are documented in:

`IT-DEPLOYMENT.md`

---

# Required Genesys Configuration

For click-to-dial to work, each agent must have a usable outbound line / **On Behalf of Queue** configured in Genesys.

Genesys will not enable the call button until an outbound line/queue is available.

Agents should either:

* Have their default outbound line/queue configured automatically, or
* Select their queue once so Genesys remembers it.

If this is not configured, Genesys may display a prompt asking the agent to select an outbound queue before a call can be placed.

---

# Installation

## Microsoft Edge Add-ons

For normal production use, install the extension from the Microsoft Edge Add-ons store.

IT administrators can force-install the extension using the Edge:

```text
ExtensionInstallForcelist
```

policy.

Updates are then delivered through the store.

## Development / Unpacked installation

For development:

1. Clone the repository.

2. Open:

   ```text
   edge://extensions
   ```

3. Enable **Developer mode**.

4. Select **Load unpacked**.

5. Select the repository directory.

6. Configure the required `allowedHosts` enterprise policy.

7. Open the desired Genesys or dispatch tab.

8. Open the extension popup.

9. Select **Add current tab's site**.

The site must also be present in the enterprise `allowedHosts` policy.

---

# Enabling Sites

The extension does not automatically run on every website.

Open the extension popup on the site you want to enable and select:

**Add current tab's site**

The browser will request the required host permission.

For Agent Cards:

```text
Genesys dashboard
        ↓
Add current tab's site
```

For Click-to-Dial:

```text
Genesys Agent Workspace
        ↓
Add current tab's site

Dispatch application
        ↓
Add current tab's site
```

Click-to-dial requires **both sites** to be enabled and both tabs to be available.

Enabled hostnames are stored locally in the browser profile.

---

# Settings

All settings are available from the extension toolbar popup.

Changes are saved automatically and applied live without reloading the Genesys dashboard.

Settings are stored using:

```javascript
chrome.storage.sync
```

## Layout

### Card style

* **Large boxes**
* **Compact rows**

### Cards per row

Controls the number of columns used by the large card layout and by compact rows when Wallboard Mode is enabled.

Available values:

```text
1
2
3
4
5
6
8
```

### Text size

Scales the card presentation from:

```text
80% → 160%
```

---

## Wallboard Mode

### Full-width agent wallboard

Moves the Agent Status widget visually to the top of the dashboard and makes it span the available width.

### Wallboard height

Controls the height allocated to the Agent Status area.

Range:

```text
20% → 90%
```

Default:

```text
50%
```

---

## Auto-scroll

### Scroll when the list overflows

Automatically scrolls the Agent Status list when the cards don't fit.

### Speed

Controls scrolling speed in pixels per second.

### Pause at each end

Controls how long the wallboard waits at the top and bottom of the list.

---

## Interacting

### Blue glow on the card

Highlights agents currently interacting with a call.

### Pulse the glow

Animates the blue interaction glow.

### Show call timer instead of status timer

When an agent is interacting, the call duration becomes the primary timer displayed on the card.

---

# DOM Dependencies

The extension intentionally uses Genesys' existing DOM rather than building a replacement agent data model.

If a Genesys update changes the dashboard or Agent Workspace markup, these are the first areas to inspect.

## Agent Status widget

| Purpose             | Selector                                       |
| ------------------- | ---------------------------------------------- |
| Agent Status widget | `.widget-type-AGENT_STATUS`                    |
| Agent name          | `td.column-agent`                              |
| Status / presence   | `td.column-statusAndPresence`                  |
| Duration            | `td.column-unifiedDuration`                    |
| Presence indicator  | `.entity-v3-presence-indicator-dot.<presence>` |

## Wallboard layout

| Purpose                 | Selector                              |
| ----------------------- | ------------------------------------- |
| Dashboard layout parent | `.flow-layout-parent`                 |
| Main dashboard area     | `.flow-layout-main`                   |
| Agent Status sidebar    | `.flow-layout-sidebar`                |
| Dashboard widget        | `.analytics-ui-dashboard-card-widget` |

Wallboard Mode uses CSS grid placement on these containers rather than physically moving the elements.

## Click-to-dial

| Side     | Purpose      | Selector                                 |
| -------- | ------------ | ---------------------------------------- |
| Dispatch | Call popup   | `.info_popup` containing `Connecting to` |
| Dispatch | Number       | `.popup_inner_inner > span`              |
| Dispatch | Number click | `.init-call`                             |
| Genesys  | Open dialer  | `#interaction-new-call-outbound-target`  |
| Genesys  | Number field | `input.phone-number-input`               |
| Genesys  | Call button  | `button.make-call`                       |

If Genesys or the dispatch application changes its markup, these selectors may need updating.

---

# Architecture

The extension deliberately keeps the responsibilities separated.

```text
┌──────────────────────────────────────────────┐
│                Genesys Cloud                 │
│                                              │
│  Agent data / presence / timers / calls      │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   cards.css     │
              │                 │
              │ Presentation    │
              │ Cards           │
              │ Status colours  │
              │ Wallboard       │
              │ Animations      │
              └─────────────────┘
                       ▲
                       │
              ┌─────────────────┐
              │    cards.js     │
              │                 │
              │ Settings        │
              │ Scroll handling │
              │ DOM discovery   │
              └─────────────────┘
```

Click-to-dial uses a separate security boundary:

```text
┌──────────────────┐
│ Dispatch website │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ dial-dispatch.js │
│                  │
│ Capture number   │
│ Validate         │
│ Confirm user     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ background.js    │
│                  │
│ Re-validate      │
│ Verify sender    │
│ Verify target    │
│ Relay request    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ dial-genesys.js  │
│                  │
│ Agent Workspace  │
│ Genesys dialer   │
└──────────────────┘
```

The important design principle is:

> **Genesys owns the state; the extension owns the presentation.**

The extension does not maintain a second agent-status database or continuously rebuild the Agent Status widget.

---

# Why the Agent Status DOM is not rebuilt

The Agent Status widget is an Ember-powered Genesys component.

Replacing its DOM with extension-generated cards would mean the extension would have to continuously synchronise:

* Agent additions/removals
* Presence changes
* Timers
* Call state
* Interaction state
* Re-renders
* Sorting
* Filtering

Instead, the extension leaves the original table in place and uses CSS to change its presentation.

This means Genesys continues to provide its normal live updates while the extension simply changes how those rows look.

---

# Files

| File               | Purpose                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `manifest.json`    | MV3 extension manifest                                               |
| `background.js`    | Service worker; site registration and privileged click-to-dial relay |
| `sites.js`         | Site registration and enterprise allow-list handling                 |
| `schema.json`      | Managed storage policy schema                                        |
| `IT-DEPLOYMENT.md` | Enterprise deployment and policy configuration                       |
| `popup.html`       | Extension settings UI                                                |
| `popup.js`         | Settings persistence and site management                             |
| `defaults.js`      | Default settings                                                     |
| `cards.css`        | Agent card, wallboard and status presentation                        |
| `cards.js`         | Agent Status discovery, settings application and auto-scroll         |
| `dial-dispatch.js` | Dispatch-side number capture and confirmation                        |
| `dial-genesys.js`  | Genesys Agent Workspace dialer integration                           |
| `security.js`      | Shared number normalisation and validation                           |
| `test/`            | Automated security tests                                             |
| `icon-*.png`       | Extension/store icons                                                |

---

# Development

The extension has no runtime npm dependency requirement.

The security tests use Node's built-in test runner.

Run:

```bash
node --test
```

or:

```bash
node --test test/
```

For local extension development:

```text
1. Make changes
2. Open edge://extensions
3. Enable Developer mode
4. Reload the unpacked extension
5. Reload the Genesys dashboard if required
```

When site permissions or managed policy are involved, check:

```text
edge://policy
```

to verify the enterprise policy is being applied.

---

# Releases

Versions are tagged in the repository and published to the Microsoft Edge Add-ons store through the GitHub Actions workflow:

```text
.github/workflows/publish.yml
```

The release process is:

```text
Update manifest version
        ↓
Commit
        ↓
Create matching Git tag
        ↓
Push commit + tag
        ↓
GitHub Actions
        ↓
Build ZIP
        ↓
Edge Publish API
        ↓
Microsoft certification
        ↓
Store release
```

The manifest version must match the release tag.

Example:

```bash
git commit -am "0.7.7"
git tag 0.7.7
git push
git push --tags
```

The release workflow requires:

```text
EDGE_PRODUCT_ID
EDGE_CLIENT_ID
EDGE_API_KEY
```

configured as repository secrets.

---

# Troubleshooting

## Cards aren't appearing

Check:

1. The current hostname is present in the enterprise `allowedHosts` policy.
2. The site has been enabled from the extension popup.
3. The browser granted the host permission.
4. The page is a supported Genesys dashboard.
5. The Agent Status widget is present.

Check:

```text
edge://policy
```

for the enterprise policy.

---

## Wallboard Mode isn't working

Check that the Genesys dashboard still contains:

```text
.flow-layout-parent
.flow-layout-main
.flow-layout-sidebar
.analytics-ui-dashboard-card-widget
```

Genesys updates to the dashboard layout may change these selectors.

---

## Auto-scroll isn't working

Auto-scroll only activates when the Agent Status widget's own scroll container has more content than its available height.

Try:

* Increasing the number of agents.
* Increasing/decreasing Wallboard height.
* Checking that Auto-scroll is enabled.
* Checking that the widget actually has overflow.

---

## Click-to-dial does nothing

Check that:

* The dispatch site is enabled.
* The Genesys site is enabled.
* Genesys Agent Workspace is open.
* The number is permitted by the number policy.
* The Genesys dialer selectors have not changed.
* The browser has granted both site permissions.

---

## Genesys asks for an outbound queue

Configure the agent's default outbound line / **On Behalf of Queue** in Genesys.

---

## A site cannot be enabled

If the popup reports:

```text
"<hostname>" isn't in the extension policy
```

the hostname is not present in the enterprise `allowedHosts` policy.

This is an IT configuration issue, not a code/configuration setting in the extension.

---

## Styling remains after removing a site

Removing a site unregisters the extension and removes its permission.

A page that is already open may retain the injected CSS until the page is reloaded.

Reload the tab after removing the site.

---

# Browser Compatibility

The extension targets modern Chromium-based browsers using Manifest V3.

The CSS relies on:

```css
:has()
```

for status detection.

Edge/Chrome 105+ is required for the relevant selectors.

The extension is primarily developed and tested against Microsoft Edge because the production deployment is intended for Microsoft Edge.

---

# Security Notes

This extension is intended for controlled enterprise environments.

Important security properties include:

* Enterprise-controlled host allow-list
* Optional per-host browser permissions
* Human confirmation for click-to-dial
* `event.isTrusted` checks
* Number normalisation and validation
* Independent background-worker validation
* Sender/target validation
* Closed Shadow DOM confirmation UI
* No direct page-to-Genesys privileged communication

The extension should still be treated as a browser-side presentation and integration layer rather than a replacement for server-side security controls in the dispatch system.

---

# Licence

MIT — see [`LICENSE`](LICENSE).
