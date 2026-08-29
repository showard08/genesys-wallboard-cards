# Agent Cards extension — IT deployment guide

The "Genesys Wallboard Agent Cards" extension is published on the Microsoft
Edge Add-ons store and is **inert until enterprise policy is applied**: the
package contains no hostnames, and the list of sites it may operate on is
delivered exclusively through extension policy on managed machines. Machines
without the policy get a fully non-functional extension.

Two policy pieces are needed: the allowed-hosts value (required) and
force-install (recommended).

## 1. Allowed hosts (required)

The extension reads a managed-storage value named `allowedHosts` — a JSON
array of exact hostnames. Deploy this registry value to agent machines via
GPO registry preference or Intune:

Path (Edge):

    HKLM\SOFTWARE\Policies\Microsoft\Edge\3rdparty\extensions\<EXTENSION-ID>\policy

Value:

    Name:  allowedHosts
    Type:  REG_SZ
    Data:  ["DISPATCH-HOSTNAME", "GENESYS-HOSTNAME"]

Notes:
- `<EXTENSION-ID>` is the 32-character ID from the store listing URL
  (stable for the life of the listing).
- Hostnames are exact, lowercase, no scheme, no path — e.g.
  `apps.euw2.pure.cloud`. Replace the placeholders with the organisation's
  dispatch host and Genesys host.
- The data is a JSON array serialised as a string, including the square
  brackets and double quotes.
- Changes take effect without a browser restart; the extension re-checks on
  policy refresh.

## 2. Force-install and pin (recommended)

To install the extension silently on agent machines and prevent users from
removing or disabling it, add its ID to the Edge force-install policy:

    Policy: ExtensionInstallForcelist
    Value:  <EXTENSION-ID>

(Configured under Computer Configuration → Administrative Templates →
Microsoft Edge → Extensions, or the equivalent Intune configuration profile.
No update URL is needed for store-hosted extensions.)

Updates then flow automatically from the store whenever a new version passes
Microsoft certification; no further IT action is needed per release.

## Verification on a test machine

1. Apply the registry value, then open `edge://policy` and click
   **Reload policies**. The extension's `allowedHosts` policy should be listed.
2. Open the dispatch or Genesys site, click the extension's toolbar icon and
   press **Add current tab's site** — it should enable. Any host not in the
   policy is refused with a message directing the user to IT.
3. `edge://extensions` should show the extension as "Installed by your
   organisation" if force-install is applied.

## Security summary

- The store package contains no organisational hostnames.
- The effective scope of the extension is exactly the policy list; users
  cannot extend it (HKLM requires admin rights).
- Outbound dialling is confirm-gated per call, numbers are validated against
  a UK allow-list with premium-rate ranges blocked, enforced in two
  independent places in the extension.
- Source code, licence, and tagged releases: <REPO URL>.
