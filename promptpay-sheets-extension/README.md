# PromptPay Sheets Extension

Independent Manifest V3 extension for Chrome **116+**. No build step, npm runtime dependencies, external JavaScript, Google API credentials, Apps Script, or backend. Its only network calls are to the private Android IPv4 address you configure.

## Load unpacked

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this directory (the directory containing `manifest.json`). If using the ZIP, extract it first.
4. Pin **PromptPay LAN Display** to the toolbar. Settings opens on first installation.
5. Enter Android's LAN IP, port (default 8080), and the exact API token from Android Settings. Both devices must be on a network that permits them to communicate.
6. Choose the amount source, column/cell and timeout. Click **Save** and grant access to that IP.
7. Click **Test Connection**; this also saves the displayed settings. Expect `Connected — playing video` or `Connected — showing QR`. Allow Chrome/OS local-network access if prompted.

Settings and the last acknowledged amount use `chrome.storage.local`, not sync. No recipient identifier is stored by the extension. API tokens never enter the Sheets page. Only trusted extension contexts can access extension storage.

## Amount sources

| Mode | Selection/configuration | Cell read |
|---|---|---|
| Current Row + Column (default) | Select A22 or row 22; column G | G22 |
| Fixed Cell | Configure D10; any restorable selection | D10 on the active sheet |
| Selected Cell | Select B8 | B8 |

All modes use the current spreadsheet and current sheet. There is no hard-coded spreadsheet ID or sheet name. Row mode accepts a single cell, a single full row, or a same-row range. It rejects multi-row ranges. Selected mode requires one cell. Use ordinary, unmerged cells; named-range selections are rejected. Fixed mode still requires a selection that can be safely restored.

Values such as `฿259`, `259`, `259.00`, `1,259.00`, and `฿1,259.00` are accepted. Empty cells, text, zero, negatives, NaN, bad grouping, scientific notation, multiple copied cells, and more than two decimals are rejected. Range: ฿0.01–฿9,999,999.99. Decimal commas and other currency symbols are not interpreted as baht. Sheets formulas are read as their **copied computed values**, not formula expressions.

## Keyboard workflow

- **Alt/Option + Q** — read the configured cell and show QR.
- **Alt/Option + X** — hide QR, return to video.
- **Alt/Option + R** — resend the last successfully acknowledged amount without reading Sheets.

Set or resolve conflicts at `chrome://extensions/shortcuts`. Chrome/OS shortcuts may win over defaults. These shortcuts normally apply while Chrome has focus. Hide and resend do not require a Sheets tab. A network timeout is not retried automatically because a command may already have reached Android.

Feedback appears as a Chrome notification, toolbar badge and action title, with the last result also stored locally. OS notification settings may suppress notification popups; pin the extension to see the badge. The popup provides **SHOW QR**, **HIDE QR**, **Resend Last**, and **Read Amount**. Read Amount explicitly previews the current cell; SHOW always reads again so a stale preview cannot be sent after a selection change. The popup also shows connection state and the last successful amount.

## How reading works and why the permissions are needed

Sheets renders cells using a canvas. This extension temporarily attaches `chrome.debugger` **only to the active Sheets tab** when you request Show or Read Amount. It reads the editor's name box, navigates to the exact target with a trusted Enter key, triggers Sheets' native Copy command, and reads the resulting text through an offscreen clipboard document. It checks that spreadsheet, sheet and target selection still match. It then restores the original selection and text/HTML clipboard and detaches before sending the payment.

Chrome displays a debugging banner while attached. Do not cancel that banner during the read; close DevTools first because only one debugger can attach. The extension does not use debugging to inspect network requests, evaluate formulas, read unrelated tabs, or change cell contents. The permission itself is powerful; the source is kept small for inspection.

