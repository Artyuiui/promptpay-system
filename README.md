# PromptPay LAN display system

Two independent projects communicate directly over HTTP on your local network. There is no application backend, cloud QR generator, Sheets API integration, or runtime CDN.

```text
Google Sheets in Chrome
  → Manifest V3 extension (native copy of configured cell)
  → authenticated HTTP over LAN
  → Android native app :8080
  → local PromptPay QR / local looping video
```

## Local web demo (no Android required)

```sh
cd promptpay-web-test
npm ci
npm start
```

Open http://localhost:8080 for the controller and simulated display. See [web test instructions](promptpay-web-test/README.md). Extension v1.0.2 supports localhost/127.0.0.1 for same-machine testing and fixes live Sheets popup focus handling.

## Start here

1. Follow [Android setup](promptpay-display-android/README.md): install the APK, enter your registered PromptPay ID, choose a local video, and note the API token and LAN IP.
2. Follow [extension setup](promptpay-sheets-extension/README.md): load unpacked, enter the Android IP/port/token, and click Test Connection.
3. In Sheets, select a single row or cell. The default is column **G** of the selected row.
4. Press **Alt/Option+Q** to show the amount, **Alt/Option+X** to hide, or **Alt/Option+R** to resend the last acknowledged amount. Timeout defaults to 60 seconds.

The Android project needs no extension files, and the extension needs no Android source files. Their only contract is the API below. Generated packages are in `dist/` after the build. The APK is debug-signed for local installation.

## HTTP contract

Every GET/POST requires `Authorization: Bearer <token>`. OPTIONS preflight is intentionally unauthenticated. JSON uses UTF-8. Responses include CORS headers and `Cache-Control: no-store`.

| Method / path | Input | Successful response |
|---|---|---|
| `POST /show` | `{"amount":259.00,"timeout":60}` | `{"online":true,"mode":"qr","amount":259,"remaining":60}` |
| `POST /hide` | `{}` | `{"online":true,"mode":"video","amount":null}` |
| `GET /status` | none | Current state, as above |
| `OPTIONS /show`, `/hide`, `/status` | none | 204, CORS preflight |

Amounts must be JSON numbers, positive, at most two decimals, and no greater than 9,999,999.99 baht. A display or bank may impose lower transaction limits. Timeout is an integer from 1–3600 seconds; omit it to use Android's configured default. `/show` requires `application/json`, Content-Length, and a body of at most 1,024 bytes. Chunked bodies are rejected. A new valid `/show` replaces the old payment and its deadline. Invalid requests preserve the current payment. Hide is idempotent. Countdown uses monotonic time; status lazily expires elapsed payments even when the UI is paused.

Errors: 400 invalid body/amount/timeout, 401 token missing/wrong, 404 unknown path, 405 wrong method, 415 wrong content type. Error bodies are `{"error":"description"}`. Neither identifier nor token appears in status. No request bodies or tokens are logged.

A successful show response acknowledges the display state; it is **not payment confirmation**. There is no bank settlement integration. Hiding a QR does not cancel a transfer already initiated by a payer.

## Offline operation and operating limits

Android copies the chosen video into app-private storage and generates all QR images locally. Hide, resend, status and payment display need only LAN access. Reading a Sheets cell uses the already-open editor's native copy behavior, including calculated values. Offline reading is possible only when Google Sheets itself has made that document and cell available offline; this extension cannot make uncached Google documents available without internet. Initial dependency downloads and loading an uncached sheet require internet.

Keep the Android app in the foreground, ideally pinned, with the device charging. There is no background service or boot auto-launch. The OS may kill a background app. Network reconnection does not recreate payment state or send a payment automatically; the server listens on all local interfaces, so it is reachable again once networking returns. Update the extension IP after DHCP changes, or reserve the device's address in your router.

The token restricts control but HTTP does not encrypt it. Use a trusted private LAN; do not forward the port to the internet. Settings remain local to the device/browser profile, with Chrome storage sync disabled. Android backup is disabled. The extension requests host access to the chosen private IPv4 address only. It does not retry an ambiguous `/show` automatically; verify the display before resending after a timeout.

## Validation

```sh
cd promptpay-display-android
# Set ANDROID_HOME to your Android SDK directory first.
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
cd ../promptpay-sheets-extension
npm test
```

See [verification notes](verification/README.md) for tested cases and remaining device/Sheets checks.

## Implementation references

- [Chrome commands](https://developer.chrome.com/docs/extensions/reference/api/commands), [debugger](https://developer.chrome.com/docs/extensions/reference/api/debugger), and [offscreen documents](https://developer.chrome.com/docs/extensions/reference/api/offscreen).
- [PromptPay payload reference implementation](https://github.com/dtinth/promptpay-qr) and [Bank of Thailand Thai QR guidelines](https://www.bot.or.th/content/dam/bot/documents/th/our-roles/payment-systems/payment/payment-all-hearing/policy-guideline-thai-qr-code-02.pdf).
- [ZXing](https://github.com/zxing/zxing) encodes the local payload; [NanoHTTPD](https://github.com/NanoHttpd/nanohttpd) supplies the HTTP transport.
