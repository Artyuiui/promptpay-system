# Verification report

## Completed

- Android debug APK built successfully with Gradle 8.11.1, AGP 8.8.2, SDK 35 and JDK 21.
- 11 JVM tests passed: numeric bounds, proxy formatting, CRC reference, independent payload golden vector, QR round-trip, monotonic expiry/replacement; real HTTP sockets for auth, preflight, methods, show/status/hide, bad requests, body-size limit and expiry/recovery.
- Android lint passed (zero errors; remaining compatibility/dependency/localization warnings are documented).
- 32 Node tests passed: currency parsing, source modes, address/settings validation, Sheets orchestration with a simulated Chrome adapter, rich-text clipboard restoration, debugger detach, selection restore, invalid copy and sheet-change failures.
- Installed and launched the APK in the available Pixel 10a ARM64 emulator (API 37.1 image). This is a runtime smoke test, not a physical 32-bit compatibility test.
- Actual APK HTTP smoke test passed: unauthorized commands/status rejected, OPTIONS accepted, show/status, invalid amount preserving state, replacement deadline, hide and automatic expiry.
- Generated a local four-second H.264 baseline test video, copied it into the emulator's app storage, and verified moving frames after QR hide and beyond the end of the clip (looping). No app crash or MediaPlayer error was found in the checked emulator log.
- Captured the actual screen and independently decoded its QR with zxing-cpp. The payload for test ID `0812345678` / ฿259 exactly matched `promptpay-qr@0.5.0`:

```text
00020101021229370016A000000677010111011300668123456785802TH53037645406259.0063042480
```

Screenshots: [video](android-video.png), [QR](android-qr.png). They use synthetic media and a test identifier; do not pay this QR.

## Browser runtime smoke test

A real headless Chrome test loads the MV3 extension, runs all three source modes against a locally intercepted Sheets-like HTML fixture, and checks native debugger navigation/copy, the offscreen clipboard bridge, and clipboard/selection restoration. The fixture is not a live Google spreadsheet. Its disposable extension copy grants the fixture origin so automation can emulate the activeTab grant normally supplied by a real toolbar/shortcut gesture.

To rerun (downloads a separate test browser on first installation):

```sh
cd verification
npm install
npm run browser-smoke
```

The harness uses a temporary Chrome profile and removes the temporary extension copy afterward. Runtime projects do not depend on Puppeteer.

## Reproduce the device smoke test

Configure an actual device or emulator, keep the app foreground, and set environment variables:

```sh
# For a USB-connected device/emulator (otherwise set DISPLAY_URL to its LAN address):
adb forward tcp:18080 tcp:8080
export DISPLAY_URL='http://127.0.0.1:18080'
export DISPLAY_TOKEN='your-configured-token'
python3 verification/android-smoke.py
```

This deliberately shows several test amounts and finishes in video mode. The Python script needs no third-party packages.

## Acceptance checks still needed

- Install on the intended armeabi-v7a / API 19+ device. Confirm video decoding, sustained looping, low-memory recovery and readability in its real orientation.
- Use the actual Chrome profile and editable Google Sheet. Verify row+column, fixed-cell and selected-cell modes, including a formula result, formatted currency, switching sheets and restoring the original selection/clipboard.
- Test real Wi-Fi routing, client isolation, reconnect and DHCP changes. Emulator ADB forwarding does not exercise the router.
- Test offline with a document already available in Google Sheets offline mode. Uncached Google documents are outside the extension's control.
- Verify the recipient and amount in a real bank app without submitting a transfer. Payload/CRC and QR decoding checks cannot establish account registration or bank acceptance.

The implementation has no boot receiver or background kiosk service. Those are optional enhancements, not tested capabilities.