| Permission | Purpose |
|---|---|
| `activeTab` | Identify the tab for a user-triggered command |
| `debugger` | Trusted editor navigation/copy on that Sheets tab |
| `offscreen`, `clipboardRead`, `clipboardWrite` | Read native copied value, preserve text/HTML clipboard |
| `storage` | Local configuration and last successful amount |
| `notifications` | Show command results and errors |
| Optional `http://*/*` | Installation declares potential LAN access; Save requests only `http://<configured-IP>/*` |

No Sheets host permission or all-site content script is installed. DOM adapter code runs only during the explicit read operation. The known name-box selectors are isolated in `content/sheets-adapter.js` so changes to Sheets' UI can be accommodated without changing the LAN protocol.

Keep the sheet and clipboard still during a read (usually less than a second, with up to about two seconds of bounded waiting for editor/copy readiness). Finish any cell editing with Enter or Escape first. Original clipboard text and HTML are restored; file/image clipboard contents cause an explicit refusal before modifying the clipboard. Unsupported native/custom clipboard formats may not round-trip through Chrome's string clipboard API. A browser crash/forced debugger detachment may prevent selection restoration; no payment is sent when cleanup reports failure.

No extra online fetch is needed to read cells. For offline operation, Google Sheets itself must already support/open the document offline. The extension cannot read a sheet that Sheets cannot open.

## Troubleshooting

- **Display Offline:** check the Android app is open, the address/port, same Wi-Fi/subnet routing, firewall, guest-network client isolation and Chrome/OS local-network permission. DHCP may have changed the address. Check the screen before retrying after a timeout.
- **API token rejected:** copy the complete token, without whitespace. Save Android and extension settings again.
- **Grant access:** Save in Settings and accept the permission for that IP. Old grants can be removed through Chrome's extension site-access settings.
- **Cannot read Sheets / debugger:** close DevTools and other debuggers. Leave Chrome's debugging banner enabled during the read. Managed browsers may prohibit this permission.
- **Name box unavailable:** open a normal Sheets editor URL (`https://docs.google.com/spreadsheets/d/.../edit`), wait for loading, and exit preview/published/embed modes. Google UI changes may need an adapter update. The extension fails explicitly instead of guessing a value.
- **Could not copy:** ensure copying is allowed by the document owner, finish cell editing, and select an ordinary unmerged cell. Protected copying is not bypassed.
- **Clipboard image/file:** copy some text first, then retry. The extension refuses to overwrite an image or file clipboard.
- **Wrong source:** use Read Amount and verify the reported sheet/cell; review column and mode. Fixed cells refer to the active sheet.
- **Shortcut does nothing:** check `chrome://extensions/shortcuts` for unassigned/conflicting commands and ensure Chrome has focus.
- **No notification:** allow Chrome notifications in OS settings and check the toolbar badge/title or popup.

## Tests and remaining acceptance checks

Run `npm test` with Node 20+ (no dependency installation needed). Tests cover numeric validation, all source modes, LAN configuration, clipboard/selection cleanup, debugger disconnect, sheet-change rejection and invalid copies. The Sheets orchestration tests use a simulated Chrome adapter; they do not certify Google's current live UI. Verify the three modes against your real editable spreadsheet, including a formula amount and a second sheet, before using it for payments. [Full verification notes](../verification/README.md).

## Same-computer web test (v1.0.1+)

Use host `localhost` or `127.0.0.1`, port `8080`, token `promptpay-local-demo-token`. Enter only the hostname in the IP field, without `http://`, path, or port. Save and Test Connection. This connects to the local web test instead of Android. For a separate Android device, continue using its private LAN IPv4 address. After updating an unpacked extension, click Reload at `chrome://extensions` and reopen Settings.

## v1.0.2 Sheets focus fix

The formula bar and offscreen keyboard buffer are not treated as unfinished cell edits. During debugger attachment, focus emulation keeps native name-box typing directed to the Sheets tab even when the popup is open; it is disabled before detach. Navigation uses trusted text insertion, waits for name-box focus to leave, and checks the formula preview for empty/mismatched literal values before sending. Live Chrome testing confirmed the user's A1 amount of 1,000 was sent through SHOW QR to the local web display, with column A configured.
