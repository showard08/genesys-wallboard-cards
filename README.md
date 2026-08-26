# Genesys Wallboard Agent Cards

Browser extension (Edge/Chrome, Manifest V3) that restyles the **Agent Status
widget** on a Genesys Cloud analytics dashboard
(`https://apps.<your-region>/directory/#/analytics/dashboards/…`) into large
stacked status cards:

- Agent name on top, centred, bold
- Presence dot + status label underneath, colour-coded
- Time-in-status below that, largest text on the card; on active calls the
  phone icon + call-duration link sit under the timer
- Cards stack vertically in the sidebar div where the table already sits
- If the list overflows the widget, it auto-scrolls: slowly down to the
  bottom, pause, back up to the top, pause, repeat

## How it works

The styling is pure CSS. The widget's table is real light-DOM
markup with stable class hooks (`.widget-type-AGENT_STATUS`, `td.column-agent`,
`td.column-statusAndPresence`, `td.column-unifiedDuration`,
`.entity-v3-presence-indicator-dot.<presence>`), so `cards.css` restyles the
rows in place as flex-column cards. Because the DOM is never touched, Ember's
re-renders and per-second timers keep working, and the styling automatically
re-applies to every re-rendered row.

Status colours are keyed off the presence dot's class via `:has()`
(needs Edge/Chrome 105+, i.e. anything from late 2022 on):

| Dot class  | Meaning                    | Colour |
|------------|----------------------------|--------|
| available  | Available                  | green  |
| idle       | On Queue — waiting         | teal   |
| on_queue   | On Queue — interacting     | blue   |
| busy       | Busy                       | red    |
| break      | Break                      | amber  |
| meal       | Meal                       | orange |
| away       | Away                       | grey   |
| offline    | Offline                    | dim grey |

(The status label class alone can't be used for this — `OFF_QUEUE` covers both
Available and Away; the dot class always distinguishes them.)

## Auto-scroll

When the card list is taller than the widget, `cards.js` drifts the widget's
own scroll container down to the bottom at 35 px/s, holds for 2.5 s, drifts
back up, holds, and repeats. It never modifies the widget's DOM — it only
drives `scrollTop` on the scroll container Ember already renders, so
re-renders and the per-second timers are unaffected. When everything fits on
screen, nothing moves.

## Install (on the wallboard machine)

1. Clone or download this repo onto the machine.
2. Edge: `edge://extensions` (Chrome: `chrome://extensions`) → enable
   **Developer mode** → **Load unpacked** → select this folder.
3. Open your Genesys Cloud dashboard tab, click the extension's toolbar icon
   (pin it from the puzzle-piece menu if it's hidden) and press
   **Add current tab's site**. Accept the browser's permission prompt.

The cards appear immediately. No Genesys domain is baked into the extension —
it only ever runs on sites you enable this way, and you can remove them from
the same popup. The list of enabled sites is stored locally in the browser
profile; the look-and-feel settings sync with the profile.

## Settings

Click the extension's toolbar icon to open the settings popup. Everything
saves as you change it and applies live to the open wallboard tab — no
reload needed. Settings sync with the browser profile (`chrome.storage.sync`).

| Setting | What it does |
|---|---|
| Card style | **Large boxes** — grid of boxes, name / status / timer stacked and centred. **Compact rows** — thin rows, name over status on the left, timer right. |
| Cards per row | Grid columns in large style (1–4). |
| Text size | Scales the whole card (80–160%). |
| Auto-scroll + speed + pause | Drift down/up when the list overflows; px per second and hold time at each end. |
| Blue glow / pulse | The glow on Interacting cards, and whether it breathes. |
| Show call timer instead of status timer | On Interacting cards, hide the time-in-status and promote the call timer to its place. |

**Reset** puts everything back to the defaults in `defaults.js`.

## Tuning (in the CSS)

Things without a popup setting:

- **Sizes**: font sizes are on the `column-agent` / `additional-label` /
  `time-in-status` rules in `cards.css` (per style, in the
  `html.agent-cards-large` / `html.agent-cards-compact` blocks).
- **Colours**: the `:has()` block in the middle of `cards.css`; the glow's
  colour/strength/reach is on the `::after` rule next to it.
- **Card look**: background/border-radius/padding on the `tbody tr` rule.
- **Card order**: cards follow the table's sort order — change the sort in the
  widget's settings (currently Duration ascending).

After editing, hit **Reload** on the extension in `edge://extensions`, then
refresh the wallboard tab. The CSS applies to every `widget-type-AGENT_STATUS`
widget on the dashboard; other widget types are untouched.
